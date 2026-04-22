# Roles and Permissions

## The Five Roles Explained

Axia Intern Manager has **5 <a href="./08_glossary_for_beginners.md#role" target="_blank">roles</a>**, each with different responsibilities and access levels. Think of roles like job titles - they determine what each person can see and do.

| Role | What They Do | Hierarchy |
|------|--------------|-----------|
| **<a href="./08_glossary_for_beginners.md#superadmin" target="_blank">SuperAdmin</a>** | Full system control, create admin accounts | Top |
| **<a href="./08_glossary_for_beginners.md#admin" target="_blank">Admin</a>** | Manage users and settings | \^ |
| **<a href="./08_glossary_for_beginners.md#manager" target="_blank">Manager</a>** | View global stats and manage departments | |
| **<a href="./08_glossary_for_beginners.md#supervisor" target="_blank">Supervisor</a>** | Day-to-day intern supervision | |
| **<a href="./08_glossary_for_beginners.md#intern" target="_blank">Intern</a>** | Work on their internship tasks | Bottom |

---

## Role Comparison Table

| Action | SuperAdmin | Admin | Manager | Supervisor | Intern |
|--------|:---------:|:----:|:-------:|:----------:|:------:|
| **Create other users** | ✓ | ✓ | ✗ | ✗ | ✗ |
| **View all users** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Manage settings** | ✓ | ✓ | ✗ | ✗ | ✗ |
| **View global stats** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Create internships** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Assign interns to departments** | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Supervise interns** | ✓ | ✓ | ✗ | ✓ | ✗ |
| **Review deliverables** | ✓ | ✓ | ✗ | ✓ | ✗ |
| **Create evaluations** | ✓ | ✓ | ✗ | ✓ | ✗ |
| **View own dashboard** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Submit work** | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Upload CV** | ✓ | ✗ | ✗ | ✗ | ✓ |

---

## Detailed Role Descriptions

### SuperAdmin {#superadmin}

**Who they are**: The system owner with complete control.

**What they can do**:
- Create and manage Admin accounts
- Access all system configurations
- View complete <a href="./08_glossary_for_beginners.md#audit-log" target="_blank">audit logs</a> (who did what)
- Manage <a href="./08_glossary_for_beginners.md#feature-flag" target="_blank">feature flags</a> (turn features on/off)
- Delete archived users permanently

**What they cannot do**: 
- Cannot directly supervise interns (delegates to Supervisor)

---

### Admin {#admin}

**Who they are**: Operational managers who handle day-to-day system administration.

**What they can do**:
- Create Supervisor, Manager, Intern accounts
- Manage reference data (departments, schools, skills)
- Configure system settings
- View admin dashboard sections
- Archive user accounts

**What they cannot do**:
- Cannot create SuperAdmin accounts
- Cannot delete users (must archive first)

---

### Manager {#manager}

**Who they are**: Department or program managers who oversee the big picture.

**What they can do**:
- View department overview stats
- See all internships in their department
- View interns and their progress
- Access operational dashboard sections

**What they cannot do**:
- Cannot create users
- Cannot access system settings

---

### Supervisor {#supervisor}

**Who they are**: The people who directly guide interns every day.

**What they can do**:
- See assigned interns only (not all interns)
- Create and manage missions for their interns
- Review and approve deliverables
- Write evaluations
- Schedule meetings with interns
- Add journal comments to intern entries

**What they cannot do**:
- Cannot see data from other supervisors' interns
- Cannot access admin settings

---

### Intern {#intern}

**Who they are**: The people doing the internship work.

**What they can do**:
- Complete their application profile
- View their assigned mission
- Submit deliverables
- Add journal entries about their work
- View their evaluation results (when released)

**What they cannot do**:
- Cannot see other interns' data
- Cannot modify their assignment

---

## Access Control Example

```
 ┌─────────────────────────────────────────┐
 │           ALL DATA                     │
 │  (SuperAdmin & Admin can see all)       │
 └─────────────────────────────────────────┘
                    ↓
 ┌─────────────────────────────────────────┐
 │        DEPARTMENT DATA                  │
 │  (Manager can see department scope)       │
 └─────────────────────────────────────────┘
                    ↓
 ┌─────────────────────────────────────────┐
 │        ASSIGNED INTERN DATA              │
 │  (Supervisor sees only their interns)   │
 └─────────────────────────────────────────┘
                    ↓
 ┌─────────────────────────────────────────┐
 │        PERSONAL DATA                     │
 │  (Intern sees only their own data)      │
 └─────────────────────────────────────────┘
```

---

## How Access is Controlled in Code

In the <a href="./08_glossary_for_beginners.md#api" target="_blank">API</a> code, access is controlled using the `[Authorize]` attribute:

```csharp
// Example: Only admins can access
[Authorize(Roles = "SuperAdmin,Admin")]
public IActionResult GetUsers(...)

// Example: Any logged-in user can access
[Authorize]
public IActionResult GetInterns(...)

// Example: Public endpoint (no auth needed)
[AllowAnonymous]
public IActionResult Login(...)
```

---

## Why These Roles Exist

| Design Decision | Why It Matters |
|-----------------|---------------|
| **Least privilege** | Each role sees only what they need - prevents accidental data exposure |
| **Hierarchical access** | Higher roles can see more data - needed for management |
| **Supervisor scope** | Supervisors only see their assigned interns - ensures focused supervision |
| **Separation of duties** | Admin vs Supervisor have different jobs - prevents conflicts |

---

## Visual: Role Relationship Map

```
SuperAdmin
    ├── Creates Admin
    ├── Views All
    └── Configures System
        ↓
    Admin
        ├── Creates Supervisor/Manager/Intern
        ├── Manages Reference Data
        └── Views All
            ↓
        Manager
            ├── Assigns to Department
            └── Views Department Stats
                ↓
            Supervisor
                ├── Supervises Assigned Interns
                ├── Reviews Work
                └── Evaluates Performance
                    ↓
                Intern
                    ├── Does Work
                    └── Submits Deliverables
```

---

## Next Steps

Now you understand roles, continue to:

- [Role Workflows](03_role_workflows.md) - How each role uses the system day-to-day
- [Frontend Explained](04_frontend_explained.md) - What each role sees on screen

---