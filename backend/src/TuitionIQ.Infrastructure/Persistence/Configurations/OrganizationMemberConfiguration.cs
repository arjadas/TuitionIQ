using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Infrastructure.Persistence.Configurations;

public class OrganizationMemberConfiguration : IEntityTypeConfiguration<OrganizationMember>
{
  public void Configure(EntityTypeBuilder<OrganizationMember> builder)
  {
    builder.ToTable("organization_members");

    builder.HasKey(e => e.Id);

    builder.Property(e => e.Id)
      .HasColumnName("id")
      .HasDefaultValueSql("gen_random_uuid()");

    builder.Property(e => e.OrganizationId)
      .HasColumnName("organization_id")
      .IsRequired();

    builder.Property(e => e.UserId)
      .HasColumnName("user_id")
      .IsRequired();

    builder.Property(e => e.Role)
      .HasColumnName("role")
      .HasMaxLength(50)
      .HasConversion<string>()
      .IsRequired();

    builder.Property(e => e.InvitedBy)
      .HasColumnName("invited_by");

    builder.Property(e => e.JoinedAt)
      .HasColumnName("joined_at");

    builder.Property(e => e.CreatedAt)
      .HasColumnName("created_at")
      .HasDefaultValueSql("NOW()")
      .IsRequired();

    builder.Property(e => e.UpdatedAt)
      .HasColumnName("updated_at")
      .HasDefaultValueSql("NOW()")
      .IsRequired();

    builder.HasOne<Organization>()
      .WithMany()
      .HasForeignKey(e => e.OrganizationId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(e => e.UserId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(e => e.InvitedBy)
      .OnDelete(DeleteBehavior.SetNull);

    builder.HasIndex(e => new { e.OrganizationId, e.UserId })
      .IsUnique()
      .HasDatabaseName("idx_org_members_org_user");

    builder.HasIndex(e => e.UserId)
      .HasDatabaseName("idx_org_members_user_id");

    builder.HasIndex(e => new { e.OrganizationId, e.Role })
      .HasDatabaseName("idx_org_members_role");
  }
}