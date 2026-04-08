using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace TuitionIQ.IntegrationTests.Fixtures;

public static class JwtTokenFactory
{
  public static string CreateToken(Guid userId, string projectRef, string jwtSecret)
  {
    var now = DateTime.UtcNow;
    var claims = new[]
    {
      new Claim("sub", userId.ToString())
    };

    var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
    var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

    var token = new JwtSecurityToken(
      issuer: $"https://{projectRef}.supabase.co/auth/v1",
      audience: "authenticated",
      claims: claims,
      notBefore: now.AddMinutes(-1),
      expires: now.AddHours(1),
      signingCredentials: credentials);

    return new JwtSecurityTokenHandler().WriteToken(token);
  }
}
