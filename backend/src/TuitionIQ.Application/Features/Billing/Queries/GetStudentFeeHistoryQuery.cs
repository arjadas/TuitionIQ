using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Billing.Dtos;

namespace TuitionIQ.Application.Features.Billing.Queries;

public sealed record GetStudentFeeHistoryQuery(Guid OrganizationId, Guid StudentId, Guid UserId)
  : IRequest<IReadOnlyList<StudentFeeConfigDto>>;

public sealed class GetStudentFeeHistoryQueryHandler : IRequestHandler<GetStudentFeeHistoryQuery, IReadOnlyList<StudentFeeConfigDto>>
{
  private readonly IAppDbContext _dbContext;
  private readonly IOrganizationAuthorizationService _organizationAuthorizationService;

  public GetStudentFeeHistoryQueryHandler(
    IAppDbContext dbContext,
    IOrganizationAuthorizationService organizationAuthorizationService)
  {
    _dbContext = dbContext;
    _organizationAuthorizationService = organizationAuthorizationService;
  }

  public async Task<IReadOnlyList<StudentFeeConfigDto>> Handle(
    GetStudentFeeHistoryQuery request,
    CancellationToken cancellationToken)
  {
    await _organizationAuthorizationService.RequireTeacherOrHigherAsync(
      request.OrganizationId,
      request.UserId,
      "You are not allowed to view fee history for this student.",
      cancellationToken);

    IQueryable<Guid> studentExistsQuery = _dbContext.Students
      .Where(student => student.OrganizationId == request.OrganizationId && student.Id == request.StudentId)
      .Select(student => student.Id);

    var studentId = await _dbContext.FirstOrDefaultAsync(studentExistsQuery, cancellationToken);
    if (studentId == Guid.Empty)
    {
      throw new NotFoundException($"Student with id '{request.StudentId}' was not found.");
    }

    IQueryable<StudentFeeConfigDto> historyQuery = _dbContext.StudentFees
      .Where(studentFee =>
        studentFee.OrganizationId == request.OrganizationId
        && studentFee.StudentId == request.StudentId)
      .OrderByDescending(studentFee => studentFee.EffectiveFrom)
      .Select(studentFee => new StudentFeeConfigDto
      {
        Id = studentFee.Id,
        OrganizationId = studentFee.OrganizationId,
        StudentId = studentFee.StudentId,
        SetBy = studentFee.SetBy,
        FeeSource = studentFee.FeeSource.ToString(),
        ManualFee = studentFee.ManualFee,
        OverrideReason = studentFee.OverrideReason,
        Currency = studentFee.Currency,
        EffectiveFrom = studentFee.EffectiveFrom,
        EffectiveTo = studentFee.EffectiveTo,
        IsActive = studentFee.IsActive,
        Notes = studentFee.Notes,
        CreatedAt = studentFee.CreatedAt,
        UpdatedAt = studentFee.UpdatedAt,
        DeletedAt = studentFee.DeletedAt
      });

    return await _dbContext.ToListAsync(historyQuery, cancellationToken);
  }
}
