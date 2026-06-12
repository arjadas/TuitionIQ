using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Dtos;

namespace TuitionIQ.Application.Features.Billing.Queries;

// Org-wide single fee period (resolves the student context for the billing period-detail screen).
// Owner/admin only, consistent with GetOrgFeePeriodsQuery.
public sealed record GetOrgFeePeriodByIdQuery(Guid OrganizationId, Guid FeePeriodId, Guid UserId)
  : IRequest<OrgFeePeriodDto>;

public sealed class GetOrgFeePeriodByIdQueryHandler
  : IRequestHandler<GetOrgFeePeriodByIdQuery, OrgFeePeriodDto>
{
  private readonly IAppDbContext _dbContext;
  private readonly IOrganizationAuthorizationService _organizationAuthorizationService;

  public GetOrgFeePeriodByIdQueryHandler(
    IAppDbContext dbContext,
    IOrganizationAuthorizationService organizationAuthorizationService)
  {
    _dbContext = dbContext;
    _organizationAuthorizationService = organizationAuthorizationService;
  }

  public async Task<OrgFeePeriodDto> Handle(
    GetOrgFeePeriodByIdQuery request,
    CancellationToken cancellationToken)
  {
    await _organizationAuthorizationService.RequireOwnerOrAdminAsync(
      request.OrganizationId,
      request.UserId,
      "You are not allowed to view billing for this organization.",
      cancellationToken);

    IQueryable<OrgFeePeriodDto> query =
      from feePeriod in _dbContext.FeePeriods
      where feePeriod.Id == request.FeePeriodId
        && feePeriod.OrganizationId == request.OrganizationId
      join student in _dbContext.Students on feePeriod.StudentId equals student.Id
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

    var feePeriodDto = await _dbContext.FirstOrDefaultAsync(query, cancellationToken);
    if (feePeriodDto is null)
    {
      throw new NotFoundException($"Fee period with id '{request.FeePeriodId}' was not found.");
    }

    return feePeriodDto;
  }
}
