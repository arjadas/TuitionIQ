namespace TuitionIQ.Application.Features.Organizations.Dtos;

public sealed record CreateOrganizationRequest
{
  public string Name { get; init; } = string.Empty;
  public string Slug { get; init; } = string.Empty;
}
