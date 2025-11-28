using System.ComponentModel.DataAnnotations;

namespace TuitionIQ.DTOs;

/// <summary>
/// DTO for creating a new student.
/// Uses record syntax for immutability and concise definition.
/// </summary>
public record CreateStudentDto
{
  [Required]
  [MaxLength(50)]
  public required string FirstName { get; init; }

  [Required]
  [MaxLength(50)]
  public required string LastName { get; init; }

  [Required]
  [EmailAddress]
  public required string Email { get; init; }
}

/// <summary>
/// DTO for updating student information.
/// </summary>
public record UpdateStudentDto
{
  [Required]
  [MaxLength(50)]
  public required string FirstName { get; init; }

  [Required]
  [MaxLength(50)]
  public required string LastName { get; init; }

  [Required]
  [EmailAddress]
  public required string Email { get; init; }

  public DateTime? EnrollmentDate { get; init; }
}

/// <summary>
/// DTO for returning student data to clients.
/// </summary>
public record StudentDto
{
  public int Id { get; init; }
  public string FirstName { get; init; } = string.Empty;
  public string LastName { get; init; } = string.Empty;
  public string Email { get; init; } = string.Empty;
  public DateTime EnrollmentDate { get; init; }
}