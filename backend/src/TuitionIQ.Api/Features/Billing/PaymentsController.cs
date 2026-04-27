using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Commands;
using TuitionIQ.Application.Features.Billing.Dtos;

namespace TuitionIQ.Api.Features.Billing;

[ApiController]
[Authorize]
[Route("api/payments")]
public sealed class PaymentsController : ControllerBase
{
  private readonly IMediator _mediator;
  private readonly ICurrentUserService _currentUserService;

  public PaymentsController(IMediator mediator, ICurrentUserService currentUserService)
  {
    _mediator = mediator;
    _currentUserService = currentUserService;
  }

  [HttpPost]
  public async Task<ActionResult<FeePeriodDto>> RecordPayment(
    [FromBody] RecordPaymentRequest request,
    CancellationToken cancellationToken = default)
  {
    var result = await _mediator.Send(
      new RecordPaymentCommand(
        _currentUserService.UserId,
        request.StudentId,
        request.FeePeriodId,
        request.Amount,
        request.Currency,
        request.PaymentDate,
        request.PaymentMethod,
        request.Reference,
        request.Notes),
      cancellationToken);

    return Ok(result);
  }

  [HttpDelete("{id:guid}")]
  public async Task<ActionResult<FeePeriodDto>> ReversePayment(
    Guid id,
    CancellationToken cancellationToken = default)
  {
    var result = await _mediator.Send(
      new ReversePaymentCommand(_currentUserService.UserId, id),
      cancellationToken);

    return Ok(result);
  }
}
