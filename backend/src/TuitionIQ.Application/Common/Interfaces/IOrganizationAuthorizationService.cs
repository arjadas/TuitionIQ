using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Common.Interfaces;

public interface IOrganizationAuthorizationService
{
  Task<OrganizationMemberRole> RequireTeacherOrHigherAsync(
    Guid organizationId,
    Guid userId,
    string forbiddenMessage,
    CancellationToken cancellationToken = default);

  Task<OrganizationMemberRole> RequireOwnerOrAdminAsync(
    Guid organizationId,
    Guid userId,
    string forbiddenMessage,
    CancellationToken cancellationToken = default);

  Task EnsureTeacherHasStudentAccessAsync(
    Guid organizationId,
    Guid teacherId,
    Guid studentId,
    string forbiddenMessage,
    CancellationToken cancellationToken = default);
}
