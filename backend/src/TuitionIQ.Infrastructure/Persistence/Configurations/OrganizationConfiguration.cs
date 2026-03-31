using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Infrastructure.Persistence.Configurations;

public class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
  public void Configure(EntityTypeBuilder<Organization> builder)
  {
    builder.ToTable("organizations");

    builder.HasKey(e => e.Id);

    builder.Property(e => e.Id)
      .HasColumnName("id")
      .HasDefaultValueSql("gen_random_uuid()");

    builder.Property(e => e.Name)
      .HasColumnName("name")
      .HasMaxLength(255)
      .IsRequired();

    builder.Property(e => e.Slug)
      .HasColumnName("slug")
      .HasMaxLength(100)
      .IsRequired();

    builder.Property(e => e.OwnerId)
      .HasColumnName("owner_id")
      .IsRequired();

    builder.Property(e => e.Plan)
      .HasColumnName("plan")
      .HasMaxLength(50)
      .HasDefaultValue("free")
      .IsRequired();

    builder.Property(e => e.PlanExpiresAt)
      .HasColumnName("plan_expires_at");

    builder.Property(e => e.Settings)
      .HasColumnName("settings")
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

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(e => e.OwnerId)
      .OnDelete(DeleteBehavior.Restrict);

    builder.HasIndex(e => e.Slug)
      .IsUnique()
      .HasFilter("\"deleted_at\" IS NULL")
      .HasDatabaseName("idx_organizations_slug");

    builder.HasIndex(e => e.OwnerId)
      .HasDatabaseName("idx_organizations_owner_id");

    builder.HasIndex(e => e.DeletedAt)
      .HasDatabaseName("idx_organizations_deleted_at");
  }
}