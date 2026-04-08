using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Users.Dtos;

namespace TuitionIQ.Application.Features.Users.Queries;

public sealed record GetCurrentUserQuery(Guid UserId) : IRequest<UserProfileDto>;

public sealed class GetCurrentUserQueryHandler : IRequestHandler<GetCurrentUserQuery, UserProfileDto>
{
  private readonly IAppDbContext _dbContext;

  public GetCurrentUserQueryHandler(IAppDbContext dbContext)
  {
    _dbContext = dbContext;
  }

  public async Task<UserProfileDto> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
  {
    IQueryable<UserProfileDto> profileQuery = _dbContext.Users
      .Where(user => user.Id == request.UserId)
      .Select(user => new UserProfileDto
      {
        Id = user.Id,
        Email = user.Email,
        FirstName = user.FirstName,
        LastName = user.LastName,
        Phone = user.Phone,
        AvatarUrl = user.AvatarUrl,
        EmailVerified = user.EmailVerified
      });

    var profile = await _dbContext.FirstOrDefaultAsync(profileQuery, cancellationToken);
    if (profile is null)
    {
      throw new NotFoundException($"User with id '{request.UserId}' was not found.");
    }

    return profile;
  }
}