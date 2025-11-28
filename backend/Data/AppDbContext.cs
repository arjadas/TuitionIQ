using Microsoft.EntityFrameworkCore;
using TuitionIQ.Models;

namespace TuitionIQ.Data;

/// <summary>
/// Database context - manages database connection and entity operations.
/// </summary>
public class AppDbContext : DbContext
{
  public AppDbContext(DbContextOptions<AppDbContext> options)
      : base(options) { }

  /// <summary>
  /// Students table.
  /// </summary>
  public DbSet<Student> Students { get; set; }

  /// <summary>
  /// Payment records table.
  /// </summary>
  public DbSet<PaymentRecord> PaymentRecords { get; set; }

  protected override void OnModelCreating(ModelBuilder modelBuilder)
  {
    base.OnModelCreating(modelBuilder);

    // Configure Student entity
    modelBuilder.Entity<Student>(entity =>
    {
      entity.HasIndex(e => e.Email).IsUnique();
    });

    modelBuilder.Entity<PaymentRecord>(entity =>
    {
      // Decimal precision - 18 digits total, 2 after decimal point
      entity.Property(p => p.Amount)
              .HasPrecision(18, 2);

      // Relationship: PaymentRecord → Student
      entity.HasOne(p => p.Student)
              .WithMany(s => s.PaymentRecords)
              .HasForeignKey(p => p.StudentId)
              .OnDelete(DeleteBehavior.Cascade);

      // Ensure one payment per student per billing period
      entity.HasIndex(p => new { p.StudentId, p.BillYear, p.BillMonth })
              .IsUnique();
    });
  }
}