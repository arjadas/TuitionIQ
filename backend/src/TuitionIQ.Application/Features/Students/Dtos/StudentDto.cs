namespace TuitionIQ.Application.Features.Students.Dtos;

public sealed class StudentDto
{
  public Guid Id { get; init; }
  public Guid OrganizationId { get; init; }
  public Guid? UserId { get; init; }
  public string FirstName { get; init; } = string.Empty;
  public string LastName { get; init; } = string.Empty;
  public string? Email { get; init; }
  public string? Phone { get; init; }
  public string? Notes { get; init; }
  public string Status { get; init; } = string.Empty;
  public string AccountStatus { get; init; } = string.Empty;
  public Dictionary<string, object?>? Metadata { get; init; }
  public DateTimeOffset CreatedAt { get; init; }
  public DateTimeOffset UpdatedAt { get; init; }
}
