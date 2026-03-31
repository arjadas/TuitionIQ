using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Infrastructure.Persistence.Configurations;

public class StudentConfiguration : IEntityTypeConfiguration<Student>
{
  public void Configure(EntityTypeBuilder<Student> builder)
  {
    builder.ToTable("students");

    builder.HasKey(e => e.Id);

    builder.Property(e => e.Id)
      .HasColumnName("id")
      .HasDefaultValueSql("gen_random_uuid()");

    builder.Property(e => e.OrganizationId)
      .HasColumnName("organization_id")
      .IsRequired();

    builder.Property(e => e.UserId)
      .HasColumnName("user_id");

    builder.Property(e => e.FirstName)
      .HasColumnName("first_name")
      .HasMaxLength(100)
      .IsRequired();

    builder.Property(e => e.LastName)
      .HasColumnName("last_name")
      .HasMaxLength(100)
      .IsRequired();

    builder.Property(e => e.Email)
      .HasColumnName("email")
      .HasMaxLength(255);

    builder.Property(e => e.Phone)
      .HasColumnName("phone")
      .HasMaxLength(30);

    builder.Property(e => e.Notes)
      .HasColumnName("notes")
      .HasColumnType("text");

    builder.Property(e => e.Status)
      .HasColumnName("status")
      .HasMaxLength(50)
      .HasConversion<string>()
      .IsRequired();

    builder.Property(e => e.AccountStatus)
      .HasColumnName("account_status")
      .HasMaxLength(50)
      .HasConversion<string>()
      .IsRequired();

    builder.Property(e => e.Metadata)
      .HasColumnName("metadata")
      .HasColumnType("jsonb")
      .HasDefaultValueSql("'{}'::jsonb");

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

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(e => e.UserId)
      .OnDelete(DeleteBehavior.SetNull);

    builder.HasIndex(e => new { e.OrganizationId, e.Id })
      .IsUnique()
      .HasDatabaseName("idx_students_org_id_composite");

    builder.HasIndex(e => new { e.OrganizationId, e.UserId })
      .IsUnique()
      .HasFilter("\"user_id\" IS NOT NULL")
      .HasDatabaseName("idx_students_org_user_id");
  }
}