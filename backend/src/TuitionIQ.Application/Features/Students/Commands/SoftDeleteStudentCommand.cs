using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Students.Commands;

public sealed record SoftDeleteStudentCommand(Guid OrganizationId, Guid StudentId, Guid UserId) : IRequest;

public sealed class SoftDeleteStudentCommandHandler : IRequestHandler<SoftDeleteStudentCommand>
{
  private readonly IAppDbContext _dbContext;
  private readonly IAuditLogService _auditLogService;

  public SoftDeleteStudentCommandHandler(IAppDbContext dbContext, IAuditLogService auditLogService)
  {
    _dbContext = dbContext;
    _auditLogService = auditLogService;
  }

  public async Task Handle(SoftDeleteStudentCommand request, CancellationToken cancellationToken)
  {
    IQueryable<OrganizationMemberRole?> callerRoleQuery = _dbContext.OrganizationMembers
      .Where(membership => membership.OrganizationId == request.OrganizationId && membership.UserId == request.UserId)
      .Select(membership => (OrganizationMemberRole?)membership.Role);

    var callerRole = await _dbContext.FirstOrDefaultAsync(callerRoleQuery, cancellationToken);
    if (callerRole is null)
    {
      throw new ForbiddenException("You are not allowed to delete this student.");
    }

    if (callerRole is not OrganizationMemberRole.Owner
        and not OrganizationMemberRole.Admin
        and not OrganizationMemberRole.Teacher)
    {
      throw new ForbiddenException("You are not allowed to delete this student.");
    }

    if (callerRole == OrganizationMemberRole.Teacher)
    {
      IQueryable<Guid> teacherStudentLinkQuery = _dbContext.TeacherStudents
        .Where(link =>
          link.OrganizationId == request.OrganizationId
          && link.TeacherId == request.UserId
          && link.StudentId == request.StudentId)
        .Select(link => link.Id);

      var teacherStudentLinkId = await _dbContext.FirstOrDefaultAsync(teacherStudentLinkQuery, cancellationToken);
      if (teacherStudentLinkId == Guid.Empty)
      {
        throw new ForbiddenException("You are not allowed to delete this student.");
      }
    }

    await using var transaction = await _dbContext.BeginTransactionAsync(cancellationToken);
    try
    {
      IQueryable<Student> studentQuery = _dbContext.Students
        .Where(student => student.OrganizationId == request.OrganizationId && student.Id == request.StudentId);

      var student = await _dbContext.FirstOrDefaultAsync(studentQuery, cancellationToken);
      if (student is null)
      {
        throw new NotFoundException($"Student with id '{request.StudentId}' was not found.");
      }

      var now = DateTimeOffset.UtcNow;
      student.DeletedAt = now;
      student.UpdatedAt = now;

      _auditLogService.Add(new AuditLog(Guid.NewGuid(), "student.deleted", "students", now)
      {
        OrganizationId = request.OrganizationId,
        ActorId = request.UserId,
        EntityId = student.Id,
        OldValues = new Dictionary<string, object?>
        {
          ["deleted_at"] = null
        },
        NewValues = new Dictionary<string, object?>
        {
          ["deleted_at"] = student.DeletedAt
        }
      });

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);
    }
    catch
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }
}
