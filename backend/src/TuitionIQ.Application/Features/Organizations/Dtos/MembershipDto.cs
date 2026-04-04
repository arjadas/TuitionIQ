namespace TuitionIQ.Application.Features.Organizations.Dtos;

public sealed record MembershipDto
{
  public Guid OrganizationId { get; init; }
  public string Role { get; init; } = string.Empty;
  public DateTimeOffset? JoinedAt { get; init; }
  public OrganizationDto Organization { get; init; } = new();
}
