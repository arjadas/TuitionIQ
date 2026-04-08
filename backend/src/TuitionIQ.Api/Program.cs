using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using TuitionIQ.Api.Extensions;
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
  // Get the connection string from configuration (e.g. appsettings.json/ environment variables)
  var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");

  // Use Npgsql for PostgreSQL database access
  options.UseNpgsql(connectionString);
});

builder.Services.AddSupabaseJwtAuthentication(builder.Configuration);

builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAppDbContext>(serviceProvider => serviceProvider.GetRequiredService<AppDbContext>());
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();

builder.Services.AddMediatR(configuration => configuration.RegisterServicesFromAssembly(applicationAssembly));
builder.Services.AddValidatorsFromAssembly(applicationAssembly);
builder.Services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

builder.Services.AddCors(options =>
{
  options.AddPolicy("ExpoWebPolicy", policy =>
  {
    policy.WithOrigins("http://localhost:8081", "https://tuitioniq.pages.dev")
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