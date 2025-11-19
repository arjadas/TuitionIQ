using System.ComponentModel.DataAnnotations;

namespace TuitionIQ.Models
{
  public class Student
  {
    [Key]
    public int StudentId { get; set; }

    [Required]
    [MaxLength(50)]
    public required string FirstName { get; set; }

    [Required]
    [MaxLength(50)]
    public required string LastName { get; set; }

    [EmailAddress]
    public required string Email { get; set; }

    public ICollection<PaymentRecord> Payments { get; set; } = new List<PaymentRecord>();
  }
}