namespace InternManager.Api.Services;

public interface IFileStorageService
{
    Task<StoredFileInfo> SaveAsync(FileStorageSaveRequest request, CancellationToken cancellationToken);

    Task<FileStorageReadResult?> OpenReadAsync(string storageKeyOrUrl, CancellationToken cancellationToken);

    Task DeleteAsync(string storageKeyOrUrl, CancellationToken cancellationToken);
}

public sealed record FileStorageSaveRequest(
    Stream Content,
    string ContainerName,
    string OriginalFileName,
    string? ContentType = null,
    string? FileExtension = null);

public sealed record StoredFileInfo(
    string StorageKey,
    string Url,
    string FileName,
    string? ContentType,
    long Length);

public sealed record FileStorageReadResult(
    Stream Content,
    string FileName,
    string ContentType,
    long Length);
