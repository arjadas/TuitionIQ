using Microsoft.AspNetCore.Http;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Common.Models;

namespace TuitionIQ.Infrastructure.Auth;

public sealed class CurrentUserService : ICurrentUserService
{
  private readonly IHttpContextAccessor _httpContextAccessor;

  public CurrentUserService(IHttpContextAccessor httpContextAccessor)
  {
    _httpContextAccessor = httpContextAccessor;
  }

  public Guid GetUserId()
  {
    var userId = GetCurrentUser().GetUserIdFromSub();
    if (userId is null)
    {
      throw new InvalidOperationException("The authenticated user does not include a valid 'sub' claim.");
    }

    return userId.Value;
  }

  public IReadOnlyList<OrgClaim> GetOrgClaims()
  {
    return GetCurrentUser().GetOrgClaims();
  }

  private System.Security.Claims.ClaimsPrincipal GetCurrentUser()
  {
    return _httpContextAccessor.HttpContext?.User
      ?? throw new InvalidOperationException("No active HttpContext user is available.");
  }
}
