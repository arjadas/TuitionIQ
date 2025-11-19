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

  }
}