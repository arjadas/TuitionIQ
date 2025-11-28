using System.ComponentModel.DataAnnotations;

namespace TuitionIQ.Models;

/// <summary>
/// Represents a student enrolled in the tuition system.
/// </summary>
public class Student
{
  [Key]
  public int Id { get; set; }

  [Required]
  [MaxLength(50)]
  public required string FirstName { get; set; }

  [Required]
  [MaxLength(50)]
  public required string LastName { get; set; }

  [Required]
  [EmailAddress]
  public required string Email { get; set; }

  public DateTime EnrollmentDate { get; set; } = DateTime.Now;

  /// <summary>
  /// Navigation property: One student has many payment records.
  /// </summary>
  public ICollection<PaymentRecord> PaymentRecords { get; set; } = new List<PaymentRecord>();
}