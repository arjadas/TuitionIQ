using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TuitionIQ.Data;
using TuitionIQ.DTOs;
using TuitionIQ.Extensions;
using TuitionIQ.Models;

namespace TuitionIQ.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StudentsController : ControllerBase
{
  private readonly AppDbContext _context;

  public StudentsController(AppDbContext context)
  {
    _context = context;
  }

  // GET: api/students
  [HttpGet]
  public async Task<ActionResult<IEnumerable<StudentDto>>> GetStudents()
  {
    var students = await _context.Students
        .Include(s => s.PaymentRecords)
        .Select(s => s.ToDto())
        .ToListAsync();

    return Ok(students);
  }

  // GET: api/students/{id}
  [HttpGet("{id}")]
  public async Task<ActionResult<StudentDto>> GetStudent(int id)
  {
    var student = await _context.Students
        .Include(s => s.PaymentRecords)
        .FirstOrDefaultAsync(s => s.Id == id);

    if (student == null)
    {
      return NotFound(new { message = "Student not found" });
    }

    return Ok(student.ToDto());
  }

  // POST: api/students
  [HttpPost]
  public async Task<ActionResult<StudentDto>> CreateStudent(CreateStudentDto dto)
  {
    // Check if email already exists
    if (await _context.Students.AnyAsync(s => s.Email == dto.Email))
    {
      return BadRequest(new { message = "A student with this email already exists" });
    }

    var student = dto.ToEntity();

    _context.Students.Add(student);
    await _context.SaveChangesAsync();

    return CreatedAtAction(nameof(GetStudent), new { id = student.Id }, student.ToDto());
  }

  // PUT: api/students/{id}
  [HttpPut("{id}")]
  public async Task<IActionResult> UpdateStudent(int id, UpdateStudentDto dto)
  {
    var student = await _context.Students.FindAsync(id);

    if (student == null)
    {
      return NotFound(new { message = "Student not found" });
    }

    // Check if email is being changed to one that already exists
    if (student.Email != dto.Email &&
        await _context.Students.AnyAsync(s => s.Email == dto.Email))
    {
      return BadRequest(new { message = "A student with this email already exists" });
    }

    student.UpdateFrom(dto);
    await _context.SaveChangesAsync();

    return NoContent();
  }

  // DELETE: api/students/{id}
  [HttpDelete("{id}")]
  public async Task<IActionResult> DeleteStudent(int id)
  {
    var student = await _context.Students.FindAsync(id);

    if (student == null)
    {
      return NotFound(new { message = "Student not found" });
    }

    _context.Students.Remove(student);
    await _context.SaveChangesAsync();

    return NoContent();
  }
}