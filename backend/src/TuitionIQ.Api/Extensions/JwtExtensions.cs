using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace TuitionIQ.Api.Extensions;

public static class JwtExtensions
{
  private const string PlaceholderValue = "__REPLACE_WITH_ENV__";

  private static bool IsMissingOrPlaceholder(string? value)
  {
    return string.IsNullOrWhiteSpace(value)
      || string.Equals(value, PlaceholderValue, StringComparison.Ordinal)
      || value.Contains("<your-", StringComparison.OrdinalIgnoreCase);
  }

  public static IServiceCollection AddSupabaseJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
  {
    var projectRef = configuration["Supabase:ProjectRef"];
    if (IsMissingOrPlaceholder(projectRef))
    {
      throw new InvalidOperationException("Supabase:ProjectRef is not configured.");
    }

    services
      .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
      .AddJwtBearer(options =>
      {
        var supabaseUrl = $"https://{projectRef!}.supabase.co";

        options.Authority = $"{supabaseUrl}/auth/v1";
        options.MetadataAddress = $"{supabaseUrl}/auth/v1/.well-known/openid-configuration";

        // Supabase emits standard OIDC claim names ("sub", "email", "app_metadata").
        // Without this, the default handler rewrites them to legacy XML URIs
        // (sub -> ClaimTypes.NameIdentifier, ...), so FindFirst("sub") returns null and
        // every downstream identity lookup fails closed with ACCOUNT_SUSPENDED.
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
          ValidateIssuerSigningKey = true,
          ValidAudience = "authenticated",
          ValidateAudience = true,
          ValidIssuer = $"{supabaseUrl}/auth/v1",
          ValidateIssuer = true,
          ValidateLifetime = true,
          ClockSkew = TimeSpan.FromSeconds(30),
          NameClaimType = "sub",
          RoleClaimType = "role"
        };

        options.RequireHttpsMetadata = true;

        options.Events = new JwtBearerEvents
        {
          OnAuthenticationFailed = context =>
          {
            var logger = context.HttpContext.RequestServices
              .GetRequiredService<ILoggerFactory>()
              .CreateLogger("JwtBearer");

            logger.LogWarning(
              context.Exception,
              "JWT authentication failed for {Method} {Path}",
              context.Request.Method,
              context.Request.Path);

            return Task.CompletedTask;
          },
          OnChallenge = context =>
          {
            var logger = context.HttpContext.RequestServices
              .GetRequiredService<ILoggerFactory>()
              .CreateLogger("JwtBearer");

            logger.LogWarning(
              "JWT challenge triggered for {Method} {Path}. Error={Error}, Description={Description}",
              context.Request.Method,
              context.Request.Path,
              context.Error,
              context.ErrorDescription);

            return Task.CompletedTask;
          }
        };
      });

    return services;
  }
}