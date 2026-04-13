using FluentValidation;
using MediatR;
using TuitionIQ.Application.Common.Interfaces;
using TuitionIQ.Application.Features.Auth.Dtos;

namespace TuitionIQ.Application.Features.Auth.Queries;

public sealed record CheckUserAccountExistsQuery(string Email) : IRequest<AccountExistsDto>;

public sealed class CheckUserAccountExistsQueryValidator : AbstractValidator<CheckUserAccountExistsQuery>
{
  public CheckUserAccountExistsQueryValidator()
  {
    RuleFor(query => query.Email)
      .NotEmpty()
      .EmailAddress()
      .MaximumLength(255);
  }
}

public sealed class CheckUserAccountExistsQueryHandler : IRequestHandler<CheckUserAccountExistsQuery, AccountExistsDto>
{
  private readonly IAppDbContext _dbContext;

  public CheckUserAccountExistsQueryHandler(IAppDbContext dbContext)
  {
    _dbContext = dbContext;
  }

  public async Task<AccountExistsDto> Handle(CheckUserAccountExistsQuery request, CancellationToken cancellationToken)
  {
    var normalizedEmail = request.Email.Trim().ToLowerInvariant();

    IQueryable<bool> existsQuery = _dbContext.Users
      .Where(user => user.Email == normalizedEmail)
      .Select(_ => true);

    var exists = await _dbContext.FirstOrDefaultAsync(existsQuery, cancellationToken);

    return new AccountExistsDto
    {
      Email = normalizedEmail,
      Exists = exists
    };
  }
}
