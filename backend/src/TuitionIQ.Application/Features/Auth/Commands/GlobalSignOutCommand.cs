using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Application.Features.Auth.Commands;

public sealed record GlobalSignOutCommand(Guid UserId) : IRequest;

public sealed class GlobalSignOutCommandHandler : IRequestHandler<GlobalSignOutCommand>
{
  private readonly IAppDbContext _dbContext;
  private readonly ISupabaseAdminClient _supabaseAdminClient;

  public GlobalSignOutCommandHandler(IAppDbContext dbContext, ISupabaseAdminClient supabaseAdminClient)
  {
    _dbContext = dbContext;
    _supabaseAdminClient = supabaseAdminClient;
  }

  public async Task Handle(GlobalSignOutCommand request, CancellationToken cancellationToken)
  {
    IQueryable<User> userQuery = _dbContext.Users
      .Where(user => user.Id == request.UserId);

    var user = await _dbContext.FirstOrDefaultAsync(userQuery, cancellationToken);
    if (user is null)
    {
      throw new NotFoundException($"User with id '{request.UserId}' was not found.");
    }

    await _supabaseAdminClient.SignOutGlobalAsync(user.Id, cancellationToken);

    user.IsActive = false;
    user.UpdatedAt = DateTimeOffset.UtcNow;

    await _dbContext.SaveChangesAsync(cancellationToken);
  }
}
