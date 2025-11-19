namespace TuitionIQ.Models
{

  public enum PaymentStatus
  {
    Unpaid = 0,
    Paid = 1,
    Pending = 2
  }

  public class PaymentRecord
  {
    [Key]
    public int PaymentRecordId { get; set; }

    [Required]
    [ForeignKey("StudentId")]
    public int StudentId { get; set; }

    public Student Student { get; set; }

    [Required]
    public decimal Amount { get; set; }

    [Required]
    public DateTime PaymentDate { get; set; }

    public string RecordedBy { get; set; }
  }
}