# TuitionIQ — Production-Grade Authentication System

### Using Supabase Authentication · v2.0.0

> **Audience:** AI agents, backend engineers, and frontend developers implementing the auth system.
> **Auth provider:** Supabase Auth
> **Frontend:** React Expo (Web + Mobile — unified codebase)
> **Backend:** C# ASP.NET Core API

---

## ⚠️ Critical Schema Alignment Note

The user column mapping with Supabase Auth is:

| Schema Column        | Supabase Equivalent                                |
| -------------------- | -------------------------------------------------- |
| `users.auth_user_id` | `auth.users.id` (UUID from `supabase.auth` schema) |
| `users.email`        | `auth.users.email` (kept in sync)                  |

**Two separate user tables exist and must never be conflated:**

- `auth.users` — Supabase's internal table. Managed entirely by Supabase Auth. Do not write to it directly.
- `public.users` — TuitionIQ's canonical identity record. Populated by a Supabase database trigger on first registration. All business logic, the C# API, and RLS policies reference this table exclusively.

**Authentication method:** TuitionIQ uses **email and password authentication**. Users register with their first name, last name, email, and password. Returning users log in with email and password. After a user's **first successful login**, a one-time email OTP verification step is required before full access is granted. This OTP step is a post-login identity verification check — it is not part of the login credential itself.

**Password management:** Passwords are managed entirely by Supabase Auth. TuitionIQ never stores, hashes, or handles raw passwords. The `public.users` table has no password column. Password reset is handled through Supabase's recovery flow.

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Token Strategy](#2-token-strategy)
3. [Token Storage Strategy](#3-token-storage-strategy)
4. [Session Management Strategy](#4-session-management-strategy)
5. [Security Best Practices](#5-security-best-practices)
6. [Performance & Scalability](#6-performance--scalability)
7. [UX Considerations](#7-ux-considerations)
8. [Password Authentication — Design Rationale](#8-password-authentication--design-rationale)
9. [Pitfalls & Brutal Critique](#9-pitfalls--brutal-critique)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Authentication Flow

### 1.1 System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│              CLIENT — React Expo (Web + Mobile)                      │
│                                                                      │
│   @supabase/supabase-js  →  signUp() / signInWithPassword()         │
│                          →  resetPasswordForEmail() / updateUser()   │
│                          →  signInWithOtp() / verifyOtp()            │
│                             (email OTP verification step only)       │
└───────────────────────────┬──────────────────────────────────────────┘
                            │  Bearer JWT (access_token)
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
┌─────────────────────────┐   ┌───────────────────────────────────────┐
│  C# ASP.NET Core API    │   │         SUPABASE PLATFORM             │
│                         │   │                                       │
│  Validates JWT using    │   │  ┌────────────┐  ┌─────────────────┐ │
│  SUPABASE_JWT_SECRET    │   │  │Auth Service│  │   PostgREST     │ │
│                         │   │  │ (GoTrue)   │  │  (data reads)   │ │
│  Handles all business   │   │  └─────┬──────┘  └────────┬────────┘ │
│  logic & financial      │   │        │                   │          │
│  write operations       │   │        ▼                   ▼          │
└─────────────────────────┘   │  ┌──────────────────────────────────┐ │
                              │  │       PostgreSQL Database        │ │
                              │  │  auth.users (Supabase-managed)   │ │
                              │  │  public.users  ◄── DB trigger    │ │
                              │  │  public.organization_members     │ │
                              │  │  public.students                 │ │
                              │  └──────────────────────────────────┘ │
                              └───────────────────────────────────────┘

Data flow summary:
  Registration / login / password reset  → Supabase Auth directly from client
  Email OTP verification (post-login)    → Supabase Auth directly from client
                                           + PATCH /api/users/email-verification (C# API)
  Data reads (student lists, fee periods) → C# ASP.NET Core API
  Business logic writes (payments, invites) → C# ASP.NET Core API
  C# API verifies every JWT before processing via SUPABASE_JWT_SECRET
```

**Why split C# API and Supabase PostgREST?**
Supabase Auth remains the authentication provider, while the C# API is the single data-access gateway for frontend reads and writes. This keeps validation, authorization, and business rules centralized. Financial write operations and read endpoints both stay behind the API boundary.

---

### 1.2 Email + Password Auth — Core Mechanic

Before the registration paths, understand how the Supabase email/password methods work:

```
supabase.auth.signUp({ email, password, options: { data: { first_name, last_name } } })
  → Creates auth.users row with hashed password managed by Supabase.
  → Fires the after_auth_user_created DB trigger (Section 1.3), which creates public.users
    with first_name and last_name populated from raw_user_meta_data.
  → Returns a session immediately (auto-login on signup).
  → email_verified is set to FALSE in public.users — post-login OTP verification is required.

supabase.auth.signInWithPassword({ email, password })
  → Validates credentials against auth.users (Supabase-managed).
  → Returns { data: { session, user }, error }.
  → After session is established, the app checks public.users.email_verified:
      If FALSE → Email OTP verification flow (Section 1.2a) is required.
      If TRUE  → Proceed directly to /home.

supabase.auth.resetPasswordForEmail(email, { redirectTo })
  → Supabase sends a password reset email to the user with a recovery link.
  → The link type is 'recovery'. On clicking, the app exchanges the PKCE code for a session,
    then calls supabase.auth.updateUser({ password: newPassword }).

supabase.auth.updateUser({ password: newPassword })
  → Updates the password on the authenticated session (used in the reset flow).
  → Called only after the recovery code has been exchanged for a session.
```

---

### 1.2a Email OTP Verification — Post-Login Step

This flow applies to every user whose `public.users.email_verified = FALSE`. It fires after the first successful `signInWithPassword()` or `signUp()` call. It is a one-time identity confirmation step, not a recurring login factor.

```
TRIGGER: After signInWithPassword() or signUp() returns a valid session,
         GET /api/users/me → check email_verified field.

IF email_verified = FALSE:

  STEP 1 — CLIENT
    Call: await supabase.auth.signInWithOtp({
      email: session.user.email,
      options: { shouldCreateUser: false }
      // shouldCreateUser: false — user already exists; this is purely OTP dispatch
    })
    Navigate to /auth/verify-email screen.
    Show: "We've sent a 6-digit verification code to your email. Enter it below."
    Display: resend option (60-second cooldown), "Use a different account" link.

  STEP 2 — USER ENTERS OTP CODE
    Call: const { error } = await supabase.auth.verifyOtp({
      email: session.user.email,
      token: otpCode,          // 6-digit code from email
      type: 'email'
    })
    On success: session remains valid.

  STEP 3 — MARK VERIFIED (C# ASP.NET Core API)
    PATCH /api/users/email-verification
    Authorization: Bearer <access_token>
    Body: {}  // No body required — identity is taken from JWT 'sub' claim

    C# API:
      1. Validate JWT → extract user.id from 'sub' claim.
      2. UPDATE public.users SET email_verified = TRUE, updated_at = NOW()
             WHERE id = user.id AND email_verified = FALSE
      3. INSERT audit_logs (action='user.email_verified', actor_id=user.id, ...)
      4. Return 200.

  STEP 4 — NAVIGATE TO HOME
    router.replace('/home')
    Normal org context resolution proceeds (Section 1.6).

IF email_verified = TRUE:
  Proceed directly to /home. No OTP step required.

⚠️ The verify-email screen must be non-bypassable. If the user navigates away or
   backgrounding the app, re-check email_verified on return to the protected route group.
   Unverified users must not access (teacher) or (student) route groups.
```

---

### 1.3 Database Trigger — public.users Creation

This trigger bridges Supabase's `auth.users` with TuitionIQ's `public.users`. It fires once per user, on first registration via `signUp()`. `first_name` and `last_name` are populated from the metadata passed to `signUp()`. `email_verified` is always initialized to `FALSE`.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id, auth_user_id, email,
    first_name, last_name, email_verified, is_active, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.id::TEXT,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name',  ''),
    FALSE,   -- always requires post-login OTP verification on first access
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;  -- Idempotent: safe if trigger fires more than once

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Notes:**

- `first_name` and `last_name` are populated from `raw_user_meta_data` because the Sign Up form passes `options: { data: { first_name, last_name } }` to `signUp()`. For invite-first registrations (Section 1.4 Path B), the same Sign Up form is shown and the same metadata is passed. Empty strings are the fallback.
- `email_verified = FALSE` is always the initial state. No user bypasses the post-login OTP step, including users registered via invite.
- `ON CONFLICT (id) DO NOTHING` makes the trigger idempotent. Supabase can internally retry auth operations; this prevents a duplicate-row error.
- Supabase Auth manages the password hash internally in `auth.users`. The `public.users` table has no password column and never receives credential data.

---

### 1.4 User Registration & Login Flows

There are two valid entry paths. Both use email and password credentials.

---

#### Path A — Self-Registration and Login (any user)

```
── SIGN UP ──────────────────────────────────────────────────────────────

STEP 1 — CLIENT (Expo Web or Mobile) — /auth/signup screen
  User enters: first name, last name, email address, password, confirm password.
  Validate client-side: passwords match, password meets strength requirements
    (min 8 characters, at least one uppercase, one digit, one special character).

  Call: supabase.auth.signUp({
    email: 'user@example.com',
    password: 'SecurePassword1!',
    options: {
      data: {
        first_name: 'Jane',
        last_name:  'Smith',
      }
    }
  })

  On success:
    Session returned immediately. User is logged in.
    Supabase creates auth.users. DB trigger creates public.users (email_verified = FALSE).
  On error { message: 'User already registered' }:
    Show: "An account with this email already exists. Please log in instead."
    Navigate to /auth/login with email pre-filled.

STEP 2 — EMAIL OTP VERIFICATION
  email_verified = FALSE (always for new users).
  Run Section 1.2a flow.

STEP 3 — NAVIGATE TO HOME
  router.replace('/home')
  Org resolution proceeds (Section 1.6).
  Profile completion check is not required — first_name and last_name were
  collected at registration and written by the trigger.

── LOGIN ─────────────────────────────────────────────────────────────────

STEP 1 — CLIENT (Expo Web or Mobile) — /auth/login screen
  User enters: email address, password.

  Call: const { data, error } = await supabase.auth.signInWithPassword({
    email: 'user@example.com',
    password: 'SecurePassword1!',
  })

  On error:
    'Invalid login credentials' → Show: "Incorrect email or password. Please try again."
    Do NOT specify which field is wrong — prevents user enumeration.
    After 5 failed attempts: show "Forgotten your password?" prompt prominently.

STEP 2 — EMAIL OTP VERIFICATION CHECK
  GET /api/users/me → check email_verified.
  If FALSE → Section 1.2a flow.
  If TRUE  → proceed.

STEP 3 — NAVIGATE TO HOME
  router.replace('/home')
  Org context resolved at /home (Section 1.6).

── FORGOT PASSWORD ───────────────────────────────────────────────────────

STEP 1 — CLIENT — /auth/forgot-password screen
  User enters email address.

  Call: await supabase.auth.resetPasswordForEmail('user@example.com', {
    redirectTo: Platform.OS === 'web'
      ? 'https://app.tuitioniq.com/auth/reset-password'
      : 'tuitioniq://auth/reset-password',
  })

  Show: "If an account exists for this email, a password reset link has been sent."
  Always show this message regardless of whether the email exists — prevents
  user enumeration.
  60-second cooldown before allowing resend.

STEP 2 — USER CLICKS RESET LINK IN EMAIL
  Link format: https://app.tuitioniq.com/auth/reset-password?code=<PKCE code>
  On Expo Web: browser opens the reset-password URL.
  On Expo Native: deep link intercepted via tuitioniq://auth/reset-password

STEP 3 — CLIENT — /auth/reset-password screen
  Read `code` from URL params on mount.
  Strip code from URL immediately:
    window.history.replaceState({}, '', '/auth/reset-password')

  Exchange code for recovery session:
    const { error } = await supabase.auth.exchangeCodeForSession(code)

  On success: session established with recovery scope.
  Show: new password form (new password + confirm password fields).

STEP 4 — CLIENT — Submit new password
  Call: const { error } = await supabase.auth.updateUser({
    password: newPassword
  })

  On success:
    Show: "Your password has been updated. Please log in with your new password."
    Call: await supabase.auth.signOut()  // end recovery session
    router.replace('/auth/login')

  On error (e.g. weak password):
    Show inline validation error.
```

---

#### Path B — Invite-First Registration (any role invited by a teacher or admin)

```
STEP 1 — TEACHER/ADMIN ACTION (already authenticated)
  Teacher creates students row (user_id = NULL, account_status = 'no_account').
  Teacher clicks "Send portal invite" in the UI.

  Client → POST /api/invites  (C# ASP.NET Core API)

  C# API:
    a. Validate JWT. Verify teacher is org member via organization_members.
    b. Query: SELECT id FROM public.users WHERE email = invite_email
    c. If MATCH FOUND (student already self-registered):
         UPDATE students SET user_id = found_user.id, account_status = 'active'
         INSERT organization_members (org_id, user_id, role='student', joined_at=NOW())
         INSERT invites (status='accepted')  ← audit trail only
         Send notification email via SMTP: "You've been added to <OrgName>."
         No token link required. Student gains org access immediately.
    d. If NO MATCH:
         INSERT invites (status='pending', expires_at = NOW() + INTERVAL '7 days')
         UPDATE students SET account_status = 'invite_pending'
         Send invite email with token link:
           https://app.tuitioniq.com/join?token=<token>

         ⚠️ This token is a TuitionIQ invite token stored in public.invites.
            It is NOT a Supabase auth token or password reset link.
            The invite token accepts the org membership.
            Authentication (account creation or login) is handled separately.

STEP 2 — INVITEE RECEIVES INVITE EMAIL
  User clicks: https://app.tuitioniq.com/join?token=<token>

  Client reads token from URL params immediately on mount.
  Strip token from URL at once:
    window.history.replaceState({}, '', '/join')
  Store token in React component state only — not localStorage, not URL.

STEP 3 — AUTHENTICATION CHECK ON JOIN SCREEN
  Does the user have an active Supabase session?

  IF YES (user previously self-registered and is already logged in):
    Verify email_verified = TRUE. If not, run Section 1.2a flow first.
    Skip to Step 4.

  IF NO:
    IF the invitee has no existing account (they have not previously registered):
      Show Sign Up form:
        - Email field: pre-filled with invite email (read-only).
        - First name, last name, password, confirm password fields (editable).
        Call: supabase.auth.signUp({ email, password, options: { data: { first_name, last_name } } })
        On success: session established. DB trigger creates public.users.
        Run Section 1.2a OTP verification flow.

    IF the invitee already has an account (they registered independently):
      Show Login form:
        - Email field: pre-filled with invite email (read-only).
        - Password field.
        Call: supabase.auth.signInWithPassword({ email, password })
        On success: session established.
        Run Section 1.2a OTP verification flow if email_verified = FALSE.

    The invite token must survive the auth flow — store it in React state or
    React context before initiating the sign-up or login flow and retrieve it
    after the session is established and email verified.

STEP 4 — INVITE ACCEPTANCE (C# ASP.NET Core API)
  POST /api/invites/accept
  Authorization: Bearer <access_token>
  Body: { "token": "<invite_token>" }

  C# API:
    1. Validate JWT → extract user.id from 'sub' claim.
    2. SELECT * FROM invites WHERE token = ? AND deleted_at IS NULL
    3. Verify status = 'pending' and expires_at > NOW().
    4. Email match check:
         SELECT id FROM public.users WHERE id = user.id AND email = invite.email
         If no match: return 403 "This invite was issued to a different email address."
    5. Execute in a single transaction:
         UPDATE students SET user_id = user.id, account_status = 'active'
         INSERT organization_members (org_id, user_id, role=invite.role, joined_at=NOW())
         UPDATE invites SET status='accepted', accepted_by=user.id, accepted_at=NOW()
         INSERT audit_logs (action='invite.accepted', entity_type='invites', ...)
    6. Return 200 { organization_id: ... }

STEP 5 — REDIRECT
  Navigate to /home → org resolution now includes the newly joined org.
```

---

### 1.5 Logout Flow

```
STEP 1 — CLIENT
  Call: await supabase.auth.signOut()
  This:
    Sends DELETE /auth/v1/logout → refresh token invalidated server-side
    Clears tokens from SecureStore
    Fires SIGNED_OUT auth state event

STEP 2 — CLIENT CLEANUP
  Clear organization_id and membership data from app state.
  Clear sessionStorage (web only, if org context was persisted there).
  Navigate to /auth/login.

STEP 3 — BACKEND (automatic)
  C# API: next request with invalidated token returns 401.
  Any protected API endpoint returns 401/403 based on token validity and user access.

"SIGN OUT EVERYWHERE" (all devices):
  Call: await supabase.auth.signOut({ scope: 'global' })
  Invalidates ALL refresh tokens for this user across all devices.
  All other active sessions terminate on their next token refresh attempt.
  Expose this as a button in user profile settings — not just developer tooling.
  Teachers who lose a device should use this immediately.
```

---

### 1.6 Post-Login Home Screen — Org Context Resolution

Every successful authentication (after OTP verification) navigates to `/home` without exception. The home screen resolves org context:

```
ON /home MOUNT:

Query (C# ASP.NET Core API via apiClient):
  GET /api/users/me
  // Response includes memberships[] with:
  // organizationId, role, name, slug

RESULT: memberships[]

┌──────────────────────────────────────────────────────────────┐
│  memberships.length === 0                                    │
│  → Show "Welcome to TuitionIQ" screen                        │
│     Two options:                                             │
│       [Create your organisation]  →  /org/create            │
│       [I have a pending invite]   →  direct to /auth/login   │
│                                      (teacher must re-send   │
│                                       invite or check email) │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  memberships.length === 1                                    │
│  → Auto-select the org. No user action needed.              │
│     Store organization_id in app state.                      │
│     Navigate to role-appropriate destination:                │
│       owner/admin/teacher → /dashboard                       │
│       student             → /student-portal                  │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  memberships.length > 1                                      │
│  → Show org selector UI.                                     │
│     Display org name + user's role in each org.              │
│     User selects one.                                        │
│     Store selected organization_id in app state.             │
│     Navigate to role-appropriate destination.                │
└──────────────────────────────────────────────────────────────┘

Storage of org context:
  Web:    React app state (Zustand/Context) + sessionStorage
          (sessionStorage survives page refresh; clears on tab close)
  Mobile: React app state only (in-memory)
          SecureStore is for auth tokens, not org context.

Never derive authorization from cached org context alone.
The C# API always validates org membership from the database on write operations.
```

---

### 1.7 Handling Expired or Invalid Sessions

Subscribe to auth state changes at the React app root (App.tsx or equivalent):

```typescript
supabase.auth.onAuthStateChange((event, session) => {
  switch (event) {
    case "SIGNED_IN":
      setUser(session!.user);
      break;
    case "TOKEN_REFRESHED":
      setUser(session!.user);
      break;
    case "SIGNED_OUT":
      setUser(null);
      clearOrgContext();
      router.replace("/auth/login");
      break;
    case "USER_UPDATED":
      setUser(session!.user);
      break;
    case "PASSWORD_RECOVERY":
      // Recovery session active — navigate to reset password form
      router.replace("/auth/reset-password");
      break;
  }
});
```

For soft-deleted or deactivated users (`public.users.is_active = FALSE`):
Supabase Auth does not check your `public.users` table. The JWT remains technically valid until expiry.

Three mitigation layers, all required:

1. **RLS** checks `public.users.is_active = TRUE` — acts as database-level safety control.
2. **C# API middleware** checks `public.users.is_active` on every request — returns 403 if false.
3. **Supabase Admin API** — call `admin.auth.signOut(userId, 'global')` + set `ban_duration` to block future logins.

---

## 2. Token Strategy

### 2.1 Access Token vs Refresh Token

|                        | Access Token                                       | Refresh Token                                                       |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| **Format**             | JWT (signed, not encrypted)                        | Opaque random string                                                |
| **Contains**           | user.id, email, app_metadata org claims            | Nothing readable                                                    |
| **Where used**         | Every API request: `Authorization: Bearer <token>` | Only sent to Supabase `/auth/v1/token` to obtain a new access token |
| **Stored client-side** | Yes (SecureStore)                                  | Yes (SecureStore)                                                   |
| **Revocable**          | No — valid until expiry (stateless JWT)            | Yes — rotation + server-side invalidation                           |
| **Verified by**        | C# API (JWT secret, no DB call)                    | Supabase Auth only                                                  |

### 2.2 Recommended Expiry Durations

| Token                   | Recommended | Reason                                                                                                       |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| **Access token**        | **1 hour**  | Short blast-radius window if stolen. Stateless JWTs cannot be revoked mid-life — this caps the damage.       |
| **Refresh token**       | **7 days**  | Forces re-authentication weekly. Reasonable for daily-use apps.                                              |
| **Invite token**        | **7 days**  | Matches schema. Gives busy teachers and students time to act.                                                |
| **Password reset link** | **1 hour**  | Supabase default for recovery links. Short window reduces risk if reset email is intercepted.                |
| **Email OTP code**      | **10 min**  | Applied to the post-login verification OTP. Short window; user is already authenticated and at their device. |

### 2.3 Are 14-Day Sessions Appropriate? No.

TuitionIQ handles student fee records, billing history, and personal contact data. This is not a social media app. A stolen refresh token valid for 14 days is a two-week breach window.

Additional reasons to reject 14-day sessions:

1. **Shared devices are common.** Students and teachers use shared family computers and school devices. Long-lived sessions left open are a realistic attack vector, not a theoretical one.
2. **Refresh tokens cannot be remotely invalidated without explicit signOut.** The entire 14-day window must be served out before natural expiry if a device is stolen.
3. **Password re-authentication friction is acceptable.** The primary argument for long sessions is UX convenience. With a remembered password and a good UX, weekly re-login is low friction.
4. **GDPR / UK GDPR exposure.** Handling billing and fee records likely brings this system into scope. Regulators expect proportionate session controls on financial data.

**Decision: 1-hour access tokens + 7-day refresh tokens. Non-negotiable.**

### 2.4 Custom JWT Claims for Organisation Context

Add org memberships to the JWT to avoid per-request `organization_members` lookups in the C# API:

```sql
-- Supabase Auth Hook — fires before every JWT is issued (on login + token refresh)
-- Configure in: Supabase Dashboard → Authentication → Hooks → Custom Access Token

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims          JSONB;
  user_id         UUID;
  org_memberships JSONB;
BEGIN
  user_id := (event->>'user_id')::UUID;
  claims  := event->'claims';

  SELECT jsonb_agg(jsonb_build_object(
    'org_id', organization_id,
    'role',   role
  ))
  INTO org_memberships
  FROM public.organization_members
  WHERE user_id = user_id
  LIMIT 10;  -- Cap at 10 to keep JWT compact. See Section 3.4 for size concerns.

  -- Inject into app_metadata — NOT user_metadata (user_metadata is user-editable)
  claims := jsonb_set(
    claims,
    '{app_metadata,orgs}',
    COALESCE(org_memberships, '[]'::JSONB)
  );

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Reading org claims in C# ASP.NET Core:**

```csharp
// After JWT validation, extract org claims for display/pre-filtering only:
var appMetadata = User.FindFirst("app_metadata")?.Value;
var orgs = JsonSerializer.Deserialize<List<OrgClaim>>(appMetadata ?? "[]");
// Use for initial filtering. Re-verify against DB for all write operations.
```

**⚠️ JWT claims are baked at token issuance.** If a teacher is removed from an org, their old JWT still contains the old membership claim until expiry (up to 1 hour). Never use JWT claims as the sole authorization check for write operations. The C# API must always re-query `organization_members` from the database. For immediate role revocation, call `admin.auth.signOut(userId, 'global')`.

### 2.5 C# ASP.NET Core JWT Validation Setup

```csharp
// Program.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(
                    builder.Configuration["Supabase:JwtSecret"] // env var / secrets manager
                )
            ),
            ValidateAudience = true,
            ValidAudience    = "authenticated",  // Supabase sets this on all issued JWTs
            ValidateIssuer   = true,
            ValidIssuer      = $"https://{builder.Configuration["Supabase:ProjectRef"]}.supabase.co/auth/v1",
            ValidateLifetime = true,
            ClockSkew        = TimeSpan.FromSeconds(30)  // Tight. Do not inflate this.
        };
    });

builder.Services.AddAuthorization();

// Middleware — order matters
app.UseAuthentication();
app.UseAuthorization();
```

```csharp
// Extracting user identity in any controller:
var userId = User.FindFirst("sub")?.Value;  // Supabase uses 'sub' for user UUID
```

**Server-side environment variables (C# only — never in Expo):**

```
SUPABASE_JWT_SECRET=<jwt-secret>         # Supabase Dashboard → Settings → API
SUPABASE_PROJECT_REF=<project-ref>
SUPABASE_SERVICE_ROLE_KEY=<service-role> # Bypasses RLS. Never expose to client.
```

---

## 3. Token Storage Strategy

### 3.1 Why the HttpOnly Cookie / SSR Approach Does Not Apply Here

The previous version of this document described an HttpOnly cookie strategy requiring server-side rendering middleware (Next.js, SvelteKit). **That approach is incompatible with this tech stack.**

React Expo is a client-side framework. It does not have a server-side request-response cycle to intercept cookies. Attempting to add HttpOnly cookie management would require building a separate server layer (Node.js proxy, BFF) solely to wrap auth — adding infrastructure complexity that provides no benefit when the real backend is already C# ASP.NET Core.

The correct approach for this stack is `expo-secure-store` as the token storage layer across both native and web platforms. The security model differs by platform, and both the capabilities and limitations must be understood clearly.

---

### 3.2 expo-secure-store — Behaviour by Platform

| Platform     | Underlying Storage                  | Encryption                           | Accessible to JS?       |
| ------------ | ----------------------------------- | ------------------------------------ | ----------------------- |
| **iOS**      | Keychain Services                   | Hardware-backed AES-256              | No — OS-level isolation |
| **Android**  | Android Keystore                    | Hardware-backed on supported devices | No — OS-level isolation |
| **Expo Web** | `localStorage` (automatic fallback) | None — plaintext in browser          | Yes — XSS risk          |

**The web fallback is a real and documented limitation.** On Expo Web, `expo-secure-store` writes to `localStorage` because the browser has no equivalent of Keychain/Keystore. This means XSS attacks on the Expo Web app could extract tokens.

This is the accepted trade-off for a unified Expo codebase. The mitigation path is a strict Content Security Policy (Section 5.3) plus disciplined prevention of XSS injection points — not a different storage mechanism.

---

### 3.3 Supabase Client Configuration — Unified Expo Setup

```typescript
// lib/supabase.ts — shared by web and native

import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient, SupportedStorage } from "@supabase/supabase-js";
import { Platform } from "react-native";

const ExpoSecureStoreAdapter: SupportedStorage = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
    // On native: reads from Keychain/Keystore
    // On web:    reads from localStorage (SecureStore fallback)
  },
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
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
      // true on web  → SDK reads auth code from URL on password reset callback
      // false on native → no URL bar; deep link handled by app router
    },
  },
);
```

---

### 3.4 SecureStore 2KB Key Size Limit

`expo-secure-store` enforces a **2KB maximum value size per key** on native platforms. Supabase stores the full session JSON (including the JWT) under a single key. With org claims embedded in the JWT (Section 2.4), this limit can be breached.

**Test before launch:** After login, log `JSON.stringify(session).length`. It must stay below 1800 bytes with comfortable headroom.

If the session exceeds the limit, implement a chunked storage adapter:

```typescript
const CHUNK_SIZE = 1800; // bytes — conservative to stay clear of the 2048 limit

const ChunkedSecureStoreAdapter: SupportedStorage = {
  async getItem(key: string) {
    const chunkCountStr = await SecureStore.getItemAsync(`${key}_numchunks`);
    if (!chunkCountStr) {
      return SecureStore.getItemAsync(key); // value fits in one key
    }
    const count = parseInt(chunkCountStr, 10);
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${key}_chunk_${i}`),
      ),
    );
    return chunks.every(Boolean) ? chunks.join("") : null;
  },

  async setItem(key: string, value: string) {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
    await SecureStore.setItemAsync(`${key}_numchunks`, String(chunks.length));
    await Promise.all(
      chunks.map((chunk, i) =>
        SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk),
      ),
    );
  },

  async removeItem(key: string) {
    const chunkCountStr = await SecureStore.getItemAsync(`${key}_numchunks`);
    if (chunkCountStr) {
      const count = parseInt(chunkCountStr, 10);
      await Promise.all([
        SecureStore.deleteItemAsync(`${key}_numchunks`),
        ...Array.from({ length: count }, (_, i) =>
          SecureStore.deleteItemAsync(`${key}_chunk_${i}`),
        ),
      ]);
    }
    await SecureStore.deleteItemAsync(key);
  },
};
```

---

### 3.5 Environment Variables — Expo Naming Convention

Expo requires client-accessible environment variables to be prefixed `EXPO_PUBLIC_`. Without this prefix, they are `undefined` at runtime in the compiled bundle.

```bash
# .env (Expo project root)
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

`EXPO_PUBLIC_SUPABASE_ANON_KEY` is safe to expose. It cannot bypass RLS and cannot grant admin access. However, it can be used to invoke `signUp()` and `signInWithPassword()` — rate-limit these aggressively (Section 6.4).

The following must **never** appear in Expo environment variables:

```bash
# These live ONLY in C# server configuration / secrets manager
SUPABASE_JWT_SECRET=<jwt-secret>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>  # Bypasses RLS entirely
```

---

## 4. Session Management Strategy

### 4.1 How Supabase Sessions Work Internally

```
Supabase Auth (GoTrue) maintains:
  auth.sessions       — one row per active device session
  auth.refresh_tokens — one row per issued refresh token (invalidated on rotation)

On signInWithPassword({ email, password }):
  1. GoTrue validates credentials against auth.users (bcrypt comparison internally).
  2. Creates a session row and issues a refresh_token (opaque string).
  3. Derives a JWT (access_token) from user data + hook claims. Not stored server-side.
  4. Returns { access_token, refresh_token, expires_in, user } to client.
  5. SDK stores session in SecureStore via the adapter (Section 3.3).

On every C# API request:
  1. Client sends: Authorization: Bearer <access_token>
  2. ASP.NET Core JWT middleware verifies signature using SUPABASE_JWT_SECRET.
     No database lookup. Pure cryptographic verification.
  3. User identity resolved from 'sub' claim.
  4. Business logic proceeds.

On every frontend data request to the C# API:
  1. ASP.NET Core verifies JWT signature using SUPABASE_JWT_SECRET.
  2. User identity is resolved from JWT claims.
  3. API authorization + database checks enforce org-scoped access.

On token refresh (handled automatically by SDK):
  1. SDK detects access_token expiring within 60 seconds.
  2. Sends refresh_token to POST /auth/v1/token?grant_type=refresh_token.
  3. GoTrue validates, issues new access_token + new refresh_token.
  4. Old refresh_token immediately invalidated (rotation).
  5. SDK stores new tokens. Pending requests are re-sent with new access_token.
```

### 4.2 autoRefreshToken — Let the SDK Handle It

Do not implement manual refresh logic. Set `autoRefreshToken: true` in the client config and leave it alone.

```typescript
// ✅ CORRECT
const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: true },
});

// ❌ WRONG — causes unnecessary network calls and risks double-rotation errors
setInterval(() => {
  supabase.auth.refreshSession();
}, 30_000);
```

Requests made during a refresh are queued internally by the SDK and re-sent after the new token is available. Do not build retry logic around 401 responses for this scenario — the SDK handles it.

### 4.3 Mobile App Backgrounding

When an Expo native app is backgrounded, the SDK's auto-refresh timer should pause to avoid battery drain and spurious refresh attempts:

```typescript
// App.tsx — add alongside the auth state subscription
import { AppState, type AppStateStatus } from "react-native";
import { supabase } from "@/lib/supabase";

AppState.addEventListener("change", (status: AppStateStatus) => {
  if (status === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
```

On Expo Web, `autoRefreshToken: true` already responds to the browser's `visibilitychange` event. No additional code needed for web.

### 4.4 getSession vs getUser — When to Use Each

```typescript
// getSession() — reads from in-memory cache. No network call.
// Use for: rendering decisions, pre-filling UI, checking if user is logged in.
const {
  data: { session },
} = await supabase.auth.getSession();

// getUser() — always makes a network call to verify the token server-side.
// Use for: security-sensitive operations that require a freshness guarantee.
// Example: before displaying a payment history page, or before a high-value write.
const {
  data: { user },
} = await supabase.auth.getUser();
```

Subscribe once at app root. Do not call `getSession()` in individual component `useEffect` hooks:

```typescript
// App.tsx — set up once
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));

  return () => subscription.unsubscribe();
}, []);
```

### 4.5 Multi-Device Session Handling

Supabase supports multiple concurrent sessions — one per device. Each has its own independent `refresh_token`.

```
Scenario: Teacher logged in on laptop + phone.
  Laptop: supabase.auth.signOut()         → laptop refresh_token invalidated.
  Phone:  unaffected — different refresh_token.

Scenario: Teacher's phone is stolen.
  Teacher (from laptop): supabase.auth.signOut({ scope: 'global' })
  → All refresh_tokens for this user invalidated instantly.
  → Phone session ends on its next token refresh attempt (within 1 hour).
  → Active access tokens remain valid until expiry — inherent to stateless JWTs.
  → 1-hour access token limit controls the residual exposure window.

Admin-initiated global logout (C# API using Supabase Admin client):
  // For account suspension or confirmed compromise
  await supabaseAdmin.Auth.SignOut(userId, SignOutScope.Global);
  // Also set: UPDATE public.users SET is_active = FALSE
  // Also call: admin.updateUserById(userId, { ban_duration: "87600h" })
```

---

## 5. Security Best Practices

### 5.1 Row-Level Security (RLS) Integration

RLS is your database-level security boundary. It is not optional. A table with RLS disabled is fully readable by any authenticated request with the anon key.

```sql
-- Enable RLS on all tables (idempotent — safe to run repeatedly)
ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_students     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_periods          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           ENABLE ROW LEVEL SECURITY;
```

**Performance helper function — cache user's org IDs per transaction:**

```sql
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS UUID[] AS $$
  SELECT array_agg(organization_id)
  FROM public.organization_members
  WHERE user_id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
-- STABLE: result cached per transaction, not re-evaluated per row.
-- With 10,000 students, this is the difference between 10,000 subqueries and 1.
```

**Core RLS policies:**

```sql
-- organization_members: users see only memberships in their own orgs
CREATE POLICY "org_members_isolation" ON public.organization_members
  FOR ALL USING (
    organization_id = ANY(public.get_user_org_ids())
  );

-- students: visible to members of the same org only
CREATE POLICY "students_org_isolation" ON public.students
  FOR ALL USING (
    organization_id = ANY(public.get_user_org_ids())
    AND deleted_at IS NULL
  );

-- fee_payments: staff (owner/admin/teacher) only — students cannot see payment ledger
CREATE POLICY "fee_payments_staff_access" ON public.fee_payments
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
    )
  );

-- fee_periods: students see their own periods only
CREATE POLICY "fee_periods_student_self" ON public.fee_periods
  FOR SELECT USING (
    student_id IN (
      SELECT id FROM public.students
      WHERE user_id = auth.uid()
        AND deleted_at IS NULL
    )
  );

-- fee_periods: staff see all periods in their org
CREATE POLICY "fee_periods_staff_access" ON public.fee_periods
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'teacher')
    )
  );

-- users: self-read + read co-members in shared orgs
CREATE POLICY "users_read" ON public.users
  FOR SELECT USING (
    id = auth.uid()
    OR id IN (
      SELECT user_id FROM public.organization_members
      WHERE organization_id = ANY(public.get_user_org_ids())
    )
  );

-- users: self-update only (name, avatar, phone)
CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK  (id = auth.uid());
```

---

### 5.2 Preventing Token Leakage

```
1. Never log JWT tokens.
   C# API: strip the Authorization header before writing to application logs.
   Ensure error monitoring tools (Sentry, Application Insights) exclude auth headers.

2. Invite token in URL: strip it immediately.
   Read token from URL params on component mount.
   Call window.history.replaceState({}, '', '/join') before any other logic.
   Store in React state only. Do not persist to SecureStore or sessionStorage.

3. Password reset PKCE code in URL: strip immediately after exchange.
   Call window.history.replaceState({}, '', '/auth/reset-password') after
   supabase.auth.exchangeCodeForSession(code) succeeds.

4. EXPO_PUBLIC_ variables are bundled into the app binary.
   EXPO_PUBLIC_SUPABASE_ANON_KEY: acceptable — constrained by RLS, cannot bypass auth.
   SUPABASE_SERVICE_ROLE_KEY: must never be EXPO_PUBLIC_. If leaked, rotate immediately.
   SUPABASE_JWT_SECRET: must never be EXPO_PUBLIC_.
     Rotation: change in Supabase Dashboard → all existing sessions immediately invalidated
               → all users must re-authenticate. This is disruptive but is the only correct
               response to a leaked JWT secret.

5. Never expose the user's plaintext password anywhere in logs, error messages,
   or debug output. Supabase handles password hashing; the application layer never
   touches raw credentials.
```

---

### 5.3 XSS Mitigation for Expo Web

Since `expo-secure-store` falls back to `localStorage` on web, XSS is the primary token theft vector for Expo Web users. Mitigation must be layered:

```
Layer 1 — Content Security Policy (deliver as HTTP response header from CDN / hosting):

  Content-Security-Policy:
    default-src 'self';
    script-src  'self' 'nonce-{per-request-random}';
    connect-src 'self' https://<project-ref>.supabase.co;
    img-src     'self' data: https:;
    frame-src   'none';
    object-src  'none';

  Do NOT use 'unsafe-inline' or 'unsafe-eval'.
  Expo Web build output is CSP-compatible; test with your specific build configuration.

Layer 2 — No dangerouslySetInnerHTML with user-generated content.
  Teacher notes, student names, and all free-text fields are user content.
  Always render via React JSX. Never use innerHTML or raw DOM manipulation.

Layer 3 — Sanitise any content rendered as HTML.
  If rich text is introduced (lesson notes, etc.), sanitise before rendering:
    import DOMPurify from 'dompurify'
    const clean = DOMPurify.sanitize(userInput, { ALLOWED_TAGS: ['b', 'i', 'p'] })

Layer 4 — Minimise third-party scripts.
  Each analytics, support, or marketing script added to Expo Web expands the XSS attack surface.
  Every third-party script must load from a trusted CDN with Subresource Integrity (SRI) hashes.
  Audit third-party scripts quarterly.
```

---

### 5.4 CSRF Considerations

CSRF is not a meaningful threat to this architecture. The C# API uses `Authorization: Bearer` header authentication. Browsers cannot set custom headers on cross-origin requests. An attacker cannot forge a cross-origin request that carries a valid Bearer token — the browser will not attach it.

As defense-in-depth, validate the `Origin` header in the C# API for state-mutating requests:

```csharp
app.Use(async (context, next) =>
{
    if (HttpMethods.IsPost(context.Request.Method)   ||
        HttpMethods.IsPut(context.Request.Method)    ||
        HttpMethods.IsDelete(context.Request.Method) ||
        HttpMethods.IsPatch(context.Request.Method))
    {
        var origin  = context.Request.Headers["Origin"].ToString();
        var allowed = new[] { "https://app.tuitioniq.com", "tuitioniq://" };

        if (!string.IsNullOrEmpty(origin) &&
            !allowed.Any(a => origin.StartsWith(a, StringComparison.OrdinalIgnoreCase)))
        {
            context.Response.StatusCode = 403;
            return;
        }
    }
    await next();
});
```

---

### 5.5 Secure API Design for Financial Operations

All data read and write operations must route through the C# ASP.NET Core API. Direct PostgREST access from the frontend is prohibited.

```
Allowed via C# API (frontend data access):
  ✅ GET /api/organizations/{orgId}/students
  ✅ GET /api/organizations/{orgId}/periods
  ✅ GET /api/users/me

Prohibited via direct PostgREST access from frontend:
  ❌ GET /rest/v1/students
  ❌ GET /rest/v1/fee_periods
  ❌ GET /rest/v1/organization_members
  ❌ POST fee_payments      →  POST /api/payments
  ❌ POST student_fees      →  POST /api/students/{id}/fees
  ❌ POST invites           →  POST /api/invites
  ❌ PATCH fee_periods      →  PATCH /api/periods/{id}/waive
  ❌ DELETE students (soft) →  DELETE /api/students/{id}

C# API pattern for every financial write:
  [HttpPost("api/payments")]
  [Authorize]
  public async Task<IActionResult> RecordPayment([FromBody] RecordPaymentRequest req)
  {
    var userId = User.FindFirst("sub")!.Value;

    // Step 1: Verify caller is org member
    var membership = await db.OrganizationMembers
      .FirstOrDefaultAsync(m => m.UserId == userId &&
                                m.OrganizationId == req.OrganizationId);
    if (membership is null || membership.Role is "student")
      return Forbid();

    // Step 2: Verify teacher owns the student
    var link = await db.TeacherStudents
      .FirstOrDefaultAsync(ts => ts.TeacherId == userId &&
                                 ts.StudentId  == req.StudentId);
    if (link is null) return Forbid();

    // Step 3: Execute in transaction
    await using var tx = await db.Database.BeginTransactionAsync();
    var payment = new FeePayment { ... };
    db.FeePayments.Add(payment);
    db.AuditLogs.Add(new AuditLog {
      Action = "fee_payment.recorded",
      ActorId = userId,
      EntityType = "fee_payments",
      EntityId = payment.Id,
      NewValues = JsonSerializer.SerializeToDocument(payment),
    });
    await db.SaveChangesAsync();
    await tx.CommitAsync();

    return Ok(payment.Id);
  }
```

---

### 5.6 Password Security Requirements

Passwords are validated client-side before submission and enforced by Supabase's password policy configuration in the dashboard.

```
Minimum password requirements:
  - 8 characters minimum length
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one digit
  - At least one special character (!@#$%^&*...)

Supabase Dashboard → Authentication → Password Settings:
  - Set minimum password length to 8
  - Enable "Require uppercase letters"
  - Enable "Require lowercase letters"
  - Enable "Require numbers"
  - Enable "Require special characters"

Client-side enforcement (before calling signUp / updateUser):
  const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/
  if (!PASSWORD_REGEX.test(password)) {
    showError("Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.")
    return
  }
  if (password !== confirmPassword) {
    showError("Passwords do not match.")
    return
  }

Never show the actual password in plain text — use password input fields throughout.
Provide a show/hide password toggle (eye icon) on all password fields.
```

---

### 5.7 Handling Compromised Accounts

```
Scenario: Teacher's device is stolen.

Immediate response:
  1. Teacher (from another device) uses "Sign out everywhere":
       supabase.auth.signOut({ scope: 'global' })
     All refresh_tokens invalidated. Active access tokens expire within 1 hour.

  2. Admin (C# API admin endpoint: POST /api/admin/users/{id}/revoke-sessions):
       await supabaseAdmin.Auth.SignOut(userId, SignOutScope.Global);
       await db.Users.Where(u => u.Id == userId)
                     .ExecuteUpdateAsync(u => u
                       .SetProperty(x => x.IsActive, false)
                       .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
       db.AuditLogs.Add(new AuditLog { Action = "admin.account_suspended", ... });

  3. If fraud is confirmed:
       await supabaseAdmin.Auth.UpdateUserById(userId, new { ban_duration = "87600h" });
     This blocks future login attempts at the auth layer.
     RLS policies checking is_active = TRUE block data access even with old tokens.

  4. If the teacher's password may have been observed:
       Admin forces a password reset:
       await supabaseAdmin.Auth.UpdateUserById(userId, new AdminUserAttributes {
         Password = GenerateSecureTemporaryPassword()  // forces them to reset on next login
       });
       OR: initiate server-side resetPasswordForEmail flow.

Residual window:
  Access tokens issued before revocation remain valid for up to 1 hour (their remaining lifetime).
  This is unavoidable with stateless JWTs. The 1-hour access token limit is what makes this
  acceptable. Review audit_logs for the window if financial fraud is suspected.
```

---

## 6. Performance & Scalability

### 6.1 One Context Query Per Login

Resolve all user context in a single query on the home screen after login. Cache the result in Zustand or React Context. Do not re-fetch on every navigation:

```typescript
// hooks/useOrgMemberships.ts
export const loadOrgMemberships = async () => {
  const { data } = await apiClient.get("/api/users/me");
  return data.memberships ?? [];
};

// Invalidate and re-fetch only when:
// - User switches org
// - SIGNED_IN or USER_UPDATED auth event fires
// - C# API returns 403 on an org-scoped resource (stale membership)
```

### 6.2 JWT Verification is Stateless — Use It

The C# API verifies JWTs by checking the signature with `SUPABASE_JWT_SECRET`. No database lookup. No network call. At 10,000 concurrent users, JWT verification adds microseconds per request.

Design principle: route all frontend data reads and writes through the C# API. Keep read endpoints efficient with projection, filtering, pagination, and caching where appropriate.

### 6.3 RLS Policy Performance

```sql
-- SLOW: correlated subquery re-evaluated per row evaluated
CREATE POLICY "slow_example" ON public.students
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- FAST: STABLE function result cached for the entire transaction
CREATE POLICY "fast_example" ON public.students
  FOR SELECT USING (
    organization_id = ANY(public.get_user_org_ids())
  );
```

At 10,000 rows evaluated per query, this is the difference between 10,000 subqueries and 1. Use `get_user_org_ids()` in every multi-row RLS policy.

### 6.4 Rate Limiting

Configure in Supabase Dashboard → Authentication → Rate Limits before launch:

| Endpoint                   | Default           | Recommended       |
| -------------------------- | ----------------- | ----------------- |
| `signUp`                   | 30/hour per IP    | 10/hour per IP    |
| `signInWithPassword`       | 30/hour per email | 10/hour per email |
| `resetPasswordForEmail`    | 30/hour per email | 5/hour per email  |
| OTP send (`signInWithOtp`) | 30/hour per email | 10/hour per email |
| Token refresh              | 360/hour          | Keep default      |

Add application-level rate limiting in the C# API for invite dispatch:

- Max 50 invites dispatched per teacher per hour.
- Max 200 invites dispatched per organisation per day.

These limits prevent a compromised teacher account from bulk-inviting external attackers.

---

## 7. UX Considerations

### 7.1 Sign Up Screen

The Sign Up screen collects all required information in a single form. Because `first_name` and `last_name` are passed via `signUp()` metadata and written by the DB trigger, no subsequent profile completion modal is needed for self-registered users.

```typescript
// On /auth/signup:
const handleSignUp = async (
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  confirmPassword: string,
) => {
  // Client-side validation
  if (password !== confirmPassword) {
    showError("Passwords do not match.");
    return;
  }
  if (!PASSWORD_REGEX.test(password)) {
    showError("Password does not meet requirements.");
    return;
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
    },
  });

  if (error) {
    if (error.message.includes("already registered")) {
      showError("An account with this email already exists. Please log in.");
      router.push("/auth/login");
      return;
    }
    showError("Registration failed. Please try again.");
    return;
  }

  // Session is returned automatically — proceed to OTP verification
  // (email_verified = FALSE for new users; Section 1.2a applies)
  await checkAndRunEmailVerification();
};

// Fields on the Sign Up screen:
//   First Name       (text input, required)
//   Last Name        (text input, required)
//   Email Address    (email input, required)
//   Password         (password input with show/hide toggle, required)
//   Confirm Password (password input with show/hide toggle, required)
//   [Create Account] button
//   "Already have an account? Log in" link → /auth/login
```

---

### 7.2 Login Screen

```typescript
// On /auth/login:
const handleLogin = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    incrementFailedAttempts();
    if (failedAttempts >= 5) {
      showError("Incorrect email or password. Forgotten your password?", {
        action: "Reset Password",
        onPress: () => router.push("/auth/forgot-password"),
      });
    } else {
      showError("Incorrect email or password. Please try again.");
    }
    return;
  }

  // Check email_verified status via GET /api/users/me
  await checkAndRunEmailVerification();
};

// Fields on the Login screen:
//   Email Address    (email input, required)
//   Password         (password input with show/hide toggle, required)
//   [Log In] button
//   "Forgot your password?" link → /auth/forgot-password
//   "Don't have an account? Sign up" link → /auth/signup
```

---

### 7.3 Email OTP Verification Screen UX

The email OTP verification screen appears after the first successful login or signup. It is non-dismissable.

```typescript
// On /auth/verify-email:
const [resendCooldown, setResendCooldown] = useState(0);
const [otpSent, setOtpSent] = useState(false);

const sendVerificationOtp = async () => {
  const { error } = await supabase.auth.signInWithOtp({
    email: currentUser.email,
    options: { shouldCreateUser: false },
  });
  if (!error) {
    setOtpSent(true);
    startCooldown(60); // 60-second cooldown before resend is allowed
  }
};

const handleVerifyOtp = async (otpCode: string) => {
  const { error } = await supabase.auth.verifyOtp({
    email: currentUser.email,
    token: otpCode,
    type: "email",
  });

  if (error) {
    showError(
      "The code you entered is incorrect or has expired. Please try again.",
    );
    return;
  }

  // Notify C# API to mark email as verified
  await apiClient.patch("/api/users/email-verification");
  router.replace("/home");
};

// UI on the verify-email screen:
//   "Verify your email address"
//   "We've sent a 6-digit code to {email}."
//   "Check your spam folder if it doesn't arrive within 2 minutes."
//   [6-digit code input]
//   [Verify] button
//   [Resend code] — disabled for 60 seconds after send, then enabled
//   "Use a different account" → sign out and go to /auth/login
```

---

### 7.4 Forgot Password and Reset Password UX

```typescript
// On /auth/forgot-password:
const handleForgotPassword = async (email: string) => {
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo:
      Platform.OS === "web"
        ? "https://app.tuitioniq.com/auth/reset-password"
        : "tuitioniq://auth/reset-password",
  });

  // Always show success message regardless of whether email exists — prevents user enumeration
  showSuccess(
    "If an account exists for this email, a reset link has been sent. Check your inbox.",
  );
  startCooldown(60);
};

// On /auth/reset-password (handles PKCE code exchange + new password form):
const handleResetPassword = async (
  newPassword: string,
  confirmPassword: string,
) => {
  if (newPassword !== confirmPassword) {
    showError("Passwords do not match.");
    return;
  }
  if (!PASSWORD_REGEX.test(newPassword)) {
    showError("Password does not meet requirements.");
    return;
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    showError(
      "Failed to update password. Your reset link may have expired. Please request a new one.",
    );
    router.replace("/auth/forgot-password");
    return;
  }

  showSuccess("Password updated successfully.");
  await supabase.auth.signOut(); // end recovery session
  router.replace("/auth/login");
};
```

---

### 7.5 Silent Login (Auto-Resume Session)

On app launch, restore session from SecureStore before showing any UI:

```typescript
// App.tsx
const [initialised, setInitialised] = useState(false);

useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      setUser(session.user);
      // email_verified check happens at /home or guarded routes
      router.replace("/home");
    } else {
      router.replace("/auth/login");
    }
    setInitialised(true);
  });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    setUser(session?.user ?? null);
    if (!session) router.replace("/auth/login");
    if (event === "PASSWORD_RECOVERY") router.replace("/auth/reset-password");
  });

  return () => subscription.unsubscribe();
}, []);

if (!initialised) return <SplashScreen />;
// Show brand splash, not login form — most users will have a valid session
```

---

### 7.6 Session Expiration UX

```
Case A: Token refreshes silently (the overwhelming majority of cases)
  User notices nothing. This is the goal.

Case B: Refresh token expired after 7 days of inactivity
  SIGNED_OUT event fires via onAuthStateChange.
  Show non-disruptive toast: "Your session has expired. Please log in again."
  Navigate to /auth/login with returnPath preserved:
    router.replace(`/auth/login?returnPath=${encodeURIComponent(currentPath)}`)
  After successful login + OTP verification, navigate back to returnPath.
  Never silently discard where the user was heading.

Case C: Account deactivated mid-session
  Next C# API write returns 403.
  Next C# API read returns 403.
  Show: "Your account access has been suspended.
         Please contact your organisation administrator."
  Do not show a raw HTTP status code.

Case D: Network offline (mobile)
  Access token valid in SecureStore for up to 1 hour from last issuance.
  The app can serve cached data in read-only mode if optimistic caching is implemented.
  When connectivity returns, SDK resumes normal operation automatically.
```

---

### 7.7 Re-authentication for High-Stakes Operations

For high-value operations (e.g., recording large payments), verify session freshness. If the session is stale, require the user to re-enter their password before proceeding.

```typescript
const MAX_SESSION_AGE_MS = 30 * 60 * 1000  // 30 minutes

const isSessionFresh = async (): Promise<boolean> => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false

  const sessionAge = Date.now() - new Date(session.user.last_sign_in_at!).getTime()
  return sessionAge <= MAX_SESSION_AGE_MS
}

const handleRecordPayment = async (amountPence: number) => {
  if (amountPence > LARGE_PAYMENT_THRESHOLD_PENCE) {
    const fresh = await isSessionFresh()
    if (!fresh) {
      showReauthModal(
        'For your security, please confirm your password before proceeding.'
      )
      // Show inline password prompt (not a full navigation):
      const { error } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: promptedPassword,
      })
      if (error) {
        showError("Incorrect password. Payment not recorded.")
        return
      }
    }
  }
  await apiClient.post('/api/payments', { ... })
}
```

---

## 8. Password Authentication — Design Rationale

### 8.1 Decision: Email + Password with Post-Login OTP Verification

TuitionIQ uses standard email and password authentication — for teachers, admins, and students. After a user's first successful login, a one-time email OTP verification step is required before they can access the application. This is a deliberate architectural decision. This section explains the reasoning and the honest trade-offs.

---

### 8.2 Why Email + Password with Post-Login OTP Verification

**Rationale for password-based auth with email OTP as a verification layer:**

1. **Familiarity and trust.** Email and password authentication is the most widely understood and expected credential model. Teachers and students do not need to understand a new authentication paradigm — they enter credentials they already know how to manage.

2. **Separation of authentication and identity verification.** The password authenticates the user. The OTP step, on first login only, verifies that the email address is genuinely accessible to the registrant. This catches registration with incorrectly typed email addresses early, before any org membership or financial data accumulates.

3. **Account recovery is always possible.** A user who forgets their password can reset it via the standard `resetPasswordForEmail` flow, which sends a recovery link. There is no dependency on the current state of the email inbox at the moment of login.

4. **Offline and repeated login.** Once the user has verified their email (email_verified = TRUE), subsequent logins require only email and password — no email inbox access is needed. This is better for users with slow email delivery, shared inboxes, or corporate mail filtering.

5. **Password reset flow is well understood.** All users know how to handle "I forgot my password". Support burden for account recovery is low and entirely self-service.

6. **TOTP MFA can be layered on top.** Password + OTP verification is a strong baseline. In v1.1, TOTP MFA can be added for teachers as an optional second factor without architectural changes.

---

### 8.3 Honest Limitations and Mitigations

| Limitation                        | Honest Assessment                                                      | Mitigation                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Credential stuffing               | If a user reuses a password from a breached site, attackers can log in | Rate limiting on signInWithPassword (10/hour); account lockout after repeated failures; MFA in v1.1 |
| Weak user-chosen passwords        | Users will pick weak passwords despite requirements                    | Enforce Supabase password policy + client-side regex; zxcvbn strength meter on sign-up form         |
| Phishing                          | Attackers can trick users into entering credentials on a fake site     | CSP; email sender domain locking; teach users to verify the domain; MFA in v1.1                     |
| Password reset email interception | If inbox is compromised, attacker can reset password                   | Reset links expire in 1 hour; single-use (PKCE); same risk exists in any email-based system         |
| Email OTP delivery delay          | Corporate filtering can delay OTP by 5–10 minutes on first login       | Custom SMTP with warmed domain; clear "check spam" messaging; 60-second resend cooldown             |
| OTP on first login adds friction  | New users must access their email immediately after signing up         | OTP is one-time only; subsequent logins are password-only; resend is prominent                      |
| No MFA in v1.0                    | Password alone is weaker than password + TOTP                          | Plan TOTP MFA as opt-in for teachers in v1.1; design auth screens with MFA insertion points now     |

---

### 8.4 When to Reconsider

Re-evaluate or augment this auth strategy if:

- Measurable, significant account compromise incidents are linked to credential stuffing attacks. Response: add TOTP MFA (Supabase supports it natively) — not change the auth method.
- Enterprise school clients require SAML/SSO integration. Response: add SAML via Supabase Auth's built-in SSO support — add it alongside password auth for that client, don't replace password auth globally.
- A specific institution's IT policy blocks transactional email from your sending domain. Response: resolve with the institution's IT department; use a dedicated IP with DKIM/SPF/DMARC configured. Passwordless auth has the same email dependency.

---

## 9. Pitfalls & Brutal Critique

### 9.1 The RLS False Sense of Security

**The mistake:** "I enabled RLS, so I'm secure."

**The reality:** RLS only works correctly when:

1. It is enabled on every table, including tables added in future migrations. New Supabase tables have RLS disabled by default. A forgotten `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` exposes that table to any authenticated user.
2. Every policy accounts for soft deletes (`WHERE deleted_at IS NULL`). A missing clause leaks soft-deleted student data.
3. `SUPABASE_SERVICE_ROLE_KEY` is never exposed to the Expo client. It bypasses RLS entirely.
4. `SECURITY DEFINER` functions are audited carefully — they execute as the function owner and bypass RLS for their own queries.

**What to do:** Write automated integration tests that verify cross-org data isolation on every table. Run them on every migration. No Supabase dashboard alert will catch a missing RLS policy on a new table — only tests will.

---

### 9.2 The JWT Claims Staleness Problem

**The mistake:** "We authorize operations based on the JWT org claims."

**The reality:** A teacher removed from an org at 9:00 AM retains a JWT with the old membership claim until 10:00 AM (1-hour expiry). JWT-only auth checks pass. Database-level checks (RLS + C# API query) correctly deny access.

For TuitionIQ, this means a removed teacher could attempt financial operations for up to 1 hour post-removal.

**What to do:**

1. C# API always re-queries `organization_members` before processing writes. JWT claims are display hints only.
2. For immediate revocation: call `admin.auth.signOut(userId, 'global')` when removing a teacher. The access token window closes within 1 hour. Financial writes in that window are traceable via `audit_logs` and reversible.

---

### 9.3 The Soft Delete + Supabase Auth Mismatch

**The mistake:** Soft-deleting `public.users` and assuming the account is locked out.

**The reality:** Supabase Auth has no knowledge of `public.users.deleted_at`. The `auth.users` record is untouched. The user can still log in with their password and obtain a valid JWT.

**Three-layer response — all required:**

1. RLS checks `public.users.is_active = TRUE` → database-level safety remains enforced.
2. C# middleware checks `public.users.is_active` → API writes blocked.
3. `supabaseAdmin.Auth.UpdateUserById(userId, { ban_duration: "87600h" })` → login blocked at the auth layer.

---

### 9.4 The Invite Token in URL Problem

**The mistake:** Leaving the invite token in the URL after reading it.

**The reality:** `/join?token=abc123` appears in browser history, server access logs, error monitoring tools (Sentry captures URLs with tokens automatically), and HTTP referrer headers if the page loads external resources.

**What to do:**

1. On mount: read token → immediately call `window.history.replaceState({}, '', '/join')`.
2. Store token in React component state. Never in SecureStore, sessionStorage, or URL params.
3. C# API validates on acceptance: not expired, not revoked, not already accepted, email matches.
4. Token is single-use. Mark `status = 'accepted'` or `status = 'revoked'` on first valid read.

---

### 9.5 The Password Reset Code in URL Problem

**The mistake:** Not stripping the PKCE recovery code from the URL after exchange.

**The reality:** `/auth/reset-password?code=abc123` appears in browser history and server access logs. While the code is single-use and becomes invalid after `exchangeCodeForSession`, it should be cleared immediately as a matter of hygiene.

**What to do:**

1. Call `exchangeCodeForSession(code)` immediately on mount of the reset-password screen.
2. Immediately after exchange: `window.history.replaceState({}, '', '/auth/reset-password')`.
3. Store the recovery session state only in memory. Do not persist the code anywhere.

---

### 9.6 The email_verified Bypass Risk

**The mistake:** Only checking `email_verified` on the client side, trusting the client not to skip the OTP screen.

**The reality:** A determined attacker who has valid credentials can navigate directly to protected routes if `email_verified` enforcement only happens in the Expo Router layout guards. The layout guard is a UX safeguard, not a security boundary. All API endpoints that return sensitive data must enforce their own authorization.

**What to do:**

1. The `(app)/_layout.tsx` guarded route group checks `email_verified` on mount and re-checks on focus — this is the UX layer.
2. The C# API's `UserActiveCheckMiddleware` also checks `email_verified = TRUE` on every request to protected endpoints — this is the security layer. Unverified users receive 403.
3. The C# API's `PATCH /api/users/email-verification` is the only endpoint that sets `email_verified = TRUE`, and it validates the user's JWT first. The client cannot set `email_verified` directly.

---

### 9.7 The Multi-Org Student Session Complexity

**The mistake:** Hardcoding `organization_id` in session state and assuming it stays consistent.

**The reality:** The schema (v1.5.1) supports a single user being a student in multiple organisations simultaneously. A student with tutoring in two orgs has two separate `students` rows, two separate fee ledgers, two separate teacher assignments. A stale client-side `organization_id` results in the user reading data from the wrong org.

**What to do:**

1. Always pass `organization_id` explicitly in every C# API call. Never infer it.
2. The org selector on `/home` (Section 1.6) applies to all user types, not just teachers.
3. On org switch: clear all cached org-scoped state before re-fetching.
4. The C# API validates org membership server-side on every write, regardless of what the client passes.

---

### 9.8 Password-Specific Risks

```
1. CREDENTIAL STUFFING
   Attackers use breach databases to try email/password combinations.
   Rate-limit signInWithPassword (10/hour per email).
   Log and alert on > 5 consecutive failures for the same email.
   Plan TOTP MFA for v1.1.

2. WEAK PASSWORDS
   Despite strength requirements, some users will use the minimum.
   Consider a password strength meter (zxcvbn) on the sign-up screen.
   Supabase enforces the minimum on the server side; client-side UI reinforces it.

3. PHISHING
   Attackers may clone the TuitionIQ login page.
   Strict CSP prevents script injection from third-party domains.
   Configure DKIM, SPF, and DMARC for the sending domain to prevent email spoofing.
   MFA in v1.1 limits the damage even if credentials are phished.

4. PASSWORD RESET EMAIL AS ATTACK VECTOR
   If a user's email inbox is compromised, an attacker can request a reset.
   Reset links expire in 1 hour (Supabase default). Single-use PKCE code.
   This is an inherent risk of any email-based recovery system.

5. SMTP AS A SINGLE POINT OF FAILURE (for OTP verification and password reset)
   If the SMTP provider is degraded, new users cannot complete OTP verification
   and users who forgot their password cannot reset it.
   Mitigation:
     - Use a tier-1 transactional email provider (Postmark is recommended).
     - Configure a fallback SMTP in Supabase.
     - Monitor email delivery rates with alerting.
     - Document an emergency contact procedure for SMTP outages.
```

---

### 9.9 Trade-offs You May Regret Later

```
1. Supabase Auth vendor lock-in:
   All user identities live in auth.users, managed by Supabase.
   Passwords are hashed and stored by Supabase; you cannot directly migrate them.
   Migrating to another auth provider requires:
     - Exporting user emails from Supabase
     - Requiring all users to reset their passwords on the new system
     - Updating auth_user_id in public.users
   This is painful. Accept it as a known trade-off for significantly faster initial build.

2. expo-secure-store web fallback to localStorage:
   See Section 3.2. The mitigation is strict CSP and XSS discipline. Do not attempt
   to add SSR cookie management — it would require separate infrastructure that duplicates
   what the C# API already provides.

3. No MFA in v1.0:
   Supabase supports TOTP MFA alongside password auth. For teachers managing fee records,
   MFA should be an opt-in option. Retrofitting MFA touches every auth screen.
   Design the auth flow with MFA insertion points now. Ship it in v1.1.
   This is the most likely security regret at scale.

4. JWT claims staleness:
   See Section 9.2. Inherent to stateless JWTs — not a Supabase-specific flaw.
   Architect around it from day one: claims are display hints; the database is the
   authorization source of truth.

5. email_verified = FALSE for all new users:
   All new users must complete OTP verification before accessing the app.
   For a class of 30 students invited at once, this adds one login step for every student.
   The UX impact is real. Communicate the step clearly in the invite email copy:
   "After creating your account, you'll receive a short verification code by email."
```

---

## 10. Implementation Checklist

### Database

- [ ] `after_auth_user_created` trigger created and tested. Verified idempotent (`ON CONFLICT DO NOTHING`).
- [ ] `email_verified BOOLEAN NOT NULL DEFAULT FALSE` column added to `public.users`.
- [ ] Trigger sets `email_verified = FALSE` for every new user.
- [ ] RLS enabled on all public tables, including any tables added after initial setup.
- [ ] RLS policies written and tested for every table (reference Section 5.1 as minimum set).
- [ ] `public.get_user_org_ids()` helper function created (`STABLE SECURITY DEFINER`).
- [ ] `custom_access_token_hook` configured in Supabase Dashboard → Authentication → Hooks.
- [ ] All schema v1.5.1 indexes applied (especially `idx_org_members_org_user`, `idx_students_org_user_id`).
- [ ] Cross-org isolation integration tests written and passing for every table.

### Supabase Auth Configuration (Dashboard)

- [ ] Email/password (signUp + signInWithPassword) enabled.
- [ ] Email OTP (`signInWithOtp` with `shouldCreateUser: false`) enabled — used for post-login verification only.
- [ ] Password policy configured: min 8 characters, uppercase, lowercase, digit, special character.
- [ ] Custom SMTP configured (SendGrid, Postmark, or equivalent). Supabase default email disabled.
- [ ] All email templates customised with TuitionIQ branding: signup confirmation (if used), password reset, OTP verification, invite notification.
- [ ] Rate limits set: 10 signUps/hour per IP, 10 signInWithPassword/hour per email, 5 resetPasswordForEmail/hour per email, 10 OTP sends/hour per email.
- [ ] JWT expiry set to 3600 seconds (1 hour).
- [ ] Refresh token rotation enabled (default — verify it is on).
- [ ] Refresh token reuse detection enabled.
- [ ] Allowed redirect URLs: `https://app.tuitioniq.com/auth/reset-password` and `tuitioniq://auth/reset-password`.
- [ ] No wildcard (`*`) in allowed redirect URLs.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` confirmed absent from all Expo environment variables.

### Expo App (Web + Mobile)

- [ ] `expo-secure-store` used for all token storage. `AsyncStorage` confirmed not used for auth.
- [ ] Chunked SecureStore adapter implemented if JWT size > 1800 bytes (Section 3.4).
- [ ] JWT size measured and logged after login. Confirmed < 1800 bytes.
- [ ] `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`.
- [ ] `SUPABASE_JWT_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` confirmed absent from `.env` (Expo).
- [ ] `detectSessionInUrl: Platform.OS === 'web'` configured.
- [ ] `AppState` listener for `startAutoRefresh` / `stopAutoRefresh` implemented (Section 4.3).
- [ ] `supabase.auth.onAuthStateChange` subscribed at App root. Unsubscribed on cleanup. `PASSWORD_RECOVERY` event handled.
- [ ] Deep link scheme configured: `"scheme": "tuitioniq"` in `app.json`.
- [ ] Password reset redirect URL is `tuitioniq://auth/reset-password` for native builds.
- [ ] Password reset redirect URL is `https://app.tuitioniq.com/auth/reset-password` for web.
- [ ] PKCE recovery code stripped from URL immediately after `exchangeCodeForSession` on reset-password screen.
- [ ] Invite token stripped from URL immediately after reading (Section 9.4).
- [ ] Sign Up form: collects first name, last name, email, password, confirm password. Passes `data: { first_name, last_name }` to `signUp()`.
- [ ] Password strength requirements enforced client-side before `signUp` and `updateUser` calls.
- [ ] Show/hide password toggle present on all password input fields.
- [ ] Login form: email + password. "Forgot password?" link prominent.
- [ ] After 5 failed logins: show "Forgotten your password?" call-to-action prominently.
- [ ] Forgot password screen: does not confirm whether email exists (prevents user enumeration).
- [ ] Reset password screen: exchanges PKCE code, strips from URL, shows new password form.
- [ ] Email OTP verification screen: non-dismissable, 60-second resend cooldown, "check spam" messaging.
- [ ] `email_verified` checked after every `signInWithPassword` and `signUp` call. OTP flow triggered if FALSE.
- [ ] `(app)` route group layout guard: redirects to `/auth/verify-email` if `email_verified = FALSE`.
- [ ] Post-login always navigates to `/home`. Auth callback never routes directly to dashboard.
- [ ] Org selector shown when user has 0 memberships (welcome screen) or multiple memberships.
- [ ] Session expiry toast + returnPath redirect implemented (Section 7.6).
- [ ] "Sign out everywhere" button in user profile settings.
- [ ] CSP headers configured on Expo Web hosting (Section 5.3).

### C# ASP.NET Core API

- [ ] `AddJwtBearer` configured with `SUPABASE_JWT_SECRET`, audience `'authenticated'`, correct issuer URL.
- [ ] `[Authorize]` attribute on all authenticated controllers and endpoints.
- [ ] Middleware extracts `sub` claim as user ID on every authenticated request.
- [ ] `UserActiveCheckMiddleware` checks `public.users.is_active = TRUE` and `email_verified = TRUE` on every request to protected endpoints. Returns 403 if either is false (with distinct error codes for suspension vs. unverified).
- [ ] `PATCH /api/users/email-verification` endpoint: validates JWT, sets `email_verified = TRUE`, inserts `audit_log`.
- [ ] All financial write endpoints re-query `organization_members` to verify caller's org membership.
- [ ] `audit_logs` INSERT included in the same transaction as every financial write.
- [ ] Account suspension endpoint calls Supabase Admin API + sets `public.users.is_active = FALSE`.
- [ ] Origin header validation middleware implemented for state-mutating requests (Section 5.4).
- [ ] Admin endpoint for global session revocation (`POST /api/admin/users/{id}/revoke-sessions`).
- [ ] Invite dispatch rate limiting: 50/hour per teacher, 200/day per org.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` loaded from environment / secrets manager only.

### Invite Flow

- [ ] Email lookup against `public.users` implemented at invite dispatch (Section 1.4 Step 1).
- [ ] Immediate account linking flow tested (student already self-registered before invite).
- [ ] Invite join screen: shows Sign Up form (email pre-filled, read-only) if user has no account; shows Login form if account exists.
- [ ] OTP verification flow runs after sign-up or login on the join screen (if email_verified = FALSE).
- [ ] Invite token survives the sign-up / login flow (stored in React state / context).
- [ ] Email match validation in C# invite acceptance endpoint (Section 1.4 Step 4).
- [ ] Token expiry (7 days) validated server-side on acceptance.
- [ ] Revoked and expired tokens return a clear user-facing error message — not a 500.
- [ ] `invites.status` state machine tested: `pending` → `accepted` / `expired` / `revoked`.

### Security Verification

- [ ] **Penetration test:** User from Org A cannot read or write any data belonging to Org B.
- [ ] **Penetration test:** Student cannot read other students' fee records or payment history.
- [ ] **Penetration test:** Removed teacher cannot access the org after global session revocation.
- [ ] **Penetration test:** Expired password reset link returns 400, not a valid session.
- [ ] **Penetration test:** Invite token issued to email A cannot be accepted by a user with email B.
- [ ] **Penetration test:** Unverified user (email_verified = FALSE) cannot access protected C# API endpoints.
- [ ] **Penetration test:** Client cannot set email_verified = TRUE directly (must go through PATCH /api/users/email-verification with valid JWT).
- [ ] Soft-delete + auth ban flow tested end-to-end. Confirmed that banned user cannot log in.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` confirmed absent from production Expo Web bundle (inspect compiled assets).
- [ ] Email delivery monitoring configured with alert on delivery rate degradation (OTP and password reset emails).
- [ ] Brute-force protection tested: after 10 attempts, rate limiter blocks further `signInWithPassword` calls for that email.

---

_End of TuitionIQ Authentication System — v2.0.0_
_Stack: React Expo (Web + Mobile) · C# ASP.NET Core · Supabase Auth_
