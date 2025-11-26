using Microsoft.EntityFrameworkCore;
using TuitionIQ.Models;

namespace TuitionIQ.Data
{
  public class AppDbContext : DbContext
  {
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options) { }

    public DbSet<Student> Students { get; set; }
    public DbSet<PaymentRecord> PaymentRecords { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
      // Configure decimal precision for Amount property
      modelBuilder.Entity<PaymentRecord>()
        .Property(p => p.Amount)
        .HasPrecision(18, 2); // 18 digits total, 2 after decimal point

      // Configure relationships
      modelBuilder.Entity<PaymentRecord>()
        .HasOne(p => p.Student)
        .WithMany(s => s.Payments)
        .HasForeignKey(p => p.StudentId)
        .OnDelete(DeleteBehavior.Cascade);

      base.OnModelCreating(modelBuilder);
    }
  }
}