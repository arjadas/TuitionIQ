namespace TuitionIQ.Domain.Entities;

public class AuditLog
{
  // Insert-only entity: private constructor for EF Core materialization.
  private AuditLog()
  {
  }

  public AuditLog(Guid id, string action, string entityType, DateTimeOffset createdAt)
  {
    Id = id;
    Action = action;
    EntityType = entityType;
    CreatedAt = createdAt;
  }

  public Guid Id { get; set; }
  public Guid? OrganizationId { get; set; }
  public Guid? ActorId { get; set; }
  public string Action { get; set; } = string.Empty;
  public string EntityType { get; set; } = string.Empty;
  public Guid? EntityId { get; set; }
  public Dictionary<string, object?>? OldValues { get; set; }
  public Dictionary<string, object?>? NewValues { get; set; }
  public string? IpAddress { get; set; }
  public string? UserAgent { get; set; }
  public DateTimeOffset CreatedAt { get; set; }
}