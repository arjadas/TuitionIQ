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
  private readonly Lazy<Guid> _authUserId;
  private readonly Lazy<IReadOnlyList<OrgClaim>> _orgClaims;

  public CurrentUserService(IHttpContextAccessor httpContextAccessor)
  {
    _httpContextAccessor = httpContextAccessor;
    _userId = new Lazy<Guid>(ResolveInternalUserId);
    _authUserId = new Lazy<Guid>(ResolveAuthUserId);
    _orgClaims = new Lazy<IReadOnlyList<OrgClaim>>(ResolveOrgClaims);
  }

  public Guid UserId => _userId.Value;

  public Guid AuthUserId => _authUserId.Value;

  public IReadOnlyList<OrgClaim> OrgClaims => _orgClaims.Value;

  // The internal public.users.id is resolved (sub -> auth_user_id -> id) and published into
  // HttpContext.Items by UserActiveCheckMiddleware, which runs before any controller for an
  // authenticated request. This keeps the property synchronous and avoids a second DB lookup.
  private Guid ResolveInternalUserId()
  {
    var httpContext = _httpContextAccessor.HttpContext
      ?? throw new InvalidOperationException("No active HttpContext is available.");

    if (httpContext.Items.TryGetValue(CurrentUserContextKeys.InternalUserId, out var value)
        && value is Guid internalUserId
        && internalUserId != Guid.Empty)
    {
      return internalUserId;
    }

    throw new InvalidOperationException(
      "The internal user id has not been resolved for this request. UserActiveCheckMiddleware must run before the current user is accessed.");
  }

  private Guid ResolveAuthUserId()
  {
    var subClaim = GetCurrentUser().FindFirst("sub")?.Value;
    if (!Guid.TryParse(subClaim, out var authUserId))
    {
      throw new InvalidOperationException("The authenticated user does not include a valid 'sub' claim.");
    }

    return authUserId;
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