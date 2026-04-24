using System.Net;
using System.Text;
using System.Text.Json;
using TuitionIQ.IntegrationTests.Fixtures;
using Xunit;

namespace TuitionIQ.IntegrationTests.Auth;

public sealed class EmailVerificationMiddlewareTests
{
  [Fact]
  public async Task UnverifiedUsers_Receive403_OnProtectedEndpoints_ExceptEmailVerification()
  {
    await using var factory = new TestWebApplicationFactory();

    var userId = Guid.NewGuid();
    await factory.SeedUserAsync(userId, emailVerified: false, isActive: true);

    using var client = CreateAuthenticatedClient(factory, userId);

    var orgId = Guid.NewGuid();
    var slugSuffix = Guid.NewGuid().ToString("N")[..8];

    var protectedResponses = new[]
    {
      await client.GetAsync("/api/users/me"),
      await client.PatchAsync("/api/users/profile", JsonBody(new
      {
        firstName = "Updated",
        lastName = "User",
        phone = "+8801000000000"
      })),
      await client.PostAsync("/api/organizations", JsonBody(new
      {
        name = "Integration Org",
        slug = $"integration-org-{slugSuffix}"
      })),
      await client.GetAsync($"/api/organizations/{orgId}"),
      await client.PatchAsync($"/api/organizations/{orgId}", JsonBody(new
      {
        name = "Updated Integration Org"
      })),
      await client.GetAsync("/api/organizations/memberships")
    };

    foreach (var response in protectedResponses)
    {
      Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
      var body = await response.Content.ReadAsStringAsync();
      Assert.Contains("EMAIL_NOT_VERIFIED", body, StringComparison.Ordinal);
    }

    var verifyEmailResponse = await client.PatchAsync("/api/users/email-verification", JsonBody(new { }));
    Assert.Equal(HttpStatusCode.OK, verifyEmailResponse.StatusCode);
  }

  [Fact]
  public async Task VerifiedUsers_PassThroughProtectedEndpointsNormally()
  {
    await using var factory = new TestWebApplicationFactory();

    var userId = Guid.NewGuid();
    await factory.SeedUserAsync(userId, emailVerified: true, isActive: true);

    using var client = CreateAuthenticatedClient(factory, userId);

    var meResponse = await client.GetAsync("/api/users/me");
    Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);

    var updateProfileResponse = await client.PatchAsync("/api/users/profile", JsonBody(new
    {
      firstName = "Updated",
      lastName = "User",
      phone = "+8801000000000"
    }));
    Assert.Equal(HttpStatusCode.OK, updateProfileResponse.StatusCode);

    var verifyEmailResponse = await client.PatchAsync("/api/users/email-verification", JsonBody(new { }));
    Assert.Equal(HttpStatusCode.OK, verifyEmailResponse.StatusCode);

    var slugSuffix = Guid.NewGuid().ToString("N")[..8];
    var createOrganizationResponse = await client.PostAsync("/api/organizations", JsonBody(new
    {
      name = "Integration Org",
      slug = $"integration-org-{slugSuffix}"
    }));
    Assert.Equal(HttpStatusCode.OK, createOrganizationResponse.StatusCode);

    var organizationPayload = await createOrganizationResponse.Content.ReadAsStringAsync();
    using var organizationJson = JsonDocument.Parse(organizationPayload);
    var organizationId = organizationJson.RootElement.GetProperty("id").GetGuid();

    var getOrganizationResponse = await client.GetAsync($"/api/organizations/{organizationId}");
    Assert.Equal(HttpStatusCode.OK, getOrganizationResponse.StatusCode);

    var updateOrganizationResponse = await client.PatchAsync($"/api/organizations/{organizationId}", JsonBody(new
    {
      name = "Updated Integration Org"
    }));
    Assert.Equal(HttpStatusCode.OK, updateOrganizationResponse.StatusCode);

    var membershipsResponse = await client.GetAsync("/api/organizations/memberships");
    Assert.Equal(HttpStatusCode.OK, membershipsResponse.StatusCode);
  }

  private static HttpClient CreateAuthenticatedClient(TestWebApplicationFactory factory, Guid userId)
  {
    var client = factory.CreateClient();

    client.DefaultRequestHeaders.Add(TestAuthHandler.UserIdHeaderName, userId.ToString());

    return client;
  }

  private static StringContent JsonBody(object payload)
  {
    return new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
  }
}
