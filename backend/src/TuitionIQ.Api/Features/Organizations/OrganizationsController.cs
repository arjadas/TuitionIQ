using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Organizations.Commands;
using TuitionIQ.Application.Features.Organizations.Dtos;
using TuitionIQ.Application.Features.Organizations.Queries;

namespace TuitionIQ.Api.Features.Organizations;

[ApiController]
[Authorize]
[Route("api/organizations")]
public sealed class OrganizationsController : ControllerBase
{
  private readonly IMediator _mediator;
  private readonly ICurrentUserService _currentUserService;

  public OrganizationsController(IMediator mediator, ICurrentUserService currentUserService)
  {
    _mediator = mediator;
    _currentUserService = currentUserService;
  }

  [HttpPost]
  public async Task<ActionResult<OrganizationDto>> CreateOrganization(
    [FromBody] CreateOrganizationRequest request,
    CancellationToken cancellationToken)
  {
    var organization = await _mediator.Send(
      new CreateOrganizationCommand(_currentUserService.UserId, request.Name, request.Slug),
      cancellationToken);

    return Ok(organization);
  }

  [HttpGet("{id:guid}")]
  public async Task<ActionResult<OrganizationDto>> GetOrganization(Guid id, CancellationToken cancellationToken)
  {
    var organization = await _mediator.Send(
      new GetOrganizationQuery(id, _currentUserService.UserId),
      cancellationToken);

    return Ok(organization);
  }

  [HttpPatch("{id:guid}")]
  public async Task<ActionResult<OrganizationDto>> UpdateOrganization(
    Guid id,
    [FromBody] UpdateOrganizationRequest request,
    CancellationToken cancellationToken)
  {
    var organization = await _mediator.Send(
      new UpdateOrganizationCommand(id, _currentUserService.UserId, request.Name, request.Settings),
      cancellationToken);

    return Ok(organization);
  }

  [HttpGet("memberships")]
  public async Task<ActionResult<IReadOnlyList<MembershipDto>>> GetMyMemberships(CancellationToken cancellationToken)
  {
    var memberships = await _mediator.Send(new GetMyMembershipsQuery(_currentUserService.UserId), cancellationToken);
    return Ok(memberships);
  }
}
