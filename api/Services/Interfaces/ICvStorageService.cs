namespace InternManager.Api.Services.Interfaces;

public interface ICvStorageService
{
    Task<string> UploadAsync(IFormFile file, Guid internId, CancellationToken cancellationToken);

    Task DeleteAsync(string fileUrl, CancellationToken cancellationToken);
}
