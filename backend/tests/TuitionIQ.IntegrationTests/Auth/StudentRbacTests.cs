using System.Net;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;
using TuitionIQ.Infrastructure.Persistence;
using TuitionIQ.IntegrationTests.Fixtures;
using Xunit;

namespace TuitionIQ.IntegrationTests.Auth;

public sealed class StudentRbacTests
{
  [Fact]
  public async Task StudentRole_CannotListStudents()
  {
    await using var factory = new TestWebApplicationFactory();

    var userId = Guid.NewGuid();
    await factory.SeedUserAsync(userId, emailVerified: true, isActive: true);

    var organizationId = Guid.NewGuid();
    await SeedOrganizationWithMembershipAndStudentsAsync(
      factory,
      organizationId,
      userId,
      OrganizationMemberRole.Student,
      assignTeacherLink: false);

    using var client = CreateAuthenticatedClient(factory, userId);

    var response = await client.GetAsync($"/api/organizations/{organizationId}/students");

    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
  }

  [Fact]
  public async Task OwnerRole_CanListAllStudents()
  {
    await using var factory = new TestWebApplicationFactory();

    var userId = Guid.NewGuid();
    await factory.SeedUserAsync(userId, emailVerified: true, isActive: true);

    var organizationId = Guid.NewGuid();
    var (firstStudentId, secondStudentId) = await SeedOrganizationWithMembershipAndStudentsAsync(
      factory,
      organizationId,
      userId,
      OrganizationMemberRole.Owner,
      assignTeacherLink: false);

    using var client = CreateAuthenticatedClient(factory, userId);

    var response = await client.GetAsync($"/api/organizations/{organizationId}/students");

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);

    var payload = await response.Content.ReadAsStringAsync();
    using var json = JsonDocument.Parse(payload);

    var items = json.RootElement.GetProperty("items").EnumerateArray().ToList();
    Assert.Equal(2, items.Count);

    var returnedIds = items.Select(item => item.GetProperty("id").GetGuid()).ToHashSet();
    Assert.Contains(firstStudentId, returnedIds);
    Assert.Contains(secondStudentId, returnedIds);
  }

  [Fact]
  public async Task TeacherRole_SeesOnlyAssignedStudents_InListAndDetail()
  {
    await using var factory = new TestWebApplicationFactory();

    var userId = Guid.NewGuid();
    await factory.SeedUserAsync(userId, emailVerified: true, isActive: true);

    var organizationId = Guid.NewGuid();
    var (assignedStudentId, unassignedStudentId) = await SeedOrganizationWithMembershipAndStudentsAsync(
      factory,
      organizationId,
      userId,
      OrganizationMemberRole.Teacher,
      assignTeacherLink: true);

    using var client = CreateAuthenticatedClient(factory, userId);

    var listResponse = await client.GetAsync($"/api/organizations/{organizationId}/students");
    Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

    var listPayload = await listResponse.Content.ReadAsStringAsync();
    using var listJson = JsonDocument.Parse(listPayload);

    var listItems = listJson.RootElement.GetProperty("items").EnumerateArray().ToList();
    Assert.Single(listItems);
    Assert.Equal(assignedStudentId, listItems[0].GetProperty("id").GetGuid());

    var assignedResponse = await client.GetAsync($"/api/organizations/{organizationId}/students/{assignedStudentId}");
    Assert.Equal(HttpStatusCode.OK, assignedResponse.StatusCode);

    var unassignedResponse = await client.GetAsync($"/api/organizations/{organizationId}/students/{unassignedStudentId}");
    Assert.Equal(HttpStatusCode.Forbidden, unassignedResponse.StatusCode);
  }

  private static HttpClient CreateAuthenticatedClient(TestWebApplicationFactory factory, Guid userId)
  {
    var client = factory.CreateClient();
    client.DefaultRequestHeaders.Add(TestAuthHandler.UserIdHeaderName, userId.ToString());
    return client;
  }

  private static async Task<(Guid FirstStudentId, Guid SecondStudentId)> SeedOrganizationWithMembershipAndStudentsAsync(
    TestWebApplicationFactory factory,
    Guid organizationId,
    Guid userId,
    OrganizationMemberRole role,
    bool assignTeacherLink)
  {
    using var scope = factory.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    var now = DateTimeOffset.UtcNow;
    var firstStudentId = Guid.NewGuid();
    var secondStudentId = Guid.NewGuid();

    dbContext.Organizations.Add(new Organization
    {
      Id = organizationId,
      Name = $"Org-{organizationId:N}"[..12],
      Slug = $"org-{organizationId:N}"[..16],
      OwnerId = userId,
      Plan = "free",
      Settings = new Dictionary<string, object?>(),
      CreatedAt = now,
      UpdatedAt = now
    });

    dbContext.OrganizationMembers.Add(new OrganizationMember
    {
      Id = Guid.NewGuid(),
      OrganizationId = organizationId,
      UserId = userId,
      Role = role,
      JoinedAt = now,
      CreatedAt = now,
      UpdatedAt = now
    });

    dbContext.Students.Add(new Student
    {
      Id = firstStudentId,
      OrganizationId = organizationId,
      FirstName = "First",
      LastName = "Student",
      Status = StudentStatus.Active,
      AccountStatus = StudentAccountStatus.NoAccount,
      Metadata = new Dictionary<string, object?>(),
      CreatedAt = now,
      UpdatedAt = now
    });

    dbContext.Students.Add(new Student
    {
      Id = secondStudentId,
      OrganizationId = organizationId,
      FirstName = "Second",
      LastName = "Student",
      Status = StudentStatus.Active,
      AccountStatus = StudentAccountStatus.NoAccount,
      Metadata = new Dictionary<string, object?>(),
      CreatedAt = now,
      UpdatedAt = now
    });

    if (assignTeacherLink)
    {
      dbContext.TeacherStudents.Add(new TeacherStudent
      {
        Id = Guid.NewGuid(),
        OrganizationId = organizationId,
        TeacherId = userId,
        StudentId = firstStudentId,
        AssignedAt = now,
        AssignedBy = userId,
        IsPrimary = true,
        CreatedAt = now,
        UpdatedAt = now
      });
    }

    await dbContext.SaveChangesAsync();

    return (firstStudentId, secondStudentId);
  }
}
