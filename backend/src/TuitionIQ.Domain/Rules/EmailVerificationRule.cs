using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Domain.Rules;

public static class EmailVerificationRule
{
  public static bool CanAccessProtectedResources(User user)
  {
    return user.DeletedAt is null && user.IsActive && user.EmailVerified;
  }
}
