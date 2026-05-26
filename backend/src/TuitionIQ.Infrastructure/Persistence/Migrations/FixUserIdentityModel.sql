-- FixUserIdentityModel — corrects the user identity model.
-- Mirrors the Up() of migration 20260526023457_FixUserIdentityModel for MANUAL application.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
-- Safe to re-run: every statement is CREATE OR REPLACE or DROP ... IF EXISTS + CREATE, and the
-- whole script is one transaction (all-or-nothing). It does NOT recreate the
-- after_auth_user_created trigger — that already points at handle_new_user(), which the
-- CREATE OR REPLACE below updates in place.

BEGIN;

-- 1. New signups: let public.users.id default to gen_random_uuid() (independent internal id);
--    store the Supabase auth uid only in auth_user_id.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        auth_user_id,
        email,
        first_name,
        last_name,
        email_verified,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id::TEXT,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        FALSE,
        TRUE,
        NOW(),
        NOW()
    )
    ON CONFLICT (auth_user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 2. Canonical resolver: JWT sub (auth.uid()) -> internal public.users.id.
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()::text
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Org-id helper resolves the internal user id before matching memberships.
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS UUID[] AS $$
    SELECT array_agg(organization_id)
    FROM public.organization_members
    WHERE user_id = public.current_user_id()
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. Rewrite policies that compared auth.uid() to an internal-id column.
DROP POLICY IF EXISTS organizations_insert ON public.organizations;
CREATE POLICY organizations_insert ON public.organizations
    FOR INSERT WITH CHECK (owner_id = public.current_user_id());

DROP POLICY IF EXISTS student_fees_staff_access ON public.student_fees;
CREATE POLICY student_fees_staff_access ON public.student_fees
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = public.current_user_id()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
        AND deleted_at IS NULL
    ) WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = public.current_user_id()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

DROP POLICY IF EXISTS fee_payments_staff_access ON public.fee_payments;
CREATE POLICY fee_payments_staff_access ON public.fee_payments
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = public.current_user_id()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
        AND deleted_at IS NULL
    ) WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = public.current_user_id()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

DROP POLICY IF EXISTS fee_periods_student_self ON public.fee_periods;
CREATE POLICY fee_periods_student_self ON public.fee_periods
    FOR SELECT USING (
        student_id IN (
            SELECT id
            FROM public.students
            WHERE user_id = public.current_user_id()
                AND deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS fee_periods_staff_access ON public.fee_periods;
CREATE POLICY fee_periods_staff_access ON public.fee_periods
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = public.current_user_id()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
        AND deleted_at IS NULL
    ) WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = public.current_user_id()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

DROP POLICY IF EXISTS users_read ON public.users;
CREATE POLICY users_read ON public.users
    FOR SELECT USING (
        id = public.current_user_id()
        OR id IN (
            SELECT user_id
            FROM public.organization_members
            WHERE organization_id = ANY(public.get_user_org_ids())
        )
    );

DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update ON public.users
    FOR UPDATE USING (id = public.current_user_id())
    WITH CHECK (id = public.current_user_id());

DROP POLICY IF EXISTS audit_logs_staff_read ON public.audit_logs;
CREATE POLICY audit_logs_staff_read ON public.audit_logs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = public.current_user_id()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

DROP POLICY IF EXISTS audit_logs_staff_insert ON public.audit_logs;
CREATE POLICY audit_logs_staff_insert ON public.audit_logs
    FOR INSERT WITH CHECK (
        organization_id IS NULL
        OR organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = public.current_user_id()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICATION (run these separately after the COMMIT above)
-- ---------------------------------------------------------------------------
-- a) Functions exist:
--    SELECT proname FROM pg_proc WHERE proname IN ('handle_new_user','current_user_id','get_user_org_ids');
--
-- b) No policy still references auth.uid() against an internal-id column (expect 0 rows):
--    SELECT polrelid::regclass AS table, polname
--    FROM pg_policy
--    WHERE pg_get_expr(polqual, polrelid) LIKE '%auth.uid()%'
--       OR pg_get_expr(polwithcheck, polrelid) LIKE '%auth.uid()%';
--
-- c) Backfill check — any legacy rows where id still equals the auth uid are harmless
--    (resolution goes through auth_user_id either way), but you can spot them with:
--    SELECT count(*) AS legacy_id_equals_sub FROM public.users WHERE id::text = auth_user_id;
