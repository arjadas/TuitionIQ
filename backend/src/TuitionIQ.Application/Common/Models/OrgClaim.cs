using System.Text.Json.Serialization;

namespace TuitionIQ.Application.Common.Models;

public sealed record OrgClaim
{
  [JsonPropertyName("org_id")]
  public Guid OrganizationId { get; init; }

  [JsonPropertyName("role")]
  public string Role { get; init; } = string.Empty;
}