using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Dtos;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Billing.Commands;

public sealed record RecordPaymentCommand(
  Guid UserId,
  Guid StudentId,
  Guid FeePeriodId,
  long Amount,
  string Currency,
  DateOnly PaymentDate,
  string PaymentMethod,
  string? Reference,
  string? Notes) : IRequest<FeePeriodDto>;

public sealed class RecordPaymentCommandValidator : AbstractValidator<RecordPaymentCommand>
{
  public RecordPaymentCommandValidator()
  {
    RuleFor(command => command.StudentId)
      .NotEqual(Guid.Empty);

    RuleFor(command => command.FeePeriodId)
      .NotEqual(Guid.Empty);

    RuleFor(command => command.Amount)
      .GreaterThan(0);

    RuleFor(command => command.Currency)
      .Cascade(CascadeMode.Stop)
      .NotEmpty()
      .Must(currency => currency is not null && currency.Trim().Length == 3)
      .WithMessage("Currency must be 3 characters.");

    RuleFor(command => command.PaymentDate)
      .Must(BeValidPaymentDate)
      .WithMessage("PaymentDate cannot be in the future.");

    RuleFor(command => command.PaymentMethod)
      .Cascade(CascadeMode.Stop)
      .NotEmpty()
      .Must(BeValidPaymentMethod)
      .WithMessage("PaymentMethod must be one of: Cash, BankTransfer, Card, Cheque, Other.");
  }

  private static bool BeValidPaymentDate(DateOnly paymentDate)
  {
    if (paymentDate == default)
    {
      return false;
    }

    var today = DateOnly.FromDateTime(DateTime.UtcNow);
    return paymentDate <= today;
  }

  private static bool BeValidPaymentMethod(string paymentMethod)
  {
    return PaymentMethodParser.TryParse(paymentMethod, out _);
  }
}

public sealed class RecordPaymentCommandHandler : IRequestHandler<RecordPaymentCommand, FeePeriodDto>
{
  private readonly IAppDbContext _dbContext;
  private readonly IAuditLogService _auditLogService;
  private readonly IOrganizationAuthorizationService _organizationAuthorizationService;
  private readonly ILogger<RecordPaymentCommandHandler> _logger;

  public RecordPaymentCommandHandler(
    IAppDbContext dbContext,
    IAuditLogService auditLogService,
    IOrganizationAuthorizationService organizationAuthorizationService,
    ILogger<RecordPaymentCommandHandler> logger)
  {
    _dbContext = dbContext;
    _auditLogService = auditLogService;
    _organizationAuthorizationService = organizationAuthorizationService;
    _logger = logger;
  }

  public async Task<FeePeriodDto> Handle(RecordPaymentCommand request, CancellationToken cancellationToken)
  {
    if (!PaymentMethodParser.TryParse(request.PaymentMethod, out var paymentMethod))
    {
      throw new ValidationException("PaymentMethod must be one of: Cash, BankTransfer, Card, Cheque, Other.");
    }

    var paymentDate = request.PaymentDate;
    var today = DateOnly.FromDateTime(DateTime.UtcNow);
    if (paymentDate < today.AddDays(-7))
    {
      _logger.LogWarning(
        "Recording backdated payment older than 7 days. StudentId: {StudentId}, FeePeriodId: {FeePeriodId}, PaymentDate: {PaymentDate}",
        request.StudentId,
        request.FeePeriodId,
        paymentDate);
    }

    var feePeriodSnapshot = await GetFeePeriodSnapshotAsync(request.StudentId, request.FeePeriodId, cancellationToken);

    var callerRole = await _organizationAuthorizationService.RequireTeacherOrHigherAsync(
      feePeriodSnapshot.OrganizationId,
      request.UserId,
      "You are not allowed to record payments for this student.",
      cancellationToken);

    if (callerRole == OrganizationMemberRole.Teacher)
    {
      await _organizationAuthorizationService.EnsureTeacherHasStudentAccessAsync(
        feePeriodSnapshot.OrganizationId,
        request.UserId,
        request.StudentId,
        "You are not allowed to record payments for this student.",
        cancellationToken);
    }

    await using var transaction = await _dbContext.BeginTransactionAsync(cancellationToken);
    try
    {
      var now = DateTimeOffset.UtcNow;
      var normalizedCurrency = request.Currency.Trim().ToUpperInvariant();

      var feePayment = new FeePayment
      {
        Id = Guid.NewGuid(),
        OrganizationId = feePeriodSnapshot.OrganizationId,
        StudentId = request.StudentId,
        FeePeriodId = request.FeePeriodId,
        RecordedBy = request.UserId,
        Amount = request.Amount,
        Currency = normalizedCurrency,
        PaymentDate = request.PaymentDate,
        PaymentMethod = paymentMethod,
        Reference = NormalizeOptionalString(request.Reference),
        Notes = NormalizeOptionalString(request.Notes),
        CreatedAt = now,
        UpdatedAt = now
      };

      _dbContext.Add(feePayment);
      await _dbContext.SaveChangesAsync(cancellationToken);

      var totalPaid = await GetActivePaymentsSumForPeriodAsync(request.FeePeriodId, cancellationToken);

      var feePeriod = await GetFeePeriodEntityForUpdateAsync(
        feePeriodSnapshot.OrganizationId,
        request.StudentId,
        request.FeePeriodId,
        cancellationToken);

      var previousAmountPaid = feePeriod.AmountPaid;
      var previousStatus = feePeriod.Status;

      feePeriod.AmountPaid = totalPaid;
      feePeriod.Status = FeePeriodStatusCalculator.Derive(feePeriod.Fee, totalPaid);
      feePeriod.UpdatedAt = now;

      _auditLogService.Add(new AuditLog(Guid.NewGuid(), "fee_payment.recorded", "fee_payments", now)
      {
        OrganizationId = feePeriod.OrganizationId,
        ActorId = request.UserId,
        EntityId = feePayment.Id,
        NewValues = new Dictionary<string, object?>
        {
          ["student_id"] = feePayment.StudentId,
          ["fee_period_id"] = feePayment.FeePeriodId,
          ["amount"] = feePayment.Amount,
          ["currency"] = feePayment.Currency,
          ["payment_date"] = feePayment.PaymentDate,
          ["payment_method"] = feePayment.PaymentMethod.ToString(),
          ["reference"] = feePayment.Reference,
          ["notes"] = feePayment.Notes,
          ["period_amount_paid_before"] = previousAmountPaid,
          ["period_amount_paid_after"] = feePeriod.AmountPaid,
          ["period_status_before"] = previousStatus.ToString(),
          ["period_status_after"] = feePeriod.Status.ToString()
        }
      });

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      return ToFeePeriodDto(feePeriod);
    }
    catch
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  private async Task<FeePeriodSnapshot> GetFeePeriodSnapshotAsync(
    Guid studentId,
    Guid feePeriodId,
    CancellationToken cancellationToken)
  {
    IQueryable<FeePeriodSnapshot> feePeriodQuery = _dbContext.FeePeriods
      .Where(feePeriod => feePeriod.Id == feePeriodId && feePeriod.StudentId == studentId)
      .Select(feePeriod => new FeePeriodSnapshot
      {
        Id = feePeriod.Id,
        OrganizationId = feePeriod.OrganizationId,
        StudentId = feePeriod.StudentId
      });

    var feePeriodSnapshot = await _dbContext.FirstOrDefaultAsync(feePeriodQuery, cancellationToken);
    if (feePeriodSnapshot is null)
    {
      throw new NotFoundException("Fee period was not found for the provided student.");
    }

    return feePeriodSnapshot;
  }

  private async Task<FeePeriod> GetFeePeriodEntityForUpdateAsync(
    Guid organizationId,
    Guid studentId,
    Guid feePeriodId,
    CancellationToken cancellationToken)
  {
    IQueryable<FeePeriod> feePeriodQuery = _dbContext.FeePeriods
      .Where(feePeriod =>
        feePeriod.Id == feePeriodId
        && feePeriod.OrganizationId == organizationId
        && feePeriod.StudentId == studentId);

    var feePeriod = await _dbContext.FirstOrDefaultAsync(feePeriodQuery, cancellationToken);
    if (feePeriod is null)
    {
      throw new NotFoundException($"Fee period with id '{feePeriodId}' was not found.");
    }

    return feePeriod;
  }

  private async Task<long> GetActivePaymentsSumForPeriodAsync(Guid feePeriodId, CancellationToken cancellationToken)
  {
    IQueryable<long> totalPaidQuery = _dbContext.FeePayments
      .Where(payment => payment.FeePeriodId == feePeriodId && payment.DeletedAt == null)
      .GroupBy(_ => 1)
      .Select(group => group.Sum(payment => payment.Amount));

    return await _dbContext.FirstOrDefaultAsync(totalPaidQuery, cancellationToken);
  }

  private static FeePeriodDto ToFeePeriodDto(FeePeriod feePeriod)
  {
    return new FeePeriodDto
    {
      Id = feePeriod.Id,
      PeriodYear = feePeriod.PeriodYear,
      PeriodMonth = feePeriod.PeriodMonth,
      Fee = feePeriod.Fee,
      AmountPaid = feePeriod.AmountPaid,
      Currency = feePeriod.Currency,
      Status = feePeriod.Status.ToString(),
      DueDate = feePeriod.DueDate,
      CreatedAt = feePeriod.CreatedAt
    };
  }

  private static string? NormalizeOptionalString(string? value)
  {
    return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
  }

  private sealed class FeePeriodSnapshot
  {
    public Guid Id { get; init; }
    public Guid OrganizationId { get; init; }
    public Guid StudentId { get; init; }
  }
}

internal static class PaymentMethodParser
{
  public static bool TryParse(string? paymentMethodValue, out PaymentMethod paymentMethod)
  {
    paymentMethod = default;

    if (string.IsNullOrWhiteSpace(paymentMethodValue))
    {
      return false;
    }

    var normalizedValue = paymentMethodValue.Trim().Replace("_", string.Empty).Replace("-", string.Empty);
    return Enum.TryParse(normalizedValue, true, out paymentMethod);
  }
}

internal static class FeePeriodStatusCalculator
{
  public static FeePeriodStatus Derive(long fee, long amountPaid)
  {
    if (amountPaid <= 0)
    {
      return FeePeriodStatus.Unpaid;
    }

    if (amountPaid >= fee)
    {
      return FeePeriodStatus.Paid;
    }

    return FeePeriodStatus.Partial;
  }
}
