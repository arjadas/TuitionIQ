namespace TuitionIQ.Domain.Entities;

public class TeacherStudent
{
  public Guid Id { get; set; }
  public Guid OrganizationId { get; set; }
  public Guid TeacherId { get; set; }
  public Guid StudentId { get; set; }
  public DateTimeOffset AssignedAt { get; set; }
  public Guid? AssignedBy { get; set; }
  public bool IsPrimary { get; set; }
  public DateTimeOffset CreatedAt { get; set; }
  public DateTimeOffset UpdatedAt { get; set; }
}