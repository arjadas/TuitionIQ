using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Microsoft.Extensions.Logging.Abstractions;
using TuitionIQ.Api.Middleware;
using TuitionIQ.Application.Features.Users.Commands;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Infrastructure.Persistence;
using Xunit;

namespace TuitionIQ.UnitTests.Features.Users;

public sealed class VerifyEmailCommandTests
{
  [Fact]
  public async Task Handle_SetsEmailVerified_AndWritesAuditLog()
  {
    await using var dbContext = CreateDbContext();

    var userId = Guid.NewGuid();
    var user = CreateUser(userId, emailVerified: false);

    dbContext.Users.Add(user);
    await dbContext.SaveChangesAsync();

    var handler = new VerifyEmailCommandHandler(dbContext, new AuditLogService(dbContext));

    await handler.Handle(new VerifyEmailCommand(userId), CancellationToken.None);

    var updatedUser = await dbContext.Users.SingleAsync(x => x.Id == userId);
    Assert.True(updatedUser.EmailVerified);

    var auditLog = await dbContext.AuditLogs.SingleAsync();
    Assert.Equal("user.email_verified", auditLog.Action);
    Assert.Equal("users", auditLog.EntityType);
    Assert.Equal(userId, auditLog.EntityId);
    Assert.Equal(userId, auditLog.ActorId);
  }

  [Fact]
  public async Task Handle_IsIdempotent_WhenEmailAlreadyVerified()
  {
    await using var dbContext = CreateDbContext();

    var userId = Guid.NewGuid();
    var user = CreateUser(userId, emailVerified: true);

    dbContext.Users.Add(user);
    await dbContext.SaveChangesAsync();

    var handler = new VerifyEmailCommandHandler(dbContext, new AuditLogService(dbContext));

    await handler.Handle(new VerifyEmailCommand(userId), CancellationToken.None);

    var updatedUser = await dbContext.Users.SingleAsync(x => x.Id == userId);
    Assert.True(updatedUser.EmailVerified);
    Assert.Empty(dbContext.AuditLogs);
  }

  [Fact]
  public async Task Middleware_Returns403_WhenEmailIsNotVerified()
  {
    await using var dbContext = CreateDbContext();

    var userId = Guid.NewGuid();
    dbContext.Users.Add(CreateUser(userId, emailVerified: false));
    await dbContext.SaveChangesAsync();

    var httpContext = new DefaultHttpContext();
    httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
      new[]
      {
        new Claim("sub", userId.ToString())
      },
      authenticationType: "TestAuth"));
    httpContext.Response.Body = new MemoryStream();

    var nextCalled = false;
    RequestDelegate next = _ =>
    {
      nextCalled = true;
      return Task.CompletedTask;
    };

    var middleware = new UserActiveCheckMiddleware(next, NullLogger<UserActiveCheckMiddleware>.Instance);

    await middleware.InvokeAsync(httpContext, dbContext);

    Assert.False(nextCalled);
    Assert.Equal(StatusCodes.Status403Forbidden, httpContext.Response.StatusCode);

    httpContext.Response.Body.Position = 0;
    using var reader = new StreamReader(httpContext.Response.Body, Encoding.UTF8);
    var body = await reader.ReadToEndAsync();

    Assert.Contains("EMAIL_NOT_VERIFIED", body, StringComparison.Ordinal);
  }

  private static AppDbContext CreateDbContext()
  {
    var options = new DbContextOptionsBuilder<AppDbContext>()
      .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
      .Options;

    return new TestAppDbContext(options);
  }

  private static User CreateUser(Guid userId, bool emailVerified)
  {
    var now = DateTimeOffset.UtcNow;

    return new User
    {
      Id = userId,
      AuthUserId = userId.ToString(),
      Email = $"{userId:N}@example.com",
      FirstName = "Test",
      LastName = "User",
      Phone = null,
      AvatarUrl = null,
      EmailVerified = emailVerified,
      IsActive = true,
      CreatedAt = now,
      UpdatedAt = now,
      DeletedAt = null
    };
  }

  private sealed class TestAppDbContext : AppDbContext
  {
    private static readonly ValueConverter<Dictionary<string, object?>?, string?> DictionaryConverter =
      new(
        value => value == null ? null : JsonSerializer.Serialize(value),
        value => string.IsNullOrWhiteSpace(value)
          ? null
          : JsonSerializer.Deserialize<Dictionary<string, object?>>(value));

    private static readonly ValueComparer<Dictionary<string, object?>?> DictionaryComparer =
      new(
        (left, right) => JsonSerializer.Serialize(left) == JsonSerializer.Serialize(right),
        value => value == null ? 0 : JsonSerializer.Serialize(value).GetHashCode(StringComparison.Ordinal),
        value => value == null ? null : JsonSerializer.Deserialize<Dictionary<string, object?>>(JsonSerializer.Serialize(value)));

    public TestAppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
      base.OnModelCreating(modelBuilder);

      ApplyDictionaryConversion(modelBuilder.Entity<Organization>().Property(x => x.Settings));
      ApplyDictionaryConversion(modelBuilder.Entity<Student>().Property(x => x.Metadata));
      ApplyDictionaryConversion(modelBuilder.Entity<AuditLog>().Property(x => x.OldValues));
      ApplyDictionaryConversion(modelBuilder.Entity<AuditLog>().Property(x => x.NewValues));
    }

    private static void ApplyDictionaryConversion(PropertyBuilder<Dictionary<string, object?>?> property)
    {
      property.HasConversion(DictionaryConverter);
      property.Metadata.SetValueComparer(DictionaryComparer);
      property.HasColumnType("text");
    }
  }
}
