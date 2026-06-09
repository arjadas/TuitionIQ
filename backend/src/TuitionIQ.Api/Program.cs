using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using Npgsql;
using TuitionIQ.Api.Extensions;
using TuitionIQ.Api.Middleware;
using TuitionIQ.Application.Common.Behaviors;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Common.Security;
using TuitionIQ.Infrastructure.Auth;
using TuitionIQ.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

var applicationAssembly = typeof(TuitionIQ.Application.AssemblyReference).Assembly;

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
  ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");

// A single, app-wide NpgsqlDataSource owns the connection pool and the type mappings.
// EnableDynamicJson() opts in to reflection-based System.Text.Json serialization, which Npgsql 8+
// requires to write Dictionary<string, object?> (and other dynamic shapes) to jsonb columns
// (organizations.settings, students.metadata, audit_logs.old_values/new_values). Without it,
// Npgsql throws InvalidCastException on every jsonb dictionary write.
// Registered via a factory lambda so the DI container owns the data source's disposal and a single
// connection pool is shared process-wide (not one per request).
builder.Services.AddSingleton<NpgsqlDataSource>(_ =>
{
  var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
  dataSourceBuilder.EnableDynamicJson();
  return dataSourceBuilder.Build();
});

builder.Services.AddDbContext<AppDbContext>((serviceProvider, options) =>
{
  options.UseNpgsql(serviceProvider.GetRequiredService<NpgsqlDataSource>());
});

builder.Services.AddSupabaseJwtAuthentication(builder.Configuration);

builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAppDbContext>(serviceProvider => serviceProvider.GetRequiredService<AppDbContext>());
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<IOrganizationAuthorizationService, OrganizationAuthorizationService>();

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

// HTTPS redirection is only meaningful when an HTTPS endpoint is configured.
// The local API listens on HTTP only (see appsettings "urls"), so enabling it in
// Development just logs "Failed to determine the https port for redirect" on every
// request. Apply it outside Development, where TLS is terminated properly.
if (!app.Environment.IsDevelopment())
{
  app.UseHttpsRedirection();
}

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