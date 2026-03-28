namespace TuitionIQ.Domain.Entities;

public class Organization
{
  public Guid Id { get; set; }
  public string Name { get; set; } = string.Empty;
  public string Slug { get; set; } = string.Empty;
  public Guid OwnerId { get; set; }
  public string Plan { get; set; } = string.Empty;
  public DateTimeOffset? PlanExpiresAt { get; set; }
  public Dictionary<string, object?>? Settings { get; set; }
  public DateTimeOffset CreatedAt { get; set; }
  public DateTimeOffset UpdatedAt { get; set; }
  public DateTimeOffset? DeletedAt { get; set; }
}