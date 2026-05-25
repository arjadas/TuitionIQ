using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Billing;

internal static class FeePeriodStatusCalculator
{
  public static FeePeriodStatus DeriveForCurrentStatus(
    FeePeriodStatus currentStatus,
    long fee,
    long amountPaid)
  {
    if (currentStatus is FeePeriodStatus.Waived or FeePeriodStatus.Overdue)
    {
      return currentStatus;
    }

    return Derive(fee, amountPaid);
  }

  public static FeePeriodStatus Derive(long fee, long amountPaid)
  {
    if (amountPaid <= 0)
    {
      return FeePeriodStatus.Unpaid;
    }

    if (amountPaid >= fee)
    {
      return FeePeriodStatus.Paid;
    }

    return FeePeriodStatus.Partial;
  }
}
