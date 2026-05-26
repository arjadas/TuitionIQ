namespace TuitionIQ.Infrastructure.Auth;

/// <summary>
/// Keys for per-request identity data published into <c>HttpContext.Items</c> by the
/// authentication pipeline and read back by <see cref="CurrentUserService"/>.
/// </summary>
public static class CurrentUserContextKeys
{
  /// <summary>
  /// The resolved internal <c>public.users.id</c> (distinct from the Supabase auth uid
  /// in the JWT <c>sub</c> claim). Set by <c>UserActiveCheckMiddleware</c> after it maps
  /// <c>sub -&gt; users.auth_user_id -&gt; users.id</c>.
  /// </summary>
  public const string InternalUserId = "TuitionIQ.InternalUserId";
}
