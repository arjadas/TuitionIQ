using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Dtos;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Billing.Queries;

public sealed record GetFeePeriodsQuery(Guid OrganizationId, Guid StudentId, Guid UserId)
  : IRequest<IReadOnlyList<FeePeriodDto>>;

public sealed class GetFeePeriodsQueryHandler : IRequestHandler<GetFeePeriodsQuery, IReadOnlyList<FeePeriodDto>>
{
  private readonly IAppDbContext _dbContext;
  private readonly IOrganizationAuthorizationService _organizationAuthorizationService;

  public GetFeePeriodsQueryHandler(
    IAppDbContext dbContext,
    IOrganizationAuthorizationService organizationAuthorizationService)
  {
    _dbContext = dbContext;
    _organizationAuthorizationService = organizationAuthorizationService;
  }

  public async Task<IReadOnlyList<FeePeriodDto>> Handle(GetFeePeriodsQuery request, CancellationToken cancellationToken)
  {
    var callerRole = await _organizationAuthorizationService.RequireTeacherOrHigherAsync(
      request.OrganizationId,
      request.UserId,
      "You are not allowed to view fee periods for this student.",
      cancellationToken);

    if (callerRole == OrganizationMemberRole.Teacher)
    {
      await _organizationAuthorizationService.EnsureTeacherHasStudentAccessAsync(
        request.OrganizationId,
        request.UserId,
        request.StudentId,
        "You are not allowed to view fee periods for this student.",
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

    IQueryable<FeePeriodDto> feePeriodsQuery = _dbContext.FeePeriods
      .Where(feePeriod =>
        feePeriod.OrganizationId == request.OrganizationId
        && feePeriod.StudentId == request.StudentId)
      .OrderByDescending(feePeriod => feePeriod.PeriodYear)
      .ThenByDescending(feePeriod => feePeriod.PeriodMonth)
      .Select(feePeriod => new FeePeriodDto
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
      });

    return await _dbContext.ToListAsync(feePeriodsQuery, cancellationToken);
  }
}
