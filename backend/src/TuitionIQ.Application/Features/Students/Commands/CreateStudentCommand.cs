using FluentValidation;
using MediatR;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Students.Dtos;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Students.Commands;

public sealed record CreateStudentCommand(
  Guid OrganizationId,
  Guid UserId,
  string FirstName,
  string LastName,
  string? Email,
  string? Phone,
  string? Notes,
  Dictionary<string, object?>? Metadata) : IRequest<StudentDto>;

public sealed class CreateStudentCommandValidator : AbstractValidator<CreateStudentCommand>
{
  public CreateStudentCommandValidator()
  {
    RuleFor(command => command.FirstName)
      .NotEmpty()
      .MaximumLength(100);

    RuleFor(command => command.LastName)
      .NotEmpty()
      .MaximumLength(100);

    RuleFor(command => command.Email)
      .MaximumLength(255)
      .EmailAddress()
      .When(command => !string.IsNullOrWhiteSpace(command.Email));
  }
}

public sealed class CreateStudentCommandHandler : IRequestHandler<CreateStudentCommand, StudentDto>
{
  private readonly IAppDbContext _dbContext;
  private readonly IAuditLogService _auditLogService;
  private readonly IOrganizationAuthorizationService _organizationAuthorizationService;

  public CreateStudentCommandHandler(
    IAppDbContext dbContext,
    IAuditLogService auditLogService,
    IOrganizationAuthorizationService organizationAuthorizationService)
  {
    _dbContext = dbContext;
    _auditLogService = auditLogService;
    _organizationAuthorizationService = organizationAuthorizationService;
  }

  public async Task<StudentDto> Handle(CreateStudentCommand request, CancellationToken cancellationToken)
  {
    var callerRole = await _organizationAuthorizationService.RequireTeacherOrHigherAsync(
      request.OrganizationId,
      request.UserId,
      "You are not allowed to create students in this organization.",
      cancellationToken);

    await using var transaction = await _dbContext.BeginTransactionAsync(cancellationToken);
    try
    {
      var now = DateTimeOffset.UtcNow;
      var student = new Student
      {
        Id = Guid.NewGuid(),
        OrganizationId = request.OrganizationId,
        UserId = null,
        FirstName = request.FirstName.Trim(),
        LastName = request.LastName.Trim(),
        Email = NormalizeOptionalString(request.Email),
        Phone = NormalizeOptionalString(request.Phone),
        Notes = NormalizeOptionalString(request.Notes),
        Status = StudentStatus.Active,
        AccountStatus = StudentAccountStatus.NoAccount,
        Metadata = request.Metadata is null
          ? new Dictionary<string, object?>()
          : new Dictionary<string, object?>(request.Metadata),
        CreatedAt = now,
        UpdatedAt = now
      };

      _dbContext.Add(student);

      if (callerRole == OrganizationMemberRole.Teacher)
      {
        _dbContext.Add(new TeacherStudent
        {
          Id = Guid.NewGuid(),
          OrganizationId = request.OrganizationId,
          TeacherId = request.UserId,
          StudentId = student.Id,
          AssignedAt = now,
          AssignedBy = request.UserId,
          IsPrimary = true,
          CreatedAt = now,
          UpdatedAt = now
        });
      }

      _auditLogService.Add(new AuditLog(Guid.NewGuid(), "student.created", "students", now)
      {
        OrganizationId = request.OrganizationId,
        ActorId = request.UserId,
        EntityId = student.Id,
        NewValues = new Dictionary<string, object?>
        {
          ["first_name"] = student.FirstName,
          ["last_name"] = student.LastName,
          ["email"] = student.Email,
          ["phone"] = student.Phone,
          ["notes"] = student.Notes,
          ["status"] = student.Status.ToString(),
          ["account_status"] = student.AccountStatus.ToString(),
          ["metadata"] = student.Metadata
        }
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
