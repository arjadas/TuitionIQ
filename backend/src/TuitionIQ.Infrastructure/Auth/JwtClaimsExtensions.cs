using System.Security.Claims;
using System.Text.Json;
using TuitionIQ.Application.Common.Models;

namespace TuitionIQ.Infrastructure.Auth;

public static class JwtClaimsExtensions
{
  private static readonly JsonSerializerOptions JsonSerializerOptions = new()
  {
    PropertyNameCaseInsensitive = true
  };

  public static Guid? GetUserIdFromSub(this ClaimsPrincipal principal)
  {
    var sub = principal.FindFirst("sub")?.Value;
    return Guid.TryParse(sub, out var userId) ? userId : null;
  }

  public static IReadOnlyList<OrgClaim> GetOrgClaims(this ClaimsPrincipal principal)
  {
    var appMetadata = principal.FindFirst("app_metadata")?.Value;
    if (string.IsNullOrWhiteSpace(appMetadata))
    {
      return Array.Empty<OrgClaim>();
    }

    try
    {
      using var metadataDocument = JsonDocument.Parse(appMetadata);
      if (!metadataDocument.RootElement.TryGetProperty("orgs", out var orgsElement)
          || orgsElement.ValueKind != JsonValueKind.Array)
      {
        return Array.Empty<OrgClaim>();
      }

      var orgClaims = JsonSerializer.Deserialize<List<OrgClaim>>(orgsElement.GetRawText(), JsonSerializerOptions);
      if (orgClaims is null || orgClaims.Count == 0)
      {
        return Array.Empty<OrgClaim>();
      }

      return orgClaims
        .Where(static claim => claim.OrganizationId != Guid.Empty && !string.IsNullOrWhiteSpace(claim.Role))
        .ToArray();
    }
    catch (JsonException)
    {
      return Array.Empty<OrgClaim>();
    }
  }
}
