using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Common.Models;

namespace TuitionIQ.Infrastructure.Auth;

public sealed class CurrentUserService : ICurrentUserService
{
  private static readonly JsonSerializerOptions JsonSerializerOptions = new()
  {
    PropertyNameCaseInsensitive = true
  };

  private readonly IHttpContextAccessor _httpContextAccessor;
  private readonly Lazy<Guid> _userId;
  private readonly Lazy<IReadOnlyList<OrgClaim>> _orgClaims;

  public CurrentUserService(IHttpContextAccessor httpContextAccessor)
  {
    _httpContextAccessor = httpContextAccessor;
    _userId = new Lazy<Guid>(ResolveUserId);
    _orgClaims = new Lazy<IReadOnlyList<OrgClaim>>(ResolveOrgClaims);
  }

  public Guid UserId => _userId.Value;

  public IReadOnlyList<OrgClaim> OrgClaims => _orgClaims.Value;

  private Guid ResolveUserId()
  {
    var subClaim = GetCurrentUser().FindFirst("sub")?.Value;
    if (!Guid.TryParse(subClaim, out var userId))
    {
      throw new InvalidOperationException("The authenticated user does not include a valid 'sub' claim.");
    }

    return userId;
  }

  private IReadOnlyList<OrgClaim> ResolveOrgClaims()
  {
    var appMetadata = GetCurrentUser().FindFirst("app_metadata")?.Value;
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

      var parsedClaims = JsonSerializer.Deserialize<List<OrgClaim>>(orgsElement.GetRawText(), JsonSerializerOptions);
      if (parsedClaims is null || parsedClaims.Count == 0)
      {
        return Array.Empty<OrgClaim>();
      }

      return parsedClaims
        .Where(static claim => claim.OrganizationId != Guid.Empty && !string.IsNullOrWhiteSpace(claim.Role))
        .ToArray();
    }
    catch (JsonException)
    {
      return Array.Empty<OrgClaim>();
    }
  }

  private ClaimsPrincipal GetCurrentUser()
  {
    return _httpContextAccessor.HttpContext?.User
      ?? throw new InvalidOperationException("No active HttpContext user is available.");
  }
}