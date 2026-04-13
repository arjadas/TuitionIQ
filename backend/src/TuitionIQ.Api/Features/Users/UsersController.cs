using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Users.Commands;
using TuitionIQ.Application.Features.Users.Dtos;
using TuitionIQ.Application.Features.Users.Queries;

namespace TuitionIQ.Api.Features.Users;

[ApiController]
[Authorize]
[Route("api/users")]
public sealed class UsersController : ControllerBase
{
  private readonly IMediator _mediator;
  private readonly ICurrentUserService _currentUserService;

  public UsersController(IMediator mediator, ICurrentUserService currentUserService)
  {
    _mediator = mediator;
    _currentUserService = currentUserService;
  }

  [HttpGet("me")]
  public async Task<ActionResult<UserProfileDto>> GetMe(CancellationToken cancellationToken)
  {
    var result = await _mediator.Send(new GetUserProfileQuery(_currentUserService.GetUserId()), cancellationToken);
    return Ok(result);
  }

  [HttpPatch("profile")]
  public async Task<ActionResult<UserProfileDto>> UpdateProfile(
    [FromBody] UpdateProfileRequest request,
    CancellationToken cancellationToken)
  {
    var result = await _mediator.Send(
      new UpdateProfileCommand(
        _currentUserService.GetUserId(),
        request.FirstName,
        request.LastName,
        request.Phone),
      cancellationToken);

    return Ok(result);
  }

  [HttpPatch("email-verification")]
  public async Task<IActionResult> VerifyEmail(CancellationToken cancellationToken)
  {
    await _mediator.Send(new VerifyEmailCommand(_currentUserService.GetUserId()), cancellationToken);
    return Ok();
  }
}
