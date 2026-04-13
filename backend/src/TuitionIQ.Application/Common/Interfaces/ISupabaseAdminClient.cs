namespace TuitionIQ.Application.Common.Interfaces;

public interface ISupabaseAdminClient
{
  Task SignOutGlobalAsync(Guid userId, CancellationToken cancellationToken = default);
  Task BanUserAsync(Guid userId, string duration, CancellationToken cancellationToken = default);
  Task UpdateUserAsync(Guid userId, object payload, CancellationToken cancellationToken = default);
}
