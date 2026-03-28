using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Domain.Entities;

public class Student
{
  public Guid Id { get; set; }
  public Guid OrganizationId { get; set; }
  public Guid? UserId { get; set; }
  public string FirstName { get; set; } = string.Empty;
  public string LastName { get; set; } = string.Empty;
  public string? Email { get; set; }
  public string? Phone { get; set; }
  public string? Notes { get; set; }
  public StudentStatus Status { get; set; }
  public StudentAccountStatus AccountStatus { get; set; }
  public Dictionary<string, object?>? Metadata { get; set; }
  public DateTimeOffset CreatedAt { get; set; }
  public DateTimeOffset UpdatedAt { get; set; }
  public DateTimeOffset? DeletedAt { get; set; }
}