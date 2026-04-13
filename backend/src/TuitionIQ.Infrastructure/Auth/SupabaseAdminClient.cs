using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using TuitionIQ.Application.Common.Interfaces;

namespace TuitionIQ.Infrastructure.Auth;

public sealed class SupabaseAdminClient : ISupabaseAdminClient
{
  private readonly HttpClient _httpClient;
  private readonly string _serviceRoleKey;

  public SupabaseAdminClient(HttpClient httpClient, IConfiguration configuration)
  {
    _httpClient = httpClient;

    var projectRef = configuration["Supabase:ProjectRef"];
    if (string.IsNullOrWhiteSpace(projectRef))
    {
      throw new InvalidOperationException("Supabase:ProjectRef is not configured.");
    }

    var serviceRoleKey = configuration["Supabase:ServiceRoleKey"];
    if (string.IsNullOrWhiteSpace(serviceRoleKey))
    {
      throw new InvalidOperationException("Supabase:ServiceRoleKey is not configured.");
    }
    _serviceRoleKey = serviceRoleKey;

    var adminBaseUrl = configuration["Supabase:AdminUrl"];
    var baseUrl = string.IsNullOrWhiteSpace(adminBaseUrl)
      ? $"https://{projectRef}.supabase.co"
      : adminBaseUrl.Trim().TrimEnd('/');

    _httpClient.BaseAddress = new Uri($"{baseUrl}/auth/v1/");
    _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _serviceRoleKey);
    _httpClient.DefaultRequestHeaders.Remove("apikey");
    _httpClient.DefaultRequestHeaders.Add("apikey", _serviceRoleKey);
  }

  public async Task SignOutGlobalAsync(Guid userId, CancellationToken cancellationToken = default)
  {
    using var response = await _httpClient.PostAsJsonAsync(
      $"admin/users/{userId}/logout",
      new { scope = "global" },
      cancellationToken);

    await EnsureSuccessAsync(response, cancellationToken);
  }

  public Task BanUserAsync(Guid userId, string duration, CancellationToken cancellationToken = default)
  {
    return UpdateUserAsync(userId, new { ban_duration = duration }, cancellationToken);
  }

  public async Task UpdateUserAsync(Guid userId, object payload, CancellationToken cancellationToken = default)
  {
    using var request = new HttpRequestMessage(HttpMethod.Put, $"admin/users/{userId}")
    {
      Content = JsonContent.Create(payload)
    };

    using var response = await _httpClient.SendAsync(request, cancellationToken);
    await EnsureSuccessAsync(response, cancellationToken);
  }

  private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
  {
    if (response.IsSuccessStatusCode)
    {
      return;
    }

    var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
    var detail = string.IsNullOrWhiteSpace(responseBody)
      ? $"Supabase Admin API request failed with status {(int)response.StatusCode}."
      : $"Supabase Admin API request failed with status {(int)response.StatusCode}: {responseBody}";

    throw new InvalidOperationException(detail);
  }
}
