using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Organizations.Dtos;

namespace TuitionIQ.Application.Features.Organizations.Queries;

public sealed record GetOrganizationQuery(Guid OrganizationId, Guid UserId) : IRequest<OrganizationDto>;

public sealed class GetOrganizationQueryHandler : IRequestHandler<GetOrganizationQuery, OrganizationDto>
{
  private readonly IAppDbContext _dbContext;

  public GetOrganizationQueryHandler(IAppDbContext dbContext)
  {
    _dbContext = dbContext;
  }

  public async Task<OrganizationDto> Handle(GetOrganizationQuery request, CancellationToken cancellationToken)
  {
    IQueryable<OrganizationDto> organizationQuery =
      from organization in _dbContext.Organizations
      join membership in _dbContext.OrganizationMembers
        on organization.Id equals membership.OrganizationId
      where organization.Id == request.OrganizationId && membership.UserId == request.UserId
      select new OrganizationDto
      {
        Id = organization.Id,
        Name = organization.Name,
        Slug = organization.Slug,
        Plan = organization.Plan,
        CreatedAt = organization.CreatedAt
      };

    var organizationDto = await _dbContext.FirstOrDefaultAsync(organizationQuery, cancellationToken);
    if (organizationDto is null)
    {
      throw new NotFoundException($"Organization with id '{request.OrganizationId}' was not found.");
    }

    return organizationDto;
  }
}
