using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Infrastructure.Persistence.Configurations;

public class TeacherStudentConfiguration : IEntityTypeConfiguration<TeacherStudent>
{
  public void Configure(EntityTypeBuilder<TeacherStudent> builder)
  {
    builder.ToTable("teacher_students");

    builder.HasKey(e => e.Id);

    builder.Property(e => e.Id)
      .HasColumnName("id")
      .HasDefaultValueSql("gen_random_uuid()");

    builder.Property(e => e.OrganizationId)
      .HasColumnName("organization_id")
      .IsRequired();

    builder.Property(e => e.TeacherId)
      .HasColumnName("teacher_id")
      .IsRequired();

    builder.Property(e => e.StudentId)
      .HasColumnName("student_id")
      .IsRequired();

    builder.Property(e => e.AssignedAt)
      .HasColumnName("assigned_at")
      .HasDefaultValueSql("NOW()")
      .IsRequired();

    builder.Property(e => e.AssignedBy)
      .HasColumnName("assigned_by");

    builder.Property(e => e.IsPrimary)
      .HasColumnName("is_primary")
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

    builder.HasOne<Organization>()
      .WithMany()
      .HasForeignKey(e => e.OrganizationId)
      .OnDelete(DeleteBehavior.Cascade);

    builder.HasOne<User>()
      .WithMany()
      .HasForeignKey(e => e.AssignedBy)
      .OnDelete(DeleteBehavior.SetNull);

    // TODO: Composite FKs are added via raw SQL in migrations:
    // ALTER TABLE teacher_students ADD CONSTRAINT fk_ts_org_teacher
    //   FOREIGN KEY (organization_id, teacher_id)
    //   REFERENCES organization_members(organization_id, user_id) ON DELETE CASCADE;
    // ALTER TABLE teacher_students ADD CONSTRAINT fk_ts_org_student
    //   FOREIGN KEY (organization_id, student_id)
    //   REFERENCES students(organization_id, id) ON DELETE CASCADE;

    builder.HasIndex(e => new { e.TeacherId, e.StudentId })
      .IsUnique()
      .HasDatabaseName("idx_teacher_students_pair");

    builder.HasIndex(e => e.OrganizationId)
      .HasDatabaseName("idx_teacher_students_org");

    builder.HasIndex(e => e.StudentId)
      .HasDatabaseName("idx_teacher_students_student");

    builder.HasIndex(e => e.TeacherId)
      .HasDatabaseName("idx_teacher_students_teacher");
  }
}