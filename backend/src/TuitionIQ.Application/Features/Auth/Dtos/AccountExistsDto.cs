namespace TuitionIQ.Application.Features.Auth.Dtos;

public sealed record AccountExistsDto
{
  public string Email { get; init; } = string.Empty;
  public bool Exists { get; init; }
}
