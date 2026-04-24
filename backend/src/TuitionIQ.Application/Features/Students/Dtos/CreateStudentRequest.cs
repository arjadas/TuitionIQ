namespace TuitionIQ.Application.Features.Students.Dtos;

public sealed class CreateStudentRequest
{
  public string FirstName { get; init; } = string.Empty;
  public string LastName { get; init; } = string.Empty;
  public string? Email { get; init; }
  public string? Phone { get; init; }
  public string? Notes { get; init; }
  public Dictionary<string, object?>? Metadata { get; init; }
}
