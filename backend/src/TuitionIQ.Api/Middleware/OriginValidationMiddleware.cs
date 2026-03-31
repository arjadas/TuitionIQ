using Microsoft.AspNetCore.Mvc;

namespace TuitionIQ.Api.Middleware;

public sealed class OriginValidationMiddleware
{
  private readonly RequestDelegate _next;
  private readonly string[] _allowedOrigins;

  public OriginValidationMiddleware(RequestDelegate next, IConfiguration configuration)
  {
    _next = next;
    _allowedOrigins = configuration
      .GetSection("App:AllowedOrigins")
      .Get<string[]>()
      ?? Array.Empty<string>();
  }

  public async Task InvokeAsync(HttpContext context)
  {
    if (IsMutatingMethod(context.Request.Method))
    {
      var origin = context.Request.Headers.Origin.ToString();

      if (!string.IsNullOrWhiteSpace(origin) && !IsAllowedOrigin(origin))
      {
        await WriteForbiddenAsync(context, origin);
        return;
      }
    }

    await _next(context);
  }

  private static bool IsMutatingMethod(string method)
  {
    return HttpMethods.IsPost(method)
      || HttpMethods.IsPut(method)
      || HttpMethods.IsPatch(method)
      || HttpMethods.IsDelete(method);
  }

  private bool IsAllowedOrigin(string origin)
  {
    return _allowedOrigins
      .Where(static allowed => !string.IsNullOrWhiteSpace(allowed))
      .Any(allowed => origin.StartsWith(allowed, StringComparison.OrdinalIgnoreCase));
  }

  private static async Task WriteForbiddenAsync(HttpContext context, string origin)
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
      Detail = $"The request origin '{origin}' is not allowed.",
      Type = "https://httpstatuses.com/403"
    };

    await context.Response.WriteAsJsonAsync(problem);
  }
}