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
  public async Task<ActionResult<UserProfileDto>> GetCurrentUser(CancellationToken cancellationToken)
  {
    var result = await _mediator.Send(new GetCurrentUserQuery(_currentUserService.UserId), cancellationToken);
    return Ok(result);
  }

  [HttpPatch("profile")]
  public async Task<ActionResult<UserProfileDto>> UpdateProfile(
    [FromBody] UpdateProfileRequest request,
    CancellationToken cancellationToken)
  {
    var result = await _mediator.Send(
      new UpdateProfileCommand(_currentUserService.UserId, request.FirstName, request.LastName, request.Phone),
      cancellationToken);

    return Ok(result);
  }
}