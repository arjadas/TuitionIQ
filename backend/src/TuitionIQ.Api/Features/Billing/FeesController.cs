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
[Route("api/organizations/{orgId:guid}/students/{studentId:guid}/fees")]
public sealed class FeesController : ControllerBase
{
  private readonly IMediator _mediator;
  private readonly ICurrentUserService _currentUserService;

  public FeesController(IMediator mediator, ICurrentUserService currentUserService)
  {
    _mediator = mediator;
    _currentUserService = currentUserService;
  }

  [HttpPost]
  public async Task<ActionResult<StudentFeeConfigDto>> SetStudentFee(
    Guid orgId,
    Guid studentId,
    [FromBody] SetFeeRequest request,
    CancellationToken cancellationToken = default)
  {
    var result = await _mediator.Send(
      new SetStudentFeeCommand(
        orgId,
        studentId,
        _currentUserService.UserId,
        request.FeeSource,
        request.ManualFee,
        request.Currency,
        request.EffectiveFrom,
        request.Notes,
        request.OverrideReason),
      cancellationToken);

    return Ok(result);
  }

  [HttpGet]
  public async Task<ActionResult<IReadOnlyList<StudentFeeConfigDto>>> GetStudentFeeHistory(
    Guid orgId,
    Guid studentId,
    CancellationToken cancellationToken = default)
  {
    var result = await _mediator.Send(
      new GetStudentFeeHistoryQuery(orgId, studentId, _currentUserService.UserId),
      cancellationToken);

    return Ok(result);
  }
}
