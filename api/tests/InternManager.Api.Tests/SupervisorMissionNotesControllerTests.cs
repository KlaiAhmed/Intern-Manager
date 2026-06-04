using InternManager.Api.Common.Enums;
using InternManager.Api.Controllers;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services;
using InternManager.Api.Tests.TestSupport;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Tests;

public sealed class SupervisorMissionNotesControllerTests
{
    [Fact]
    public async Task GetPostAndGetNotes_ReturnsOnlyPersistedPrivateNotes()
    {
        await using var dbContext = TestDbContext.Create();
        var supervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        SeedSupervisorMission(dbContext, supervisorId, missionId);
        await dbContext.SaveChangesAsync();
        var controller = CreateController(dbContext, supervisorId);

        var emptyResult = await controller.GetNotes(missionId, CancellationToken.None);

        var emptyNotes = Assert.IsAssignableFrom<IReadOnlyList<NoteResponse>>(
            Assert.IsType<OkObjectResult>(emptyResult).Value);
        Assert.Empty(emptyNotes);

        var createResult = await controller.CreateNote(
            missionId,
            new CreateNoteRequest { Content = "  My private note  " },
            CancellationToken.None);

        var created = Assert.IsType<CreatedResult>(createResult);
        var note = Assert.IsType<NoteResponse>(created.Value);
        Assert.NotEqual(Guid.Empty, note.Id);
        Assert.Equal(missionId, note.MissionId);
        Assert.Equal("My private note", note.Content);
        Assert.Equal($"/api/supervisor/missions/{missionId}/notes/{note.Id}", created.Location);

        var notesResult = await controller.GetNotes(missionId, CancellationToken.None);

        var notes = Assert.IsAssignableFrom<IReadOnlyList<NoteResponse>>(
            Assert.IsType<OkObjectResult>(notesResult).Value);
        var returnedNote = Assert.Single(notes);
        Assert.Equal(note.Id, returnedNote.Id);
        Assert.Equal(note.Content, returnedNote.Content);
    }

    [Fact]
    public async Task GetNotes_FiltersBySupervisorAndRejectsForeignMission()
    {
        await using var dbContext = TestDbContext.Create();
        var ownerId = Guid.NewGuid();
        var otherSupervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        SeedSupervisorMission(dbContext, ownerId, missionId);
        dbContext.Users.Add(TestUsers.Create(otherSupervisorId, UserRole.Supervisor));
        dbContext.SupervisorMissionNotes.AddRange(
            new SupervisorMissionNote
            {
                Id = Guid.NewGuid(),
                SupervisorId = ownerId,
                MissionId = missionId,
                Content = "Owner note",
                CreatedAt = DateTime.UtcNow.AddMinutes(-1)
            },
            new SupervisorMissionNote
            {
                Id = Guid.NewGuid(),
                SupervisorId = otherSupervisorId,
                MissionId = missionId,
                Content = "Other note",
                CreatedAt = DateTime.UtcNow
            });
        await dbContext.SaveChangesAsync();

        var ownerController = CreateController(dbContext, ownerId);
        var otherController = CreateController(dbContext, otherSupervisorId);

        var result = await ownerController.GetNotes(missionId, CancellationToken.None);

        var notes = Assert.IsAssignableFrom<IReadOnlyList<NoteResponse>>(
            Assert.IsType<OkObjectResult>(result).Value);
        var note = Assert.Single(notes);
        Assert.Equal("Owner note", note.Content);
        Assert.IsType<ForbidResult>(await otherController.GetNotes(missionId, CancellationToken.None));
    }

    [Fact]
    public async Task CreateNote_ValidatesContentAndMissionOwnership()
    {
        await using var dbContext = TestDbContext.Create();
        var ownerId = Guid.NewGuid();
        var otherSupervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        SeedSupervisorMission(dbContext, ownerId, missionId);
        dbContext.Users.Add(TestUsers.Create(otherSupervisorId, UserRole.Supervisor));
        await dbContext.SaveChangesAsync();

        var ownerController = CreateController(dbContext, ownerId);
        var otherController = CreateController(dbContext, otherSupervisorId);

        Assert.IsType<BadRequestObjectResult>(await ownerController.CreateNote(
            missionId,
            new CreateNoteRequest { Content = "   " },
            CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await ownerController.CreateNote(
            missionId,
            new CreateNoteRequest { Content = new string('x', 4001) },
            CancellationToken.None));
        Assert.IsType<NotFoundObjectResult>(await ownerController.CreateNote(
            Guid.NewGuid(),
            new CreateNoteRequest { Content = "Note" },
            CancellationToken.None));
        Assert.IsType<ForbidResult>(await otherController.CreateNote(
            missionId,
            new CreateNoteRequest { Content = "Nope" },
            CancellationToken.None));
    }

    [Fact]
    public async Task DeleteNote_ReturnsExpectedStatusesAndRemovesOwnedNote()
    {
        await using var dbContext = TestDbContext.Create();
        var ownerId = Guid.NewGuid();
        var otherSupervisorId = Guid.NewGuid();
        var missionId = Guid.NewGuid();
        var noteId = Guid.NewGuid();
        SeedSupervisorMission(dbContext, ownerId, missionId);
        dbContext.Users.Add(TestUsers.Create(otherSupervisorId, UserRole.Supervisor));
        dbContext.SupervisorMissionNotes.Add(new SupervisorMissionNote
        {
            Id = noteId,
            SupervisorId = ownerId,
            MissionId = missionId,
            Content = "Delete me",
            CreatedAt = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var ownerController = CreateController(dbContext, ownerId);
        var otherController = CreateController(dbContext, otherSupervisorId);

        Assert.IsType<NotFoundObjectResult>(await ownerController.DeleteNote(
            missionId,
            Guid.NewGuid(),
            CancellationToken.None));
        Assert.IsType<ForbidResult>(await otherController.DeleteNote(
            missionId,
            noteId,
            CancellationToken.None));
        Assert.IsType<NoContentResult>(await ownerController.DeleteNote(
            missionId,
            noteId,
            CancellationToken.None));
        Assert.False(await dbContext.SupervisorMissionNotes.AnyAsync(note => note.Id == noteId));
    }

    private static SupervisorMissionNotesController CreateController(
        AppDbContext dbContext,
        Guid supervisorId)
    {
        return new SupervisorMissionNotesController(new SupervisorMissionNotesService(dbContext))
        {
            ControllerContext = TestUsers.ControllerContext(
                supervisorId,
                UserRole.Supervisor,
                "supervisor@example.com")
        };
    }

    private static void SeedSupervisorMission(AppDbContext dbContext, Guid supervisorId, Guid missionId)
    {
        dbContext.Users.Add(TestUsers.Create(supervisorId, UserRole.Supervisor));
        dbContext.Missions.Add(new Mission
        {
            Id = missionId,
            SupervisorId = supervisorId,
            Title = "Mission",
            Description = "Mission description",
            CreatedAt = DateTime.UtcNow
        });
    }
}
