namespace TuitionIQ.Application.Features.Students.Dtos;

public sealed class UpdateStudentRequest
{
  public string? FirstName { get; init; }
  public string? LastName { get; init; }
  public string? Email { get; init; }
  public string? Phone { get; init; }
  public string? Notes { get; init; }
  public Dictionary<string, object?>? Metadata { get; init; }
}
