using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Common.Models;
using TuitionIQ.Application.Features.Students.Dtos;
using TuitionIQ.Domain.Entities;
using TuitionIQ.Domain.Enums;

namespace TuitionIQ.Application.Features.Students.Queries;

public sealed record GetStudentsQuery(
  Guid OrganizationId,
  Guid UserId,
  string? Status,
  string? Search,
  int Page = 1,
  int PageSize = 20) : IRequest<PagedResult<StudentSummaryDto>>;

public sealed class GetStudentsQueryValidator : AbstractValidator<GetStudentsQuery>
{
  private const int MaxPageSize = 100;

  public GetStudentsQueryValidator()
  {
    RuleFor(query => query.Page)
      .GreaterThan(0);

    RuleFor(query => query.PageSize)
      .GreaterThan(0)
      .LessThanOrEqualTo(MaxPageSize)
      .WithMessage($"PageSize must be between 1 and {MaxPageSize}.");

    RuleFor(query => query.Status)
      .Must(BeValidStatus)
      .When(query => !string.IsNullOrWhiteSpace(query.Status))
      .WithMessage("Status must be one of: Active, Inactive, Graduated.");
  }

  private static bool BeValidStatus(string? status)
  {
    return Enum.TryParse<StudentStatus>(status, true, out _);
  }
}

public sealed class GetStudentsQueryHandler : IRequestHandler<GetStudentsQuery, PagedResult<StudentSummaryDto>>
{
  private readonly IAppDbContext _dbContext;

  public GetStudentsQueryHandler(IAppDbContext dbContext)
  {
    _dbContext = dbContext;
  }

  public async Task<PagedResult<StudentSummaryDto>> Handle(GetStudentsQuery request, CancellationToken cancellationToken)
  {
    IQueryable<OrganizationMemberRole?> membershipRoleQuery = _dbContext.OrganizationMembers
      .Where(membership => membership.OrganizationId == request.OrganizationId && membership.UserId == request.UserId)
      .Select(membership => (OrganizationMemberRole?)membership.Role);

    var callerRole = await _dbContext.FirstOrDefaultAsync(membershipRoleQuery, cancellationToken);
    if (callerRole is null)
    {
      throw new ForbiddenException("You are not allowed to view students in this organization.");
    }

    IQueryable<Student> studentsQuery = _dbContext.Students
      .Where(student => student.OrganizationId == request.OrganizationId);

    if (!string.IsNullOrWhiteSpace(request.Status)
        && Enum.TryParse<StudentStatus>(request.Status, true, out var parsedStatus))
    {
      studentsQuery = studentsQuery.Where(student => student.Status == parsedStatus);
    }

    if (!string.IsNullOrWhiteSpace(request.Search))
    {
      var pattern = $"%{request.Search.Trim()}%";
      studentsQuery = studentsQuery.Where(student =>
        EF.Functions.ILike(student.FirstName, pattern)
        || EF.Functions.ILike(student.LastName, pattern));
    }

    var totalCount = await _dbContext.CountAsync(studentsQuery, cancellationToken);

    IQueryable<StudentSummaryDto> pagedStudentsQuery = studentsQuery
      .OrderByDescending(student => student.CreatedAt)
      .Skip((request.Page - 1) * request.PageSize)
      .Take(request.PageSize)
      .Select(student => new StudentSummaryDto
      {
        Id = student.Id,
        FirstName = student.FirstName,
        LastName = student.LastName,
        Email = student.Email,
        Status = student.Status.ToString(),
        AccountStatus = student.AccountStatus.ToString(),
        CreatedAt = student.CreatedAt
      });

    var students = await _dbContext.ToListAsync(pagedStudentsQuery, cancellationToken);

    return new PagedResult<StudentSummaryDto>
    {
      Items = students,
      Page = request.Page,
      PageSize = request.PageSize,
      TotalCount = totalCount
    };
  }
}
