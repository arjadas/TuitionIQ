using System;
using System.ComponentModel.DataAnnotations;

namespace TuitionIQ.DTOs
{
  // For creating a new payment
  public class CreatePaymentRecordDto
  {
    [Required]
    public int StudentId { get; set; }

    [Required]
    [Range(2020, 2100)]
    public int BillYear { get; set; }

    [Required]
    [Range(1, 12)]
    public int BillMonth { get; set; }

    [Required]
    [Range(0.01, 10000.00)]
    public decimal Amount { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }
  }

  // For updating payment status
  public class UpdatePaymentStatusDto
  {
    [Required]
    public bool IsPaid { get; set; }

    public DateTime? PaymentDate { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }
  }

  // For returning payment data
  public class PaymentRecordDto
  {
    public int PaymentRecordId { get; set; }
    public int StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public int BillYear { get; set; }
    public int BillMonth { get; set; }
    public decimal Amount { get; set; }
    public bool IsPaid { get; set; }
    public DateTime? PaymentDate { get; set; }
    public string? Notes { get; set; }
  }
}