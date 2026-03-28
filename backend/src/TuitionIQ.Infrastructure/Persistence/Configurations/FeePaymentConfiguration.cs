using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Infrastructure.Persistence.Configurations;

public class FeePaymentConfiguration : IEntityTypeConfiguration<FeePayment>
{
  public void Configure(EntityTypeBuilder<FeePayment> builder)
  {
    builder.ToTable("fee_payments");

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

    builder.Property(e => e.FeePeriodId)
      .HasColumnName("fee_period_id")
      .IsRequired();

    builder.Property(e => e.RecordedBy)
      .HasColumnName("recorded_by")
      .IsRequired();

    builder.Property(e => e.Amount)
      .HasColumnName("amount")
      .HasColumnType("bigint")
      .IsRequired();

    builder.Property(e => e.Currency)
      .HasColumnName("currency")
      .HasMaxLength(3)
      .IsRequired();

    builder.Property(e => e.PaymentDate)
      .HasColumnName("payment_date")
      .IsRequired();

    builder.Property(e => e.PaymentMethod)
      .HasColumnName("payment_method")
      .HasMaxLength(50)
      .HasConversion<string>()
      .IsRequired();

    builder.Property(e => e.Reference)
      .HasColumnName("reference")
      .HasMaxLength(255);

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

    builder.HasOne<FeePeriod>()
      .WithMany()
      .HasForeignKey(e => e.FeePeriodId)
      .OnDelete(DeleteBehavior.Restrict);

    // TODO: Composite FKs are added via raw SQL in migrations:
    // ALTER TABLE fee_payments ADD CONSTRAINT fk_fpy_org_student
    //   FOREIGN KEY (organization_id, student_id)
    //   REFERENCES students(organization_id, id) ON DELETE CASCADE;
    // ALTER TABLE fee_payments ADD CONSTRAINT fk_fpy_org_recorded_by
    //   FOREIGN KEY (organization_id, recorded_by)
    //   REFERENCES organization_members(organization_id, user_id) ON DELETE RESTRICT;

    builder.HasIndex(e => e.FeePeriodId)
      .HasFilter("\"deleted_at\" IS NULL")
      .HasDatabaseName("idx_fee_payments_period_id");

    builder.HasIndex(e => new { e.StudentId, e.PaymentDate })
      .HasFilter("\"deleted_at\" IS NULL")
      .HasDatabaseName("idx_fee_payments_student_id");

    builder.HasIndex(e => new { e.OrganizationId, e.PaymentDate })
      .HasFilter("\"deleted_at\" IS NULL")
      .HasDatabaseName("idx_fee_payments_org_date");

    builder.HasIndex(e => e.RecordedBy)
      .HasDatabaseName("idx_fee_payments_recorded_by");
  }
}