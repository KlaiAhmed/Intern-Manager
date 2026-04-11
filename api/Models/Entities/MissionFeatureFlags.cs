using InternManager.Api.Models.FeatureFlags;

namespace InternManager.Api.Models.Entities;

public sealed class MissionFeatureFlags
{
    public int MissionFeatureFlagsId { get; set; }

    public Guid MissionId { get; set; }

    public MissionCardConfig MissionCardConfig { get; set; } = MissionCardConfigDefaults.Create();

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid? UpdatedByUserId { get; set; }

    public Mission? Mission { get; set; }

    public User? UpdatedByUser { get; set; }
}