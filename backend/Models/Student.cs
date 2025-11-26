using System.ComponentModel.DataAnnotations;

namespace TuitionIQ.Models
{
  public class Student
  {
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public required string FirstName { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public required string LastName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public required string Email { get; set; } = string.Empty;

    public DateTime EnrollmentDate { get; set; } = DateTime.Now;

    // one student has many payment records
    public ICollection<PaymentRecord> Payments { get; set; } = new List<PaymentRecord>();
  }
}