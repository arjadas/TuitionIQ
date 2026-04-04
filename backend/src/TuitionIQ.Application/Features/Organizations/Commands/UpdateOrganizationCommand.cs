using System.Text.Json;
using FluentValidation;
using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Organizations.Dtos;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Organizations.Commands;

public sealed record UpdateOrganizationCommand(Guid OrganizationId, Guid UserId, string? Name, JsonDocument? Settings)
  : IRequest<OrganizationDto>;

public sealed class UpdateOrganizationCommandValidator : AbstractValidator<UpdateOrganizationCommand>
{
  public UpdateOrganizationCommandValidator()
  {
    RuleFor(command => command.Name)
      .MaximumLength(255)
      .When(command => command.Name is not null);

    RuleFor(command => command.Name)
      .Must(name => !string.IsNullOrWhiteSpace(name))
      .WithMessage("Name cannot be empty.")
      .When(command => command.Name is not null);

    RuleFor(command => command)
      .Must(command => command.Name is not null || command.Settings is not null)
      .WithMessage("At least one update field must be provided.");
  }
}

public sealed class UpdateOrganizationCommandHandler : IRequestHandler<UpdateOrganizationCommand, OrganizationDto>
{
  private readonly IAppDbContext _dbContext;

  public UpdateOrganizationCommandHandler(IAppDbContext dbContext)
  {
    _dbContext = dbContext;
  }

  public async Task<OrganizationDto> Handle(UpdateOrganizationCommand request, CancellationToken cancellationToken)
  {
    IQueryable<OrganizationMemberRole?> membershipRoleQuery = _dbContext.OrganizationMembers
      .Where(membership => membership.OrganizationId == request.OrganizationId && membership.UserId == request.UserId)
      .Select(membership => (OrganizationMemberRole?)membership.Role);

    var callerRole = await _dbContext.FirstOrDefaultAsync(membershipRoleQuery, cancellationToken);
    if (callerRole is not OrganizationMemberRole.Owner and not OrganizationMemberRole.Admin)
    {
      throw new NotFoundException($"Organization with id '{request.OrganizationId}' was not found.");
    }

    IQueryable<Organization> organizationQuery = _dbContext.Organizations
      .Where(organization => organization.Id == request.OrganizationId);

    var organization = await _dbContext.FirstOrDefaultAsync(organizationQuery, cancellationToken);
    if (organization is null)
    {
      throw new NotFoundException($"Organization with id '{request.OrganizationId}' was not found.");
    }

    var oldValues = new Dictionary<string, object?>();
    var newValues = new Dictionary<string, object?>();

    if (request.Name is not null)
    {
      var normalizedName = request.Name.Trim();
      oldValues["name"] = organization.Name;
      newValues["name"] = normalizedName;
      organization.Name = normalizedName;
    }

    if (request.Settings is not null)
    {
      var updatedSettings = ParseSettings(request.Settings);
      oldValues["settings"] = organization.Settings;
      newValues["settings"] = updatedSettings;
      organization.Settings = updatedSettings;
    }

    var now = DateTimeOffset.UtcNow;
    organization.UpdatedAt = now;

    _dbContext.AddAuditLog(new AuditLog(Guid.NewGuid(), "organization.updated", "organizations", now)
    {
      OrganizationId = organization.Id,
      ActorId = request.UserId,
      EntityId = organization.Id,
      OldValues = oldValues,
      NewValues = newValues
    });

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

  private static Dictionary<string, object?> ParseSettings(JsonDocument settingsDocument)
  {
    var parsedSettings = JsonSerializer.Deserialize<Dictionary<string, object?>>(settingsDocument.RootElement.GetRawText());
    return parsedSettings ?? new Dictionary<string, object?>();
  }
}
