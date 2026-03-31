using System;
using System.Collections.Generic;
using System.Net;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TuitionIQ.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "public");

            // Ensure pgcrypto is available FIRST
            migrationBuilder.Sql(@"CREATE EXTENSION IF NOT EXISTS pgcrypto;");

            migrationBuilder.CreateTable(
                name: "users",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    auth_user_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    first_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    last_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    avatar_url = table.Column<string>(type: "text", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "organizations",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    owner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    plan = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false, defaultValue: "free"),
                    plan_expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    settings = table.Column<Dictionary<string, object>>(type: "jsonb", nullable: true, defaultValueSql: "'{}'::jsonb"),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_organizations", x => x.id);
                    table.ForeignKey(
                        name: "FK_organizations_users_owner_id",
                        column: x => x.owner_id,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "audit_logs",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: true),
                    actor_id = table.Column<Guid>(type: "uuid", nullable: true),
                    action = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    old_values = table.Column<Dictionary<string, object>>(type: "jsonb", nullable: true),
                    new_values = table.Column<Dictionary<string, object>>(type: "jsonb", nullable: true),
                    ip_address = table.Column<IPAddress>(type: "inet", nullable: true),
                    user_agent = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_logs", x => x.id);
                    table.ForeignKey(
                        name: "FK_audit_logs_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "public",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_audit_logs_users_actor_id",
                        column: x => x.actor_id,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "organization_members",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    invited_by = table.Column<Guid>(type: "uuid", nullable: true),
                    joined_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_organization_members", x => x.id);
                    table.ForeignKey(
                        name: "FK_organization_members_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "public",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_organization_members_users_invited_by",
                        column: x => x.invited_by,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_organization_members_users_user_id",
                        column: x => x.user_id,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "student_fees",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_id = table.Column<Guid>(type: "uuid", nullable: false),
                    set_by = table.Column<Guid>(type: "uuid", nullable: false),
                    fee_source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    manual_fee = table.Column<long>(type: "bigint", nullable: true),
                    override_reason = table.Column<string>(type: "text", nullable: true),
                    currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_student_fees", x => x.id);
                    table.ForeignKey(
                        name: "FK_student_fees_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "public",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "students",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    first_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    last_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    account_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    metadata = table.Column<Dictionary<string, object>>(type: "jsonb", nullable: true, defaultValueSql: "'{}'::jsonb"),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_students", x => x.id);
                    table.ForeignKey(
                        name: "FK_students_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "public",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_students_users_user_id",
                        column: x => x.user_id,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "teacher_students",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    teacher_id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_id = table.Column<Guid>(type: "uuid", nullable: false),
                    assigned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    assigned_by = table.Column<Guid>(type: "uuid", nullable: true),
                    is_primary = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_teacher_students", x => x.id);
                    table.ForeignKey(
                        name: "FK_teacher_students_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "public",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_teacher_students_users_assigned_by",
                        column: x => x.assigned_by,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "fee_periods",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_fee_id = table.Column<Guid>(type: "uuid", nullable: true),
                    period_year = table.Column<short>(type: "smallint", nullable: false),
                    period_month = table.Column<short>(type: "smallint", nullable: false),
                    fee = table.Column<long>(type: "bigint", nullable: false),
                    amount_paid = table.Column<long>(type: "bigint", nullable: false, defaultValue: 0L),
                    currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    due_date = table.Column<DateOnly>(type: "date", nullable: true),
                    waived_by = table.Column<Guid>(type: "uuid", nullable: true),
                    waived_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    waiver_reason = table.Column<string>(type: "text", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fee_periods", x => x.id);
                    table.ForeignKey(
                        name: "FK_fee_periods_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "public",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_fee_periods_student_fees_student_fee_id",
                        column: x => x.student_fee_id,
                        principalSchema: "public",
                        principalTable: "student_fees",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_fee_periods_users_waived_by",
                        column: x => x.waived_by,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "fee_payments",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    student_id = table.Column<Guid>(type: "uuid", nullable: false),
                    fee_period_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recorded_by = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<long>(type: "bigint", nullable: false),
                    currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    payment_date = table.Column<DateOnly>(type: "date", nullable: false),
                    payment_method = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    reference = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "NOW()"),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fee_payments", x => x.id);
                    table.ForeignKey(
                        name: "FK_fee_payments_fee_periods_fee_period_id",
                        column: x => x.fee_period_id,
                        principalSchema: "public",
                        principalTable: "fee_periods",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_fee_payments_organizations_organization_id",
                        column: x => x.organization_id,
                        principalSchema: "public",
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "idx_audit_logs_action",
                schema: "public",
                table: "audit_logs",
                columns: new[] { "action", "created_at" });

            migrationBuilder.CreateIndex(
                name: "idx_audit_logs_actor_id",
                schema: "public",
                table: "audit_logs",
                columns: new[] { "actor_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "idx_audit_logs_entity",
                schema: "public",
                table: "audit_logs",
                columns: new[] { "entity_type", "entity_id" });

            migrationBuilder.CreateIndex(
                name: "idx_audit_logs_org_id",
                schema: "public",
                table: "audit_logs",
                columns: new[] { "organization_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "idx_fee_payments_org_date",
                schema: "public",
                table: "fee_payments",
                columns: new[] { "organization_id", "payment_date" },
                filter: "\"deleted_at\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "idx_fee_payments_period_id",
                schema: "public",
                table: "fee_payments",
                column: "fee_period_id",
                filter: "\"deleted_at\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "idx_fee_payments_recorded_by",
                schema: "public",
                table: "fee_payments",
                column: "recorded_by");

            migrationBuilder.CreateIndex(
                name: "idx_fee_payments_student_id",
                schema: "public",
                table: "fee_payments",
                columns: new[] { "student_id", "payment_date" },
                filter: "\"deleted_at\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "idx_fee_periods_due_date",
                schema: "public",
                table: "fee_periods",
                column: "due_date",
                filter: "\"status\" IN ('Unpaid', 'Partial', 'Overdue') AND \"deleted_at\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "idx_fee_periods_org_status",
                schema: "public",
                table: "fee_periods",
                columns: new[] { "organization_id", "status" },
                filter: "\"deleted_at\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "idx_fee_periods_org_year_month",
                schema: "public",
                table: "fee_periods",
                columns: new[] { "organization_id", "period_year", "period_month" },
                filter: "\"deleted_at\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "idx_fee_periods_student_id",
                schema: "public",
                table: "fee_periods",
                columns: new[] { "student_id", "period_year", "period_month" },
                unique: true,
                filter: "\"deleted_at\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_fee_periods_student_fee_id",
                schema: "public",
                table: "fee_periods",
                column: "student_fee_id");

            migrationBuilder.CreateIndex(
                name: "IX_fee_periods_waived_by",
                schema: "public",
                table: "fee_periods",
                column: "waived_by");

            migrationBuilder.CreateIndex(
                name: "idx_org_members_org_user",
                schema: "public",
                table: "organization_members",
                columns: new[] { "organization_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_org_members_role",
                schema: "public",
                table: "organization_members",
                columns: new[] { "organization_id", "role" });

            migrationBuilder.CreateIndex(
                name: "idx_org_members_user_id",
                schema: "public",
                table: "organization_members",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_organization_members_invited_by",
                schema: "public",
                table: "organization_members",
                column: "invited_by");

            migrationBuilder.CreateIndex(
                name: "idx_organizations_deleted_at",
                schema: "public",
                table: "organizations",
                column: "deleted_at");

            migrationBuilder.CreateIndex(
                name: "idx_organizations_owner_id",
                schema: "public",
                table: "organizations",
                column: "owner_id");

            migrationBuilder.CreateIndex(
                name: "idx_organizations_slug",
                schema: "public",
                table: "organizations",
                column: "slug",
                unique: true,
                filter: "\"deleted_at\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "idx_student_fees_effective",
                schema: "public",
                table: "student_fees",
                columns: new[] { "student_id", "effective_from", "effective_to" });

            migrationBuilder.CreateIndex(
                name: "idx_student_fees_one_active",
                schema: "public",
                table: "student_fees",
                column: "student_id",
                unique: true,
                filter: "\"is_active\" = TRUE AND \"deleted_at\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "idx_student_fees_org_active",
                schema: "public",
                table: "student_fees",
                columns: new[] { "organization_id", "is_active" },
                filter: "\"deleted_at\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "idx_student_fees_student_active",
                schema: "public",
                table: "student_fees",
                columns: new[] { "student_id", "is_active" },
                filter: "\"deleted_at\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "idx_students_org_id_composite",
                schema: "public",
                table: "students",
                columns: new[] { "organization_id", "id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_students_org_user_id",
                schema: "public",
                table: "students",
                columns: new[] { "organization_id", "user_id" },
                unique: true,
                filter: "\"user_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_students_user_id",
                schema: "public",
                table: "students",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "idx_teacher_students_org",
                schema: "public",
                table: "teacher_students",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "idx_teacher_students_pair",
                schema: "public",
                table: "teacher_students",
                columns: new[] { "teacher_id", "student_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_teacher_students_student",
                schema: "public",
                table: "teacher_students",
                column: "student_id");

            migrationBuilder.CreateIndex(
                name: "idx_teacher_students_teacher",
                schema: "public",
                table: "teacher_students",
                column: "teacher_id");

            migrationBuilder.CreateIndex(
                name: "IX_teacher_students_assigned_by",
                schema: "public",
                table: "teacher_students",
                column: "assigned_by");

            migrationBuilder.CreateIndex(
                name: "idx_users_auth_user_id",
                schema: "public",
                table: "users",
                column: "auth_user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "idx_users_deleted_at",
                schema: "public",
                table: "users",
                column: "deleted_at");

            migrationBuilder.CreateIndex(
                name: "idx_users_email",
                schema: "public",
                table: "users",
                column: "email",
                unique: true,
                filter: "\"deleted_at\" IS NULL");

            migrationBuilder.Sql(@"
ALTER TABLE public.teacher_students
    ADD CONSTRAINT fk_ts_org_teacher
    FOREIGN KEY (organization_id, teacher_id)
    REFERENCES public.organization_members(organization_id, user_id)
    ON DELETE CASCADE;

ALTER TABLE public.teacher_students
    ADD CONSTRAINT fk_ts_org_student
    FOREIGN KEY (organization_id, student_id)
    REFERENCES public.students(organization_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.student_fees
    ADD CONSTRAINT fk_sf_org_student
    FOREIGN KEY (organization_id, student_id)
    REFERENCES public.students(organization_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.student_fees
    ADD CONSTRAINT fk_sf_org_set_by
    FOREIGN KEY (organization_id, set_by)
    REFERENCES public.organization_members(organization_id, user_id)
    ON DELETE RESTRICT;

ALTER TABLE public.fee_periods
    ADD CONSTRAINT fk_fp_org_student
    FOREIGN KEY (organization_id, student_id)
    REFERENCES public.students(organization_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.fee_payments
    ADD CONSTRAINT fk_fpy_org_student
    FOREIGN KEY (organization_id, student_id)
    REFERENCES public.students(organization_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.fee_payments
    ADD CONSTRAINT fk_fpy_org_recorded_by
    FOREIGN KEY (organization_id, recorded_by)
    REFERENCES public.organization_members(organization_id, user_id)
    ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_students_updated_at
    BEFORE UPDATE ON public.students
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_organization_members_updated_at
    BEFORE UPDATE ON public.organization_members
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_teacher_students_updated_at
    BEFORE UPDATE ON public.teacher_students
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_student_fees_updated_at
    BEFORE UPDATE ON public.student_fees
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_fee_periods_updated_at
    BEFORE UPDATE ON public.fee_periods
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_fee_payments_updated_at
    BEFORE UPDATE ON public.fee_payments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_student_not_deleted()
RETURNS TRIGGER AS $$
DECLARE
    v_deleted_at TIMESTAMPTZ;
BEGIN
    SELECT deleted_at
        INTO v_deleted_at
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

CREATE TRIGGER trg_guard_teacher_students_student
    BEFORE INSERT ON public.teacher_students
    FOR EACH ROW EXECUTE FUNCTION public.guard_student_not_deleted();

CREATE TRIGGER trg_guard_student_fees_student
    BEFORE INSERT ON public.student_fees
    FOR EACH ROW EXECUTE FUNCTION public.guard_student_not_deleted();

CREATE TRIGGER trg_guard_fee_periods_student
    BEFORE INSERT ON public.fee_periods
    FOR EACH ROW EXECUTE FUNCTION public.guard_student_not_deleted();

CREATE TRIGGER trg_guard_fee_payments_student
    BEFORE INSERT ON public.fee_payments
    FOR EACH ROW EXECUTE FUNCTION public.guard_student_not_deleted();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        id,
        auth_user_id,
        email,
        first_name,
        last_name,
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
        TRUE,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER after_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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

CREATE TRIGGER trg_sync_fee_period_on_payment
    AFTER INSERT OR UPDATE OF deleted_at, amount ON public.fee_payments
    FOR EACH ROW EXECUTE FUNCTION public.sync_fee_period_totals();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS UUID[] AS $$
    SELECT array_agg(organization_id)
    FROM public.organization_members
    WHERE user_id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE POLICY organizations_select ON public.organizations
    FOR SELECT USING (
        id = ANY(public.get_user_org_ids())
        AND deleted_at IS NULL
    );

CREATE POLICY organizations_insert ON public.organizations
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY organizations_update ON public.organizations
    FOR UPDATE USING (
        id = ANY(public.get_user_org_ids())
        AND deleted_at IS NULL
    ) WITH CHECK (
        id = ANY(public.get_user_org_ids())
    );

CREATE POLICY org_members_isolation_select ON public.organization_members
    FOR SELECT USING (
        organization_id = ANY(public.get_user_org_ids())
    );

CREATE POLICY org_members_isolation_insert ON public.organization_members
    FOR INSERT WITH CHECK (
        organization_id = ANY(public.get_user_org_ids())
    );

CREATE POLICY org_members_isolation_update ON public.organization_members
    FOR UPDATE USING (
        organization_id = ANY(public.get_user_org_ids())
    ) WITH CHECK (
        organization_id = ANY(public.get_user_org_ids())
    );

CREATE POLICY org_members_isolation_delete ON public.organization_members
    FOR DELETE USING (
        organization_id = ANY(public.get_user_org_ids())
    );

CREATE POLICY students_org_isolation_select ON public.students
    FOR SELECT USING (
        organization_id = ANY(public.get_user_org_ids())
        AND deleted_at IS NULL
    );

CREATE POLICY students_org_isolation_insert ON public.students
    FOR INSERT WITH CHECK (
        organization_id = ANY(public.get_user_org_ids())
    );

CREATE POLICY students_org_isolation_update ON public.students
    FOR UPDATE USING (
        organization_id = ANY(public.get_user_org_ids())
        AND deleted_at IS NULL
    ) WITH CHECK (
        organization_id = ANY(public.get_user_org_ids())
    );

CREATE POLICY teacher_students_org_isolation ON public.teacher_students
    FOR ALL USING (
        organization_id = ANY(public.get_user_org_ids())
    ) WITH CHECK (
        organization_id = ANY(public.get_user_org_ids())
    );

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

CREATE POLICY fee_periods_student_self ON public.fee_periods
    FOR SELECT USING (
        student_id IN (
            SELECT id
            FROM public.students
            WHERE user_id = auth.uid()
                AND deleted_at IS NULL
        )
    );

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

CREATE POLICY users_read ON public.users
    FOR SELECT USING (
        id = auth.uid()
        OR id IN (
            SELECT user_id
            FROM public.organization_members
            WHERE organization_id = ANY(public.get_user_org_ids())
        )
    );

CREATE POLICY users_self_update ON public.users
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY audit_logs_staff_read ON public.audit_logs
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id
            FROM public.organization_members
            WHERE user_id = auth.uid()
                AND role IN ('Owner', 'Admin', 'Teacher')
        )
    );

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
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TRIGGER IF EXISTS after_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS public.sync_fee_period_totals() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.guard_student_not_deleted() CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_org_ids() CASCADE;
");

            migrationBuilder.DropTable(
                name: "audit_logs",
                schema: "public");

            migrationBuilder.DropTable(
                name: "fee_payments",
                schema: "public");

            migrationBuilder.DropTable(
                name: "organization_members",
                schema: "public");

            migrationBuilder.DropTable(
                name: "students",
                schema: "public");

            migrationBuilder.DropTable(
                name: "teacher_students",
                schema: "public");

            migrationBuilder.DropTable(
                name: "fee_periods",
                schema: "public");

            migrationBuilder.DropTable(
                name: "student_fees",
                schema: "public");

            migrationBuilder.DropTable(
                name: "organizations",
                schema: "public");

            migrationBuilder.DropTable(
                name: "users",
                schema: "public");
        }
    }
}
