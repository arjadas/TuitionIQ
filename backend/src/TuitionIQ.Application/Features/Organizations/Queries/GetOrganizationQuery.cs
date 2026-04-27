using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Organizations.Dtos;

namespace TuitionIQ.Application.Features.Organizations.Queries;

public sealed record GetOrganizationQuery(Guid OrganizationId, Guid UserId) : IRequest<OrganizationDto>;

public sealed class GetOrganizationQueryHandler : IRequestHandler<GetOrganizationQuery, OrganizationDto>
{
  private readonly IAppDbContext _dbContext;
  private readonly IOrganizationAuthorizationService _organizationAuthorizationService;

  public GetOrganizationQueryHandler(
    IAppDbContext dbContext,
    IOrganizationAuthorizationService organizationAuthorizationService)
  {
    _dbContext = dbContext;
    _organizationAuthorizationService = organizationAuthorizationService;
  }

  public async Task<OrganizationDto> Handle(GetOrganizationQuery request, CancellationToken cancellationToken)
  {
    await _organizationAuthorizationService.RequireTeacherOrHigherAsync(
      request.OrganizationId,
      request.UserId,
      "You are not allowed to access this organization.",
      cancellationToken);

    IQueryable<OrganizationDto> organizationQuery = _dbContext.Organizations
      .Where(organization => organization.Id == request.OrganizationId)
      .Select(organization => new OrganizationDto
      {
        Id = organization.Id,
        Name = organization.Name,
        Slug = organization.Slug,
        Plan = organization.Plan,
        CreatedAt = organization.CreatedAt
      });

    var organizationDto = await _dbContext.FirstOrDefaultAsync(organizationQuery, cancellationToken);
    if (organizationDto is null)
    {
      throw new NotFoundException($"Organization with id '{request.OrganizationId}' was not found.");
    }

    return organizationDto;
  }
}
