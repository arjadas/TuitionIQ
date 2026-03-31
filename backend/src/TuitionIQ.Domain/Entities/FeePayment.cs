using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Domain.Entities;

public class FeePayment
{
  public Guid Id { get; set; }
  public Guid OrganizationId { get; set; }
  public Guid StudentId { get; set; }
  public Guid FeePeriodId { get; set; }
  public Guid RecordedBy { get; set; }
  public long Amount { get; set; }
  public string Currency { get; set; } = string.Empty;
  public DateOnly PaymentDate { get; set; }
  public PaymentMethod PaymentMethod { get; set; }
  public string? Reference { get; set; }
  public string? Notes { get; set; }
  public DateTimeOffset CreatedAt { get; set; }
  public DateTimeOffset UpdatedAt { get; set; }
  public DateTimeOffset? DeletedAt { get; set; }
}