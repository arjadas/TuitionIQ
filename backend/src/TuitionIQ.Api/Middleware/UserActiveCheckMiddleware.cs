using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Infrastructure.Auth;
using TuitionIQ.Infrastructure.Persistence;

namespace TuitionIQ.Api.Middleware;

public sealed class UserActiveCheckMiddleware
{
  private const string UserStatusCacheKey = "UserActiveCheckMiddleware.Status";
  private const string AccountSuspendedCode = "ACCOUNT_SUSPENDED";
  private const string EmailNotVerifiedCode = "EMAIL_NOT_VERIFIED";
  private static readonly PathString EmailVerificationPath = new("/api/users/email-verification");
  private readonly RequestDelegate _next;
  private readonly ILogger<UserActiveCheckMiddleware> _logger;

  private sealed record UserStatus(Guid InternalUserId, bool IsActive, bool EmailVerified, bool IsDeleted = false);

  public UserActiveCheckMiddleware(RequestDelegate next, ILogger<UserActiveCheckMiddleware> logger)
  {
    _next = next;
    _logger = logger;
  }

  public async Task InvokeAsync(HttpContext context, AppDbContext dbContext)
  {
    var allowUnverifiedRequest = AllowsUnverifiedUser(context.Request.Path);

    if (context.User.Identity?.IsAuthenticated != true)
    {
      await _next(context);
      return;
    }

    if (context.Items.TryGetValue(UserStatusCacheKey, out var cachedValue) && cachedValue is UserStatus cachedStatus)
    {
      await EvaluateAsync(context, cachedStatus, allowUnverifiedRequest);
      return;
    }

    // The JWT 'sub' claim is the Supabase auth uid (auth.users.id), NOT the internal
    // public.users.id. Resolve the internal identity via the canonical auth_user_id link.
    var subClaim = context.User.FindFirst("sub")?.Value;
    if (!Guid.TryParse(subClaim, out var authUserId))
    {
      await DenyAsync(context, AccountSuspendedCode, $"'sub' claim is missing or not a GUID (sub='{subClaim}')");
      return;
    }

    IQueryable<UserStatus> userStatusQuery = dbContext.Users
      .IgnoreQueryFilters()
      .AsNoTracking()
      .Where(user => user.AuthUserId == subClaim)
      .Select(user => new UserStatus(user.Id, user.IsActive, user.EmailVerified, user.DeletedAt != null));

    var resolvedStatus = await userStatusQuery.FirstOrDefaultAsync(context.RequestAborted);

    if (resolvedStatus is null)
    {
      _logger.LogInformation("UserActiveCheck: no public.users row for auth_user_id={AuthUserId}; attempting provisioning from JWT claims.", authUserId);
      resolvedStatus = await ProvisionUserFromClaimsAsync(context, dbContext, authUserId);
    }

    if (resolvedStatus is null)
    {
      await DenyAsync(
        context,
        AccountSuspendedCode,
        $"could not resolve or provision a public.users row for sub={authUserId} (email claim present: {!string.IsNullOrWhiteSpace(context.User.FindFirst("email")?.Value)})");
      return;
    }

    PublishIdentity(context, resolvedStatus);
    await EvaluateAsync(context, resolvedStatus, allowUnverifiedRequest);
  }

  // Publishes the resolved identity for the rest of the request: the status cache (so a
  // re-entrant invocation short-circuits) and the internal users.id that CurrentUserService
  // hands to every command/query as the canonical identity.
  private static void PublishIdentity(HttpContext context, UserStatus status)
  {
    context.Items[UserStatusCacheKey] = status;
    context.Items[CurrentUserContextKeys.InternalUserId] = status.InternalUserId;
  }

  private async Task EvaluateAsync(HttpContext context, UserStatus status, bool allowUnverifiedRequest)
  {
    if (!status.IsActive || status.IsDeleted)
    {
      await DenyAsync(context, AccountSuspendedCode, $"user internal_id={status.InternalUserId} is_active={status.IsActive} deleted={status.IsDeleted}");
      return;
    }

    if (!status.EmailVerified)
    {
      if (allowUnverifiedRequest)
      {
        await _next(context);
        return;
      }

      // API must block unverified users independently of client route guards.
      await DenyAsync(context, EmailNotVerifiedCode, $"user internal_id={status.InternalUserId} email_verified=false");
      return;
    }

    await _next(context);
  }

  private async Task<UserStatus?> ProvisionUserFromClaimsAsync(
    HttpContext context,
    AppDbContext dbContext,
    Guid authUserId)
  {
    var emailClaim = context.User.FindFirst("email")?.Value;
    if (string.IsNullOrWhiteSpace(emailClaim))
    {
      _logger.LogWarning("UserActiveCheck: cannot provision user for sub={AuthUserId} because the token has no 'email' claim.", authUserId);
      return null;
    }

    var now = DateTimeOffset.UtcNow;

    var user = new User
    {
      // Id is an independent internal identity, never the Supabase auth uid. The auth
      // uid (sub) is stored only in AuthUserId, which is the canonical link to auth.users.
      Id = Guid.NewGuid(),
      AuthUserId = authUserId.ToString(),
      Email = emailClaim.Trim().ToLowerInvariant(),
      FirstName = context.User.FindFirst("given_name")?.Value ?? string.Empty,
      LastName = context.User.FindFirst("family_name")?.Value ?? string.Empty,
      EmailVerified = false,
      IsActive = true,
      CreatedAt = now,
      UpdatedAt = now,
      DeletedAt = null
    };

    try
    {
      dbContext.Users.Add(user);
      await dbContext.SaveChangesAsync(context.RequestAborted);
      _logger.LogInformation("UserActiveCheck: provisioned public.users row id={InternalUserId} for sub={AuthUserId}.", user.Id, authUserId);
      return new UserStatus(user.Id, user.IsActive, user.EmailVerified);
    }
    catch (DbUpdateException ex)
    {
      // A row with this auth_user_id already exists (the DB trigger or a concurrent
      // request created it). Reconcile via the canonical auth_user_id link.
      dbContext.Entry(user).State = EntityState.Detached;

      IQueryable<UserStatus> retryQuery = dbContext.Users
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(existingUser => existingUser.AuthUserId == authUserId.ToString())
        .Select(existingUser => new UserStatus(existingUser.Id, existingUser.IsActive, existingUser.EmailVerified, existingUser.DeletedAt != null));

      var reconciled = await retryQuery.FirstOrDefaultAsync(context.RequestAborted);
      _logger.LogWarning(
        ex,
        "UserActiveCheck: provisioning insert for sub={AuthUserId} conflicted; reconciled by auth_user_id -> {Found}.",
        authUserId,
        reconciled is not null);

      return reconciled;
    }
  }

  private static bool AllowsUnverifiedUser(PathString requestPath)
  {
    return requestPath.StartsWithSegments(EmailVerificationPath, StringComparison.OrdinalIgnoreCase);
  }

  private async Task DenyAsync(HttpContext context, string code, string reason)
  {
    _logger.LogWarning(
      "UserActiveCheck denied {Method} {Path} with {Code}: {Reason}",
      context.Request.Method,
      context.Request.Path,
      code,
      reason);

    await WriteForbiddenAsync(context, code);
  }

  private static async Task WriteForbiddenAsync(HttpContext context, string code)
  {
    if (context.Response.HasStarted)
    {
      return;
    }

    context.Response.StatusCode = StatusCodes.Status403Forbidden;

    var problem = new ProblemDetails
    {
      Status = StatusCodes.Status403Forbidden,
      Title = "Forbidden",
      Type = "https://httpstatuses.com/403",
      Instance = context.Request.Path,
      Detail = code switch
      {
        "ACCOUNT_SUSPENDED" => "Your account has been suspended.",
        "EMAIL_NOT_VERIFIED" => "Please verify your email before accessing this resource.",
        _ => "Access denied."
      }
    };

    problem.Extensions["code"] = code;  // Consistent with ExceptionHandlingMiddleware
    problem.Extensions["traceId"] = context.TraceIdentifier;

    await context.Response.WriteAsJsonAsync(problem);
  }
}
