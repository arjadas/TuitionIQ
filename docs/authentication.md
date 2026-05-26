# TuitionIQ — Authentication System (Lean Spec v2.1.0)

**Stack:** React Expo (Web + Mobile) · C# ASP.NET Core · Supabase Auth
**Auth method:** Email + password only. No magic links. No passwordless login.

---

## Authentication Model Summary

| Property                 | Value                                                               |
| ------------------------ | ------------------------------------------------------------------- |
| Auth provider            | Supabase Auth (GoTrue)                                              |
| Token type               | JWT (access token)                                                  |
| Signing algorithm        | ES256 (ECDSA, P-256)                                                |
| Signing strategy         | Asymmetric — Supabase holds private key; backend validates via JWKS |
| Token validation         | C# ASP.NET Core — JWKS endpoint only                                |
| Identity source of truth | `public.users` (populated via DB trigger from `auth.users`)         |
| Session ownership        | Supabase Auth                                                       |

---

## Current Build Scope

> **Implementation note (added during the auth-flow + Home Screen work).** The shipping
> app is **teacher-only**. The following are specified later in this document for future
> phases but are **not implemented** in the current build — do not rely on them:
>
> - Student portal / student login and the `student → /student-portal` route
> - Invite-based registration (Section 6) and the "I have a pending invite" CTA
> - `students.user_id` linking, LMS, subscriptions / billing plans
>
> Two behaviours also differ from the original spec and are reflected inline below:
>
> - **Org resolution always shows the selector** for one or more memberships and **never
>   auto-selects**, even for a single org (Section 11).
> - **Auth bootstrap is an explicit state machine** — `authStatus ∈ { initializing,
>   unauthenticated, unverified, authenticated }`. Route guards render a loading screen
>   while `initializing` and never act on half-resolved state (Section 9).

---

## 1. System Architecture

```
CLIENT (React Expo)
  supabase.auth.*         → Supabase Auth (signUp, signIn, OTP, password reset)
  apiClient (Axios+JWT)   → C# ASP.NET Core API (all data reads/writes)

C# ASP.NET CORE API
  Validates every JWT via JWKS endpoint
  Enforces authorization, business rules, financial writes

SUPABASE PLATFORM
  auth.users              → managed by Supabase; never written to directly
  public.users            → TuitionIQ identity table; created via DB trigger
  PostgreSQL + RLS        → data isolation layer
```

**Routing rules (non-negotiable):**

- Auth actions (signUp, signIn, OTP, password reset) → Supabase directly from client
- All data reads/writes → C# API only
- `PATCH /api/users/email-verification` → C# API (sets `email_verified = TRUE` + audit log)

---

## 2. JWT Validation — JWKS-Based (Asymmetric ES256)

### 2.1 How It Works

Supabase issues JWTs signed with an **ECC P-256 private key**. The backend validates using the corresponding **public keys fetched from the JWKS endpoint**.

- **Algorithm:** ES256
- **JWKS endpoint:** `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` (the real `jwks_uri`, resolved automatically from the OIDC discovery document — see 2.2; `/auth/v1/keys` is not the JWKS URL)
- **Key selection:** Use the `kid` header in the JWT to select the correct key from the JWKS response
- **Key rotation:** Cache JWKS with a TTL (recommended: 1 hour); refresh on unknown `kid`

### 2.2 C# ASP.NET Core Setup

```csharp
// Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // JWKS endpoint — Supabase provides public keys for ES256 verification
        options.Authority = $"https://{builder.Configuration["Supabase:ProjectRef"]}.supabase.co/auth/v1";
        options.MetadataAddress = $"https://{builder.Configuration["Supabase:ProjectRef"]}.supabase.co/auth/v1/.well-known/openid-configuration";

        // REQUIRED: Supabase emits standard OIDC claim names ("sub", "email", ...). The default
        // handler rewrites them to legacy XML URIs (sub -> ClaimTypes.NameIdentifier), so
        // FindFirst("sub") returns null and identity resolution fails closed with ACCOUNT_SUSPENDED.
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            // Signing key resolved automatically from JWKS via Authority/MetadataAddress
            ValidateAudience         = true,
            ValidAudience            = "authenticated",
            ValidateIssuer           = true,
            ValidIssuer              = $"https://{builder.Configuration["Supabase:ProjectRef"]}.supabase.co/auth/v1",
            ValidateLifetime         = true,
            ClockSkew                = TimeSpan.FromSeconds(30),
            NameClaimType            = "sub",
            RoleClaimType            = "role",
        };

        options.RequireHttpsMetadata = true; // Always true in production
    });

app.UseAuthentication();
app.UseAuthorization();
```

> The JWT bearer middleware automatically fetches and caches the JWKS, handles `kid`-based key selection, and refreshes on unknown keys.

### 2.3 Validation Checklist (per request)

Every incoming request to a protected endpoint must pass all of these:

- Signature valid (ES256, public key from JWKS matched by `kid`)
- `exp` not exceeded
- `iss` matches Supabase project Auth URL
- `aud` = `"authenticated"`
- `sub` claim present (Supabase user UUID)

### 2.4 Identity Extraction

The JWT `sub` is the **Supabase auth uid** (`auth.users.id`), **not** the internal
`public.users.id`. Resolve the internal identity via the canonical `auth_user_id` link
(done once in `UserActiveCheckMiddleware`, then exposed by `ICurrentUserService`):

```csharp
var authUid = User.FindFirst("sub")?.Value; // Supabase auth uid (auth.users.id)
// Internal identity used by all commands/queries/FKs:
//   SELECT id FROM public.users WHERE auth_user_id = authUid
// ICurrentUserService.UserId      -> internal public.users.id (resolved)
// ICurrentUserService.AuthUserId  -> the auth uid above
```

### 2.5 Environment Variables (C# server only — never in Expo)

```
Supabase__ProjectRef=<project-ref>
Supabase__ServiceRoleKey=<service-role-key>   # Bypasses RLS. Never expose to client.
```

> `SUPABASE_JWT_SECRET` is **not used** for token validation. Do not add it to the validation pipeline.

---

## 3. Two User Tables — Critical Distinction

| Table          | Owner               | Purpose                                                 |
| -------------- | ------------------- | ------------------------------------------------------- |
| `auth.users`   | Supabase (internal) | Credential store. Never write to directly.              |
| `public.users` | TuitionIQ           | Canonical identity. All business logic references this. |

**Identity model.** `public.users.id` is an **independent internal UUID** (`gen_random_uuid()`),
**not** the Supabase auth uid. The auth uid (`auth.users.id`, the JWT `sub`) is stored in
`public.users.auth_user_id` (UNIQUE), which is the canonical link between the two tables:

```
public.users.id           = internal TuitionIQ identity (canonical; all FKs reference this)
public.users.auth_user_id = Supabase auth.users.id  (UNIQUE)
JWT sub                    = auth.users.id           = public.users.auth_user_id
```

All identity resolution goes through `auth_user_id`. The backend reads the JWT `sub`, resolves
it to the internal `users.id` once (in `UserActiveCheckMiddleware`), and passes that internal
id to every command/query. Because `id != auth.uid()`, RLS resolves the internal id via the
`public.current_user_id()` helper (see §10.1) rather than comparing `auth.uid()` to `id`.

> **History.** Earlier revisions assumed `id == sub` and resolved users by `users.id == sub`.
> That broke as soon as a row existed with an independent `id` (the real signup trigger uses
> `gen_random_uuid()`): every lookup missed and `UserActiveCheckMiddleware` returned
> `403 ACCOUNT_SUSPENDED`, which the client treats as a forced sign-out. The mapping bug
> (`MapInboundClaims` left at its default, so `FindFirst("sub")` returned null) produced the
> same 403 with an empty `sub`. Both are fixed: `MapInboundClaims = false` (see §2.2) makes the
> claims readable, and all lookups resolve via `auth_user_id`.

**`public.users` is created by DB trigger on first `signUp()`:**

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- id is omitted so the table default (gen_random_uuid()) generates an independent
  -- internal identity; the Supabase auth uid is stored only in auth_user_id.
  INSERT INTO public.users (auth_user_id, email, first_name, last_name, email_verified, is_active, created_at, updated_at)
  VALUES (
    NEW.id::TEXT, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    FALSE, TRUE, NOW(), NOW()
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER after_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

`email_verified = FALSE` always on creation. No user bypasses OTP verification.

---

## 4. Authentication Flows

### 4.1 Self-Registration (Path A)

```
1. Client: supabase.auth.signUp({ email, password, options: { data: { first_name, last_name } } })
   → Supabase creates auth.users + issues session
   → DB trigger creates public.users (email_verified = FALSE)

2. email_verified = FALSE → run OTP verification flow (Section 5)

3. On verified: router.replace('/home') → org resolution (Section 7)
```

**Error:** `"User already registered"` → show "Account exists, please log in" → navigate to /auth/login.

### 4.2 Login

```
1. Client: supabase.auth.signInWithPassword({ email, password })
   → Returns { data: { session, user }, error }

2. GET /api/users/me
   - 200 (email_verified = TRUE)  → router.replace('/home')
   - 403 EMAIL_NOT_VERIFIED       → OTP verification flow (Section 5)
   NOTE: UserActiveCheckMiddleware blocks unverified users on every protected route
   except PATCH /api/users/email-verification, so an unverified user receives a 403
   here — NOT a profile body with email_verified=false. The client infers "unverified"
   from the 403 `code`, it does not read a flag off the response body.

On error:
  - Show generic "Incorrect email or password" — do NOT specify which field
  - After 5 failures: surface "Forgot your password?" prominently
```

### 4.3 Password Reset

```
1. supabase.auth.resetPasswordForEmail(email, { redirectTo: <platform URL> })
   Always show: "If an account exists, a reset link has been sent." (prevents enumeration)
   60-second resend cooldown.

2. User clicks link → /auth/reset-password?code=<PKCE code>
   On mount: read code, strip from URL immediately:
     window.history.replaceState({}, '', '/auth/reset-password')

3. supabase.auth.exchangeCodeForSession(code)
   → Recovery session established

4. supabase.auth.updateUser({ password: newPassword })
   On success: supabase.auth.signOut() → router.replace('/auth/login')
```

**Redirect URLs by platform:**

- Web: `https://app.tuitioniq.com/auth/reset-password`
- Native: `tuitioniq://auth/reset-password`

---

## 5. Email OTP Verification (Post-Login, One-Time)

**Trigger:** After any `signUp()` or `signInWithPassword()` that returns a valid session where `public.users.email_verified = FALSE`.

```
STEP 1 — Dispatch OTP
  supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
  Navigate to /auth/verify-email (non-dismissable screen)

STEP 2 — User submits 6-digit code
  supabase.auth.verifyOtp({ email, token: otpCode, type: 'email' })

STEP 3 — Mark verified (C# API)
  PATCH /api/users/email-verification
  Authorization: Bearer <access_token>
  Body: {} (identity from JWT 'sub' claim)

  C# handler:
    1. Validate JWT → read 'sub' (auth uid) → resolve internal users.id via auth_user_id
    2. UPDATE public.users SET email_verified = TRUE, updated_at = NOW()
       WHERE id = <internal users.id> AND email_verified = FALSE
    3. INSERT audit_logs (action='user.email_verified', actor_id=<internal users.id>)
    4. Return 200 (idempotent — also 200 if already verified)

STEP 4 — Navigate to /home
```

**Enforcement rules:**

- `/auth/verify-email` screen is non-bypassable; re-check `email_verified` on app resume
- `(app)/_layout.tsx` redirects to verify-email if `email_verified = FALSE`
- C# `UserActiveCheckMiddleware` checks `email_verified = TRUE` on every protected request → 403 if false
- Only `PATCH /api/users/email-verification` may set `email_verified = TRUE`; clients cannot set it directly

**OTP UX requirements:** 60-second resend cooldown; "check spam" messaging; "Use a different account" link.

---

## 6. Invite-Based Registration (Path B)

### 6.1 Invite Dispatch (C# API: `POST /api/invites`)

```
1. Validate JWT; verify caller is org member
2. Query: SELECT id FROM public.users WHERE email = invite_email
   a. MATCH: link students.user_id immediately → account_status = 'active'
             INSERT organization_members; send notification email; no token needed
   b. NO MATCH: INSERT invites (status='pending', expires_at = NOW() + 7 days)
               UPDATE students SET account_status = 'invite_pending'
               Send invite email with token: https://app.tuitioniq.com/join?token=<token>
```

> Invite token is a TuitionIQ application token stored in `public.invites`. It is **not** a Supabase auth token.

### 6.2 Join Screen (`/join?token=<token>`)

```
On mount:
  1. Read token from URL params
  2. Strip immediately: window.history.replaceState({}, '', '/join')
  3. Store token in React state only (never localStorage, SecureStore, or URL)

Auth gate:
  - No active session + no account → Show SignUpForm (email pre-filled, read-only)
                                    → signUp() → DB trigger → OTP verification
  - No active session + has account → Show LoginForm (email pre-filled, read-only)
                                     → signInWithPassword() → OTP verification if needed
  - Active session → verify email_verified = TRUE; run OTP flow if FALSE

Token must survive the auth flow — keep in React state/context through sign-up or login.
```

### 6.3 Invite Acceptance (C# API: `POST /api/invites/accept`)

```
Body: { token: "<invite_token>" }
Authorization: Bearer <access_token>

Handler:
  1. Validate JWT → extract user.id
  2. SELECT * FROM invites WHERE token = ? AND deleted_at IS NULL
  3. Verify: status = 'pending' AND expires_at > NOW()
  4. Email match: SELECT id FROM public.users WHERE id = user.id AND email = invite.email
     → 403 if no match: "Invite issued to a different email address"
  5. Transaction:
     UPDATE students SET user_id = user.id, account_status = 'active'
     INSERT organization_members (org_id, user_id, role=invite.role, joined_at=NOW())
     UPDATE invites SET status='accepted', accepted_by=user.id, accepted_at=NOW()
     INSERT audit_logs (action='invite.accepted', ...)
  6. Return 200 { organization_id }
```

---

## 7. Token Strategy

### 7.1 Token Types

|             | Access Token                         | Refresh Token                        |
| ----------- | ------------------------------------ | ------------------------------------ |
| Format      | JWT (ES256, asymmetric)              | Opaque string                        |
| Expiry      | **1 hour**                           | **7 days**                           |
| Revocable   | No (stateless)                       | Yes (rotation + server invalidation) |
| Verified by | C# API via JWKS                      | Supabase Auth only                   |
| Stored      | SecureStore (ExpoSecureStoreAdapter) | SecureStore                          |

### 7.2 Expiry Rationale (Non-Negotiable)

1-hour access / 7-day refresh is mandatory. TuitionIQ holds student fee records and billing history. Shared devices are common. 14-day sessions are not acceptable.

### 7.3 Custom JWT Claims (Org Memberships)

```sql
-- Supabase Auth Hook → Supabase Dashboard → Authentication → Hooks → Custom Access Token
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims JSONB; user_id UUID; org_memberships JSONB;
BEGIN
  user_id := (event->>'user_id')::UUID;
  claims  := event->'claims';
  SELECT jsonb_agg(jsonb_build_object('org_id', organization_id, 'role', role))
  INTO org_memberships
  FROM public.organization_members WHERE user_id = user_id LIMIT 10;
  claims := jsonb_set(claims, '{app_metadata,orgs}', COALESCE(org_memberships, '[]'::JSONB));
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Reading in C#:**

```csharp
var appMetadata = User.FindFirst("app_metadata")?.Value;
var orgs = JsonSerializer.Deserialize<List<OrgClaim>>(appMetadata ?? "[]");
// Use for display/pre-filtering ONLY. Always re-query DB for write authorization.
```

**⚠️ Claims are stale for up to 1 hour after role changes.** Never use JWT claims as sole authorization for writes. Always re-query `organization_members` from DB.

---

## 8. Token Storage

### 8.1 ExpoSecureStoreAdapter

```typescript
// lib/supabase.ts
import * as SecureStore from "expo-secure-store";
import { createClient, SupportedStorage } from "@supabase/supabase-js";
import { Platform } from "react-native";

const ExpoSecureStoreAdapter: SupportedStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === "web",
    },
  },
);
```

### 8.2 Platform Storage Reality

| Platform | Storage                   | Encrypted        | XSS Risk |
| -------- | ------------------------- | ---------------- | -------- |
| iOS      | Keychain                  | Hardware AES-256 | No       |
| Android  | Keystore                  | Hardware-backed  | No       |
| Expo Web | `localStorage` (fallback) | None             | **Yes**  |

Mitigation for web: strict Content Security Policy (see Section 10.3). Do not attempt SSR cookie management — incompatible with this stack.

### 8.3 SecureStore 2KB Limit

Native platforms cap each key at 2KB. With org claims in the JWT, this may be exceeded.

**Rule:** After login, log `JSON.stringify(session).length`. Must stay below 1800 bytes. If exceeded, implement chunked storage (see original auth spec §3.4 for chunked adapter implementation).

---

## 9. Session Management

### 9.1 Session Lifecycle

- `autoRefreshToken: true` — SDK handles refresh automatically. Do not implement manual refresh logic.
- SDK queues pending requests during refresh; resends with new token. Do not retry on 401 for this reason.
- The API client must **not** force a sign-out on a 401. Let the SDK refresh; genuine session loss is emitted as `SIGNED_OUT` and handled by the guards. Forcing sign-out on a transient/endpoint 401 bounces a freshly-authenticated user back to login.
- AppState listener (native only):

```typescript
AppState.addEventListener("change", (status) => {
  if (status === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

### 9.2 Auth State Subscription (App root)

A single `onAuthStateChange` subscription is the **only** bootstrap path — supabase-js
emits `INITIAL_SESSION` on subscribe with the restored session, so there is no separate
`getSession()` call to race against. The handler updates the Zustand auth store; it does
**not** call `router.replace` for normal sign-in/out. Navigation is driven by a derived
`authStatus` that the route guards read:

```
authStatus = initializing    → still bootstrapping → guards render a loading screen
             unauthenticated  → no session         → (auth) group
             unverified       → session, email not verified → (verify) group
             authenticated    → session + email verified    → (app) group
```

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  switch (event) {
    case "INITIAL_SESSION":
    case "SIGNED_IN":
      setSession(session);
      // resolve email_verified, THEN clear isInitializingAuth so guards never
      // observe a half-resolved (session, emailVerified) combination
      break;
    case "TOKEN_REFRESHED":
    case "USER_UPDATED":
      setSession(session); // session changed; verification status unchanged
      break;
    case "SIGNED_OUT":
      clearAuthAndOrg();   // guards then route to (auth)/login
      break;
    case "PASSWORD_RECOVERY":
      router.replace("/auth/reset-password");
      break;
  }
});
```

**The readiness gate (`isInitializingAuth`) closes only after email-verification is
resolved for an authenticated session.** This eliminates the redirect race that
previously bounced verified users toward verify-email (and, via the API 401 handler, on
to login).

### 9.3 Logout

```typescript
// Current device only
supabase.auth.signOut();

// All devices (stolen device / account compromise)
supabase.auth.signOut({ scope: "global" });
```

Expose "Sign out everywhere" in user profile settings — not just developer tooling.

### 9.4 Deactivated Users

Supabase Auth does not check `public.users.is_active`. Three-layer mitigation (all required):

1. **RLS** — checks `is_active = TRUE`
2. **C# middleware** — `UserActiveCheckMiddleware` checks `is_active` on every request → 403
3. **Supabase Admin API** — `admin.auth.signOut(userId, 'global')` + set `ban_duration`

### 9.5 `getSession` vs `getUser`

- `getSession()` — reads cache; no network. Use for rendering/navigation decisions.
- `getUser()` — network call to verify freshness. Use before high-value operations (payment screens).

---

## 10. Security

### 10.1 Row-Level Security

RLS must be enabled on every table. Because `public.users.id != auth.uid()`, policies must
resolve the internal user id via `public.current_user_id()` — **never** compare `auth.uid()`
directly to `users.id` / `user_id` / `owner_id` / `actor_id` (those are FKs to the internal
`users.id`). Org-scoped policies use `get_user_org_ids()` (STABLE) — not correlated subqueries.

```sql
-- Canonical resolver: JWT sub (auth.uid()) -> internal public.users.id.
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid()::text
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.get_user_org_ids() RETURNS UUID[] AS $$
  SELECT array_agg(organization_id) FROM public.organization_members WHERE user_id = public.current_user_id()
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, pg_temp;
```

> The app's data path goes through the C# API (privileged Npgsql connection that bypasses RLS),
> so these policies are defense-in-depth today. The `current_user_id()` rewrite ships in
> migration `FixUserIdentityModel`. New tables added in future migrations must include
> `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.

### 10.2 Token Leakage Prevention

- **Never log JWT tokens.** Strip `Authorization` header before writing to application logs.
- **Invite token in URL:** Strip immediately on mount (`window.history.replaceState`). Store in React state only.
- **PKCE reset code in URL:** Strip immediately after `exchangeCodeForSession()`.
- `SUPABASE_SERVICE_ROLE_KEY` must never appear in any Expo environment variable.

### 10.3 XSS Mitigation (Expo Web)

```
Content-Security-Policy:
  default-src 'self';
  script-src  'self' 'nonce-{per-request-random}';
  connect-src 'self' https://<project-ref>.supabase.co;
  frame-src   'none';
  object-src  'none';
```

Never use `dangerouslySetInnerHTML` with user-generated content. Sanitise any rich text with DOMPurify before render.

### 10.4 CSRF

Not a meaningful threat — the C# API uses `Authorization: Bearer` header auth. Browsers cannot attach custom headers on cross-origin requests. Add origin validation as defense-in-depth for state-mutating requests:

```csharp
// OriginValidationMiddleware.cs — check Origin header on POST/PUT/DELETE/PATCH
var allowed = new[] { "https://app.tuitioniq.com", "tuitioniq://" };
if (!allowed.Any(a => origin.StartsWith(a, OrdinalIgnoreCase)))
{ context.Response.StatusCode = 403; return; }
```

### 10.5 Financial Write Pattern (C# API)

Every financial write endpoint must:

1. Validate JWT → extract `user.id`
2. Re-query `organization_members` to confirm org membership (never trust JWT claims)
3. Verify teacher→student link via `teacher_students`
4. Execute in a transaction with `audit_logs` insert
5. Return 200

### 10.6 Password Requirements

```
Min 8 chars · uppercase · lowercase · digit · special character
Regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/
```

Enforce client-side before `signUp()` / `updateUser()`. Mirror in Supabase Dashboard → Authentication → Password Settings. Show/hide toggle on all password fields.

### 10.7 Compromised Account Response

```
1. Teacher self-service: supabase.auth.signOut({ scope: 'global' })
2. Admin (C# API): POST /api/admin/users/{id}/revoke-sessions
   → supabaseAdmin.Auth.SignOut(userId, Global)
   → UPDATE public.users SET is_active = FALSE
3. Fraud confirmed:
   → admin.updateUserById(userId, { ban_duration: "87600h" })
   → Residual access window: up to 1 hour (active token lifetime)
   → Review audit_logs for that window
```

---

## 11. Post-Login Home Screen — Org Resolution

All successful logins navigate to `/home` after OTP verification. `/home` fetches the
user's profile + memberships and **never auto-navigates** — the user always makes an
explicit choice.

```
GET /api/users/me → user profile + memberships[]

memberships.length === 0 → "Welcome to TuitionIQ"
                           [Create organisation]   ← only CTA in the current build
                           (no "pending invite" CTA — invites are out of scope)

memberships.length >= 1  → ALWAYS show the organisation selector.
                           No auto-select, even for a single org.
                           User taps a card → store organization_id → route by role:
                             owner / admin / teacher → /dashboard
                             student                 → /student-portal  (future; not built)
```

> **Selector is always shown.** Earlier revisions auto-selected the org and skipped the
> selector when `memberships.length === 1`. That is removed: the selector renders for any
> user with one or more organisations, and the app never selects on the user's behalf.

**Org context storage:**

- Web: Zustand + `sessionStorage` (survives refresh; clears on tab close)
- Native: Zustand only (in-memory)

C# API always re-validates org membership from DB on write operations. Never derive authorization from cached org context alone.

---

## 12. Rate Limits (Configure in Supabase Dashboard)

| Endpoint                   | Recommended Limit       |
| -------------------------- | ----------------------- |
| `signUp`                   | 10/hour per IP          |
| `signInWithPassword`       | 10/hour per email       |
| `resetPasswordForEmail`    | 5/hour per email        |
| OTP send (`signInWithOtp`) | 10/hour per email       |
| Token refresh              | Keep default (360/hour) |

C# API application-level limits for invite dispatch: 50/hour per teacher, 200/day per org.

---

## 13. Handling Stale JWT Claims

**Problem:** JWT claims baked at token issuance. Removed teacher retains old org claim for up to 1 hour.

**Rules:**

- JWT claims = display hints only
- C# API MUST re-query `organization_members` from DB on every write
- For immediate revocation: call `admin.auth.signOut(userId, 'global')` when removing a teacher

---

## 14. Known Limitations and Mitigations

| Limitation                            | Mitigation                                                      |
| ------------------------------------- | --------------------------------------------------------------- |
| Credential stuffing                   | Rate limiting; plan TOTP MFA in v1.1                            |
| Expo Web `localStorage` token storage | Strict CSP + XSS discipline                                     |
| No MFA in v1.0                        | Design auth screens with MFA insertion points now; ship in v1.1 |
| JWT claims staleness (up to 1 hour)   | DB re-query on all writes; immediate revocation via Admin API   |
| OTP email delivery delay              | Tier-1 SMTP (Postmark); "check spam" UX; 60-second resend       |
| email_verified bypass                 | C# middleware enforces server-side; client guard is UX only     |

---

## 15. Environment Variables Reference

### Frontend (Expo — `EXPO_PUBLIC_` prefix required)

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>   # Safe to expose; RLS-constrained
EXPO_PUBLIC_API_BASE_URL=https://api.tuitioniq.com
```

### Backend (C# — secrets manager / environment only, never in Expo)

```bash
Supabase__ProjectRef=<project-ref>
Supabase__ServiceRoleKey=<service-role-key>   # Bypasses RLS — never expose to client
```

> `SUPABASE_JWT_SECRET` is not used. JWT validation uses JWKS (asymmetric ES256). Do not add it anywhere.

---

_TuitionIQ Authentication Spec v2.1.0 — Stack: React Expo · C# ASP.NET Core · Supabase Auth_
