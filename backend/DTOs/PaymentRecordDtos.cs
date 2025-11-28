using System.ComponentModel.DataAnnotations;

namespace TuitionIQ.DTOs;

/// <summary>
/// DTO for creating a new payment record.
/// </summary>
public record CreatePaymentRecordDto
{
  [Required]
  public int StudentId { get; init; }

  [Required]
  [Range(2020, 2100)]
  public int BillYear { get; init; }

  [Required]
  [Range(1, 12)]
  public int BillMonth { get; init; }

  [Required]
  [Range(0.01, 10000.00)]
  public decimal Amount { get; init; }

  [MaxLength(500)]
  public string? Notes { get; init; }
}

/// <summary>
/// DTO for updating payment status.
/// </summary>
public record UpdatePaymentStatusDto
{
  [Required]
  public bool IsPaid { get; init; }

  public DateTime? PaymentDate { get; init; }

  [MaxLength(500)]
  public string? Notes { get; init; }
}

/// <summary>
/// DTO for returning payment record data to clients.
/// </summary>
public record PaymentRecordDto
{
  public int Id { get; init; }
  public int StudentId { get; init; }
  public string StudentName { get; init; } = string.Empty;
  public int BillYear { get; init; }
  public int BillMonth { get; init; }
  public decimal Amount { get; init; }
  public bool IsPaid { get; init; }
  public DateTime? PaymentDate { get; init; }
  public string? Notes { get; init; }
}