using TuitionIQ.DTOs;
using TuitionIQ.Models;

namespace TuitionIQ.Extensions;

/// <summary>
/// Extension methods for mapping between entities and DTOs.
/// Centralizes mapping logic to avoid repetition in controllers.
/// </summary>
public static class MappingExtensions
{
  /// <summary>
  /// Maps a Student entity to a StudentDto.
  /// </summary>
  public static StudentDto ToDto(this Student student) => new()
  {
    Id = student.Id,
    FirstName = student.FirstName,
    LastName = student.LastName,
    Email = student.Email,
    EnrollmentDate = student.EnrollmentDate
  };

  /// <summary>
  /// Maps a CreateStudentDto to a new Student entity.
  /// </summary>
  public static Student ToEntity(this CreateStudentDto dto) => new()
  {
    FirstName = dto.FirstName,
    LastName = dto.LastName,
    Email = dto.Email,
    EnrollmentDate = DateTime.Now
  };

  /// <summary>
  /// Updates an existing Student entity with data from UpdateStudentDto.
  /// </summary>
  public static void UpdateFrom(this Student student, UpdateStudentDto dto)
  {
    student.FirstName = dto.FirstName;
    student.LastName = dto.LastName;
    student.Email = dto.Email;

    if (dto.EnrollmentDate.HasValue)
    {
      student.EnrollmentDate = dto.EnrollmentDate.Value;
    }
  }

  /// <summary>
  /// Maps a PaymentRecord entity to a PaymentRecordDto.
  /// </summary>
  public static PaymentRecordDto ToDto(this PaymentRecord paymentRecord) => new()
  {
    Id = paymentRecord.Id,
    StudentId = paymentRecord.StudentId,
    StudentName = $"{paymentRecord.Student.FirstName} {paymentRecord.Student.LastName}",
    BillYear = paymentRecord.BillYear,
    BillMonth = paymentRecord.BillMonth,
    Amount = paymentRecord.Amount,
    IsPaid = paymentRecord.IsPaid,
    PaymentDate = paymentRecord.PaymentDate,
    Notes = paymentRecord.Notes
  };

  /// <summary>
  /// Maps a CreatePaymentRecordDto to a new PaymentRecord entity.
  /// </summary>
  public static PaymentRecord ToEntity(this CreatePaymentRecordDto dto, Student student) => new()
  {
    StudentId = dto.StudentId,
    Student = student,
    BillYear = dto.BillYear,
    BillMonth = dto.BillMonth,
    Amount = dto.Amount,
    IsPaid = false,
    PaymentDate = null,
    Notes = dto.Notes
  };

  /// <summary>
  /// Updates payment status from UpdatePaymentStatusDto.
  /// </summary>
  public static void UpdateStatusFrom(this PaymentRecord paymentRecord, UpdatePaymentStatusDto dto)
  {
    paymentRecord.IsPaid = dto.IsPaid;
    paymentRecord.PaymentDate = dto.IsPaid ? (dto.PaymentDate ?? DateTime.Now) : null;

    if (!string.IsNullOrEmpty(dto.Notes))
    {
      paymentRecord.Notes = dto.Notes;
    }
  }
}
