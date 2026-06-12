using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Dtos;
using TuitionIQ.Application.Features.Billing.Queries;

namespace TuitionIQ.Api.Features.Billing;

// Org-wide billing view. Distinct from the student-nested PeriodsController:
// this lists/loads periods across every student for the org billing dashboard.
[ApiController]
[Authorize]
[Route("api/organizations/{orgId:guid}/periods")]
public sealed class OrgPeriodsController : ControllerBase
{
  private readonly IMediator _mediator;
  private readonly ICurrentUserService _currentUserService;

  public OrgPeriodsController(IMediator mediator, ICurrentUserService currentUserService)
  {
    _mediator = mediator;
    _currentUserService = currentUserService;
  }

  [HttpGet]
  public async Task<ActionResult<IReadOnlyList<OrgFeePeriodDto>>> GetOrgFeePeriods(
    Guid orgId,
    [FromQuery] int? year,
    [FromQuery] int? month,
    [FromQuery] string? status,
    CancellationToken cancellationToken = default)
  {
    var result = await _mediator.Send(
      new GetOrgFeePeriodsQuery(orgId, year, month, status, _currentUserService.UserId),
      cancellationToken);

    return Ok(result);
  }

  [HttpGet("{periodId:guid}")]
  public async Task<ActionResult<OrgFeePeriodDto>> GetOrgFeePeriodById(
    Guid orgId,
    Guid periodId,
    CancellationToken cancellationToken = default)
  {
    var result = await _mediator.Send(
      new GetOrgFeePeriodByIdQuery(orgId, periodId, _currentUserService.UserId),
      cancellationToken);

    return Ok(result);
  }
}
