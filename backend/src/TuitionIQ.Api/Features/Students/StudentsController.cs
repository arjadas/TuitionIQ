using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Common.Models;
using TuitionIQ.Application.Features.Students.Commands;
using TuitionIQ.Application.Features.Students.Dtos;
using TuitionIQ.Application.Features.Students.Queries;

namespace TuitionIQ.Api.Features.Students;

[ApiController]
[Authorize]
[Route("api/organizations/{orgId:guid}/students")]
public sealed class StudentsController : ControllerBase
{
  private readonly IMediator _mediator;
  private readonly ICurrentUserService _currentUserService;

  public StudentsController(IMediator mediator, ICurrentUserService currentUserService)
  {
    _mediator = mediator;
    _currentUserService = currentUserService;
  }

  [HttpGet]
  public async Task<ActionResult<PagedResult<StudentSummaryDto>>> GetStudents(
    Guid orgId,
    [FromQuery] string? status,
    [FromQuery] string? search,
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 20,
    CancellationToken cancellationToken = default)
  {
    var result = await _mediator.Send(
      new GetStudentsQuery(orgId, _currentUserService.UserId, status, search, page, pageSize),
      cancellationToken);

    return Ok(result);
  }

  [HttpGet("{id:guid}")]
  public async Task<ActionResult<StudentDto>> GetStudentById(Guid orgId, Guid id, CancellationToken cancellationToken)
  {
    var result = await _mediator.Send(
      new GetStudentByIdQuery(orgId, id, _currentUserService.UserId),
      cancellationToken);

    return Ok(result);
  }

  [HttpPost]
  public async Task<ActionResult<StudentDto>> CreateStudent(
    Guid orgId,
    [FromBody] CreateStudentRequest request,
    CancellationToken cancellationToken)
  {
    var result = await _mediator.Send(
      new CreateStudentCommand(
        orgId,
        _currentUserService.UserId,
        request.FirstName,
        request.LastName,
        request.Email,
        request.Phone,
        request.Notes,
        request.Metadata),
      cancellationToken);

    return Ok(result);
  }

  [HttpPatch("{id:guid}")]
  public async Task<ActionResult<StudentDto>> UpdateStudent(
    Guid orgId,
    Guid id,
    [FromBody] UpdateStudentRequest request,
    CancellationToken cancellationToken)
  {
    var result = await _mediator.Send(
      new UpdateStudentCommand(
        orgId,
        id,
        _currentUserService.UserId,
        request.FirstName,
        request.LastName,
        request.Email,
        request.Phone,
        request.Notes,
        request.Metadata),
      cancellationToken);

    return Ok(result);
  }

  [HttpDelete("{id:guid}")]
  public async Task<IActionResult> DeleteStudent(Guid orgId, Guid id, CancellationToken cancellationToken)
  {
    await _mediator.Send(new SoftDeleteStudentCommand(orgId, id, _currentUserService.UserId), cancellationToken);
    return NoContent();
  }
}
