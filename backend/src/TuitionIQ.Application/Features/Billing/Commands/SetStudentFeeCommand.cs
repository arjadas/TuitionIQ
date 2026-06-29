using FluentValidation;
using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Dtos;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Billing.Commands;

public sealed record SetStudentFeeCommand(
  Guid OrganizationId,
  Guid StudentId,
  Guid UserId,
  string FeeSource,
  long? ManualFee,
  string Currency,
  DateOnly EffectiveFrom,
  string? Notes,
  string? OverrideReason) : IRequest<StudentFeeConfigDto>;

public sealed class SetStudentFeeCommandValidator : AbstractValidator<SetStudentFeeCommand>
{
  public SetStudentFeeCommandValidator()
  {
    RuleFor(command => command.FeeSource)
      .NotEmpty()
      .Must(BeValidFeeSource)
      .WithMessage("FeeSource must be one of: Manual, ClassCalculated, Override.");

    RuleFor(command => command.ManualFee)
      .Cascade(CascadeMode.Stop)
      .NotNull()
      .WithMessage("ManualFee is required when FeeSource is Manual or Override.")
      .GreaterThanOrEqualTo(0)
      .WithMessage("ManualFee must be greater than or equal to 0.")
      .When(command => RequiresManualFee(command.FeeSource));

    RuleFor(command => command.ManualFee)
      .GreaterThanOrEqualTo(0)
      .WithMessage("ManualFee must be greater than or equal to 0.")
      .When(command => command.ManualFee.HasValue);

    RuleFor(command => command.Currency)
      .Cascade(CascadeMode.Stop)
      .NotEmpty()
      .Must(currency => currency is not null && currency.Trim().Length == 3)
      .WithMessage("Currency must be 3 characters.");

    RuleFor(command => command.EffectiveFrom)
      .Must(effectiveFrom => effectiveFrom != default)
      .WithMessage("EffectiveFrom is required.");
  }

  private static bool BeValidFeeSource(string feeSource)
  {
    return FeeSourceParser.TryParse(feeSource, out _);
  }

  private static bool RequiresManualFee(string feeSource)
  {
    return FeeSourceParser.TryParse(feeSource, out var parsedFeeSource)
      && parsedFeeSource is Domain.Enums.FeeSource.Manual or Domain.Enums.FeeSource.Override;
  }
}

public sealed class SetStudentFeeCommandHandler : IRequestHandler<SetStudentFeeCommand, StudentFeeConfigDto>
{
  private readonly IAppDbContext _dbContext;
  private readonly IAuditLogService _auditLogService;
  private readonly IOrganizationAuthorizationService _organizationAuthorizationService;

  public SetStudentFeeCommandHandler(
    IAppDbContext dbContext,
    IAuditLogService auditLogService,
    IOrganizationAuthorizationService organizationAuthorizationService)
  {
    _dbContext = dbContext;
    _auditLogService = auditLogService;
    _organizationAuthorizationService = organizationAuthorizationService;
  }

  public async Task<StudentFeeConfigDto> Handle(SetStudentFeeCommand request, CancellationToken cancellationToken)
  {
    if (!FeeSourceParser.TryParse(request.FeeSource, out var feeSource))
    {
      throw new ValidationException("FeeSource must be one of: Manual, ClassCalculated, Override.");
    }

    if (feeSource is Domain.Enums.FeeSource.Manual or Domain.Enums.FeeSource.Override && request.ManualFee is null)
    {
      throw new ValidationException("ManualFee is required when FeeSource is Manual or Override.");
    }

    var callerRole = await _organizationAuthorizationService.RequireTeacherOrHigherAsync(
      request.OrganizationId,
      request.UserId,
      "You are not allowed to set fees for this student.",
      cancellationToken);

    if (callerRole == OrganizationMemberRole.Teacher)
    {
      await _organizationAuthorizationService.EnsureTeacherHasStudentAccessAsync(
        request.OrganizationId,
        request.UserId,
        request.StudentId,
        "You are not allowed to set fees for this student.",
        cancellationToken);
    }

    IQueryable<Guid> studentExistsQuery = _dbContext.Students
      .Where(student => student.OrganizationId == request.OrganizationId && student.Id == request.StudentId)
      .Select(student => student.Id);

    var studentId = await _dbContext.FirstOrDefaultAsync(studentExistsQuery, cancellationToken);
    if (studentId == Guid.Empty)
    {
      throw new NotFoundException($"Student with id '{request.StudentId}' was not found.");
    }

    await using var transaction = await _dbContext.BeginTransactionAsync(cancellationToken);
    try
    {
      var now = DateTimeOffset.UtcNow;
      var today = DateOnly.FromDateTime(now.UtcDateTime);
      var normalizedCurrency = request.Currency.Trim().ToUpperInvariant();
      var normalizedNotes = NormalizeOptionalString(request.Notes);
      var normalizedOverrideReason = NormalizeOptionalString(request.OverrideReason);

      IQueryable<ActiveStudentFeeProjection> activeFeeProjectionQuery = _dbContext.StudentFees
        .Where(studentFee =>
          studentFee.OrganizationId == request.OrganizationId
          && studentFee.StudentId == request.StudentId
          && studentFee.IsActive
          && studentFee.DeletedAt == null)
        .Select(studentFee => new ActiveStudentFeeProjection
        {
          Id = studentFee.Id,
          IsActive = studentFee.IsActive
        });

      var activeFeeProjection = await _dbContext.FirstOrDefaultAsync(activeFeeProjectionQuery, cancellationToken);

      Dictionary<string, object?>? oldValues = null;
      if (activeFeeProjection is not null)
      {
        IQueryable<StudentFee> activeFeeQuery = _dbContext.StudentFees
          .Where(studentFee =>
            studentFee.Id == activeFeeProjection.Id
            && studentFee.OrganizationId == request.OrganizationId
            && studentFee.StudentId == request.StudentId
            && studentFee.IsActive
            && studentFee.DeletedAt == null);

        var activeFee = await _dbContext.FirstOrDefaultAsync(activeFeeQuery, cancellationToken);
        if (activeFee is not null)
        {
          oldValues = ToAuditValues(activeFee);
          activeFee.IsActive = false;
          activeFee.EffectiveTo = today;
          activeFee.UpdatedAt = now;
        }
      }

      var manualFee = feeSource is Domain.Enums.FeeSource.Manual or Domain.Enums.FeeSource.Override
        ? request.ManualFee
        : null;

      var newStudentFee = new StudentFee
      {
        Id = Guid.NewGuid(),
        OrganizationId = request.OrganizationId,
        StudentId = request.StudentId,
        SetBy = request.UserId,
        FeeSource = feeSource,
        ManualFee = manualFee,
        OverrideReason = normalizedOverrideReason,
        Currency = normalizedCurrency,
        EffectiveFrom = request.EffectiveFrom,
        EffectiveTo = null,
        IsActive = true,
        Notes = normalizedNotes,
        CreatedAt = now,
        UpdatedAt = now
      };

      _dbContext.Add(newStudentFee);

      _auditLogService.Add(new AuditLog(Guid.NewGuid(), "student_fee.set", "student_fees", now)
      {
        OrganizationId = request.OrganizationId,
        ActorId = request.UserId,
        EntityId = newStudentFee.Id,
        OldValues = oldValues,
        NewValues = ToAuditValues(newStudentFee)
      });

      // Eagerly materialise one billing period per calendar month from the fee's
      // effective (enrolment) month through the current month, so payments can be
      // recorded against real periods. Months that already have a (non-deleted)
      // period are skipped — a period's fee is immutable once created.
      var generatedPeriods = await GenerateMissingMonthlyPeriodsAsync(
        request,
        newStudentFee,
        manualFee,
        normalizedCurrency,
        today,
        now,
        cancellationToken);

      if (generatedPeriods.Count > 0)
      {
        var firstPeriod = generatedPeriods[0];
        var lastPeriod = generatedPeriods[^1];

        _auditLogService.Add(new AuditLog(Guid.NewGuid(), "fee_periods.generated", "fee_periods", now)
        {
          OrganizationId = request.OrganizationId,
          ActorId = request.UserId,
          EntityId = newStudentFee.Id,
          NewValues = new Dictionary<string, object?>
          {
            ["student_id"] = request.StudentId,
            ["student_fee_id"] = newStudentFee.Id,
            ["generated_count"] = generatedPeriods.Count,
            ["from_period"] = $"{firstPeriod.PeriodYear:0000}-{firstPeriod.PeriodMonth:00}",
            ["to_period"] = $"{lastPeriod.PeriodYear:0000}-{lastPeriod.PeriodMonth:00}"
          }
        });
      }

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      return ToStudentFeeConfigDto(newStudentFee);
    }
    catch
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  private async Task<List<FeePeriod>> GenerateMissingMonthlyPeriodsAsync(
    SetStudentFeeCommand request,
    StudentFee studentFee,
    long? resolvedFee,
    string normalizedCurrency,
    DateOnly today,
    DateTimeOffset now,
    CancellationToken cancellationToken)
  {
    var generated = new List<FeePeriod>();

    // A concrete monthly amount is required to snapshot a period's fee. ClassCalculated
    // configs have no flat amount here, so their periods are produced elsewhere.
    if (resolvedFee is not long monthlyFee)
    {
      return generated;
    }

    // Nothing to generate if the fee becomes effective in a future month.
    var startMonth = new DateOnly(request.EffectiveFrom.Year, request.EffectiveFrom.Month, 1);
    var currentMonth = new DateOnly(today.Year, today.Month, 1);
    if (startMonth > currentMonth)
    {
      return generated;
    }

    var existingPeriodKeys = await GetExistingPeriodKeysAsync(
      request.OrganizationId,
      request.StudentId,
      cancellationToken);

    for (var cursor = startMonth; cursor <= currentMonth; cursor = cursor.AddMonths(1))
    {
      var periodKey = (cursor.Year * 100) + cursor.Month;
      if (existingPeriodKeys.Contains(periodKey))
      {
        continue;
      }

      var daysInMonth = DateTime.DaysInMonth(cursor.Year, cursor.Month);

      var period = new FeePeriod
      {
        Id = Guid.NewGuid(),
        OrganizationId = request.OrganizationId,
        StudentId = request.StudentId,
        StudentFeeId = studentFee.Id,
        PeriodYear = (short)cursor.Year,
        PeriodMonth = (short)cursor.Month,
        Fee = monthlyFee,
        AmountPaid = 0,
        Currency = normalizedCurrency,
        Status = FeePeriodStatus.Unpaid,
        DueDate = new DateOnly(cursor.Year, cursor.Month, daysInMonth),
        CreatedAt = now,
        UpdatedAt = now
      };

      _dbContext.Add(period);
      generated.Add(period);
    }

    return generated;
  }

  private async Task<HashSet<int>> GetExistingPeriodKeysAsync(
    Guid organizationId,
    Guid studentId,
    CancellationToken cancellationToken)
  {
    IQueryable<int> periodKeysQuery = _dbContext.FeePeriods
      .Where(feePeriod =>
        feePeriod.OrganizationId == organizationId
        && feePeriod.StudentId == studentId
        && feePeriod.DeletedAt == null)
      .Select(feePeriod => (feePeriod.PeriodYear * 100) + feePeriod.PeriodMonth);

    var periodKeys = await _dbContext.ToListAsync(periodKeysQuery, cancellationToken);
    return periodKeys.ToHashSet();
  }

  private static StudentFeeConfigDto ToStudentFeeConfigDto(StudentFee studentFee)
  {
    return new StudentFeeConfigDto
    {
      Id = studentFee.Id,
      OrganizationId = studentFee.OrganizationId,
      StudentId = studentFee.StudentId,
      SetBy = studentFee.SetBy,
      FeeSource = studentFee.FeeSource.ToString(),
      ManualFee = studentFee.ManualFee,
      OverrideReason = studentFee.OverrideReason,
      Currency = studentFee.Currency,
      EffectiveFrom = studentFee.EffectiveFrom,
      EffectiveTo = studentFee.EffectiveTo,
      IsActive = studentFee.IsActive,
      Notes = studentFee.Notes,
      CreatedAt = studentFee.CreatedAt,
      UpdatedAt = studentFee.UpdatedAt,
      DeletedAt = studentFee.DeletedAt
    };
  }

  private static Dictionary<string, object?> ToAuditValues(StudentFee studentFee)
  {
    return new Dictionary<string, object?>
    {
      ["id"] = studentFee.Id,
      ["organization_id"] = studentFee.OrganizationId,
      ["student_id"] = studentFee.StudentId,
      ["set_by"] = studentFee.SetBy,
      ["fee_source"] = studentFee.FeeSource.ToString(),
      ["manual_fee"] = studentFee.ManualFee,
      ["override_reason"] = studentFee.OverrideReason,
      ["currency"] = studentFee.Currency,
      ["effective_from"] = studentFee.EffectiveFrom,
      ["effective_to"] = studentFee.EffectiveTo,
      ["is_active"] = studentFee.IsActive,
      ["notes"] = studentFee.Notes,
      ["created_at"] = studentFee.CreatedAt,
      ["updated_at"] = studentFee.UpdatedAt,
      ["deleted_at"] = studentFee.DeletedAt
    };
  }

  private static string? NormalizeOptionalString(string? value)
  {
    return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
  }

  private sealed class ActiveStudentFeeProjection
  {
    public Guid Id { get; init; }
    public bool IsActive { get; init; }
  }
}

internal static class FeeSourceParser
{
  public static bool TryParse(string? feeSourceValue, out Domain.Enums.FeeSource feeSource)
  {
    feeSource = default;

    if (string.IsNullOrWhiteSpace(feeSourceValue))
    {
      return false;
    }

    var normalizedValue = feeSourceValue.Trim().Replace("_", string.Empty).Replace("-", string.Empty);
    return Enum.TryParse(normalizedValue, true, out feeSource);
  }
}
