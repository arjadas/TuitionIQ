using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Domain.Entities;

public class OrganizationMember
{
  public Guid Id { get; set; }
  public Guid OrganizationId { get; set; }
  public Guid UserId { get; set; }
  public OrganizationMemberRole Role { get; set; }
  public Guid? InvitedBy { get; set; }
  public DateTimeOffset? JoinedAt { get; set; }
  public DateTimeOffset CreatedAt { get; set; }
  public DateTimeOffset UpdatedAt { get; set; }
}