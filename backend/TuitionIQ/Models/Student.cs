namespace TuitionIQ.Models
{
  public class Student
  {
    [Key]
    public int StudentId { get; set; }

    [Required]
    [MaxLength(50)]
    public string FirstName { get; set; }

    [Required]
    [MaxLength(50)]
    public string LastName { get; set; }

    [EmailAddress]
    public string Email { get; set; }

    public ICollection<PaymentRecord> Payments { get; set; }
  }
}