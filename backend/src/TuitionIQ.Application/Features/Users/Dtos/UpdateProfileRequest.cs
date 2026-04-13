namespace TuitionIQ.Application.Features.Users.Dtos;

public sealed record UpdateProfileRequest
{
  public string FirstName { get; init; } = string.Empty;
  public string LastName { get; init; } = string.Empty;
  public string? Phone { get; init; }
}