using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Students.Dtos;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Students.Queries;

public sealed record GetStudentByIdQuery(Guid OrganizationId, Guid StudentId, Guid UserId) : IRequest<StudentDto>;

public sealed class GetStudentByIdQueryHandler : IRequestHandler<GetStudentByIdQuery, StudentDto>
{
  private readonly IAppDbContext _dbContext;

  public GetStudentByIdQueryHandler(IAppDbContext dbContext)
  {
    _dbContext = dbContext;
  }

  public async Task<StudentDto> Handle(GetStudentByIdQuery request, CancellationToken cancellationToken)
  {
    IQueryable<OrganizationMemberRole?> membershipRoleQuery = _dbContext.OrganizationMembers
      .Where(membership => membership.OrganizationId == request.OrganizationId && membership.UserId == request.UserId)
      .Select(membership => (OrganizationMemberRole?)membership.Role);

    var callerRole = await _dbContext.FirstOrDefaultAsync(membershipRoleQuery, cancellationToken);
    if (callerRole is null)
    {
      throw new ForbiddenException("You are not allowed to view this student.");
    }

    IQueryable<StudentDto> studentQuery = _dbContext.Students
      .Where(student => student.OrganizationId == request.OrganizationId && student.Id == request.StudentId)
      .Select(student => new StudentDto
      {
        Id = student.Id,
        OrganizationId = student.OrganizationId,
        UserId = student.UserId,
        FirstName = student.FirstName,
        LastName = student.LastName,
        Email = student.Email,
        Phone = student.Phone,
        Notes = student.Notes,
        Status = student.Status.ToString(),
        AccountStatus = student.AccountStatus.ToString(),
        Metadata = student.Metadata,
        CreatedAt = student.CreatedAt,
        UpdatedAt = student.UpdatedAt
      });

    var studentDto = await _dbContext.FirstOrDefaultAsync(studentQuery, cancellationToken);
    if (studentDto is null)
    {
      throw new NotFoundException($"Student with id '{request.StudentId}' was not found.");
    }

    return studentDto;
  }
}
