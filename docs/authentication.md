# TuitionIQ — Production-Grade Authentication System

### Using Supabase Authentication · v1.3.0

> **Audience:** AI agents, backend engineers, and frontend developers implementing the auth system.
> **Schema version this aligns to:** `database_schema.md` v1.5.1
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
- `public.users` — TuitionIQ's canonical identity record. Populated by a Supabase database trigger on first login. All business logic, the C# API, and RLS policies reference this table exclusively.

**Authentication method:** TuitionIQ uses **passwordless magic link authentication only**, for all user types (teachers, admins, students). There are no passwords in this system. The `signInWithOtp` flow handles both new user registration and returning user login in a single call — Supabase creates the `auth.users` record automatically on first use.

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Token Strategy](#2-token-strategy)
3. [Token Storage Strategy](#3-token-storage-strategy)
4. [Session Management Strategy](#4-session-management-strategy)
5. [Security Best Practices](#5-security-best-practices)
6. [Performance & Scalability](#6-performance--scalability)
7. [UX Considerations](#7-ux-considerations)
8. [Passwordless Authentication — Design Rationale](#8-passwordless-authentication--design-rationale)
9. [Pitfalls & Brutal Critique](#9-pitfalls--brutal-critique)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Authentication Flow

### 1.1 System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│              CLIENT — React Expo (Web + Mobile)                      │
│                                                                      │
│   @supabase/supabase-js  →  signInWithOtp()  →  Supabase Auth API   │
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
  Auth (magic link dispatch, session exchange) → Supabase Auth directly from client
  Data reads (student lists, fee periods)      → C# ASP.NET Core API
  Business logic writes (payments, invites)    → C# ASP.NET Core API
  C# API verifies every JWT before processing via SUPABASE_JWT_SECRET
```

**Why split C# API and Supabase PostgREST?**
Supabase Auth remains the authentication provider, while the C# API is the single data-access gateway for frontend reads and writes. This keeps validation, authorization, and business rules centralized. Financial write operations and read endpoints both stay behind the API boundary.

---

### 1.2 Magic Link Flow — Core Mechanic

Before the registration paths, understand how `signInWithOtp` works:

```
supabase.auth.signInWithOtp({ email }) does TWO things in one call:

  Case A — auth.users row already EXISTS for this email:
    → Supabase sends a magic link. This is a LOGIN.

  Case B — auth.users row does NOT EXIST for this email:
    → Supabase creates the auth.users row, then sends a magic link. This is REGISTRATION.

There is no separate "signup" vs "login" screen. One email field. One button. Always.
The user does not need to know or care which path was taken.

The database trigger (Section 1.3) fires on INSERT to auth.users for Case B only,
creating the public.users row. On subsequent logins (Case A), the trigger does not fire
because auth.users already exists — public.users was created on first login.
```

---

### 1.3 Database Trigger — public.users Creation

This trigger bridges Supabase's `auth.users` with TuitionIQ's `public.users`. It fires once per user, on first authentication.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id, auth_user_id, email,
    first_name, last_name, is_active, created_at, updated_at
  )
  VALUES (
    NEW.id,
    'supabase',
    NEW.id::TEXT,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name',  ''),
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

- `first_name` and `last_name` default to empty string, not `'Unknown'`. The profile completion screen (Section 7.1) collects the real values immediately after first login. Storing `'Unknown'` pollutes data.
- `ON CONFLICT (id) DO NOTHING` makes the trigger idempotent. Supabase can internally retry auth operations in edge cases; this prevents a duplicate-row error.
- With magic link only, `raw_user_meta_data` will be empty unless you call `signInWithOtp` with an `options.data` payload. For the standard "enter your email" screen, it will be empty — this is expected and handled by profile completion.

---

### 1.4 User Registration & Login Flows

There are two valid entry paths matching the schema's dual-path lifecycle. Both use magic links.

---

#### Path A — Self-Registration / Returning Login (any user)

```
STEP 1 — CLIENT (Expo Web or Mobile)
  Single login screen — no separate /signup page.
  User enters their email address.

  Call: supabase.auth.signInWithOtp({
    email: 'user@example.com',
    options: {
      emailRedirectTo: Platform.OS === 'web'
        ? 'https://app.tuitioniq.com/auth/callback'
        : 'tuitioniq://auth/callback',
    }
  })

  Show: "We've sent a login link to your email. Check your inbox."
  Do not navigate away. Display resend option after 60 seconds.

STEP 2 — SUPABASE AUTH (automatic)
  If auth.users exists for email → sends magic link (returning login).
  If auth.users does not exist   → creates auth.users, fires trigger to create
                                   public.users (empty name fields), sends magic link
                                   (first-time registration).

STEP 3 — USER CLICKS MAGIC LINK IN EMAIL
  Magic link URL format: https://app.tuitioniq.com/auth/callback?code=<PKCE code>

  On Expo Web:
    Browser opens the callback URL. The Expo Web app reads `code` from the URL params.

  On Expo Native (iOS/Android):
    Deep link is intercepted by the app via the configured scheme.
    app.json: { "expo": { "scheme": "tuitioniq" } }
    Redirect URL for native: tuitioniq://auth/callback
    Expo Router or React Navigation handles the deep link route.

STEP 4 — CLIENT (auth callback screen)
  Call: const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  On success: session established. Tokens stored in SecureStore (see Section 3).

  On web only — strip PKCE code from URL immediately after exchange:
    window.history.replaceState({}, '', '/auth/callback')

STEP 5 — NAVIGATE TO HOME (always)
  router.replace('/home')
  The /home screen resolves org context (Section 1.6).
  The auth callback handler never redirects directly to a dashboard.

STEP 6 — PROFILE COMPLETION CHECK (home screen, new users only)
  Query: SELECT first_name, last_name FROM public.users WHERE id = auth.uid()
  If first_name = '' OR last_name = '':
    Show full-screen blocking profile completion modal.
    Collect: first_name, last_name (required), display_name (optional).
    POST /api/users/profile → C# API validates and updates public.users.
    After save: dismiss modal. Proceed to org resolution.
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
            It is NOT a Supabase magic link. These are two separate mechanisms.
            The invite token accepts the org membership.
            Authentication is handled separately by Supabase magic link.

STEP 2 — INVITEE RECEIVES TOKEN EMAIL
  User clicks: https://app.tuitioniq.com/join?token=<token>

  Client reads token from URL params immediately on mount.
  Strip token from URL at once:
    window.history.replaceState({}, '', '/join')
  Store token in React component state only — not localStorage, not URL.

STEP 3 — AUTHENTICATION CHECK ON JOIN SCREEN
  Does the user have an active Supabase session?

  IF YES (user previously self-registered and is already logged in):
    Skip magic link. Proceed directly to Step 4.

  IF NO:
    Show the standard magic link screen, pre-filled with the invite email (read-only field).
    Run through Path A Steps 1–4 to establish a session.
    After session established, continue to Step 4.
    The invite token must survive the auth flow — store it in React state or
    React context before initiating the magic link flow and retrieve it after
    the session is established.

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
  Navigate to /login.

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

Every successful authentication navigates to `/home` without exception. The home screen resolves org context:

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
│       [I have a pending invite]   →  direct to /login        │
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
      router.replace("/login");
      break;
    case "USER_UPDATED":
      setUser(session!.user);
      break;
  }
});
```

For soft-deleted or deactivated users (`public.users.is_active = FALSE`):
Supabase Auth does not check your `public.users` table. The JWT remains technically valid until expiry.

Three mitigation layers, all required:

1. **RLS** checks `public.users.is_active = TRUE` — acts as database-level safety control.
2. **C# API middleware** checks `public.users.is_active` on every request — returns 403 if false.
3. **Supabase Admin API** — call `admin.auth.signOut(userId, 'global')` + set `ban_duration` to block future magic link issuance.

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

| Token                | Recommended | Reason                                                                                                 |
| -------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| **Access token**     | **1 hour**  | Short blast-radius window if stolen. Stateless JWTs cannot be revoked mid-life — this caps the damage. |
| **Refresh token**    | **7 days**  | Forces re-authentication weekly. Reasonable for daily-use apps. Low friction with magic links.         |
| **Invite token**     | **7 days**  | Matches schema. Gives busy teachers and students time to act.                                          |
| **Magic link token** | **1 hour**  | Supabase default. Single-use. Short window reduces intercepted-email risk.                             |

### 2.3 Are 14-Day Sessions Appropriate? No.

TuitionIQ handles student fee records, billing history, and personal contact data. This is not a social media app. A stolen refresh token valid for 14 days is a two-week breach window.

Additional reasons to reject 14-day sessions:

1. **Shared devices are common.** Students and teachers use shared family computers and school devices. Long-lived sessions left open are a realistic attack vector, not a theoretical one.
2. **Refresh tokens cannot be remotely invalidated without explicit signOut.** The entire 14-day window must be served out before natural expiry if a device is stolen.
3. **Magic links eliminate login friction.** The primary argument for long sessions is UX convenience. With magic link auth, re-authentication requires only an email address — the friction cost of weekly re-login is near zero.
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

**⚠️ JWT claims are baked at token issuance.** If a teacher is removed from an org, their old JWT still contains the old claims until expiry (up to 1 hour). Never use JWT claims as the sole authorization check for write operations. The C# API must always re-query `organization_members` from the database. For immediate role revocation, call `admin.auth.signOut(userId, 'global')`.

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

This is the accepted trade-off for a unified Expo codebase. The mitigation path is a strict Content Security Policy (Section 5.3) plus disciplined prevention of XSS injection points — not a different storage mechanism. This same trade-off is made by the majority of SPA-based auth implementations.

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
      // true on web  → SDK reads auth code from URL on callback
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

`EXPO_PUBLIC_SUPABASE_ANON_KEY` is safe to expose. It cannot bypass RLS and cannot grant admin access. However, it can be used to invoke `signInWithOtp()` — rate-limit this aggressively (Section 6.4).

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

On magic link click → exchangeCodeForSession(code):
  1. GoTrue validates the PKCE code (single-use).
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

-- users: self-update only (name, avatar)
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

3. EXPO_PUBLIC_ variables are bundled into the app binary.
   EXPO_PUBLIC_SUPABASE_ANON_KEY: acceptable — constrained by RLS, cannot bypass auth.
   SUPABASE_SERVICE_ROLE_KEY: must never be EXPO_PUBLIC_. If leaked, rotate immediately.
   SUPABASE_JWT_SECRET: must never be EXPO_PUBLIC_.
     Rotation: change in Supabase Dashboard → all existing sessions immediately invalidated
               → all users must re-authenticate via magic link. This is disruptive but
               is the only correct response to a leaked JWT secret.
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

### 5.6 Handling Compromised Accounts

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
     This blocks future magic link issuance at the auth layer.
     RLS policies checking is_active = TRUE block data access even with old tokens.

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
| OTP send (`signInWithOtp`) | 30/hour per email | 10/hour per email |
| `signUp`                   | 30/hour per IP    | 10/hour per IP    |
| Token refresh              | 360/hour          | Keep default      |

Add application-level rate limiting in the C# API for invite dispatch:

- Max 50 invites dispatched per teacher per hour.
- Max 200 invites dispatched per organisation per day.

These limits prevent a compromised teacher account from bulk-inviting external attackers or triggering excessive Supabase OTP sends.

---

## 7. UX Considerations

### 7.1 Profile Completion — Collecting Name After First Magic Link

Magic link onboarding only collects an email address. After first authentication, `public.users.first_name` and `last_name` are empty strings. Prompt immediately:

```typescript
// On /home, after org membership query:
const { data: profile } = await apiClient.get("/api/users/me");

if (!profile?.first_name || !profile?.last_name) {
  setShowProfileCompletion(true);
  // This modal is blocking — it cannot be dismissed without completing the form.
  // Empty names break UI throughout the application.
}

// On form submit:
const completeProfile = async (firstName: string, lastName: string) => {
  await apiClient.patch("/api/users/profile", { firstName, lastName });
  // C# API validates and writes to public.users
  setShowProfileCompletion(false);
  // Proceed to org resolution
};
```

Do not allow users to skip profile completion. Empty names appear in teacher lists, student assignment views, audit logs, and payment records.

---

### 7.2 Silent Login (Auto-Resume Session)

On app launch, restore session from SecureStore before showing any UI:

```typescript
// App.tsx
const [initialised, setInitialised] = useState(false)

useEffect(() => {
  // Reads from SecureStore cache — synchronous in effect, no network call
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      setUser(session.user)
      // Navigate to /home — org resolution happens there
      router.replace('/home')
    } else {
      router.replace('/login')
    }
    setInitialised(true)
  })

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      setUser(session?.user ?? null)
      if (!session) router.replace('/login')
    }
  )

  return () => subscription.unsubscribe()
}, [])

if (!initialised) return <SplashScreen />
// Show brand splash, not login form — most users will have a valid session
```

---

### 7.3 Magic Link Screen — Managing Email Delivery UX

The main friction with magic links is the wait between sending and receiving. Manage it explicitly:

```typescript
const [emailSent, setEmailSent] = useState(false);
const [resendCooldown, setResendCooldown] = useState(0);

const sendMagicLink = async (email: string) => {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo:
        Platform.OS === "web"
          ? "https://app.tuitioniq.com/auth/callback"
          : "tuitioniq://auth/callback",
    },
  });

  if (error) {
    showError("Could not send login link. Please try again.");
    return;
  }

  setEmailSent(true);
  startCooldown(60); // Prevent rapid resends. 60-second cooldown.
};

// UI state when email sent:
//  "We've sent a login link to {email}"
//  "Check your spam folder if it doesn't arrive within 2 minutes."
//  [Open Email App]      — deep link to device mail client
//  [Use a different email] — resets the form
//  [Resend link]         — disabled for 60 seconds, then enabled

// Deep link to mail app (Expo):
import { Linking } from "react-native";
await Linking.openURL("message://"); // iOS Mail
// Alternatively: 'googlegmail://'       // Gmail
// Offer a choice if the user has multiple mail clients installed
```

---

### 7.4 Session Expiration UX

```
Case A: Token refreshes silently (the overwhelming majority of cases)
  User notices nothing. This is the goal.

Case B: Refresh token expired after 7 days of inactivity
  SIGNED_OUT event fires via onAuthStateChange.
  Show non-disruptive toast: "Your session has expired. Please log in again."
  Navigate to /login with returnPath preserved:
    router.replace(`/login?returnPath=${encodeURIComponent(currentPath)}`)
  After successful magic link authentication, navigate back to returnPath.
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

### 7.5 Re-authentication for High-Stakes Operations

Magic link re-authentication is unsuitable for mid-flow confirmation (requires email access + 30–120 second wait). Use a session freshness check instead:

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
        'For your security, please verify your identity before proceeding. ' +
        "We've sent a new login link to your email."
      )
      // Dispatch signInWithOtp silently. User clicks link. SIGNED_IN fires. Flow resumes.
      await supabase.auth.signInWithOtp({ email: currentUser.email, options: { emailRedirectTo: ... } })
      return
    }
  }
  await apiClient.post('/api/payments', { ... })
}
```

---

## 8. Passwordless Authentication — Design Rationale

### 8.1 Decision: Magic Link Only, for All Users

TuitionIQ uses magic link authentication exclusively — for teachers, admins, and students. This is a deliberate architectural decision, not a default. This section explains the reasoning and the honest trade-offs.

---

### 8.2 Why Magic Link for All User Types

**Rationale for unified passwordless auth:**

1. **No passwords means no password resets.** Password reset is the most common auth support ticket in SaaS products. Eliminating the entire password credential concept eliminates the support burden entirely.

2. **Student email access is a pre-existing requirement.** The invite flow already sends emails to student addresses (Section 1.4 Path B). If a student cannot receive email, they cannot be onboarded at all — magic link login is consistent with this existing requirement, not a new one.

3. **Simpler codebase.** One auth flow for all users. No password fields, no bcrypt dependency, no password strength validation, no "confirm password" field, no password update endpoint. Fewer UI states, fewer security considerations, fewer bugs.

4. **Consistent security posture.** Magic links are statistically more secure than user-chosen passwords against credential stuffing and phishing attacks. There is no TuitionIQ credential to steal from breach databases.

5. **Low re-authentication friction.** The primary argument for keeping passwords is "users don't want to use email to log in every week." With magic links, re-authentication is: enter email → open app on phone → tap link. With a good mobile UX (open email app button, Section 7.3), this takes under 30 seconds.

---

### 8.3 Honest Limitations and Mitigations

| Limitation               | Honest Assessment                                               | Mitigation                                                                            |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Email delivery delays    | Corporate mail filtering can delay by 5–10 minutes              | Custom SMTP with warmed domain (SendGrid/Postmark). Monitor delivery rate.            |
| Shared email addresses   | A teacher using a school `info@` address is a multi-access risk | Enforce personal email at org creation. Validate with a warning in the UI.            |
| Email account compromise | Attacker with inbox access can log in                           | TOTP MFA as optional second factor for teachers — plan for v1.1                       |
| Single point of failure  | SMTP provider downtime = no one can log in                      | Reliable provider + backup SMTP configured in Supabase + delivery monitoring + alerts |
| Expired link confusion   | User clicks a 1-hour-old link and sees an error                 | Clear expiry messaging. Resend button with prominent placement.                       |
| No offline login         | Requires email access at login time                             | Acceptable — app requires internet connectivity regardless                            |

---

### 8.4 When to Reconsider

Re-evaluate magic link only if:

- Measurable, significant user drop-off at the login step is confirmed in analytics and correlated to email delivery times (not just assumed).
- Enterprise school clients require SAML/SSO integration. Response: add SAML via Supabase Auth's built-in SSO support — not passwords.
- A specific institution's IT policy permanently blocks transactional email from your sending domain, and the IT department cannot or will not resolve it. This is rare.

The first response to any of these scenarios should be TOTP MFA or SAML SSO — not introducing passwords. Passwords would reintroduce credential stuffing, phishing, breach exposure, and password reset flows that this architecture deliberately eliminates.

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
2. For immediate revocation: call `admin.auth.signOut(userId, 'global')` when removing a teacher. The access token window closes within 1 hour. Financial writes in that window are traceable via `audit_logs` and reversible (soft-delete the erroneous payment; the sync trigger recalculates the period).

---

### 9.3 The Soft Delete + Supabase Auth Mismatch

**The mistake:** Soft-deleting `public.users` and assuming the account is locked out.

**The reality:** Supabase Auth has no knowledge of `public.users.deleted_at`. The `auth.users` record is untouched. The user can still receive a magic link and obtain a valid JWT.

**Three-layer response — all required:**

1. RLS checks `public.users.is_active = TRUE` → database-level safety remains enforced.
2. C# middleware checks `public.users.is_active` → API writes blocked.
3. `supabaseAdmin.Auth.UpdateUserById(userId, { ban_duration: "87600h" })` → magic link blocked at the auth layer.

---

### 9.4 The Invite Token in URL Problem

**The mistake:** Leaving the invite token in the URL after reading it.

**The reality:** `/join?token=abc123` appears in browser history, server access logs, error monitoring tools (Sentry captures URLs with tokens automatically), and HTTP referrer headers if the page loads external resources. Anyone who sees the token can attempt to accept the invite.

**What to do:**

1. On mount: read token → immediately call `window.history.replaceState({}, '', '/join')`.
2. Store token in React component state. Never in SecureStore, sessionStorage, or URL params.
3. C# API validates on acceptance: not expired, not revoked, not already accepted, email matches.
4. Token is single-use. Mark `status = 'accepted'` or `status = 'revoked'` on first valid read.

---

### 9.5 The Multi-Org Student Session Complexity

**The mistake:** Hardcoding `organization_id` in session state and assuming it stays consistent.

**The reality:** The schema (v1.5.1) supports a single user being a student in multiple organisations simultaneously. A student with tutoring in two orgs has two separate `students` rows, two separate fee ledgers, two separate teacher assignments. A stale client-side `organization_id` results in the user reading data from the wrong org — or worse, a data access error that looks like a bug.

**What to do:**

1. Always pass `organization_id` explicitly in every C# API call. Never infer it.
2. The org selector on `/home` (Section 1.6) applies to all user types, not just teachers.
3. On org switch: clear all cached org-scoped state before re-fetching.
4. The C# API validates org membership server-side on every write, regardless of what the client passes.

---

### 9.6 Magic Link Specific Risks

```
1. MAGIC LINK INTERCEPTION (inbox compromise)
   If the user's email account is compromised, the attacker can intercept the link.
   This is the same risk as password reset email interception — not unique to magic links.
   Magic links are single-use and expire in 1 hour. The exposure window is tightly bounded.
   Future mitigation: TOTP MFA as a second factor for teachers — plan this for v1.1.

2. MAGIC LINK SENT TO A MISTYPED ADDRESS
   If a teacher miskeys a student email, the OTP goes to an unintended address.
   The recipient cannot accept the TuitionIQ org invite (email match check in C# API).
   But Supabase will have created an auth.users account for their email (OTP auto-registers).
   The account has no org membership and creates no security issue — but it is noise.
   Mitigation: Rate-limit invite dispatch (Section 6.4). Validate email format before sending.

3. SMTP AS A SINGLE POINT OF FAILURE
   If the SMTP provider is degraded, no one can log in.
   Mitigation:
     - Use a tier-1 transactional email provider (Postmark is recommended for reliability).
     - Configure a fallback SMTP in Supabase.
     - Monitor email delivery rates with alerting (delivery rate drop > 5% triggers alert).
     - Document an emergency contact procedure for SMTP outages.

4. LINK OPENED ON AN UNEXPECTED DEVICE
   User requests magic link on laptop, opens email on phone, clicks link on phone.
   The session is created on the phone. This is correct behaviour — PKCE does not
   bind the session to the requesting device. The laptop tab awaits a session that
   never arrives on that device.
   The user simply sends a new magic link on the intended device. No security issue.
   The UX implication: the login screen should not indicate "waiting for you to click
   the link" in a way that confuses users who clicked on the wrong device.
```

---

### 9.7 Trade-offs You May Regret Later

```
1. Supabase Auth vendor lock-in:
   All user identities live in auth.users, managed by Supabase.
   Migrating to another auth provider means:
     - Exporting user emails from Supabase
     - Re-inviting users to create accounts on the new provider
     - Updating auth_user_id in public.users
   This is painful but survivable. Accept it as a known trade-off for
   dramatically faster initial build time.

2. expo-secure-store web fallback to localStorage:
   Tokens in localStorage are accessible to JavaScript, creating XSS risk.
   This is not a hidden limitation — it is documented Expo behaviour.
   The mitigation is strict CSP (Section 5.3) and XSS discipline, not a
   different storage mechanism. Do not attempt to layer SSR cookie management
   onto this architecture — it would require separate server infrastructure
   that duplicates what the C# API already provides, for no net security gain
   given that CSP already protects against the primary XSS token-theft vector.

3. Magic link as the only auth method:
   If a user loses access to their email account, they cannot log in.
   This is the deliberate trade-off for a passwordless system.
   Mitigation: Document an account recovery process:
     "Contact your org admin, who submits a verified identity request to TuitionIQ
      support. Support updates users.email via the Supabase Admin API after identity
      is confirmed."
   This process must exist and be documented before launch.

4. JWT claims staleness:
   See Section 9.2. A 1-hour exposure window for stale role claims is inherent to
   stateless JWTs — not a Supabase-specific flaw. Architect around it from day one:
   claims are display hints; the database is the authorization source of truth.

5. No MFA in v1.0:
   Supabase supports TOTP MFA alongside magic link. For teachers managing fee records,
   MFA should be an opt-in option. Retrofitting MFA touches every auth screen.
   Design the auth flow with MFA insertion points now. Ship it in v1.1.
   This is the most likely security regret at scale.
```

---

## 10. Implementation Checklist

### Database

- [ ] `after_auth_user_created` trigger created and tested. Verified idempotent (`ON CONFLICT DO NOTHING`).
- [ ] RLS enabled on all public tables, including any tables added after initial setup.
- [ ] RLS policies written and tested for every table (reference Section 5.1 as minimum set).
- [ ] `public.get_user_org_ids()` helper function created (`STABLE SECURITY DEFINER`).
- [ ] `custom_access_token_hook` configured in Supabase Dashboard → Authentication → Hooks.
- [ ] All schema v1.5.1 indexes applied (especially `idx_org_members_org_user`, `idx_students_org_user_id`).
- [ ] Cross-org isolation integration tests written and passing for every table.

### Supabase Auth Configuration (Dashboard)

- [ ] Magic link (OTP) enabled.
- [ ] Email/password authentication **disabled**. Verified that no password sign-in endpoint is accessible.
- [ ] Custom SMTP configured (SendGrid, Postmark, or equivalent). Supabase default email disabled.
- [ ] All email templates customised with TuitionIQ branding (magic link, invite notification).
- [ ] Rate limits set: 10 OTP sends/hour per email, 10 signUps/hour per IP.
- [ ] JWT expiry set to 3600 seconds (1 hour).
- [ ] Refresh token rotation enabled (default — verify it is on).
- [ ] Refresh token reuse detection enabled.
- [ ] Allowed redirect URLs: `https://app.tuitioniq.com/auth/callback` and `tuitioniq://auth/callback`.
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
- [ ] `supabase.auth.onAuthStateChange` subscribed at App root. Unsubscribed on cleanup.
- [ ] Deep link scheme configured: `"scheme": "tuitioniq"` in `app.json`.
- [ ] Magic link redirect URL is `tuitioniq://auth/callback` for native builds.
- [ ] Magic link redirect URL is `https://app.tuitioniq.com/auth/callback` for web.
- [ ] PKCE code stripped from URL immediately after `exchangeCodeForSession`.
- [ ] Invite token stripped from URL immediately after reading (Section 9.4).
- [ ] Profile completion screen blocks navigation until `first_name` and `last_name` are set.
- [ ] Post-login always navigates to `/home`. Auth callback never routes directly to dashboard.
- [ ] Org selector shown when user has 0 memberships (welcome screen) or multiple memberships.
- [ ] Session expiry toast + returnPath redirect implemented (Section 7.4).
- [ ] "Sign out everywhere" button in user profile settings.
- [ ] CSP headers configured on Expo Web hosting (Section 5.3).
- [ ] Resend magic link: 60-second cooldown. "Open Email App" deep link on send confirmation screen.

### C# ASP.NET Core API

- [ ] `AddJwtBearer` configured with `SUPABASE_JWT_SECRET`, audience `'authenticated'`, correct issuer URL.
- [ ] `[Authorize]` attribute on all authenticated controllers and endpoints.
- [ ] Middleware extracts `sub` claim as user ID on every authenticated request.
- [ ] All financial write endpoints re-query `organization_members` to verify caller's org membership.
- [ ] `audit_logs` INSERT included in the same transaction as every financial write.
- [ ] Account suspension endpoint calls Supabase Admin API + sets `public.users.is_active = FALSE`.
- [ ] Origin header validation middleware implemented for state-mutating requests (Section 5.4).
- [ ] Admin endpoint for global session revocation (`POST /api/admin/users/{id}/revoke-sessions`).
- [ ] Invite dispatch rate limiting: 50/hour per teacher, 200/day per org.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` loaded from environment / secrets manager only.
- [ ] C# middleware checks `public.users.is_active = TRUE` on every request. Returns 403 if false.

### Invite Flow

- [ ] Email lookup against `public.users` implemented at invite dispatch (Section 1.4 Step 1).
- [ ] Immediate account linking flow tested (student already self-registered before invite).
- [ ] Email match validation in C# invite acceptance endpoint (Section 1.4 Step 4).
- [ ] Token expiry (7 days) validated server-side on acceptance.
- [ ] Revoked and expired tokens return a clear user-facing error message — not a 500.
- [ ] `invites.status` state machine tested: `pending` → `accepted` / `expired` / `revoked`.

### Security Verification

- [ ] **Penetration test:** User from Org A cannot read or write any data belonging to Org B.
- [ ] **Penetration test:** Student cannot read other students' fee records or payment history.
- [ ] **Penetration test:** Removed teacher cannot access the org after global session revocation.
- [ ] **Penetration test:** Expired magic link token returns 400, not a valid session.
- [ ] **Penetration test:** Invite token issued to email A cannot be accepted by a user with email B.
- [ ] Soft-delete + auth ban flow tested end-to-end. Confirmed that banned user cannot receive new magic link.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` confirmed absent from production Expo Web bundle (inspect compiled assets).
- [ ] Email delivery monitoring configured with alert on delivery rate degradation.

---

_End of TuitionIQ Authentication System — v1.3.0_
_Aligns with `database_schema.md` v1.5.1_
_Stack: React Expo (Web + Mobile) · C# ASP.NET Core · Supabase Auth_
