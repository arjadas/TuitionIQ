# TuitionIQ — Copilot & AI Coding Instructions
> This file governs ALL code generation in this repository.
> Read it fully before writing a single line. If you skip it, you will break the architecture.

---

## 0. Before You Write Anything — Mandatory Reads

Before generating ANY code in this repository, you MUST read the following source-of-truth documents.
They live in `docs/`. Never contradict them. If you are unsure, ASK.

| Document | What it defines |
|---|---|
| `docs/authentication.md` | Auth system, magic link flow, JWT validation, token storage, session management, RLS, security patterns |
| `docs/database_schema.md` | Every table, column, FK, index, trigger, EF Core notes, money storage rules, soft-delete rules |
| `docs/project_structure.md` | Monorepo layout, feature folder conventions, naming rules, API routing, shared types strategy |

**If you are unsure about any architectural decision — STOP and ask a clarifying question.**
Do not guess. Do not hallucinate a design. Ask.

---

## 1. Scope — What We Are Building Now (Free / Basic Plan)

**In scope:** Teachers creating and managing student records, fee configuration, fee periods, fee payments, org creation, magic link auth for teachers only.

**Out of scope (do not build, do not stub, do not hint at):**
- Student portal / student login flows
- Invite flows (student invite tokens, invite acceptance)
- `students.user_id` linking (stays NULL; do not populate it)
- LMS features: classes, lessons, attendance, class billing
- Subscriptions / billing plans
- Any UI or API for the student role

If a task creeps into out-of-scope territory, say so and stop.

---

## 2. Stack

| Layer | Technology |
|---|---|
| Frontend | React Expo (Web + Mobile unified codebase) |
| Backend | C# ASP.NET Core (.NET 8), Clean Architecture, MediatR |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth — passwordless magic link ONLY. No passwords anywhere. |
| ORM | Entity Framework Core |
| State (frontend) | Zustand (global), TanStack Query (server state) |
| HTTP client (frontend) | Axios with JWT interceptor |

---

## 3. Non-Negotiable Architecture Rules

Break any of these and the PR is rejected.

### 3.1 Separation of Concerns
- **Frontend NEVER talks to the database directly** — not for reads, not for writes. No exceptions.
- **ALL data reads and writes go through the C# ASP.NET Core API.** Student lists, fee periods, user profile, org memberships — everything is fetched via `apiClient` hitting a backend endpoint.
- The **Supabase client on the frontend is used exclusively for authentication operations**: `signInWithOtp`, `exchangeCodeForSession`, `signOut`, `getSession`, `onAuthStateChange`, `startAutoRefresh`, `stopAutoRefresh`. It is never used to query data tables.
- **C# API** owns all data access: it validates the JWT, enforces authorisation, queries the database via EF Core, and returns DTOs. The frontend is a pure consumer of those DTOs.
- Never call `supabase.from(anyTable).select/insert/update/delete()` from frontend code. If you find yourself typing `.from(`, stop and write a backend endpoint instead.

### 3.2 Money Storage
- All money values are stored as `BIGINT` (whole integers — BDT Taka, no paisa/subunits).
- C# type: `long`. Never `decimal`, never `double`, never `float`.
- Column names: `amount`, `fee`, `manual_fee`, `amount_paid` — no `_cents` suffix.
- Default currency: `BDT`.

### 3.3 Soft Deletes
- All primary entities have `DeletedAt` (`TIMESTAMPTZ`, nullable).
- EF Core: apply `HasQueryFilter(e => e.DeletedAt == null)` on every soft-deletable entity in `AppDbContext`.
- Never hard-delete users, students, fees, periods, payments, or invites.
- `AuditLog` is insert-only. Throw `InvalidOperationException` if it enters `Modified` or `Deleted` state.

### 3.4 Audit Logging
- Every significant write (student create/update/delete, fee create/change, payment record/reverse, waive period) MUST insert an `AuditLog` row **in the same transaction**.
- Since `students.created_by` does not exist, `AuditLog` is the only record of authorship.
- Implement `IAuditLogService` and call it within commands, not in controllers.

### 3.5 JWT and Security
- JWT secret lives ONLY in C# server config (`Supabase:JwtSecret`). Never in Expo env vars.
- Service role key lives ONLY in C# server config. Never in Expo env vars.
- `EXPO_PUBLIC_` prefix only for: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `API_BASE_URL`.
- C# middleware checks `public.users.is_active = TRUE` on every authenticated request → 403 if false.
- All financial write endpoints re-query `organization_members` to verify org membership — never trust JWT claims alone for authorization writes.

### 3.6 RLS
- RLS MUST be enabled on every table. New tables added later must include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in the migration.
- Use the `get_user_org_ids()` STABLE function in multi-row RLS policies — never a correlated subquery per row.

---

## 4. C# Backend — Coding Standards

### 4.1 Project Layer Rules
```
Domain       → No dependencies on other layers. Pure business rules.
Application  → Depends on Domain only. Interfaces only (no EF, no HTTP).
Infrastructure → Implements Application interfaces. EF Core lives here.
API          → Depends on Application. Thin controllers only.
```

### 4.2 Controller Rule
Controllers must be THIN. This is the ONLY acceptable pattern:
```csharp
[HttpPost]
[Authorize]
public async Task<IActionResult> RecordPayment([FromBody] RecordPaymentRequest req)
{
    var result = await _mediator.Send(new RecordPaymentCommand(req, UserId));
    return Ok(result);
}
```
Zero business logic in controllers. No EF queries in controllers. No if/else business rules in controllers.

### 4.3 IQueryable — Database Query Rules
- Always use `IQueryable<T>` for building queries; materialise with `.ToListAsync()` or `.FirstOrDefaultAsync()` as late as possible.
- Use `.Select()` to project to DTOs **before** materialising — never load full entities and map in memory.
- Apply filters (org, soft-delete, status) in the query, not after ToList.
- **NEVER load a collection navigation property and then filter in C# — that is an N+1 query.**

```csharp
// CORRECT — single query, projected to DTO
var students = await _db.Students
    .Where(s => s.OrganizationId == orgId)
    .Select(s => new StudentSummaryDto
    {
        Id        = s.Id,
        FirstName = s.FirstName,
        LastName  = s.LastName,
        Status    = s.Status,
    })
    .ToListAsync(cancellationToken);

// WRONG — loads all columns then maps in memory
var students = await _db.Students
    .Where(s => s.OrganizationId == orgId)
    .ToListAsync();
var dtos = students.Select(s => new StudentSummaryDto { ... }).ToList();
```

### 4.4 DTOs
- Every public endpoint returns a DTO, never an Entity.
- DTOs are flat value objects — no navigation properties, no circular references.
- Suffix: `Dto` for responses, `Request` for input bodies.
- Keep DTOs in `Application/Features/{Feature}/Dtos/`.

### 4.5 Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Entity | PascalCase singular | `Student`, `FeePeriod` |
| EF table mapping | snake_case via `ToTable()` | `.ToTable("fee_periods")` |
| DTO | PascalCase + suffix | `FeePeriodDto`, `RecordPaymentRequest` |
| Command | VerbNounCommand | `RecordPaymentCommand` |
| Query | GetNounQuery | `GetStudentsQuery` |
| Controller | NounController | `StudentsController` |
| Route | kebab-case, plural nouns | `/api/organizations/{orgId}/students` |
| Money fields | `long` only, no underscore suffix | `amount`, `fee`, `manualFee` |
| Interface prefix | `I` prefix | `ICurrentUserService` |

### 4.6 Avoiding N+1 Queries
- Use `.Include()` / `.ThenInclude()` only when the related data is **always** needed.
- Prefer explicit `.Select()` projections over `.Include()` for list views.
- For aggregate data (e.g. total paid per student), use `.Sum()` inside the query projection, not after materialisation.
- If you find yourself calling a DB method inside a loop, stop. Rewrite as a join or a batched query.

### 4.7 Transactions
- All multi-step writes (close old fee, open new fee; record payment + update period + write audit log) MUST execute inside a single `await using var tx = await _db.Database.BeginTransactionAsync()`.
- Roll back on exception. Commit only on success.

### 4.8 Error Handling
- Use domain exception classes: `ForbiddenException`, `NotFoundException`, `ConflictException`.
- `ExceptionFilter` in the API layer maps these to HTTP status codes.
- Never return raw 500 errors to the client.

### 4.9 Existing Code
- If existing code in the codebase does something differently from these rules, **refactor it** to match — do not introduce a second style.
- If existing naming does not match the conventions in `docs/project_structure.md`, rename it. Consistency is mandatory.

---

## 5. Frontend — Coding Standards

### 5.1 File Naming

| Artifact | Convention | Example |
|---|---|---|
| Screen | PascalCase.tsx | `StudentList.tsx` |
| Component | PascalCase.tsx | `FeePeriodCard.tsx` |
| Hook | camelCase prefixed `use` | `useStudents.ts` |
| API client service | camelCase + ApiClient | `billingApiClient.ts` |
| Store | camelCase + Store | `authStore.ts` |

### 5.2 State Rules
- **Zustand** for global state: `authStore` (session, user), `orgStore` (memberships, selectedOrgId).
- **TanStack Query** for all server state: student lists, fee periods, payment history.
- No Context for server data. No Redux. No global mutable objects.
- Invalidate TanStack Query caches on mutations — don't just refetch everything.

### 5.3 API Client Rules
- **All data fetching (reads and writes) goes through `src/lib/apiClient.ts`** — the Axios instance with the JWT interceptor pointing at the C# backend.
- The `supabase` singleton in `src/lib/supabase.ts` is used **only for auth operations**: sending magic links, exchanging codes for sessions, signing out, reading the current session, subscribing to auth state changes, and controlling auto-refresh. Nothing else.
- Never call `supabase.from(anyTable).select()` or any PostgREST data method. Data comes from the C# API.
- Feature API client services (e.g. `billingApiClient.ts`) import `apiClient` — never create a new Axios instance.
- Never call `supabase.from(table).insert/update/delete()` from frontend code. That is the C# API's job.

### 5.4 TypeScript
- No `any`. ESLint rule `@typescript-eslint/no-explicit-any` is set to `error`.
- Import types from `@tuitioniq/types` (generated from C# OpenAPI spec). Never hand-write a type that mirrors a backend DTO.
- After any backend DTO change, run `./scripts/codegen-types.sh` before committing.

### 5.5 Currency Display
- Always use `formatCurrency(amount, currency)` from `src/shared/utils/formatCurrency.ts`.
- Never inline format a currency value. Never divide by 100 (there are no subunits — values are whole integers).

### 5.6 Environment Variables
```bash
# ALLOWED in frontend .env:
EXPO_PUBLIC_SUPABASE_URL=...       # auth client only — NOT for data queries
EXPO_PUBLIC_SUPABASE_ANON_KEY=...  # auth client only — NOT for data queries
EXPO_PUBLIC_API_BASE_URL=...       # all data requests go here

# NEVER in frontend .env (will cause immediate secret rotation):
SUPABASE_JWT_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are present solely to initialise the Supabase Auth client for magic link and session operations. They must never be used to open a PostgREST data channel from the frontend.

---

## 6. Database — Migration and Trigger Rules

- All schema changes go through EF Core migrations. Never hand-edit the database directly.
- Composite FKs (e.g. `(organization_id, teacher_id) → organization_members`) must be added in raw `migrationBuilder.Sql(...)` calls — EF cannot express them natively.
- Every migration must include the `updated_at` trigger registration for any new table (see `database_schema.md §8.1`).
- Partial indexes on soft-deletable tables must include `WHERE deleted_at IS NULL`.
- Migration naming: `YYYYMMDDHHMMSS_ShortDescription`.

---

## 7. When to Ask vs When to Proceed

**Always ask before proceeding if:**
- The task touches auth, JWT, or Supabase session handling.
- The task involves a financial write (payments, fee config, period waiving).
- The task requires a database migration.
- The existing code contradicts these instructions.
- The required design is not clearly specified by the three docs.
- You would need to use `any` to complete a TypeScript task.

**Proceed without asking if:**
- The task is a simple CRUD feature that follows an already-established pattern in the codebase.
- The task is adding a new screen that mirrors an existing screen's structure.
- The task is a UI component with no business logic.

---

## 8. What Clean Code Looks Like in This Project

A handler is clean when it:
1. Validates the caller's permissions by querying the DB (not trusting JWT claims).
2. Does the work inside a transaction if there are multiple writes.
3. Writes an AuditLog row in the same transaction.
4. Returns a DTO, never an Entity.
5. Has zero UI logic, zero presentation concerns.

A component is clean when it:
1. Has no business logic — it calls a hook and renders.
2. Uses generated types for all API data.
3. Handles loading, error, and empty states explicitly.
4. Fetches all data through `apiClient` (C# backend) — never through the Supabase client.

---

*Version: aligned with authentication.md v1.2 · database_schema.md v1.5.0 · project_structure.md v1.0*
*Scope: Free/Basic plan (teacher-only, no student portal, no LMS)*
