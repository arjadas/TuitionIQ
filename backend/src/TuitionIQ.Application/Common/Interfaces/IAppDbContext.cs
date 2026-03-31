using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Application.Common.Interfaces;

public interface IAppDbContext
{
  IQueryable<User> Users { get; }
  void AddAuditLog(AuditLog auditLog);
  Task<T?> FirstOrDefaultAsync<T>(IQueryable<T> query, CancellationToken cancellationToken = default);
  Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}