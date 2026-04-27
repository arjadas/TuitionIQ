namespace TuitionIQ.Application.Features.Billing.Dtos;

public sealed class StudentFeeConfigDto
{
  public Guid Id { get; init; }
  public Guid OrganizationId { get; init; }
  public Guid StudentId { get; init; }
  public Guid SetBy { get; init; }
  public string FeeSource { get; init; } = string.Empty;
  public long? ManualFee { get; init; }
  public string? OverrideReason { get; init; }
  public string Currency { get; init; } = string.Empty;
  public DateOnly EffectiveFrom { get; init; }
  public DateOnly? EffectiveTo { get; init; }
  public bool IsActive { get; init; }
  public string? Notes { get; init; }
  public DateTimeOffset CreatedAt { get; init; }
  public DateTimeOffset UpdatedAt { get; init; }
  public DateTimeOffset? DeletedAt { get; init; }
}
