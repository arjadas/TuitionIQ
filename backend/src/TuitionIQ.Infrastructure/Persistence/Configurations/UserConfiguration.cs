using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
  public void Configure(EntityTypeBuilder<User> builder)
  {
    builder.ToTable("users");

    builder.HasKey(e => e.Id);

    builder.Property(e => e.Id)
      .HasColumnName("id")
      .HasDefaultValueSql("gen_random_uuid()");

    builder.Property(e => e.AuthUserId)
      .HasColumnName("auth_user_id")
      .HasMaxLength(255)
      .IsRequired();

    builder.Property(e => e.Email)
      .HasColumnName("email")
      .HasMaxLength(255)
      .IsRequired();

    builder.Property(e => e.FirstName)
      .HasColumnName("first_name")
      .HasMaxLength(100)
      .IsRequired();

    builder.Property(e => e.LastName)
      .HasColumnName("last_name")
      .HasMaxLength(100)
      .IsRequired();

    builder.Property(e => e.Phone)
      .HasColumnName("phone")
      .HasMaxLength(30);

    builder.Property(e => e.AvatarUrl)
      .HasColumnName("avatar_url")
      .HasColumnType("text");

    builder.Property(e => e.IsActive)
      .HasColumnName("is_active")
      .HasDefaultValue(true)
      .IsRequired();

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

    builder.HasIndex(e => e.AuthUserId)
      .IsUnique()
      .HasDatabaseName("idx_users_auth_user_id");

    builder.HasIndex(e => e.Email)
      .IsUnique()
      .HasFilter("\"deleted_at\" IS NULL")
      .HasDatabaseName("idx_users_email");

    builder.HasIndex(e => e.DeletedAt)
      .HasDatabaseName("idx_users_deleted_at");
  }
}