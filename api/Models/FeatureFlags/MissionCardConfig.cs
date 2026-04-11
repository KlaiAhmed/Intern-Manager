using System.Text.Json;
using System.Text.Json.Serialization;

namespace InternManager.Api.Models.FeatureFlags;

public record CardConfig(
    bool IsVisible,
    bool IsInteractive,
    JsonDocument? RequirementConfig
);

public record MissionCardConfig(
    CardConfig MissionOverview,
    CardConfig QuickStats,
    CardConfig Tasks,
    CardConfig Deliverables,
    CardConfig Evaluation,
    CardConfig Journal,
    CardConfig Meeting
);

public static class MissionCardConfigDefaults
{
    public static MissionCardConfig Create()
    {
        var card = new CardConfig(IsVisible: true, IsInteractive: true, RequirementConfig: null);

        return new MissionCardConfig(
            MissionOverview: card,
            QuickStats: card,
            Tasks: card,
            Deliverables: card,
            Evaluation: card,
            Journal: card,
            Meeting: card);
    }
}

public static class MissionCardConfigJson
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public static string Serialize(MissionCardConfig value)
    {
        return JsonSerializer.Serialize(value, Options);
    }

    public static MissionCardConfig Deserialize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return MissionCardConfigDefaults.Create();
        }

        var parsed = JsonSerializer.Deserialize<MissionCardConfig>(raw, Options);
        return parsed ?? MissionCardConfigDefaults.Create();
    }

    public static MissionCardConfig Clone(MissionCardConfig value)
    {
        return new MissionCardConfig(
            MissionOverview: CloneCard(value.MissionOverview),
            QuickStats: CloneCard(value.QuickStats),
            Tasks: CloneCard(value.Tasks),
            Deliverables: CloneCard(value.Deliverables),
            Evaluation: CloneCard(value.Evaluation),
            Journal: CloneCard(value.Journal),
            Meeting: CloneCard(value.Meeting));
    }

    private static CardConfig CloneCard(CardConfig card)
    {
        return new CardConfig(
            IsVisible: card.IsVisible,
            IsInteractive: card.IsInteractive,
            RequirementConfig: CloneJson(card.RequirementConfig));
    }

    private static JsonDocument? CloneJson(JsonDocument? value)
    {
        if (value is null)
        {
            return null;
        }

        return JsonDocument.Parse(value.RootElement.GetRawText());
    }
}