using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Infrastructure.Persistence.Configurations;

public class StudentFeeConfiguration : IEntityTypeConfiguration<StudentFee>
{
  public void Configure(EntityTypeBuilder<StudentFee> builder)
  {
    builder.ToTable("student_fees");

    builder.HasKey(e => e.Id);

    builder.Property(e => e.Id)
      .HasColumnName("id")
      .HasDefaultValueSql("gen_random_uuid()");

    builder.Property(e => e.OrganizationId)
      .HasColumnName("organization_id")
      .IsRequired();

    builder.Property(e => e.StudentId)
      .HasColumnName("student_id")
      .IsRequired();

    builder.Property(e => e.SetBy)
      .HasColumnName("set_by")
      .IsRequired();

    builder.Property(e => e.FeeSource)
      .HasColumnName("fee_source")
      .HasMaxLength(50)
      .HasConversion<string>()
      .IsRequired();

    builder.Property(e => e.ManualFee)
      .HasColumnName("manual_fee")
      .HasColumnType("bigint");

    builder.Property(e => e.OverrideReason)
      .HasColumnName("override_reason")
      .HasColumnType("text");

    builder.Property(e => e.Currency)
      .HasColumnName("currency")
      .HasMaxLength(3)
      .IsRequired();

    builder.Property(e => e.EffectiveFrom)
      .HasColumnName("effective_from")
      .IsRequired();

    builder.Property(e => e.EffectiveTo)
      .HasColumnName("effective_to");

    builder.Property(e => e.IsActive)
      .HasColumnName("is_active")
      .HasDefaultValue(true)
      .IsRequired();

    builder.Property(e => e.Notes)
      .HasColumnName("notes")
      .HasColumnType("text");

    builder.Property(e => e.CreatedAt)
      .HasColumnName("created_at")
      .HasDefaultValueSql("NOW()")
      .IsRequired();

    builder.Property(e => e.UpdatedAt)
      .HasColumnName("updated_at")
      .HasDefaultValueSql("NOW()")
      .IsRequired();

    builder.Property(e => e.DeletedAt)
      .HasColumnName("deleted_at");

    builder.HasOne<Organization>()
      .WithMany()
      .HasForeignKey(e => e.OrganizationId)
      .OnDelete(DeleteBehavior.Cascade);

    // TODO: Composite FKs are added via raw SQL in migrations:
    // ALTER TABLE student_fees ADD CONSTRAINT fk_sf_org_student
    //   FOREIGN KEY (organization_id, student_id)
    //   REFERENCES students(organization_id, id) ON DELETE CASCADE;
    // ALTER TABLE student_fees ADD CONSTRAINT fk_sf_org_set_by
    //   FOREIGN KEY (organization_id, set_by)
    //   REFERENCES organization_members(organization_id, user_id) ON DELETE RESTRICT;

    builder.HasIndex(e => e.StudentId)
      .IsUnique()
      .HasFilter("\"is_active\" = TRUE AND \"deleted_at\" IS NULL")
      .HasDatabaseName("idx_student_fees_one_active");

    builder.HasIndex(e => new { e.StudentId, e.IsActive })
      .HasFilter("\"deleted_at\" IS NULL")
      .HasDatabaseName("idx_student_fees_student_active");

    builder.HasIndex(e => new { e.OrganizationId, e.IsActive })
      .HasFilter("\"deleted_at\" IS NULL")
      .HasDatabaseName("idx_student_fees_org_active");

    builder.HasIndex(e => new { e.StudentId, e.EffectiveFrom, e.EffectiveTo })
      .HasDatabaseName("idx_student_fees_effective");
  }
}