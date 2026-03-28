using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System.Net;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Infrastructure.Persistence.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
  public void Configure(EntityTypeBuilder<AuditLog> builder)
  {
    builder.ToTable("audit_logs");

    builder.HasKey(e => e.Id);

    builder.Property(e => e.Id)
      .HasColumnName("id")
      .HasDefaultValueSql("gen_random_uuid()");

    builder.Property(e => e.OrganizationId)
      .HasColumnName("organization_id");

    builder.Property(e => e.ActorId)
      .HasColumnName("actor_id");

    builder.Property(e => e.Action)
      .HasColumnName("action")
      .HasMaxLength(100)
      .IsRequired();

    builder.Property(e => e.EntityType)
      .HasColumnName("entity_type")
      .HasMaxLength(100)
      .IsRequired();

    builder.Property(e => e.EntityId)
      .HasColumnName("entity_id");

    builder.Property(e => e.OldValues)
      .HasColumnName("old_values")
      .HasColumnType("jsonb");

    builder.Property(e => e.NewValues)
      .HasColumnName("new_values")
      .HasColumnType("jsonb");

    builder.Property(e => e.IpAddress)
      .HasColumnName("ip_address")
      .HasConversion(
        value => value == null ? null : IPAddress.Parse(value),
        value => value == null ? null : value.ToString())
      .HasColumnType("inet");

    builder.Property(e => e.UserAgent)
      .HasColumnName("user_agent")
      .HasColumnType("text");

    builder.Property(e => e.CreatedAt)
      .HasColumnName("created_at")
      .HasDefaultValueSql("NOW()")
      .IsRequired();

    builder.HasOne<Organization>()
      .WithMany()
      .HasForeignKey(e => e.OrganizationId)
      .OnDelete(DeleteBehavior.SetNull);

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(e => e.ActorId)
      .OnDelete(DeleteBehavior.SetNull);

    builder.HasIndex(e => new { e.OrganizationId, e.CreatedAt })
      .HasDatabaseName("idx_audit_logs_org_id");

    builder.HasIndex(e => new { e.ActorId, e.CreatedAt })
      .HasDatabaseName("idx_audit_logs_actor_id");

    builder.HasIndex(e => new { e.EntityType, e.EntityId })
      .HasDatabaseName("idx_audit_logs_entity");

    builder.HasIndex(e => new { e.Action, e.CreatedAt })
      .HasDatabaseName("idx_audit_logs_action");
  }
}