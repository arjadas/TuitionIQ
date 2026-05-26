using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace TuitionIQ.Infrastructure.Persistence;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
  public AppDbContext CreateDbContext(string[] args)
  {
    var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
    var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
      ?? "postgresql://postgres.dgkuruokjwaedygwziee:devsareworking%40night@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";

    optionsBuilder.UseNpgsql(connectionString);

    return new AppDbContext(optionsBuilder.Options);
  }
}