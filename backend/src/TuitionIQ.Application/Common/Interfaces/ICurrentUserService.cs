using TuitionIQ.Application.Common.Models;

namespace TuitionIQ.Application.Common.Interfaces;

public interface ICurrentUserService
{
  Guid GetUserId();
  IReadOnlyList<OrgClaim> GetOrgClaims();
}