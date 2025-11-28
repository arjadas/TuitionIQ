using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TuitionIQ.Data;
using TuitionIQ.DTOs;
using TuitionIQ.Models;

namespace TuitionIQ.Controllers
{
  [ApiController]
  [Route("api/[controller]")]
  public class PaymentRecordsController : ControllerBase
  {
    private readonly AppDbContext _context;

    public PaymentRecordsController(AppDbContext context)
    {
      _context = context;
    }

    // GET: api/paymentrecords
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PaymentRecordDto>>> GetPaymentRecords()
    {
      var paymentRecords = await _context.PaymentRecords
          .Include(p => p.Student)
          .Select(p => new PaymentRecordDto
          {
            Id = p.Id,
            StudentId = p.StudentId,
            StudentName = $"{p.Student.FirstName} {p.Student.LastName}",
            BillYear = p.BillYear,
            BillMonth = p.BillMonth,
            Amount = p.Amount,
            IsPaid = p.IsPaid,
            PaymentDate = p.PaymentDate,
            Notes = p.Notes
          })
          .OrderByDescending(p => p.BillYear)
          .ThenByDescending(p => p.BillMonth)
          .ToListAsync();

      return Ok(paymentRecords);
    }

    // GET: api/paymentrecords/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<PaymentRecordDto>> GetPaymentRecord(int id)
    {
      var paymentRecord = await _context.PaymentRecords
          .Include(p => p.Student)
          .Where(p => p.Id == id)
          .Select(p => new PaymentRecordDto
          {
            Id = p.Id,
            StudentId = p.StudentId,
            StudentName = $"{p.Student.FirstName} {p.Student.LastName}",
            BillYear = p.BillYear,
            BillMonth = p.BillMonth,
            Amount = p.Amount,
            IsPaid = p.IsPaid,
            PaymentDate = p.PaymentDate,
            Notes = p.Notes
          })
          .FirstOrDefaultAsync();

      if (paymentRecord == null)
      {
        return NotFound(new { message = "Payment record not found" });
      }

      return Ok(paymentRecord);
    }

    // GET: api/paymentrecords/student/{studentId}
    [HttpGet("student/{studentId}")]
    public async Task<ActionResult<IEnumerable<PaymentRecordDto>>> GetPaymentRecordsByStudent(int studentId)
    {
      var paymentRecords = await _context.PaymentRecords
          .Include(p => p.Student)
          .Where(p => p.StudentId == studentId)
          .Select(p => new PaymentRecordDto
          {
            Id = p.Id,
            StudentId = p.StudentId,
            StudentName = $"{p.Student.FirstName} {p.Student.LastName}",
            BillYear = p.BillYear,
            BillMonth = p.BillMonth,
            Amount = p.Amount,
            IsPaid = p.IsPaid,
            PaymentDate = p.PaymentDate,
            Notes = p.Notes
          })
          .OrderByDescending(p => p.BillYear)
          .ThenByDescending(p => p.BillMonth)
          .ToListAsync();

      return Ok(paymentRecords);
    }

    // POST: api/paymentrecords
    [HttpPost]
    public async Task<ActionResult<PaymentRecordDto>> CreatePaymentRecord(CreatePaymentRecordDto dto)
    {
      // Verify student exists
      var student = await _context.Students.FindAsync(dto.StudentId);
      if (student == null)
      {
        return BadRequest(new { message = "Student not found" });
      }

      // Check if payment record already exists for this student/month/year
      if (await _context.PaymentRecords.AnyAsync(p =>
          p.StudentId == dto.StudentId &&
          p.BillYear == dto.BillYear &&
          p.BillMonth == dto.BillMonth))
      {
        return BadRequest(new { message = "A payment record already exists for this student and billing period" });
      }

      var paymentRecord = new PaymentRecord
      {
        StudentId = dto.StudentId,
        BillYear = dto.BillYear,
        BillMonth = dto.BillMonth,
        Amount = dto.Amount,
        IsPaid = false,
        PaymentDate = null,
        Notes = dto.Notes,
        Student = student
      };

      _context.PaymentRecords.Add(paymentRecord);
      await _context.SaveChangesAsync();

      var paymentRecordDto = new PaymentRecordDto
      {
        Id = paymentRecord.Id,
        StudentId = paymentRecord.StudentId,
        StudentName = $"{student.FirstName} {student.LastName}",
        BillYear = paymentRecord.BillYear,
        BillMonth = paymentRecord.BillMonth,
        Amount = paymentRecord.Amount,
        IsPaid = paymentRecord.IsPaid,
        PaymentDate = paymentRecord.PaymentDate,
        Notes = paymentRecord.Notes
      };

      return CreatedAtAction(nameof(GetPaymentRecord), new { id = paymentRecord.Id }, paymentRecordDto);
    }

    // PUT: api/paymentrecords/{id}/status
    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdatePaymentStatus(int id, UpdatePaymentStatusDto dto)
    {
      var paymentRecord = await _context.PaymentRecords.FindAsync(id);

      if (paymentRecord == null)
      {
        return NotFound(new { message = "Payment record not found" });
      }

      paymentRecord.IsPaid = dto.IsPaid;
      paymentRecord.PaymentDate = dto.IsPaid ? (dto.PaymentDate ?? DateTime.Now) : null;

      if (!string.IsNullOrEmpty(dto.Notes))
      {
        paymentRecord.Notes = dto.Notes;
      }

      await _context.SaveChangesAsync();

      return NoContent();
    }

    // DELETE: api/paymentrecords/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePaymentRecord(int id)
    {
      var paymentRecord = await _context.PaymentRecords.FindAsync(id);

      if (paymentRecord == null)
      {
        return NotFound(new { message = "Payment record not found" });
      }

      _context.PaymentRecords.Remove(paymentRecord);
      await _context.SaveChangesAsync();

      return NoContent();
    }
  }
}
