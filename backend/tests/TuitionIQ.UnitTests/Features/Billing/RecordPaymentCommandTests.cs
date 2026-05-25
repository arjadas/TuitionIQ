using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Commands;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;
using TuitionIQ.Infrastructure.Persistence;
using Xunit;

namespace TuitionIQ.UnitTests.Features.Billing;

public sealed class RecordPaymentCommandTests
{
  [Fact]
  public async Task Handle_FullPayment_MarksPeriodPaid_AndWritesAuditLog()
  {
    await using var dbContext = CreateDbContext();

    var period = CreateUnpaidPeriod(fee: 10_000, currency: "USD");
    dbContext.FeePeriods.Add(period);
    await dbContext.SaveChangesAsync();

    var handler = CreateHandler(dbContext, OrganizationMemberRole.Owner);

    var result = await handler.Handle(
      CreateCommand(period, amount: 10_000, currency: "USD"),
      CancellationToken.None);

    Assert.Equal("Paid", result.Status);
    Assert.Equal(10_000, result.AmountPaid);

    var storedPeriod = await dbContext.FeePeriods.SingleAsync(x => x.Id == period.Id);
    Assert.Equal(FeePeriodStatus.Paid, storedPeriod.Status);
    Assert.Equal(10_000, storedPeriod.AmountPaid);

    var payment = await dbContext.FeePayments.SingleAsync();
    Assert.Equal(10_000, payment.Amount);
    Assert.Equal(PaymentMethod.Cash, payment.PaymentMethod);
    Assert.Equal("USD", payment.Currency);

    var auditLog = await dbContext.AuditLogs.SingleAsync();
    Assert.Equal("fee_payment.recorded", auditLog.Action);
    Assert.Equal("fee_payments", auditLog.EntityType);
    Assert.Equal(payment.Id, auditLog.EntityId);
    Assert.Equal(period.OrganizationId, auditLog.OrganizationId);
    Assert.NotNull(auditLog.NewValues);
    Assert.Equal("Paid", auditLog.NewValues!["period_status_after"]?.ToString());
  }

  [Fact]
  public async Task Handle_PartialPayment_MarksPeriodPartial()
  {
    await using var dbContext = CreateDbContext();

    var period = CreateUnpaidPeriod(fee: 10_000, currency: "USD");
    dbContext.FeePeriods.Add(period);
    await dbContext.SaveChangesAsync();

    var handler = CreateHandler(dbContext, OrganizationMemberRole.Owner);

    var result = await handler.Handle(
      CreateCommand(period, amount: 4_000, currency: "USD"),
      CancellationToken.None);

    Assert.Equal("Partial", result.Status);
    Assert.Equal(4_000, result.AmountPaid);

    var storedPeriod = await dbContext.FeePeriods.SingleAsync(x => x.Id == period.Id);
    Assert.Equal(FeePeriodStatus.Partial, storedPeriod.Status);
  }

  [Fact]
  public async Task Handle_CurrencyMismatch_ThrowsConflict_AndPersistsNothing()
  {
    await using var dbContext = CreateDbContext();

    var period = CreateUnpaidPeriod(fee: 10_000, currency: "USD");
    dbContext.FeePeriods.Add(period);
    await dbContext.SaveChangesAsync();

    var handler = CreateHandler(dbContext, OrganizationMemberRole.Owner);

    await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(
      CreateCommand(period, amount: 10_000, currency: "EUR"),
      CancellationToken.None));

    Assert.Empty(dbContext.FeePayments);
    Assert.Empty(dbContext.AuditLogs);

    var storedPeriod = await dbContext.FeePeriods.SingleAsync(x => x.Id == period.Id);
    Assert.Equal(FeePeriodStatus.Unpaid, storedPeriod.Status);
    Assert.Equal(0, storedPeriod.AmountPaid);
  }

  [Fact]
  public async Task Handle_InvalidPaymentMethod_ThrowsValidation()
  {
    await using var dbContext = CreateDbContext();

    var period = CreateUnpaidPeriod(fee: 10_000, currency: "USD");
    dbContext.FeePeriods.Add(period);
    await dbContext.SaveChangesAsync();

    var handler = CreateHandler(dbContext, OrganizationMemberRole.Owner);

    var command = CreateCommand(period, amount: 10_000, currency: "USD") with { PaymentMethod = "Bitcoin" };

    await Assert.ThrowsAsync<FluentValidation.ValidationException>(() => handler.Handle(command, CancellationToken.None));

    Assert.Empty(dbContext.FeePayments);
  }

  private static RecordPaymentCommandHandler CreateHandler(AppDbContext dbContext, OrganizationMemberRole callerRole)
  {
    return new RecordPaymentCommandHandler(
      dbContext,
      new AuditLogService(dbContext),
      new FakeOrganizationAuthorizationService(callerRole));
  }

  private static RecordPaymentCommand CreateCommand(FeePeriod period, long amount, string currency)
  {
    return new RecordPaymentCommand(
      UserId: Guid.NewGuid(),
      StudentId: period.StudentId,
      FeePeriodId: period.Id,
      Amount: amount,
      Currency: currency,
      PaymentDate: DateOnly.FromDateTime(DateTime.UtcNow),
      PaymentMethod: "Cash",
      Reference: null,
      Notes: null);
  }

  private static FeePeriod CreateUnpaidPeriod(long fee, string currency)
  {
    var now = DateTimeOffset.UtcNow;

    return new FeePeriod
    {
      Id = Guid.NewGuid(),
      OrganizationId = Guid.NewGuid(),
      StudentId = Guid.NewGuid(),
      StudentFeeId = null,
      PeriodYear = 2026,
      PeriodMonth = 5,
      Fee = fee,
      AmountPaid = 0,
      Currency = currency,
      Status = FeePeriodStatus.Unpaid,
      DueDate = DateOnly.FromDateTime(now.UtcDateTime),
      CreatedAt = now,
      UpdatedAt = now
    };
  }

  private static AppDbContext CreateDbContext()
  {
    var options = new DbContextOptionsBuilder<AppDbContext>()
      .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
      .Options;

    return new TestAppDbContext(options);
  }

  private sealed class FakeOrganizationAuthorizationService : IOrganizationAuthorizationService
  {
    private readonly OrganizationMemberRole _callerRole;

    public FakeOrganizationAuthorizationService(OrganizationMemberRole callerRole)
    {
      _callerRole = callerRole;
    }

    public Task<OrganizationMemberRole> RequireTeacherOrHigherAsync(
      Guid organizationId,
      Guid userId,
      string forbiddenMessage,
      CancellationToken cancellationToken = default)
    {
      return Task.FromResult(_callerRole);
    }

    public Task<OrganizationMemberRole> RequireOwnerOrAdminAsync(
      Guid organizationId,
      Guid userId,
      string forbiddenMessage,
      CancellationToken cancellationToken = default)
    {
      return Task.FromResult(_callerRole);
    }

    public Task EnsureTeacherHasStudentAccessAsync(
      Guid organizationId,
      Guid teacherId,
      Guid studentId,
      string forbiddenMessage,
      CancellationToken cancellationToken = default)
    {
      return Task.CompletedTask;
    }
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
