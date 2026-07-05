using MediatR;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Dtos;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Billing.Queries;

// Org-wide billing list. Owner/admin only — this is a financial overview across every student,
// so it is intentionally not exposed to teachers (who use the per-student billing views).
public sealed record GetOrgFeePeriodsQuery(
  Guid OrganizationId,
  int? Year,
  int? Month,
  string? Status,
  Guid UserId) : IRequest<IReadOnlyList<OrgFeePeriodDto>>;

public sealed class GetOrgFeePeriodsQueryHandler
  : IRequestHandler<GetOrgFeePeriodsQuery, IReadOnlyList<OrgFeePeriodDto>>
{
  private readonly IAppDbContext _dbContext;
  private readonly IOrganizationAuthorizationService _organizationAuthorizationService;

  public GetOrgFeePeriodsQueryHandler(
    IAppDbContext dbContext,
    IOrganizationAuthorizationService organizationAuthorizationService)
  {
    _dbContext = dbContext;
    _organizationAuthorizationService = organizationAuthorizationService;
  }

  public async Task<IReadOnlyList<OrgFeePeriodDto>> Handle(
    GetOrgFeePeriodsQuery request,
    CancellationToken cancellationToken)
  {
    await _organizationAuthorizationService.RequireOwnerOrAdminAsync(
      request.OrganizationId,
      request.UserId,
      "You are not allowed to view billing for this organization.",
      cancellationToken);

    FeePeriodStatus? statusFilter = null;
    if (!string.IsNullOrWhiteSpace(request.Status)
        && Enum.TryParse<FeePeriodStatus>(request.Status.Trim(), ignoreCase: true, out var parsedStatus))
    {
      statusFilter = parsedStatus;
    }

    // FeePeriods and Students both carry global soft-delete query filters, so deleted rows are excluded.
    IQueryable<OrgFeePeriodDto> query =
      from feePeriod in _dbContext.FeePeriods
      where feePeriod.OrganizationId == request.OrganizationId
        && (request.Year == null || feePeriod.PeriodYear == request.Year.Value)
        && (request.Month == null || feePeriod.PeriodMonth == request.Month.Value)
        && (statusFilter == null || feePeriod.Status == statusFilter.Value)
      join student in _dbContext.Students on feePeriod.StudentId equals student.Id
      orderby feePeriod.PeriodYear descending,
        feePeriod.PeriodMonth descending,
        student.FirstName,
        student.LastName
      select new OrgFeePeriodDto
      {
        Id = feePeriod.Id,
        StudentId = feePeriod.StudentId,
        StudentName = student.FirstName + " " + student.LastName,
        PeriodYear = feePeriod.PeriodYear,
        PeriodMonth = feePeriod.PeriodMonth,
        Fee = feePeriod.Fee,
        AmountPaid = feePeriod.AmountPaid,
        Currency = feePeriod.Currency,
        Status = feePeriod.Status.ToString(),
        DueDate = feePeriod.DueDate,
        CreatedAt = feePeriod.CreatedAt
      };

    return await _dbContext.ToListAsync(query, cancellationToken);
  }
}
