using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TuitionIQ.IntegrationTests.Fixtures;
using Xunit;

namespace TuitionIQ.IntegrationTests.JsonbWriteRegression;

/// <summary>
/// Regression guard for the Npgsql 8+ dynamic-JSON requirement. Every write path persists a
/// <c>Dictionary&lt;string, object?&gt;</c> to a jsonb column (<c>organizations.settings</c>,
/// <c>students.metadata</c>, <c>audit_logs.old_values/new_values</c>). Without
/// <c>EnableDynamicJson()</c> on the production <c>NpgsqlDataSource</c> these throw
/// <c>InvalidCastException</c>. These tests run the PRODUCTION <c>AppDbContext</c> against real
/// PostgreSQL, so they fail if that opt-in is removed — the InMemory harness cannot catch it.
/// </summary>
public sealed class JsonbWriteRegressionTests : IClassFixture<PostgresWebApplicationFactory>
{
  private readonly PostgresWebApplicationFactory _factory;

  public JsonbWriteRegressionTests(PostgresWebApplicationFactory factory)
  {
    _factory = factory;
  }

  [Fact]
  public async Task CreateOrganization_PersistsOrgMembershipAndAuditLog_AgainstPostgres()
  {
    var userId = Guid.NewGuid();
    await _factory.SeedUserAsync(userId);
    using var client = CreateClientAuthenticatedAs(userId);

    var slug = $"jsonb-org-{Guid.NewGuid():N}"[..20];
    var response = await client.PostAsJsonAsync("/api/organizations", new { name = "JSONB Org", slug });

    // A 200 here already proves SaveChangesAsync wrote organizations.settings ('{}') and
    // audit_logs.new_values (a populated dictionary) to jsonb without an InvalidCastException.
    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    var organizationId = json.RootElement.GetProperty("id").GetGuid();

    // organizations.settings ('{}'::jsonb) round-trips back as an empty dictionary.
    var organization = await _factory.QueryAsync(db =>
      db.Organizations.AsNoTracking().SingleAsync(o => o.Id == organizationId));
    Assert.NotNull(organization.Settings);
    Assert.Empty(organization.Settings!);

    // Owner membership written in the same transaction.
    var ownerExists = await _factory.QueryAsync(db =>
      db.OrganizationMembers.AsNoTracking()
        .AnyAsync(m => m.OrganizationId == organizationId && m.UserId == userId));
    Assert.True(ownerExists);

    // audit_logs.new_values (jsonb dictionary) persisted and round-trips.
    var auditNewValues = await _factory.QueryAsync(db =>
      db.AuditLogs.AsNoTracking()
        .Where(a => a.EntityId == organizationId && a.Action == "organization.created")
        .Select(a => a.NewValues)
        .SingleAsync());
    Assert.NotNull(auditNewValues);
    Assert.True(auditNewValues!.ContainsKey("slug"));
  }

  [Fact]
  public async Task CreateStudent_PersistsMetadataAndAuditLog_AgainstPostgres()
  {
    var userId = Guid.NewGuid();
    await _factory.SeedUserAsync(userId);
    using var client = CreateClientAuthenticatedAs(userId);

    // Create the org first so the caller is its owner (authorized to add students).
    var slug = $"jsonb-stu-{Guid.NewGuid():N}"[..20];
    var orgResponse = await client.PostAsJsonAsync("/api/organizations", new { name = "Student Org", slug });
    Assert.Equal(HttpStatusCode.OK, orgResponse.StatusCode);
    using var orgJson = JsonDocument.Parse(await orgResponse.Content.ReadAsStringAsync());
    var organizationId = orgJson.RootElement.GetProperty("id").GetGuid();

    var response = await client.PostAsJsonAsync($"/api/organizations/{organizationId}/students", new
    {
      firstName = "Ada",
      lastName = "Lovelace",
      metadata = new Dictionary<string, object?> { ["year_group"] = "Year 10" }
    });

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    using var studentJson = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    var studentId = studentJson.RootElement.GetProperty("id").GetGuid();

    // students.metadata (jsonb dictionary) persisted and round-trips.
    var metadata = await _factory.QueryAsync(db =>
      db.Students.AsNoTracking().Where(s => s.Id == studentId).Select(s => s.Metadata).SingleAsync());
    Assert.NotNull(metadata);
    Assert.True(metadata!.ContainsKey("year_group"));

    // audit_logs.new_values persisted for the student.created action.
    var auditExists = await _factory.QueryAsync(db =>
      db.AuditLogs.AsNoTracking()
        .AnyAsync(a => a.EntityId == studentId && a.Action == "student.created" && a.NewValues != null));
    Assert.True(auditExists);
  }

  private HttpClient CreateClientAuthenticatedAs(Guid userId)
  {
    var client = _factory.CreateClient();
    client.DefaultRequestHeaders.Add(TestAuthHandler.UserIdHeaderName, userId.ToString());
    return client;
  }
}
