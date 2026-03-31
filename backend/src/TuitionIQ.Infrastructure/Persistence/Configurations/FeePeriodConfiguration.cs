using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Infrastructure.Persistence.Configurations;

public class FeePeriodConfiguration : IEntityTypeConfiguration<FeePeriod>
{
  public void Configure(EntityTypeBuilder<FeePeriod> builder)
  {
    builder.ToTable("fee_periods");

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

    builder.Property(e => e.StudentFeeId)
      .HasColumnName("student_fee_id");

    builder.Property(e => e.PeriodYear)
      .HasColumnName("period_year")
      .IsRequired();

    builder.Property(e => e.PeriodMonth)
      .HasColumnName("period_month")
      .IsRequired();

    builder.Property(e => e.Fee)
      .HasColumnName("fee")
      .HasColumnType("bigint")
      .IsRequired();

    builder.Property(e => e.AmountPaid)
      .HasColumnName("amount_paid")
      .HasColumnType("bigint")
      .HasDefaultValue(0L)
      .IsRequired();

    builder.Property(e => e.Currency)
      .HasColumnName("currency")
      .HasMaxLength(3)
      .IsRequired();

    builder.Property(e => e.Status)
      .HasColumnName("status")
      .HasMaxLength(50)
      .HasConversion<string>()
      .IsRequired();

    builder.Property(e => e.DueDate)
      .HasColumnName("due_date");

    builder.Property(e => e.WaivedBy)
      .HasColumnName("waived_by");

    builder.Property(e => e.WaivedAt)
      .HasColumnName("waived_at");

    builder.Property(e => e.WaiverReason)
      .HasColumnName("waiver_reason")
      .HasColumnType("text");

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

    builder.HasOne<StudentFee>()
      .WithMany()
      .HasForeignKey(e => e.StudentFeeId)
      .OnDelete(DeleteBehavior.SetNull);

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(e => e.WaivedBy)
      .OnDelete(DeleteBehavior.SetNull);

    // TODO: Composite FK is added via raw SQL in migrations:
    // ALTER TABLE fee_periods ADD CONSTRAINT fk_fp_org_student
    //   FOREIGN KEY (organization_id, student_id)
    //   REFERENCES students(organization_id, id) ON DELETE CASCADE;

    builder.HasIndex(e => new { e.StudentId, e.PeriodYear, e.PeriodMonth })
      .IsUnique()
      .HasFilter("\"deleted_at\" IS NULL")
      .HasDatabaseName("idx_fee_periods_student_month_active");

    builder.HasIndex(e => new { e.OrganizationId, e.Status })
      .HasFilter("\"deleted_at\" IS NULL")
      .HasDatabaseName("idx_fee_periods_org_status");

    builder.HasIndex(e => new { e.OrganizationId, e.PeriodYear, e.PeriodMonth })
      .HasFilter("\"deleted_at\" IS NULL")
      .HasDatabaseName("idx_fee_periods_org_year_month");

    builder.HasIndex(e => e.DueDate)
      .HasFilter("\"status\" IN ('unpaid', 'partial', 'overdue') AND \"deleted_at\" IS NULL")
      .HasDatabaseName("idx_fee_periods_due_date");
  }
}