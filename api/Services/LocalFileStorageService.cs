using Microsoft.AspNetCore.StaticFiles;

namespace InternManager.Api.Services;

public sealed class LocalFileStorageService : IFileStorageService
{
    private static readonly FileExtensionContentTypeProvider ContentTypeProvider = new();

    private readonly string rootPath;
    private readonly string publicBasePath;

    public LocalFileStorageService(IWebHostEnvironment environment, IConfiguration configuration)
    {
        var configuredRootPath = configuration["FileStorage:LocalRootPath"];
        rootPath = Path.GetFullPath(string.IsNullOrWhiteSpace(configuredRootPath)
            ? Path.Combine(environment.ContentRootPath, "uploads")
            : configuredRootPath);

        publicBasePath = NormalizePublicBasePath(configuration["FileStorage:PublicBasePath"]);
    }

    public async Task<StoredFileInfo> SaveAsync(FileStorageSaveRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.Content is null || !request.Content.CanRead)
        {
            throw new ArgumentException("A readable content stream is required.", nameof(request));
        }

        var containerSegments = NormalizeContainerSegments(request.ContainerName);
        var directoryPath = ResolveStoragePath(containerSegments);
        Directory.CreateDirectory(directoryPath);

        var originalFileName = Path.GetFileName(request.OriginalFileName);
        if (string.IsNullOrWhiteSpace(originalFileName))
        {
            originalFileName = "file";
        }

        var extension = NormalizeExtension(request.FileExtension ?? Path.GetExtension(originalFileName));
        var storedFileName = $"{Path.GetFileNameWithoutExtension(originalFileName)}_{Guid.NewGuid():N}{extension}";
        var sanitizedStoredFileName = SanitizeFileName(storedFileName);
        var finalPath = ResolveStoragePath([.. containerSegments, sanitizedStoredFileName]);
        var tempPath = Path.Combine(directoryPath, $"{Guid.NewGuid():N}.tmp");

        try
        {
            await using (var outputStream = new FileStream(tempPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                await request.Content.CopyToAsync(outputStream, cancellationToken);
            }

            File.Move(tempPath, finalPath, overwrite: false);
        }
        catch
        {
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }

            throw;
        }

        var fileInfo = new FileInfo(finalPath);
        var storageKey = string.Join('/', containerSegments.Append(sanitizedStoredFileName));

        return new StoredFileInfo(
            storageKey,
            $"{publicBasePath}/{storageKey}",
            sanitizedStoredFileName,
            request.ContentType,
            fileInfo.Length);
    }

    public Task<FileStorageReadResult?> OpenReadAsync(string storageKeyOrUrl, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var storageKey = NormalizeStorageKey(storageKeyOrUrl);
        if (string.IsNullOrWhiteSpace(storageKey))
        {
            return Task.FromResult<FileStorageReadResult?>(null);
        }

        var absolutePath = ResolveStoragePath(storageKey.Split('/'));
        if (!File.Exists(absolutePath))
        {
            return Task.FromResult<FileStorageReadResult?>(null);
        }

        var fileName = Path.GetFileName(absolutePath);
        var fileInfo = new FileInfo(absolutePath);
        var contentType = ContentTypeProvider.TryGetContentType(fileName, out var detectedContentType)
            ? detectedContentType
            : "application/octet-stream";

        Stream stream = new FileStream(absolutePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult<FileStorageReadResult?>(new FileStorageReadResult(stream, fileName, contentType, fileInfo.Length));
    }

    public Task DeleteAsync(string storageKeyOrUrl, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var storageKey = NormalizeStorageKey(storageKeyOrUrl);
        if (string.IsNullOrWhiteSpace(storageKey))
        {
            return Task.CompletedTask;
        }

        var absolutePath = ResolveStoragePath(storageKey.Split('/'));
        if (File.Exists(absolutePath))
        {
            File.Delete(absolutePath);
        }

        return Task.CompletedTask;
    }

    private string ResolveStoragePath(IReadOnlyCollection<string> pathSegments)
    {
        var combinedPath = Path.Combine([rootPath, .. pathSegments]);
        var resolvedPath = Path.GetFullPath(combinedPath);
        var resolvedRootPath = rootPath.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;

        if (!resolvedPath.StartsWith(resolvedRootPath, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Resolved storage path is outside the configured storage root.");
        }

        return resolvedPath;
    }

    private string NormalizeStorageKey(string storageKeyOrUrl)
    {
        if (string.IsNullOrWhiteSpace(storageKeyOrUrl))
        {
            return string.Empty;
        }

        var normalized = storageKeyOrUrl.Trim().Replace('\\', '/');
        var basePathPrefix = $"{publicBasePath}/";

        if (normalized.StartsWith(basePathPrefix, StringComparison.OrdinalIgnoreCase))
        {
            normalized = normalized[basePathPrefix.Length..];
        }
        else
        {
            normalized = normalized.TrimStart('/');
        }

        var safeSegments = normalized
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(SanitizePathSegment)
            .Where(segment => segment.Length > 0)
            .ToArray();

        return string.Join('/', safeSegments);
    }

    private static string NormalizePublicBasePath(string? configuredBasePath)
    {
        var basePath = string.IsNullOrWhiteSpace(configuredBasePath)
            ? "/uploads"
            : configuredBasePath.Trim();

        return $"/{basePath.Trim('/')}";
    }

    private static string[] NormalizeContainerSegments(string containerName)
    {
        if (string.IsNullOrWhiteSpace(containerName))
        {
            throw new ArgumentException("Container name is required.", nameof(containerName));
        }

        var segments = containerName
            .Replace('\\', '/')
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(SanitizePathSegment)
            .Where(segment => segment.Length > 0)
            .ToArray();

        if (segments.Length == 0)
        {
            throw new ArgumentException("Container name is required.", nameof(containerName));
        }

        return segments;
    }

    private static string SanitizeFileName(string fileName)
    {
        var safeName = Path.GetFileName(fileName);
        foreach (var invalidCharacter in Path.GetInvalidFileNameChars())
        {
            safeName = safeName.Replace(invalidCharacter, '_');
        }

        return string.IsNullOrWhiteSpace(safeName)
            ? $"{Guid.NewGuid():N}.bin"
            : safeName;
    }

    private static string SanitizePathSegment(string segment)
    {
        var safeSegment = segment.Trim();
        foreach (var invalidCharacter in Path.GetInvalidFileNameChars())
        {
            safeSegment = safeSegment.Replace(invalidCharacter, '_');
        }

        return safeSegment is "." or ".." ? string.Empty : safeSegment;
    }

    private static string NormalizeExtension(string extension)
    {
        if (string.IsNullOrWhiteSpace(extension))
        {
            return string.Empty;
        }

        var normalized = extension.Trim();
        if (!normalized.StartsWith('.'))
        {
            normalized = $".{normalized}";
        }

        var safeExtension = new string(normalized
            .Where(character => character == '.' || char.IsAsciiLetterOrDigit(character))
            .ToArray());

        return safeExtension == "."
            ? string.Empty
            : safeExtension;
    }
}
