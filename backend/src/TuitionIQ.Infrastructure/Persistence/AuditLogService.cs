using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Infrastructure.Persistence;

public sealed class AuditLogService : IAuditLogService
{
  private readonly IAppDbContext _dbContext;

  public AuditLogService(IAppDbContext dbContext)
  {
    _dbContext = dbContext;
  }

  public void Add(AuditLog auditLog)
  {
    _dbContext.AddAuditLog(auditLog);
  }
}