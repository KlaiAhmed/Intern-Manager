using System.Security.Claims;
using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace InternManager.Api.Tests;

public sealed class InternProfileControllerTests
{
    [Fact]
    public async Task UpdateMyProfile_OnlyProvidedFields_UpdatesWithoutClearingExistingValues()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var schoolId = Guid.NewGuid();
        await SeedProfileAsync(dbContext, internId, schoolId);

        var controller = CreateController(dbContext, new FakeFileStorageService(), internId);

        var result = await controller.UpdateMyProfile(
            new UpdateInternProfileRequest
            {
                Major = "Software Engineering"
            },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<InternProfileResponse>(ok.Value);

        Assert.Equal("Software Engineering", response.Major);
        Assert.Equal("licence_2", response.CurrentYearOfStudy);
        Assert.Equal(WorkPreference.Hybrid.ToString().ToLowerInvariant(), response.WorkPreference);
        Assert.Equal("+21612345678", response.PhoneNumber);

        var storedProfile = await dbContext.InternProfiles.AsNoTracking().SingleAsync(profile => profile.InternId == internId);
        Assert.Equal("Software Engineering", storedProfile.Major);
        Assert.Equal("licence_2", storedProfile.CurrentYearOfStudy);
    }

    [Fact]
    public async Task UploadCv_ValidPdf_SavesNewFileAndDeletesPrevious()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var schoolId = Guid.NewGuid();
        await SeedProfileAsync(dbContext, internId, schoolId, cvFileUrl: "/uploads/cv/old.pdf");

        var storage = new FakeFileStorageService
        {
            NextUrl = "/uploads/cv/new.pdf"
        };
        var controller = CreateController(dbContext, storage, internId);

        var result = await controller.UploadCv(
            new UploadInternCvForm
            {
                File = CreatePdfFile("cv.pdf", 64)
            },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(ok.Value);

        var storedProfile = await dbContext.InternProfiles.AsNoTracking().SingleAsync(profile => profile.InternId == internId);
        Assert.Equal("/uploads/cv/new.pdf", storedProfile.CvFileUrl);
        Assert.Equal(1, storage.SaveCalls);
        Assert.Contains("/uploads/cv/old.pdf", storage.DeletedUrls);
    }

    [Fact]
    public async Task UploadCv_NonPdf_ReturnsBadRequest()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var schoolId = Guid.NewGuid();
        await SeedProfileAsync(dbContext, internId, schoolId);

        var storage = new FakeFileStorageService();
        var controller = CreateController(dbContext, storage, internId);

        var result = await controller.UploadCv(
            new UploadInternCvForm
            {
                File = CreateFile("cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 64)
            },
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, storage.SaveCalls);
    }

    [Fact]
    public async Task UploadCv_OversizedPdf_ReturnsBadRequest()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var schoolId = Guid.NewGuid();
        await SeedProfileAsync(dbContext, internId, schoolId);

        var storage = new FakeFileStorageService();
        var controller = CreateController(dbContext, storage, internId);

        var result = await controller.UploadCv(
            new UploadInternCvForm
            {
                File = CreatePdfFile("cv.pdf", (2 * 1024 * 1024) + 1)
            },
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, storage.SaveCalls);
    }

    [Fact]
    public async Task GetMyProfile_NoSkills_ReturnsEmptyStringArray()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var schoolId = Guid.NewGuid();
        await SeedProfileAsync(dbContext, internId, schoolId);

        var controller = CreateController(dbContext, new FakeFileStorageService(), internId);

        var result = await controller.GetMyProfile(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<InternProfileResponse>(ok.Value);
        Assert.NotNull(response.Skills);
        Assert.Empty(response.Skills);
    }

    [Fact]
    public async Task GetMyProfile_MissingSkillReference_FiltersEmptySkillNames()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var schoolId = Guid.NewGuid();
        var profileId = await SeedProfileAsync(dbContext, internId, schoolId);

        dbContext.InternProfileSkills.Add(new InternProfileSkill
        {
            InternProfileId = profileId,
            SkillId = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, new FakeFileStorageService(), internId);

        var result = await controller.GetMyProfile(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<InternProfileResponse>(ok.Value);
        Assert.Empty(response.Skills);
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static InternProfileController CreateController(
        AppDbContext dbContext,
        IFileStorageService fileStorageService,
        Guid internId)
    {
        var controller = new InternProfileController(
            dbContext,
            fileStorageService,
            new NoopNotificationService(),
            new NoopInternSkillsService(),
            NullLogger<InternProfileController>.Instance);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = CreateHttpContext(internId)
        };

        return controller;
    }

    private static DefaultHttpContext CreateHttpContext(Guid internId)
    {
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(
            new ClaimsIdentity(
            [
                new Claim("userId", internId.ToString()),
                new Claim(ClaimTypes.NameIdentifier, internId.ToString()),
                new Claim("email", "intern@example.com"),
                new Claim(ClaimTypes.Email, "intern@example.com"),
                new Claim(ClaimTypes.Role, "Intern")
            ],
            "TestAuth",
            ClaimTypes.Email,
            ClaimTypes.Role));

        return context;
    }

    private static async Task<Guid> SeedProfileAsync(
        AppDbContext dbContext,
        Guid internId,
        Guid schoolId,
        string? cvFileUrl = "/uploads/cv/current.pdf")
    {
        var now = DateTime.UtcNow;
        var profileId = Guid.NewGuid();

        dbContext.Users.Add(new User
        {
            Id = internId,
            FirstName = "Intern",
            LastName = "User",
            Email = $"{internId:N}@intern.example.com",
            PasswordHash = "hash",
            Role = UserRole.Intern,
            Status = UserStatus.Active,
            VerificationStatus = InternVerificationStatus.ACTIVE,
            CreatedAt = now,
            UpdatedAt = now
        });

        dbContext.Schools.Add(new School
        {
            Id = schoolId,
            Name = "Axia University",
            CreatedAt = now,
            UpdatedAt = now
        });

        dbContext.InternProfiles.Add(new InternProfile
        {
            Id = profileId,
            InternId = internId,
            UniversityId = schoolId,
            Major = "Computer Science",
            CurrentYearOfStudy = "licence_2",
            WorkPreference = WorkPreference.Hybrid,
            PhoneNumber = "+21612345678",
            CvFileUrl = cvFileUrl,
            StartDate = new DateTime(2026, 1, 1),
            EndDate = new DateTime(2026, 6, 1),
            CreatedAt = now,
            UpdatedAt = now
        });

        await dbContext.SaveChangesAsync();

        return profileId;
    }

    private static IFormFile CreatePdfFile(string fileName, int length)
    {
        return CreateFile(fileName, "application/pdf", length, pdfSignature: true);
    }

    private static IFormFile CreateFile(
        string fileName,
        string contentType,
        int length,
        bool pdfSignature = false)
    {
        var bytes = new byte[length];
        if (pdfSignature && length >= 5)
        {
            bytes[0] = 0x25;
            bytes[1] = 0x50;
            bytes[2] = 0x44;
            bytes[3] = 0x46;
            bytes[4] = 0x2D;
        }

        return new FormFile(new MemoryStream(bytes), 0, length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    private sealed class NoopNotificationService : INotificationService
    {
        public void QueueNotification(Guid userId, string type, string title, string message, string? relatedEntity = null)
        {
            _ = userId;
            _ = type;
            _ = title;
            _ = message;
            _ = relatedEntity;
        }
    }

    private sealed class NoopInternSkillsService : IInternSkillsService
    {
        public Task<IReadOnlyList<InternDetailSkillResponse>> ReplaceSkillsAsync(
            Guid internId,
            IReadOnlyCollection<Guid>? skillIds,
            Guid? actorUserId,
            string actorName,
            CancellationToken cancellationToken = default)
        {
            throw new NotSupportedException();
        }
    }

    private sealed class FakeFileStorageService : IFileStorageService
    {
        public string NextUrl { get; init; } = "/uploads/cv/stored.pdf";

        public int SaveCalls { get; private set; }

        public List<string> DeletedUrls { get; } = [];

        public async Task<StoredFileInfo> SaveAsync(FileStorageSaveRequest request, CancellationToken cancellationToken)
        {
            SaveCalls += 1;
            await request.Content.CopyToAsync(Stream.Null, cancellationToken);

            return new StoredFileInfo(
                "cv/stored.pdf",
                NextUrl,
                "stored.pdf",
                request.ContentType,
                request.Content.CanSeek ? request.Content.Length : 0);
        }

        public Task<FileStorageReadResult?> OpenReadAsync(string storageKeyOrUrl, CancellationToken cancellationToken)
        {
            return Task.FromResult<FileStorageReadResult?>(null);
        }

        public Task DeleteAsync(string storageKeyOrUrl, CancellationToken cancellationToken)
        {
            DeletedUrls.Add(storageKeyOrUrl);
            return Task.CompletedTask;
        }
    }
}
