using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Application.Common.Interfaces;

public interface IAppDbContext
{
  IQueryable<User> Users { get; }
  IQueryable<Organization> Organizations { get; }
  IQueryable<OrganizationMember> OrganizationMembers { get; }
  IQueryable<Student> Students { get; }
  IQueryable<TeacherStudent> TeacherStudents { get; }
  void Add<TEntity>(TEntity entity) where TEntity : class;
  void AddAuditLog(AuditLog auditLog);
  Task<IAppDbTransaction> BeginTransactionAsync(CancellationToken cancellationToken = default);
  Task<T?> FirstOrDefaultAsync<T>(IQueryable<T> query, CancellationToken cancellationToken = default);
  Task<List<T>> ToListAsync<T>(IQueryable<T> query, CancellationToken cancellationToken = default);
  Task<int> CountAsync<T>(IQueryable<T> query, CancellationToken cancellationToken = default);
  Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}