using FluentValidation;
using InternManager.Api.Models.Requests;

namespace InternManager.Api.Models.Validation;

public sealed class SupervisorJournalEvaluationLinksRequestValidator : AbstractValidator<SupervisorJournalEvaluationLinksRequest>
{
    public SupervisorJournalEvaluationLinksRequestValidator()
    {
        RuleFor(request => request.Criteria)
            .NotNull()
            .WithMessage("criteria is required.")
            .Must(criteria => criteria.Count <= 5)
            .WithMessage("criteria cannot contain more than 5 values.")
            .Must(criteria => criteria.Distinct().Count() == criteria.Count)
            .WithMessage("criteria cannot contain duplicate values.");
    }
}
