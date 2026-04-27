using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Dtos;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Billing.Commands;

public sealed record WaivePeriodCommand(
  Guid OrganizationId,
  Guid StudentId,
  Guid FeePeriodId,
  Guid UserId,
  string? WaiverReason) : IRequest<FeePeriodDto>;

public sealed class WaivePeriodCommandHandler : IRequestHandler<WaivePeriodCommand, FeePeriodDto>
{
  private readonly IAppDbContext _dbContext;
  private readonly IAuditLogService _auditLogService;
  private readonly IOrganizationAuthorizationService _organizationAuthorizationService;

  public WaivePeriodCommandHandler(
    IAppDbContext dbContext,
    IAuditLogService auditLogService,
    IOrganizationAuthorizationService organizationAuthorizationService)
  {
    _dbContext = dbContext;
    _auditLogService = auditLogService;
    _organizationAuthorizationService = organizationAuthorizationService;
  }

  public async Task<FeePeriodDto> Handle(WaivePeriodCommand request, CancellationToken cancellationToken)
  {
    var callerRole = await _organizationAuthorizationService.RequireTeacherOrHigherAsync(
      request.OrganizationId,
      request.UserId,
      "You are not allowed to waive this fee period.",
      cancellationToken);

    if (callerRole == OrganizationMemberRole.Teacher)
    {
      await _organizationAuthorizationService.EnsureTeacherHasStudentAccessAsync(
        request.OrganizationId,
        request.UserId,
        request.StudentId,
        "You are not allowed to waive this fee period.",
        cancellationToken);
    }

    IQueryable<Guid> feePeriodIdQuery = _dbContext.FeePeriods
      .Where(feePeriod =>
        feePeriod.Id == request.FeePeriodId
        && feePeriod.OrganizationId == request.OrganizationId
        && feePeriod.StudentId == request.StudentId)
      .Select(feePeriod => feePeriod.Id);

    var existingFeePeriodId = await _dbContext.FirstOrDefaultAsync(feePeriodIdQuery, cancellationToken);
    if (existingFeePeriodId == Guid.Empty)
    {
      throw new NotFoundException($"Fee period with id '{request.FeePeriodId}' was not found.");
    }

    await using var transaction = await _dbContext.BeginTransactionAsync(cancellationToken);
    try
    {
      IQueryable<FeePeriod> feePeriodQuery = _dbContext.FeePeriods
        .Where(feePeriod =>
          feePeriod.Id == request.FeePeriodId
          && feePeriod.OrganizationId == request.OrganizationId
          && feePeriod.StudentId == request.StudentId);

      var feePeriod = await _dbContext.FirstOrDefaultAsync(feePeriodQuery, cancellationToken);
      if (feePeriod is null)
      {
        throw new NotFoundException($"Fee period with id '{request.FeePeriodId}' was not found.");
      }

      var now = DateTimeOffset.UtcNow;
      var previousStatus = feePeriod.Status;
      var previousWaivedBy = feePeriod.WaivedBy;
      var previousWaivedAt = feePeriod.WaivedAt;
      var previousWaiverReason = feePeriod.WaiverReason;

      feePeriod.Status = FeePeriodStatus.Waived;
      feePeriod.WaivedBy = request.UserId;
      feePeriod.WaivedAt = now;
      feePeriod.WaiverReason = NormalizeOptionalString(request.WaiverReason);
      feePeriod.UpdatedAt = now;

      _auditLogService.Add(new AuditLog(Guid.NewGuid(), "fee_period.waived", "fee_periods", now)
      {
        OrganizationId = request.OrganizationId,
        ActorId = request.UserId,
        EntityId = feePeriod.Id,
        OldValues = new Dictionary<string, object?>
        {
          ["status"] = previousStatus.ToString(),
          ["waived_by"] = previousWaivedBy,
          ["waived_at"] = previousWaivedAt,
          ["waiver_reason"] = previousWaiverReason
        },
        NewValues = new Dictionary<string, object?>
        {
          ["status"] = feePeriod.Status.ToString(),
          ["waived_by"] = feePeriod.WaivedBy,
          ["waived_at"] = feePeriod.WaivedAt,
          ["waiver_reason"] = feePeriod.WaiverReason
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

  private static string? NormalizeOptionalString(string? value)
  {
    return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
  }
}
