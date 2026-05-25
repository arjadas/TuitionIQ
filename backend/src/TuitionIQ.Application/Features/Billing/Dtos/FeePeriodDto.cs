namespace TuitionIQ.Application.Features.Billing.Dtos;

public sealed class FeePeriodDto
{
  public Guid Id { get; init; }
  public int PeriodYear { get; init; }
  public int PeriodMonth { get; init; }
  public long Fee { get; init; }
  public long AmountPaid { get; init; }
  public string Currency { get; init; } = string.Empty;
  public string Status { get; init; } = string.Empty;
  public DateOnly? DueDate { get; init; }
  public DateTimeOffset CreatedAt { get; init; }
}
