using System.Text.Json;

namespace TuitionIQ.Application.Features.Organizations.Dtos;

public sealed record UpdateOrganizationRequest
{
  public string? Name { get; init; }
  public JsonDocument? Settings { get; init; }
}
