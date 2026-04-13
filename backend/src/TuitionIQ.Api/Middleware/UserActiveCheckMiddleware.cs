using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Infrastructure.Persistence;

namespace TuitionIQ.Api.Middleware;

public sealed class UserActiveCheckMiddleware
{
  private const string UserStatusCacheKey = "UserActiveCheckMiddleware.Status";
  private const string AccountSuspendedCode = "ACCOUNT_SUSPENDED";
  private const string EmailNotVerifiedCode = "EMAIL_NOT_VERIFIED";
  private static readonly PathString EmailVerificationPath = new("/api/users/email-verification");
  private readonly RequestDelegate _next;

  private sealed record UserStatus(bool IsActive, bool EmailVerified, bool IsDeleted = false);

  public UserActiveCheckMiddleware(RequestDelegate next)
  {
    _next = next;
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
      if (!cachedStatus.IsActive || cachedStatus.IsDeleted)
      {
        await WriteForbiddenAsync(context, AccountSuspendedCode);
        return;
      }

      if (!cachedStatus.EmailVerified)
      {
        if (allowUnverifiedRequest)
        {
          await _next(context);
          return;
        }

        // API must block unverified users independently of client route guards.
        await WriteForbiddenAsync(context, EmailNotVerifiedCode);
        return;
      }

      await _next(context);
      return;
    }

    var subClaim = context.User.FindFirst("sub")?.Value;
    if (!Guid.TryParse(subClaim, out var userId))
    {
      context.Items[UserStatusCacheKey] = new UserStatus(false, false);
      await WriteForbiddenAsync(context, AccountSuspendedCode);
      return;
    }

    IQueryable<UserStatus> userStatusQuery = dbContext.Users
      .IgnoreQueryFilters()
      .AsNoTracking()
      .Where(user => user.Id == userId)
      .Select(user => new UserStatus(user.IsActive, user.EmailVerified, user.DeletedAt != null));

    var status = await userStatusQuery.FirstOrDefaultAsync(context.RequestAborted);
    var resolvedStatus = status;

    if (resolvedStatus is null)
    {
      resolvedStatus = await ProvisionUserFromClaimsAsync(context, dbContext, userId);
    }

    if (resolvedStatus is null)
    {
      resolvedStatus = new UserStatus(false, false);
    }

    context.Items[UserStatusCacheKey] = resolvedStatus;

    if (!resolvedStatus.IsActive || resolvedStatus.IsDeleted)
    {
      await WriteForbiddenAsync(context, AccountSuspendedCode);
      return;
    }

    if (!resolvedStatus.EmailVerified)
    {
      if (allowUnverifiedRequest)
      {
        await _next(context);
        return;
      }

      await WriteForbiddenAsync(context, EmailNotVerifiedCode);
      return;
    }

    await _next(context);
  }

  private static async Task<UserStatus?> ProvisionUserFromClaimsAsync(
    HttpContext context,
    AppDbContext dbContext,
    Guid userId)
  {
    var emailClaim = context.User.FindFirst("email")?.Value;
    if (string.IsNullOrWhiteSpace(emailClaim))
    {
      return null;
    }

    var now = DateTimeOffset.UtcNow;

    var user = new User
    {
      Id = userId,
      AuthUserId = userId.ToString(),
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
      return new UserStatus(user.IsActive, user.EmailVerified);
    }
    catch (DbUpdateException)
    {
      IQueryable<UserStatus> retryQuery = dbContext.Users
        .IgnoreQueryFilters()
        .AsNoTracking()
        .Where(existingUser => existingUser.Id == userId)
        .Select(existingUser => new UserStatus(existingUser.IsActive, existingUser.EmailVerified, existingUser.DeletedAt != null));

      return await retryQuery.FirstOrDefaultAsync(context.RequestAborted);
    }
  }

  private static bool AllowsUnverifiedUser(PathString requestPath)
  {
    return requestPath.StartsWithSegments(EmailVerificationPath, StringComparison.OrdinalIgnoreCase);
  }

  private static async Task WriteForbiddenAsync(HttpContext context, string code)
  {
    if (context.Response.HasStarted)
    {
      return;
    }

    context.Response.StatusCode = StatusCodes.Status403Forbidden;
    await context.Response.WriteAsJsonAsync(new { code });
  }
}