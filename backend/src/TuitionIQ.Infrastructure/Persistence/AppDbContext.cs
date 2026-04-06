using Microsoft.EntityFrameworkCore;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Infrastructure.Persistence;

public class AppDbContext : DbContext, IAppDbContext
{
  public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
  {
  }

  public DbSet<User> Users => Set<User>();
  public DbSet<Organization> Organizations => Set<Organization>();
  public DbSet<OrganizationMember> OrganizationMembers => Set<OrganizationMember>();
  public DbSet<Student> Students => Set<Student>();
  public DbSet<TeacherStudent> TeacherStudents => Set<TeacherStudent>();
  public DbSet<StudentFee> StudentFees => Set<StudentFee>();
  public DbSet<FeePeriod> FeePeriods => Set<FeePeriod>();
  public DbSet<FeePayment> FeePayments => Set<FeePayment>();
  public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

  IQueryable<User> IAppDbContext.Users => Users;
  IQueryable<Organization> IAppDbContext.Organizations => Organizations;
  IQueryable<OrganizationMember> IAppDbContext.OrganizationMembers => OrganizationMembers;

  protected override void OnModelCreating(ModelBuilder modelBuilder)
  {
    modelBuilder.HasDefaultSchema("public");
    modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

    modelBuilder.Entity<User>().HasQueryFilter(e => e.DeletedAt == null);
    modelBuilder.Entity<Organization>().HasQueryFilter(e => e.DeletedAt == null);
    modelBuilder.Entity<Student>().HasQueryFilter(e => e.DeletedAt == null);
    modelBuilder.Entity<StudentFee>().HasQueryFilter(e => e.DeletedAt == null);
    modelBuilder.Entity<FeePeriod>().HasQueryFilter(e => e.DeletedAt == null);
    modelBuilder.Entity<FeePayment>().HasQueryFilter(e => e.DeletedAt == null);

    base.OnModelCreating(modelBuilder);
  }

  public override int SaveChanges()
  {
    EnsureAuditLogIsInsertOnly();
    return base.SaveChanges();
  }

  public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
  {
    EnsureAuditLogIsInsertOnly();
    return base.SaveChangesAsync(cancellationToken);
  }

  void IAppDbContext.Add<TEntity>(TEntity entity)
  {
    Set<TEntity>().Add(entity);
  }

  public void AddAuditLog(AuditLog auditLog)
  {
    AuditLogs.Add(auditLog);
  }

  public Task<T?> FirstOrDefaultAsync<T>(IQueryable<T> query, CancellationToken cancellationToken = default)
  {
    return EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(query, cancellationToken);
  }

  public Task<List<T>> ToListAsync<T>(IQueryable<T> query, CancellationToken cancellationToken = default)
  {
    return EntityFrameworkQueryableExtensions.ToListAsync(query, cancellationToken);
  }

  private void EnsureAuditLogIsInsertOnly()
  {
    var invalidAuditLogEntry = ChangeTracker
      .Entries<AuditLog>()
      .Any(entry => entry.State is EntityState.Modified or EntityState.Deleted);

    if (invalidAuditLogEntry)
    {
      throw new InvalidOperationException("AuditLog is insert-only and cannot be modified or deleted.");
    }
  }
}