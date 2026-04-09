using InternManager.Api.Models.Responses;

namespace InternManager.Api.Services.Interfaces;

public interface IInternSkillsService
{
    Task<IReadOnlyList<InternDetailSkillResponse>> ReplaceSkillsAsync(
        Guid internId,
        IReadOnlyCollection<Guid>? skillIds,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default);
}
