using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using Microsoft.IdentityModel.Tokens;
using TuitionIQ.Api.Middleware;
using TuitionIQ.Application.Common.Behaviors;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Infrastructure.Auth;
using TuitionIQ.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

var applicationAssembly = typeof(TuitionIQ.Application.AssemblyReference).Assembly;

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddDbContext<AppDbContext>(options =>
{
  var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");

  options.UseNpgsql(connectionString);
});

var projectRef = builder.Configuration["Supabase:ProjectRef"];
if (string.IsNullOrWhiteSpace(projectRef))
{
  throw new InvalidOperationException("Supabase:ProjectRef is not configured.");
}

var issuer = $"https://{projectRef}.supabase.co/auth/v1";
builder.Services
  .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
  .AddJwtBearer(options =>
  {
    options.Authority = issuer;
    options.MetadataAddress = $"{issuer}/.well-known/openid-configuration";

    options.TokenValidationParameters = new TokenValidationParameters
    {
      ValidateIssuerSigningKey = true,
      ValidateAudience = true,
      ValidAudience = "authenticated",
      ValidateIssuer = true,
      ValidIssuer = issuer,
      ValidateLifetime = true,
      ClockSkew = TimeSpan.FromSeconds(30)
    };

    options.RequireHttpsMetadata = true;

    options.Events = new JwtBearerEvents
    {
      OnTokenValidated = context =>
      {
        var sub = context.Principal?.FindFirst("sub")?.Value;
        if (string.IsNullOrWhiteSpace(sub))
        {
          context.Fail("Missing required 'sub' claim.");
        }

        return Task.CompletedTask;
      }
    };
  });

builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAppDbContext>(serviceProvider => serviceProvider.GetRequiredService<AppDbContext>());
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddHttpClient<ISupabaseAdminClient, SupabaseAdminClient>();

builder.Services.AddMediatR(configuration => configuration.RegisterServicesFromAssembly(applicationAssembly));
builder.Services.AddValidatorsFromAssembly(applicationAssembly);
builder.Services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

builder.Services.AddCors(options =>
{
  var allowedOrigins = builder.Configuration
    .GetSection("App:AllowedOrigins")
    .Get<string[]>()
    ?? Array.Empty<string>();

  var corsOrigins = allowedOrigins
    .Where(origin => origin.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
      || origin.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
    .ToArray();

  options.AddPolicy("ExpoWebPolicy", policy =>
  {
    policy.WithOrigins(corsOrigins)
      .AllowAnyHeader()
      .AllowAnyMethod();
  });
});

builder.Services.AddSwaggerGen(options =>
{
  options.SwaggerDoc("v1", new OpenApiInfo
  {
    Title = "TuitionIQ API",
    Version = "v1"
  });

  options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
  {
    Name = "Authorization",
    Type = SecuritySchemeType.Http,
    Scheme = "bearer",
    BearerFormat = "JWT",
    In = ParameterLocation.Header,
    Description = "Enter JWT token in the format: Bearer {token}"
  });

  options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = new List<string>()
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
  app.UseSwagger();
  app.UseSwaggerUI();
}

app.UseHttpsRedirection();  // Redirect HTTP requests to HTTPS for secure communication

app.UseRouting();  // Matches the incoming request to an endpoint (but doesn’t execute it yet)

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseCors("ExpoWebPolicy");  // Adds CORS headers so browsers allow requests from approved frontend origins

app.UseMiddleware<OriginValidationMiddleware>();
// Optional security layer to validate request origin (extra protection beyond CORS, e.g. CSRF hardening)

app.UseAuthentication();  // Identifies the user (e.g. validates JWT and sets HttpContext.User)

app.UseMiddleware<UserActiveCheckMiddleware>();
// Custom check to ensure the user/account is still active after authentication has populated HttpContext.User

app.UseAuthorization();  // Enforces access rules (e.g. [Authorize] attributes, roles, policies)

app.MapControllers();  // Executes the matched controller action for the request

app.Run();  // Starts the application and begins listening for incoming requests

public partial class Program
{
}