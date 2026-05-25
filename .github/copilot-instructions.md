# TuitionIQ — AI Coding Instructions

## 0. Mandatory Pre-Read

Before writing any code, read these docs in `docs/`. Never contradict them. If unsure, ask.

| Doc                    | Covers                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| `authentication.md`    | Email+password auth, OTP, JWT, token storage, session, RLS, security        |
| `database_schema.md`   | Tables, columns, FKs, indexes, triggers, EF Core rules, money, soft deletes |
| `project_structure.md` | Monorepo layout, feature folders, naming, API routing, shared types         |

---

## 1. Current Scope (Free/Basic Plan — Teacher Only)

**In scope:** Teacher CRUD for students, fee config, fee periods, fee payments, org creation, email+password auth for teachers.

**Out of scope — do not build, stub, or hint at:**

- Student portal / student login
- Invite flows / invite token acceptance
- `students.user_id` linking (leave NULL)
- LMS: classes, lessons, attendance
- Subscriptions / billing plans
- Any student-role UI or API

If a task creeps out of scope, say so and stop.

---

## 2. Stack

| Layer          | Technology                                             |
| -------------- | ------------------------------------------------------ |
| Frontend       | React Expo (Web + Mobile unified)                      |
| Backend        | C# ASP.NET Core (.NET 10), Clean Architecture, MediatR |
| Database       | PostgreSQL via Supabase                                |
| Auth           | Supabase Auth — email + password only                  |
| ORM            | Entity Framework Core                                  |
| Frontend state | Zustand (global), TanStack Query (server state)        |
| HTTP client    | Axios with JWT interceptor                             |

---

## 3. Non-Negotiable Architecture Rules

### Data Access

- **Frontend never touches the database.** No reads, no writes. No exceptions.
- **All data goes through the C# API.** Use `apiClient` (Axios → backend) for everything.
- **Supabase client on frontend is auth-only:** `signUp`, `signInWithPassword`, `resetPasswordForEmail`, `updateUser`, `signOut`, `getSession`, `onAuthStateChange`, `startAutoRefresh`, `stopAutoRefresh`.
- **Never call `supabase.from(anyTable).select/insert/update/delete()`** from frontend. If you reach for `.from(`, write a backend endpoint instead.

### Money

- Store as `BIGINT` — whole integers (BDT Taka, no subunits/paisa).
- C# type: `long`. Never `decimal`, `double`, or `float`.
- Columns: `amount`, `fee`, `manual_fee`, `amount_paid`. No `_cents` suffix.
- Default currency: `BDT`.

### Soft Deletes

- All primary entities have `DeletedAt` (`TIMESTAMPTZ`, nullable).
- Apply `HasQueryFilter(e => e.DeletedAt == null)` on every soft-deletable entity in `AppDbContext`.
- Never hard-delete users, students, fees, periods, payments, or invites.
- `AuditLog` is insert-only — throw `InvalidOperationException` on `Modified` or `Deleted` state.

### Audit Logging

- Every significant write (student create/update/delete, fee change, payment record/reverse, waive) **must insert an `AuditLog` row in the same transaction**.
- `students.created_by` does not exist — `AuditLog` is the sole authorship record.
- Use `IAuditLogService` in commands, never in controllers.

### Security & JWT

- `Supabase:JwtSecret` and `ServiceRoleKey` live **only** in C# server config. Never in Expo env vars.
- `EXPO_PUBLIC_` vars: only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `API_BASE_URL`.
- C# middleware checks `public.users.is_active = TRUE` on every authenticated request → 403 if false.
- Also check `email_verified = TRUE` → 403 if false (except `PATCH /api/users/email-verification`).
- All financial write endpoints re-query `organization_members` for org membership — never trust JWT claims alone for write authorization.

### RLS

- RLS must be enabled on every table, including tables added in future migrations.
- Use `get_user_org_ids()` (`STABLE`) in multi-row policies — never a correlated subquery per row.

---

## 4. C# Backend Standards

### Layer Dependencies

```
Domain         → no dependencies
Application    → Domain only (no EF, no HTTP)
Infrastructure → implements Application interfaces; EF Core lives here
API            → Application only; thin controllers
```

### Controllers — Must Be Thin

```csharp
[HttpPost][Authorize]
public async Task<IActionResult> RecordPayment([FromBody] RecordPaymentRequest req)
{
    var result = await _mediator.Send(new RecordPaymentCommand(req, UserId));
    return Ok(result);
}
```

Zero business logic, zero EF queries, zero if/else rules in controllers.

### Queries

- Use `IQueryable<T>`; materialise as late as possible.
- Project to DTOs with `.Select()` **before** `.ToListAsync()` — never load full entities and map in memory.
- Apply all filters (org, soft-delete, status) inside the query.
- Never call a DB method inside a loop — rewrite as a join or batched query.

### Transactions

- All multi-step writes use `await using var tx = await _db.Database.BeginTransactionAsync()`.
- Roll back on exception; commit only on success.

### DTOs

- Every endpoint returns a DTO, never an Entity.
- DTOs are flat value objects — no navigation properties, no circular refs.
- Suffix: `Dto` for responses, `Request` for inputs.
- Location: `Application/Features/{Feature}/Dtos/`.

### Error Handling

- Use domain exceptions: `ForbiddenException`, `NotFoundException`, `ConflictException`.
- `ExceptionFilter` maps these to HTTP status codes. Never return raw 500s.

### Naming

| Artifact   | Convention                 | Example                                |
| ---------- | -------------------------- | -------------------------------------- |
| Entity     | PascalCase singular        | `Student`, `FeePeriod`                 |
| EF table   | snake_case via `ToTable()` | `.ToTable("fee_periods")`              |
| DTO        | PascalCase + suffix        | `FeePeriodDto`, `RecordPaymentRequest` |
| Command    | VerbNounCommand            | `RecordPaymentCommand`                 |
| Query      | GetNounQuery               | `GetStudentsQuery`                     |
| Controller | NounController             | `StudentsController`                   |
| Route      | kebab-case, plural nouns   | `/api/organizations/{orgId}/students`  |
| Money      | `long`, no suffix          | `amount`, `fee`, `manualFee`           |
| Interface  | `I` prefix                 | `ICurrentUserService`                  |

### Existing Code

Refactor non-compliant existing code to match these rules — do not introduce a second style.

---

## 5. Frontend Standards

### File Naming

| Artifact           | Convention              | Example                                |
| ------------------ | ----------------------- | -------------------------------------- |
| Screen / Component | PascalCase.tsx          | `StudentList.tsx`, `FeePeriodCard.tsx` |
| Hook               | camelCase, `use` prefix | `useStudents.ts`                       |
| API client service | camelCase + ApiClient   | `billingApiClient.ts`                  |
| Store              | camelCase + Store       | `authStore.ts`                         |

### State

- **Zustand:** `authStore` (session, user, emailVerified), `orgStore` (memberships, selectedOrgId).
- **TanStack Query:** all server state (lists, detail pages).
- No Context for server data. No Redux.
- Invalidate TanStack Query caches on mutations — don't blanket refetch.

### API Client

- All data fetching/writing uses `src/lib/apiClient.ts` (Axios → C# backend).
- `supabase` singleton is auth-only (see §3 Data Access rules).
- Feature API clients import `apiClient` — never create a new Axios instance.

### TypeScript

- No `any`. ESLint rule `@typescript-eslint/no-explicit-any` = `error`.
- Import types from `@tuitioniq/types` (generated). Never hand-write a type that mirrors a backend DTO.
- After any backend DTO change, run `./scripts/codegen-types.sh` before committing.

### Currency

- Always use `formatCurrency(amount, currency)` from `src/shared/utils/formatCurrency.ts`.
- Never inline-format currency. Never divide by 100 — values are whole integers.

### Environment Variables

```bash
# Allowed in frontend .env
EXPO_PUBLIC_SUPABASE_URL=...      # auth client init only
EXPO_PUBLIC_SUPABASE_ANON_KEY=... # auth client init only
EXPO_PUBLIC_API_BASE_URL=...      # all data requests

# NEVER in frontend .env — causes immediate secret rotation
SUPABASE_JWT_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 6. Database / Migration Rules

- All schema changes go through EF Core migrations. Never edit the DB directly.
- Composite FKs (e.g. `(organization_id, teacher_id) → organization_members`) must use raw `migrationBuilder.Sql(...)` — EF cannot express them natively.
- Every new table migration must register the `updated_at` trigger (see `database_schema.md §8.1`).
- Partial indexes on soft-deletable tables must include `WHERE deleted_at IS NULL`.
- Migration naming: `YYYYMMDDHHMMSS_ShortDescription`.

---

## 7. Ask vs Proceed

**Always ask before proceeding:**

- Task touches auth, JWT, or Supabase session handling
- Task involves a financial write (payments, fee config, waiving)
- Task requires a DB migration
- Existing code contradicts these instructions
- Required design is not covered by the three docs
- You would need `any` to complete a TypeScript task

**Proceed without asking:**

- Simple CRUD following an established pattern
- New screen mirroring an existing screen's structure
- UI component with no business logic

---

## 8. Definition of Clean Code

**A clean handler:**

1. Validates caller permissions by querying the DB (not JWT claims)
2. Executes all writes in a single transaction
3. Writes an `AuditLog` row in the same transaction
4. Returns a DTO, never an Entity
5. Contains zero UI or presentation logic

**A clean component:**

1. Has no business logic — calls a hook and renders
2. Uses generated types for all API data
3. Handles loading, error, and empty states explicitly
4. Fetches all data through `apiClient` — never through the Supabase client
