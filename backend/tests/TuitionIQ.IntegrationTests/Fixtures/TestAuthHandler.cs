using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace TuitionIQ.IntegrationTests.Fixtures;

public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
  public const string SchemeName = "Test";
  public const string UserIdHeaderName = "X-Test-UserId";

  public TestAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : base(options, logger, encoder)
  {
  }

  protected override Task<AuthenticateResult> HandleAuthenticateAsync()
  {
    if (!Request.Headers.TryGetValue(UserIdHeaderName, out var values)
        || !Guid.TryParse(values.ToString(), out var userId))
    {
      return Task.FromResult(AuthenticateResult.Fail("Missing or invalid X-Test-UserId header."));
    }

    var claims = new[]
    {
      new Claim("sub", userId.ToString())
    };

    var identity = new ClaimsIdentity(claims, SchemeName);
    var principal = new ClaimsPrincipal(identity);
    var ticket = new AuthenticationTicket(principal, SchemeName);

    return Task.FromResult(AuthenticateResult.Success(ticket));
  }
}
