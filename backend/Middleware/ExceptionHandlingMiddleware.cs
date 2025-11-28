using System.Net;
using System.Text.Json;

namespace TuitionIQ.Middleware;

/// <summary>
/// Middleware for handling exceptions globally.
/// Catches unhandled exceptions and returns consistent error responses.
/// </summary>
public class ExceptionHandlingMiddleware
{
  private readonly RequestDelegate _next;
  private readonly ILogger<ExceptionHandlingMiddleware> _logger;

  public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
  {
    _next = next;
    _logger = logger;
  }

  public async Task InvokeAsync(HttpContext context)
  {
    try
    {
      await _next(context);
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "An unhandled exception occurred");
      await HandleExceptionAsync(context, ex);
    }
  }

  private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
  {
    context.Response.ContentType = "application/json";

    HttpStatusCode statusCode;
    string message;

    if (exception is ArgumentException)
    {
      statusCode = HttpStatusCode.BadRequest;
      message = exception.Message;
    }
    else if (exception is KeyNotFoundException)
    {
      statusCode = HttpStatusCode.NotFound;
      message = exception.Message;
    }
    else if (exception is UnauthorizedAccessException)
    {
      statusCode = HttpStatusCode.Unauthorized;
      message = "Unauthorized access";
    }
    else
    {
      statusCode = HttpStatusCode.InternalServerError;
      message = "An unexpected error occurred";
    }

    context.Response.StatusCode = (int)statusCode;

    var response = new
    {
      error = message,
      statusCode = (int)statusCode
    };

    var jsonResponse = JsonSerializer.Serialize(response, new JsonSerializerOptions
    {
      PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    });

    await context.Response.WriteAsync(jsonResponse);
  }
}

/// <summary>
/// Extension method to register the exception handling middleware.
/// </summary>
public static class ExceptionHandlingMiddlewareExtensions
{
  public static IApplicationBuilder UseExceptionHandling(this IApplicationBuilder app)
  {
    return app.UseMiddleware<ExceptionHandlingMiddleware>();
  }
}
