using InternManager.Api.Data;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class InternMissionDocumentsService(
    AppDbContext dbContext,
    IFileStorageService fileStorageService,
    ILogger<InternMissionDocumentsService> logger) : IInternMissionDocumentsService
{
    private const string FileSourceType = "file";

    public async Task<IReadOnlyList<DocumentResponse>> GetDocumentsAsync(
        Guid missionId,
        Guid internId,
        CancellationToken cancellationToken)
    {
        await EnsureMissionAssignedToInternAsync(missionId, internId, cancellationToken);

        return await dbContext.MissionDocuments
            .AsNoTracking()
            .Where(document => document.MissionId == missionId)
            .OrderByDescending(document => document.UploadedAt)
            .Select(document => new DocumentResponse
            {
                Id = document.Id,
                MissionId = document.MissionId,
                FileName = document.FileName,
                FileUrl = document.FileUrl,
                UploadedAt = document.UploadedAt,
                SourceType = document.SourceType
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<InternMissionDocumentDownload?> GetDownloadAsync(
        Guid missionId,
        Guid documentId,
        Guid internId,
        CancellationToken cancellationToken)
    {
        await EnsureMissionAssignedToInternAsync(missionId, internId, cancellationToken);

        var document = await dbContext.MissionDocuments
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.Id == documentId && item.MissionId == missionId,
                cancellationToken);

        if (document is null)
        {
            throw new KeyNotFoundException("Document not found in mission.");
        }

        if (!string.Equals(document.SourceType, FileSourceType, StringComparison.OrdinalIgnoreCase))
        {
            // External URL documents cannot be streamed from local storage.
            return null;
        }

        if (string.IsNullOrWhiteSpace(document.FileUrl))
        {
            return null;
        }

        try
        {
            var stored = await fileStorageService.OpenReadAsync(document.FileUrl, cancellationToken);
            if (stored is null)
            {
                return null;
            }

            return new InternMissionDocumentDownload(
                stored.Content,
                document.FileName,
                stored.ContentType,
                stored.Length);
        }
        catch (InvalidOperationException exception)
        {
            logger.LogWarning(
                exception,
                "Stored mission document path is outside the configured storage root for document {DocumentId}.",
                documentId);
            return null;
        }
    }

    private async Task EnsureMissionAssignedToInternAsync(
        Guid missionId,
        Guid internId,
        CancellationToken cancellationToken)
    {
        var assignment = await dbContext.Missions
            .AsNoTracking()
            .Where(item => item.Id == missionId)
            .Select(item => new
            {
                item.InternId,
                IsAssigned = item.InternId == internId ||
                             item.InternAssignments.Any(assignment => assignment.InternId == internId)
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (assignment is null)
        {
            throw new KeyNotFoundException("Mission not found.");
        }

        if (!assignment.IsAssigned)
        {
            throw new UnauthorizedAccessException("Intern is not assigned to this mission.");
        }
    }
}
