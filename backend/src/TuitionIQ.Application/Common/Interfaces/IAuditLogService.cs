using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Application.Common.Interfaces;

public interface IAuditLogService
{
  void Add(AuditLog auditLog);
}