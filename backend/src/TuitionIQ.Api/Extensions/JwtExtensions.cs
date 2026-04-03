using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace TuitionIQ.Api.Extensions;

public static class JwtExtensions
{
  public static IServiceCollection AddSupabaseJwtAuthentication(this IServiceCollection services, IConfiguration configuration)
  {
    var jwtSecret = configuration["SUPABASE_JWT_SECRET"] ?? configuration["Supabase:JwtSecret"];
    if (string.IsNullOrWhiteSpace(jwtSecret))
    {
      throw new InvalidOperationException("SUPABASE_JWT_SECRET is not configured.");
    }

    var projectRef = configuration["SUPABASE_PROJECT_REF"] ?? configuration["Supabase:ProjectRef"];
    if (string.IsNullOrWhiteSpace(projectRef))
    {
      throw new InvalidOperationException("SUPABASE_PROJECT_REF is not configured.");
    }

    services
      .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
      .AddJwtBearer(options =>
      {
        options.TokenValidationParameters = new TokenValidationParameters
        {
          ValidateIssuerSigningKey = true,
          IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
          ValidateAudience = true,
          ValidAudience = "authenticated",
          ValidateIssuer = true,
          ValidIssuer = $"https://{projectRef}.supabase.co/auth/v1",
          ValidateLifetime = true,
          ClockSkew = TimeSpan.FromSeconds(30)
        };
      });

    return services;
  }
}