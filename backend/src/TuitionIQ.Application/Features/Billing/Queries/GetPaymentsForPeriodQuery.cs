using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Dtos;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Billing.Queries;

public sealed record GetPaymentsForPeriodQuery(
  Guid OrganizationId,
  Guid StudentId,
  Guid FeePeriodId,
  Guid UserId) : IRequest<IReadOnlyList<FeePaymentDto>>;

public sealed class GetPaymentsForPeriodQueryHandler : IRequestHandler<GetPaymentsForPeriodQuery, IReadOnlyList<FeePaymentDto>>
{
  private readonly IAppDbContext _dbContext;
  private readonly IOrganizationAuthorizationService _organizationAuthorizationService;

  public GetPaymentsForPeriodQueryHandler(
    IAppDbContext dbContext,
    IOrganizationAuthorizationService organizationAuthorizationService)
  {
    _dbContext = dbContext;
    _organizationAuthorizationService = organizationAuthorizationService;
  }

  public async Task<IReadOnlyList<FeePaymentDto>> Handle(
    GetPaymentsForPeriodQuery request,
    CancellationToken cancellationToken)
  {
    var callerRole = await _organizationAuthorizationService.RequireTeacherOrHigherAsync(
      request.OrganizationId,
      request.UserId,
      "You are not allowed to view payments for this period.",
      cancellationToken);

    if (callerRole == OrganizationMemberRole.Teacher)
    {
      await _organizationAuthorizationService.EnsureTeacherHasStudentAccessAsync(
        request.OrganizationId,
        request.UserId,
        request.StudentId,
        "You are not allowed to view payments for this period.",
        cancellationToken);
    }

    IQueryable<Guid> feePeriodExistsQuery = _dbContext.FeePeriods
      .Where(feePeriod =>
        feePeriod.Id == request.FeePeriodId
        && feePeriod.OrganizationId == request.OrganizationId
        && feePeriod.StudentId == request.StudentId)
      .Select(feePeriod => feePeriod.Id);

    var feePeriodId = await _dbContext.FirstOrDefaultAsync(feePeriodExistsQuery, cancellationToken);
    if (feePeriodId == Guid.Empty)
    {
      throw new NotFoundException($"Fee period with id '{request.FeePeriodId}' was not found.");
    }

    IQueryable<FeePaymentDto> paymentsQuery = _dbContext.FeePayments
      .Where(payment =>
        payment.OrganizationId == request.OrganizationId
        && payment.StudentId == request.StudentId
        && payment.FeePeriodId == request.FeePeriodId)
      .OrderByDescending(payment => payment.PaymentDate)
      .ThenByDescending(payment => payment.CreatedAt)
      .Select(payment => new FeePaymentDto
      {
        Id = payment.Id,
        Amount = payment.Amount,
        Currency = payment.Currency,
        PaymentDate = payment.PaymentDate,
        PaymentMethod = payment.PaymentMethod.ToString(),
        Reference = payment.Reference,
        CreatedAt = payment.CreatedAt
      });

    return await _dbContext.ToListAsync(paymentsQuery, cancellationToken);
  }
}
