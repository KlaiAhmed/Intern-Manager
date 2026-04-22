# Database Structure

This document explains how data is organized in <a href="./08_glossary_for_beginners.md#database" target="_blank">SQL Server</a>.

---

## What is a <a href="./08_glossary_for_beginners.md#database" target="_blank">Database</a>?

A <a href="./08_glossary_for_beginners.md#database" target="_blank">database</a> is where all the application's data is stored. It's like a digital filing cabinet with many <a href="./08_glossary_for_beginners.md#table" target="_blank">tables</a> (spreadsheets).

This application uses <a href="./08_glossary_for_beginners.md#database" target="_blank">SQL Server</a> with <a href="./08_glossary_for_beginners.md#entity-framework-core" target="_blank">Entity Framework Core</a> for data access.

---

## All Database Tables

Here's every table in the database:

---

### Core User Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **Users** | All user accounts | Id, FirstName, LastName, Email, PasswordHash, Role, Status |
| **RefreshTokens** | Login session tokens | Token, UserId, ExpiresAt |
| **PasswordResetTokens** | Password reset codes | TokenHash, UserId, ExpiresAt |
| <a href="./08_glossary_for_beginners.md#audit-log" target="_blank">AuditLogs</a> | Activity history | Id, Actor, Action, Entity, Timestamp |

---

### Intern-Related Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **InternProfiles** | Intern details | InternId, UniversityId, Major, PhoneNumber, CvFileUrl |
| **InternProfileSkills** | Skills self-reported by intern | InternProfileId, SkillId |
| **InternNotifications** | Notifications for interns | InternId, Type, Message, IsRead |

---

### Internship/Mission Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **InternshipTypes** | Types of internships (reference) | Name |
| **Missions** | Assigned internship positions | SupervisorId, InternId, Title, Status |
| **MissionInternAssignments** | Multi-intern assignments | MissionId, InternId |
| **MissionFeatureFlags** | Per-mission dashboard config | MissionId, MissionCardConfig |
| **MissionHistoryEntries** | Change history | MissionId, Field, OldValue, NewValue |

---

### Work and Evaluation Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **Deliverables** | Work submissions | MissionId, InternId, Title, Status, FileUrl |
| **DeliverableVersions** | Version history | DeliverableId, VersionNumber, FileUrl |
| **InternTasks** | Individual tasks | InternId, DeliverableId, Title, IsComplete |
| **Evaluations** | Performance reviews | SupervisorId, InternId, Type, Status |

---

### Supervision Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **JournalEntries** | Intern daily logs | InternId, Content, CreatedAt |
| **JournalComments** | Supervisor feedback | JournalEntryId, AuthorId, Content |
| **JournalEvaluationLinks** | Journal-to-criteria links | JournalEntryId, EvaluationCriteria |
| **Meetings** | Scheduled meetings | SupervisorId, InternId, Date, Notes |

---

### Reference Tables (Lookup Data)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **Departments** | Organization departments | Name |
| **Schools** | Universities/schools | Name |
| **Skills** | Skills list | Name |
| **UserAccountStatusReferences** | Active/Archived status | Name |
| **UserVerificationStatusReferences** | Intern verification states | Name |

---

### Other Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **Notifications** | Admin-to-user notifications | UserId, Type, Message |
| **Stages** | Pipeline stages | Name |

---

## Entity Relationship Diagram

```
Users
  ├── 1:M → RefreshTokens
  ├── 1:M → PasswordResetTokens
  ├── 1:M → AuditLogs
  ├── 1:1 → InternProfile
  ├── 1:M → Notifications
  ├── 1:M → Missions (as Supervisor)
  ├── 1:M → Missions (as Intern)
  ├── 1:M → Deliverables
  ├── 1:M → Evaluations
  ├── 1:M → Meetings
  ├── 1:M → JournalEntries
  └── 1:1 → Department

InternProfile
  ├── 1:1 → Users (Intern)
  ���── 1:1 → Schools (University)
  └── 1:M → InternProfileSkills
      └── 1:1 → Skills

Mission
  ├── 1:1 → Users (Supervisor)
  ├── 1:1 → Users (Intern)
  ├── 1:1 → InternshipType
  ├── 1:1 → MissionFeatureFlags
  ├── 1:M → Deliverables
  ├── 1:M → MissionInternAssignments
  └── 1:M → MissionHistoryEntries

Deliverable
  ├── 1:1 → Mission
  ├── 1:1 → Users (Supervisor)
  ├── 1:1 → Users (Intern)
  └── 1:M → InternTasks
      └── 1:1 → Deliverable

JournalEntry
  ├── 1:1 → Users (Intern)
  ├── 1:M → JournalComments
  └── 1:M → JournalEvaluationLinks
```

---

## Table Details

### Users Table

The central table for all accounts:

| Field | Type | Description |
|-------|------|-------------|
| Id | GUID | Unique ID (primary key) |
| FirstName | string | First name |
| LastName | string | Last name |
| Email | string | Email (unique) |
| PasswordHash | string | Encrypted password |
| Role | enum | Intern/Supervisor/Manager/Admin/SuperAdmin |
| Status | enum | Active/Archived |
| MaxCapacity | int? | Max interns for supervisor |
| VerificationStatus | enum | INCOMPLETE/PENDING/ACTIVE/NOT_APPLICABLE |
| DepartmentId | GUID? | Foreign key to Department |
| LastLoginAt | DateTime? | Last login time |
| CreatedAt | DateTime | Account created |
| UpdatedAt | DateTime | Last update |

---

### Mission Table

The main internship assignment:

| Field | Type | Description |
|-------|------|-------------|
| Id | GUID | Unique ID |
| SupervisorId | GUID | Who supervis |
| InternId | GUID? | Assigned intern |
| Title | string | Mission name |
| Description | string | Description |
| SkillsJson | string | Required skills |
| InternshipTypeId | GUID? | Type reference |
| Status | string | template/active/paused/completed/cancelled |
| StartDate | DateTime? | Start date |
| EndDate | DateTime? | End date |
| CreatedAt | DateTime | Created |

---

### Deliverable Table

Work submission tracking:

| Field | Type | Description |
|-------|------|-------------|
| Id | GUID | Unique ID |
| MissionId | GUID | Parent mission |
| SupervisorId | GUID | Reviewer |
| InternId | GUID? | Worker |
| Title | string | What to deliver |
| Status | string | pending/submitted/accepted/rejected |
| SubmittedDate | DateTime? | When submitted |
| FileUrl | string | File path |
| Version | int | Version number |
| SupervisorComment | string? | Review comment |
| Progress | int | % complete |
| DueDate | DateTime? | Due date |
| CreatedAt | DateTime | Created |

---

### Evaluation Table

Performance reviews:

| Field | Type | Description |
|-------|------|-------------|
| Id | GUID | Unique ID |
| SupervisorId | GUID | Writer |
| InternId | GUID | For intern |
| Type | string | midterm/final/etc |
| Comments | string | Written feedback |
| Status | string | pending/submitted |
| IsReleasedToIntern | bool | Can intern see? |
| ReleasedAt | DateTime? | When released |
| ReleasedByUserId | GUID? | Who released |
| CreatedAt | DateTime | Created |

---

### JournalEntry Table

Intern's daily work log:

| Field | Type | Description |
|-------|------|-------------|
| Id | GUID | Unique ID |
| InternId | GUID | Author |
| Content | string | What they did |
| IsReviewed | bool | Supervisor saw it? |
| CreatedAt | DateTime | Written at |

---

### Department/Skill Reference Tables

These are lookup tables for Dropdown lists:

| Field | Type | Description |
|-------|------|-------------|
| Id | GUID | Unique ID |
| Name | string | Display name |
| CreatedAt | DateTime | Created |
| UpdatedAt | DateTime | Updated |

---

## How Data Relates (Relationships)

### One-to-One (1:1)

```
User ←→ InternProfile
  - One user has one profile
  - One profile belongs to one user
```

### One-to-Many (1:M)

```
User ←→ Missions
  - One supervisor has many missions
  - Each mission has one supervisor
```

### Many-to-Many (M:M)

```
InternProfile ←→ Skills ←→ InternProfileSkills
  - One intern can have many skills
  - One skill can belong to many interns
```

---

## Status Flow

### User Account Status

```
Active → Archived
  (can be restored)
```

### Intern Verification Status

```
INCOMPLETE (profile unfinished)
    ↓ Complete application
PENDING (waiting for assignment)
    ↓ Admin assigns
ACTIVE (doing internship)
    ↓ Mission ends
COMPLETED (done)
```

### Mission Status

```
template (draft)
    ↓ Post
active (in progress)
    ↓ Pause
paused (temporarily stopped)
    ↓ Resume
active
    ↓ Complete
completed (or cancelled)
```

### Deliverable Status

```
pending (not started)
    ↓ Submit
submitted (waiting review)
    ↓ Supervisor reviews
accepted (or rejected)
```

---

## Indexes (Performance)

The database uses indexes to speed up searches:

```csharp
// Users table indexes
HasIndex(u => u.Email)           // Unique - fast email lookup
HasIndex(u => new { u.Role, u.Status })   // Composite

// Mission indexes
HasIndex(m => m.SupervisorId)   // Find by supervisor
HasIndex(m => m.InternId)       // Find by intern
```

---

## Next Steps

Now you understand the database, continue to:

- [Key Decisions and Reasoning](07_key_decisions_and_reasoning.md) - Why the system was built this way
- [Glossary for Beginners](08_glossary_for_beginners.md) - Terms explained

---