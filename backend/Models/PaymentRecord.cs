using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TuitionIQ.Models
{
  public class PaymentRecord
  {
    [Key]
    public int PaymentRecordId { get; set; }

    [Required]
    [ForeignKey("StudentId")]
    public int StudentId { get; set; }

    public required Student Student { get; set; }

    [Required]
    [Range(2020, 2100)]
    public int BillYear { get; set; }

    [Required]
    [Range(1, 12)]
    public int BillMonth { get; set; }

    [Required]
    [Range(0.01, 10000.00)]
    public decimal Amount { get; set; }

    public bool IsPaid { get; set; } = false;

    public DateTime? PaymentDate { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }
  }
}