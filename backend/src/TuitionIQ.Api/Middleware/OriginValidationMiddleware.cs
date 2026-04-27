using Microsoft.AspNetCore.Mvc;

namespace TuitionIQ.Api.Middleware;

public sealed class OriginValidationMiddleware
{
  private readonly RequestDelegate _next;
  private readonly string[] _allowedOrigins;
  private readonly ILogger<OriginValidationMiddleware> _logger;

  public OriginValidationMiddleware(
    RequestDelegate next,
    IConfiguration configuration,
    ILogger<OriginValidationMiddleware> logger)
  {
    _next = next;
    _logger = logger;
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
        _logger.LogWarning(
          "Origin validation blocked request: {Method} {Path} from origin {Origin}",
          context.Request.Method,
          context.Request.Path,
          origin);
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
    var normalizedOrigin = NormalizeOrigin(origin);
    if (normalizedOrigin is null)
    {
      return false;
    }

    return _allowedOrigins
      .Select(NormalizeOrigin)
      .Any(allowedOrigin =>
        allowedOrigin is not null
        && string.Equals(allowedOrigin, normalizedOrigin, StringComparison.OrdinalIgnoreCase));
  }

  private static string? NormalizeOrigin(string origin)
  {
    if (string.IsNullOrWhiteSpace(origin))
    {
      return null;
    }

    if (!Uri.TryCreate(origin, UriKind.Absolute, out var parsedOrigin))
    {
      return null;
    }

    if (string.IsNullOrWhiteSpace(parsedOrigin.Host))
    {
      return $"{parsedOrigin.Scheme}://";
    }

    var isDefaultPort = parsedOrigin.IsDefaultPort
      || (string.Equals(parsedOrigin.Scheme, "http", StringComparison.OrdinalIgnoreCase) && parsedOrigin.Port == 80)
      || (string.Equals(parsedOrigin.Scheme, "https", StringComparison.OrdinalIgnoreCase) && parsedOrigin.Port == 443);

    return isDefaultPort
      ? $"{parsedOrigin.Scheme}://{parsedOrigin.Host}"
      : $"{parsedOrigin.Scheme}://{parsedOrigin.Host}:{parsedOrigin.Port}";
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