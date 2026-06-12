namespace TuitionIQ.Application.Features.Billing.Dtos;

// Org-wide billing view: a fee period enriched with its student's identity so the
// org billing dashboard can list periods across every student in one place.
public sealed class OrgFeePeriodDto
{
  public Guid Id { get; init; }
  public Guid StudentId { get; init; }
  public string StudentName { get; init; } = string.Empty;
  public int PeriodYear { get; init; }
  public int PeriodMonth { get; init; }
  public long Fee { get; init; }
  public long AmountPaid { get; init; }
  public string Currency { get; init; } = string.Empty;
  public string Status { get; init; } = string.Empty;
  public DateOnly? DueDate { get; init; }
  public DateTimeOffset CreatedAt { get; init; }
}
