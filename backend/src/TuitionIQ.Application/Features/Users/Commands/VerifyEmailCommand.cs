using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Application.Features.Users.Commands;

public sealed record VerifyEmailCommand(Guid UserId) : IRequest;

public sealed class VerifyEmailCommandHandler : IRequestHandler<VerifyEmailCommand>
{
  private readonly IAppDbContext _dbContext;
  private readonly IAuditLogService _auditLogService;

  public VerifyEmailCommandHandler(IAppDbContext dbContext, IAuditLogService auditLogService)
  {
    _dbContext = dbContext;
    _auditLogService = auditLogService;
  }

  public async Task Handle(VerifyEmailCommand request, CancellationToken cancellationToken)
  {
    IQueryable<User> userQuery = _dbContext.Users
      .Where(user => user.Id == request.UserId);

    var user = await _dbContext.FirstOrDefaultAsync(userQuery, cancellationToken);
    if (user is null)
    {
      throw new NotFoundException($"User with id '{request.UserId}' was not found.");
    }

    // this endpoint must be idempotent after OTP verification succeeds.
    if (user.EmailVerified)
    {
      return;
    }

    var updatedAt = DateTimeOffset.UtcNow;

    user.EmailVerified = true;
    user.UpdatedAt = updatedAt;

    _auditLogService.Add(new AuditLog(Guid.NewGuid(), "user.email_verified", "users", updatedAt)
    {
      ActorId = user.Id,
      EntityId = user.Id
    });

    await _dbContext.SaveChangesAsync(cancellationToken);
  }
}
