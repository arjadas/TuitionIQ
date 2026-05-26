# TuitionIQ — Monorepo Architecture

### Production-Grade Structure for AI Agents & Engineering Teams

**Stack:** React Expo (Web + Mobile) · C# ASP.NET Core · Supabase (PostgreSQL + Auth)
**Pattern:** Feature-based Clean Architecture (backend) · Feature-based modular screens (frontend)
**Version:** v2.0.0

---

## Table of Contents

1. [Monorepo Root Structure](#1-monorepo-root-structure)
2. [Backend Architecture — C# ASP.NET Core](#2-backend-architecture)
3. [Frontend Architecture — React Expo](#3-frontend-architecture)
4. [Shared Types Strategy](#4-shared-types-strategy)
5. [API Communication Layer](#5-api-communication-layer)
6. [Feature Map Across Layers](#6-feature-map-across-layers)
7. [Naming Conventions & Rules](#7-naming-conventions--rules)
8. [Environment Configuration](#8-environment-configuration)
9. [Development Workflow](#9-development-workflow)
10. [Scalability Considerations](#10-scalability-considerations)

---

## 1. Monorepo Root Structure

```
tuitioniq/                                    ← repository root
│
├── .github/
│   ├── workflows/
│   │   ├── backend-ci.yml                    ← build, test, lint backend on PR
│   │   ├── frontend-ci.yml                   ← Expo type-check, lint, test on PR
│   │   └── codegen.yml                       ← regenerate shared types on backend change
│   └── PULL_REQUEST_TEMPLATE.md
│
├── backend/                                  ← C# ASP.NET Core solution
│   └── (see Section 2)
│
├── frontend/                                 ← React Expo app (web + mobile unified)
│   └── (see Section 3)
│
├── shared/                                   ← generated TypeScript types + shared constants
│   └── (see Section 4)
│
├── docs/
│   ├── authentication.md                     ← canonical auth spec
│   ├── database_schema.md                    ← canonical schema spec
│   ├── project_structure.md                  ← this document
│   └── adr/                                  ← Architecture Decision Records
│       ├── 001-email-password-auth.md
│       ├── 002-frontend-never-writes-to-db.md
│       └── 003-openapi-type-generation.md
│
├── scripts/
│   ├── codegen-types.sh                      ← runs OpenAPI → TypeScript generation
│   ├── db-migrate.sh                         ← wraps EF Core migrations
│   └── seed-dev-data.sh                      ← seeds local Supabase with test data
│
├── .env.example                              ← documents all required env vars (no values)
├── .gitignore
├── README.md
└── docker-compose.yml                        ← local Supabase + backend for dev
```

**Separation of concerns:**

| Folder      | Owner                        | Purpose                                                                          |
| ----------- | ---------------------------- | -------------------------------------------------------------------------------- |
| `backend/`  | C# team / backend agents     | All business logic, financial writes, auth validation                            |
| `frontend/` | Expo team / frontend agents  | UI, UX, client-side state, backend API consumption, Supabase authentication only |
| `shared/`   | Generated — do not hand-edit | TypeScript types consumed by frontend, sourced from backend                      |
| `docs/`     | All contributors             | Source of truth documents; agents must read before implementing                  |
| `scripts/`  | DevOps / all contributors    | Reproducible local and CI tooling                                                |

---

## 2. Backend Architecture

### 2.1 Solution Structure

The backend follows **Clean Architecture** with a **feature-based layout** inside each layer. This avoids the common mistake of organising by layer alone (`Controllers/`, `Services/`, `Repositories/`), which collapses all features into flat folders and becomes unnavigable at scale.

```
backend/
├── TuitionIQ.sln
│
├── src/
│   ├── TuitionIQ.Api/                        ← Presentation layer: HTTP entry points
│   ├── TuitionIQ.Application/                ← Use cases, DTOs, service interfaces
│   ├── TuitionIQ.Domain/                     ← Entities, value objects, domain rules
│   └── TuitionIQ.Infrastructure/             ← EF Core, Supabase admin client, SMTP
│
└── tests/
    ├── TuitionIQ.UnitTests/                  ← Domain + Application layer unit tests
    ├── TuitionIQ.IntegrationTests/           ← API + DB integration tests (real Supabase)
    └── TuitionIQ.ArchitectureTests/          ← NetArchTest: enforce layer boundaries
```

---

### 2.2 TuitionIQ.Api (Presentation Layer)

```
TuitionIQ.Api/
├── TuitionIQ.Api.csproj
├── Program.cs                                ← Minimal API entry: registers all services, middleware
├── appsettings.json                          ← Base config (no secrets)
├── appsettings.Development.json              ← Local overrides (gitignored values via user-secrets)
│
├── Features/                                 ← Feature-based controller grouping
│   │
│   ├── Auth/
│   │   └── AuthController.cs                 ← POST /api/auth/logout-all (global sign-out)
│   │
│   ├── Users/
│   │   └── UsersController.cs                ← PATCH /api/users/profile
│   │                                            PATCH /api/users/email-verification
│   │                                            GET   /api/users/me
│   │
│   ├── Organizations/
│   │   └── OrganizationsController.cs        ← POST /api/organizations
│   │                                            GET  /api/organizations/{id}
│   │                                            PATCH /api/organizations/{id}
│   │
│   ├── Students/
│   │   └── StudentsController.cs             ← GET  /api/organizations/{orgId}/students
│   │                                            POST /api/organizations/{orgId}/students
│   │                                            PATCH /api/organizations/{orgId}/students/{id}
│   │                                            DELETE /api/organizations/{orgId}/students/{id}
│   │
│   ├── Invites/
│   │   └── InvitesController.cs              ← POST /api/invites
│   │                                            POST /api/invites/accept
│   │
│   ├── Billing/
│   │   ├── FeesController.cs                 ← POST/PATCH /api/organizations/{orgId}/students/{id}/fees
│   │   ├── PeriodsController.cs              ← GET  /api/organizations/{orgId}/periods
│   │   │                                        PATCH /api/organizations/{orgId}/periods/{id}/waive
│   │   └── PaymentsController.cs             ← POST /api/payments
│   │                                            DELETE /api/payments/{id}
│   │
│   └── Admin/
│       └── AdminController.cs                ← POST /api/admin/users/{id}/revoke-sessions
│                                                POST /api/admin/users/{id}/suspend
│
├── Middleware/
│   ├── UserActiveCheckMiddleware.cs          ← checks public.users.is_active AND email_verified
│   │                                            on every protected request → 403 if either false
│   ├── RequestLoggingMiddleware.cs           ← structured logging; strips Authorization header
│   └── OriginValidationMiddleware.cs         ← CSRF origin check (see authentication.md §5.4)
│
├── Filters/
│   ├── ValidationFilter.cs                   ← FluentValidation integration
│   └── ExceptionFilter.cs                    ← maps domain exceptions to HTTP status codes
│
├── Extensions/
│   ├── ServiceCollectionExtensions.cs        ← registers all Application + Infrastructure services
│   ├── JwtExtensions.cs                      ← AddJwtBearer configuration (see auth.md §2.5)
│   └── SwaggerExtensions.cs                  ← Swagger/OpenAPI setup + JWT security scheme
│
└── Properties/
    └── launchSettings.json
```

---

### 2.3 TuitionIQ.Application (Use Case Layer)

```
TuitionIQ.Application/
├── TuitionIQ.Application.csproj
│
├── Common/
│   ├── Interfaces/
│   │   ├── ICurrentUserService.cs            ← resolves user ID + org context from JWT claims
│   │   ├── IDateTimeProvider.cs              ← testable clock abstraction
│   │   ├── IEmailService.cs                  ← sends invite emails and notifications via SMTP;
│   │   │                                        does NOT send OTP codes or password reset emails
│   │   │                                        (those are dispatched by Supabase Auth directly)
│   │   └── IAuditLogService.cs               ← writes audit_logs rows within transactions
│   ├── Behaviours/
│   │   └── ValidationBehaviour.cs            ← MediatR pipeline: auto-validate request DTOs
│   ├── Exceptions/
│   │   ├── ForbiddenException.cs             ← maps to 403
│   │   ├── NotFoundException.cs              ← maps to 404
│   │   ├── ConflictException.cs              ← maps to 409
│   │   └── ValidationException.cs            ← maps to 422
│   └── Models/
│       └── PagedResult.cs                    ← generic pagination wrapper
│
├── Features/
│   │
│   ├── Auth/
│   │   ├── Commands/
│   │   │   └── GlobalSignOutCommand.cs       ← calls Supabase Admin API; sets is_active flags
│   │   └── Queries/
│   │       └── GetCurrentUserQuery.cs
│   │
│   ├── Users/
│   │   ├── Commands/
│   │   │   ├── UpdateProfileCommand.cs       ← validates + writes first_name, last_name, phone
│   │   │   └── VerifyEmailCommand.cs         ← sets public.users.email_verified = TRUE;
│   │   │                                        writes audit_log (action='user.email_verified');
│   │   │                                        idempotent — returns 200 if already verified;
│   │   │                                        called after client successfully completes
│   │   │                                        supabase.auth.verifyOtp() on the frontend
│   │   ├── Queries/
│   │   │   └── GetUserProfileQuery.cs
│   │   └── Dtos/
│   │       ├── UserProfileDto.cs             ← { id, email, firstName, lastName, phone,
│   │       │                                      avatarUrl, emailVerified }
│   │       └── UpdateProfileRequest.cs       ← { firstName, lastName, phone? }
│   │
│   ├── Organizations/
│   │   ├── Commands/
│   │   │   ├── CreateOrganizationCommand.cs
│   │   │   └── UpdateOrganizationCommand.cs
│   │   ├── Queries/
│   │   │   └── GetOrganizationQuery.cs
│   │   └── Dtos/
│   │       ├── OrganizationDto.cs
│   │       ├── CreateOrganizationRequest.cs
│   │       └── UpdateOrganizationRequest.cs
│   │
│   ├── Students/
│   │   ├── Commands/
│   │   │   ├── CreateStudentCommand.cs       ← inserts students row + audit_log in one transaction
│   │   │   ├── UpdateStudentCommand.cs
│   │   │   └── SoftDeleteStudentCommand.cs
│   │   ├── Queries/
│   │   │   ├── GetStudentsQuery.cs           ← paginated list for org
│   │   │   └── GetStudentByIdQuery.cs
│   │   └── Dtos/
│   │       ├── StudentDto.cs
│   │       ├── StudentSummaryDto.cs          ← list view (no fee history)
│   │       ├── CreateStudentRequest.cs
│   │       └── UpdateStudentRequest.cs
│   │
│   ├── Invites/
│   │   ├── Commands/
│   │   │   ├── SendInviteCommand.cs          ← email lookup → immediate link OR token dispatch
│   │   │   └── AcceptInviteCommand.cs        ← validates token, email match, links student
│   │   └── Dtos/
│   │       ├── SendInviteRequest.cs
│   │       └── AcceptInviteRequest.cs
│   │
│   └── Billing/
│       ├── Commands/
│       │   ├── SetStudentFeeCommand.cs       ← closes old fee config, opens new one in transaction
│       │   ├── RecordPaymentCommand.cs       ← verifies teacher→student ownership, inserts payment
│       │   ├── ReversePaymentCommand.cs      ← soft-deletes payment; trigger recalculates period
│       │   └── WaivePeriodCommand.cs         ← sets fee_periods.status = 'waived'
│       ├── Queries/
│       │   ├── GetStudentFeeHistoryQuery.cs
│       │   ├── GetFeePeriodsQuery.cs
│       │   └── GetPaymentsForPeriodQuery.cs
│       └── Dtos/
│           ├── FeePeriodDto.cs               ← { id, periodYear, periodMonth, fee, amountPaid, status, currency }
│           ├── FeePaymentDto.cs
│           ├── StudentFeeConfigDto.cs
│           ├── RecordPaymentRequest.cs
│           └── SetFeeRequest.cs
```

> **MediatR pattern:** Every `Command` and `Query` is a MediatR request with a dedicated handler in the same file. Controllers are thin — they construct the request object, dispatch via `IMediator`, and return the result. Zero business logic in controllers.

---

### 2.4 TuitionIQ.Domain (Core Business Rules)

```
TuitionIQ.Domain/
├── TuitionIQ.Domain.csproj
│
├── Entities/
│   ├── User.cs                               ← maps to public.users; no password fields;
│   │                                            includes EmailVerified bool property
│   ├── Organization.cs
│   ├── OrganizationMember.cs
│   ├── Student.cs                            ← includes AccountStatus enum, nullable UserId
│   ├── TeacherStudent.cs
│   ├── Invite.cs                             ← InviteStatus enum, token, expiry
│   ├── StudentFee.cs                         ← FeeSource enum, manual_fee (long)
│   ├── FeePeriod.cs                          ← immutable fee snapshot; amount_paid cache
│   ├── FeePayment.cs                         ← individual ledger entry; amount > 0
│   └── AuditLog.cs                           ← insert-only; throw on update/delete
│
├── Enums/
│   ├── OrganizationMemberRole.cs             ← Owner, Admin, Teacher, Student
│   ├── StudentStatus.cs                      ← Active, Inactive, Graduated
│   ├── StudentAccountStatus.cs               ← NoAccount, InvitePending, Active
│   ├── InviteStatus.cs                       ← Pending, Accepted, Expired, Revoked
│   ├── FeeSource.cs                          ← Manual, ClassCalculated, Override
│   ├── FeePeriodStatus.cs                    ← Unpaid, Partial, Paid, Overdue, Waived
│   └── PaymentMethod.cs                      ← Cash, BankTransfer, Card, Cheque, Other
│
├── ValueObjects/
│   ├── Money.cs                              ← (long Amount, string Currency) — no fractional subunits
│   └── DateRange.cs                          ← (DateOnly From, DateOnly? To)
│
└── Rules/
    ├── StudentOwnershipRule.cs               ← "teacher must be linked to student via teacher_students"
    ├── InviteExpiryRule.cs                   ← "expires_at > NOW() and status = Pending"
    ├── FeeActiveRule.cs                      ← "only one is_active fee config per student"
    └── EmailVerificationRule.cs              ← "email_verified must be TRUE before accessing
                                                 protected resources; enforced by middleware"
```

---

### 2.5 TuitionIQ.Infrastructure (External Concerns)

```
TuitionIQ.Infrastructure/
├── TuitionIQ.Infrastructure.csproj
│
├── Persistence/
│   ├── AppDbContext.cs                       ← EF Core DbContext; global soft-delete query filters
│   ├── Migrations/                           ← EF-generated migration files
│   │   ├── 20250101000000_InitialSchema.cs
│   │   ├── 20250201000000_AddCompositeKeys.cs
│   │   ├── 20250301000000_AddEmailVerified.cs  ← adds email_verified BOOLEAN NOT NULL DEFAULT FALSE
│   │   └── ...                                  to public.users; adds idx_users_email_verified
│   └── Configurations/                       ← IEntityTypeConfiguration<T> per entity
│       ├── UserConfiguration.cs              ← maps EmailVerified bool; no password column
│       ├── OrganizationConfiguration.cs
│       ├── OrganizationMemberConfiguration.cs
│       ├── StudentConfiguration.cs
│       ├── TeacherStudentConfiguration.cs
│       ├── InviteConfiguration.cs
│       ├── StudentFeeConfiguration.cs
│       ├── FeePeriodConfiguration.cs
│       ├── FeePaymentConfiguration.cs
│       └── AuditLogConfiguration.cs          ← SaveChanges override: throws on Modified/Deleted
│
├── Auth/
│   ├── SupabaseAdminClient.cs                ← wraps Supabase Admin API (sign-out, ban,
│   │                                            updateUserById for account-level operations)
│   ├── CurrentUserService.cs                 ← ICurrentUserService; UserId = internal users.id
│   │                                            (resolved sub→auth_user_id by middleware),
│   │                                            AuthUserId = JWT 'sub'
│   ├── CurrentUserContextKeys.cs             ← HttpContext.Items key for the resolved internal id
│   └── JwtClaimsExtensions.cs               ← parses app_metadata.orgs from JWT
│
├── Email/
│   ├── SmtpEmailService.cs                   ← implements IEmailService; sends via configured SMTP
│   └── Templates/
│       ├── InviteEmail.cs                    ← invite token email; includes sign-up link
│       │                                        (email pre-filled) for new users or login
│       │                                        link for existing users
│       └── NotificationEmail.cs              ← "you've been added to {org}" email
│
└── DependencyInjection.cs                    ← registers all Infrastructure services
```

---

### 2.6 Tests

```
tests/
├── TuitionIQ.UnitTests/
│   ├── Features/
│   │   ├── Billing/
│   │   │   ├── RecordPaymentCommandTests.cs  ← mocks ICurrentUserService, AppDbContext
│   │   │   └── WaivePeriodCommandTests.cs
│   │   ├── Invites/
│   │   │   └── AcceptInviteCommandTests.cs   ← email match, expiry, status machine
│   │   ├── Students/
│   │   │   └── CreateStudentCommandTests.cs
│   │   └── Users/
│   │       └── VerifyEmailCommandTests.cs    ← idempotency when already verified;
│   │                                            audit_log written; 403 returned by
│   │                                            middleware when email_verified = FALSE
│   └── Domain/
│       └── MoneyTests.cs
│
├── TuitionIQ.IntegrationTests/
│   ├── Fixtures/
│   │   └── WebApplicationFactory.cs          ← spins up API against real local Supabase
│   ├── Auth/
│   │   ├── JwtValidationTests.cs
│   │   └── EmailVerificationMiddlewareTests.cs  ← verifies unverified users (email_verified=FALSE)
│   │                                              receive 403 on all protected endpoints;
│   │                                              verifies verified users pass through normally
│   └── Billing/
│       └── PaymentFlowTests.cs               ← full end-to-end: create student → fee → payment
│
└── TuitionIQ.ArchitectureTests/
    └── LayerDependencyTests.cs               ← NetArchTest: Domain must not ref Infrastructure
```

---

## 3. Frontend Architecture

### 3.1 Overview

The Expo app uses a **feature-based screen structure** with Expo Router (file-based routing). Screens live inside `app/` following Expo Router conventions. Shared components, hooks, and services live outside `app/` and are organised by feature.

```
frontend/
├── app.json                                  ← Expo config; scheme: "tuitioniq"
├── babel.config.js
├── tsconfig.json
├── package.json
├── .env                                      ← EXPO_PUBLIC_ vars only (see Section 8)
├── .env.example
│
├── app/                                      ← Expo Router: file = route
│   ├── _layout.tsx                           ← Root layout: auth listener, splash, providers;
│   │                                            subscribes to onAuthStateChange; handles
│   │                                            PASSWORD_RECOVERY event → /auth/reset-password
│   ├── index.tsx                             ← Redirects to /home or /auth/login based on session
│   │
│   ├── (auth)/                               ← Unauthenticated route group
│   │   ├── _layout.tsx                       ← No auth required; redirects to /home if session
│   │   │                                        exists AND email_verified = TRUE
│   │   ├── login.tsx                         ← Email + password login screen
│   │   ├── signup.tsx                        ← Registration screen: first name, last name,
│   │   │                                        email, password, confirm password
│   │   ├── forgot-password.tsx               ← Email input; triggers resetPasswordForEmail();
│   │   │                                        always shows neutral success message to prevent
│   │   │                                        user enumeration; 60-second resend cooldown
│   │   └── reset-password.tsx                ← New password + confirm password form; reads PKCE
│   │                                            code from URL, strips it immediately via
│   │                                            window.history.replaceState, exchanges via
│   │                                            exchangeCodeForSession(), calls updateUser()
│   │
│   ├── (verify)/                             ← Post-login, pre-verification route group
│   │   ├── _layout.tsx                       ← Requires authenticated session; redirects to
│   │   │                                        /home if email_verified = TRUE; non-bypassable
│   │   └── verify-email.tsx                  ← 6-digit OTP entry screen; dispatches OTP via
│   │                                            signInWithOtp({ shouldCreateUser: false });
│   │                                            calls verifyOtp() then PATCH
│   │                                            /api/users/email-verification on success;
│   │                                            60-second resend cooldown; non-dismissable
│   │
│   ├── join.tsx                              ← Invite token acceptance screen; reads token from
│   │                                            URL and strips it immediately; shows SignUpForm
│   │                                            (email pre-filled, read-only) if user has no
│   │                                            account, or LoginForm if account exists; runs
│   │                                            OTP verification if email_verified = FALSE;
│   │                                            then POSTs token to /api/invites/accept
│   │
│   └── (app)/                                ← Authenticated + verified route group
│       ├── _layout.tsx                       ← Requires session AND email_verified = TRUE;
│       │                                        redirects to /auth/login if no session;
│       │                                        redirects to /verify/verify-email if session
│       │                                        exists but email_verified = FALSE;
│       │                                        AppState refresh handler
│       ├── home.tsx                          ← Org resolution: ALWAYS shows the selector (1+ orgs),
│       │                                        never auto-selects; 0 orgs → welcome + Create org
│       │
│       ├── (teacher)/                        ← Teacher + Admin + Owner views
│       │   ├── _layout.tsx                   ← Role guard; tabs layout
│       │   ├── dashboard.tsx                 ← Overview: students, payments due, recent activity
│       │   │
│       │   ├── students/
│       │   │   ├── index.tsx                 ← Student list
│       │   │   ├── new.tsx                   ← Create student form
│       │   │   └── [studentId]/
│       │   │       ├── index.tsx             ← Student detail: profile, fee config
│       │   │       ├── periods.tsx           ← Fee period list
│       │   │       └── payments.tsx          ← Payment history + record payment
│       │   │
│       │   ├── billing/
│       │   │   ├── index.tsx                 ← Org-wide billing dashboard
│       │   │   └── [periodId].tsx            ← Period detail
│       │   │
│       │   └── settings/
│       │       ├── index.tsx                 ← Org settings
│       │       └── profile.tsx               ← User profile; "sign out everywhere" button;
│       │                                        "Change password" → /auth/forgot-password
│       │
│       └── (student)/                        ← Student portal views
│           ├── _layout.tsx                   ← Role guard for student role
│           └── portal.tsx                    ← Student's own fee periods + payment status
│
├── src/
│   │
│   ├── features/                             ← Feature-scoped: components, hooks, services
│   │   │
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx             ← email + password fields; show/hide password
│   │   │   │   │                                toggle; "Forgot your password?" link;
│   │   │   │   │                                shows prominent reset prompt after 5 failures
│   │   │   │   ├── SignUpForm.tsx            ← first name, last name, email, password, confirm
│   │   │   │   │                                password; PasswordStrengthMeter; show/hide
│   │   │   │   │                                toggles; client-side PASSWORD_REGEX validation
│   │   │   │   ├── ForgotPasswordForm.tsx    ← email input only; 60-second resend cooldown;
│   │   │   │   │                                always shows neutral success copy
│   │   │   │   ├── ResetPasswordForm.tsx     ← new password + confirm password; show/hide
│   │   │   │   │                                toggles; PasswordStrengthMeter; calls
│   │   │   │   │                                updateUser({ password }) then signOut()
│   │   │   │   └── EmailOtpVerificationForm.tsx  ← 6-digit code input; resend button with
│   │   │   │                                        60-second cooldown; "check spam" guidance;
│   │   │   │                                        "Use a different account" link; non-dismissable
│   │   │   ├── hooks/
│   │   │   │   ├── useAuthSession.ts         ← getSession() + onAuthStateChange subscription;
│   │   │   │   │                                handles SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED,
│   │   │   │   │                                USER_UPDATED, PASSWORD_RECOVERY events
│   │   │   │   ├── useSessionFreshness.ts    ← isSessionFresh() for high-value ops (auth.md §7.7)
│   │   │   │   └── useEmailVerification.ts   ← reads emailVerified from /api/users/me;
│   │   │   │                                    dispatches OTP via signInWithOtp();
│   │   │   │                                    calls verifyOtp(); calls PATCH
│   │   │   │                                    /api/users/email-verification on success
│   │   │   └── services/
│   │   │       └── authService.ts            ← signUp, signInWithPassword, signOut,
│   │   │                                        resetPasswordForEmail, updatePassword,
│   │   │                                        sendVerificationOtp, verifyEmailOtp
│   │   │                                        — no raw passwords stored or logged
│   │   │
│   │   ├── users/
│   │   │   ├── components/
│   │   │   │   └── AvatarUpload.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useUserProfile.ts
│   │   │   └── services/
│   │   │       └── usersApiClient.ts         ← PATCH /api/users/profile
│   │   │                                        PATCH /api/users/email-verification
│   │   │
│   │   ├── organizations/
│   │   │   ├── components/
│   │   │   │   ├── OrgSelector.tsx           ← multi-org switcher screen/modal
│   │   │   │   ├── CreateOrgForm.tsx
│   │   │   │   └── OrgSettingsForm.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useOrgMemberships.ts      ← loads org list once; cached in store
│   │   │   └── services/
│   │   │       └── organizationsApiClient.ts
│   │   │
│   │   ├── students/
│   │   │   ├── components/
│   │   │   │   ├── StudentList.tsx
│   │   │   │   ├── StudentCard.tsx
│   │   │   │   ├── StudentForm.tsx           ← create + edit
│   │   │   │   └── InviteStatusBadge.tsx     ← visual account_status indicator
│   │   │   ├── hooks/
│   │   │   │   ├── useStudents.ts            ← paginated list
│   │   │   │   └── useStudent.ts             ← single student detail
│   │   │   └── services/
│   │   │       └── studentsApiClient.ts      ← all CRUD via backend (never direct Supabase writes)
│   │   │
│   │   ├── invites/
│   │   │   ├── components/
│   │   │   │   ├── InviteAcceptanceScreen.tsx  ← reads invite token; shows SignUpForm (email
│   │   │   │   │                                  pre-filled, read-only) when user has no account;
│   │   │   │   │                                  shows LoginForm when account exists; runs OTP
│   │   │   │   │                                  verification if email_verified = FALSE; then
│   │   │   │   │                                  POSTs token to /api/invites/accept
│   │   │   │   └── InviteAuthGate.tsx          ← determines SignUpForm vs LoginForm by checking
│   │   │   │                                      whether a Supabase session already exists
│   │   │   ├── hooks/
│   │   │   │   └── useInviteFlow.ts          ← manages token in React state through the
│   │   │   │                                    sign-up or login flow and OTP verification;
│   │   │   │                                    token is never stored in URL, localStorage,
│   │   │   │                                    or SecureStore — React state only
│   │   │   └── services/
│   │   │       └── invitesApiClient.ts       ← POST /api/invites, POST /api/invites/accept
│   │   │
│   │   └── billing/
│   │       ├── components/
│   │       │   ├── FeePeriodList.tsx
│   │       │   ├── FeePeriodCard.tsx         ← status badge, amount paid / fee owed
│   │       │   ├── RecordPaymentForm.tsx
│   │       │   ├── PaymentMethodSelect.tsx
│   │       │   └── SetFeeForm.tsx
│   │       ├── hooks/
│   │       │   ├── useFeePeriods.ts
│   │       │   └── usePayments.ts
│   │       └── services/
│   │           └── billingApiClient.ts       ← all writes via backend API only
│   │
│   ├── shared/                               ← Reusable across features
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── TextInput.tsx
│   │   │   │   ├── PasswordInput.tsx         ← password field with show/hide eye-icon toggle;
│   │   │   │   │                                used on login, signup, and reset-password screens
│   │   │   │   ├── PasswordStrengthMeter.tsx ← visual strength indicator driven by passwordValidation
│   │   │   │   │                                util; shown on signup and reset-password screens
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   ├── LoadingSpinner.tsx
│   │   │   │   └── EmptyState.tsx
│   │   │   └── layout/
│   │   │       ├── ScreenContainer.tsx       ← safe area + keyboard aware scroll
│   │   │       └── SectionHeader.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useApiClient.ts               ← base Axios/fetch wrapper; injects Bearer token
│   │   │   └── usePlatform.ts                ← Platform.OS helpers
│   │   │
│   │   └── utils/
│   │       ├── formatCurrency.ts             ← formats whole-integer BDT/other amounts
│   │       ├── formatDate.ts
│   │       ├── passwordValidation.ts         ← exports PASSWORD_REGEX and validatePassword(pwd);
│   │       │                                    shared by SignUpForm and ResetPasswordForm;
│   │       │                                    enforces min 8 chars, uppercase, lowercase,
│   │       │                                    digit, special character requirements
│   │       └── stripUrlParam.ts              ← window.history.replaceState wrapper; used to
│   │                                            strip PKCE code from reset-password URL and
│   │                                            invite token from join URL immediately on mount
│   │
│   ├── lib/
│   │   ├── supabase.ts                       ← createClient with ExpoSecureStoreAdapter
│   │   └── apiClient.ts                      ← configured Axios instance; attaches JWT
│   │
│   └── store/
│       ├── authStore.ts                      ← Zustand: session, user, emailVerified
│       ├── orgStore.ts                       ← Zustand: selectedOrgId, memberships
│       └── index.ts                          ← re-exports all stores
│
└── assets/
    ├── images/
    └── fonts/
```

---

### 3.2 State Management

**Tool: Zustand** — minimal, TypeScript-first, no boilerplate.

```
authStore      → session, user, emailVerified, isInitializingAuth → derived authStatus
                 (initializing | unauthenticated | unverified | authenticated). Set by the
                 single onAuthStateChange bootstrap; guards read authStatus, and the gate
                 closes only after email_verified is resolved for an authenticated session.
orgStore       → memberships[], selectedOrgId (loaded at /home; selectedOrgId persisted to
                 sessionStorage on web, in-memory on native; cleared on sign-out)
```

Server state (lists, detail pages) is managed by **TanStack Query (React Query)**:

- Handles caching, background refetch, loading/error states
- Invalidated on mutations (e.g., after recording a payment, invalidate fee period query)
- Works identically on web and mobile

There is no Redux. There is no Context for server data. Global UI state lives in Zustand. Remote data lives in TanStack Query.

---

## 4. Shared Types Strategy

### 4.1 Evaluation: Backend → Frontend Type Generation

**Recommendation: Option A — OpenAPI / Swagger → TypeScript generation**

**Why backend-driven generation is correct for this system:**

- The C# backend is the single source of truth for all DTOs and request/response contracts
- The frontend must never hand-write types that duplicate backend structures — they will drift
- OpenAPI is a standard; the toolchain is mature, well-supported, and CI-friendly
- All DTO changes flow automatically to the frontend via a single regeneration step

**Risks and mitigations:**

| Risk                                                | Mitigation                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Frontend breaks on DTO rename without warning       | CI pipeline runs codegen + TypeScript type-check on every backend PR           |
| Generated types are verbose or incorrectly nullable | Configure `openapi-typescript` options; review generated output in code review |
| Circular types from EF navigation properties        | Ensure DTOs never expose navigation properties — DTOs are flat value objects   |
| Enum generation inconsistency                       | Configure `x-enum-varnames` in Swagger; verify string enum generation          |

### 4.2 Tooling

| Tool                       | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `Swashbuckle.AspNetCore`   | Generates `openapi.json` from C# controllers + XML docs          |
| `openapi-typescript`       | Converts `openapi.json` → `types.gen.ts` (zero-dependency, fast) |
| `scripts/codegen-types.sh` | Orchestration script run locally and in CI                       |

### 4.3 Shared Types Directory

```
shared/
├── package.json                              ← { "name": "@tuitioniq/types", "version": "0.0.0" }
│                                                (local package — no npm publish required)
├── tsconfig.json
│
├── generated/
│   ├── types.gen.ts                          ← AUTO-GENERATED — do not hand-edit
│   └── openapi.json                          ← AUTO-GENERATED — source spec from backend
│
└── index.ts                                  ← re-exports all generated types for clean imports
```

### 4.4 Generation Workflow

**Step 1 — Export OpenAPI spec from backend:**

```bash
dotnet run --project backend/src/TuitionIQ.Api -- --generate-openapi
# Outputs: shared/generated/openapi.json
```

**Step 2 — Generate TypeScript types:**

```bash
npx openapi-typescript shared/generated/openapi.json \
  --output shared/generated/types.gen.ts \
  --immutable-types \
  --path-params-as-types
```

**Step 3 — Verify frontend compiles:**

```bash
cd frontend && npx tsc --noEmit
```

**Full script (`scripts/codegen-types.sh`):**

```bash
#!/bin/bash
set -e
echo "→ Generating OpenAPI spec from backend..."
dotnet run --project backend/src/TuitionIQ.Api -- --generate-openapi
echo "→ Generating TypeScript types..."
npx openapi-typescript shared/generated/openapi.json \
  --output shared/generated/types.gen.ts \
  --immutable-types
echo "→ Type-checking frontend..."
cd frontend && npx tsc --noEmit
echo "✓ Types regenerated and frontend verified."
```

### 4.5 Frontend Import Pattern

```typescript
// frontend/src/features/billing/services/billingApiClient.ts

import type { components } from "@tuitioniq/types";

type FeePeriodDto = components["schemas"]["FeePeriodDto"];
type RecordPaymentRequest = components["schemas"]["RecordPaymentRequest"];

export const recordPayment = async (
  req: RecordPaymentRequest,
): Promise<FeePeriodDto> => {
  const response = await apiClient.post("/api/payments", req);
  return response.data;
};
```

**tsconfig path alias (frontend/tsconfig.json):**

```json
{
  "compilerOptions": {
    "paths": {
      "@tuitioniq/types": ["../shared/index.ts"]
    }
  }
}
```

### 4.6 When Types Are Regenerated

| Trigger                        | Action                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------- |
| Backend DTO added or changed   | Developer runs `./scripts/codegen-types.sh` before committing                   |
| PR opened with backend changes | CI runs codegen + frontend type-check automatically (`codegen.yml`)             |
| DTO deleted                    | Regeneration removes the type; TypeScript compiler identifies all broken usages |
| Release branch created         | Codegen runs as part of the release validation step                             |

---

## 5. API Communication Layer

### 5.1 Core Principle: Frontend Never Writes to the Database

**The frontend communicates exclusively with the C# ASP.NET Core backend for all data reads and writes. It communicates with Supabase directly only for authentication operations.**

This is the correct design for four concrete reasons:

1. **Business rule enforcement:** Multi-step rules (verify teacher → student ownership before recording a payment) cannot be safely expressed in RLS alone. The C# API enforces them transactionally.
2. **Audit trail integrity:** Every significant write must insert an `audit_logs` row in the same transaction. This cannot be guaranteed from the client.
3. **Financial data protection:** Fee payments and period management are financial records. Exposing direct PostgREST write access to billing tables is prohibited regardless of RLS configuration.
4. **Invite acceptance:** The invite flow requires email matching, status transitions, and org membership insertion — a multi-step atomic operation that belongs in the C# API.

### 5.2 Traffic Routing Table

| Operation                        | Route                                                 | Reason                                                      |
| -------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| Sign up (register)               | Supabase `signUp()`                                   | Auth-layer operation; no business data                      |
| Sign in                          | Supabase `signInWithPassword()`                       | Auth-layer operation; credentials never touch C# API        |
| Password reset request           | Supabase `resetPasswordForEmail()`                    | Auth-layer operation; dispatched directly from client       |
| Password reset (new password)    | Supabase `exchangeCodeForSession()` + `updateUser()`  | Auth-layer operation; recovery session from PKCE code       |
| Token refresh                    | Supabase SDK auto-refresh                             | Auth-layer operation                                        |
| Sign out                         | Supabase `signOut()`                                  | Session invalidation                                        |
| OTP dispatch (post-login verify) | Supabase `signInWithOtp({ shouldCreateUser: false })` | Auth-layer operation; OTP sent by Supabase SMTP             |
| OTP confirmation                 | Supabase `verifyOtp()`                                | Auth-layer operation; validates 6-digit code                |
| Mark email verified              | C# API `PATCH /api/users/email-verification`          | Writes email_verified = TRUE + audit_log in one transaction |
| **GET** students list            | C# API                                                | `GET /api/organizations/{orgId}/students`                   |
| **GET** fee periods              | C# API                                                | `GET /api/organizations/{orgId}/periods`                    |
| **GET** user profile             | C# API                                                | `GET /api/users/me`                                         |
| **POST** student create          | C# API                                                | Requires audit_log in same transaction                      |
| **POST** payment                 | C# API                                                | Financial write; requires teacher→student ownership check   |
| **PATCH** fee config             | C# API                                                | Multi-step: close old, open new in one transaction          |
| **POST** invite send             | C# API                                                | Email lookup + conditional immediate linking                |
| **POST** invite accept           | C# API                                                | Token validation + email match + org membership insert      |
| **PATCH** waive period           | C# API                                                | Requires role validation; audit logged                      |
| **POST** admin suspend           | C# API                                                | Calls Supabase Admin API; sets is_active flag               |

### 5.3 API Client Configuration

```typescript
// frontend/src/lib/apiClient.ts

import axios from "axios";
import { supabase } from "./supabase";

export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: attach current JWT as Bearer token
apiClient.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Response interceptor: handle 401 (expired session), 403 (suspended or unverified account)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // SDK will have already attempted refresh; 401 here means session is gone
      await supabase.auth.signOut();
    }
    if (error.response?.status === 403) {
      // Account suspended or email_verified = FALSE — show appropriate message, not raw error
    }
    return Promise.reject(error);
  },
);
```

---

## 6. Feature Map Across Layers

Features are consistently named across backend and frontend. An agent adding a new feature creates the same feature name in both layers.

```
Feature        Backend (Application/Features/)         Frontend (src/features/)         Shared Schemas
─────────────  ──────────────────────────────────────  ─────────────────────────────────  ─────────────────────
auth           Auth/Commands/GlobalSignOutCommand       auth/services/authService          (no DTO schemas)
               Auth/Queries/GetCurrentUserQuery         auth/hooks/useAuthSession
                                                        auth/hooks/useEmailVerification

users          Users/Commands/UpdateProfileCommand      users/services/usersApiClient      UserProfileDto
               Users/Commands/VerifyEmailCommand        users/hooks/useUserProfile         UpdateProfileRequest
               Users/Queries/GetUserProfileQuery

organizations  Organizations/Commands/CreateOrgCommand  orgs/services/orgsApiClient        OrganizationDto
               Organizations/Queries/GetOrgQuery        orgs/hooks/useOrgMemberships       CreateOrganizationRequest

students       Students/Commands/CreateStudentCommand   students/services/studentsApiClient StudentDto
               Students/Queries/GetStudentsQuery        students/hooks/useStudents          CreateStudentRequest

invites        Invites/Commands/SendInviteCommand        invites/services/invitesApiClient  SendInviteRequest
               Invites/Commands/AcceptInviteCommand      invites/hooks/useInviteFlow        AcceptInviteRequest

billing        Billing/Commands/RecordPaymentCommand    billing/services/billingApiClient  FeePeriodDto
               Billing/Commands/WaivePeriodCommand      billing/hooks/useFeePeriods        RecordPaymentRequest
               Billing/Queries/GetFeePeriodsQuery        billing/hooks/usePayments          SetFeeRequest
```

---

## 7. Naming Conventions & Rules

These rules are **AI-agent enforceable**. Violations should fail linting or code review.

### 7.1 Backend

| Artifact           | Convention                                   | Example                                          |
| ------------------ | -------------------------------------------- | ------------------------------------------------ |
| Entity class       | `PascalCase`, singular                       | `Student`, `FeePeriod`                           |
| EF table mapping   | `snake_case` via `ToTable()`                 | `.ToTable("fee_periods")`                        |
| DTO suffix         | `Dto` or `Request`                           | `FeePeriodDto`, `RecordPaymentRequest`           |
| Command class      | `VerbNounCommand`                            | `RecordPaymentCommand`                           |
| Query class        | `GetNounQuery`                               | `GetStudentsQuery`                               |
| Controller         | `NounController`                             | `StudentsController`                             |
| Endpoint route     | `kebab-case`, pluralised nouns               | `/api/organizations/{orgId}/students`            |
| Exception classes  | Domain exception name                        | `StudentNotFoundException`, `ForbiddenException` |
| Migration file     | `YYYYMMDDHHMMSS_ShortDescription`            | `20250301120000_AddStudentPhone`                 |
| Interface prefix   | `I`                                          | `ICurrentUserService`                            |
| Money fields in C# | `long` only; whole integers; never `decimal` | `amount`, `fee`, `manualFee`                     |

### 7.2 Frontend

| Artifact              | Convention                                                              | Example                       |
| --------------------- | ----------------------------------------------------------------------- | ----------------------------- |
| Screen file           | `PascalCase.tsx`, noun or verb-noun                                     | `StudentList.tsx`             |
| Hook file             | `camelCase.ts`, prefixed `use`                                          | `useStudents.ts`              |
| Service/client file   | `camelCase + ApiClient`                                                 | `billingApiClient.ts`         |
| Component file        | `PascalCase.tsx`                                                        | `FeePeriodCard.tsx`           |
| Store file            | `camelCase + Store`                                                     | `authStore.ts`                |
| Zustand store exports | `use + Name + Store`                                                    | `useAuthStore`, `useOrgStore` |
| Env variable (client) | `EXPO_PUBLIC_` prefix, SCREAMING_SNAKE                                  | `EXPO_PUBLIC_API_BASE_URL`    |
| Currency display      | always via `formatCurrency(amount, currency)` — never inline formatting |                               |
| Password validation   | always via `passwordValidation.ts` util — never inline regex            | `validatePassword(pwd)`       |

### 7.3 API Endpoint Conventions

```
Collection:      GET    /api/organizations/{orgId}/students
Single resource: GET    /api/organizations/{orgId}/students/{studentId}
Create:          POST   /api/organizations/{orgId}/students
Update:          PATCH  /api/organizations/{orgId}/students/{studentId}
Delete:          DELETE /api/organizations/{orgId}/students/{studentId}
Action on noun:  PATCH  /api/organizations/{orgId}/periods/{periodId}/waive
                 PATCH  /api/users/email-verification
                 POST   /api/invites/accept
                 POST   /api/admin/users/{userId}/revoke-sessions
```

All responses return **camelCase JSON** (C# `JsonNamingPolicy.CamelCase`).
All errors return standard RFC 7807 ProblemDetails:

```json
{ "type": "string", "title": "string", "status": 400, "errors": {} }
```

### 7.4 Enforced Code Rules

- **No business logic in controllers.** Controllers dispatch MediatR commands and return results.
- **No direct DB access in Application layer.** Only Infrastructure touches EF Core.
- **No Supabase client in frontend feature services for data access.** All reads and writes use `apiClient` (backend). `supabase` is used only for authentication operations (signUp, signInWithPassword, signOut, resetPasswordForEmail, updateUser, signInWithOtp, verifyOtp).
- **No raw passwords stored, logged, or transmitted through the C# API.** Credentials are handled exclusively by Supabase Auth. No password column exists on any application table.
- **No hand-editing `shared/generated/`.** Fully generated; overwritten on each codegen run.
- **No `any` type in TypeScript.** ESLint `@typescript-eslint/no-explicit-any` set to `error`.

---

## 8. Environment Configuration

### 8.1 Frontend (`frontend/.env`)

```bash
# Supabase (safe to expose — constrained by RLS; cannot bypass auth)
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Backend API base URL
EXPO_PUBLIC_API_BASE_URL=https://api.tuitioniq.com
# For local dev: EXPO_PUBLIC_API_BASE_URL=http://localhost:5000
```

**Must never appear in `frontend/.env`:**

```bash
SUPABASE_SERVICE_ROLE_KEY= ← backend only; bypasses RLS entirely
```

### 8.2 Backend (user-secrets locally; environment variables / secrets manager in production)

```bash
Supabase__ProjectRef=<project-ref>
Supabase__JwtSecret=<jwt-secret>
Supabase__ServiceRoleKey=<service-role-key>
Supabase__AdminUrl=https://<project-ref>.supabase.co

ConnectionStrings__DefaultConnection=Host=...;Database=postgres;Username=postgres;Password=...

Smtp__Host=smtp.postmarkapp.com
Smtp__Port=587
Smtp__ApiKey=<postmark-api-key>
Smtp__FromAddress=noreply@tuitioniq.com
Smtp__FromName=TuitionIQ

App__AllowedOrigins__0=https://app.tuitioniq.com
App__AllowedOrigins__1=tuitioniq://
App__Environment=Production
```

Local dev setup:

```bash
cd backend
dotnet user-secrets set "Supabase__JwtSecret" "<value>"
dotnet user-secrets set "Supabase__ServiceRoleKey" "<value>"
# etc.
```

### 8.3 Local Development Stack (`docker-compose.yml`)

```yaml
services:
  supabase-db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: postgres
    ports:
      - "54321:5432"
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    depends_on: [supabase-db]
```

> Use the Supabase CLI (`supabase start`) for a full local Supabase stack including Auth, PostgREST, and Studio.

---

## 9. Development Workflow

### 9.1 Adding a New Feature (e.g. Classes)

Follow this sequence in order. Do not skip steps.

**Step 1 — Domain:** Add `Class.cs` entity + `ClassStatus.cs` enum in `TuitionIQ.Domain/`.

**Step 2 — Infrastructure:** Add `ClassConfiguration.cs` in `Persistence/Configurations/`. Generate migration:

```bash
./scripts/db-migrate.sh add AddClassesTable
```

**Step 3 — Application:** Create `Features/Classes/` folder with `Commands/`, `Queries/`, `Dtos/` subfolders. Add DTOs and handler files.

**Step 4 — API:** Add `ClassesController.cs` to `TuitionIQ.Api/Features/Classes/`. Map endpoints. Add `[ProducesResponseType]` attributes.

**Step 5 — Shared types:** Pull new DTO schemas into the shared types layer:

```bash
./scripts/codegen-types.sh
```

**Step 6 — Frontend feature:** Create `src/features/classes/` in the frontend. Add:

- `components/` — UI for class list, class form, enrolment
- `hooks/` — `useClasses.ts`, `useClass.ts`
- `services/classesApiClient.ts` — typed with generated types from `@tuitioniq/types`

**Step 7 — Routes:** Add screen files to `app/(app)/(teacher)/classes/`.

**Step 8 — Tests:** Add unit tests in `TuitionIQ.UnitTests/Features/Classes/`. Add at least one integration test for the create + read happy path.

---

### 9.2 Adding a New API Endpoint to an Existing Feature

1. Add or update DTO in the Application feature's `Dtos/` folder.
2. Add Command or Query + handler.
3. Add route to the relevant Controller with `[ProducesResponseType]` attributes.
4. Run `./scripts/codegen-types.sh`.
5. Update the relevant frontend API client service.

---

### 9.3 Updating Shared Types After a DTO Change

```bash
# From repository root:
./scripts/codegen-types.sh

# Review the diff:
git diff shared/generated/types.gen.ts

# Check frontend still compiles:
cd frontend && npx tsc --noEmit
```

Breaking changes in the backend contract surface as TypeScript compiler errors in the frontend before any code is deployed. This is the intended safety mechanism.

---

## 10. Scalability Considerations

### 10.1 Feature Growth

The feature-based folder structure scales linearly. Adding a `Lessons` feature creates a new top-level folder in `Application/Features/Lessons/` and `src/features/lessons/`. No existing folder is modified.

### 10.2 Multiple Developers

- Backend and frontend developers operate in separate folders with no file-level conflicts in normal work.
- Shared types are generated, not hand-edited. Merge conflicts in `shared/generated/` resolve by running codegen again.
- The feature-based layout makes clear which files belong to which domain. An agent or developer working on billing never needs to open a students file.

### 10.3 LMS Expansion

The schema supports LMS expansion without breaking changes (`lessons`, `classes`, `attendance` stubbed in `database_schema.md §6`). Architecturally:

- New LMS features map to new `Application/Features/` folders and new Expo Router routes
- Shared types codegen handles new DTO schemas automatically
- RLS policies and composite FK patterns from billing are templates for LMS table isolation

### 10.4 Performance Under Load

- **Read traffic** is served by C# API endpoints with efficient query projection, filtering, and pagination.
- **JWT verification** is stateless (HMAC) — the C# API scales horizontally with no shared session state.
- **TanStack Query caching** reduces redundant API calls. Lists are loaded once per session and invalidated only on mutation.
- **RLS helper function** `get_user_org_ids()` is marked `STABLE` — result cached per transaction, preventing per-row subquery re-evaluation at scale.

### 10.5 AI-Agent Friendliness

This structure is purpose-built for AI agent consumption:

- Every feature is self-contained with consistent internal structure. An agent can add a feature by following the pattern in any existing feature folder.
- The `docs/` folder contains canonical specs. Agents must read `authentication.md` and `database_schema.md` before implementing any auth or data layer code.
- Naming conventions are explicit and consistent — an agent never guesses file locations or class names.
- The codegen script is a single command. An agent regenerates types after any backend DTO change without needing to understand the full toolchain.
- Architecture Decision Records in `docs/adr/` document the reasoning behind key decisions, giving agents the context to make consistent choices on new problems.

---

_End of TuitionIQ Project Structure — v2.0.0_
_Stack: React Expo (Web + Mobile) · C# ASP.NET Core · Supabase Auth (PostgreSQL)_
