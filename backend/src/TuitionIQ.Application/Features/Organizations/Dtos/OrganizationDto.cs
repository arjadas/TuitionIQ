namespace TuitionIQ.Application.Features.Organizations.Dtos;

public sealed record OrganizationDto
{
  public Guid Id { get; init; }
  public string Name { get; init; } = string.Empty;
  public string Slug { get; init; } = string.Empty;
  public string Plan { get; init; } = string.Empty;
  public DateTimeOffset CreatedAt { get; init; }
}
