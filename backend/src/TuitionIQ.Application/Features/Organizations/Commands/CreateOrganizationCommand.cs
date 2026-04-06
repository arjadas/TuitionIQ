using FluentValidation;
using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Organizations.Dtos;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Organizations.Commands;

public sealed record CreateOrganizationCommand(Guid UserId, string Name, string Slug) : IRequest<OrganizationDto>;

public sealed class CreateOrganizationCommandValidator : AbstractValidator<CreateOrganizationCommand>
{
  private const string SlugPattern = "^[a-z0-9-]+$";

  public CreateOrganizationCommandValidator()
  {
    RuleFor(command => command.Name)
      .NotEmpty()
      .MaximumLength(255);

    RuleFor(command => command.Slug)
      .NotEmpty()
      .MaximumLength(100)
      .Matches(SlugPattern);
  }
}

public sealed class CreateOrganizationCommandHandler : IRequestHandler<CreateOrganizationCommand, OrganizationDto>
{
  private readonly IAppDbContext _dbContext;
  private readonly IAuditLogService _auditLogService;

  public CreateOrganizationCommandHandler(IAppDbContext dbContext, IAuditLogService auditLogService)
  {
    _dbContext = dbContext;
    _auditLogService = auditLogService;
  }

  public async Task<OrganizationDto> Handle(CreateOrganizationCommand request, CancellationToken cancellationToken)
  {
    var now = DateTimeOffset.UtcNow;
    var organizationId = Guid.NewGuid();
    var normalizedName = request.Name.Trim();
    var normalizedSlug = request.Slug.Trim().ToLowerInvariant();

    IQueryable<Guid> slugQuery = _dbContext.Organizations
      .Where(organization => organization.Slug == normalizedSlug)
      .Select(organization => organization.Id);

    var existingOrganizationId = await _dbContext.FirstOrDefaultAsync(slugQuery, cancellationToken);
    if (existingOrganizationId != Guid.Empty)
    {
      throw new ConflictException($"Organization slug '{normalizedSlug}' is already in use.");
    }

    var organization = new Organization
    {
      Id = organizationId,
      Name = normalizedName,
      Slug = normalizedSlug,
      OwnerId = request.UserId,
      Plan = "free",
      Settings = new Dictionary<string, object?>(),
      CreatedAt = now,
      UpdatedAt = now
    };

    var ownerMembership = new OrganizationMember
    {
      Id = Guid.NewGuid(),
      OrganizationId = organizationId,
      UserId = request.UserId,
      Role = OrganizationMemberRole.Owner,
      JoinedAt = now,
      CreatedAt = now,
      UpdatedAt = now
    };

    _dbContext.Add(organization);
    _dbContext.Add(ownerMembership);

    _auditLogService.Add(new AuditLog(Guid.NewGuid(), "organization.created", "organizations", now)
    {
      OrganizationId = organizationId,
      ActorId = request.UserId,
      EntityId = organizationId,
      NewValues = new Dictionary<string, object?>
      {
        ["name"] = normalizedName,
        ["slug"] = normalizedSlug,
        ["plan"] = organization.Plan
      }
    });

    // One SaveChanges call keeps organization, membership, and audit log in one database transaction.
    await _dbContext.SaveChangesAsync(cancellationToken);

    return new OrganizationDto
    {
      Id = organization.Id,
      Name = organization.Name,
      Slug = organization.Slug,
      Plan = organization.Plan,
      CreatedAt = organization.CreatedAt
    };
  }
}
