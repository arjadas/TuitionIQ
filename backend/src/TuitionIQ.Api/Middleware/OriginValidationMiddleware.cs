namespace TuitionIQ.Api.Middleware;

public sealed class OriginValidationMiddleware
{
  private readonly RequestDelegate _next;
  private readonly ILogger<OriginValidationMiddleware> _logger;
  private readonly string[] _allowedOrigins;

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
    if (!IsMutatingMethod(context.Request.Method))
    {
      await _next(context);
      return;
    }

    var origin = context.Request.Headers.Origin.ToString();
    if (string.IsNullOrWhiteSpace(origin))
    {
      await _next(context);
      return;
    }

    if (!IsAllowedOrigin(origin))
    {
      _logger.LogWarning(
        "Blocked state-mutating request from disallowed origin {Origin} ({Method} {Path})",
        origin,
        context.Request.Method,
        context.Request.Path);

      context.Response.StatusCode = StatusCodes.Status403Forbidden;
      await context.Response.WriteAsJsonAsync(new
      {
        code = "ORIGIN_NOT_ALLOWED",
        message = "The request origin is not allowed."
      });
      return;
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

    return _allowedOrigins
      .Where(static value => !string.IsNullOrWhiteSpace(value))
      .Select(NormalizeOrigin)
      .Any(allowed => normalizedOrigin.Equals(allowed, StringComparison.OrdinalIgnoreCase));
  }

  private static string NormalizeOrigin(string origin)
  {
    var trimmed = origin.Trim();

    if (trimmed.EndsWith("/", StringComparison.Ordinal)
        && !trimmed.EndsWith("://", StringComparison.Ordinal))
    {
      return trimmed.TrimEnd('/');
    }

    return trimmed;
  }
}
