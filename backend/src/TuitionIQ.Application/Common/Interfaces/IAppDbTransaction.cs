namespace TuitionIQ.Application.Common.Interfaces;

public interface IAppDbTransaction : IAsyncDisposable
{
  Task CommitAsync(CancellationToken cancellationToken = default);
  Task RollbackAsync(CancellationToken cancellationToken = default);
}
