using InternManager.Api.Services.Interfaces;

namespace InternManager.Api.Services;

public sealed class CvStorageService(IWebHostEnvironment environment) : ICvStorageService
{
    public async Task<string> UploadAsync(IFormFile file, Guid internId, CancellationToken cancellationToken)
    {
        var uploadsDirectory = Path.Combine(environment.ContentRootPath, "uploads", "cv");
        Directory.CreateDirectory(uploadsDirectory);

        var storedFileName = $"{internId}_{DateTime.UtcNow:yyyyMMddHHmmssfff}_{Guid.NewGuid():N}.pdf";
        var destinationPath = Path.Combine(uploadsDirectory, storedFileName);

        await using (var stream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await file.CopyToAsync(stream, cancellationToken);
        }

        return $"/uploads/cv/{storedFileName}";
    }

    public Task DeleteAsync(string fileUrl, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(fileUrl))
        {
            return Task.CompletedTask;
        }

        var relativePath = fileUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var absolutePath = Path.Combine(environment.ContentRootPath, relativePath);

        if (File.Exists(absolutePath))
        {
            File.Delete(absolutePath);
        }

        return Task.CompletedTask;
    }
}
