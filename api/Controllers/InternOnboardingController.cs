using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Middleware;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace InternManager.Api.Controllers;

[ApiController]
[Route("api/interns/me/onboarding")]
// RBAC policy: endpoints available to Supervisor/Intern must also be available to Admin and SuperAdmin.
[Authorize(Roles = "SuperAdmin,Admin,Intern")]
public sealed class InternOnboardingController(
    AppDbContext dbContext,
    INotificationService notificationService,
    ICvStorageService cvStorageService,
    ILogger<InternOnboardingController> logger) : ControllerBase
{
    [HttpPost(Name = "SubmitMyInternOnboarding")]
    [EnableRateLimiting("upload")]
    [ServiceFilter(typeof(InternOnboardingValidationFilter))]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Submit([FromForm] InternOnboardingForm request, CancellationToken cancellationToken)
    {
        _ = request;

        var internId = UserContextHelper.ResolveCurrentUserId(User);
        if (!internId.HasValue)
        {
            return Unauthorized();
        }

        var intern = await dbContext.Users
            .FirstOrDefaultAsync(user => user.Id == internId.Value && user.Role == UserRole.Intern, cancellationToken);

        if (intern is null)
        {
            return NotFound(new { message = "Intern not found." });
        }

        if (intern.VerificationStatus != InternVerificationStatus.INCOMPLETE)
        {
            return Conflict(new { message = "Onboarding has already been submitted and cannot be resubmitted." });
        }

        if (!HttpContext.Items.TryGetValue(InternOnboardingValidationFilter.ValidatedPayloadItemKey, out var payloadValue) ||
            payloadValue is not ValidatedInternOnboardingPayload payload)
        {
            return BadRequest(new { message = "Invalid onboarding payload." });
        }

        string? uploadedCvFileUrl = null;

        try
        {
            uploadedCvFileUrl = await cvStorageService.UploadAsync(payload.Cv, intern.Id, cancellationToken);

            var strategy = dbContext.Database.CreateExecutionStrategy();

            await strategy.ExecuteAsync(async () =>
            {
                dbContext.ChangeTracker.Clear();
                if (dbContext.Database.IsRelational())
                {
                    await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

                    var profile = await dbContext.InternProfiles
                        .FirstOrDefaultAsync(item => item.InternId == intern.Id, cancellationToken);

                    if (profile is null)
                    {
                        profile = new InternProfile
                        {
                            Id = Guid.NewGuid(),
                            InternId = intern.Id,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };

                        dbContext.InternProfiles.Add(profile);
                    }

                    profile.UniversityId = payload.UniversityId;
                    profile.Major = payload.Major;
                    profile.CurrentYearOfStudy = payload.CurrentYearOfStudy;
                    profile.WorkPreference = payload.WorkPreference;
                    profile.PhoneNumber = payload.PhoneNumber;
                    profile.CvFileUrl = uploadedCvFileUrl;

                    intern.VerificationStatus = InternVerificationStatus.PENDING;

                    dbContext.AuditLogs.Add(new AuditLog
                    {
                        ActorUserId = intern.Id,
                        Actor = UserContextHelper.ResolveCurrentActorName(User),
                        Action = "intern.onboarding.submit",
                        Entity = $"intern:{intern.Id}",
                        Timestamp = DateTime.UtcNow
                    });

                    await dbContext.SaveChangesAsync(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                }
                else
                {
                    var profile = await dbContext.InternProfiles
                        .FirstOrDefaultAsync(item => item.InternId == intern.Id, cancellationToken);

                    if (profile is null)
                    {
                        profile = new InternProfile
                        {
                            Id = Guid.NewGuid(),
                            InternId = intern.Id,
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };

                        dbContext.InternProfiles.Add(profile);
                    }

                    profile.UniversityId = payload.UniversityId;
                    profile.Major = payload.Major;
                    profile.CurrentYearOfStudy = payload.CurrentYearOfStudy;
                    profile.WorkPreference = payload.WorkPreference;
                    profile.PhoneNumber = payload.PhoneNumber;
                    profile.CvFileUrl = uploadedCvFileUrl;

                    intern.VerificationStatus = InternVerificationStatus.PENDING;

                    dbContext.AuditLogs.Add(new AuditLog
                    {
                        ActorUserId = intern.Id,
                        Actor = UserContextHelper.ResolveCurrentActorName(User),
                        Action = "intern.onboarding.submit",
                        Entity = $"intern:{intern.Id}",
                        Timestamp = DateTime.UtcNow
                    });

                    await dbContext.SaveChangesAsync(cancellationToken);
                }
            });
        }
        catch (Exception uploadOrRollbackException)
        {
            if (!string.IsNullOrWhiteSpace(uploadedCvFileUrl))
            {
                try
                {
                    await cvStorageService.DeleteAsync(uploadedCvFileUrl, cancellationToken);
                }
                catch (Exception rollbackException)
                {
                    logger.LogError(rollbackException, "Uploaded CV rollback failed for intern {InternId}.", intern.Id);
                }
            }

            logger.LogError(uploadOrRollbackException, "Onboarding submission failed for intern {InternId}.", intern.Id);
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An unexpected error occurred while submitting onboarding." });
        }

        try
        {
            QueueInternSubmittedNotification(intern.Id);
            await QueueAdminReviewNotificationsAsync(intern, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception notificationException)
        {
            logger.LogError(notificationException, "Onboarding notifications failed for intern {InternId}.", intern.Id);
        }

        return Ok(new
        {
            message = "Onboarding submitted successfully.",
            status = intern.Status.ToString(),
            verificationStatus = intern.VerificationStatus.ToString(),
            cvFileUrl = uploadedCvFileUrl
        });
    }

    private void QueueInternSubmittedNotification(Guid internId)
    {
        notificationService.QueueNotification(
            internId,
            "intern.onboarding.submitted",
            "Onboarding submitted",
            "Your profile has been submitted and is currently under review. Your verification status is now Pending.",
            $"intern:{internId}");
    }

    private async Task QueueAdminReviewNotificationsAsync(User intern, CancellationToken cancellationToken)
    {
        var adminUserIds = await dbContext.Users
            .AsNoTracking()
            .Where(user => user.Role == UserRole.Admin || user.Role == UserRole.Manager)
            .Select(user => user.Id)
            .ToListAsync(cancellationToken);

        var internFullName = $"{intern.FirstName} {intern.LastName}".Trim();

        foreach (var adminUserId in adminUserIds)
        {
            notificationService.QueueNotification(
                adminUserId,
                "intern.onboarding.pending-verification",
                "Intern onboarding pending verification",
                $"A new intern {internFullName} has completed their onboarding and is pending verification. Please review their profile, assign them to a project, and assign a supervisor.",
                $"intern:{intern.Id}");
        }
    }
}
