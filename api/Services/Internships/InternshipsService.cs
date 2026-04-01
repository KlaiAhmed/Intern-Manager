using System.Globalization;
using InternManager.Api.Common.Enums;
using InternManager.Api.Common.Utilities;
using InternManager.Api.Data;
using InternManager.Api.Models.Entities;
using InternManager.Api.Models.Requests;
using InternManager.Api.Models.Responses;
using InternManager.Api.Services.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace InternManager.Api.Services.Internships;

public sealed class InternshipsService(AppDbContext dbContext, IHttpContextAccessor httpContextAccessor) : IInternshipsService
{
    public async Task<PagedResponse<InternshipResponse>> GetAllAsync(
        string? status,
        string? department,
        string? supervisorId,
        int page,
        int limit,
        CancellationToken cancellationToken = default)
    {
        var safePage = Math.Max(page, 1);
        var safeLimit = Math.Clamp(limit, 1, 100);

        var query = dbContext.Missions
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = NormalizeInternshipStatus(status);
            if (normalizedStatus is null)
            {
                throw new ArgumentException("Invalid internship status filter.");
            }

            query = query.Where(item =>
                EF.Functions.Collate(item.Status, "SQL_Latin1_General_CP1_CI_AS") == normalizedStatus);
        }

        if (!string.IsNullOrWhiteSpace(supervisorId))
        {
            if (!Guid.TryParse(supervisorId.Trim(), out var parsedSupervisorId))
            {
                throw new ArgumentException("Invalid supervisorId filter.");
            }

            query = query.Where(item => item.SupervisorId == parsedSupervisorId);
        }

        if (!string.IsNullOrWhiteSpace(department))
        {
            var normalizedDepartment = department.Trim();
            if (Guid.TryParse(normalizedDepartment, out var departmentId))
            {
                query = query.Where(item => item.Intern != null && item.Intern.DepartmentId == departmentId);
            }
            else
            {
                query = query.Where(item =>
                    item.Intern != null &&
                    item.Intern.Department != null &&
                    EF.Functions.Like(item.Intern.Department.Name, $"%{normalizedDepartment}%"));
            }
        }

        var total = await query.CountAsync(cancellationToken);

        var missions = await query
            .Include(item => item.Intern)
            .ThenInclude(item => item!.Department)
            .Include(item => item.Supervisor)
            .OrderByDescending(item => item.CreatedAt)
            .Skip((safePage - 1) * safeLimit)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        var missionIds = missions.Select(item => item.Id).ToList();
        var metadataByMissionId = await LoadMetadataForMissionsAsync(missionIds, cancellationToken);

        var data = missions
            .Select(item =>
            {
                metadataByMissionId.TryGetValue(item.Id, out var metadata);
                return MapToResponse(item, metadata);
            })
            .ToList();

        return new PagedResponse<InternshipResponse>
        {
            Data = data,
            Total = total,
            Page = safePage,
            Limit = safeLimit
        };
    }

    public async Task<InternshipResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var mission = await dbContext.Missions
            .AsNoTracking()
            .Include(item => item.Intern)
            .ThenInclude(item => item!.Department)
            .Include(item => item.Supervisor)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (mission is null)
        {
            return null;
        }

        var metadataByMissionId = await LoadMetadataForMissionsAsync([mission.Id], cancellationToken);
        metadataByMissionId.TryGetValue(mission.Id, out var metadata);

        return MapToResponse(mission, metadata);
    }

    public async Task<InternshipResponse> CreateAsync(CreateInternshipRequest request, CancellationToken cancellationToken = default)
    {
        if (request is null)
        {
            throw new ArgumentException("Internship payload is required.");
        }

        var supervisor = await ResolveRequiredSupervisorAsync(request.SupervisorId, cancellationToken);
        var intern = await ResolveOptionalInternAsync(request.InternId, cancellationToken);
        var department = await ResolveOptionalDepartmentAsync(request.Department, cancellationToken);
        var typeName = await ResolveOptionalInternshipTypeNameAsync(request.Type, cancellationToken);
        var coSupervisor = await ResolveOptionalSupervisorAsync(request.CoSupervisorId, cancellationToken);

        if (intern is not null)
        {
            throw new InvalidOperationException("Direct intern assignment on internship creation is disabled. Use POST /api/stages/assign.");
        }

        var startDate = DateTime.UtcNow;
        DateTime? endDate = null;

        var normalizedStatus = NormalizeInternshipStatus(request.Status);
        if (request.Status is not null && normalizedStatus is null)
        {
            throw new ArgumentException("Invalid internship status.");
        }

        var status = normalizedStatus ?? "template";
        if (!string.Equals(status, "template", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("New internships must be created as template and activated only through POST /api/stages/assign.");
        }

        var objectives = string.IsNullOrWhiteSpace(request.Objectives)
            ? string.Empty
            : request.Objectives.Trim();

        var mission = new Mission
        {
            Id = Guid.NewGuid(),
            SupervisorId = supervisor.Id,
            InternId = intern?.Id,
            Title = BuildInternshipTitle(typeName, intern),
            Description = objectives,
            SkillsJson = "[]",
            Tools = string.Empty,
            Level = typeName ?? string.Empty,
            Status = status,
            CreatedAt = startDate,
            Supervisor = supervisor,
            Intern = intern
        };

        var (actorUserId, actorName) = ResolveActor();

        var historyEntries = new List<MissionHistoryEntry>
        {
            BuildHistoryEntry(mission.Id, "created", null, mission.Status, actorUserId, actorName),
            BuildHistoryEntry(mission.Id, "supervisorId", null, mission.SupervisorId.ToString(), actorUserId, actorName),
            BuildHistoryEntry(mission.Id, "startDate", null, FormatUtc(mission.CreatedAt), actorUserId, actorName)
        };

        if (mission.InternId.HasValue)
        {
            historyEntries.Add(BuildHistoryEntry(
                mission.Id,
                "internId",
                null,
                mission.InternId.Value.ToString(),
                actorUserId,
                actorName));
        }

        if (!string.IsNullOrWhiteSpace(typeName))
        {
            historyEntries.Add(BuildHistoryEntry(mission.Id, "type", null, typeName, actorUserId, actorName));
        }

        if (!string.IsNullOrWhiteSpace(objectives))
        {
            historyEntries.Add(BuildHistoryEntry(mission.Id, "objectives", null, objectives, actorUserId, actorName));
        }

        if (department is not null)
        {
            historyEntries.Add(BuildHistoryEntry(mission.Id, "department", null, department.Name, actorUserId, actorName));
        }

        if (coSupervisor is not null)
        {
            historyEntries.Add(BuildHistoryEntry(
                mission.Id,
                "coSupervisorId",
                null,
                coSupervisor.Id.ToString(),
                actorUserId,
                actorName));
        }

        if (endDate.HasValue)
        {
            historyEntries.Add(BuildHistoryEntry(
                mission.Id,
                "endDate",
                null,
                FormatUtc(endDate.Value),
                actorUserId,
                actorName));
        }

        dbContext.Missions.Add(mission);
        dbContext.MissionHistoryEntries.AddRange(historyEntries);

        var auditEntity = BuildCreateAuditEntity(mission.Id, typeName, status, mission.InternId);
        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = actorUserId,
            Actor = actorName,
            Action = "internship.create",
            Entity = auditEntity,
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        var metadata = new InternshipMetadata(
            department?.Name,
            typeName,
            coSupervisor?.Id,
            endDate);

        return MapToResponse(mission, metadata);
    }

    public async Task<InternshipResponse> UpdateAsync(
        Guid id,
        UpdateInternshipRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request is null)
        {
            throw new ArgumentException("Internship payload is required.");
        }

        var mission = await dbContext.Missions
            .Include(item => item.Intern)
            .ThenInclude(item => item!.Department)
            .Include(item => item.Supervisor)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (mission is null)
        {
            throw new KeyNotFoundException("Internship not found.");
        }

        var metadataByMissionId = await LoadMetadataForMissionsAsync([mission.Id], cancellationToken);
        metadataByMissionId.TryGetValue(mission.Id, out var currentMetadata);

        var currentDepartment = currentMetadata?.Department ?? mission.Intern?.Department?.Name;
        var currentType = currentMetadata?.Type;
        if (string.IsNullOrWhiteSpace(currentType))
        {
            currentType = string.IsNullOrWhiteSpace(mission.Level)
                ? null
                : mission.Level;
        }

        var currentCoSupervisorId = currentMetadata?.CoSupervisorId;
        var currentEndDate = currentMetadata?.EndDate;

        var nextDepartment = currentDepartment;
        var nextType = currentType;
        var nextCoSupervisorId = currentCoSupervisorId;
        var nextEndDate = currentEndDate;

        var currentStartDate = NormalizeUtc(mission.CreatedAt);
        var nextStartDate = currentStartDate;

        var (actorUserId, actorName) = ResolveActor();
        var historyEntries = new List<MissionHistoryEntry>();

        if (request.SupervisorId is not null)
        {
            var nextSupervisor = await ResolveRequiredSupervisorAsync(request.SupervisorId, cancellationToken);

            if (mission.SupervisorId != nextSupervisor.Id)
            {
                AddHistoryEntry(
                    historyEntries,
                    mission.Id,
                    "supervisorId",
                    mission.SupervisorId.ToString(),
                    nextSupervisor.Id.ToString(),
                    actorUserId,
                    actorName);

                mission.SupervisorId = nextSupervisor.Id;
                mission.Supervisor = nextSupervisor;
            }
        }

        if (request.Status is not null)
        {
            var normalizedStatus = NormalizeInternshipStatus(request.Status);
            if (normalizedStatus is null)
            {
                throw new ArgumentException("Invalid internship status.");
            }

            if (!string.Equals(mission.Status, normalizedStatus, StringComparison.OrdinalIgnoreCase))
            {
                AddHistoryEntry(
                    historyEntries,
                    mission.Id,
                    "status",
                    mission.Status,
                    normalizedStatus,
                    actorUserId,
                    actorName);

                mission.Status = normalizedStatus;
            }
        }

        if (request.Objectives is not null)
        {
            var normalizedObjectives = request.Objectives.Trim();
            if (!string.Equals(mission.Description, normalizedObjectives, StringComparison.Ordinal))
            {
                AddHistoryEntry(
                    historyEntries,
                    mission.Id,
                    "objectives",
                    mission.Description,
                    normalizedObjectives,
                    actorUserId,
                    actorName);

                mission.Description = normalizedObjectives;
            }
        }

        if (request.Type is not null)
        {
            string? requestedTypeName = null;
            if (!string.IsNullOrWhiteSpace(request.Type))
            {
                requestedTypeName = await ResolveOptionalInternshipTypeNameAsync(request.Type, cancellationToken);
            }

            if (!string.Equals(currentType, requestedTypeName, StringComparison.OrdinalIgnoreCase))
            {
                AddHistoryEntry(
                    historyEntries,
                    mission.Id,
                    "type",
                    currentType,
                    requestedTypeName,
                    actorUserId,
                    actorName);

                mission.Level = requestedTypeName ?? string.Empty;
                mission.Title = BuildInternshipTitle(requestedTypeName, mission.Intern);
                nextType = requestedTypeName;
            }
        }

        if (request.Department is not null)
        {
            Department? requestedDepartment = null;
            if (!string.IsNullOrWhiteSpace(request.Department))
            {
                requestedDepartment = await ResolveOptionalDepartmentAsync(request.Department, cancellationToken);
            }

            var requestedDepartmentName = requestedDepartment?.Name;

            if (!string.Equals(currentDepartment, requestedDepartmentName, StringComparison.OrdinalIgnoreCase))
            {
                AddHistoryEntry(
                    historyEntries,
                    mission.Id,
                    "department",
                    currentDepartment,
                    requestedDepartmentName,
                    actorUserId,
                    actorName);

                if (mission.Intern is not null)
                {
                    mission.Intern.DepartmentId = requestedDepartment?.Id;
                    mission.Intern.Department = requestedDepartment;
                }

                nextDepartment = requestedDepartmentName;
            }
        }

        if (request.CoSupervisorId is not null)
        {
            User? requestedCoSupervisor = null;
            if (!string.IsNullOrWhiteSpace(request.CoSupervisorId))
            {
                requestedCoSupervisor = await ResolveOptionalSupervisorAsync(request.CoSupervisorId, cancellationToken);
            }

            var requestedCoSupervisorId = requestedCoSupervisor?.Id;

            if (currentCoSupervisorId != requestedCoSupervisorId)
            {
                AddHistoryEntry(
                    historyEntries,
                    mission.Id,
                    "coSupervisorId",
                    currentCoSupervisorId?.ToString(),
                    requestedCoSupervisorId?.ToString(),
                    actorUserId,
                    actorName);

                nextCoSupervisorId = requestedCoSupervisorId;
            }
        }

        if (request.StartDate.HasValue)
        {
            var requestedStartDate = NormalizeUtc(request.StartDate.Value);
            if (requestedStartDate != currentStartDate)
            {
                AddHistoryEntry(
                    historyEntries,
                    mission.Id,
                    "startDate",
                    FormatUtc(currentStartDate),
                    FormatUtc(requestedStartDate),
                    actorUserId,
                    actorName);

                mission.CreatedAt = requestedStartDate;
                nextStartDate = requestedStartDate;
            }
        }

        if (request.EndDate.HasValue)
        {
            var requestedEndDate = NormalizeUtc(request.EndDate.Value);
            if (requestedEndDate < nextStartDate)
            {
                throw new ArgumentException("endDate must be greater than or equal to startDate.");
            }

            if (!currentEndDate.HasValue || currentEndDate.Value != requestedEndDate)
            {
                AddHistoryEntry(
                    historyEntries,
                    mission.Id,
                    "endDate",
                    currentEndDate.HasValue ? FormatUtc(currentEndDate.Value) : null,
                    FormatUtc(requestedEndDate),
                    actorUserId,
                    actorName);

                nextEndDate = requestedEndDate;
            }
        }

        if (nextEndDate.HasValue && nextEndDate.Value < nextStartDate)
        {
            throw new ArgumentException("endDate must be greater than or equal to startDate.");
        }

        if (historyEntries.Count == 0)
        {
            return MapToResponse(mission, new InternshipMetadata(nextDepartment, nextType, nextCoSupervisorId, nextEndDate));
        }

        dbContext.MissionHistoryEntries.AddRange(historyEntries);

        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = actorUserId,
            Actor = actorName,
            Action = "internship.update",
            Entity = $"internship:{mission.Id} fields:{string.Join(',', historyEntries.Select(item => item.Field).Distinct())}",
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToResponse(mission, new InternshipMetadata(nextDepartment, nextType, nextCoSupervisorId, nextEndDate));
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var mission = await dbContext.Missions
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (mission is null)
        {
            throw new KeyNotFoundException("Internship not found.");
        }

        var hasDeliverables = await dbContext.Deliverables
            .AsNoTracking()
            .AnyAsync(item => item.MissionId == mission.Id, cancellationToken);

        if (hasDeliverables)
        {
            throw new InvalidOperationException("Cannot delete internship while deliverables still exist.");
        }

        var (actorUserId, actorName) = ResolveActor();
        dbContext.AuditLogs.Add(new AuditLog
        {
            ActorUserId = actorUserId,
            Actor = actorName,
            Action = "internship.delete",
            Entity = $"internship:{mission.Id}",
            Timestamp = DateTime.UtcNow
        });

        dbContext.Missions.Remove(mission);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<User?> ResolveOptionalInternAsync(string? rawInternId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawInternId))
        {
            return null;
        }

        if (!Guid.TryParse(rawInternId.Trim(), out var internId))
        {
            throw new ArgumentException("internId must be a valid GUID.");
        }

        var intern = await dbContext.Users
            .Include(item => item.Department)
            .FirstOrDefaultAsync(
                item => item.Id == internId && item.Role == UserRole.Intern && item.Status == UserStatus.Active,
                cancellationToken);

        if (intern is null)
        {
            throw new InvalidOperationException("Intern not found or inactive.");
        }

        return intern;
    }

    private async Task<User> ResolveRequiredSupervisorAsync(string? rawSupervisorId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawSupervisorId))
        {
            throw new ArgumentException("supervisorId is required.");
        }

        var supervisor = await ResolveOptionalSupervisorAsync(rawSupervisorId, cancellationToken);
        if (supervisor is null)
        {
            throw new InvalidOperationException("Supervisor not found or inactive.");
        }

        return supervisor;
    }

    private async Task<User?> ResolveOptionalSupervisorAsync(string? rawSupervisorId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawSupervisorId))
        {
            return null;
        }

        if (!Guid.TryParse(rawSupervisorId.Trim(), out var supervisorId))
        {
            throw new ArgumentException("Supervisor id must be a valid GUID.");
        }

        var supervisor = await dbContext.Users
            .FirstOrDefaultAsync(
                item => item.Id == supervisorId && item.Role == UserRole.Supervisor && item.Status == UserStatus.Active,
                cancellationToken);

        if (supervisor is null)
        {
            throw new InvalidOperationException("Supervisor not found or inactive.");
        }

        return supervisor;
    }

    private async Task<Department?> ResolveOptionalDepartmentAsync(string? rawDepartment, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawDepartment))
        {
            return null;
        }

        var normalizedDepartment = rawDepartment.Trim();

        Department? department;
        if (Guid.TryParse(normalizedDepartment, out var departmentId))
        {
            department = await dbContext.Departments
                .FirstOrDefaultAsync(item => item.Id == departmentId, cancellationToken);
        }
        else
        {
            department = await dbContext.Departments
                .FirstOrDefaultAsync(
                    item => EF.Functions.Collate(item.Name, "SQL_Latin1_General_CP1_CI_AS") == normalizedDepartment,
                    cancellationToken);
        }

        if (department is null)
        {
            throw new InvalidOperationException("Department not found.");
        }

        return department;
    }

    private async Task<string?> ResolveOptionalInternshipTypeNameAsync(string? rawType, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawType))
        {
            return null;
        }

        var normalizedType = rawType.Trim();

        InternshipType? internshipType;
        if (Guid.TryParse(normalizedType, out var typeId))
        {
            internshipType = await dbContext.InternshipTypes
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == typeId, cancellationToken);
        }
        else
        {
            internshipType = await dbContext.InternshipTypes
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    item => EF.Functions.Collate(item.Name, "SQL_Latin1_General_CP1_CI_AS") == normalizedType,
                    cancellationToken);
        }

        if (internshipType is null)
        {
            throw new InvalidOperationException("Internship type not found.");
        }

        return internshipType.Name;
    }

    private (Guid? actorUserId, string actorName) ResolveActor()
    {
        var user = httpContextAccessor.HttpContext?.User;
        if (user is null)
        {
            return (null, "system");
        }

        return (
            UserContextHelper.ResolveCurrentUserId(user),
            UserContextHelper.ResolveCurrentActorName(user));
    }

    private static InternshipResponse MapToResponse(Mission mission, InternshipMetadata? metadata)
    {
        return new InternshipResponse
        {
            Id = mission.Id,
            MissionTitle = mission.Title,
            InternId = mission.InternId,
            InternName = mission.Intern is null
                ? null
                : $"{mission.Intern.FirstName} {mission.Intern.LastName}".Trim(),
            SupervisorId = mission.SupervisorId,
            SupervisorName = mission.Supervisor is null
                ? null
                : $"{mission.Supervisor.FirstName} {mission.Supervisor.LastName}".Trim(),
            CoSupervisorId = metadata?.CoSupervisorId,
            Department = metadata?.Department ?? mission.Intern?.Department?.Name,
            Type = metadata?.Type ?? (string.IsNullOrWhiteSpace(mission.Level) ? null : mission.Level),
            Status = mission.Status,
            StartDate = mission.CreatedAt,
            EndDate = metadata?.EndDate,
            Objectives = mission.Description
        };
    }

    private async Task<Dictionary<Guid, InternshipMetadata>> LoadMetadataForMissionsAsync(
        IReadOnlyCollection<Guid> missionIds,
        CancellationToken cancellationToken)
    {
        if (missionIds.Count == 0)
        {
            return new Dictionary<Guid, InternshipMetadata>();
        }

        var entries = await dbContext.MissionHistoryEntries
            .AsNoTracking()
            .Where(item => missionIds.Contains(item.MissionId) &&
                           (item.Field == "department" ||
                            item.Field == "type" ||
                            item.Field == "coSupervisorId" ||
                            item.Field == "endDate"))
            .OrderByDescending(item => item.ChangedAt)
            .ToListAsync(cancellationToken);

        var result = new Dictionary<Guid, InternshipMetadata>();

        foreach (var missionGroup in entries.GroupBy(item => item.MissionId))
        {
            var department = GetLatestFieldValue(missionGroup, "department");
            var type = GetLatestFieldValue(missionGroup, "type");

            Guid? coSupervisorId = null;
            var coSupervisorRaw = GetLatestFieldValue(missionGroup, "coSupervisorId");
            if (!string.IsNullOrWhiteSpace(coSupervisorRaw) && Guid.TryParse(coSupervisorRaw, out var parsedCoSupervisorId))
            {
                coSupervisorId = parsedCoSupervisorId;
            }

            DateTime? endDate = null;
            var endDateRaw = GetLatestFieldValue(missionGroup, "endDate");
            if (TryParseUtcDate(endDateRaw, out var parsedEndDate))
            {
                endDate = parsedEndDate;
            }

            result[missionGroup.Key] = new InternshipMetadata(department, type, coSupervisorId, endDate);
        }

        return result;
    }

    private static string? GetLatestFieldValue(IEnumerable<MissionHistoryEntry> entries, string field)
    {
        var rawValue = entries
            .Where(item => string.Equals(item.Field, field, StringComparison.OrdinalIgnoreCase))
            .Select(item => item.NewValue)
            .FirstOrDefault();

        return string.IsNullOrWhiteSpace(rawValue)
            ? null
            : rawValue.Trim();
    }

    private static bool TryParseUtcDate(string? rawValue, out DateTime date)
    {
        return DateTime.TryParse(
            rawValue,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out date);
    }

    private static void AddHistoryEntry(
        ICollection<MissionHistoryEntry> entries,
        Guid missionId,
        string field,
        string? oldValue,
        string? newValue,
        Guid? actorUserId,
        string actorName)
    {
        var normalizedOldValue = NormalizeHistoryValue(oldValue);
        var normalizedNewValue = NormalizeHistoryValue(newValue);

        if (string.Equals(normalizedOldValue, normalizedNewValue, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        entries.Add(BuildHistoryEntry(missionId, field, normalizedOldValue, normalizedNewValue, actorUserId, actorName));
    }

    private static MissionHistoryEntry BuildHistoryEntry(
        Guid missionId,
        string field,
        string? oldValue,
        string? newValue,
        Guid? actorUserId,
        string actorName)
    {
        return new MissionHistoryEntry
        {
            Id = Guid.NewGuid(),
            MissionId = missionId,
            Field = field,
            OldValue = oldValue,
            NewValue = newValue,
            ChangedByUserId = actorUserId,
            ChangedBy = actorName,
            ChangedAt = DateTime.UtcNow
        };
    }

    private static string? NormalizeInternshipStatus(string? rawStatus)
    {
        if (string.IsNullOrWhiteSpace(rawStatus))
        {
            return null;
        }

        var normalized = rawStatus
            .Trim()
            .ToLowerInvariant()
            .Replace("_", string.Empty, StringComparison.Ordinal)
            .Replace("-", string.Empty, StringComparison.Ordinal)
            .Replace(" ", string.Empty, StringComparison.Ordinal);

        return normalized switch
        {
            "planned" => "template",
            "template" => "template",
            "active" => "active",
            "inprogress" => "active",
            "paused" => "paused",
            "completed" => "completed",
            "cancelled" => "cancelled",
            "canceled" => "cancelled",
            "archived" => "cancelled",
            _ => null
        };
    }

    private static string BuildInternshipTitle(string? typeName, User? intern)
    {
        var internName = intern is null
            ? null
            : $"{intern.FirstName} {intern.LastName}".Trim();

        if (!string.IsNullOrWhiteSpace(typeName) && !string.IsNullOrWhiteSpace(internName))
        {
            return $"{typeName} - {internName}";
        }

        if (!string.IsNullOrWhiteSpace(typeName))
        {
            return $"{typeName} Internship";
        }

        if (!string.IsNullOrWhiteSpace(internName))
        {
            return $"Internship - {internName}";
        }

        return "Internship";
    }

    private static string BuildCreateAuditEntity(Guid internshipId, string? typeName, string status, Guid? internId)
    {
        var entity = $"internship:{internshipId}";

        if (!string.IsNullOrWhiteSpace(typeName))
        {
            entity += $" type:{typeName}";
        }

        entity += $" status:{status}";

        if (internId.HasValue)
        {
            entity += $" intern:{internId.Value}";
        }

        return entity;
    }

    private static DateTime NormalizeUtc(DateTime value)
    {
        return value.Kind == DateTimeKind.Utc
            ? value
            : value.ToUniversalTime();
    }

    private static string FormatUtc(DateTime value)
    {
        return NormalizeUtc(value).ToString("O", CultureInfo.InvariantCulture);
    }

    private static string? NormalizeHistoryValue(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }

    private sealed record InternshipMetadata(
        string? Department,
        string? Type,
        Guid? CoSupervisorId,
        DateTime? EndDate);
}
