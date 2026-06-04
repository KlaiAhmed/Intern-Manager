using InternManager.Api.Common.Exceptions;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class MissionDocumentsService(
    AppDbContext dbContext,
    IFileStorageService fileStorageService,
    ILogger<MissionDocumentsService> logger) : IMissionDocumentsService
{
    private const long MaxUploadBytes = 10 * 1024 * 1024;
    private const int MaxFileNameLength = 255;
    private const int MaxFileUrlLength = 1000;
    private const string FileSourceType = "file";
    private const string UrlSourceType = "url";

    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };

    public async Task<DocumentResponse> UploadDocumentAsync(
        Guid missionId,
        Guid supervisorId,
        UploadDocumentRequest request,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        await EnsureMissionOwnedAsync(missionId, supervisorId, cancellationToken);

        var hasFile = request.File is not null;
        var hasUrl = !string.IsNullOrWhiteSpace(request.Url);

        if (hasFile == hasUrl)
        {
            throw new ArgumentException("Submit either a file or an HTTPS URL, not both.");
        }

        return hasFile
            ? await UploadFileDocumentAsync(missionId, supervisorId, request, cancellationToken)
            : await CreateUrlDocumentAsync(missionId, supervisorId, request, cancellationToken);
    }

    public async Task<IReadOnlyList<DocumentResponse>> GetDocumentsAsync(
        Guid missionId,
        Guid supervisorId,
        CancellationToken cancellationToken)
    {
        await EnsureMissionOwnedAsync(missionId, supervisorId, cancellationToken);

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

    private async Task<DocumentResponse> UploadFileDocumentAsync(
        Guid missionId,
        Guid supervisorId,
        UploadDocumentRequest request,
        CancellationToken cancellationToken)
    {
        var file = request.File!;
        ValidateFile(file);

        var displayName = NormalizeDisplayName(request.Label, Path.GetFileName(file.FileName));
        var fileExtension = ResolveFileExtension(file);
        StoredFileInfo? storedFile = null;

        try
        {
            await using var uploadStream = file.OpenReadStream();
            storedFile = await fileStorageService.SaveAsync(
                new FileStorageSaveRequest(
                    uploadStream,
                    $"missions/{missionId:D}/documents",
                    $"{Guid.NewGuid():N}{fileExtension}",
                    file.ContentType,
                    fileExtension),
                cancellationToken);

            var document = new MissionDocument
            {
                Id = Guid.NewGuid(),
                MissionId = missionId,
                FileName = displayName,
                FileUrl = storedFile.Url,
                UploadedAt = DateTime.UtcNow,
                UploadedByUserId = supervisorId,
                SourceType = FileSourceType
            };

            dbContext.MissionDocuments.Add(document);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Map(document);
        }
        catch
        {
            if (storedFile is not null)
            {
                try
                {
                    await fileStorageService.DeleteAsync(storedFile.Url, cancellationToken);
                }
                catch (Exception cleanupException)
                {
                    logger.LogWarning(
                        cleanupException,
                        "Failed to delete stored mission document after database save failure.");
                }
            }

            throw;
        }
    }

    private async Task<DocumentResponse> CreateUrlDocumentAsync(
        Guid missionId,
        Guid supervisorId,
        UploadDocumentRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedUrl = NormalizeUrl(request.Url);
        var displayName = NormalizeDisplayName(request.Label, ResolveDisplayNameFromUrl(normalizedUrl));

        var document = new MissionDocument
        {
            Id = Guid.NewGuid(),
            MissionId = missionId,
            FileName = displayName,
            FileUrl = normalizedUrl,
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = supervisorId,
            SourceType = UrlSourceType
        };

        dbContext.MissionDocuments.Add(document);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Map(document);
    }

    private async Task EnsureMissionOwnedAsync(
        Guid missionId,
        Guid supervisorId,
        CancellationToken cancellationToken)
    {
        var mission = await dbContext.Missions
            .AsNoTracking()
            .Where(item => item.Id == missionId)
            .Select(item => new { item.SupervisorId })
            .FirstOrDefaultAsync(cancellationToken);

        if (mission is null)
        {
            throw new KeyNotFoundException("Mission not found.");
        }

        if (mission.SupervisorId != supervisorId)
        {
            throw new UnauthorizedAccessException("Supervisor does not own this mission.");
        }
    }

    private static void ValidateFile(IFormFile file)
    {
        if (file.Length == 0)
        {
            throw new ArgumentException("File is required.");
        }

        if (file.Length > MaxUploadBytes)
        {
            throw new ArgumentException("File exceeds the 10 MB limit.");
        }

        if (string.IsNullOrWhiteSpace(file.ContentType) || !AllowedMimeTypes.Contains(file.ContentType))
        {
            throw new UnsupportedDocumentMediaTypeException("File content type is not allowed.");
        }
    }

    private static string NormalizeUrl(string? rawUrl)
    {
        var normalizedUrl = rawUrl?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedUrl))
        {
            throw new ArgumentException("url is required.");
        }

        if (normalizedUrl.Length > MaxFileUrlLength)
        {
            throw new ArgumentException("url cannot exceed 1000 characters.");
        }

        if (!Uri.TryCreate(normalizedUrl, UriKind.Absolute, out var uri) ||
            !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("url must be an absolute HTTPS URL.");
        }

        return normalizedUrl;
    }

    private static string NormalizeDisplayName(string? label, string fallback)
    {
        var displayName = string.IsNullOrWhiteSpace(label)
            ? fallback.Trim()
            : label.Trim();

        if (string.IsNullOrWhiteSpace(displayName))
        {
            displayName = "Document";
        }

        if (displayName.Length > MaxFileNameLength)
        {
            throw new ArgumentException("label cannot exceed 255 characters.");
        }

        return displayName;
    }

    private static string ResolveDisplayNameFromUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return "Document";
        }

        var fileName = Path.GetFileName(uri.LocalPath);
        return string.IsNullOrWhiteSpace(fileName)
            ? uri.Host
            : fileName;
    }

    private static string ResolveFileExtension(IFormFile file)
    {
        var extension = Path.GetExtension(file.FileName);
        if (!string.IsNullOrWhiteSpace(extension))
        {
            return extension;
        }

        return file.ContentType switch
        {
            "application/pdf" => ".pdf",
            "image/png" => ".png",
            "image/jpeg" => ".jpg",
            "application/msword" => ".doc",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => ".docx",
            _ => string.Empty
        };
    }

    private static DocumentResponse Map(MissionDocument document)
    {
        return new DocumentResponse
        {
            Id = document.Id,
            MissionId = document.MissionId,
            FileName = document.FileName,
            FileUrl = document.FileUrl,
            UploadedAt = document.UploadedAt,
            SourceType = document.SourceType
        };
    }
}
