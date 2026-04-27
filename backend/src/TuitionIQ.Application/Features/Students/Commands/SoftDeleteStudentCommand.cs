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
  private readonly IOrganizationAuthorizationService _organizationAuthorizationService;

  public SoftDeleteStudentCommandHandler(
    IAppDbContext dbContext,
    IAuditLogService auditLogService,
    IOrganizationAuthorizationService organizationAuthorizationService)
  {
    _dbContext = dbContext;
    _auditLogService = auditLogService;
    _organizationAuthorizationService = organizationAuthorizationService;
  }

  public async Task Handle(SoftDeleteStudentCommand request, CancellationToken cancellationToken)
  {
    var callerRole = await _organizationAuthorizationService.RequireTeacherOrHigherAsync(
      request.OrganizationId,
      request.UserId,
      "You are not allowed to delete this student.",
      cancellationToken);

    if (callerRole == OrganizationMemberRole.Teacher)
    {
      await _organizationAuthorizationService.EnsureTeacherHasStudentAccessAsync(
        request.OrganizationId,
        request.UserId,
        request.StudentId,
        "You are not allowed to delete this student.",
        cancellationToken);
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
