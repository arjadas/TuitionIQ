using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Admin.Commands;

namespace TuitionIQ.Api.Features.Admin;

[ApiController]
[Authorize]
[Route("api/admin/users")]
public sealed class AdminController : ControllerBase
{
  private readonly IMediator _mediator;
  private readonly ICurrentUserService _currentUserService;

  public AdminController(IMediator mediator, ICurrentUserService currentUserService)
  {
    _mediator = mediator;
    _currentUserService = currentUserService;
  }

  [HttpPost("{id:guid}/revoke-sessions")]
  public async Task<IActionResult> RevokeSessions(Guid id, CancellationToken cancellationToken)
  {
    await _mediator.Send(new RevokeUserSessionsCommand(_currentUserService.GetUserId(), id), cancellationToken);
    return Ok();
  }

  [HttpPost("{id:guid}/suspend")]
  public async Task<IActionResult> SuspendUser(Guid id, CancellationToken cancellationToken)
  {
    await _mediator.Send(new SuspendUserCommand(_currentUserService.GetUserId(), id), cancellationToken);
    return Ok();
  }
}
