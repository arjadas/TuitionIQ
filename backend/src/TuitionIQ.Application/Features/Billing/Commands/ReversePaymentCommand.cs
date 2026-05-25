using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Dtos;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Billing.Commands;

public sealed record ReversePaymentCommand(Guid UserId, Guid PaymentId) : IRequest<FeePeriodDto>;

public sealed class ReversePaymentCommandHandler : IRequestHandler<ReversePaymentCommand, FeePeriodDto>
{
  private readonly IAppDbContext _dbContext;
  private readonly IAuditLogService _auditLogService;
  private readonly IOrganizationAuthorizationService _organizationAuthorizationService;

  public ReversePaymentCommandHandler(
    IAppDbContext dbContext,
    IAuditLogService auditLogService,
    IOrganizationAuthorizationService organizationAuthorizationService)
  {
    _dbContext = dbContext;
    _auditLogService = auditLogService;
    _organizationAuthorizationService = organizationAuthorizationService;
  }

  public async Task<FeePeriodDto> Handle(ReversePaymentCommand request, CancellationToken cancellationToken)
  {
    var paymentSnapshot = await GetPaymentSnapshotAsync(request.PaymentId, cancellationToken);

    var callerRole = await _organizationAuthorizationService.RequireTeacherOrHigherAsync(
      paymentSnapshot.OrganizationId,
      request.UserId,
      "You are not allowed to reverse payments for this student.",
      cancellationToken);

    if (callerRole == OrganizationMemberRole.Teacher)
    {
      await _organizationAuthorizationService.EnsureTeacherHasStudentAccessAsync(
        paymentSnapshot.OrganizationId,
        request.UserId,
        paymentSnapshot.StudentId,
        "You are not allowed to reverse payments for this student.",
        cancellationToken);
    }

    await using var transaction = await _dbContext.BeginTransactionAsync(cancellationToken);
    try
    {
      var now = DateTimeOffset.UtcNow;

      IQueryable<FeePayment> paymentQuery = _dbContext.FeePayments
        .Where(payment => payment.Id == request.PaymentId);

      var payment = await _dbContext.FirstOrDefaultAsync(paymentQuery, cancellationToken);
      if (payment is null)
      {
        throw new NotFoundException($"Payment with id '{request.PaymentId}' was not found.");
      }

      payment.DeletedAt = now;
      payment.UpdatedAt = now;

      await _dbContext.SaveChangesAsync(cancellationToken);

      var totalPaid = await GetActivePaymentsSumForPeriodAsync(payment.FeePeriodId, cancellationToken);

      IQueryable<FeePeriod> feePeriodQuery = _dbContext.FeePeriods
        .Where(feePeriod =>
          feePeriod.Id == payment.FeePeriodId
          && feePeriod.OrganizationId == payment.OrganizationId
          && feePeriod.StudentId == payment.StudentId);

      var feePeriod = await _dbContext.FirstOrDefaultAsync(feePeriodQuery, cancellationToken);
      if (feePeriod is null)
      {
        throw new NotFoundException($"Fee period with id '{payment.FeePeriodId}' was not found.");
      }

      var previousAmountPaid = feePeriod.AmountPaid;
      var previousStatus = feePeriod.Status;

      feePeriod.AmountPaid = totalPaid;
      feePeriod.Status = FeePeriodStatusCalculator.DeriveForCurrentStatus(
        feePeriod.Status,
        feePeriod.Fee,
        totalPaid);
      feePeriod.UpdatedAt = now;

      _auditLogService.Add(new AuditLog(Guid.NewGuid(), "fee_payment.reversed", "fee_payments", now)
      {
        OrganizationId = payment.OrganizationId,
        ActorId = request.UserId,
        EntityId = payment.Id,
        OldValues = new Dictionary<string, object?>
        {
          ["deleted_at"] = null,
          ["period_amount_paid"] = previousAmountPaid,
          ["period_status"] = previousStatus.ToString()
        },
        NewValues = new Dictionary<string, object?>
        {
          ["deleted_at"] = payment.DeletedAt,
          ["period_amount_paid"] = feePeriod.AmountPaid,
          ["period_status"] = feePeriod.Status.ToString()
        }
      });

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

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
    catch
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  private async Task<PaymentSnapshot> GetPaymentSnapshotAsync(Guid paymentId, CancellationToken cancellationToken)
  {
    IQueryable<PaymentSnapshot> paymentQuery = _dbContext.FeePayments
      .Where(payment => payment.Id == paymentId)
      .Select(payment => new PaymentSnapshot
      {
        Id = payment.Id,
        OrganizationId = payment.OrganizationId,
        StudentId = payment.StudentId,
        FeePeriodId = payment.FeePeriodId
      });

    var paymentSnapshot = await _dbContext.FirstOrDefaultAsync(paymentQuery, cancellationToken);
    if (paymentSnapshot is null)
    {
      throw new NotFoundException($"Payment with id '{paymentId}' was not found.");
    }

    return paymentSnapshot;
  }

  private async Task<long> GetActivePaymentsSumForPeriodAsync(Guid feePeriodId, CancellationToken cancellationToken)
  {
    IQueryable<long> totalPaidQuery = _dbContext.FeePayments
      .Where(payment => payment.FeePeriodId == feePeriodId && payment.DeletedAt == null)
      .GroupBy(_ => 1)
      .Select(group => group.Sum(payment => payment.Amount));

    return await _dbContext.FirstOrDefaultAsync(totalPaidQuery, cancellationToken);
  }

  private sealed class PaymentSnapshot
  {
    public Guid Id { get; init; }
    public Guid OrganizationId { get; init; }
    public Guid StudentId { get; init; }
    public Guid FeePeriodId { get; init; }
  }
}
