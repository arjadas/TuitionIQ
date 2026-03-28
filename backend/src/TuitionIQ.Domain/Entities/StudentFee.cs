using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Domain.Entities;

public class StudentFee
{
  public Guid Id { get; set; }
  public Guid OrganizationId { get; set; }
  public Guid StudentId { get; set; }
  public Guid SetBy { get; set; }
  public FeeSource FeeSource { get; set; }
  public long? ManualFee { get; set; }
  public string? OverrideReason { get; set; }
  public string Currency { get; set; } = string.Empty;
  public DateOnly EffectiveFrom { get; set; }
  public DateOnly? EffectiveTo { get; set; }
  public bool IsActive { get; set; }
  public string? Notes { get; set; }
  public DateTimeOffset CreatedAt { get; set; }
  public DateTimeOffset UpdatedAt { get; set; }
  public DateTimeOffset? DeletedAt { get; set; }
}