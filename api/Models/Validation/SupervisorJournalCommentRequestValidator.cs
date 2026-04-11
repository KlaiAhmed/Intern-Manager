using FluentValidation;
using InternManager.Api.Models.Requests;

namespace InternManager.Api.Models.Validation;

public sealed class SupervisorJournalCommentRequestValidator : AbstractValidator<SupervisorJournalCommentRequest>
{
    public SupervisorJournalCommentRequestValidator()
    {
        RuleFor(request => request.Content)
            .NotEmpty()
            .WithMessage("content is required.")
            .MaximumLength(2000)
            .WithMessage("content cannot exceed 2000 characters.");
    }
}
