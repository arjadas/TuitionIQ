using FluentValidation;
using MediatR;
using TuitionIQ.Application.Common.Exceptions;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Users.Dtos;
using TuitionIQ.Domain.Entities;

namespace TuitionIQ.Application.Features.Users.Commands;

public sealed record UpdateProfileCommand(Guid UserId, string FirstName, string LastName, string? Phone) : IRequest<UserProfileDto>;

public sealed class UpdateProfileCommandValidator : AbstractValidator<UpdateProfileCommand>
{
  public UpdateProfileCommandValidator()
  {
    RuleFor(command => command.FirstName)
      .NotEmpty()
      .MaximumLength(100);

    RuleFor(command => command.LastName)
      .NotEmpty()
      .MaximumLength(100);

    RuleFor(command => command.Phone)
      .MaximumLength(30)
      .When(command => !string.IsNullOrWhiteSpace(command.Phone));
  }
}

public sealed class UpdateProfileCommandHandler : IRequestHandler<UpdateProfileCommand, UserProfileDto>
{
  private readonly IAppDbContext _dbContext;
  private readonly IAuditLogService _auditLogService;

  public UpdateProfileCommandHandler(IAppDbContext dbContext, IAuditLogService auditLogService)
  {
    _dbContext = dbContext;
    _auditLogService = auditLogService;
  }

  public async Task<UserProfileDto> Handle(UpdateProfileCommand request, CancellationToken cancellationToken)
  {
    IQueryable<User> userQuery = _dbContext.Users
      .Where(user => user.Id == request.UserId);

    var user = await _dbContext.FirstOrDefaultAsync(userQuery, cancellationToken);
    if (user is null)
    {
      throw new NotFoundException($"User with id '{request.UserId}' was not found.");
    }

    var oldValues = new Dictionary<string, object?>
    {
      ["first_name"] = user.FirstName,
      ["last_name"] = user.LastName,
      ["phone"] = user.Phone
    };

    var normalizedFirstName = (request.FirstName ?? string.Empty).Trim();
    var normalizedLastName = (request.LastName ?? string.Empty).Trim();
    var normalizedPhone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
    var updatedAt = DateTimeOffset.UtcNow;

    user.FirstName = normalizedFirstName;
    user.LastName = normalizedLastName;
    user.Phone = normalizedPhone;
    user.UpdatedAt = updatedAt;

    _auditLogService.Add(new AuditLog(Guid.NewGuid(), "user.profile.updated", "users", updatedAt)
    {
      ActorId = user.Id,
      EntityId = user.Id,
      OldValues = oldValues,
      NewValues = new Dictionary<string, object?>
      {
        ["first_name"] = normalizedFirstName,
        ["last_name"] = normalizedLastName,
        ["phone"] = normalizedPhone
      }
    });

    await _dbContext.SaveChangesAsync(cancellationToken);

    return new UserProfileDto
    {
      Id = user.Id,
      Email = user.Email,
      FirstName = user.FirstName,
      LastName = user.LastName,
      Phone = user.Phone,
      AvatarUrl = user.AvatarUrl,
      EmailVerified = user.EmailVerified
    };
  }
}