using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TuitionIQ.Infrastructure.Persistence;

namespace TuitionIQ.Api.Middleware;

public sealed class UserActiveCheckMiddleware
{
  private const string UserActiveCacheKey = "UserActiveCheckMiddleware.IsActive";
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

    if (context.Items.TryGetValue(UserActiveCacheKey, out var cachedValue) && cachedValue is bool cachedIsActive)
    {
      if (!cachedIsActive)
      {
        await WriteForbiddenAsync(context);
        return;
      }

      await _next(context);
      return;
    }

    var subClaim = context.User.FindFirst("sub")?.Value;
    if (!Guid.TryParse(subClaim, out var userId))
    {
      context.Items[UserActiveCacheKey] = false;
      await WriteForbiddenAsync(context);
      return;
    }

    IQueryable<bool> isActiveQuery = dbContext.Users
      .AsNoTracking()
      .Where(user => user.Id == userId && user.IsActive)
      .Select(user => user.IsActive);

    var isActive = await isActiveQuery.FirstOrDefaultAsync(context.RequestAborted);
    context.Items[UserActiveCacheKey] = isActive;

    if (!isActive)
    {
      await WriteForbiddenAsync(context);
      return;
    }

    await _next(context);
  }

  private static async Task WriteForbiddenAsync(HttpContext context)
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
      Detail = "The current user is inactive or unavailable.",
      Type = "https://httpstatuses.com/403"
    };

    await context.Response.WriteAsJsonAsync(problem);
  }
}