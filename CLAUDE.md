# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mandatory pre-read

`docs/` holds the source-of-truth architecture docs. Read the relevant one before writing code and never contradict it: `authentication.md` (auth, OTP, JWT, session, RLS), `database_schema.md` (tables, FKs, triggers, EF rules, money, soft deletes), and `project_structure.md` (monorepo layout, feature folders, naming, routing, shared types). `.github/copilot-instructions.md` additionally holds product-scope boundaries and an "ask vs proceed" checklist that are not repeated here.

Two rules in `.github/copilot-instructions.md` are stale; this file reflects the current code:

- JWT is validated via Supabase **OIDC/JWKS** using `Supabase:ProjectRef` (see `Api/Extensions/JwtExtensions.cs`). There is no `Supabase:JwtSecret` — shared-secret validation was removed.
- Shared API types are **hand-maintained** in `frontend/src/types/tuitioniq-types.d.ts`. There is no `scripts/codegen-types.sh`; OpenAPI-based codegen is future work.

## Repository layout

Monorepo with two independently-run apps plus shared docs:

- `backend/` — ASP.NET Core API (.NET 10), Clean Architecture, solution file `TuitionIQ.slnx`.
- `frontend/` — Expo SDK 54 app (React Native + Expo Router), one codebase for web and mobile.
- `docs/` — architecture source of truth. `archives/` is legacy prototype code — ignore it.

There is **no root `package.json`**. Backend and frontend are built, run, and tested separately (the README's `npm run dev` is stale).

## Commands

Backend (from repo root):

```bash
dotnet build backend/TuitionIQ.slnx
dotnet run --project backend/src/TuitionIQ.Api/TuitionIQ.Api.csproj   # listens on http://0.0.0.0:5000
dotnet test backend/TuitionIQ.slnx                                    # all tests
dotnet test backend/tests/TuitionIQ.UnitTests                        # one project
dotnet test backend/TuitionIQ.slnx --filter "FullyQualifiedName~RecordPayment"   # single test / subset (also DisplayName~, Category=)
```

EF Core migrations run against the Api startup project:

```bash
dotnet ef migrations add <Name> --project backend/src/TuitionIQ.Infrastructure --startup-project backend/src/TuitionIQ.Api
dotnet ef database update       --project backend/src/TuitionIQ.Infrastructure --startup-project backend/src/TuitionIQ.Api
```

Frontend (from `frontend/`):

```bash
npm install
npm run web            # or: npm run ios | npm run android | npm run start
npm run lint           # Expo ESLint
```

`TuitionIQ.IntegrationTests` starts PostgreSQL via Testcontainers, so a running Docker daemon is required for the integration suite. Unit tests use xUnit; architecture tests use NetArchTest.

Config comes from environment variables or user-secrets. Backend: `ConnectionStrings:DefaultConnection`, `Supabase:ProjectRef`, `Supabase:ServiceRoleKey`, `App:AllowedOrigins`. Frontend: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL` (copy `frontend/.env.example`).

## Backend architecture

Clean Architecture across four projects with strict one-way dependencies:

```
Domain         → nothing
Application    → Domain only (no EF, no HTTP)
Infrastructure → implements Application interfaces; all EF Core lives here
Api            → Application only; thin controllers
```

`TuitionIQ.ArchitectureTests` (NetArchTest) enforces these boundaries, so a violating dependency fails the test run — keep dependencies pointing inward.

Request flow: a thin controller calls `_mediator.Send(command/query)`, dispatching to a MediatR handler under `Application/Features/{Feature}/`. Controllers hold zero business logic, zero EF queries, and zero if/else rules. FluentValidation runs automatically through `ValidationBehavior<,>`, registered as an `IPipelineBehavior` in `Program.cs` — add a validator class rather than validating inline in a handler.

Middleware order in `Program.cs` is deliberate: `ExceptionHandlingMiddleware` → CORS → `OriginValidationMiddleware` → `UseAuthentication` (validates the Supabase JWT) → `UserActiveCheckMiddleware` → `UseAuthorization` → controllers. `UserActiveCheckMiddleware` re-queries `public.users` on each authenticated request and returns 403 unless both `is_active` and `email_verified` are true (the email-verification endpoint is exempt so unverified users can verify); it also bootstraps the internal user row on the first authenticated call.

Features are the four MediatR slices `Users`, `Organizations`, `Students`, and `Billing`. Domain entities are `User`, `Organization`, `OrganizationMember`, `Student`, `TeacherStudent`, `StudentFee`, `FeePeriod`, `FeePayment`, and `AuditLog`. The EF context, entity configurations, migrations, and `AuditLogService` live in `Infrastructure/Persistence`.

## Non-negotiable technical rules

**Data access.** The frontend never touches the database — no reads, no writes, ever. All business data flows through the C# API via `apiClient` (Axios). The Supabase client is auth-only: `signUp`, `signInWithPassword`, `resetPasswordForEmail`, `updateUser`, `signOut`, `getSession`, `onAuthStateChange`, `startAutoRefresh`, `stopAutoRefresh`. If you reach for `supabase.from(...)` on the frontend, write a backend endpoint instead.

**Money.** Stored as `BIGINT`, C# type `long` — whole BDT Taka, no subunits. Never `decimal`, `double`, or `float`; no `_cents` suffix. Columns are `amount`, `fee`, `manual_fee`, `amount_paid`. On the frontend, format only through `formatCurrency` in `src/shared/utils/formatCurrency.ts` — never inline-format and never divide by 100.

**Soft deletes.** Primary entities carry a nullable `DeletedAt` (`TIMESTAMPTZ`) with a `HasQueryFilter(e => e.DeletedAt == null)` in `AppDbContext`. Never hard-delete users, students, fees, periods, or payments. `AuditLog` is insert-only and throws on `Modified`/`Deleted` entity states.

**Audit logging.** Every significant write (student create/update/delete, fee change, payment record/reverse, waive) must insert an `AuditLog` row inside the same transaction via `IAuditLogService`, called from handlers and never from controllers. There is no `students.created_by` column — `AuditLog` is the sole record of authorship.

**Authorization.** Never trust JWT claims for write authorization; financial and other write handlers re-query org membership (`OrganizationAuthorizationService`) before mutating. Multi-step writes run in a single transaction (`BeginTransactionAsync`), rolling back on exception and committing only on success.

**Queries and DTOs.** Build with `IQueryable<T>` and project to a DTO with `.Select()` before `.ToListAsync()` — never load full entities and map in memory. Apply every filter (org, soft-delete, status) inside the query, and never call the DB inside a loop. Each endpoint returns a flat DTO, never an entity (no navigation properties, no cycles). Throw `ForbiddenException`, `NotFoundException`, or `ConflictException`; `ExceptionHandlingMiddleware` maps them to HTTP status codes, so never return a raw 500.

**Migrations.** All schema changes go through EF Core migrations — never edit the database directly. Composite FKs require raw `migrationBuilder.Sql(...)` (EF can't express them). New tables register the `updated_at` trigger, and partial indexes on soft-deletable tables include `WHERE deleted_at IS NULL`. RLS stays enabled on every table; multi-row policies use `get_user_org_ids()` rather than a per-row correlated subquery.

**Secrets.** `Supabase:ServiceRoleKey` and connection strings live only in backend config. Frontend `EXPO_PUBLIC_*` values are public by design — never place a service-role key or database credential there.

## Backend naming

| Artifact   | Convention                 | Example                                |
| ---------- | -------------------------- | -------------------------------------- |
| Entity     | PascalCase singular        | `Student`, `FeePeriod`                 |
| EF table   | snake_case via `ToTable()` | `.ToTable("fee_periods")`              |
| DTO        | PascalCase + `Dto`/`Request` | `FeePeriodDto`, `RecordPaymentRequest` |
| Command    | VerbNounCommand            | `RecordPaymentCommand`                 |
| Query      | GetNounQuery               | `GetStudentsQuery`                     |
| Controller | NounController             | `StudentsController`                   |
| Route      | kebab-case, plural nouns   | `/api/organizations/{orgId}/students`  |
| Interface  | `I` prefix                 | `ICurrentUserService`                  |

## Frontend architecture

Expo Router provides file-based routing in `frontend/app/`, grouped by access level: `(auth)` (login/signup/reset), `(verify)` (post-login OTP gate), and `(app)` (protected: `organizations`, `billing`, `settings`, `(teacher)`). The Supabase session is bootstrapped in the root layout, and an Axios request interceptor injects the access token into every API call.

State is split by kind. Zustand holds global client state — `authStore` (session, user, emailVerified), `orgStore` (memberships, selectedOrgId), and `uiStore`. TanStack Query owns all server state; invalidate the relevant query keys on a mutation rather than blanket-refetching. No React Context for server data, and no Redux.

The data layer lives in `src/lib/`: `apiClient.ts` is the single Axios instance pointed at the backend, `supabase.ts` is the auth-only singleton, and `queryClient.ts` configures TanStack Query. Feature API clients import `apiClient` — never create another Axios instance. Feature code sits under `src/features/{auth,users,organizations,students,billing}`, with cross-cutting helpers in `src/shared/`.

TypeScript is strict about `any`: `@typescript-eslint/no-explicit-any` is an error. Import API types from `@tuitioniq/types` (the hand-maintained `src/types/tuitioniq-types.d.ts`) and update that file by hand whenever a backend DTO changes. Components render from a hook and handle loading, error, and empty states explicitly — keep business logic in hooks, not components.

Frontend naming: screens and components are `PascalCase.tsx`, hooks are `useThing.ts`, API services are `thingApiClient.ts`, and stores are `thingStore.ts`.
