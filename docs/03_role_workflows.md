# Role Workflows

This document explains how each role uses the system from start to finish.

---

## Workflow 1: <a href="./08_glossary_for_beginners.md#intern" target="_blank">Intern</a> (The Person Doing the Internship)

### Step 1: Create Account

```
1. Go to signup page
2. Enter: First Name, Last Name, Email, Password
3. Select role: "Intern" (only option for self-signup)
4. Click "Sign Up"
5. System creates account, auto-logs in
```

**Result**: Account created, redirected to dashboard

---

### Step 2: Complete Application Profile

After first login, Intern sees a multi-step form:

1. **Step 1 - Personal Info**: Phone number, work preference (remote/hybrid/onsite)
2. **Step 2 - Education**: University, major, year of study, expected graduation
3. **Step 3 - Skills**: Select skills from predefined list
4. **Step 4 - CV Upload**: Upload resume/CV file (PDF)

**Result**: Profile marked as "<a href="./08_glossary_for_beginners.md#pending" target="_blank">PENDING</a>" (waiting for admin review)

---

### Step 3: Wait for Assignment

While "PENDING", Intern sees a status page:
- "Your application is under review"
- Profile information shown

This continues until an admin assigns them to a department and creates a mission.

---

### Step 4: Active Internship (Daily Work)

Once approved, Intern sees their full dashboard with several cards:

1. **Mission Card**: Shows their assigned project/task
2. **Tasks Card**: Individual tasks to complete
3. **Deliverables Card**: Work to submit (documents, code, etc.)
4. **Evaluation Card**: Performance reviews
5. **Journal Card**: Daily work log entries
6. **Meeting Card**: Scheduled meetings with supervisor

**Daily routine**:
- Check tasks, mark as complete
- Upload deliverables when done
- Write journal entries about work
- Check for meeting notifications

---

### Step 5: Submit Work

```
1. Go to Deliverables card
2. Click "Upload" on a deliverable
3. Select file from computer
4. System uploads to server
5. Status changes "Submitted"
6. Supervisor reviews and comments
```

---

### Step 6: Complete Internship

When mission ends:
- Status changes to "Completed"
- Dashboard becomes read-only
- Intern can download their evaluation

---

## Workflow 2: <a href="./08_glossary_for_beginners.md#supervisor" target="_blank">Supervisor</a> (The Daily Guide)

### Step 1: Account Created

Supervisor accounts are created by Admin (not self-signup).

Login for the first time → See empty dashboard

---

### Step 2: Get Assigned Interns

Admins assign interns to supervisors by:
1. Creating a mission for the intern
2. Setting the supervisor as mission owner

Supervisor can now see their assigned interns in the dashboard.

---

### Step 3: Daily Supervision

Supervisor dashboard shows:

1. **Interns Section**: All assigned interns
2. **Deliverables Queue**: Work waiting for review
3. **Validation Queue**: Pending approvals
4. **Delays Alerts**: Overdue work warnings
5. **Workload Stats**: How much they're supervising
6. **KPIs**: Active interns, pending items, etc.

---

### Step 4: Review Work

When an intern submits a deliverable:

```
1. See notification or check queue
2. Open the deliverable
3. Download/review the file
4. Choose: Accept / Reject / Request Changes
5. Add comments if needed
6. Save decision
```

---

### Step 5: Write Evaluations

At key points (midterm, final):

```
1. Go to Evaluations section
2. Create new evaluation
3. Fill in criteria scores and comments
4. Save as draft or submit
5. Later: Release to intern (optional)
```

---

### Step 6: Journal Comments

Supervisors can comment on intern journal entries:

```
1. View intern's journal entries
2. Add comments with feedback
3. Intern sees comment notification
```

---

## Workflow 3: <a href="./08_glossary_for_beginners.md#manager" target="_blank">Manager</a> (The Department Overview)

### Step 1: Account Created

Manager accounts created by Admin.

Login → See Manager dashboard

---

### Step 2: View Department Overview

Manager sees global stats for their department:

1. **Overview Tab**: Key metrics, charts
2. **Interns Tab**: List of all interns in department
3. **Internships Tab**: Active internship positions
4. **Departments Tab**: Department management
5. **Supervisors Tab**: Supervisor management

---

### Step 3: Manage Department

Managers can:
- View all department interns and their status
- See internship program details
- Monitor progress across supervisors

---

## Workflow 4: <a href="./08_glossary_for_beginners.md#admin" target="_blank">Admin</a> (The System Operator)

### Step 1: Initial Setup

Admin accounts created by SuperAdmin.

Login → See Admin dashboard with all sections

---

### Step 2: Daily Admin Tasks

Admin dashboard sections:

1. **Overview**: System-wide statistics
2. **Users**: User management (create, edit, archive)
3. **Interns**: Intern list management
4. **Internships**: Program management
5. **Evaluations**: View all evaluations
6. **Settings**: Reference data (departments, schools, skills)
7. **Audit**: Activity log
8. **Notifications**: Send notifications
9. **Archive**: Archived users
10. <a href="./08_glossary_for_beginners.md#feature-flag" target="_blank">Feature Flags</a>: Control dashboard features

---

### Step 3: Create Users

```
1. Go to Users section
2. Click "Add User"
3. Fill: Name, Email, Role, Department
4. Set initial password
5. Click Create
6. User receives account
```

---

### Step 4: Review Intern Applications

When intern submits profile:
1. See list of pending interns
2. Review their profile and CV
3. Assign to department
4. Create/assign mission

---

### Step 5: Manage Settings

```
1. Go to Settings
2. Add/Edit: Departments, Schools, Skills
3. Changes apply system-wide
```

---

## Workflow 5: <a href="./08_glossary_for_beginners.md#superadmin" target="_blank">SuperAdmin</a> (The System Owner)

### Step 1: First Login

First <a href="./08_glossary_for_beginners.md#superadmin" target="_blank">SuperAdmin</a> created during database <a href="./08_glossary_for_beginners.md#seeding" target="_blank">seeding</a> (from environment variables).

Login → See Admin dashboard with full access

---

### Step 2: Create Other Admins

```
1. Go to Users
2. Create Admin account
3. Admin can now create other users
```

---

### Step 3: System Configuration

- Access all settings
- View complete audit logs
- Manage feature flags
- Delete archived users permanently

---

## Visual: Intern Application Flow

```
 ┌──────────┐
 │ Sign Up  │
 └────┬─────┘
      │
      ↓
 ┌──────────────┐
 │ Incomplete   │ ← Profile not finished
 │   Profile   │
 └────┬─────────┘
      │
      ↓ Complete profile
      │
 ┌──────────────┐
│  <a href="./08_glossary_for_beginners.md#pending" target="_blank">Pending</a>    │ ← Waiting for assignment
  │   Status    │
 └────┬─────────┘
      │
      ↓ Admin assigns
      │
 ┌──────────┐
 │ Active   │ ← Working on internship
 └────┬─────┘
      │
      ↓ Mission completes
      │
 ┌────────────┐
 │ Completed │ ← Read-only access
 └───────────┘
```

---

## Daily Tasks by Role

| Role | Morning Tasks | Throughout Day | End of Day |
|------|---------------|---------------|------------|
| <a href="./08_glossary_for_beginners.md#intern" target="_blank">Intern</a> | Check tasks, journal | Submit work, log entries | Review feedback |
| <a href="./08_glossary_for_beginners.md#supervisor" target="_blank">Supervisor</a> | Check queue | Review deliverables, meetings | Write comments |
| <a href="./08_glossary_for_beginners.md#manager" target="_blank">Manager</a> | Review stats | Monitor department | Check reports |
| <a href="./08_glossary_for_beginners.md#admin" target="_blank">Admin</a> | Check notifications | User management | Review audit log |
| <a href="./08_glossary_for_beginners.md#superadmin" target="_blank">SuperAdmin</a> | System health check | Configuration | Review logs |

---

## Key Screens for Each Role

### Intern Screens
- Login/Signup pages
- Multi-step application form
- Personal dashboard with 6 cards

### Supervisor Screens
- Intern list view
- Deliverable review modal
- Evaluation form
- Journal comment modal

### Manager Screens
- Overview with KPIs
- Interns list
- Internships management

### Admin Screens
- User CRUD forms
- Settings management
- Audit log viewer
- Feature flags toggles

---

## Next Steps

Now you understand workflows, continue to:

- [Frontend Explained](04_frontend_explained.md) - Visual walkthrough of dashboards
- [API Explained](05_api_explained.md) - How the API works

---