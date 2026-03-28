using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Domain.Entities;

public class FeePeriod
{
  public Guid Id { get; set; }
  public Guid OrganizationId { get; set; }
  public Guid StudentId { get; set; }
  public Guid? StudentFeeId { get; set; }
  public short PeriodYear { get; set; }
  public short PeriodMonth { get; set; }
  public long Fee { get; set; }
  public long AmountPaid { get; set; }
  public string Currency { get; set; } = string.Empty;
  public FeePeriodStatus Status { get; set; }
  public DateOnly? DueDate { get; set; }
  public Guid? WaivedBy { get; set; }
  public DateTimeOffset? WaivedAt { get; set; }
  public string? WaiverReason { get; set; }
  public string? Notes { get; set; }
  public DateTimeOffset CreatedAt { get; set; }
  public DateTimeOffset UpdatedAt { get; set; }
  public DateTimeOffset? DeletedAt { get; set; }
}