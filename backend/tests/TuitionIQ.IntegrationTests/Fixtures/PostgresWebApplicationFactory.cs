using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Testcontainers.PostgreSql;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Infrastructure.Persistence;
using Xunit;

namespace TuitionIQ.IntegrationTests.Fixtures;

/// <summary>
/// Integration-test host backed by a real PostgreSQL container.
///
/// Unlike <see cref="TestWebApplicationFactory"/> (EF InMemory + a JSON-string value converter that
/// masks real Npgsql jsonb behaviour), this factory keeps the PRODUCTION <see cref="AppDbContext"/>
/// and its <c>EnableDynamicJson()</c>-configured <c>NpgsqlDataSource</c> from <c>Program.cs</c> fully
/// intact. It only points the connection string at the container and swaps JWT auth for the
/// header-based test handler. It therefore exercises the real jsonb serialization path and will fail
/// if the dynamic-JSON opt-in is ever removed.
///
/// Requires Docker to be available on the host/CI agent.
/// </summary>
public sealed class PostgresWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
  private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:16")
    .Build();

  async Task IAsyncLifetime.InitializeAsync()
  {
    await _container.StartAsync();

    // Create the schema exactly once, before any host is built. Running Migrate() inside CreateHost
    // is fragile: WebApplicationFactory can build the host more than once, re-running the migration
    // against an already-migrated database ("relation already exists"). A standalone context keeps
    // bootstrap to a single run. DDL only — EnableDynamicJson is not needed here.
    var options = new DbContextOptionsBuilder<AppDbContext>()
      .UseNpgsql(_container.GetConnectionString())
      .Options;
    await using var migrationContext = new AppDbContext(options);
    await migrationContext.Database.MigrateAsync();
  }

  async Task IAsyncLifetime.DisposeAsync()
  {
    // Dispose the host first so the NpgsqlDataSource pool closes its connections, then stop the container.
    await base.DisposeAsync();
    await _container.DisposeAsync();
  }

  protected override IHost CreateHost(IHostBuilder builder)
  {
    builder.UseEnvironment("Development");

    builder.ConfigureAppConfiguration((_, configurationBuilder) =>
    {
      configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
      {
        // Program.cs reads this at registration time to build the singleton NpgsqlDataSource
        // (with EnableDynamicJson). Pointing it at the container makes the production data-source
        // path run against real PostgreSQL — the entire purpose of this fixture.
        ["ConnectionStrings:DefaultConnection"] = _container.GetConnectionString(),
        ["Supabase:ProjectRef"] = "integration-tests"
      });
    });

    builder.ConfigureServices(services =>
    {
      // Swap JWT auth for the header-based test handler (mirrors TestWebApplicationFactory).
      // The production AppDbContext / NpgsqlDataSource registrations are deliberately left intact.
      services.AddAuthentication(options =>
      {
        options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
        options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
      }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
    });

    // Schema is created once in InitializeAsync (see above), not here — CreateHost can run more
    // than once per factory, and re-running the migration would fail with "relation already exists".
    return base.CreateHost(builder);
  }

  // Seeds a verified, active user so it passes UserActiveCheckMiddleware. Internal id == auth uid
  // (the degenerate case used by most tests); the X-Test-UserId header carries the same value.
  public async Task SeedUserAsync(Guid userId, bool emailVerified = true, bool isActive = true)
  {
    using var scope = Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    var now = DateTimeOffset.UtcNow;

    dbContext.Users.Add(new User
    {
      Id = userId,
      AuthUserId = userId.ToString(),
      Email = $"{userId:N}@example.com",
      FirstName = "Integration",
      LastName = "User",
      Phone = null,
      AvatarUrl = null,
      EmailVerified = emailVerified,
      IsActive = isActive,
      CreatedAt = now,
      UpdatedAt = now,
      DeletedAt = null
    });

    await dbContext.SaveChangesAsync();
  }

  // Runs a read query against the live container database on a fresh scope.
  public async Task<T> QueryAsync<T>(Func<AppDbContext, Task<T>> query)
  {
    using var scope = Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    return await query(dbContext);
  }
}
