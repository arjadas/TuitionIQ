using TuitionIQ.Application.Common.Models;

namespace TuitionIQ.Application.Common.Interfaces;

public interface ICurrentUserService
{
  /// <summary>The internal <c>public.users.id</c> — the canonical identity used by all
  /// commands, queries, and foreign keys.</summary>
  Guid UserId { get; }

  /// <summary>The Supabase auth uid (<c>auth.users.id</c>, the JWT <c>sub</c> claim).
  /// Stored on <c>public.users.auth_user_id</c>; rarely needed directly.</summary>
  Guid AuthUserId { get; }

  IReadOnlyList<OrgClaim> OrgClaims { get; }
}