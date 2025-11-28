using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TuitionIQ.Data;
using TuitionIQ.DTOs;
using TuitionIQ.Extensions;
using TuitionIQ.Models;

namespace TuitionIQ.Controllers;

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
        .OrderByDescending(p => p.BillYear)
        .ThenByDescending(p => p.BillMonth)
        .Select(p => p.ToDto())
        .ToListAsync();

    return Ok(paymentRecords);
  }

  // GET: api/paymentrecords/{id}
  [HttpGet("{id}")]
  public async Task<ActionResult<PaymentRecordDto>> GetPaymentRecord(int id)
  {
    var paymentRecord = await _context.PaymentRecords
        .Include(p => p.Student)
        .FirstOrDefaultAsync(p => p.Id == id);

    if (paymentRecord == null)
    {
      return NotFound(new { message = "Payment record not found" });
    }

    return Ok(paymentRecord.ToDto());
  }

  // GET: api/paymentrecords/student/{studentId}
  [HttpGet("student/{studentId}")]
  public async Task<ActionResult<IEnumerable<PaymentRecordDto>>> GetPaymentRecordsByStudent(int studentId)
  {
    var paymentRecords = await _context.PaymentRecords
        .Include(p => p.Student)
        .Where(p => p.StudentId == studentId)
        .OrderByDescending(p => p.BillYear)
        .ThenByDescending(p => p.BillMonth)
        .Select(p => p.ToDto())
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

    var paymentRecord = dto.ToEntity(student);

    _context.PaymentRecords.Add(paymentRecord);
    await _context.SaveChangesAsync();

    return CreatedAtAction(nameof(GetPaymentRecord), new { id = paymentRecord.Id }, paymentRecord.ToDto());
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

    paymentRecord.UpdateStatusFrom(dto);
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
