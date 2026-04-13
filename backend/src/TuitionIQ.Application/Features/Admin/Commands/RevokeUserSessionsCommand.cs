using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Admin.Commands;

public sealed record RevokeUserSessionsCommand(Guid ActorUserId, Guid TargetUserId) : IRequest;

public sealed class RevokeUserSessionsCommandHandler : IRequestHandler<RevokeUserSessionsCommand>
{
  private readonly IAppDbContext _dbContext;
  private readonly IAuditLogService _auditLogService;
  private readonly ISupabaseAdminClient _supabaseAdminClient;

  public RevokeUserSessionsCommandHandler(
    IAppDbContext dbContext,
    IAuditLogService auditLogService,
    ISupabaseAdminClient supabaseAdminClient)
  {
    _dbContext = dbContext;
    _auditLogService = auditLogService;
    _supabaseAdminClient = supabaseAdminClient;
  }

  public async Task Handle(RevokeUserSessionsCommand request, CancellationToken cancellationToken)
  {
    var sharedOrganizationId = await EnsureAdminPermissionAsync(request.ActorUserId, request.TargetUserId, cancellationToken);

    IQueryable<User> targetUserQuery = _dbContext.Users
      .Where(user => user.Id == request.TargetUserId);

    var targetUser = await _dbContext.FirstOrDefaultAsync(targetUserQuery, cancellationToken);
    if (targetUser is null)
    {
      throw new NotFoundException($"User with id '{request.TargetUserId}' was not found.");
    }

    await _supabaseAdminClient.SignOutGlobalAsync(targetUser.Id, cancellationToken);

    var now = DateTimeOffset.UtcNow;

    targetUser.IsActive = false;
    targetUser.UpdatedAt = now;

    _auditLogService.Add(new AuditLog(Guid.NewGuid(), "user.sessions_revoked", "users", now)
    {
      OrganizationId = sharedOrganizationId,
      ActorId = request.ActorUserId,
      EntityId = targetUser.Id,
      NewValues = new Dictionary<string, object?>
      {
        ["is_active"] = false
      }
    });

    await _dbContext.SaveChangesAsync(cancellationToken);
  }

  private async Task<Guid> EnsureAdminPermissionAsync(Guid actorUserId, Guid targetUserId, CancellationToken cancellationToken)
  {
    IQueryable<Guid> adminOrgIdsQuery = _dbContext.OrganizationMembers
      .Where(member => member.UserId == actorUserId
        && (member.Role == OrganizationMemberRole.Owner || member.Role == OrganizationMemberRole.Admin))
      .Select(member => member.OrganizationId);

    var adminOrgIds = await _dbContext.ToListAsync(adminOrgIdsQuery, cancellationToken);
    if (adminOrgIds.Count == 0)
    {
      throw new ForbiddenException("Only organization owners or admins can perform this action.");
    }

    IQueryable<Guid?> sharedMembershipQuery = _dbContext.OrganizationMembers
      .Where(member => member.UserId == targetUserId && adminOrgIds.Contains(member.OrganizationId))
      .Select(member => (Guid?)member.OrganizationId);

    var sharedMembership = await _dbContext.FirstOrDefaultAsync(sharedMembershipQuery, cancellationToken);
    if (sharedMembership is null)
    {
      throw new ForbiddenException("You can only manage users in your own organization.");
    }

    return sharedMembership.Value;
  }
}
