namespace TuitionIQ.Application.Features.Billing.Dtos;

public sealed class SetFeeRequest
{
  public string FeeSource { get; init; } = string.Empty;
  public long? ManualFee { get; init; }
  public string Currency { get; init; } = string.Empty;
  public DateOnly EffectiveFrom { get; init; }
  public string? Notes { get; init; }
  public string? OverrideReason { get; init; }
}
