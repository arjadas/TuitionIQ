namespace TuitionIQ.Application.Features.Students.Dtos;

public sealed class StudentSummaryDto
{
  public Guid Id { get; init; }
  public string FirstName { get; init; } = string.Empty;
  public string LastName { get; init; } = string.Empty;
  public string? Email { get; init; }
  public string Status { get; init; } = string.Empty;
  public string AccountStatus { get; init; } = string.Empty;
  public DateTimeOffset CreatedAt { get; init; }
}
