using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using TuitionIQ.Application.Common.Exceptions;

namespace TuitionIQ.Api.Middleware;

public sealed class ExceptionHandlingMiddleware
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
    catch (Exception exception)
    {
      await HandleExceptionAsync(context, exception);
    }
  }

  private async Task HandleExceptionAsync(HttpContext context, Exception exception)
  {
    if (context.Response.HasStarted)
    {
      throw;
    }

    var (statusCode, title, detail, errors) = MapException(exception);

    _logger.LogError(exception, "Request failed with status code {StatusCode}.", statusCode);

    context.Response.StatusCode = statusCode;

    var problemDetails = new ProblemDetails
    {
      Status = statusCode,
      Title = title,
      Detail = detail,
      Type = $"https://httpstatuses.com/{statusCode}",
      Instance = context.Request.Path
    };

    problemDetails.Extensions["traceId"] = context.TraceIdentifier;

    if (errors is not null)
    {
      problemDetails.Extensions["errors"] = errors;
    }

    await context.Response.WriteAsJsonAsync(problemDetails);
  }

  private static (int StatusCode, string Title, string Detail, IReadOnlyDictionary<string, string[]>? Errors) MapException(Exception exception)
  {
    switch (exception)
    {
      case ValidationException validationException:
      {
        var groupedErrors = validationException.Errors
          .GroupBy(failure => failure.PropertyName)
          .ToDictionary(
            grouping => grouping.Key,
            grouping => grouping.Select(failure => failure.ErrorMessage).Distinct().ToArray());

        return (
          StatusCodes.Status422UnprocessableEntity,
          "Validation Failed",
          "One or more validation errors occurred.",
          groupedErrors);
      }
      case ConflictException conflictException:
        return (
          StatusCodes.Status409Conflict,
          "Conflict",
          conflictException.Message,
          null);
      case ForbiddenException forbiddenException:
        return (
          StatusCodes.Status403Forbidden,
          "Forbidden",
          forbiddenException.Message,
          null);
      case NotFoundException notFoundException:
        return (
          StatusCodes.Status404NotFound,
          "Not Found",
          notFoundException.Message,
          null);
      case Exception when IsOrganizationSlugConflict(exception):
        return (
          StatusCodes.Status409Conflict,
          "Conflict",
          "Organization slug is already in use.",
          null);
      default:
        return (
          StatusCodes.Status500InternalServerError,
          "Internal Server Error",
          "An unexpected error occurred.",
          null);
    }
  }

  private static bool IsOrganizationSlugConflict(Exception exception)
  {
    var message = exception.InnerException?.Message ?? exception.Message;
    return message.Contains("idx_organizations_slug", StringComparison.OrdinalIgnoreCase)
      || message.Contains("organizations_slug", StringComparison.OrdinalIgnoreCase)
      || message.Contains("organizations_slug_key", StringComparison.OrdinalIgnoreCase);
  }
}