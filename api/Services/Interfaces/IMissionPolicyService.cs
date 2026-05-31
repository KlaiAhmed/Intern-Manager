namespace InternManager.Api.Services.Interfaces;

public interface IMissionPolicyService
{
    Task CanViewMissionAsync(Guid actorId, string actorRole, Guid missionId);

    Task CanReviewDeliverableAsync(Guid actorId, string actorRole, Guid missionId);

    Task CanEvaluateAsync(Guid actorId, string actorRole, Guid missionId);

    Task CanCreateTaskAsync(Guid actorId, string actorRole, Guid missionId);

    Task CanSubmitEvidenceAsync(Guid actorId, string actorRole, Guid missionId, CancellationToken cancellationToken = default);

    Task CanMarkTaskDoneAsync(Guid actorId, string actorRole, Guid taskId, bool isSupervisorOverride = false);

    Task AssertMissionNotArchivedAsync(Guid missionId);
}