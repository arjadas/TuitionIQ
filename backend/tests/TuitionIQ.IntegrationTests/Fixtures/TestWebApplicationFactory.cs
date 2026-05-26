using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Infrastructure.Persistence;

namespace TuitionIQ.IntegrationTests.Fixtures;

public sealed class TestWebApplicationFactory : WebApplicationFactory<Program>
{
  private readonly string _databaseName = $"tuitioniq-tests-{Guid.NewGuid():N}";

  public string ProjectRef { get; } = "integration-tests";

  protected override IHost CreateHost(IHostBuilder builder)
  {
    builder.UseEnvironment("Development");

    builder.ConfigureAppConfiguration((_, configurationBuilder) =>
    {
      configurationBuilder.AddInMemoryCollection(new Dictionary<string, string?>
      {
        ["ConnectionStrings:DefaultConnection"] = "Host=localhost;Database=unused;Username=unused;Password=unused",
        ["Supabase:ProjectRef"] = ProjectRef
      });
    });

    builder.ConfigureServices(services =>
    {
      services.RemoveAll<DbContextOptions<AppDbContext>>();
      services.RemoveAll<AppDbContext>();
      services.RemoveAll<IAppDbContext>();
      services.RemoveAll<TestAppDbContext>();

      services.AddDbContext<TestAppDbContext>(options => options.UseInMemoryDatabase(_databaseName));
      services.AddScoped<AppDbContext>(serviceProvider => serviceProvider.GetRequiredService<TestAppDbContext>());
      services.AddScoped<IAppDbContext>(serviceProvider => serviceProvider.GetRequiredService<AppDbContext>());

      services.AddAuthentication(options =>
      {
        options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
        options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
      }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ =>
      {
      });
    });

    return base.CreateHost(builder);
  }

  // Degenerate case used by most tests: the internal users.id happens to equal the auth uid.
  public Task SeedUserAsync(Guid userId, bool emailVerified, bool isActive)
    => SeedUserAsync(userId, userId, emailVerified, isActive);

  // Production case: the internal users.id is independent of the Supabase auth uid (sub),
  // which is stored on auth_user_id. Used to prove identity resolution goes through
  // auth_user_id rather than assuming users.id == sub.
  public async Task SeedUserAsync(Guid internalUserId, Guid authUserId, bool emailVerified, bool isActive)
  {
    using var scope = Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    var now = DateTimeOffset.UtcNow;

    dbContext.Users.Add(new User
    {
      Id = internalUserId,
      AuthUserId = authUserId.ToString(),
      Email = $"{internalUserId:N}@example.com",
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
}
