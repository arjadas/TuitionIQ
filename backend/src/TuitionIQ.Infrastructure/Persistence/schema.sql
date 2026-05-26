-- =============================================================================
-- TuitionIQ — Consolidated PostgreSQL / Supabase schema (canonical, final)
-- =============================================================================
-- Incorporates the corrected identity model:
--
--   public.users.id           = INTERNAL application user id (independent UUID)
--   public.users.auth_user_id = Supabase auth.users.id  == JWT 'sub'  (UNIQUE link)
--
-- NEVER assume auth.uid() = users.id. Identity always resolves in this direction:
--   auth.uid() (JWT sub)  ->  users.auth_user_id  ->  users.id
-- through public.current_user_id(). Every foreign key that points at a person
-- (owner_id, user_id, actor_id, invited_by, teacher_id, assigned_by, set_by,
-- recorded_by, waived_by) references the INTERNAL public.users.id.
--
-- Target: a FRESH Supabase project (relies on the Supabase-managed `auth` schema
-- and auth.uid()). Idempotent where practical (IF NOT EXISTS / CREATE OR REPLACE /
-- DROP+CREATE), so it is safe to re-run.
--
-- For an EXISTING database created from the older EF migrations, do NOT run this
-- file — apply the incremental Migrations/FixUserIdentityModel.sql instead.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Canonical identity table. `id` is independent (never equals the auth uid);
-- `auth_user_id` is the sole, UNIQUE link back to Supabase Auth (auth.users.id).
CREATE TABLE IF NOT EXISTS public.users (
    id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id   varchar(255) NOT NULL,            -- = auth.users.id (JWT sub)
    email          varchar(255) NOT NULL,
    first_name     varchar(100) NOT NULL,
    last_name      varchar(100) NOT NULL,
    phone          varchar(30),
    avatar_url     text,
    email_verified boolean      NOT NULL DEFAULT false,
    is_active      boolean      NOT NULL DEFAULT true,
    created_at     timestamptz  NOT NULL DEFAULT NOW(),
    updated_at     timestamptz  NOT NULL DEFAULT NOW(),
    deleted_at     timestamptz
);

CREATE TABLE IF NOT EXISTS public.organizations (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    name            varchar(255) NOT NULL,
    slug            varchar(100) NOT NULL,
    owner_id        uuid         NOT NULL,
    plan            varchar(50)  NOT NULL DEFAULT 'free',
    plan_expires_at timestamptz,
    settings        jsonb        DEFAULT '{}'::jsonb,
    created_at      timestamptz  NOT NULL DEFAULT NOW(),
    updated_at      timestamptz  NOT NULL DEFAULT NOW(),
    deleted_at      timestamptz,
    CONSTRAINT fk_organizations_owner
        FOREIGN KEY (owner_id) REFERENCES public.users (id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.organization_members (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL,
    user_id         uuid        NOT NULL,             -- internal users.id
    role            varchar(50) NOT NULL,             -- Owner | Admin | Teacher | Student
    invited_by      uuid,                             -- internal users.id
    joined_at       timestamptz,
    created_at      timestamptz NOT NULL DEFAULT NOW(),
    updated_at      timestamptz NOT NULL DEFAULT NOW(),
    -- UNIQUE constraint (not just an index) so it can back the composite FKs below.
    CONSTRAINT uq_org_members_org_user UNIQUE (organization_id, user_id),
    CONSTRAINT fk_org_members_org
        FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_org_members_user
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE,
    CONSTRAINT fk_org_members_invited_by
        FOREIGN KEY (invited_by) REFERENCES public.users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.students (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid         NOT NULL,
    user_id         uuid,                             -- internal users.id (nullable: unlinked students)
    first_name      varchar(100) NOT NULL,
    last_name       varchar(100) NOT NULL,
    email           varchar(255),
    phone           varchar(30),
    notes           text,
    status          varchar(50)  NOT NULL,
    account_status  varchar(50)  NOT NULL,
    metadata        jsonb        DEFAULT '{}'::jsonb,
    created_at      timestamptz  NOT NULL DEFAULT NOW(),
    updated_at      timestamptz  NOT NULL DEFAULT NOW(),
    deleted_at      timestamptz,
    -- UNIQUE constraint (not just an index) so it can back the composite FKs below.
    CONSTRAINT uq_students_org_id UNIQUE (organization_id, id),
    CONSTRAINT fk_students_org
        FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_students_user
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.student_fees (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid         NOT NULL,
    student_id      uuid         NOT NULL,
    set_by          uuid         NOT NULL,            -- internal users.id (org member)
    fee_source      varchar(50)  NOT NULL,
    manual_fee      bigint,
    override_reason text,
    currency        varchar(3)   NOT NULL,
    effective_from  date         NOT NULL,
    effective_to    date,
    is_active       boolean      NOT NULL DEFAULT true,
    notes           text,
    created_at      timestamptz  NOT NULL DEFAULT NOW(),
    updated_at      timestamptz  NOT NULL DEFAULT NOW(),
    deleted_at      timestamptz,
    CONSTRAINT fk_student_fees_org
        FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.teacher_students (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL,
    teacher_id      uuid        NOT NULL,             -- internal users.id (org member)
    student_id      uuid        NOT NULL,
    assigned_at     timestamptz NOT NULL DEFAULT NOW(),
    assigned_by     uuid,                             -- internal users.id
    is_primary      boolean     NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT NOW(),
    updated_at      timestamptz NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_teacher_students_org
        FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_teacher_students_assigned_by
        FOREIGN KEY (assigned_by) REFERENCES public.users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.fee_periods (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL,
    student_id      uuid        NOT NULL,
    student_fee_id  uuid,
    period_year     smallint    NOT NULL,
    period_month    smallint    NOT NULL,
    fee             bigint      NOT NULL,
    amount_paid     bigint      NOT NULL DEFAULT 0,
    currency        varchar(3)  NOT NULL,
    status          varchar(50) NOT NULL,             -- Unpaid | Partial | Paid | Waived | Overdue
    due_date        date,
    waived_by       uuid,                             -- internal users.id
    waived_at       timestamptz,
    waiver_reason   text,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT NOW(),
    updated_at      timestamptz NOT NULL DEFAULT NOW(),
    deleted_at      timestamptz,
    CONSTRAINT fk_fee_periods_org
        FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_fee_periods_student_fee
        FOREIGN KEY (student_fee_id) REFERENCES public.student_fees (id) ON DELETE SET NULL,
    CONSTRAINT fk_fee_periods_waived_by
        FOREIGN KEY (waived_by) REFERENCES public.users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.fee_payments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid        NOT NULL,
    student_id      uuid        NOT NULL,
    fee_period_id   uuid        NOT NULL,
    recorded_by     uuid        NOT NULL,             -- internal users.id (org member)
    amount          bigint      NOT NULL,
    currency        varchar(3)  NOT NULL,
    payment_date    date        NOT NULL,
    payment_method  varchar(50) NOT NULL,
    reference       varchar(255),
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT NOW(),
    updated_at      timestamptz NOT NULL DEFAULT NOW(),
    deleted_at      timestamptz,
    CONSTRAINT fk_fee_payments_period
        FOREIGN KEY (fee_period_id) REFERENCES public.fee_periods (id) ON DELETE RESTRICT,
    CONSTRAINT fk_fee_payments_org
        FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid,
    actor_id        uuid,                             -- internal users.id of the actor
    action          varchar(100) NOT NULL,
    entity_type     varchar(100) NOT NULL,
    entity_id       uuid,
    old_values      jsonb,
    new_values      jsonb,
    ip_address      inet,
    user_agent      text,
    created_at      timestamptz  NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_audit_logs_org
        FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_logs_actor
        FOREIGN KEY (actor_id) REFERENCES public.users (id) ON DELETE SET NULL
);

-- =============================================================================
-- 2. COMPOSITE FOREIGN KEYS (org-scoped referential integrity)
-- =============================================================================
-- Guarantee that teacher/student/staff rows belong to the SAME organization.
-- Targets are the UNIQUE constraints declared above. Wrapped in guards so the
-- script is safe to re-run.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ts_org_teacher') THEN
        ALTER TABLE public.teacher_students
            ADD CONSTRAINT fk_ts_org_teacher FOREIGN KEY (organization_id, teacher_id)
            REFERENCES public.organization_members (organization_id, user_id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ts_org_student') THEN
        ALTER TABLE public.teacher_students
            ADD CONSTRAINT fk_ts_org_student FOREIGN KEY (organization_id, student_id)
            REFERENCES public.students (organization_id, id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sf_org_student') THEN
        ALTER TABLE public.student_fees
            ADD CONSTRAINT fk_sf_org_student FOREIGN KEY (organization_id, student_id)
            REFERENCES public.students (organization_id, id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sf_org_set_by') THEN
        ALTER TABLE public.student_fees
            ADD CONSTRAINT fk_sf_org_set_by FOREIGN KEY (organization_id, set_by)
            REFERENCES public.organization_members (organization_id, user_id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fp_org_student') THEN
        ALTER TABLE public.fee_periods
            ADD CONSTRAINT fk_fp_org_student FOREIGN KEY (organization_id, student_id)
            REFERENCES public.students (organization_id, id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fpy_org_student') THEN
        ALTER TABLE public.fee_payments
            ADD CONSTRAINT fk_fpy_org_student FOREIGN KEY (organization_id, student_id)
            REFERENCES public.students (organization_id, id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fpy_org_recorded_by') THEN
        ALTER TABLE public.fee_payments
            ADD CONSTRAINT fk_fpy_org_recorded_by FOREIGN KEY (organization_id, recorded_by)
            REFERENCES public.organization_members (organization_id, user_id) ON DELETE RESTRICT;
    END IF;
END $$;

-- =============================================================================
-- 3. INDEXES
-- =============================================================================
-- users — auth_user_id is the canonical lookup key (sub -> internal id).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id   ON public.users (auth_user_id);
CREATE        INDEX IF NOT EXISTS idx_users_deleted_at     ON public.users (deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email          ON public.users (email)          WHERE deleted_at IS NULL;
CREATE        INDEX IF NOT EXISTS idx_users_email_verified ON public.users (email_verified) WHERE deleted_at IS NULL;

-- organizations
CREATE        INDEX IF NOT EXISTS idx_organizations_deleted_at ON public.organizations (deleted_at);
CREATE        INDEX IF NOT EXISTS idx_organizations_owner_id   ON public.organizations (owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug       ON public.organizations (slug) WHERE deleted_at IS NULL;

-- organization_members  (org_user uniqueness is the uq_org_members_org_user constraint)
CREATE INDEX IF NOT EXISTS idx_org_members_role           ON public.organization_members (organization_id, role);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id        ON public.organization_members (user_id);
CREATE INDEX IF NOT EXISTS ix_organization_members_invited_by ON public.organization_members (invited_by);

-- students  (org_id uniqueness is the uq_students_org_id constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_org_user_id ON public.students (organization_id, user_id) WHERE user_id IS NOT NULL;
CREATE        INDEX IF NOT EXISTS ix_students_user_id      ON public.students (user_id);

-- student_fees
CREATE        INDEX IF NOT EXISTS idx_student_fees_effective      ON public.student_fees (student_id, effective_from, effective_to);
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_fees_one_active     ON public.student_fees (student_id) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE        INDEX IF NOT EXISTS idx_student_fees_org_active     ON public.student_fees (organization_id, is_active) WHERE deleted_at IS NULL;
CREATE        INDEX IF NOT EXISTS idx_student_fees_student_active ON public.student_fees (student_id, is_active) WHERE deleted_at IS NULL;

-- teacher_students
CREATE        INDEX IF NOT EXISTS idx_teacher_students_org         ON public.teacher_students (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_students_pair        ON public.teacher_students (teacher_id, student_id);
CREATE        INDEX IF NOT EXISTS idx_teacher_students_student     ON public.teacher_students (student_id);
CREATE        INDEX IF NOT EXISTS idx_teacher_students_teacher     ON public.teacher_students (teacher_id);
CREATE        INDEX IF NOT EXISTS ix_teacher_students_assigned_by  ON public.teacher_students (assigned_by);

-- fee_periods
CREATE        INDEX IF NOT EXISTS idx_fee_periods_due_date       ON public.fee_periods (due_date) WHERE status IN ('Unpaid', 'Partial', 'Overdue') AND deleted_at IS NULL;
CREATE        INDEX IF NOT EXISTS idx_fee_periods_org_status     ON public.fee_periods (organization_id, status) WHERE deleted_at IS NULL;
CREATE        INDEX IF NOT EXISTS idx_fee_periods_org_year_month ON public.fee_periods (organization_id, period_year, period_month) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_periods_student_id     ON public.fee_periods (student_id, period_year, period_month) WHERE deleted_at IS NULL;
CREATE        INDEX IF NOT EXISTS ix_fee_periods_student_fee_id  ON public.fee_periods (student_fee_id);
CREATE        INDEX IF NOT EXISTS ix_fee_periods_waived_by       ON public.fee_periods (waived_by);

-- fee_payments
CREATE INDEX IF NOT EXISTS idx_fee_payments_org_date     ON public.fee_payments (organization_id, payment_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fee_payments_period_id    ON public.fee_payments (fee_period_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fee_payments_recorded_by  ON public.fee_payments (recorded_by);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student_id   ON public.fee_payments (student_id, payment_date) WHERE deleted_at IS NULL;

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_action   ON public.audit_logs (action, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs (actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity   ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id   ON public.audit_logs (organization_id, created_at);

-- =============================================================================
-- 4. HELPER FUNCTIONS
-- =============================================================================

-- Touch updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Block linking financial/teaching rows to a soft-deleted student.
CREATE OR REPLACE FUNCTION public.guard_student_not_deleted()
RETURNS TRIGGER AS $$
DECLARE
    v_deleted_at TIMESTAMPTZ;
BEGIN
    SELECT deleted_at INTO v_deleted_at
        FROM public.students
     WHERE id = NEW.student_id;

    IF v_deleted_at IS NOT NULL THEN
        RAISE EXCEPTION
            'Cannot link to a soft-deleted student (id: %). Set deleted_at = NULL or use a different student.',
            NEW.student_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- AUTH: provision public.users on first Supabase sign-up.
-- `id` is OMITTED so the gen_random_uuid() default produces an INDEPENDENT internal
-- id; the Supabase auth uid is stored only in auth_user_id. Conflicts are resolved on
-- auth_user_id (the canonical link), never on id.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        auth_user_id, email, first_name, last_name, email_verified, is_active, created_at, updated_at
    )
    VALUES (
        NEW.id::TEXT,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        FALSE,    -- email_verified is never set true here; only the verify endpoint may flip it
        TRUE,
        NOW(),
        NOW()
    )
    ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Never block auth.users creation. UserActiveCheckMiddleware provisions any missed row.
    RAISE WARNING 'handle_new_user failed for auth_user_id=%: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- AUTH: the canonical resolver. Maps the JWT sub (auth.uid()) to the INTERNAL users.id.
-- Every RLS predicate that needs "the current user" uses this, NOT auth.uid() directly,
-- because auth.uid() != users.id.
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()::text
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- AUTH: organizations the current user belongs to, resolved via the internal id.
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS UUID[] AS $$
    SELECT array_agg(organization_id)
    FROM public.organization_members
    WHERE user_id = public.current_user_id()
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Keep fee_periods.amount_paid / status in sync with its payments.
CREATE OR REPLACE FUNCTION public.sync_fee_period_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_period_id UUID;
    v_total BIGINT;
    v_fee BIGINT;
    v_status VARCHAR(50);
BEGIN
    v_period_id := COALESCE(NEW.fee_period_id, OLD.fee_period_id);

    SELECT COALESCE(SUM(fp.amount), 0), p.fee
        INTO v_total, v_fee
        FROM public.fee_periods p
        LEFT JOIN public.fee_payments fp
            ON fp.fee_period_id = p.id
         AND fp.deleted_at IS NULL
     WHERE p.id = v_period_id
     GROUP BY p.fee;

    v_status := CASE
        WHEN v_total = 0 THEN 'Unpaid'
        WHEN v_total >= v_fee THEN 'Paid'
        ELSE 'Partial'
    END;

    UPDATE public.fee_periods
         SET amount_paid = v_total,
             status = v_status,
             updated_at = NOW()
     WHERE id = v_period_id
       AND status NOT IN ('Waived', 'Overdue');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. TRIGGERS  (CREATE OR REPLACE TRIGGER requires PostgreSQL 14+ / Supabase PG15+)
-- =============================================================================
CREATE OR REPLACE TRIGGER trg_users_updated_at                BEFORE UPDATE ON public.users                FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_organizations_updated_at        BEFORE UPDATE ON public.organizations        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_organization_members_updated_at BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_students_updated_at             BEFORE UPDATE ON public.students             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_student_fees_updated_at         BEFORE UPDATE ON public.student_fees         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_teacher_students_updated_at     BEFORE UPDATE ON public.teacher_students     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_fee_periods_updated_at          BEFORE UPDATE ON public.fee_periods          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_fee_payments_updated_at         BEFORE UPDATE ON public.fee_payments         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_guard_teacher_students_student BEFORE INSERT ON public.teacher_students FOR EACH ROW EXECUTE FUNCTION public.guard_student_not_deleted();
CREATE OR REPLACE TRIGGER trg_guard_student_fees_student     BEFORE INSERT ON public.student_fees     FOR EACH ROW EXECUTE FUNCTION public.guard_student_not_deleted();
CREATE OR REPLACE TRIGGER trg_guard_fee_periods_student      BEFORE INSERT ON public.fee_periods      FOR EACH ROW EXECUTE FUNCTION public.guard_student_not_deleted();
CREATE OR REPLACE TRIGGER trg_guard_fee_payments_student     BEFORE INSERT ON public.fee_payments     FOR EACH ROW EXECUTE FUNCTION public.guard_student_not_deleted();

CREATE OR REPLACE TRIGGER trg_sync_fee_period_on_payment
    AFTER INSERT OR UPDATE OF deleted_at, amount ON public.fee_payments
    FOR EACH ROW EXECUTE FUNCTION public.sync_fee_period_totals();

-- AUTH: provision public.users when Supabase creates an auth.users row.
CREATE OR REPLACE TRIGGER after_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 6. ROW-LEVEL SECURITY
-- =============================================================================
-- Defense-in-depth: the C# API connects with a privileged role that BYPASSES RLS,
-- so these policies guard any direct (PostgREST / anon-key) access. Every "is this
-- me / am I a member" check resolves through current_user_id() / get_user_org_ids()
-- (auth.uid() -> auth_user_id -> users.id) — auth.uid() is NEVER compared to an
-- internal-id column.
ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_students     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_periods          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           ENABLE ROW LEVEL SECURITY;

-- users -----------------------------------------------------------------------
DROP POLICY IF EXISTS users_read ON public.users;
CREATE POLICY users_read ON public.users
    FOR SELECT USING (
        id = public.current_user_id()
        OR id IN (
            SELECT user_id FROM public.organization_members
            WHERE organization_id = ANY(public.get_user_org_ids())
        )
    );

DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update ON public.users
    FOR UPDATE USING (id = public.current_user_id())
    WITH CHECK (id = public.current_user_id());

-- organizations ---------------------------------------------------------------
DROP POLICY IF EXISTS organizations_select ON public.organizations;
CREATE POLICY organizations_select ON public.organizations
    FOR SELECT USING (id = ANY(public.get_user_org_ids()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS organizations_insert ON public.organizations;
CREATE POLICY organizations_insert ON public.organizations
    FOR INSERT WITH CHECK (owner_id = public.current_user_id());

DROP POLICY IF EXISTS organizations_update ON public.organizations;
CREATE POLICY organizations_update ON public.organizations
    FOR UPDATE USING (id = ANY(public.get_user_org_ids()) AND deleted_at IS NULL)
    WITH CHECK (id = ANY(public.get_user_org_ids()));

-- organization_members --------------------------------------------------------
DROP POLICY IF EXISTS org_members_isolation_select ON public.organization_members;
CREATE POLICY org_members_isolation_select ON public.organization_members
    FOR SELECT USING (organization_id = ANY(public.get_user_org_ids()));

DROP POLICY IF EXISTS org_members_isolation_insert ON public.organization_members;
CREATE POLICY org_members_isolation_insert ON public.organization_members
    FOR INSERT WITH CHECK (organization_id = ANY(public.get_user_org_ids()));

DROP POLICY IF EXISTS org_members_isolation_update ON public.organization_members;
CREATE POLICY org_members_isolation_update ON public.organization_members
    FOR UPDATE USING (organization_id = ANY(public.get_user_org_ids()))
    WITH CHECK (organization_id = ANY(public.get_user_org_ids()));

DROP POLICY IF EXISTS org_members_isolation_delete ON public.organization_members;
CREATE POLICY org_members_isolation_delete ON public.organization_members
    FOR DELETE USING (organization_id = ANY(public.get_user_org_ids()));

-- students --------------------------------------------------------------------
DROP POLICY IF EXISTS students_org_isolation_select ON public.students;
CREATE POLICY students_org_isolation_select ON public.students
    FOR SELECT USING (organization_id = ANY(public.get_user_org_ids()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS students_org_isolation_insert ON public.students;
CREATE POLICY students_org_isolation_insert ON public.students
    FOR INSERT WITH CHECK (organization_id = ANY(public.get_user_org_ids()));

DROP POLICY IF EXISTS students_org_isolation_update ON public.students;
CREATE POLICY students_org_isolation_update ON public.students
    FOR UPDATE USING (organization_id = ANY(public.get_user_org_ids()) AND deleted_at IS NULL)
    WITH CHECK (organization_id = ANY(public.get_user_org_ids()));

-- teacher_students ------------------------------------------------------------
DROP POLICY IF EXISTS teacher_students_org_isolation ON public.teacher_students;
CREATE POLICY teacher_students_org_isolation ON public.teacher_students
    FOR ALL USING (organization_id = ANY(public.get_user_org_ids()))
    WITH CHECK (organization_id = ANY(public.get_user_org_ids()));

-- student_fees ----------------------------------------------------------------
DROP POLICY IF EXISTS student_fees_staff_access ON public.student_fees;
CREATE POLICY student_fees_staff_access ON public.student_fees
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = public.current_user_id() AND role IN ('Owner', 'Admin', 'Teacher')
        )
        AND deleted_at IS NULL
    ) WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = public.current_user_id() AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

-- fee_payments ----------------------------------------------------------------
DROP POLICY IF EXISTS fee_payments_staff_access ON public.fee_payments;
CREATE POLICY fee_payments_staff_access ON public.fee_payments
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = public.current_user_id() AND role IN ('Owner', 'Admin', 'Teacher')
        )
        AND deleted_at IS NULL
    ) WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = public.current_user_id() AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

-- fee_periods -----------------------------------------------------------------
DROP POLICY IF EXISTS fee_periods_student_self ON public.fee_periods;
CREATE POLICY fee_periods_student_self ON public.fee_periods
    FOR SELECT USING (
        student_id IN (
            SELECT id FROM public.students
            WHERE user_id = public.current_user_id() AND deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS fee_periods_staff_access ON public.fee_periods;
CREATE POLICY fee_periods_staff_access ON public.fee_periods
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = public.current_user_id() AND role IN ('Owner', 'Admin', 'Teacher')
        )
        AND deleted_at IS NULL
    ) WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = public.current_user_id() AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

-- audit_logs ------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_staff_read ON public.audit_logs;
CREATE POLICY audit_logs_staff_read ON public.audit_logs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = public.current_user_id() AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

DROP POLICY IF EXISTS audit_logs_staff_insert ON public.audit_logs;
CREATE POLICY audit_logs_staff_insert ON public.audit_logs
    FOR INSERT WITH CHECK (
        organization_id IS NULL
        OR organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = public.current_user_id() AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

-- =============================================================================
-- End of schema.
-- =============================================================================
