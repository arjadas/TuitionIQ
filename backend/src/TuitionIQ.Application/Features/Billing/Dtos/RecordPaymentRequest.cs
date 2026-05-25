namespace TuitionIQ.Application.Features.Billing.Dtos;

public sealed class RecordPaymentRequest
{
  public Guid StudentId { get; init; }
  public Guid FeePeriodId { get; init; }
  public long Amount { get; init; }
  public string Currency { get; init; } = string.Empty;
  public DateOnly PaymentDate { get; init; }
  public string PaymentMethod { get; init; } = string.Empty;
  public string? Reference { get; init; }
  public string? Notes { get; init; }
}
