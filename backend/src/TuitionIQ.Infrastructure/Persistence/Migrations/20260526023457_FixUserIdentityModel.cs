using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TuitionIQ.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Corrects the identity model so it no longer assumes <c>public.users.id == auth.users.id</c>.
    /// The internal <c>public.users.id</c> is independent (<c>gen_random_uuid()</c>); the Supabase
    /// auth uid (JWT <c>sub</c>) lives only in <c>public.users.auth_user_id</c>. The DB trigger and
    /// every RLS policy are rewritten to resolve identity through <c>auth_user_id</c> via the new
    /// <c>public.current_user_id()</c> helper.
    ///
    /// NOTE: Apply this to Supabase manually (e.g. the SQL editor). It is intentionally not
    /// auto-applied — the repo migration history has drifted from the live database.
    /// </summary>
    public partial class FixUserIdentityModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Trigger now lets public.users.id default to gen_random_uuid() and stores the
            //    Supabase auth uid only in auth_user_id (the canonical link), keyed for conflict
            //    resolution on auth_user_id rather than id.
            migrationBuilder.Sql(@"
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
");

            // 2. Canonical resolver: JWT sub (auth.uid()) -> internal public.users.id.
            migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
    SELECT id FROM public.users WHERE auth_user_id = auth.uid()::text
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, pg_temp;
");

            // 3. Org-id helper now resolves the internal user id before matching memberships.
            migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS UUID[] AS $$
    SELECT array_agg(organization_id)
    FROM public.organization_members
    WHERE user_id = public.current_user_id()
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, pg_temp;
");

            // 4. Rewrite every policy that compared auth.uid() to an internal-id column.
            //    Policies that key off get_user_org_ids() inherit the fix and are left untouched.
            migrationBuilder.Sql(@"
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
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restore the prior (contaminated) trigger that forced public.users.id = auth uid.
            migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        id,
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
        NEW.id,
        NEW.id::TEXT,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        FALSE,
        TRUE,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
");

            migrationBuilder.Sql(@"
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS UUID[] AS $$
    SELECT array_agg(organization_id)
    FROM public.organization_members
    WHERE user_id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
");

            migrationBuilder.Sql(@"
DROP POLICY IF EXISTS organizations_insert ON public.organizations;
CREATE POLICY organizations_insert ON public.organizations
    FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS student_fees_staff_access ON public.student_fees;
CREATE POLICY student_fees_staff_access ON public.student_fees
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
        AND deleted_at IS NULL
    ) WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

DROP POLICY IF EXISTS fee_payments_staff_access ON public.fee_payments;
CREATE POLICY fee_payments_staff_access ON public.fee_payments
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
        AND deleted_at IS NULL
    ) WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

DROP POLICY IF EXISTS fee_periods_student_self ON public.fee_periods;
CREATE POLICY fee_periods_student_self ON public.fee_periods
    FOR SELECT USING (
        student_id IN (
            SELECT id
            FROM public.students
            WHERE user_id = auth.uid()
                AND deleted_at IS NULL
        )
    );

DROP POLICY IF EXISTS fee_periods_staff_access ON public.fee_periods;
CREATE POLICY fee_periods_staff_access ON public.fee_periods
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
        AND deleted_at IS NULL
    ) WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

DROP POLICY IF EXISTS users_read ON public.users;
CREATE POLICY users_read ON public.users
    FOR SELECT USING (
        id = auth.uid()
        OR id IN (
            SELECT user_id
            FROM public.organization_members
            WHERE organization_id = ANY(public.get_user_org_ids())
        )
    );

DROP POLICY IF EXISTS users_self_update ON public.users;
CREATE POLICY users_self_update ON public.users
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS audit_logs_staff_read ON public.audit_logs;
CREATE POLICY audit_logs_staff_read ON public.audit_logs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid()
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
            WHERE user_id = auth.uid()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

DROP FUNCTION IF EXISTS public.current_user_id();
");
        }
    }
}
