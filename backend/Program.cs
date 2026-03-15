using Microsoft.EntityFrameworkCore;
using TuitionIQ.Data;
using TuitionIQ.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();

// Configure Entity Framework Core with SQLite
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

static bool IsAllowedDevOrigin(string? origin)
{
    if (string.IsNullOrWhiteSpace(origin))
    {
        return false;
    }

    if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
    {
        return false;
    }

    var host = uri.Host.ToLowerInvariant();

    if (host == "localhost" || host == "127.0.0.1" || host == "::1")
    {
        return true;
    }

    // Allow common local network ranges for mobile/web dev access.
    if (host.StartsWith("192.168.") || host.StartsWith("10."))
    {
        return true;
    }

    if (host.StartsWith("172."))
    {
        var parts = host.Split('.');
        if (parts.Length > 1 && int.TryParse(parts[1], out var secondOctet))
        {
            return secondOctet >= 16 && secondOctet <= 31;
        }
    }

    return false;
}

// Configure CORS for local web frontends (Vite/Expo web).
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy =>
        {
            policy.SetIsOriginAllowed(origin => builder.Environment.IsDevelopment() && IsAllowedDevOrigin(origin))
                .AllowAnyHeader()
                .AllowAnyMethod();
        });
});

// Add API documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Apply database migrations automatically on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Global exception handling middleware
app.UseExceptionHandling();

app.UseCors("AllowReactApp");

app.UseAuthorization();

app.MapControllers();

app.Run();