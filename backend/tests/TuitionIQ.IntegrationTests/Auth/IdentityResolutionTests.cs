using System.Net;
using System.Text;
using System.Text.Json;
using TuitionIQ.IntegrationTests.Fixtures;
using Xunit;

namespace TuitionIQ.IntegrationTests.Auth;

/// <summary>
/// Regression guard for the auth identity model. The JWT <c>sub</c> is the Supabase auth uid
/// (<c>auth.users.id</c>); the canonical identity is the internal <c>public.users.id</c>,
/// resolved via <c>auth_user_id == sub</c>. These tests deliberately use a user whose internal
/// id differs from its auth uid — the case that broke the original <c>users.id == sub</c> code.
/// </summary>
public sealed class IdentityResolutionTests
{
  [Fact]
  public async Task Me_ResolvesInternalUserId_WhenItDiffersFromAuthUid()
  {
    await using var factory = new TestWebApplicationFactory();

    var internalUserId = Guid.NewGuid();
    var authUid = Guid.NewGuid(); // JWT sub — deliberately != internal id
    Assert.NotEqual(internalUserId, authUid);

    await factory.SeedUserAsync(internalUserId, authUid, emailVerified: true, isActive: true);

    using var client = CreateClientAuthenticatedAs(factory, authUid);

    var meResponse = await client.GetAsync("/api/users/me");
    Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);

    var payload = await meResponse.Content.ReadAsStringAsync();
    using var json = JsonDocument.Parse(payload);
    var returnedId = json.RootElement.GetProperty("id").GetGuid();

    // The API must expose the internal public.users.id, never the auth uid from the JWT.
    Assert.Equal(internalUserId, returnedId);
    Assert.NotEqual(authUid, returnedId);
  }

  [Fact]
  public async Task OrgWrites_KeyOffInternalUserId_WhenItDiffersFromAuthUid()
  {
    await using var factory = new TestWebApplicationFactory();

    var internalUserId = Guid.NewGuid();
    var authUid = Guid.NewGuid();
    await factory.SeedUserAsync(internalUserId, authUid, emailVerified: true, isActive: true);

    using var client = CreateClientAuthenticatedAs(factory, authUid);

    var slugSuffix = Guid.NewGuid().ToString("N")[..8];
    var createResponse = await client.PostAsync("/api/organizations", JsonBody(new
    {
      name = "Identity Org",
      slug = $"identity-org-{slugSuffix}"
    }));
    Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);

    var createPayload = await createResponse.Content.ReadAsStringAsync();
    using var createJson = JsonDocument.Parse(createPayload);
    var organizationId = createJson.RootElement.GetProperty("id").GetGuid();

    // The owner membership was written with the internal id; the same caller (whose UserId
    // resolves to that internal id) must therefore see the org in their memberships.
    var membershipsResponse = await client.GetAsync("/api/organizations/memberships");
    Assert.Equal(HttpStatusCode.OK, membershipsResponse.StatusCode);

    var membershipsPayload = await membershipsResponse.Content.ReadAsStringAsync();
    Assert.Contains(organizationId.ToString(), membershipsPayload, StringComparison.OrdinalIgnoreCase);
  }

  private static HttpClient CreateClientAuthenticatedAs(TestWebApplicationFactory factory, Guid authUid)
  {
    var client = factory.CreateClient();
    client.DefaultRequestHeaders.Add(TestAuthHandler.UserIdHeaderName, authUid.ToString());
    return client;
  }

  private static StringContent JsonBody(object payload)
    => new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
}
