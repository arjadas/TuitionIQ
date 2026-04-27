using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Common.Security;

public sealed class OrganizationAuthorizationService : IOrganizationAuthorizationService
{
  private static readonly OrganizationMemberRole[] TeacherOrHigherRoles =
  [
    OrganizationMemberRole.Owner,
    OrganizationMemberRole.Admin,
    OrganizationMemberRole.Teacher
  ];

  private static readonly OrganizationMemberRole[] OwnerOrAdminRoles =
  [
    OrganizationMemberRole.Owner,
    OrganizationMemberRole.Admin
  ];

  private readonly IAppDbContext _dbContext;

  public OrganizationAuthorizationService(IAppDbContext dbContext)
  {
    _dbContext = dbContext;
  }

  public Task<OrganizationMemberRole> RequireTeacherOrHigherAsync(
    Guid organizationId,
    Guid userId,
    string forbiddenMessage,
    CancellationToken cancellationToken = default)
  {
    return RequireRoleAsync(organizationId, userId, TeacherOrHigherRoles, forbiddenMessage, cancellationToken);
  }

  public Task<OrganizationMemberRole> RequireOwnerOrAdminAsync(
    Guid organizationId,
    Guid userId,
    string forbiddenMessage,
    CancellationToken cancellationToken = default)
  {
    return RequireRoleAsync(organizationId, userId, OwnerOrAdminRoles, forbiddenMessage, cancellationToken);
  }

  public async Task EnsureTeacherHasStudentAccessAsync(
    Guid organizationId,
    Guid teacherId,
    Guid studentId,
    string forbiddenMessage,
    CancellationToken cancellationToken = default)
  {
    IQueryable<Guid> teacherStudentLinkQuery = _dbContext.TeacherStudents
      .Where(link =>
        link.OrganizationId == organizationId
        && link.TeacherId == teacherId
        && link.StudentId == studentId)
      .Select(link => link.Id);

    var teacherStudentLinkId = await _dbContext.FirstOrDefaultAsync(teacherStudentLinkQuery, cancellationToken);
    if (teacherStudentLinkId == Guid.Empty)
    {
      throw new ForbiddenException(forbiddenMessage);
    }
  }

  private async Task<OrganizationMemberRole> RequireRoleAsync(
    Guid organizationId,
    Guid userId,
    IReadOnlyCollection<OrganizationMemberRole> allowedRoles,
    string forbiddenMessage,
    CancellationToken cancellationToken)
  {
    IQueryable<OrganizationMemberRole?> callerRoleQuery = _dbContext.OrganizationMembers
      .Where(membership => membership.OrganizationId == organizationId && membership.UserId == userId)
      .Select(membership => (OrganizationMemberRole?)membership.Role);

    var callerRole = await _dbContext.FirstOrDefaultAsync(callerRoleQuery, cancellationToken);

    if (callerRole is null || !allowedRoles.Contains(callerRole.Value))
    {
      throw new ForbiddenException(forbiddenMessage);
    }

    return callerRole.Value;
  }
}
