using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Tests;

public sealed class AdminSettingsControllerBehaviorTests
{
    [Fact]
    public async Task DepartmentEndpoints_CoverReadDeleteAndValidationFailures()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var departmentId = Guid.NewGuid();
        dbContext.Users.Add(TestUsers.Create(actorId, UserRole.Admin, "admin@example.com"));
        dbContext.Departments.Add(new Department { Id = departmentId, Name = "Engineering" });
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, actorId);

        var blank = await controller.CreateDepartment(new UpsertReferentialRequest { Name = "   " }, CancellationToken.None);
        var list = await controller.GetDepartments(CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(blank);
        var okList = Assert.IsType<OkObjectResult>(list);
        Assert.Single((IEnumerable<object>)ReadAnonymousProperty(okList.Value, "data")!);

        var getById = await controller.GetDepartmentById(departmentId, CancellationToken.None);
        var missingById = await controller.GetDepartmentById(Guid.NewGuid(), CancellationToken.None);
        Assert.IsType<OkObjectResult>(getById);
        Assert.IsType<NotFoundResult>(missingById);

        var updateBlank = await controller.UpdateDepartment(departmentId, new UpdateReferentialRequest { Name = "" }, CancellationToken.None);
        var updateMissing = await controller.UpdateDepartment(Guid.NewGuid(), new UpdateReferentialRequest { Name = "Finance" }, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(updateBlank);
        Assert.IsType<NotFoundObjectResult>(updateMissing);

        var deleteMissing = await controller.DeleteDepartment(Guid.NewGuid(), CancellationToken.None);
        var deleted = await controller.DeleteDepartment(departmentId, CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(deleteMissing);
        Assert.IsType<NoContentResult>(deleted);
        Assert.False(await dbContext.Departments.AnyAsync(item => item.Id == departmentId));
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "settings.department.delete" && log.Actor == "admin@example.com");
    }

    [Fact]
    public async Task DeleteReferentialEndpoints_ReturnConflictWhenItemsAreInUse()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        var departmentId = Guid.NewGuid();
        var schoolId = Guid.NewGuid();
        var skillId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var internshipTypeId = Guid.NewGuid();
        var internId = Guid.NewGuid();
        var supervisorId = Guid.NewGuid();

        dbContext.Departments.Add(new Department { Id = departmentId, Name = "Engineering" });
        dbContext.Schools.Add(new School { Id = schoolId, Name = "Axia University" });
        dbContext.Skills.Add(new Skill { Id = skillId, Name = "React" });
        dbContext.InternshipTypes.Add(new InternshipType { Id = internshipTypeId, Name = "Summer Internship" });
        dbContext.Users.AddRange(
            TestUsers.Create(actorId, UserRole.Admin, "admin@example.com"),
            TestUsers.Create(supervisorId, UserRole.Supervisor, "supervisor@example.com"),
            TestUsers.Create(internId, UserRole.Intern, "intern@example.com", departmentId: departmentId));
        dbContext.InternProfiles.Add(new InternProfile
        {
            Id = profileId,
            InternId = internId,
            UniversityId = schoolId,
            Major = "Computer Science",
            CurrentYearOfStudy = "licence_2",
            WorkPreference = WorkPreference.Hybrid,
            CvFileUrl = "/uploads/cv.pdf",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        dbContext.InternProfileSkills.Add(new InternProfileSkill
        {
            InternProfileId = profileId,
            SkillId = skillId,
            CreatedAt = DateTime.UtcNow
        });
        dbContext.Missions.Add(new Mission
        {
            Id = Guid.NewGuid(),
            SupervisorId = supervisorId,
            InternshipTypeId = internshipTypeId,
            Title = "Mission",
            Description = "Mission",
            Level = "Summer Internship",
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, actorId);

        var department = await controller.DeleteDepartment(departmentId, CancellationToken.None);
        var school = await controller.DeleteSchool(schoolId, CancellationToken.None);
        var skill = await controller.DeleteSkill(skillId, CancellationToken.None);
        var internshipType = await controller.DeleteInternshipType(internshipTypeId, CancellationToken.None);

        Assert.Equal(StatusCodes.Status409Conflict, Assert.IsType<ObjectResult>(department).StatusCode);
        Assert.Equal(StatusCodes.Status409Conflict, Assert.IsType<ObjectResult>(school).StatusCode);
        Assert.Equal(StatusCodes.Status409Conflict, Assert.IsType<ObjectResult>(skill).StatusCode);
        Assert.Equal(StatusCodes.Status409Conflict, Assert.IsType<ObjectResult>(internshipType).StatusCode);
    }

    [Fact]
    public async Task SchoolSkillAndInternshipTypeEndpoints_ReturnSortedListsAndCreateResponses()
    {
        await using var dbContext = TestDbContext.Create();
        var actorId = Guid.NewGuid();
        dbContext.Users.Add(TestUsers.Create(actorId, UserRole.Admin, "admin@example.com"));
        dbContext.Schools.Add(new School { Id = Guid.NewGuid(), Name = "Zulu School" });
        dbContext.Schools.Add(new School { Id = Guid.NewGuid(), Name = "Alpha School" });
        dbContext.Skills.Add(new Skill { Id = Guid.NewGuid(), Name = "CSharp" });
        dbContext.InternshipTypes.Add(new InternshipType { Id = Guid.NewGuid(), Name = "PFE" });
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, actorId);

        var schools = Assert.IsType<OkObjectResult>(await controller.GetSchools(CancellationToken.None));
        var skillById = Assert.IsType<OkObjectResult>(
            await controller.GetSkillById(dbContext.Skills.Single().Id, CancellationToken.None));
        var typeById = Assert.IsType<OkObjectResult>(
            await controller.GetInternshipTypeById(dbContext.InternshipTypes.Single().Id, CancellationToken.None));
        var invalidSkill = await controller.CreateSkill(new UpsertReferentialRequest { Name = " " }, CancellationToken.None);

        var schoolNames = ((IEnumerable<object>)ReadAnonymousProperty(schools.Value, "data")!)
            .Select(item => ReadAnonymousProperty(item, "name")?.ToString() ?? string.Empty)
            .ToArray();
        Assert.Equal(["Alpha School", "Zulu School"], schoolNames);
        Assert.Equal("CSharp", ReadAnonymousProperty(skillById.Value, "name"));
        Assert.Equal("PFE", ReadAnonymousProperty(typeById.Value, "name"));
        Assert.IsType<BadRequestObjectResult>(invalidSkill);
    }

    private static AdminSettingsController CreateController(AppDbContext dbContext, Guid actorId)
    {
        return new AdminSettingsController(dbContext)
        {
            ControllerContext = TestUsers.ControllerContext(actorId, UserRole.Admin, "admin@example.com")
        };
    }

    private static object? ReadAnonymousProperty(object? target, string propertyName)
    {
        return target?.GetType().GetProperty(propertyName)?.GetValue(target);
    }
}
