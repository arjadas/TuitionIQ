namespace TuitionIQ.Domain.Entities;

public class User
{
  public Guid Id { get; set; }
  public string AuthUserId { get; set; } = string.Empty;
  public string Email { get; set; } = string.Empty;
  public string FirstName { get; set; } = string.Empty;
  public string LastName { get; set; } = string.Empty;
  public string? Phone { get; set; }
  public string? AvatarUrl { get; set; }
  public bool EmailVerified { get; set; }
  public bool IsActive { get; set; }
  public DateTimeOffset CreatedAt { get; set; }
  public DateTimeOffset UpdatedAt { get; set; }
  public DateTimeOffset? DeletedAt { get; set; }
}