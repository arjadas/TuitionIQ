using FluentValidation;
using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Students.Dtos;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Students.Commands;

public sealed record UpdateStudentCommand(
  Guid OrganizationId,
  Guid StudentId,
  Guid UserId,
  string? FirstName,
  string? LastName,
  string? Email,
  string? Phone,
  string? Notes,
  Dictionary<string, object?>? Metadata) : IRequest<StudentDto>;

public sealed class UpdateStudentCommandValidator : AbstractValidator<UpdateStudentCommand>
{
  public UpdateStudentCommandValidator()
  {
    RuleFor(command => command.FirstName)
      .MaximumLength(100)
      .When(command => command.FirstName is not null);

    RuleFor(command => command.FirstName)
      .Must(firstName => !string.IsNullOrWhiteSpace(firstName))
      .WithMessage("FirstName cannot be empty.")
      .When(command => command.FirstName is not null);

    RuleFor(command => command.LastName)
      .MaximumLength(100)
      .When(command => command.LastName is not null);

    RuleFor(command => command.LastName)
      .Must(lastName => !string.IsNullOrWhiteSpace(lastName))
      .WithMessage("LastName cannot be empty.")
      .When(command => command.LastName is not null);

    RuleFor(command => command.Email)
      .MaximumLength(255)
      .EmailAddress()
      .When(command => !string.IsNullOrWhiteSpace(command.Email));

    RuleFor(command => command.Phone)
      .MaximumLength(30)
      .When(command => !string.IsNullOrWhiteSpace(command.Phone));

    RuleFor(command => command)
      .Must(command =>
        command.FirstName is not null
        || command.LastName is not null
        || command.Email is not null
        || command.Phone is not null
        || command.Notes is not null
        || command.Metadata is not null)
      .WithMessage("At least one update field must be provided.");
  }
}

public sealed class UpdateStudentCommandHandler : IRequestHandler<UpdateStudentCommand, StudentDto>
{
  private readonly IAppDbContext _dbContext;
  private readonly IAuditLogService _auditLogService;

  public UpdateStudentCommandHandler(IAppDbContext dbContext, IAuditLogService auditLogService)
  {
    _dbContext = dbContext;
    _auditLogService = auditLogService;
  }

  public async Task<StudentDto> Handle(UpdateStudentCommand request, CancellationToken cancellationToken)
  {
    IQueryable<OrganizationMemberRole?> callerRoleQuery = _dbContext.OrganizationMembers
      .Where(membership => membership.OrganizationId == request.OrganizationId && membership.UserId == request.UserId)
      .Select(membership => (OrganizationMemberRole?)membership.Role);

    var callerRole = await _dbContext.FirstOrDefaultAsync(callerRoleQuery, cancellationToken);
    if (callerRole is null)
    {
      throw new ForbiddenException("You are not allowed to update this student.");
    }

    if (callerRole is not OrganizationMemberRole.Owner
        and not OrganizationMemberRole.Admin
        and not OrganizationMemberRole.Teacher)
    {
      throw new ForbiddenException("You are not allowed to update this student.");
    }

    if (callerRole == OrganizationMemberRole.Teacher)
    {
      IQueryable<Guid> teacherStudentLinkQuery = _dbContext.TeacherStudents
        .Where(link =>
          link.OrganizationId == request.OrganizationId
          && link.TeacherId == request.UserId
          && link.StudentId == request.StudentId)
        .Select(link => link.Id);

      var teacherStudentLinkId = await _dbContext.FirstOrDefaultAsync(teacherStudentLinkQuery, cancellationToken);
      if (teacherStudentLinkId == Guid.Empty)
      {
        throw new ForbiddenException("You are not allowed to update this student.");
      }
    }

    await using var transaction = await _dbContext.BeginTransactionAsync(cancellationToken);
    try
    {
      IQueryable<Student> studentQuery = _dbContext.Students
        .Where(student => student.OrganizationId == request.OrganizationId && student.Id == request.StudentId);

      var student = await _dbContext.FirstOrDefaultAsync(studentQuery, cancellationToken);
      if (student is null)
      {
        throw new NotFoundException($"Student with id '{request.StudentId}' was not found.");
      }

      var oldValues = new Dictionary<string, object?>();
      var newValues = new Dictionary<string, object?>();

      if (request.FirstName is not null)
      {
        var normalizedFirstName = request.FirstName.Trim();
        oldValues["first_name"] = student.FirstName;
        newValues["first_name"] = normalizedFirstName;
        student.FirstName = normalizedFirstName;
      }

      if (request.LastName is not null)
      {
        var normalizedLastName = request.LastName.Trim();
        oldValues["last_name"] = student.LastName;
        newValues["last_name"] = normalizedLastName;
        student.LastName = normalizedLastName;
      }

      if (request.Email is not null)
      {
        var normalizedEmail = NormalizeOptionalString(request.Email);
        oldValues["email"] = student.Email;
        newValues["email"] = normalizedEmail;
        student.Email = normalizedEmail;
      }

      if (request.Phone is not null)
      {
        var normalizedPhone = NormalizeOptionalString(request.Phone);
        oldValues["phone"] = student.Phone;
        newValues["phone"] = normalizedPhone;
        student.Phone = normalizedPhone;
      }

      if (request.Notes is not null)
      {
        var normalizedNotes = NormalizeOptionalString(request.Notes);
        oldValues["notes"] = student.Notes;
        newValues["notes"] = normalizedNotes;
        student.Notes = normalizedNotes;
      }

      if (request.Metadata is not null)
      {
        var updatedMetadata = new Dictionary<string, object?>(request.Metadata);
        oldValues["metadata"] = student.Metadata;
        newValues["metadata"] = updatedMetadata;
        student.Metadata = updatedMetadata;
      }

      var now = DateTimeOffset.UtcNow;
      student.UpdatedAt = now;

      _auditLogService.Add(new AuditLog(Guid.NewGuid(), "student.updated", "students", now)
      {
        OrganizationId = request.OrganizationId,
        ActorId = request.UserId,
        EntityId = student.Id,
        OldValues = oldValues,
        NewValues = newValues
      });

      await _dbContext.SaveChangesAsync(cancellationToken);
      await transaction.CommitAsync(cancellationToken);

      return ToStudentDto(student);
    }
    catch
    {
      await transaction.RollbackAsync(cancellationToken);
      throw;
    }
  }

  private static StudentDto ToStudentDto(Student student)
  {
    return new StudentDto
    {
      Id = student.Id,
      OrganizationId = student.OrganizationId,
      UserId = student.UserId,
      FirstName = student.FirstName,
      LastName = student.LastName,
      Email = student.Email,
      Phone = student.Phone,
      Notes = student.Notes,
      Status = student.Status.ToString(),
      AccountStatus = student.AccountStatus.ToString(),
      Metadata = student.Metadata,
      CreatedAt = student.CreatedAt,
      UpdatedAt = student.UpdatedAt
    };
  }

  private static string? NormalizeOptionalString(string? value)
  {
    return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
  }
}
