using Microsoft.EntityFrameworkCore;
using TuitionIQ.Infrastructure.Persistence;

namespace TuitionIQ.Api.Middleware;

public sealed class UserActiveCheckMiddleware
{
  private static readonly PathString EmailVerificationPath = new("/api/users/email-verification");
  private static readonly PathString InviteAcceptPath = new("/api/invites/accept");
  private static readonly PathString SupabaseWebhookPath = new("/api/webhooks/supabase");
  private readonly RequestDelegate _next;

  public UserActiveCheckMiddleware(RequestDelegate next)
  {
    _next = next;
  }

  public async Task InvokeAsync(HttpContext context, AppDbContext dbContext)
  {
    if (context.User.Identity?.IsAuthenticated != true)
    {
      await _next(context);
      return;
    }

    if (IsExemptRoute(context.Request))
    {
      await _next(context);
      return;
    }

    var sub = context.User.FindFirst("sub")?.Value;
    if (!Guid.TryParse(sub, out var userId))
    {
      await WriteForbiddenAsync(
        context,
        "INVALID_SUB_CLAIM",
        "The authenticated token is missing a valid subject claim.");
      return;
    }

    var userStatus = await dbContext.Users
      .IgnoreQueryFilters()
      .AsNoTracking()
      .Where(user => user.Id == userId)
      .Select(user => new
      {
        user.IsActive,
        user.EmailVerified,
        IsDeleted = user.DeletedAt != null
      })
      .FirstOrDefaultAsync(context.RequestAborted);

    if (userStatus is null || !userStatus.IsActive || userStatus.IsDeleted)
    {
      await WriteForbiddenAsync(
        context,
        "ACCOUNT_SUSPENDED",
        "This account is inactive or suspended.");
      return;
    }

    if (!userStatus.EmailVerified)
    {
      await WriteForbiddenAsync(
        context,
        "EMAIL_NOT_VERIFIED",
        "Email verification is required before accessing this resource.");
      return;
    }

    await _next(context);
  }

  private static bool IsExemptRoute(HttpRequest request)
  {
    var path = request.Path;

    if (HttpMethods.IsPatch(request.Method)
        && path.StartsWithSegments(EmailVerificationPath, StringComparison.OrdinalIgnoreCase))
    {
      return true;
    }

    if (HttpMethods.IsPost(request.Method)
        && path.StartsWithSegments(InviteAcceptPath, StringComparison.OrdinalIgnoreCase))
    {
      return true;
    }

    if (path.StartsWithSegments(SupabaseWebhookPath, StringComparison.OrdinalIgnoreCase))
    {
      return true;
    }

    return false;
  }

  private static async Task WriteForbiddenAsync(HttpContext context, string code, string message)
  {
    if (context.Response.HasStarted)
    {
      return;
    }

    context.Response.StatusCode = StatusCodes.Status403Forbidden;
    await context.Response.WriteAsJsonAsync(new
    {
      code,
      message
    });
  }
}
