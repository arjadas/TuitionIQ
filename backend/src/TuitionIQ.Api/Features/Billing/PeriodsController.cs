using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Commands;
using TuitionIQ.Application.Features.Billing.Dtos;
using TuitionIQ.Application.Features.Billing.Queries;

namespace TuitionIQ.Api.Features.Billing;

[ApiController]
[Authorize]
[Route("api/organizations/{orgId:guid}/students/{studentId:guid}/periods")]
public sealed class PeriodsController : ControllerBase
{
  private readonly IMediator _mediator;
  private readonly ICurrentUserService _currentUserService;

  public PeriodsController(IMediator mediator, ICurrentUserService currentUserService)
  {
    _mediator = mediator;
    _currentUserService = currentUserService;
  }

  [HttpGet]
  public async Task<ActionResult<IReadOnlyList<FeePeriodDto>>> GetFeePeriods(
    Guid orgId,
    Guid studentId,
    CancellationToken cancellationToken = default)
  {
    var result = await _mediator.Send(
      new GetFeePeriodsQuery(orgId, studentId, _currentUserService.UserId),
      cancellationToken);

    return Ok(result);
  }

  [HttpGet("{periodId:guid}/payments")]
  public async Task<ActionResult<IReadOnlyList<FeePaymentDto>>> GetPaymentsForPeriod(
    Guid orgId,
    Guid studentId,
    Guid periodId,
    CancellationToken cancellationToken = default)
  {
    var result = await _mediator.Send(
      new GetPaymentsForPeriodQuery(orgId, studentId, periodId, _currentUserService.UserId),
      cancellationToken);

    return Ok(result);
  }

  [HttpPatch("{periodId:guid}/waive")]
  public async Task<ActionResult<FeePeriodDto>> WaivePeriod(
    Guid orgId,
    Guid studentId,
    Guid periodId,
    [FromBody] WaivePeriodRequest request,
    CancellationToken cancellationToken = default)
  {
    var result = await _mediator.Send(
      new WaivePeriodCommand(orgId, studentId, periodId, _currentUserService.UserId, request.WaiverReason),
      cancellationToken);

    return Ok(result);
  }
}
