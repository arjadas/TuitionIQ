namespace TuitionIQ.Application.Features.Billing.Dtos;

public sealed class FeePaymentDto
{
  public Guid Id { get; init; }
  public long Amount { get; init; }
  public string Currency { get; init; } = string.Empty;
  public DateOnly PaymentDate { get; init; }
  public string PaymentMethod { get; init; } = string.Empty;
  public string? Reference { get; init; }
  public DateTimeOffset CreatedAt { get; init; }
}
