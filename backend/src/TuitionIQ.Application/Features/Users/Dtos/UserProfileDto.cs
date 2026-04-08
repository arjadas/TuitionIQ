namespace TuitionIQ.Application.Features.Users.Dtos;

public sealed record UserProfileDto
{
  public Guid Id { get; init; }
  public string Email { get; init; } = string.Empty;
  public string FirstName { get; init; } = string.Empty;
  public string LastName { get; init; } = string.Empty;
  public string? Phone { get; init; }
  public string? AvatarUrl { get; init; }
  public bool EmailVerified { get; init; }
}