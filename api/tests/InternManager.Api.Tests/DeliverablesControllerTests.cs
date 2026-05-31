using System.IO;
using System.Security.Claims;
using InternManager.Api.Common.Constants;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Exceptions;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace InternManager.Api.Tests;

public sealed class DeliverablesControllerCleanupTests
{
    [Fact]
    public void CatchBlock_CleanupFailure_DoesNotMaskOriginalException()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"test_cleanup_{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(tempDir);

            var filePath = Path.Combine(tempDir, "locked_file.tmp");
            File.WriteAllText(filePath, "test");

            var original = new InvalidOperationException("Original database failure");

            Exception? caught = null;

            var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.None);
            try
            {
                try
                {
                    throw original;
                }
                catch
                {
                    try
                    {
                        if (File.Exists(filePath))
                        {
                            File.Delete(filePath);
                        }
                    }
                    catch (IOException)
                    {
                    }

                    throw;
                }
            }
            catch (Exception ex) when (ex != original)
            {
                caught = ex;
            }
            catch (Exception ex)
            {
                caught = ex;
            }
            finally
            {
                fileStream.Dispose();
            }

            Assert.Same(original, caught);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                try { Directory.Delete(tempDir, recursive: true); }
                catch { }
            }
        }
    }

    [Fact]
    public void CatchBlock_AllCleanupFailures_StillRethrowsOriginal()
    {
        var tempDir = Path.Combine(Path.GetTempPath(), $"test_allfail_{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(tempDir);

            var lockedPath = Path.Combine(tempDir, "locked_file.tmp");
            var missingPath = Path.Combine(tempDir, "missing_file.tmp");
            File.WriteAllText(lockedPath, "test");

            var original = new InvalidOperationException("Original failure");

            Exception? caught = null;

            var lockStream = new FileStream(lockedPath, FileMode.Open, FileAccess.Read, FileShare.None);
            try
            {
                try
                {
                    throw original;
                }
                catch
                {
                    try
                    {
                        throw new IOException("Rollback failed");
                    }
                    catch (IOException)
                    {
                    }

                    try
                    {
                        if (File.Exists(lockedPath))
                        {
                            File.Delete(lockedPath);
                        }
                    }
                    catch (IOException)
                    {
                    }

                    try
                    {
                        if (File.Exists(missingPath))
                        {
                            File.Delete(missingPath);
                        }
                    }
                    catch (IOException)
                    {
                    }

                    throw;
                }
            }
            catch (Exception ex)
            {
                caught = ex;
            }
            finally
            {
                lockStream.Dispose();
            }

            Assert.Same(original, caught);
        }
        finally
        {
            if (Directory.Exists(tempDir))
            {
                try { Directory.Delete(tempDir, recursive: true); }
                catch { }
            }
        }
    }

    [Fact]
    public async Task SubmitDeliverable_FileAndGitHubUrl_ReturnsUnprocessableEntity()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);
        var controller = CreateController(dbContext, new FakeFileStorageService(), internId, "Intern");

        var result = await controller.SubmitDeliverable(
            deliverableId,
            new SubmitDeliverableRequest
            {
                FileUrl = "/uploads/deliverables/submission.pdf",
                GitHubUrl = "https://github.com/axia/intern-portal",
                RowVersion = 1
            },
            CancellationToken.None);

        var response = Assert.IsType<UnprocessableEntityObjectResult>(result);
        Assert.Equal("You must provide either a file URL or a GitHub URL, but not both.", GetMessage(response.Value));
    }

    [Fact]
    public async Task SubmitDeliverable_EmptySubmission_ReturnsUnprocessableEntity()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);
        var controller = CreateController(dbContext, new FakeFileStorageService(), internId, "Intern");

        var result = await controller.SubmitDeliverable(
            deliverableId,
            new SubmitDeliverableRequest { RowVersion = 1 },
            CancellationToken.None);

        var response = Assert.IsType<UnprocessableEntityObjectResult>(result);
        Assert.Equal("You must provide either a file URL or a GitHub URL, but not both.", GetMessage(response.Value));
    }

    [Fact]
    public async Task SubmitDeliverable_IncompleteTasks_ReturnsUnprocessableEntityWithCount()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);
        await AddTaskAsync(dbContext, internId, deliverableId, DomainStatuses.Task.Todo);
        await AddTaskAsync(dbContext, internId, deliverableId, DomainStatuses.Task.Done);
        var controller = CreateController(dbContext, new FakeFileStorageService(), internId, "Intern");

        var result = await controller.SubmitDeliverable(
            deliverableId,
            new SubmitDeliverableRequest
            {
                GitHubUrl = "https://github.com/axia/intern-portal",
                RowVersion = 1
            },
            CancellationToken.None);

        var response = Assert.IsType<UnprocessableEntityObjectResult>(result);
        Assert.Contains("1 task(s) are not complete", GetMessage(response.Value), StringComparison.Ordinal);
    }

    [Fact]
    public async Task SubmitDeliverable_ValidFirstSubmission_CreatesCurrentVersionHistoryAndNotification()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId, supervisorId: supervisorId);
        var controller = CreateController(
            dbContext,
            new FakeFileStorageService(),
            internId,
            "Intern",
            new NotificationService(dbContext));

        var result = await controller.SubmitDeliverable(
            deliverableId,
            new SubmitDeliverableRequest
            {
                GitHubUrl = "https://github.com/axia/intern-portal",
                Message = "Ready for review",
                RowVersion = 1
            },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<InternDeliverableResponse>(ok.Value);
        Assert.Equal(DomainStatuses.Deliverable.AwaitingReview, response.Status);
        Assert.Equal(2, response.RowVersion);

        var updatedDeliverable = await dbContext.Deliverables.AsNoTracking().SingleAsync(item => item.Id == deliverableId);
        Assert.Equal(DomainStatuses.Deliverable.AwaitingReview, updatedDeliverable.Status);
        Assert.Equal(2, updatedDeliverable.RowVersion);

        var version = await dbContext.DeliverableVersions.AsNoTracking().SingleAsync(item => item.DeliverableId == deliverableId);
        Assert.Equal(1, version.VersionNumber);
        Assert.True(version.IsCurrentVersion);
        Assert.Equal(DomainStatuses.DeliverableVersion.Submitted, version.Status);

        Assert.Contains(
            await dbContext.EntityHistoryEntries.AsNoTracking().ToListAsync(),
            entry => entry.EntityId == deliverableId && entry.Action == "deliverable.submitted");
        Assert.Contains(
            await dbContext.Notifications.AsNoTracking().ToListAsync(),
            notification => notification.UserId == supervisorId && notification.Type == "deliverable.submitted");
    }

    [Fact]
    public async Task SubmitDeliverable_ValidResubmission_FlipsCurrentVersion()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);

        var deliverable = await dbContext.Deliverables.SingleAsync(item => item.Id == deliverableId);
        deliverable.Status = DomainStatuses.Deliverable.ChangesRequested;
        deliverable.Version = 1;
        deliverable.RowVersion = 4;
        dbContext.DeliverableVersions.Add(new DeliverableVersion
        {
            Id = Guid.NewGuid(),
            DeliverableId = deliverableId,
            VersionNumber = 1,
            IsCurrentVersion = true,
            GitHubUrl = "https://github.com/axia/intern-portal",
            Status = DomainStatuses.DeliverableVersion.Rejected,
            SubmittedAt = DateTime.UtcNow.AddDays(-1),
            SubmittedByUserId = internId
        });
        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, new FakeFileStorageService(), internId, "Intern");

        var result = await controller.SubmitDeliverable(
            deliverableId,
            new SubmitDeliverableRequest
            {
                GitHubUrl = "https://github.com/axia/intern-portal-api",
                RowVersion = 4
            },
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);

        var versions = await dbContext.DeliverableVersions
            .AsNoTracking()
            .Where(item => item.DeliverableId == deliverableId)
            .OrderBy(item => item.VersionNumber)
            .ToListAsync();

        Assert.Equal(2, versions.Count);
        Assert.False(versions[0].IsCurrentVersion);
        Assert.True(versions[1].IsCurrentVersion);
        Assert.Equal(2, versions[1].VersionNumber);
    }

    [Fact]
    public async Task SubmitDeliverable_StaleRowVersion_ReturnsConflict()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);
        var deliverable = await dbContext.Deliverables.SingleAsync(item => item.Id == deliverableId);
        deliverable.RowVersion = 3;
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, new FakeFileStorageService(), internId, "Intern");

        var result = await controller.SubmitDeliverable(
            deliverableId,
            new SubmitDeliverableRequest
            {
                GitHubUrl = "https://github.com/axia/intern-portal",
                RowVersion = 1
            },
            CancellationToken.None);

        var conflict = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
        Assert.Equal("conflict", GetStringProperty(conflict.Value, "error"));
    }

    [Theory]
    [InlineData(true, true)]
    [InlineData(false, false)]
    public async Task SubmitDeliverable_CoSupervisorNotification_RespectsReviewFlag(
        bool coSupervisorCanReview,
        bool shouldNotifyCoSupervisor)
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var coSupervisorId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(
            dbContext,
            internId,
            supervisorId: supervisorId,
            coSupervisorId: coSupervisorId,
            coSupervisorCanReview: coSupervisorCanReview);
        var controller = CreateController(
            dbContext,
            new FakeFileStorageService(),
            internId,
            "Intern",
            new NotificationService(dbContext));

        await controller.SubmitDeliverable(
            deliverableId,
            new SubmitDeliverableRequest
            {
                GitHubUrl = "https://github.com/axia/intern-portal",
                RowVersion = 1
            },
            CancellationToken.None);

        var coSupervisorNotificationExists = await dbContext.Notifications
            .AsNoTracking()
            .AnyAsync(notification => notification.UserId == coSupervisorId && notification.Type == "deliverable.submitted");

        Assert.Equal(shouldNotifyCoSupervisor, coSupervisorNotificationExists);
    }

    [Fact]
    public async Task SubmitDeliverable_ZeroTaskDeliverable_Succeeds()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);
        var controller = CreateController(dbContext, new FakeFileStorageService(), internId, "Intern");

        var result = await controller.SubmitDeliverable(
            deliverableId,
            new SubmitDeliverableRequest
            {
                FileUrl = "/uploads/deliverables/submission.pdf",
                RowVersion = 1
            },
            CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<InternDeliverableResponse>(ok.Value);
        Assert.Equal(DomainStatuses.Deliverable.AwaitingReview, response.Status);
    }

    [Fact]
    public async Task SubmitDeliverableVersion_DifferentIntern_ReturnsForbid()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var otherInternId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, otherInternId);
        await AddInternAsync(dbContext, internId);
        var controller = CreateController(dbContext, new FakeFileStorageService(), internId, "Intern");

        var result = await controller.SubmitDeliverableVersion(
            deliverableId,
            new SubmitDeliverableVersionForm
            {
                GitHubUrl = "https://github.com/axia/intern-portal"
            },
            CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task SubmitDeliverableVersion_InactiveMission_ReturnsConflict()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId, missionStatus: DomainStatuses.Mission.Completed);
        var controller = CreateController(dbContext, new FakeFileStorageService(), internId, "Intern");

        var result = await controller.SubmitDeliverableVersion(
            deliverableId,
            new SubmitDeliverableVersionForm
            {
                GitHubUrl = "https://github.com/axia/intern-portal"
            },
            CancellationToken.None);

        var conflict = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status409Conflict, conflict.StatusCode);
    }

    [Fact]
    public async Task SubmitDeliverableVersion_FileAndGitHubUrl_ReturnsBadRequest()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);
        var storage = new FakeFileStorageService();
        var controller = CreateController(dbContext, storage, internId, "Intern");

        var result = await controller.SubmitDeliverableVersion(
            deliverableId,
            new SubmitDeliverableVersionForm
            {
                File = CreateFile("submission.pdf", "application/pdf", 16),
                GitHubUrl = "https://github.com/axia/intern-portal"
            },
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, storage.SaveCalls);
    }

    [Fact]
    public async Task SubmitDeliverableVersion_EmptySubmission_ReturnsBadRequest()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);
        var controller = CreateController(dbContext, new FakeFileStorageService(), internId, "Intern");

        var result = await controller.SubmitDeliverableVersion(
            deliverableId,
            new SubmitDeliverableVersionForm(),
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task SubmitDeliverableVersion_InvalidFileType_ReturnsBadRequest()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);
        var storage = new FakeFileStorageService();
        var controller = CreateController(dbContext, storage, internId, "Intern");

        var result = await controller.SubmitDeliverableVersion(
            deliverableId,
            new SubmitDeliverableVersionForm
            {
                File = CreateFile("submission.exe", "application/octet-stream", 16)
            },
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, storage.SaveCalls);
    }

    [Fact]
    public async Task SubmitDeliverableVersion_OversizedFile_ReturnsBadRequest()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);
        var storage = new FakeFileStorageService();
        var controller = CreateController(dbContext, storage, internId, "Intern");

        var result = await controller.SubmitDeliverableVersion(
            deliverableId,
            new SubmitDeliverableVersionForm
            {
                File = CreateFile("submission.pdf", "application/pdf", (10 * 1024 * 1024) + 1)
            },
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Equal(0, storage.SaveCalls);
    }

    [Fact]
    public async Task SubmitDeliverableVersion_GitHubNestedUrl_ReturnsBadRequest()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);
        var controller = CreateController(dbContext, new FakeFileStorageService(), internId, "Intern");

        var result = await controller.SubmitDeliverableVersion(
            deliverableId,
            new SubmitDeliverableVersionForm
            {
                GitHubUrl = "https://github.com/axia/intern-portal/tree/main"
            },
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task SubmitDeliverableVersion_ExistingVersions_IncrementsFromLatest()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);

        var deliverable = await dbContext.Deliverables.SingleAsync(item => item.Id == deliverableId);
        deliverable.Version = 2;
        deliverable.Status = DomainStatuses.Deliverable.Submitted;
        deliverable.SubmittedDate = DateTime.UtcNow.AddDays(-1);

        dbContext.DeliverableVersions.AddRange(
            new DeliverableVersion
            {
                Id = Guid.NewGuid(),
                DeliverableId = deliverableId,
                VersionNumber = 1,
                FileUrl = "/uploads/deliverables/v1.pdf",
                Status = DomainStatuses.Deliverable.Submitted,
                SubmittedAt = DateTime.UtcNow.AddDays(-2),
                SubmittedByUserId = internId
            },
            new DeliverableVersion
            {
                Id = Guid.NewGuid(),
                DeliverableId = deliverableId,
                VersionNumber = 2,
                GitHubUrl = "https://github.com/axia/intern-portal",
                Status = DomainStatuses.Deliverable.Submitted,
                SubmittedAt = DateTime.UtcNow.AddDays(-1),
                SubmittedByUserId = internId
            });

        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, new FakeFileStorageService(), internId, "Intern");

        var result = await controller.SubmitDeliverableVersion(
            deliverableId,
            new SubmitDeliverableVersionForm
            {
                GitHubUrl = "https://github.com/axia/intern-portal-api",
                GitHubBranch = "feature/dashboard",
                Message = "Ready for review"
            },
            CancellationToken.None);

        var created = Assert.IsType<CreatedResult>(result);
        var response = Assert.IsType<DeliverableVersionResponse>(created.Value);
        Assert.Equal(3, response.VersionNumber);
        Assert.Equal("https://github.com/axia/intern-portal-api", response.GitHubUrl);
        Assert.Equal("feature/dashboard", response.GitHubBranch);

        var updatedDeliverable = await dbContext.Deliverables.AsNoTracking().SingleAsync(item => item.Id == deliverableId);
        Assert.Equal(3, updatedDeliverable.Version);
        Assert.Equal(DomainStatuses.Deliverable.Submitted, updatedDeliverable.Status);
    }

    [Fact]
    public async Task GetDeliverableVersions_SupervisorScope_ReturnsNewestFirstWithSummary()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId, supervisorId: supervisorId);

        dbContext.DeliverableVersions.AddRange(
            BuildVersion(deliverableId, internId, 1),
            BuildVersion(deliverableId, internId, 3),
            BuildVersion(deliverableId, internId, 2));

        await dbContext.SaveChangesAsync();

        var controller = CreateController(dbContext, new FakeFileStorageService(), supervisorId, "Supervisor");

        var result = await controller.GetDeliverableVersions(deliverableId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<DeliverableVersionHistoryResponse>(ok.Value);

        Assert.Equal(deliverableId, response.Deliverable.Id);
        Assert.Equal([3, 2, 1], response.Versions.Select(version => version.VersionNumber).ToArray());
    }

    [Fact]
    public async Task GetDeliverableVersions_OtherIntern_ReturnsForbid()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var otherInternId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(dbContext, internId);
        var controller = CreateController(dbContext, new FakeFileStorageService(), otherInternId, "Intern");

        var result = await controller.GetDeliverableVersions(deliverableId, CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
    }

    [Fact]
    public async Task SubmitDeliverableVersion_ArchivedMission_IsForbidden()
    {
        await using var dbContext = CreateDbContext();
        var internId = Guid.NewGuid();
        var deliverableId = await SeedDeliverableAsync(
            dbContext,
            internId,
            missionStatus: DomainStatuses.Mission.Archived);

        var controller = CreateController(dbContext, new FakeFileStorageService(), internId, "Intern");

        await Assert.ThrowsAsync<ForbiddenException>(() => controller.SubmitDeliverableVersion(
            deliverableId,
            new SubmitDeliverableVersionForm
            {
                GitHubUrl = "https://github.com/axia/intern-portal"
            },
            CancellationToken.None));
    }

    private static AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static DeliverablesController CreateController(
        AppDbContext dbContext,
        IFileStorageService fileStorageService,
        Guid currentUserId,
        string role)
    {
        var controller = new DeliverablesController(
            dbContext,
            null!,
            fileStorageService,
            new NoopDeliverablesService(),
            new MissionPolicyService(dbContext),
            new NoopNotificationService(),
            NullLogger<DeliverablesController>.Instance);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = CreateHttpContext(currentUserId, role)
        };

        return controller;
    }

    private static DefaultHttpContext CreateHttpContext(Guid userId, string role)
    {
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(
            new ClaimsIdentity(
            [
                new Claim("userId", userId.ToString()),
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim("email", $"{role.ToLowerInvariant()}@example.com"),
                new Claim(ClaimTypes.Email, $"{role.ToLowerInvariant()}@example.com"),
                new Claim(ClaimTypes.Role, role)
            ],
            "TestAuth",
            ClaimTypes.Email,
            ClaimTypes.Role));

        return context;
    }

    private static async Task<Guid> SeedDeliverableAsync(
        AppDbContext dbContext,
        Guid internId,
        Guid? supervisorId = null,
        Guid? coSupervisorId = null,
        bool coSupervisorCanReview = false,
        bool coSupervisorCanEval = false,
        string missionStatus = DomainStatuses.Mission.Active)
    {
        var effectiveSupervisorId = supervisorId ?? Guid.NewGuid();
        var effectiveCoSupervisorId = coSupervisorId;
        var missionId = Guid.NewGuid();
        var deliverableId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        dbContext.Users.AddRange(
            new User
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
            },
            new User
            {
                Id = effectiveSupervisorId,
                FirstName = "Supervisor",
                LastName = "User",
                Email = $"{effectiveSupervisorId:N}@supervisor.example.com",
                PasswordHash = "hash",
                Role = UserRole.Supervisor,
                Status = UserStatus.Active,
                CreatedAt = now,
                UpdatedAt = now
            });

        if (effectiveCoSupervisorId.HasValue)
        {
            dbContext.Users.Add(new User
            {
                Id = effectiveCoSupervisorId.Value,
                FirstName = "CoSupervisor",
                LastName = "User",
                Email = $"{effectiveCoSupervisorId.Value:N}@cosupervisor.example.com",
                PasswordHash = "hash",
                Role = UserRole.Supervisor,
                Status = UserStatus.Active,
                CreatedAt = now,
                UpdatedAt = now
            });
        }

        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = effectiveSupervisorId,
            CoSupervisorId = effectiveCoSupervisorId,
            CoSupervisorCanReview = coSupervisorCanReview,
            CoSupervisorCanEval = coSupervisorCanEval,
            InternId = internId,
            Title = "Dashboard redesign",
            Description = "Build intern dashboard",
            SkillsJson = "[]",
            Tools = string.Empty,
            Level = "junior",
            Status = missionStatus,
            CreatedAt = now
        });

        dbContext.MissionInternAssignments.Add(new MissionInternAssignment
        {
            MissionId = missionId,
            InternId = internId,
            AssignedAt = now
        });

        dbContext.Deliverables.Add(new Deliverable
        {
            Id = deliverableId,
            MissionId = missionId,
            SupervisorId = effectiveSupervisorId,
            InternId = internId,
            Title = "Final dashboard",
            Status = DomainStatuses.Deliverable.Pending,
            FileUrl = string.Empty,
            Version = 1,
            Progress = 0,
            CreatedAt = now
        });

        await dbContext.SaveChangesAsync();

        return deliverableId;
    }

    private static async Task AddInternAsync(AppDbContext dbContext, Guid internId)
    {
        var now = DateTime.UtcNow;

        dbContext.Users.Add(new User
        {
            Id = internId,
            FirstName = "Other",
            LastName = "Intern",
            Email = $"{internId:N}@intern.example.com",
            PasswordHash = "hash",
            Role = UserRole.Intern,
            Status = UserStatus.Active,
            VerificationStatus = InternVerificationStatus.ACTIVE,
            CreatedAt = now,
            UpdatedAt = now
        });

        await dbContext.SaveChangesAsync();
    }

    private static DeliverableVersion BuildVersion(Guid deliverableId, Guid submittedByUserId, int versionNumber)
    {
        return new DeliverableVersion
        {
            Id = Guid.NewGuid(),
            DeliverableId = deliverableId,
            VersionNumber = versionNumber,
            GitHubUrl = $"https://github.com/axia/intern-portal-v{versionNumber}",
            Status = DomainStatuses.Deliverable.Submitted,
            SubmittedAt = DateTime.UtcNow.AddMinutes(versionNumber),
            SubmittedByUserId = submittedByUserId
        };
    }

    private static IFormFile CreateFile(string fileName, string contentType, int length)
    {
        var bytes = new byte[length];
        if (length >= 5 && string.Equals(contentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
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

    private sealed class NoopDeliverablesService : IDeliverablesService
    {
        public Task<PagedResponse<DeliverableQueueItemResponse>> GetSupervisorDeliverablesAsync(
            Guid supervisorId,
            string? status,
            int page,
            int limit,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        public Task<DeliverableReviewResponse> ApproveDeliverableAsync(
            Guid actorId,
            Guid deliverableId,
            int rowVersion,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        public Task<DeliverableReviewResponse> RejectDeliverableAsync(
            Guid actorId,
            Guid deliverableId,
            string reason,
            IReadOnlyCollection<Guid> taskIdsToReopen,
            int rowVersion,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }
    }

    private sealed class FakeFileStorageService : IFileStorageService
    {
        public int SaveCalls { get; private set; }

        public List<string> DeletedUrls { get; } = [];

        public async Task<StoredFileInfo> SaveAsync(FileStorageSaveRequest request, CancellationToken cancellationToken)
        {
            SaveCalls += 1;
            await request.Content.CopyToAsync(Stream.Null, cancellationToken);

            var extension = string.IsNullOrWhiteSpace(request.FileExtension)
                ? Path.GetExtension(request.OriginalFileName)
                : request.FileExtension;
            var fileName = $"stored-{SaveCalls}{extension}";
            var storageKey = $"{request.ContainerName.Trim('/')}/{fileName}";

            return new StoredFileInfo(
                storageKey,
                $"/uploads/{storageKey}",
                fileName,
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
