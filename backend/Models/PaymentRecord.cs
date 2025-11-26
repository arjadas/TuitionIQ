using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

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

    public required Student Student { get; set; }

    [Required]
    public required decimal Amount { get; set; }

    [Required]
    public required DateTime PaymentDate { get; set; }

    public required string RecordedBy { get; set; }
  }
}