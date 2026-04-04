using MediatR;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Organizations.Dtos;

namespace TuitionIQ.Application.Features.Organizations.Queries;

public sealed record GetMyMembershipsQuery(Guid UserId) : IRequest<IReadOnlyList<MembershipDto>>;

public sealed class GetMyMembershipsQueryHandler : IRequestHandler<GetMyMembershipsQuery, IReadOnlyList<MembershipDto>>
{
  private readonly IAppDbContext _dbContext;

  public GetMyMembershipsQueryHandler(IAppDbContext dbContext)
  {
    _dbContext = dbContext;
  }

  public async Task<IReadOnlyList<MembershipDto>> Handle(
    GetMyMembershipsQuery request,
    CancellationToken cancellationToken)
  {
    IQueryable<MembershipDto> membershipsQuery =
      from membership in _dbContext.OrganizationMembers
      join organization in _dbContext.Organizations
        on membership.OrganizationId equals organization.Id
      where membership.UserId == request.UserId
      orderby organization.Name
      select new MembershipDto
      {
        OrganizationId = membership.OrganizationId,
        Role = membership.Role.ToString(),
        JoinedAt = membership.JoinedAt,
        Organization = new OrganizationDto
        {
          Id = organization.Id,
          Name = organization.Name,
          Slug = organization.Slug,
          Plan = organization.Plan,
          CreatedAt = organization.CreatedAt
        }
      };

    return await _dbContext.ToListAsync(membershipsQuery, cancellationToken);
  }
}
