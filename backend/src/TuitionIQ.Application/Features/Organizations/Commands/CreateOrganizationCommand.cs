using FluentValidation;
using MediatR;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Organizations.Dtos;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Organizations.Commands;

public sealed record CreateOrganizationCommand(Guid UserId, string Name, string Slug) : IRequest<OrganizationDto>;

public sealed class CreateOrganizationCommandValidator : AbstractValidator<CreateOrganizationCommand>
{
  private const string SlugPattern = "^[a-z0-9-]+$";
  private readonly IAppDbContext _dbContext;

  public CreateOrganizationCommandValidator(IAppDbContext dbContext)
  {
    _dbContext = dbContext;

    RuleFor(command => command.Name)
      .NotEmpty()
      .MaximumLength(255);

    RuleFor(command => command.Slug)
      .NotEmpty()
      .MaximumLength(100)
      .Matches(SlugPattern);

    RuleFor(command => command.Slug)
      .MustAsync(BeUniqueSlugAsync)
      .WithMessage("Slug is already in use.");
  }

  private async Task<bool> BeUniqueSlugAsync(string slug, CancellationToken cancellationToken)
  {
    var normalizedSlug = slug.Trim().ToLowerInvariant();

    IQueryable<string> slugQuery = _dbContext.Organizations
      .Select(organization => organization.Slug)
      .Where(existingSlug => existingSlug == normalizedSlug);

    var existingSlug = await _dbContext.FirstOrDefaultAsync(slugQuery, cancellationToken);
    return existingSlug is null;
  }
}

public sealed class CreateOrganizationCommandHandler : IRequestHandler<CreateOrganizationCommand, OrganizationDto>
{
  private readonly IAppDbContext _dbContext;

  public CreateOrganizationCommandHandler(IAppDbContext dbContext)
  {
    _dbContext = dbContext;
  }

  public async Task<OrganizationDto> Handle(CreateOrganizationCommand request, CancellationToken cancellationToken)
  {
    var now = DateTimeOffset.UtcNow;
    var organizationId = Guid.NewGuid();
    var normalizedName = request.Name.Trim();
    var normalizedSlug = request.Slug.Trim().ToLowerInvariant();

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

    _dbContext.AddAuditLog(new AuditLog(Guid.NewGuid(), "organization.created", "organizations", now)
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
