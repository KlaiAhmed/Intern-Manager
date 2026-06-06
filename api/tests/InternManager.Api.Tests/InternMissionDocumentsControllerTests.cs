using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;
using InternManager.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace InternManager.Api.Tests;

public sealed class InternMissionDocumentsControllerTests
{
    [Fact]
    public async Task GetDocuments_AssignedIntern_ReturnsMissionDocuments()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var documentId = Guid.NewGuid();
        await SeedAssignedMissionAsync(dbContext, supervisorId, internId, missionId);
        dbContext.MissionDocuments.Add(new MissionDocument
        {
            Id = documentId,
            MissionId = missionId,
            FileName = "Brief.pdf",
            FileUrl = "/uploads/missions/" + missionId.ToString("D") + "/documents/brief.pdf",
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = supervisorId,
            SourceType = "file"
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, new InMemoryFileStorageService(), internId, UserRole.Intern);
        var result = await controller.GetDocuments(missionId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var documents = Assert.IsAssignableFrom<IReadOnlyList<DocumentResponse>>(ok.Value);
        Assert.Single(documents);
        Assert.Equal(documentId, documents[0].Id);
        Assert.Equal(missionId, documents[0].MissionId);
        Assert.Equal("Brief.pdf", documents[0].FileName);
        Assert.Equal("file", documents[0].SourceType);
    }

    [Fact]
    public async Task GetDocuments_AssignedIntern_NoDocuments_ReturnsEmptyArray()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        await SeedAssignedMissionAsync(dbContext, supervisorId, internId, missionId);

        var controller = CreateController(dbContext, new InMemoryFileStorageService(), internId, UserRole.Intern);
        var result = await controller.GetDocuments(missionId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var documents = Assert.IsAssignableFrom<IReadOnlyList<DocumentResponse>>(ok.Value);
        Assert.Empty(documents);
    }

    [Fact]
    public async Task GetDocuments_AssignedInternViaAssignmentRecord_ReturnsMissionDocuments()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var documentId = Guid.NewGuid();
        await SeedAssignedMissionViaAssignmentRecordAsync(dbContext, supervisorId, internId, missionId);
        dbContext.MissionDocuments.Add(new MissionDocument
        {
            Id = documentId,
            MissionId = missionId,
            FileName = "Brief.pdf",
            FileUrl = "/uploads/missions/" + missionId.ToString("D") + "/documents/brief.pdf",
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = supervisorId,
            SourceType = "file"
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, new InMemoryFileStorageService(), internId, UserRole.Intern);
        var result = await controller.GetDocuments(missionId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var documents = Assert.IsAssignableFrom<IReadOnlyList<DocumentResponse>>(ok.Value);
        Assert.Single(documents);
        Assert.Equal(documentId, documents[0].Id);
    }

    [Fact]
    public async Task GetDocuments_UnassignedIntern_ReturnsForbidden()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var assignedInternId = Guid.NewGuid();
        var otherInternId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        await SeedAssignedMissionAsync(dbContext, supervisorId, assignedInternId, missionId);

        var controller = CreateController(dbContext, new InMemoryFileStorageService(), otherInternId, UserRole.Intern);
        var result = await controller.GetDocuments(missionId, CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task GetDocuments_InternListsOtherMissionsDocuments_ReturnsNotFound()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var assignedMissionId = Guid.NewGuid();
        var otherMissionId = Guid.NewGuid();
        await SeedAssignedMissionAsync(dbContext, supervisorId, internId, assignedMissionId);

        dbContext.Missions.Add(new Mission
        {
            Id = otherMissionId,
            SupervisorId = supervisorId,
            InternId = Guid.NewGuid(),
            Title = "Other mission",
            Description = "Not for the current intern",
            SkillsJson = "[]",
            Tools = string.Empty,
            Level = "junior",
            Status = "active",
            CreatedAt = DateTime.UtcNow
        });
        dbContext.MissionDocuments.Add(new MissionDocument
        {
            Id = Guid.NewGuid(),
            MissionId = otherMissionId,
            FileName = "Secret.pdf",
            FileUrl = "/uploads/missions/" + otherMissionId.ToString("D") + "/documents/secret.pdf",
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = supervisorId,
            SourceType = "file"
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, new InMemoryFileStorageService(), internId, UserRole.Intern);
        var result = await controller.GetDocuments(otherMissionId, CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task GetDocuments_MissingMission_ReturnsNotFound()
    {
        await using var dbContext = TestDbContext.Create();
        var internId = Guid.NewGuid();

        var controller = CreateController(dbContext, new InMemoryFileStorageService(), internId, UserRole.Intern);
        var result = await controller.GetDocuments(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task DownloadDocument_AssignedIntern_ReturnsFileStream()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var documentId = Guid.NewGuid();
        await SeedAssignedMissionAsync(dbContext, supervisorId, internId, missionId);
        var fileName = "brief.pdf";
        var content = new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x32, 0x33, 0x34 };
        var storageUrl = "/uploads/missions/" + missionId.ToString("D") + "/documents/" + fileName;
        dbContext.MissionDocuments.Add(new MissionDocument
        {
            Id = documentId,
            MissionId = missionId,
            FileName = "Brief.pdf",
            FileUrl = storageUrl,
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = supervisorId,
            SourceType = "file"
        });
        await dbContext.SaveChangesAsync();

        var storage = new InMemoryFileStorageService();
        storage.Store(storageUrl, fileName, "application/pdf", content);

        var controller = CreateController(dbContext, storage, internId, UserRole.Intern);
        var result = await controller.DownloadDocument(missionId, documentId, CancellationToken.None);

        var streamResult = Assert.IsType<FileStreamResult>(result);
        Assert.Equal("application/pdf", streamResult.ContentType);
        Assert.Equal("Brief.pdf", streamResult.FileDownloadName);
        Assert.True(streamResult.EnableRangeProcessing);

        using var memory = new MemoryStream();
        await streamResult.FileStream.CopyToAsync(memory);
        Assert.Equal(content, memory.ToArray());
    }

    [Fact]
    public async Task DownloadDocument_DocumentFromDifferentMission_ReturnsNotFound()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var otherMissionId = Guid.NewGuid();
        var otherDocumentId = Guid.NewGuid();
        await SeedAssignedMissionAsync(dbContext, supervisorId, internId, missionId);

        dbContext.Missions.Add(new Mission
        {
            Id = otherMissionId,
            SupervisorId = supervisorId,
            InternId = Guid.NewGuid(),
            Title = "Other mission",
            Description = "Different mission",
            SkillsJson = "[]",
            Tools = string.Empty,
            Level = "junior",
            Status = "active",
            CreatedAt = DateTime.UtcNow
        });
        dbContext.MissionDocuments.Add(new MissionDocument
        {
            Id = otherDocumentId,
            MissionId = otherMissionId,
            FileName = "Secret.pdf",
            FileUrl = "/uploads/missions/" + otherMissionId.ToString("D") + "/documents/secret.pdf",
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = supervisorId,
            SourceType = "file"
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, new InMemoryFileStorageService(), internId, UserRole.Intern);
        var result = await controller.DownloadDocument(missionId, otherDocumentId, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task DownloadDocument_UnassignedIntern_ReturnsForbidden()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var assignedInternId = Guid.NewGuid();
        var otherInternId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var documentId = Guid.NewGuid();
        await SeedAssignedMissionAsync(dbContext, supervisorId, assignedInternId, missionId);
        dbContext.MissionDocuments.Add(new MissionDocument
        {
            Id = documentId,
            MissionId = missionId,
            FileName = "Brief.pdf",
            FileUrl = "/uploads/missions/" + missionId.ToString("D") + "/documents/brief.pdf",
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = supervisorId,
            SourceType = "file"
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, new InMemoryFileStorageService(), otherInternId, UserRole.Intern);
        var result = await controller.DownloadDocument(missionId, documentId, CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task DownloadDocument_UrlDocument_ReturnsNotFound()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var documentId = Guid.NewGuid();
        await SeedAssignedMissionAsync(dbContext, supervisorId, internId, missionId);
        dbContext.MissionDocuments.Add(new MissionDocument
        {
            Id = documentId,
            MissionId = missionId,
            FileName = "Reference",
            FileUrl = "https://example.com/reference",
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = supervisorId,
            SourceType = "url"
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, new InMemoryFileStorageService(), internId, UserRole.Intern);
        var result = await controller.DownloadDocument(missionId, documentId, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task DownloadDocument_FileMissingOnDisk_ReturnsNotFound()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var documentId = Guid.NewGuid();
        await SeedAssignedMissionAsync(dbContext, supervisorId, internId, missionId);
        dbContext.MissionDocuments.Add(new MissionDocument
        {
            Id = documentId,
            MissionId = missionId,
            FileName = "Brief.pdf",
            FileUrl = "/uploads/missions/" + missionId.ToString("D") + "/documents/missing.pdf",
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = supervisorId,
            SourceType = "file"
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, new InMemoryFileStorageService(), internId, UserRole.Intern);
        var result = await controller.DownloadDocument(missionId, documentId, CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task SupervisorService_ListDocuments_StillRequiresOwnership()
    {
        await using var dbContext = TestDbContext.Create();
        var owningSupervisorId = Guid.NewGuid();
        var otherSupervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        await SeedAssignedMissionAsync(dbContext, owningSupervisorId, internId, missionId);
        dbContext.MissionDocuments.Add(new MissionDocument
        {
            Id = Guid.NewGuid(),
            MissionId = missionId,
            FileName = "Brief.pdf",
            FileUrl = "/uploads/missions/" + missionId.ToString("D") + "/documents/brief.pdf",
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = owningSupervisorId,
            SourceType = "file"
        });
        await dbContext.SaveChangesAsync();

        var storage = new InMemoryFileStorageService();
        var service = new MissionDocumentsService(
            dbContext,
            storage,
            NullLogger<MissionDocumentsService>.Instance);

        var documents = await service.GetDocumentsAsync(missionId, owningSupervisorId, CancellationToken.None);
        Assert.Single(documents);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.GetDocumentsAsync(missionId, otherSupervisorId, CancellationToken.None));
    }

    [Fact]
    public async Task SupervisorService_InternCaller_StillBlocked()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        await SeedAssignedMissionAsync(dbContext, supervisorId, internId, missionId);

        var storage = new InMemoryFileStorageService();
        var service = new MissionDocumentsService(
            dbContext,
            storage,
            NullLogger<MissionDocumentsService>.Instance);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.GetDocumentsAsync(missionId, internId, CancellationToken.None));
    }

    private static InternMissionDocumentsController CreateController(
        AppDbContext dbContext,
        IFileStorageService fileStorageService,
        Guid userId,
        UserRole role)
    {
        var service = new InternMissionDocumentsService(
            dbContext,
            fileStorageService,
            NullLogger<InternMissionDocumentsService>.Instance);

        var controller = new InternMissionDocumentsController(
            service,
            NullLogger<InternMissionDocumentsController>.Instance)
        {
            ControllerContext = TestUsers.ControllerContext(userId, role)
        };

        return controller;
    }

    private static async Task SeedAssignedMissionAsync(
        AppDbContext dbContext,
        Guid supervisorId,
        Guid internId,
        Guid missionId)
    {
        var now = DateTime.UtcNow;

        dbContext.Users.Add(TestUsers.Create(supervisorId, UserRole.Supervisor));
        dbContext.Users.Add(TestUsers.Create(internId, UserRole.Intern));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            InternId = internId,
            Title = "Assigned mission",
            Description = "Mission for the intern",
            SkillsJson = "[]",
            Tools = string.Empty,
            Level = "junior",
            Status = "active",
            CreatedAt = now
        });
        await dbContext.SaveChangesAsync();
    }

    private static async Task SeedAssignedMissionViaAssignmentRecordAsync(
        AppDbContext dbContext,
        Guid supervisorId,
        Guid internId,
        Guid missionId)
    {
        var now = DateTime.UtcNow;

        dbContext.Users.Add(TestUsers.Create(supervisorId, UserRole.Supervisor));
        dbContext.Users.Add(TestUsers.Create(internId, UserRole.Intern));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            InternId = null,
            Title = "Multi-intern mission",
            Description = "Mission for the intern via assignment",
            SkillsJson = "[]",
            Tools = string.Empty,
            Level = "junior",
            Status = "active",
            CreatedAt = now
        });
        dbContext.MissionInternAssignments.Add(new MissionInternAssignment
        {
            MissionId = missionId,
            InternId = internId,
            AssignedAt = now
        });
        await dbContext.SaveChangesAsync();
    }

    private sealed class InMemoryFileStorageService : IFileStorageService
    {
        private readonly Dictionary<string, (string FileName, string ContentType, byte[] Content)> files = new(StringComparer.OrdinalIgnoreCase);

        public void Store(string storageKeyOrUrl, string fileName, string contentType, byte[] content)
        {
            files[Normalize(storageKeyOrUrl)] = (fileName, contentType, content);
        }

        public Task<StoredFileInfo> SaveAsync(FileStorageSaveRequest request, CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        public Task<FileStorageReadResult?> OpenReadAsync(string storageKeyOrUrl, CancellationToken cancellationToken)
        {
            if (!files.TryGetValue(Normalize(storageKeyOrUrl), out var entry))
            {
                return Task.FromResult<FileStorageReadResult?>(null);
            }

            Stream stream = new MemoryStream(entry.Content, writable: false);
            return Task.FromResult<FileStorageReadResult?>(
                new FileStorageReadResult(stream, entry.FileName, entry.ContentType, entry.Content.LongLength));
        }

        public Task DeleteAsync(string storageKeyOrUrl, CancellationToken cancellationToken)
        {
            files.Remove(Normalize(storageKeyOrUrl));
            return Task.CompletedTask;
        }

        private static string Normalize(string storageKeyOrUrl)
        {
            var normalized = storageKeyOrUrl.Trim().Replace('\\', '/').TrimStart('/');
            if (normalized.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
            {
                normalized = normalized["uploads/".Length..];
            }

            return normalized;
        }
    }
}
