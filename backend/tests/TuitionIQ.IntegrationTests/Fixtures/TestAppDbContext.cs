using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Infrastructure.Persistence;

namespace TuitionIQ.IntegrationTests.Fixtures;

public sealed class TestAppDbContext : AppDbContext
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

  public TestAppDbContext(DbContextOptions<TestAppDbContext> options) : base(options)
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
