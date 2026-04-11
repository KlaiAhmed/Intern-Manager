using System.Text.Json;
using FluentValidation;
using InternManager.Api.Models.FeatureFlags;

namespace InternManager.Api.Models.Validation;

public sealed class MissionCardConfigValidator : AbstractValidator<MissionCardConfig>
{
    public MissionCardConfigValidator()
    {
        var cardConfigValidator = new InlineValidator<CardConfig>();
        cardConfigValidator.RuleFor(card => card.RequirementConfig)
            .Must(IsObjectOrNull)
            .WithMessage("requirementConfig must be a JSON object when provided.");

        RuleFor(config => config.MissionOverview).SetValidator(cardConfigValidator);
        RuleFor(config => config.QuickStats).SetValidator(cardConfigValidator);
        RuleFor(config => config.Tasks).SetValidator(cardConfigValidator);
        RuleFor(config => config.Deliverables).SetValidator(cardConfigValidator);
        RuleFor(config => config.Evaluation).SetValidator(cardConfigValidator);
        RuleFor(config => config.Journal).SetValidator(cardConfigValidator);
        RuleFor(config => config.Meeting).SetValidator(cardConfigValidator);
    }

    private static bool IsObjectOrNull(JsonDocument? value)
    {
        return value is null || value.RootElement.ValueKind == JsonValueKind.Object;
    }
}
