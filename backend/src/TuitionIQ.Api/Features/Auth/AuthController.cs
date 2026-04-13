using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Auth.Commands;
using TuitionIQ.Application.Features.Auth.Dtos;
using TuitionIQ.Application.Features.Auth.Queries;

namespace TuitionIQ.Api.Features.Auth;

[ApiController]
[Authorize]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
  private readonly IMediator _mediator;
  private readonly ICurrentUserService _currentUserService;

  public AuthController(IMediator mediator, ICurrentUserService currentUserService)
  {
    _mediator = mediator;
    _currentUserService = currentUserService;
  }

  [HttpPost("logout-all")]
  public async Task<IActionResult> LogoutAll(CancellationToken cancellationToken)
  {
    await _mediator.Send(new GlobalSignOutCommand(_currentUserService.GetUserId()), cancellationToken);
    return Ok();
  }

  [AllowAnonymous]
  [HttpGet("account-exists")]
  public async Task<ActionResult<AccountExistsDto>> CheckAccountExists(
    [FromQuery] string email,
    CancellationToken cancellationToken)
  {
    var result = await _mediator.Send(new CheckUserAccountExistsQuery(email), cancellationToken);
    return Ok(result);
  }
}
