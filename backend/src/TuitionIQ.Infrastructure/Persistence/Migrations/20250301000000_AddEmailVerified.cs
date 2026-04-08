using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TuitionIQ.Infrastructure.Persistence.Migrations;

public partial class AddEmailVerified : Migration
{
  protected override void Up(MigrationBuilder migrationBuilder)
  {
    migrationBuilder.AddColumn<bool>(
      name: "email_verified",
      schema: "public",
      table: "users",
      type: "boolean",
      nullable: false,
      defaultValue: false);

    migrationBuilder.CreateIndex(
      name: "idx_users_email_verified",
      schema: "public",
      table: "users",
      column: "email_verified",
      filter: "\"deleted_at\" IS NULL");

    // existing magic-link users are treated as already verified.
    migrationBuilder.Sql(@"
UPDATE public.users
SET email_verified = TRUE
WHERE email_verified = FALSE;
");

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
  }

  protected override void Down(MigrationBuilder migrationBuilder)
  {
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
");

    migrationBuilder.DropIndex(
      name: "idx_users_email_verified",
      schema: "public",
      table: "users");

    migrationBuilder.DropColumn(
      name: "email_verified",
      schema: "public",
      table: "users");
  }
}
