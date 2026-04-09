using InternManager.Api.Common.Enums;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services;

public sealed class InternSkillsService(AppDbContext dbContext) : IInternSkillsService
{
    public async Task<IReadOnlyList<InternDetailSkillResponse>> ReplaceSkillsAsync(
        Guid internId,
        IReadOnlyCollection<Guid>? skillIds,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var intern = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(user => user.Id == internId && user.Role == UserRole.Intern, cancellationToken);

        if (intern is null)
        {
            throw new KeyNotFoundException("Intern not found.");
        }

        var profile = await EnsureProfileAsync(internId, cancellationToken);

        var requestedSkillIds = (skillIds ?? Array.Empty<Guid>())
            .Where(value => value != Guid.Empty)
            .Distinct()
            .ToHashSet();

        if (requestedSkillIds.Count > 0)
        {
            var existingSkillIds = await dbContext.Skills
                .AsNoTracking()
                .Where(skill => requestedSkillIds.Contains(skill.Id))
                .Select(skill => skill.Id)
                .ToListAsync(cancellationToken);

            if (existingSkillIds.Count != requestedSkillIds.Count)
            {
                throw new ArgumentException("One or more skill ids are invalid.");
            }
        }

        var currentLinks = await dbContext.InternProfileSkills
            .Where(item => item.InternProfileId == profile.Id)
            .ToListAsync(cancellationToken);

        var linksToRemove = currentLinks
            .Where(link => !requestedSkillIds.Contains(link.SkillId))
            .ToList();

        if (linksToRemove.Count > 0)
        {
            dbContext.InternProfileSkills.RemoveRange(linksToRemove);
        }

        var currentSkillIds = currentLinks.Select(link => link.SkillId).ToHashSet();

        var linksToAdd = requestedSkillIds
            .Where(skillId => !currentSkillIds.Contains(skillId))
            .Select(skillId => new InternProfileSkill
            {
                InternProfileId = profile.Id,
                SkillId = skillId,
                CreatedAt = DateTime.UtcNow
            })
            .ToList();

        if (linksToAdd.Count > 0)
        {
            dbContext.InternProfileSkills.AddRange(linksToAdd);
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = actorUserId,
            Actor = string.IsNullOrWhiteSpace(actorName) ? "unknown" : actorName.Trim(),
            Action = "intern.profile.skills.replace",
            Entity = $"intern:{internId} count:{requestedSkillIds.Count}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var skills = await dbContext.InternProfileSkills
            .AsNoTracking()
            .Where(item => item.InternProfileId == profile.Id)
            .OrderBy(item => item.Skill == null ? string.Empty : item.Skill.Name)
            .Select(item => new InternDetailSkillResponse
            {
                Id = item.SkillId,
                Name = item.Skill != null ? item.Skill.Name : string.Empty
            })
            .ToListAsync(cancellationToken);

        return skills;
    }

    private async Task<InternProfile> EnsureProfileAsync(Guid internId, CancellationToken cancellationToken)
    {
        var profile = await dbContext.InternProfiles
            .FirstOrDefaultAsync(item => item.InternId == internId, cancellationToken);

        if (profile is not null)
        {
            return profile;
        }

        profile = new InternProfile
        {
            Id = Guid.NewGuid(),
            InternId = internId,
            UniversityId = null,
            Major = string.Empty,
            CurrentYearOfStudy = string.Empty,
            ExpectedGraduationDate = null,
            WorkPreference = null,
            CvFileUrl = null,
            StartDate = null,
            EndDate = null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        dbContext.InternProfiles.Add(profile);
        await dbContext.SaveChangesAsync(cancellationToken);

        return profile;
    }
}
