using Microsoft.EntityFrameworkCore;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Infrastructure.Persistence;

public class AppDbContext : DbContext
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

  public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
  {
    EnsureAuditLogIsInsertOnly();
    return base.SaveChangesAsync(cancellationToken);
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