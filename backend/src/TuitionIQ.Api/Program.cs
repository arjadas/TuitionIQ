using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using TuitionIQ.Api.Extensions;
using TuitionIQ.Api.Middleware;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Infrastructure.Auth;
using TuitionIQ.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

var applicationAssemblies = AppDomain.CurrentDomain
    .GetAssemblies()
    .Where(static assembly =>
        assembly.GetName().Name?.StartsWith("TuitionIQ.Application", StringComparison.Ordinal) == true)
    .ToArray();

if (applicationAssemblies.Length == 0)
{
  applicationAssemblies = new[] { typeof(TuitionIQ.Application.AssemblyReference).Assembly };
}

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddDbContext<AppDbContext>(options =>
{
  var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");

  options.UseNpgsql(connectionString);
});

builder.Services.AddSupabaseJwtAuthentication(builder.Configuration);

builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IAppDbContext>(serviceProvider => serviceProvider.GetRequiredService<AppDbContext>());
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

builder.Services.AddMediatR(configuration => configuration.RegisterServicesFromAssemblies(applicationAssemblies));
builder.Services.AddValidatorsFromAssemblies(applicationAssemblies);

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

  options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
  app.UseSwagger();
  app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<UserActiveCheckMiddleware>();
app.UseMiddleware<OriginValidationMiddleware>();

app.MapControllers();

app.Run();