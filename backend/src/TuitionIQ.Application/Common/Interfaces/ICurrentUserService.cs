using TuitionIQ.Application.Common.Models;

namespace TuitionIQ.Application.Common.Interfaces;

public interface ICurrentUserService
{
  Guid UserId { get; }
  IReadOnlyList<OrgClaim> OrgClaims { get; }
}