# TuitionIQ — Database Schema

> **Purpose:** This document defines the complete PostgreSQL database schema for TuitionIQ.
> It is intended to be consumed by an AI agent to auto-generate migrations, C# Entity Framework models, and API structures.
> **Database:** PostgreSQL (Supabase)
> **ORM Target:** Entity Framework Core (C# / ASP.NET Core)
> **Auth Provider:** Supabase Auth (email + password — no passwordless magic links anywhere in the system)
> **Convention:** snake_case table and column names, UUID primary keys, soft deletes where appropriate.
> **Version:** v2.0.0

---

## 1. Database Overview

### Architecture Pattern

TuitionIQ uses a **shared-database, shared-schema** multi-tenant architecture. Every table belonging to
tenant-scoped data carries an `organization_id` foreign key. Row-Level Security (RLS) is applied at the
PostgreSQL level as the primary runtime safety layer.

### Tenancy Model

- An **Organization** is the root tenant boundary. **Any authenticated user** may create an Organization;
  the creator automatically becomes its `owner`. There is no restriction on who may create an
  organisation — the owner role is purely a function of who created the workspace.
- All student, admin, and content data is scoped to an Organization.
- Roles are not a property of a user account. They are a property of the relationship between a user and
  an organisation, stored in `organization_members.role`. A single user may be an `owner` in one org,
  a `teacher` in another, and a `student` in a third — simultaneously.
- Global/platform tables (e.g., `users`, `organizations`) are shared across tenants; all content tables
  are tenant-scoped.
- **Tenant isolation is enforced at the database level** via composite foreign keys wherever a
  relationship joins two tenant-scoped records. This prevents cross-organization data leakage even if
  the application layer has a bug. See Section 11.5 for the full strategy.

### Authentication

- Authentication is delegated entirely to **Supabase Auth** (GoTrue), using **email and password
  only**. No passwordless flows, magic links, or OTP login mechanisms are used. This applies to all
  user types: teachers, admins, and students.
- Supabase manages `auth.users` internally, including bcrypt password hashing. The `public.users`
  table is TuitionIQ's canonical identity record, populated automatically via a database trigger on
  the user's first registration via `signUp()`.
- The `auth_user_id` column in `public.users` stores the Supabase Auth UUID (`auth.users.id`), used
  as the bridge between the two schemas.
- **Any person may register independently** by completing the Sign Up form (first name, last name,
  email, password). Supabase creates an `auth.users` record and returns a session immediately. The
  DB trigger fires and creates the `public.users` row with the name fields populated from the signup
  metadata. At that point the user has no org memberships and sees a welcome screen prompting them
  to create an organisation or wait for an invite.
- **Post-login email OTP verification:** After every user's **first successful login**, before full
  application access is granted, the app sends a one-time OTP code to the user's email address and
  requires the user to submit it. This is an identity confirmation step, not a recurring authentication
  factor. The `email_verified` column in `public.users` tracks whether a user has completed this step.
  It is initialized to `FALSE` on user creation and set to `TRUE` by the C# API after successful OTP
  confirmation. Unverified users (`email_verified = FALSE`) are denied access to all protected API
  endpoints by the C# middleware layer.
- **Students may authenticate before or after a teacher creates a pseudo-student record for them.**
  The two records are linked at invite acceptance via an email lookup. See Section 11.1.

### Money Storage

All fee and payment amounts are stored as **integers representing whole currency units** (e.g., whole
Taka for BDT). Fractional subunits (paisa, cents) are not used or supported. Application code must treat
these values as integers at all times. The column names `fee`, `amount`, `amount_paid`, and
`manual_fee` reflect this: they are plain integers, not cent-offset amounts.

### Soft Deletes

Soft deletes (`deleted_at TIMESTAMPTZ`) are applied to all primary entities:
`users`, `organizations`, `students`, `invites`, `student_fees`, `fee_periods`, `fee_payments`

Hard deletes are used for pure join/pivot tables (e.g., `organization_members`, `teacher_students`).

**Soft delete safety rules (applied consistently across all tables):**

1. All partial indexes on soft-deletable tables include `WHERE deleted_at IS NULL`.
2. Application layer MUST verify `deleted_at IS NULL` on parent records before inserting child rows.
3. A PostgreSQL trigger validates that `students.deleted_at IS NULL` before any insert into
   `teacher_students`, `student_fees`, `fee_periods`, or `fee_payments` (see Section 8.3).
4. `organization_members` and `teacher_students` use hard deletes and therefore cannot be soft-deleted;
   their absence is the canonical signal that the relationship no longer exists.

---

## 2. Entity List

| Entity               | Table Name             | Status  | Description                                                                                                                                                                                        |
| -------------------- | ---------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User                 | `users`                | Active  | Universal identity record for any authenticated person. Populated on first `signUp()` via a DB trigger. Roles are per-org, not per-account. Includes `email_verified` for OTP verification status. |
| Organization         | `organizations`        | Active  | The root tenant/workspace. Created by any user who becomes its `owner`.                                                                                                                            |
| Organization Member  | `organization_members` | Active  | Join table linking users to organizations with a role. Central RBAC anchor and composite FK target. A user may appear in this table multiple times — once per organisation they belong to.         |
| Student              | `students`             | Updated | A student record scoped to an organization. Carries `account_status` lifecycle. `user_id` is unique per-org (not platform-wide) to support multi-org student participation.                        |
| Teacher–Student Link | `teacher_students`     | Active  | Explicit many-to-many between a teacher and a student. Uses composite FKs to enforce same-org membership.                                                                                          |
| Invite               | `invites`              | Active  | Tokenized email invite. `invited_by` uses a composite FK to `organization_members` to ensure the sender is an org member.                                                                          |
| Student Fee Config   | `student_fees`         | Active  | Fee configuration per student. Composite FKs enforce same-org tenant isolation for both the student and the setter.                                                                                |
| Fee Period           | `fee_periods`          | Active  | Monthly billing period snapshot. Composite FK enforces tenant isolation on `student_id`.                                                                                                           |
| Fee Payment          | `fee_payments`         | Active  | Individual payment ledger entry. Composite FKs enforce tenant isolation on both `student_id` and `recorded_by`.                                                                                    |
| Audit Log            | `audit_logs`           | Active  | Append-only log of significant data mutations for compliance and debugging.                                                                                                                        |

> **Future entities (stubbed in Section 6):** `subscriptions`, `classes`, `class_students`, `lessons`, `attendance`

---

## 3. Entity Relationship Diagram

```
public.users  ← auth_user_id (Supabase Auth UUID)
│   Populated on first signUp() via DB trigger.
│   email_verified = FALSE until post-login OTP verification is completed.
│   Any user may create an organisation (becomes owner) or join one via invite.
│   Roles exist only in organization_members — not on the users record itself.
│   No password column — credentials managed entirely by Supabase Auth.
│
└── organization_members (role: owner | admin | teacher | student)
        UNIQUE(organization_id, user_id)  ← composite FK target for all tenant-member checks
        A single users row may appear N times — once per org membership.
        │
        └── organizations
                │
                ├── [members with role: teacher/owner]  create/manage ──► students
                │                                                            ├── teacher_students  (composite FK)
                │                                                            ├── student_fees      (composite FK)
                │                                                            └── fee_periods       (composite FK)
                │                                                                  └── fee_payments (composite FK)
                └── [members with role: admin]  manage ──► students (via teacher_students, composite FK)

students  (org-scoped)
│   UNIQUE(organization_id, id)      ← composite FK target for all student-child tables
│   UNIQUE(organization_id, user_id) ← per-org uniqueness; same user may be a student
│                                       in multiple orgs (one students row per org)
│   account_status: no_account → invite_pending → active
│   user_id: NULL ──────────────────────────────► users
│            Populated via invite-first OR self-register-first path (see Section 11.1)
├── teacher_students
├── student_fees         (1:many — rate history; 1 active at a time)
└── fee_periods          (1:many — one per calendar month)
      └── fee_payments   (1:many — individual payment events per period)

invites  (org-scoped, role: admin | teacher | student)
│   invited_by: composite FK → organization_members(organization_id, user_id)
└── student_id (nullable pre-link to students for portal invites)
```

**Cardinalities:**

- `organizations` → `organization_members` : **1 : N**
- `users` → `organization_members` : **1 : N** (one user, many org memberships)
- `organizations` → `students` : **1 : N**
- `users` (teacher) → `teacher_students` : **1 : N**
- `students` → `teacher_students` : **1 : N**
- `organizations` → `invites` : **1 : N**
- `students` → `student_fees` : **1 : N** (one active; many historical)
- `students` → `fee_periods` : **1 : N** (one record per calendar month)
- `fee_periods` → `fee_payments` : **1 : N** (multiple payments per period)
- `users` → `students` : **1 : N** (one user may be linked as a student in N orgs)

---

## 4. Table Definitions

---

### 4.1 `users`

> Canonical identity for any human actor in the system. Authentication is handled entirely by Supabase
> Auth (email + password). This table is TuitionIQ's internal profile record; it is never used
> for authentication directly. A `users` row is created automatically on first `signUp()` via the
> `after_auth_user_created` trigger (see Section 8.4). Roles are assigned per-organisation via
> `organization_members` — never stored here.
>
> **Auth provider is fixed as Supabase.** `auth_user_id` stores the Supabase Auth UUID
> (`auth.users.id`). There is no `auth_provider` column because only one provider is used. There
> is no password column — credentials are managed entirely by Supabase Auth.
>
> **email_verified:** Tracks whether the user has completed the mandatory post-login email OTP
> verification step. Set to `FALSE` by the creation trigger. Set to `TRUE` by the C# API
> (`PATCH /api/users/email-verification`) after the client successfully calls
> `supabase.auth.verifyOtp()`. The C# middleware blocks all protected endpoint access for users
> where `email_verified = FALSE`.

| Column           | Type           | Constraints                   | Description                                                                                                         |
| ---------------- | -------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`             | `UUID`         | PK, DEFAULT gen_random_uuid() | Internal primary key. Set to match `auth.users.id` so that `auth.uid()` resolves directly without a join.           |
| `auth_user_id`   | `VARCHAR(255)` | NOT NULL, UNIQUE              | Supabase Auth UUID (`auth.users.id`). Used to link the two schemas.                                                 |
| `email`          | `VARCHAR(255)` | NOT NULL, UNIQUE              | Authentication email, kept in sync with `auth.users.email`. Distinct from `students.email` — see Section 11.1.      |
| `first_name`     | `VARCHAR(100)` | NOT NULL                      | Given name. Populated at registration from `signUp()` metadata via the trigger.                                     |
| `last_name`      | `VARCHAR(100)` | NOT NULL                      | Family name. Populated at registration from `signUp()` metadata via the trigger.                                    |
| `phone`          | `VARCHAR(30)`  | NULLABLE                      | User's personal contact phone number. Collected during sign-up (optional).                                          |
| `avatar_url`     | `TEXT`         | NULLABLE                      | URL to profile picture.                                                                                             |
| `email_verified` | `BOOLEAN`      | NOT NULL, DEFAULT FALSE       | Whether the user has completed post-login email OTP verification. Set by C# API only; never by the client directly. |
| `is_active`      | `BOOLEAN`      | NOT NULL, DEFAULT TRUE        | Global account enabled flag. Setting FALSE blocks RLS-protected reads and C# API access.                            |
| `created_at`     | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()       | Record creation timestamp.                                                                                          |
| `updated_at`     | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()       | Last update timestamp.                                                                                              |
| `deleted_at`     | `TIMESTAMPTZ`  | NULLABLE                      | Soft delete timestamp. See Section 1 for soft-delete safety rules and the three-layer ban process.                  |

**Primary Key:** `id`
**Unique Constraints:** `auth_user_id`, `email`
**Indexes:**

```sql
CREATE UNIQUE INDEX idx_users_auth_user_id ON users (auth_user_id);
CREATE UNIQUE INDEX idx_users_email            ON users (email)            WHERE deleted_at IS NULL;
CREATE INDEX        idx_users_email_verified   ON users (email_verified)   WHERE deleted_at IS NULL;
CREATE INDEX        idx_users_deleted_at       ON users (deleted_at);
```

---

### 4.2 `organizations`

> The root tenant/workspace. Created by any authenticated user, who automatically becomes the `owner`.
> There is no restriction on who may create an organisation — any user who has completed registration,
> email OTP verification, and profile setup can do so.

| Column            | Type           | Constraints                   | Description                                            |
| ----------------- | -------------- | ----------------------------- | ------------------------------------------------------ |
| `id`              | `UUID`         | PK, DEFAULT gen_random_uuid() | Internal primary key.                                  |
| `name`            | `VARCHAR(255)` | NOT NULL                      | Display name for the workspace/school.                 |
| `slug`            | `VARCHAR(100)` | NOT NULL, UNIQUE              | URL-safe identifier (e.g. `'smiths-tutoring'`).        |
| `owner_id`        | `UUID`         | NOT NULL, FK → users(id)      | The user who created and owns this organization.       |
| `plan`            | `VARCHAR(50)`  | NOT NULL, DEFAULT `'free'`    | Billing plan stub (`'free'`, `'pro'`, `'enterprise'`). |
| `plan_expires_at` | `TIMESTAMPTZ`  | NULLABLE                      | Expiry for paid plan (null = no expiry / free).        |
| `settings`        | `JSONB`        | NULLABLE, DEFAULT `'{}'`      | Flexible org-level settings bag.                       |
| `created_at`      | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()       | Record creation timestamp.                             |
| `updated_at`      | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()       | Last update timestamp.                                 |
| `deleted_at`      | `TIMESTAMPTZ`  | NULLABLE                      | Soft delete timestamp.                                 |

**Primary Key:** `id`
**Foreign Keys:** `owner_id → users(id) ON DELETE RESTRICT`
**Unique Constraints:** `slug`
**Indexes:**

```sql
CREATE UNIQUE INDEX idx_organizations_slug       ON organizations (slug)     WHERE deleted_at IS NULL;
CREATE INDEX        idx_organizations_owner_id   ON organizations (owner_id);
CREATE INDEX        idx_organizations_deleted_at ON organizations (deleted_at);
```

---

### 4.3 `organization_members`

> Pivot table linking users to organizations with an explicit role. This is the central RBAC anchor.
> A single user may appear in this table multiple times — once per organisation they belong to, with a
> potentially different role in each. The `UNIQUE(organization_id, user_id)` constraint on this table
> is the composite FK target used by `teacher_students`, `student_fees`, `fee_payments`, and `invites`
> to enforce at the database level that an actor is actually a member of the relevant organization.

| Column            | Type          | Constraints                      | Description                                          |
| ----------------- | ------------- | -------------------------------- | ---------------------------------------------------- |
| `id`              | `UUID`        | PK, DEFAULT gen_random_uuid()    | Internal primary key.                                |
| `organization_id` | `UUID`        | NOT NULL, FK → organizations(id) | Tenant reference.                                    |
| `user_id`         | `UUID`        | NOT NULL, FK → users(id)         | The member.                                          |
| `role`            | `VARCHAR(50)` | NOT NULL                         | `'owner'` \| `'admin'` \| `'teacher'` \| `'student'` |
| `invited_by`      | `UUID`        | NULLABLE, FK → users(id)         | Who granted membership (null for owner at creation). |
| `joined_at`       | `TIMESTAMPTZ` | NULLABLE                         | When the user accepted/joined (null until accepted). |
| `created_at`      | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW()          | Record creation timestamp.                           |
| `updated_at`      | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW()          | Last update timestamp.                               |

**Primary Key:** `id`
**Unique Constraints:** `(organization_id, user_id)` — this composite unique is a FK target; do not remove.
**Foreign Keys:**

- `organization_id → organizations(id) ON DELETE CASCADE`
- `user_id → users(id) ON DELETE CASCADE`
- `invited_by → users(id) ON DELETE SET NULL`

**Check Constraint:**

```sql
CONSTRAINT chk_org_member_role CHECK (role IN ('owner', 'admin', 'teacher', 'student'))
```

**Indexes:**

```sql
CREATE UNIQUE INDEX idx_org_members_org_user ON organization_members (organization_id, user_id);
CREATE INDEX        idx_org_members_user_id  ON organization_members (user_id);
CREATE INDEX        idx_org_members_role     ON organization_members (organization_id, role);
```

---

### 4.4 `students`

> A student record belonging to an organization. The student record is the org-scoped billing and
> academic anchor. All fee history, teacher assignments, and future LMS content FK to `students.id`,
> not `users.id` — the student record remains canonical regardless of auth status.
>
> **v1.5.0 changes:**
>
> - `date_of_birth` removed — not required for the current product scope.
> - `grade_level` removed — replaced by the more flexible `metadata` JSONB field.
> - `created_by` removed — authorship at student creation is captured in `audit_logs` by the C# API.
>   Removing `created_by` simplifies the schema without losing auditability, since every write
>   operation records the actor in `audit_logs`.
> - `phone` added for student contact number as held by the teacher.
> - `metadata JSONB` retained and justified: enables per-org categorisation (e.g. subject tags,
>   year group, academic tier), student grouping on free plans without a `classes` table, and
>   any extensible fields that orgs need without schema migrations. This is a deliberate trade-off
>   for flexibility at the cost of queryability on those fields.

| Column            | Type           | Constraints                      | Description                                                                                                                                                                                                                                                                                                  |
| ----------------- | -------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`              | `UUID`         | PK, DEFAULT gen_random_uuid()    | Internal primary key.                                                                                                                                                                                                                                                                                        |
| `organization_id` | `UUID`         | NOT NULL, FK → organizations(id) | Tenant scope.                                                                                                                                                                                                                                                                                                |
| `user_id`         | `UUID`         | NULLABLE, FK → users(id)         | Populated when a student's `users` account is linked to this org's student record. Per-org unique when set.                                                                                                                                                                                                  |
| `first_name`      | `VARCHAR(100)` | NOT NULL                         | Student's given name as held by the teacher.                                                                                                                                                                                                                                                                 |
| `last_name`       | `VARCHAR(100)` | NOT NULL                         | Student's family name as held by the teacher.                                                                                                                                                                                                                                                                |
| `email`           | `VARCHAR(255)` | NULLABLE                         | Student contact email as held by the teacher. Used as the invite target. **Distinct from `users.email`** — may drift; see Section 11.1.                                                                                                                                                                      |
| `phone`           | `VARCHAR(30)`  | NULLABLE                         | Student contact phone as held by the teacher.                                                                                                                                                                                                                                                                |
| `notes`           | `TEXT`         | NULLABLE                         | Free-form notes about the student.                                                                                                                                                                                                                                                                           |
| `status`          | `VARCHAR(50)`  | NOT NULL, DEFAULT `'active'`     | `'active'` \| `'inactive'` \| `'graduated'`                                                                                                                                                                                                                                                                  |
| `account_status`  | `VARCHAR(50)`  | NOT NULL, DEFAULT `'no_account'` | Portal lifecycle: `'no_account'` \| `'invite_pending'` \| `'active'`                                                                                                                                                                                                                                         |
| `metadata`        | `JSONB`        | NULLABLE, DEFAULT `'{}'`         | Extensible custom fields per org. Supports use cases such as: subject tags (e.g. `{"subjects": ["Maths", "Physics"]}`), year group (`{"year_group": "Year 10"}`), academic tier, or any org-specific categorisation that does not justify a new table. On free plans this can substitute for class grouping. |
| `created_at`      | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()          | Record creation timestamp.                                                                                                                                                                                                                                                                                   |
| `updated_at`      | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()          | Last update timestamp.                                                                                                                                                                                                                                                                                       |
| `deleted_at`      | `TIMESTAMPTZ`  | NULLABLE                         | Soft delete timestamp.                                                                                                                                                                                                                                                                                       |

**Primary Key:** `id`
**Unique Constraints:**

- `UNIQUE(organization_id, id)` — composite FK target for all child tables; must not be removed.
- `UNIQUE(organization_id, user_id)` WHERE `user_id IS NOT NULL` — enforces one-to-one within an org;
  the same user may be a student in multiple orgs (one row per org).

**Foreign Keys:**

- `organization_id → organizations(id) ON DELETE CASCADE`
- `user_id → users(id) ON DELETE SET NULL`

**Check Constraints:**

```sql
CONSTRAINT chk_student_status         CHECK (status         IN ('active', 'inactive', 'graduated'))
CONSTRAINT chk_student_account_status CHECK (account_status IN ('no_account', 'invite_pending', 'active'))
```

**Indexes:**

```sql
-- Tenant + existence (covers the most common WHERE clause in every student list query)
CREATE INDEX idx_students_organization_id
    ON students (organization_id)
    WHERE deleted_at IS NULL;

-- Tenant + status (dashboard status filter)
CREATE INDEX idx_students_status
    ON students (organization_id, status)
    WHERE deleted_at IS NULL;

-- Tenant + created_at (date-range dashboard queries, e.g. "students added this month")
CREATE INDEX idx_students_org_created_at
    ON students (organization_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- Account lifecycle filter
CREATE INDEX idx_students_account_status
    ON students (organization_id, account_status)
    WHERE deleted_at IS NULL;

-- Email lookup within tenant (used during invite dispatch to match teacher-held email)
CREATE INDEX idx_students_email
    ON students (organization_id, email)
    WHERE deleted_at IS NULL AND email IS NOT NULL;

-- Per-org bridge FK lookup — enforces one students row per user per org
CREATE UNIQUE INDEX idx_students_org_user_id
    ON students (organization_id, user_id)
    WHERE user_id IS NOT NULL;

-- Composite unique — required for composite FK references from child tables
CREATE UNIQUE INDEX idx_students_org_id_composite
    ON students (organization_id, id);
```

> **Soft-delete safety rule:** Child tables (`teacher_students`, `student_fees`, `fee_periods`,
> `fee_payments`) MUST NOT reference a soft-deleted student. The application layer must check
> `students.deleted_at IS NULL` before any insert into these tables. The trigger in Section 8.3
> enforces this at the database level as a safety net.

> **Account lifecycle state machine — two valid paths:**
>
> **Path A — Invite-first (teacher creates student, then invites):**
> `no_account` → teacher creates `students` row → teacher sends invite → `invite_pending`
> (an `invites` row is created with `role='student'` and `student_id` pre-linked) →
> application performs email lookup against `users.email` →
> if existing `users` row found: `students.user_id` populated immediately, `account_status` → `active`,
> `organization_members` row inserted — student must log in to access the portal (already has credentials) →
> if no existing `users` row: student receives invite email; upon clicking, they see a Sign Up form
> (email pre-filled, read-only), collect first_name, last_name, password → `signUp()` → DB trigger
> creates `public.users` → OTP verification → invite acceptance → `account_status` → `active`.
>
> **Path B — Self-register-first (student registers independently, teacher invites later):**
> Student completes Sign Up form → Supabase creates `auth.users`, trigger creates `public.users`
> with names populated from metadata → student completes OTP verification →
> student sees welcome screen: _"Ask your teacher to invite you to their organisation."_ →
> Teacher creates `students` row (pseudo-student, `user_id = NULL`) →
> Teacher sends invite → email lookup finds existing `users` row → immediate linking →
> `students.user_id` populated, `account_status` → `active`, `organization_members` inserted.
> Student receives a notification email and gains org access.
>
> **`account_status` state table:**
>
> | `account_status` | `user_id` | Meaning                                                       |
> | ---------------- | --------- | ------------------------------------------------------------- |
> | `no_account`     | NULL      | Student record exists; no invite sent; no linked user account |
> | `invite_pending` | NULL      | Invite sent; student has not yet registered or been matched   |
> | `active`         | populated | `users` row linked; student has org access                    |

---

### 4.5 `teacher_students`

> Explicit many-to-many relationship between a teacher (user) and a student within an organization.
> Composite FKs enforce that both the teacher and the student belong to the same org, preventing
> cross-org data leakage at the database level.

| Column            | Type          | Constraints                                 | Description                                                  |
| ----------------- | ------------- | ------------------------------------------- | ------------------------------------------------------------ |
| `id`              | `UUID`        | PK, DEFAULT gen_random_uuid()               | Internal primary key.                                        |
| `organization_id` | `UUID`        | NOT NULL, FK → organizations(id)            | Tenant scope.                                                |
| `teacher_id`      | `UUID`        | NOT NULL                                    | The teacher managing this student (part of composite FK).    |
| `student_id`      | `UUID`        | NOT NULL                                    | The student being managed (part of composite FK).            |
| `assigned_at`     | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW()                     | When the teacher was assigned to this student.               |
| `assigned_by`     | `UUID`        | NULLABLE, FK → users(id) ON DELETE SET NULL | Who made the assignment (null = self-assigned).              |
| `is_primary`      | `BOOLEAN`     | NOT NULL, DEFAULT TRUE                      | Whether this teacher is the primary contact for the student. |
| `created_at`      | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW()                     | Record creation timestamp.                                   |
| `updated_at`      | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW()                     | Last update timestamp.                                       |

**Primary Key:** `id`
**Unique Constraints:** `(teacher_id, student_id)` — a teacher can only be linked to a student once.

**Foreign Keys:**

```sql
-- Scalar FK: keep organization reference
CONSTRAINT fk_ts_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE CASCADE,

-- Composite FK: ensures teacher is a member of THIS organization
CONSTRAINT fk_ts_org_teacher
    FOREIGN KEY (organization_id, teacher_id)
    REFERENCES organization_members(organization_id, user_id) ON DELETE CASCADE,

-- Composite FK: ensures student belongs to THIS organization
CONSTRAINT fk_ts_org_student
    FOREIGN KEY (organization_id, student_id)
    REFERENCES students(organization_id, id) ON DELETE CASCADE,

-- Scalar FK: assignment attribution (non-isolation FK, intentionally scalar)
CONSTRAINT fk_ts_assigned_by
    FOREIGN KEY (assigned_by)
    REFERENCES users(id) ON DELETE SET NULL
```

**Indexes:**

```sql
-- Unique pair guard (teacher cannot be linked to same student twice)
CREATE UNIQUE INDEX idx_teacher_students_pair
    ON teacher_students (teacher_id, student_id);

-- Tenant-level queries ("all teacher-student links in org X")
CREATE INDEX idx_teacher_students_org
    ON teacher_students (organization_id);

-- Student-centric queries ("who teaches student X?")
CREATE INDEX idx_teacher_students_student
    ON teacher_students (student_id);

-- Teacher-centric queries ("which students does teacher X manage?")
CREATE INDEX idx_teacher_students_teacher
    ON teacher_students (teacher_id);
```

---

### 4.6 `invites`

> Tokenized email invitations for onboarding Admins, Teachers, and Student portal users.
> `invited_by` uses a composite FK to `organization_members` to ensure that only a current member
> of the organisation can send invites for it, closing a privilege escalation path where a
> removed-but-still-authenticated user could generate valid invite tokens.
>
> **Invite flow email lookup:** Before creating an invite, the application must query `users.email`.
> If a matching `users` row exists, the link to `students.user_id` can be made immediately at dispatch
> (without requiring the student to register). The `invites` row is still created for audit purposes.
> See Section 11.1.
>
> **Note on invite tokens vs. Supabase auth tokens:** The invite token stored in this table is a
> TuitionIQ application-level token used for org membership acceptance. It is entirely separate from
> Supabase session tokens, JWT access tokens, or password reset tokens. The two mechanisms operate
> independently. Clicking an invite link never authenticates a user — it only accepts org membership
> after the user has separately authenticated with their email and password.

| Column            | Type           | Constraints                                    | Description                                                             |
| ----------------- | -------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `id`              | `UUID`         | PK, DEFAULT gen_random_uuid()                  | Internal primary key.                                                   |
| `organization_id` | `UUID`         | NOT NULL, FK → organizations(id)               | The organization the invite belongs to.                                 |
| `invited_by`      | `UUID`         | NOT NULL                                       | The user who sent the invite (part of composite FK).                    |
| `email`           | `VARCHAR(255)` | NOT NULL                                       | The email address invited.                                              |
| `role`            | `VARCHAR(50)`  | NOT NULL                                       | Role to grant on acceptance: `'admin'` \| `'teacher'` \| `'student'`    |
| `student_id`      | `UUID`         | NULLABLE, FK → students(id) ON DELETE SET NULL | Pre-links the invite to a student record (student portal invites only). |
| `token`           | `VARCHAR(255)` | NOT NULL, UNIQUE                               | Secure random token for the invite link.                                |
| `status`          | `VARCHAR(50)`  | NOT NULL, DEFAULT `'pending'`                  | `'pending'` \| `'accepted'` \| `'expired'` \| `'revoked'`               |
| `accepted_by`     | `UUID`         | NULLABLE, FK → users(id) ON DELETE SET NULL    | The user who accepted the invite.                                       |
| `accepted_at`     | `TIMESTAMPTZ`  | NULLABLE                                       | When the invite was accepted.                                           |
| `expires_at`      | `TIMESTAMPTZ`  | NOT NULL                                       | Token expiry (recommend: NOW() + INTERVAL '7 days').                    |
| `created_at`      | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()                        | Record creation timestamp.                                              |
| `updated_at`      | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()                        | Last update timestamp.                                                  |
| `deleted_at`      | `TIMESTAMPTZ`  | NULLABLE                                       | Soft delete / revocation timestamp.                                     |

**Primary Key:** `id`
**Unique Constraints:** `token`

**Foreign Keys:**

```sql
CONSTRAINT fk_invites_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE CASCADE,

-- Composite FK: only a current org member can invite
CONSTRAINT fk_invites_org_invited_by
    FOREIGN KEY (organization_id, invited_by)
    REFERENCES organization_members(organization_id, user_id) ON DELETE CASCADE,

-- Scalar FK: the person who accepted (may be null, may be from outside the org initially)
CONSTRAINT fk_invites_accepted_by
    FOREIGN KEY (accepted_by)
    REFERENCES users(id) ON DELETE SET NULL,

-- Scalar FK: pre-linked student record
CONSTRAINT fk_invites_student
    FOREIGN KEY (student_id)
    REFERENCES students(id) ON DELETE SET NULL
```

**Check Constraints:**

```sql
CONSTRAINT chk_invite_role   CHECK (role   IN ('admin', 'teacher', 'student'))
CONSTRAINT chk_invite_status CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
```

**Indexes:**

```sql
CREATE UNIQUE INDEX idx_invites_token      ON invites (token)                          WHERE deleted_at IS NULL;
CREATE INDEX        idx_invites_org_email  ON invites (organization_id, email);
CREATE INDEX        idx_invites_status     ON invites (organization_id, status)         WHERE deleted_at IS NULL;
CREATE INDEX        idx_invites_expires_at ON invites (expires_at)                      WHERE status = 'pending';
CREATE INDEX        idx_invites_student_id ON invites (student_id)                      WHERE student_id IS NOT NULL;
```

---

### 4.7 `audit_logs`

> Append-only audit trail. Never updated or soft-deleted. Used for compliance and debugging.
> Since `created_by` has been removed from `students`, the `audit_logs` table is the authoritative
> record of who created any given student record. The C# service layer must always insert an
> `audit_logs` row in the same transaction as any student creation or mutation.
>
> **Audit actions include email verification:** The action `'user.email_verified'` is written when
> the C# API marks a user's `email_verified` flag as `TRUE` after successful OTP confirmation.

| Column            | Type           | Constraints                                         | Description                                                                                                 |
| ----------------- | -------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`              | `UUID`         | PK, DEFAULT gen_random_uuid()                       | Internal primary key.                                                                                       |
| `organization_id` | `UUID`         | NULLABLE, FK → organizations(id) ON DELETE SET NULL | Tenant scope (null for platform-level events such as `user.email_verified`).                                |
| `actor_id`        | `UUID`         | NULLABLE, FK → users(id) ON DELETE SET NULL         | The user who performed the action (null = system).                                                          |
| `action`          | `VARCHAR(100)` | NOT NULL                                            | Verb, e.g. `'fee_payment.recorded'`, `'student.created'`, `'student.invite_sent'`, `'user.email_verified'`. |
| `entity_type`     | `VARCHAR(100)` | NOT NULL                                            | Table/entity affected, e.g. `'students'`, `'fee_payments'`, `'users'`.                                      |
| `entity_id`       | `UUID`         | NULLABLE                                            | The PK of the affected row.                                                                                 |
| `old_values`      | `JSONB`        | NULLABLE                                            | Snapshot of the record before the change.                                                                   |
| `new_values`      | `JSONB`        | NULLABLE                                            | Snapshot of the record after the change.                                                                    |
| `ip_address`      | `INET`         | NULLABLE                                            | Client IP at time of action.                                                                                |
| `user_agent`      | `TEXT`         | NULLABLE                                            | Client user-agent string.                                                                                   |
| `created_at`      | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()                             | When the event occurred.                                                                                    |

**Primary Key:** `id`
**Indexes:**

```sql
CREATE INDEX idx_audit_logs_org_id   ON audit_logs (organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs (actor_id,        created_at DESC);
CREATE INDEX idx_audit_logs_entity   ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_action   ON audit_logs (action,          created_at DESC);
```

---

### 4.8 `student_fees`

> Stores the **fee configuration** for a student. One active row per student at any time.
> When the fee changes, the old row is closed (`is_active = FALSE`, `effective_to` set) and a new row
> is inserted, preserving a complete rate-change history.
> Composite FKs enforce that both the student and the fee setter belong to the same organisation.
>
> **Money column:** `manual_fee` is a whole-integer amount in the currency specified by `currency`.
> No subunits (paisa, cents) are used.

| Column            | Type          | Constraints                      | Description                                                                                                                                        |
| ----------------- | ------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | `UUID`        | PK, DEFAULT gen_random_uuid()    | Internal primary key.                                                                                                                              |
| `organization_id` | `UUID`        | NOT NULL, FK → organizations(id) | Tenant scope.                                                                                                                                      |
| `student_id`      | `UUID`        | NOT NULL                         | The student this config applies to (part of composite FK).                                                                                         |
| `set_by`          | `UUID`        | NOT NULL                         | The teacher or admin who configured this fee (part of composite FK).                                                                               |
| `fee_source`      | `VARCHAR(50)` | NOT NULL, DEFAULT `'manual'`     | `'manual'` \| `'class_calculated'` \| `'override'`                                                                                                 |
| `manual_fee`      | `BIGINT`      | NULLABLE                         | Flat monthly fee as a whole integer in the specified currency. Required when `fee_source IN ('manual','override')`. NULL for `'class_calculated'`. |
| `override_reason` | `TEXT`        | NULLABLE                         | Explanation for teacher override of a class-calculated fee.                                                                                        |
| `currency`        | `CHAR(3)`     | NOT NULL, DEFAULT `'BDT'`        | ISO 4217 currency code.                                                                                                                            |
| `effective_from`  | `DATE`        | NOT NULL, DEFAULT CURRENT_DATE   | Calendar date from which this rate is active.                                                                                                      |
| `effective_to`    | `DATE`        | NULLABLE                         | Last date this rate applies. NULL = currently active. Set when superseded.                                                                         |
| `is_active`       | `BOOLEAN`     | NOT NULL, DEFAULT TRUE           | Quick filter for the current rate. Set FALSE when superseded.                                                                                      |
| `notes`           | `TEXT`        | NULLABLE                         | Free-form notes about this fee arrangement.                                                                                                        |
| `created_at`      | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW()          | Record creation timestamp.                                                                                                                         |
| `updated_at`      | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW()          | Last update timestamp.                                                                                                                             |
| `deleted_at`      | `TIMESTAMPTZ` | NULLABLE                         | Soft delete timestamp.                                                                                                                             |

**Primary Key:** `id`

**Foreign Keys:**

```sql
CONSTRAINT fk_sf_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE CASCADE,

-- Composite FK: student must belong to THIS organization
CONSTRAINT fk_sf_org_student
    FOREIGN KEY (organization_id, student_id)
    REFERENCES students(organization_id, id) ON DELETE CASCADE,

-- Composite FK: fee setter must be a member of THIS organization
CONSTRAINT fk_sf_org_set_by
    FOREIGN KEY (organization_id, set_by)
    REFERENCES organization_members(organization_id, user_id) ON DELETE RESTRICT
```

**Check Constraints:**

```sql
CONSTRAINT chk_student_fee_source CHECK (fee_source IN ('manual', 'class_calculated', 'override'))
CONSTRAINT chk_student_fee_amount CHECK (
    (fee_source IN ('manual', 'override') AND manual_fee IS NOT NULL AND manual_fee >= 0)
    OR (fee_source = 'class_calculated' AND manual_fee IS NULL)
)
CONSTRAINT chk_student_fee_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
```

**Indexes:**

```sql
-- Partial unique — only one active fee config per student at any time
CREATE UNIQUE INDEX idx_student_fees_one_active
    ON student_fees (student_id)
    WHERE is_active = TRUE AND deleted_at IS NULL;

-- Active fee lookup per student
CREATE INDEX idx_student_fees_student_active
    ON student_fees (student_id, is_active)
    WHERE deleted_at IS NULL;

-- Org-wide active fee overview
CREATE INDEX idx_student_fees_org_active
    ON student_fees (organization_id, is_active)
    WHERE deleted_at IS NULL;

-- Rate history queries (what was the fee on date X?)
CREATE INDEX idx_student_fees_effective
    ON student_fees (student_id, effective_from, effective_to);
```

> **Soft-delete safety:** `student_id` should only reference a student where `deleted_at IS NULL`.
> Enforced by the trigger in Section 8.3 and the application service layer.
>
> **Application rule:** Only one row per student may have `is_active = TRUE` and `deleted_at IS NULL`.
> Within a single transaction: set `is_active = FALSE` and `effective_to = today` on the old row,
> then insert the new row. The partial unique index enforces this at the DB level.

---

### 4.9 `fee_periods`

> Represents a **single monthly billing period** for a student. One row per student per calendar month.
> `fee` is snapshotted at creation and is immutable. `amount_paid` is a denormalized running total,
> maintained by the trigger in Section 8.2. Composite FK ensures the student belongs to the same
> organisation as this billing period.
>
> **Money columns:** `fee` and `amount_paid` are whole-integer amounts in the specified currency.

| Column            | Type          | Constraints                                        | Description                                                                |
| ----------------- | ------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| `id`              | `UUID`        | PK, DEFAULT gen_random_uuid()                      | Internal primary key.                                                      |
| `organization_id` | `UUID`        | NOT NULL, FK → organizations(id)                   | Tenant scope.                                                              |
| `student_id`      | `UUID`        | NOT NULL                                           | The student this period belongs to (part of composite FK).                 |
| `student_fee_id`  | `UUID`        | NULLABLE, FK → student_fees(id) ON DELETE SET NULL | The fee config used to generate this period (audit reference).             |
| `period_year`     | `SMALLINT`    | NOT NULL                                           | Calendar year, e.g. `2025`.                                                |
| `period_month`    | `SMALLINT`    | NOT NULL                                           | Calendar month 1–12.                                                       |
| `fee`             | `BIGINT`      | NOT NULL                                           | Fee owed for this period as a whole integer. **Immutable after creation.** |
| `amount_paid`     | `BIGINT`      | NOT NULL, DEFAULT 0                                | Running total of confirmed payments. Maintained by trigger (Section 8.2).  |
| `currency`        | `CHAR(3)`     | NOT NULL, DEFAULT `'BDT'`                          | ISO 4217. Copied from fee config at creation.                              |
| `status`          | `VARCHAR(50)` | NOT NULL, DEFAULT `'unpaid'`                       | `'unpaid'` \| `'partial'` \| `'paid'` \| `'overdue'` \| `'waived'`         |
| `due_date`        | `DATE`        | NULLABLE                                           | When payment is due for this period.                                       |
| `waived_by`       | `UUID`        | NULLABLE, FK → users(id) ON DELETE SET NULL        | Teacher who waived this period.                                            |
| `waived_at`       | `TIMESTAMPTZ` | NULLABLE                                           | Timestamp of the waiver.                                                   |
| `waiver_reason`   | `TEXT`        | NULLABLE                                           | Explanation for waiving the fee.                                           |
| `notes`           | `TEXT`        | NULLABLE                                           | Free-form notes for this billing period.                                   |
| `created_at`      | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW()                            | Record creation timestamp.                                                 |
| `updated_at`      | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW()                            | Last update timestamp.                                                     |
| `deleted_at`      | `TIMESTAMPTZ` | NULLABLE                                           | Soft delete (e.g. period created in error).                                |

**Primary Key:** `id`
**Unique Constraints:** `(student_id, period_year, period_month)` — one period per student per month.

**Foreign Keys:**

```sql
CONSTRAINT fk_fp_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE CASCADE,

-- Composite FK: student must belong to THIS organization
CONSTRAINT fk_fp_org_student
    FOREIGN KEY (organization_id, student_id)
    REFERENCES students(organization_id, id) ON DELETE CASCADE,

CONSTRAINT fk_fp_student_fee
    FOREIGN KEY (student_fee_id)
    REFERENCES student_fees(id) ON DELETE SET NULL,

CONSTRAINT fk_fp_waived_by
    FOREIGN KEY (waived_by)
    REFERENCES users(id) ON DELETE SET NULL
```

**Check Constraints:**

```sql
CONSTRAINT chk_fee_period_month   CHECK (period_month BETWEEN 1 AND 12)
CONSTRAINT chk_fee_period_year    CHECK (period_year  BETWEEN 2000 AND 2100)
CONSTRAINT chk_fee_period_status  CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue', 'waived'))
CONSTRAINT chk_fee_period_amounts CHECK (fee >= 0 AND amount_paid >= 0)
CONSTRAINT chk_fee_period_waiver  CHECK (
    (status = 'waived' AND waived_by IS NOT NULL AND waived_at IS NOT NULL)
    OR (status != 'waived')
)
```

**Indexes:**

```sql
-- One period per student per month (partial for soft-delete awareness)
CREATE UNIQUE INDEX idx_fee_periods_student_month
    ON fee_periods (student_id, period_year, period_month)
    WHERE deleted_at IS NULL;

-- Dashboard: filter by org + status (covers "show all unpaid periods for org X")
CREATE INDEX idx_fee_periods_org_status
    ON fee_periods (organization_id, status)
    WHERE deleted_at IS NULL;

-- Student billing history (student detail page, newest first)
CREATE INDEX idx_fee_periods_student_id
    ON fee_periods (student_id, period_year DESC, period_month DESC);

-- Org-wide period listing (newest-first month view)
CREATE INDEX idx_fee_periods_org_year_month
    ON fee_periods (organization_id, period_year DESC, period_month DESC)
    WHERE deleted_at IS NULL;

-- Overdue sweep job (scheduled task finds past-due, unpaid/partial periods)
CREATE INDEX idx_fee_periods_due_date
    ON fee_periods (due_date)
    WHERE status IN ('unpaid', 'partial', 'overdue') AND deleted_at IS NULL;
```

---

### 4.10 `fee_payments`

> Individual payment ledger entries credited against a fee period. Partial payments, multiple payments
> per period, and corrections via soft-delete are all first-class operations.
> Composite FKs enforce that both the student and the payment recorder belong to the same organisation.
>
> **Money column:** `amount` is a whole-integer amount in the specified currency. Must be > 0.

| Column            | Type           | Constraints                                       | Description                                                                            |
| ----------------- | -------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `id`              | `UUID`         | PK, DEFAULT gen_random_uuid()                     | Internal primary key.                                                                  |
| `organization_id` | `UUID`         | NOT NULL, FK → organizations(id)                  | Tenant scope.                                                                          |
| `student_id`      | `UUID`         | NOT NULL                                          | Denormalized student reference (part of composite FK).                                 |
| `fee_period_id`   | `UUID`         | NOT NULL, FK → fee_periods(id) ON DELETE RESTRICT | The billing period this payment is credited to.                                        |
| `recorded_by`     | `UUID`         | NOT NULL                                          | The teacher or admin who recorded this payment (part of composite FK).                 |
| `amount`          | `BIGINT`       | NOT NULL                                          | Payment amount as a whole integer in the specified currency. Must be > 0.              |
| `currency`        | `CHAR(3)`      | NOT NULL, DEFAULT `'BDT'`                         | ISO 4217. Must match the period's currency.                                            |
| `payment_date`    | `DATE`         | NOT NULL                                          | The date the payment was actually received (not necessarily today).                    |
| `payment_method`  | `VARCHAR(50)`  | NOT NULL, DEFAULT `'cash'`                        | `'cash'` \| `'bank_transfer'` \| `'card'` \| `'cheque'` \| `'other'`                   |
| `reference`       | `VARCHAR(255)` | NULLABLE                                          | Bank reference, cheque number, or other payment identifier.                            |
| `notes`           | `TEXT`         | NULLABLE                                          | Free-form notes about this payment.                                                    |
| `created_at`      | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()                           | Record creation timestamp.                                                             |
| `updated_at`      | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()                           | Last update timestamp.                                                                 |
| `deleted_at`      | `TIMESTAMPTZ`  | NULLABLE                                          | Soft delete for corrections/reversals. Reversed payments are excluded from all totals. |

**Primary Key:** `id`

**Foreign Keys:**

```sql
CONSTRAINT fk_fpy_organization
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id) ON DELETE CASCADE,

-- Composite FK: student must belong to THIS organization
CONSTRAINT fk_fpy_org_student
    FOREIGN KEY (organization_id, student_id)
    REFERENCES students(organization_id, id) ON DELETE CASCADE,

-- Scalar FK: period reference (RESTRICT prevents orphan payments)
CONSTRAINT fk_fpy_period
    FOREIGN KEY (fee_period_id)
    REFERENCES fee_periods(id) ON DELETE RESTRICT,

-- Composite FK: recorder must be a member of THIS organization
CONSTRAINT fk_fpy_org_recorded_by
    FOREIGN KEY (organization_id, recorded_by)
    REFERENCES organization_members(organization_id, user_id) ON DELETE RESTRICT
```

**Check Constraints:**

```sql
CONSTRAINT chk_fee_payment_amount CHECK (amount > 0)
CONSTRAINT chk_fee_payment_method CHECK (payment_method IN ('cash', 'bank_transfer', 'card', 'cheque', 'other'))
```

**Indexes:**

```sql
-- Payments by period (used by the sync trigger and period detail view)
CREATE INDEX idx_fee_payments_period_id
    ON fee_payments (fee_period_id)
    WHERE deleted_at IS NULL;

-- Payments by student (dashboard: "payment history for student X")
CREATE INDEX idx_fee_payments_student_id
    ON fee_payments (student_id, payment_date DESC)
    WHERE deleted_at IS NULL;

-- Org-level payment ledger (teacher dashboard: all payments this month)
CREATE INDEX idx_fee_payments_org_date
    ON fee_payments (organization_id, payment_date DESC)
    WHERE deleted_at IS NULL;

-- Recorder audit queries
CREATE INDEX idx_fee_payments_recorded_by
    ON fee_payments (recorded_by);
```

---

## 5. Relationships

```
users (1) ─────────────────────────── (N) organization_members
organizations (1) ─────────────────── (N) organization_members
organizations (1) ─────────────────── (1) users [owner_id]
organizations (1) ─────────────────── (N) students
organizations (1) ─────────────────── (N) invites
organizations (1) ─────────────────── (N) teacher_students

users (1) ─────────────────────────── (N) students [user_id — per-org scoped; same user may
                                                     appear in students across multiple orgs]
users [teacher] (1) ───────────────── (N) teacher_students [composite FK]
students        (1) ───────────────── (N) teacher_students [composite FK]

users  (1) ────────────────────────── (N) invites [composite FK on invited_by]
users  (1) ────────────────────────── (N) audit_logs [actor_id]

students (0..1) ─── (0..1) users per org  [org-scoped bridge; same users row may link to
                                            multiple students rows across different orgs]
students (1)    ─── (N)    student_fees   [composite FK]
students (1)    ─── (N)    fee_periods    [composite FK]
fee_periods (1) ─── (N)    fee_payments   [composite FK on recorded_by]

invites (0..N) ─────────────────────── (0..1) students    [portal invite pre-link]
```

> **Multi-org note:** `students.user_id` uniqueness is scoped to `(organization_id, user_id)`.
> A single `users` row may appear as `user_id` in multiple `students` rows, provided each belongs to a
> different organisation. Never assume one `users` row maps to one `students` row. When resolving
> which orgs a logged-in student belongs to, query `organization_members` filtered by `user_id` and
> `role = 'student'`, then join to `students` on `(organization_id, user_id)`.

### Cascade Behaviour Summary

| Relationship                                                                    | On Parent Delete                   |
| ------------------------------------------------------------------------------- | ---------------------------------- |
| `organizations → students`                                                      | CASCADE                            |
| `organizations → organization_members`                                          | CASCADE                            |
| `organizations → invites`                                                       | CASCADE                            |
| `organizations → teacher_students`                                              | CASCADE                            |
| `organizations → student_fees`                                                  | CASCADE                            |
| `organizations → fee_periods`                                                   | CASCADE                            |
| `organizations → fee_payments`                                                  | CASCADE                            |
| `users → organization_members`                                                  | CASCADE                            |
| `organization_members → teacher_students` (composite, teacher removed from org) | CASCADE                            |
| `organization_members → student_fees` (composite, set_by removed from org)      | RESTRICT                           |
| `organization_members → fee_payments` (composite, recorder removed from org)    | RESTRICT                           |
| `organization_members → invites` (composite, invited_by removed from org)       | CASCADE                            |
| `students → teacher_students` (composite)                                       | CASCADE                            |
| `students → student_fees` (composite)                                           | CASCADE                            |
| `students → fee_periods` (composite)                                            | CASCADE                            |
| `students → fee_payments` (composite)                                           | CASCADE                            |
| `users → students` (user_id)                                                    | SET NULL                           |
| `users → invites` (accepted_by)                                                 | SET NULL                           |
| `students → invites` (student_id)                                               | SET NULL                           |
| `fee_periods → fee_payments`                                                    | RESTRICT (preserve ledger records) |
| `users → audit_logs`                                                            | SET NULL                           |
| `organizations → audit_logs`                                                    | SET NULL                           |

---

## 6. Future Expansion

The schema is designed so all of the following can be added **without breaking existing tables.**

---

### 6.1 Admin Role

**Already scaffolded.** `organization_members.role` accepts `'admin'`. `invites.role` accepts `'admin'`.
No new tables required.

---

### 6.2 Multiple Teachers per Organization

**Already scaffolded.** `organization_members` is a many-to-many pivot. `teacher_students` supports
multiple teachers per student.

---

### 6.3 Platform Billing & Subscriptions

```sql
CREATE TABLE subscriptions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan                 VARCHAR(50)  NOT NULL,
    status               VARCHAR(50)  NOT NULL,  -- 'active' | 'trialing' | 'cancelled' | 'past_due'
    provider             VARCHAR(50)  NOT NULL,  -- 'stripe' | 'paddle'
    provider_sub_id      VARCHAR(255) NOT NULL UNIQUE,
    current_period_start TIMESTAMPTZ  NOT NULL,
    current_period_end   TIMESTAMPTZ  NOT NULL,
    cancelled_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

### 6.4 Class Groups

```sql
CREATE TABLE classes (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id   UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    teacher_id        UUID         NOT NULL,  -- part of composite FK below
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    subject           VARCHAR(100),
    status            VARCHAR(50)  NOT NULL DEFAULT 'active',
    fee_amount        BIGINT       NOT NULL DEFAULT 0,  -- whole integer, currency from org settings
    billing_frequency VARCHAR(50)  NOT NULL DEFAULT 'monthly',
    currency          CHAR(3)      NOT NULL DEFAULT 'BDT',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,

    CONSTRAINT chk_class_status   CHECK (status            IN ('active', 'archived')),
    CONSTRAINT chk_class_billing  CHECK (billing_frequency IN ('monthly', 'per_lesson', 'term')),

    -- Composite FK: teacher must be a member of THIS organization
    CONSTRAINT fk_classes_org_teacher
        FOREIGN KEY (organization_id, teacher_id)
        REFERENCES organization_members(organization_id, user_id) ON DELETE RESTRICT,

    -- Composite unique to support composite FKs from child tables
    CONSTRAINT uq_classes_org_id UNIQUE (organization_id, id)
);

CREATE INDEX idx_classes_org_id     ON classes (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_classes_teacher_id ON classes (teacher_id)      WHERE deleted_at IS NULL;

CREATE TABLE class_students (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id    UUID        NOT NULL,  -- required for composite FK isolation
    class_id           UUID        NOT NULL,  -- part of composite FK below
    student_id         UUID        NOT NULL,  -- part of composite FK below
    enrolled_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unenrolled_at      TIMESTAMPTZ,
    fee_override       BIGINT,        -- whole integer override amount
    override_reason    TEXT,

    CONSTRAINT uq_class_students UNIQUE (class_id, student_id),

    -- Composite FK: class must belong to THIS organization
    CONSTRAINT fk_cs_org_class
        FOREIGN KEY (organization_id, class_id)
        REFERENCES classes(organization_id, id) ON DELETE CASCADE,

    -- Composite FK: student must belong to THIS organization
    CONSTRAINT fk_cs_org_student
        FOREIGN KEY (organization_id, student_id)
        REFERENCES students(organization_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_class_students_class_id   ON class_students (class_id);
CREATE INDEX idx_class_students_student_id ON class_students (student_id);
CREATE INDEX idx_class_students_org_id     ON class_students (organization_id);
```

---

### 6.5 Lesson Tracking

```sql
CREATE TABLE lessons (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    class_id         UUID         REFERENCES classes(id) ON DELETE SET NULL,
    teacher_id       UUID         NOT NULL,   -- part of composite FK below
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    scheduled_at     TIMESTAMPTZ,
    duration_minutes INT,
    status           VARCHAR(50)  NOT NULL DEFAULT 'scheduled',
    notes            TEXT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ,

    CONSTRAINT chk_lesson_status CHECK (status IN ('scheduled', 'completed', 'cancelled')),

    -- Composite FK: teacher must be a member of THIS organization
    CONSTRAINT fk_lessons_org_teacher
        FOREIGN KEY (organization_id, teacher_id)
        REFERENCES organization_members(organization_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_lessons_org_id     ON lessons (organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_lessons_class_id   ON lessons (class_id)        WHERE deleted_at IS NULL;
CREATE INDEX idx_lessons_teacher_id ON lessons (teacher_id)      WHERE deleted_at IS NULL;
CREATE INDEX idx_lessons_scheduled  ON lessons (organization_id, scheduled_at DESC) WHERE deleted_at IS NULL;
```

---

### 6.6 Attendance

```sql
CREATE TABLE attendance (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id   UUID        NOT NULL REFERENCES lessons(id)  ON DELETE CASCADE,
    student_id  UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status      VARCHAR(50) NOT NULL DEFAULT 'present',
    notes       TEXT,
    recorded_by UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (lesson_id, student_id),
    CONSTRAINT chk_attendance_status CHECK (status IN ('present', 'absent', 'late', 'excused'))
);

CREATE INDEX idx_attendance_lesson_id  ON attendance (lesson_id);
CREATE INDEX idx_attendance_student_id ON attendance (student_id);
```

---

## 7. PostgreSQL Extensions Required

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";    -- Case-insensitive text (optional, for emails)
```

---

## 8. Database Triggers

### 8.1 `updated_at` Auto-Maintenance

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_students_updated_at
    BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_organization_members_updated_at
    BEFORE UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_teacher_students_updated_at
    BEFORE UPDATE ON teacher_students FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_invites_updated_at
    BEFORE UPDATE ON invites FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_student_fees_updated_at
    BEFORE UPDATE ON student_fees FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_fee_periods_updated_at
    BEFORE UPDATE ON fee_periods FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_fee_payments_updated_at
    BEFORE UPDATE ON fee_payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

### 8.2 `fee_periods` Amount + Status Sync Trigger

> Keeps `fee_periods.amount_paid` and `status` consistent after every payment insert or
> soft-delete. This is a safety net — the application service layer must also update these fields
> within its own transaction. `'overdue'` and `'waived'` statuses are set only by application logic.

```sql
CREATE OR REPLACE FUNCTION sync_fee_period_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_period_id UUID;
    v_total     BIGINT;
    v_fee       BIGINT;
    v_status    VARCHAR(50);
BEGIN
    v_period_id := COALESCE(NEW.fee_period_id, OLD.fee_period_id);

    SELECT COALESCE(SUM(fp.amount), 0), p.fee
      INTO v_total, v_fee
      FROM fee_periods p
      LEFT JOIN fee_payments fp
             ON fp.fee_period_id = p.id AND fp.deleted_at IS NULL
     WHERE p.id = v_period_id
     GROUP BY p.fee;

    v_status := CASE
        WHEN v_total = 0      THEN 'unpaid'
        WHEN v_total >= v_fee THEN 'paid'
        ELSE 'partial'
    END;

    UPDATE fee_periods
       SET amount_paid = v_total,
           status      = v_status,
           updated_at  = NOW()
     WHERE id = v_period_id
       AND status NOT IN ('waived', 'overdue');  -- Never overwrite terminal states

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_fee_period_on_payment
    AFTER INSERT OR UPDATE OF deleted_at, amount ON fee_payments
    FOR EACH ROW EXECUTE FUNCTION sync_fee_period_totals();
```

---

### 8.3 Soft-Delete Safety Guard

> Prevents child records from being inserted against a soft-deleted parent student. This is the
> database-level enforcement of the soft-delete safety rule documented in Section 1.

```sql
CREATE OR REPLACE FUNCTION guard_student_not_deleted()
RETURNS TRIGGER AS $$
DECLARE
    v_deleted_at TIMESTAMPTZ;
BEGIN
    SELECT deleted_at INTO v_deleted_at
      FROM students
     WHERE id = NEW.student_id;

    IF v_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot link to a soft-deleted student (id: %). Set deleted_at = NULL or use a different student.',
            NEW.student_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table that has a student_id FK
CREATE TRIGGER trg_guard_teacher_students_student
    BEFORE INSERT ON teacher_students
    FOR EACH ROW EXECUTE FUNCTION guard_student_not_deleted();

CREATE TRIGGER trg_guard_student_fees_student
    BEFORE INSERT ON student_fees
    FOR EACH ROW EXECUTE FUNCTION guard_student_not_deleted();

CREATE TRIGGER trg_guard_fee_periods_student
    BEFORE INSERT ON fee_periods
    FOR EACH ROW EXECUTE FUNCTION guard_student_not_deleted();

CREATE TRIGGER trg_guard_fee_payments_student
    BEFORE INSERT ON fee_payments
    FOR EACH ROW EXECUTE FUNCTION guard_student_not_deleted();
```

---

### 8.4 `public.users` Creation Trigger (Supabase Auth Bridge)

> Fires once per user, on first successful registration via `signUp()`. Bridges Supabase's `auth.users`
> with TuitionIQ's `public.users`. `first_name` and `last_name` are populated from `raw_user_meta_data`
> because the Sign Up form passes `options: { data: { first_name, last_name } }` to `signUp()`.
> `email_verified` is always initialized to `FALSE` — the post-login OTP verification step
> (described in authentication.md Section 1.2a) must be completed before the user gains full access.

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
    FALSE,   -- requires post-login OTP verification before full access is granted
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

---

## 9. C# / Entity Framework Notes for the Generating Agent

| Concern                             | Guidance                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Naming convention**               | EF model classes use PascalCase (e.g. `FeePayment`). Use `ToTable("fee_payments")` in Fluent API.                                                                                                                                                                                                                                                                                |
| **UUID PKs**                        | Use `Guid` in C#. Configure with `.HasDefaultValueSql("gen_random_uuid()")`.                                                                                                                                                                                                                                                                                                     |
| **Soft deletes**                    | Global `HasQueryFilter(e => e.DeletedAt == null)` on every soft-deletable entity. Critical for `FeePayment` — reversed payments must be excluded from all totals automatically.                                                                                                                                                                                                  |
| **Timestamps**                      | `DateTimeOffset` → `TIMESTAMPTZ`. `DateOnly` → `DATE` (for `payment_date`, `effective_from`, `effective_to`, `due_date`).                                                                                                                                                                                                                                                        |
| **JSONB columns**                   | `HasColumnType("jsonb")`. Use `Dictionary<string,object>` or a typed class serialised via `System.Text.Json`.                                                                                                                                                                                                                                                                    |
| **Enum columns**                    | Store as `VARCHAR`. Use C# `enum` + `HasConversion<string>()` value converter.                                                                                                                                                                                                                                                                                                   |
| **Audit log**                       | Insert-only entity. Override `SaveChanges` to throw if an `AuditLog` is in `Modified` or `Deleted` state. Student creation must always write an `audit_logs` row in the same transaction — this is the authoritative record of authorship since `students.created_by` no longer exists. Email verification (`action='user.email_verified'`) must also write an `audit_logs` row. |
| **Money**                           | Always `BIGINT` in DB → `long` in C#. Values are whole integers in the specified currency (no subunits). Never use `decimal`/`NUMERIC` for money.                                                                                                                                                                                                                                |
| **Composite FKs**                   | EF Core does not natively model composite FKs. Define them in a custom migration `Sql()` call after EF generates the table DDL. Shadow properties may be needed for the non-PK column (`organization_id`) on the dependent side.                                                                                                                                                 |
| **`fee_periods.amount_paid`**       | Denormalized cache. Always update within the same `SaveChanges()` transaction as `FeePayment` insert/soft-delete. The DB trigger in Section 8.2 is the safety net, but do not rely on it exclusively.                                                                                                                                                                            |
| **`student_fees` one-active rule**  | Service layer: within one transaction, close the old row (`is_active=false`, `effective_to=today`), then insert the new row. The partial unique index enforces this at DB level.                                                                                                                                                                                                 |
| **Concurrency tokens**              | Apply `xmin` rowversion on `fee_periods` and `students` — highest contention rows.                                                                                                                                                                                                                                                                                               |
| **Schema**                          | All tables in schema `public` (Supabase default). Use `.HasDefaultSchema("public")` in `OnModelCreating`.                                                                                                                                                                                                                                                                        |
| **`account_status` enum**           | C# enum `StudentAccountStatus` with values `NoAccount`, `InvitePending`, `Active`. `HasConversion<string>()`.                                                                                                                                                                                                                                                                    |
| **Soft-delete guard trigger**       | The trigger in Section 8.3 will raise a PostgreSQL exception. Catch `PostgresException` with `SqlState = "P0001"` in C# and translate to a domain exception in the service layer.                                                                                                                                                                                                |
| **`students.user_id` uniqueness**   | The unique index is `(organization_id, user_id)` scoped. Do not model as a simple navigation property unique constraint in EF. Define in a raw migration `Sql()` call to preserve the partial index behaviour (`WHERE user_id IS NOT NULL`).                                                                                                                                     |
| **Multi-org student lookup**        | Never assume one `users` row maps to one `students` row. When resolving which orgs a logged-in student belongs to, query `organization_members` filtered by `user_id` and `role = 'student'`, then join to `students` on `(organization_id, user_id)`.                                                                                                                           |
| **Email lookup on invite dispatch** | Before creating a student invite, the service layer must query `users` by `email`. If a match is found, link `students.user_id` immediately and mark the invite `accepted`. If no match, issue the token for the standard invite + signup flow.                                                                                                                                  |
| **Supabase auth bridge**            | `users.id` is set to match `auth.users.id`. Use `auth.uid()` in RLS policies and compare directly against `users.id` without a join.                                                                                                                                                                                                                                             |
| **No passwords anywhere**           | The `users` table has no password column. Passwords are managed entirely by Supabase Auth. Do not implement or expose any endpoint that accepts, stores, or returns passwords. Do not add a password column in any migration.                                                                                                                                                    |
| **`email_verified` column**         | Map to `bool EmailVerified` on the `User` entity. The C# `UserActiveCheckMiddleware` must check both `IsActive = true` AND `EmailVerified = true` on every protected request. Only the `PATCH /api/users/email-verification` endpoint may set `EmailVerified = true`.                                                                                                            |
| **`students` has no `created_by`**  | Do not generate a navigation property or FK for `created_by` on `Student`. Authorship is recorded exclusively in `audit_logs`.                                                                                                                                                                                                                                                   |

---

## 10. Migration Generation Order

```
Phase 1 — Core Identity & Tenancy
  1.  users
        ← includes email_verified BOOLEAN NOT NULL DEFAULT FALSE
        ← UNIQUE(organization_id, user_id) is a composite FK target — create this constraint first
  2.  organizations
  3.  organization_members
        ← UNIQUE(organization_id, user_id) is a composite FK target — create this constraint first

Phase 2 — Student & Teacher Management
  4.  students
        ← UNIQUE(organization_id, id) constraint — required before any child table composite FKs
        ← UNIQUE(organization_id, user_id) WHERE user_id IS NOT NULL
  5.  teacher_students
        ← composite FKs on (organization_id, teacher_id) and (organization_id, student_id)
  6.  invites
        ← composite FK on (organization_id, invited_by)

Phase 3 — Fee Tracking
  7.  student_fees
        ← composite FKs on (organization_id, student_id) and (organization_id, set_by)
  8.  fee_periods
        ← composite FK on (organization_id, student_id)
  9.  fee_payments
        ← composite FKs on (organization_id, student_id) and (organization_id, recorded_by)
  10. [apply triggers: set_updated_at, sync_fee_period_totals, guard_student_not_deleted,
       handle_new_user (auth bridge)]

Phase 4 — Audit
  11. audit_logs

Future phases (do not generate yet)
  12. subscriptions
  13. classes          ← composite FK on (org_id, teacher_id), UNIQUE(org_id, id)
  14. class_students   ← composite FKs on (org_id, class_id) and (org_id, student_id)
  15. lessons          ← composite FK on (org_id, teacher_id)
  16. attendance
```

> **Migration note for upgrades from v1.5.1 (passwordless → password auth):**
>
> - Add `users.email_verified BOOLEAN NOT NULL DEFAULT FALSE` column.
> - Add `CREATE INDEX idx_users_email_verified ON users (email_verified) WHERE deleted_at IS NULL`.
> - Update the `handle_new_user` trigger body to include `email_verified = FALSE` in the INSERT.
> - Supabase Auth configuration: enable email/password sign-in; disable OTP-only sign-in.
>   The `signInWithOtp` endpoint remains enabled in Auth settings because it is used for the
>   post-login email OTP verification step (with `shouldCreateUser: false`).
> - Update allowed redirect URLs: replace magic link callback URLs with password reset callback URLs
>   (`/auth/reset-password`).
> - All existing `public.users` rows: run `UPDATE public.users SET email_verified = TRUE`
>   for all existing users who were previously authenticated via magic link (they already verified
>   their identity by that mechanism). Only newly registered users after the migration cutoff
>   will go through the OTP verification step.
> - Verify no application-layer code references magic link or OTP login flows before applying.

---

## 11. Design Strategy

---

### 11.1 Registration Model — Password-Based, Supabase-Native

**Core principle:** Authentication is handled exclusively by Supabase Auth via email and password.
No magic links, OTP logins, or passwordless flows are used for authentication. A role is not a property
of a user account — it is a property of the relationship between a user and an organisation, stored in
`organization_members.role`. The `users` table carries no role column and no credential storage.

**How a `public.users` row is created:**

The user completes the Sign Up form: first name, last name, email, password. Supabase:

1. Creates `auth.users` with a bcrypt-hashed password (internally managed).
2. Fires the `after_auth_user_created` trigger, which inserts a `public.users` row with
   `first_name`, `last_name` populated from `raw_user_meta_data`, and `email_verified = FALSE`.
3. Returns a session immediately.

After `signUp()` returns a session:

- The app sends an OTP to the user's email (via `signInWithOtp` with `shouldCreateUser: false`).
- The user submits the OTP. On success, the C# API sets `email_verified = TRUE`.
- The app checks `organization_members` to determine org context.

**Registration entry points:**

| Route                           | Who uses it                      | What it creates                                                                                                                                                                        |
| ------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign Up screen (`/auth/signup`) | Anyone — teacher, student, admin | `auth.users` (Supabase) + `public.users` (via trigger) with `email_verified = FALSE`. No org membership yet.                                                                           |
| `/join?token=xyz`               | Invited users — any role         | If no account: shows Sign Up form (email pre-filled), user sets password, same registration flow. If account exists: shows Login form. After auth + OTP verification, invite accepted. |

**The `students` table as billing and academic anchor:**

`students` and `users` remain separate. `students.user_id` is a nullable FK that is NULL until the
student's identity is linked to this org's student record. All fee history, teacher assignments, and
LMS content FK to `students.id` — not `users.id`. The student record is the canonical anchor
regardless of auth status.

**Dual registration paths:**

**Path A — Invite-first** (teacher creates student record, then sends invite):

1. Teacher creates `students` row (`user_id = NULL`, `account_status = 'no_account'`).
2. Teacher sends portal invite → `invites` row created (`role='student'`, `student_id` pre-linked).
3. C# API performs **email lookup**: queries `users.email` against the invite email.
   - **Match found (student already registered):** Link `students.user_id` immediately,
     flip `account_status` → `'active'`, insert `organization_members (role='student')`.
     Mark invite `accepted`. Student does not need to click any token.
   - **No match:** Send invite email with token. `account_status` → `'invite_pending'`.
4. Student clicks invite link `/join?token=<token>` → shown Sign Up form (email pre-filled, read-only) →
   enters first name, last name, password → `signUp()` → DB trigger creates `public.users` →
   OTP verification → invite acceptance → `account_status` → `'active'`.

**Path B — Self-register-first** (student registers independently, teacher invites later):

1. Student completes Sign Up form → `signUp()` → DB trigger creates `public.users` → OTP verification →
   student sees welcome screen: _"Ask your teacher to invite you to their organisation."_
2. Teacher creates `students` row (pseudo-student, `user_id = NULL`).
3. Teacher sends invite → C# API performs email lookup → finds existing `users` row → immediate
   linking. Student receives notification email and gains org access.

**`account_status` state table:**

| `account_status` | `user_id` | Meaning                                                       |
| ---------------- | --------- | ------------------------------------------------------------- |
| `no_account`     | NULL      | Student record exists; no invite sent; no linked user account |
| `invite_pending` | NULL      | Invite sent; student has not yet registered or been matched   |
| `active`         | populated | `users` row linked; student has org access                    |

**Multi-org student participation:**

`students.user_id` uniqueness is scoped to `(organization_id, user_id)`. The same `users` row may
appear as `user_id` in multiple `students` rows — one per org. Fee history, teacher assignments, and
billing periods remain fully isolated per org via their composite FKs.

| Scenario                                  | Outcome                                                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Student joins Org A                       | `students` row in Org A, `user_id` linked, `org_members` inserted                                                                       |
| Student later joins Org B                 | New `students` row in Org B, same `users.id` linked — allowed by per-org unique constraint                                              |
| Student in Org A and Org B simultaneously | Two `students` rows, two `org_members` rows, one `users` row — fully valid                                                              |
| Student leaves Org A                      | `students` soft-deleted, `org_members` hard-deleted. `users` row intact. Org B membership unaffected.                                   |
| Student logs in                           | Auth resolves `users` row via Supabase session. App queries `organization_members` to find all orgs. Presents org switcher if multiple. |

**Email field boundary — critical rule:**

`students.email` (teacher-held contact email) and `users.email` (Supabase authentication email) are
stored independently and may legitimately differ or drift over time:

- Updating `students.email` from the teacher dashboard does **not** update `users.email` and does
  **not** trigger a re-link.
- `students.email` is the contact address the teacher holds on file.
- `users.email` is the address the student used to register with Supabase.
- The email lookup at invite dispatch uses `students.email` to query `users.email`. If they differ,
  the lookup will not match and the token + signup flow will be used instead.
- This boundary must be explicitly documented in the service layer to prevent accidental cross-field
  updates.

---

### 11.2 Payment Tracking — How the Three Tables Work Together

```
Layer 1: student_fees   — Configuration  — "What should this student be charged per month?"
Layer 2: fee_periods    — Obligation     — "What was owed in month X, and how much was paid?"
Layer 3: fee_payments   — Receipts       — "These are the individual payment events."
```

`fee_periods.fee` is snapshotted at creation and is immutable. Fee rate changes in `student_fees`
do not retroactively corrupt historical `fee_periods` records.

Partial payments and corrections are first-class: multiple `fee_payments` rows per period are normal,
and soft-deleting a wrong payment triggers a DB-level recalculation via the trigger in Section 8.2.

All money values are whole integers in the specified currency (no subunits). BDT is the default
currency. Multi-currency is supported by the `currency CHAR(3)` column present on all billing tables.

---

### 11.3 Class-Based Billing — Integration Without Breaking Changes

`student_fees.fee_source` is the routing switch:

| `fee_source`         | How `fee_periods.fee` is calculated                                         |
| -------------------- | --------------------------------------------------------------------------- |
| `'manual'`           | Directly from `student_fees.manual_fee`. Current behaviour.                 |
| `'class_calculated'` | Sum of `COALESCE(cs.fee_override, c.fee_amount)` for all active enrolments. |
| `'override'`         | Class sum calculated for audit display; `manual_fee` is the billed amount.  |

Switching a student to class-based billing is a single data update to `student_fees`. No schema change,
no existing period records touched, `fee_payments` completely unaffected.

---

### 11.4 Authorship Tracking Without `created_by`

`created_by` has been removed from `students` (and is not present on any current table). Authorship
of student records and all significant mutations is recorded in `audit_logs` by the C# service layer
in the same transaction as the write. Every student creation must produce an `audit_logs` entry with
`action = 'student.created'`, `entity_type = 'students'`, `entity_id = <student.id>`, and
`actor_id = <authenticated user id>`. This provides complete authorship auditability without the
schema coupling of a hard-coded `created_by` FK that restricts delete behaviour.

---

### 11.5 Tenant Isolation — Composite FK Strategy

**The problem:** Standard scalar FKs prevent referencing non-existent users, but they do **not** prevent
a teacher from Org A being linked to a student in Org B if the application layer has an authorization
bug. In a multi-tenant SaaS this is a critical data isolation risk.

**The solution:** Composite foreign keys that include `organization_id` in the reference.

```
Standard FK:    teacher_students.teacher_id → users.id
                (only checks: does this user exist?)

Composite FK:   teacher_students.(organization_id, teacher_id)
                    → organization_members.(organization_id, user_id)
                (checks: does this user exist AND are they a member of THIS specific organization?)
```

**Where composite FKs are applied:**

| Table                     | Composite FK                                     | What it enforces                             |
| ------------------------- | ------------------------------------------------ | -------------------------------------------- |
| `teacher_students`        | `(org_id, teacher_id)` → `organization_members`  | Teacher is a member of this org              |
| `teacher_students`        | `(org_id, student_id)` → `students`              | Student belongs to this org                  |
| `invites`                 | `(org_id, invited_by)` → `organization_members`  | Invite sender is an org member               |
| `student_fees`            | `(org_id, student_id)` → `students`              | Fee config targets a student in this org     |
| `student_fees`            | `(org_id, set_by)` → `organization_members`      | Fee setter is an org member                  |
| `fee_periods`             | `(org_id, student_id)` → `students`              | Billing period targets a student in this org |
| `fee_payments`            | `(org_id, student_id)` → `students`              | Payment targets a student in this org        |
| `fee_payments`            | `(org_id, recorded_by)` → `organization_members` | Payment recorder is an org member            |
| `classes` (future)        | `(org_id, teacher_id)` → `organization_members`  | Class teacher is an org member               |
| `class_students` (future) | `(org_id, student_id)` → `students`              | Enrolled student is in this org              |
| `lessons` (future)        | `(org_id, teacher_id)` → `organization_members`  | Lesson teacher is an org member              |

**Required prerequisites for composite FKs to work in PostgreSQL:**

1. `organization_members` must have `UNIQUE(organization_id, user_id)` — present from v1.
2. `students` must have `UNIQUE(organization_id, id)` — present throughout.
3. `classes` must have `UNIQUE(organization_id, id)` — present in the future stub.

**EF Core note:** Composite FKs must be declared in raw SQL migrations (e.g., `migrationBuilder.Sql(...)`)
since EF Core's `HasForeignKey` fluent API targets navigation properties, not raw column pairs.

---

### 11.6 Why the Schema Avoids Future Breaking Migrations — Summary

| Future capability                             | How the current schema already supports it                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Any user creating an organisation             | `organizations.owner_id → users(id)`. No role restriction on who may insert.                                                |
| Students registering before teacher invite    | `users` row created independently; `students.user_id` stays NULL until email lookup links them at invite dispatch           |
| One person as student in multiple orgs        | `UNIQUE(organization_id, user_id)` on `students` allows same `users.id` across multiple org-scoped student rows             |
| Student logging in and switching orgs         | Auth resolves `users` row via Supabase session. App queries `organization_members` for all memberships. Org switcher in UI. |
| Students gaining portal access                | `students.user_id` nullable FK + `account_status`. Linking is a data operation, no schema change.                           |
| Fee rate changes mid-year                     | `student_fees` effective dates. `fee_periods.fee` is an immutable snapshot.                                                 |
| Partial payments                              | `fee_payments` ledger. `fee_periods.amount_paid` cache. Partial is first-class.                                             |
| Payment corrections                           | Soft-delete wrong row, insert corrected row. Trigger recalculates. No in-place money edits.                                 |
| Class-based billing                           | `fee_source` routing + `classes.fee_amount` + `class_students.fee_override`.                                                |
| Teacher override of class fees                | `fee_source = 'override'` + `manual_fee`. Class total preserved for audit.                                                  |
| Admin role                                    | `organization_members.role = 'admin'` already accepted. No new tables.                                                      |
| Multi-currency                                | `currency CHAR(3)` on all money tables from day one. BDT default.                                                           |
| LMS content for students                      | Future content tables FK to `students.id`, not `users.id`.                                                                  |
| Attendance tracking                           | `attendance` FKs to `lessons` and `students`. Zero impact on existing tables.                                               |
| Authorship auditing                           | `audit_logs` captures actor on every mutation. No `created_by` FK required.                                                 |
| Cross-tenant data leak prevention             | Composite FKs including `organization_id` enforce isolation at DB level.                                                    |
| Soft-deleted parent references                | DB trigger (Section 8.3) raises exception if child inserted against deleted student.                                        |
| TOTP MFA, SAML SSO (password auth extensions) | Supabase Auth supports both as add-ons alongside password auth. No schema changes needed — auth is entirely external.       |
| Email OTP verification tracking               | `users.email_verified BOOLEAN` already present. C# middleware and API endpoint handle the full lifecycle.                   |

---

_End of TuitionIQ Database Schema — v2.0.0_
