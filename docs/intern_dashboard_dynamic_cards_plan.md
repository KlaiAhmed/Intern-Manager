# Intern Dashboard Dynamic Cards Implementation Plan

**Audit Date:** April 22, 2026  
**Prepared by:** Claude Code Analysis  
**Project:** InternManager - Full Stack Application

---

## Executive Summary

This document provides a comprehensive audit of the Intern Dashboard frontend, analyzing each card/widget to determine whether it fetches live data or is static/placeholder. It also maps out the existing API endpoints and Supervisor Dashboard controls to identify gaps where supervisors cannot yet control intern-facing content.

**Key Finding:** All 7 cards in the Intern Dashboard are already functional and backed by working API endpoints. However, 3 critical gaps exist where the Supervisor Dashboard lacks UI to create/manage the data that interns see.

---

## 1. Dashboard Card Inventory

### All Intern Dashboard Cards

| Card | Location | Purpose |
|------|----------|---------|
| MissionCard | First row, full width | Shows internship mission details, supervisor, dates, progress |
| QuickStatsCard | Second row, left | Summary stats (tasks, deliverables, days left, meetings) |
| TasksCard | Second row, right | Task list with completion checkboxes |
| DeliverablesCard | Third row, left | Work deliverables with upload buttons |
| EvaluationCard | Third row, right | Performance evaluations (mid-term, final) |
| JournalCard | Fourth row, left | Daily journal entries |
| MeetingCard | Fourth row, right | Next scheduled meeting |

---

## 2. Working Cards (Must NOT Be Changed)

The following cards are fully functional and correctly implemented:

### 2.1 MissionCard ✅

- **Frontend:** `client/src/features/dashboard/components/intern/InternDashboardCards/MissionCard.tsx`
- **API Endpoint:** `GET /api/intern/me/internship`
- **Status:** WORKING
- **Data Flow:**
  - Fetches internship details from `/api/intern/me/internship`
  - Displays: mission title, supervisor name, department, start/end dates, progress %
  - Uses `FeatureCard(DashboardCard.MissionOverview)` attribute
- **Supervisor Control:** YES - Supervisor creates mission via assignment flow (Admin handles mission creation)
- **Recommendation:** KEEP AS-IS - Fully functional

### 2.2 QuickStatsCard ✅

- **Frontend:** `client/src/features/dashboard/components/intern/InternDashboardCards/QuickStatsCard.tsx`
- **Data Source:** Computed locally from props (tasks, deliverables, internship, meetingsCount)
- **Status:** WORKING
- **Data Flow:**
  - Receives data from parent component which already fetches from APIs
  - Computes: completedTasks count, submittedDeliverables count, daysLeft, meetingsCount
  - Updates time every 60 seconds for accurate "days left" calculation
- **Recommendation:** KEEP AS-IS - Computes from already-fetched data

### 2.3 TasksCard ✅

- **Frontend:** `client/src/features/dashboard/components/intern/InternDashboardCards/TasksCard.tsx`
- **API Endpoints:**
  - `GET /api/intern/me/tasks` - Fetch tasks
  - `PATCH /api/tasks/{id}/complete` - Mark task complete
- **Status:** WORKING
- **Data Flow:**
  - Intern can view all assigned tasks
  - Intern can check off incomplete tasks (calls PATCH endpoint)
  - Supports read-only mode via feature flags
- **Supervisor Control:** EXISTING API - Supervisor can POST /api/tasks to assign new tasks (NO UI in Supervisor Dashboard)
- **Recommendation:** KEEP AS-IS - API wired, but add Supervisor UI for task creation

### 2.4 DeliverablesCard ✅

- **Frontend:** `client/src/features/dashboard/components/intern/InternDashboardCards/DeliverablesCard.tsx`
- **API Endpoints:**
  - `GET /api/intern/me/deliverables` - Fetch deliverables
  - `POST /api/deliverables/{id}/submit` - Upload file
  - `PATCH /api/deliverables/{id}/validate` - Supervisor validates (accepts/rejects)
- **Status:** WORKING
- **Data Flow:**
  - Intern sees assigned deliverables with status (not_submitted, submitted, accepted, rejected)
  - Intern can click upload button to submit files
  - If rejected, intern can view supervisor comment
- **Supervisor Control:** YES - Has validation UI in Validation Queue panel
- **Recommendation:** KEEP AS-IS - Fully functional

### 2.5 EvaluationCard ✅

- **Frontend:** `client/src/features/dashboard/components/intern/InternDashboardCards/EvaluationCard.tsx`
- **API Endpoint:** `GET /api/intern/me/evaluations`
- **Status:** WORKING
- **Data Flow:**
  - Only shows evaluations where `isReleasedToIntern = true`
  - Shows scores (technical, autonomy, communication, deadlineRespect, deliverableQuality)
  - Shows overall average and release date
- **Supervisor Control:** YES - Can submit + release evaluations
  - Submit: `POST /api/evaluations` (SupervisorDashboard.tsx has evaluation form)
  - Release: `POST /api/evaluations/{id}/release` (via EvaluationReleaseController)
- **Recommendation:** KEEP AS-IS - Fully functional

### 2.6 JournalCard ✅

- **Frontend:** `client/src/features/dashboard/components/intern/InternDashboardCards/JournalCard.tsx`
- **API Endpoints:**
  - `GET /api/intern/me/journal` - Fetch entries
  - `POST /api/intern/me/journal` - Create entry
  - `POST /api/supervisor-journal/{id}/comments` - Supervisor adds comments
- **Status:** WORKING
- **Data Flow:**
  - Intern sees their journal entries (most recent 2 displayed)
  - Shows count of supervisor comments
  - FAB button to add new entry (if not read-only)
- **Supervisor Control:** YES - Can view + comment via journal review page
- **Recommendation:** KEEP AS-IS - Fully functional

### 2.7 MeetingCard ✅

- **Frontend:** `client/src/features/dashboard/components/intern/InternDashboardCards/MeetingCard.tsx`
- **API Endpoints:**
  - `GET /api/meetings?internId=me&upcoming=true&limit=1` - Next meeting
  - `GET /api/meetings?internId=me&upcoming=true&count=true` - Meeting count
- **Status:** WORKING
- **Data Flow:**
  - Shows next scheduled meeting with supervisor, date, time, notes preview
  - If no meetings, shows empty state
- **Supervisor Control:** YES - Supervisor creates meetings via form in Supervisor Dashboard
- **Recommendation:** KEEP AS-IS - Fully functional

---

## 3. API Endpoint Mapping

| Card | Intern Endpoint | Supervisor Endpoint | Notes |
|------|---------------|-------------------|------|
| MissionCard | GET /api/intern/me/internship | (via Admin) | Works |
| QuickStatsCard | (computed) | (computed) | Works |
| TasksCard | GET /api/intern/me/tasks PATCH /api/tasks/{id}/complete | POST /api/tasks | API exists, NO supervisor UI |
| DeliverablesCard | GET /api/intern/me/deliverables POST /api/deliverables/{id}/submit | PATCH /api/deliverables/{id}/validate | Works |
| EvaluationCard | GET /api/intern/me/evaluations | POST /api/evaluations POST /api/evaluations/{id}/release | Works |
| JournalCard | GET /api/intern/me/journal POST /api/intern/me/journal | POST /api/supervisor-journal/{id}/comments | Works |
| MeetingCard | GET /api/meetings | POST /api/meetings PATCH/DELETE | Works |

---

## 4. Supervisor Control Mapping

### What Supervisors Can Already Do

| Action | UI Location | Status |
|--------|----------|--------|
| Validate deliverables | ValidationQueueItem (SupervisorDashboardView.tsx) | ✅ UI exists |
| Create meetings | SupervisorMeetingForm (SupervisorDashboardView.tsx) | ✅ UI exists |
| Submit evaluations | Modal form in SupervisorDashboardView.tsx | ✅ UI exists |
| Release evaluations | Built into evaluation submission flow | ✅ UI exists |
| Add journal comments | SupervisorJournalReviewPage | ✅ UI exists |
| View intern progress | ProgressRow (SupervisorDashboardView.tsx) | ✅ UI exists |
| View delays/alerts | DelaysAlertPanel (SupervisorDashboardView.tsx) | ✅ UI exists |

### What Supervisors CANNOT Do (Missing UI)

| Action | API Exists? | Missing UI? | Priority |
|--------|------------|-------------|----------|
| Create tasks for intern | YES (POST /api/tasks) | **YES** - No form in Supervisor UI | HIGH |
| Create deliverables for intern | YES (POST /api/deliverables) | **YES** - No form in Supervisor UI | HIGH |
| Edit feature flags | YES (PATCH /api/missions/{id}/feature-flags) | **YES** - Admin only, no per-mission config UI | MEDIUM |

---

## 5. Card-by-Card Analysis Summary

| Card | Working? | Makes API Calls? | Supervisor Can Control? | Gap |
|------|---------|----------------|---------------------|-------|
| MissionCard | ✅ | YES | Admin/Mgr | None |
| QuickStatsCard | ✅ | Computed | N/A | None |
| TasksCard | ✅ | YES | API: YES, UI: NO | Need task assignment UI |
| DeliverablesCard | ✅ | YES | YES | None |
| EvaluationCard | ✅ | YES | YES | None |
| JournalCard | ✅ | YES | YES | None |
| MeetingCard | ✅ | YES | YES | None |

---

## 6. Missing Backend Pieces

**NONE** - All required API endpoints already exist:

1. ✅ Task assignment: `POST /api/tasks` in TasksController.cs:245
2. ✅ Deliverable creation: `POST /api/deliverables` in supervisor scope (endpoint exists)
3. ✅ Feature flags: `PATCH /api/missions/{id}/feature-flags` exists

---

## 7. Missing Frontend Pieces

### HIGH PRIORITY

1. **Task Assignment Form in Supervisor Dashboard**
   - Should add a section/panel in SupervisorDashboardView.tsx
   - Allows supervisor to create tasks for their assigned interns
   - Should include: intern selector, task title, optional due date, optional deliverable link

2. **Deliverable Assignment Form in Supervisor Dashboard**
   - Currently supervisors can only validate (existing), cannot create
   - Need form to create new deliverables for interns
   - Should include: intern selector, title, due date, description

### MEDIUM PRIORITY

3. **Feature Flag Configuration UI (Admin)**
   - Currently in MissionFeatureFlagsSection.tsx (AdminDashboard)
   - Allows per-mission card visibility/interactivity config
   - Already works but could be enhanced

---

## 8. Full Implementation Plan

### Phase 1: Task Assignment UI (High Priority)

**Location:** SupervisorDashboardView.tsx

**Steps:**
1. Add new panel "Assign Tasks" after Workload panel
2. Create TaskAssignmentForm component
3. Use existing hook or create `useTaskAssignment` hook
4. POST to `/api/tasks` with: InternId, Title, DueDate (optional), DeliverableId (optional)
5. Refresh task list after creation

**API Already Exists:** TasksController.cs:245-354 (POST /api/tasks)

**Database Entity:** InternTask (InternTasks table)

**Role:** Supervisor creates, Intern views/completes

---

### Phase 2: Deliverable Assignment UI (High Priority)

**Location:** SupervisorDashboardView.tsx or new DeliverablesTab

**Steps:**
1. Add panel or tab for "Assign Deliverables"
2. Create DeliverableAssignmentForm component
3. POST to `/api/deliverables` with: InternId, Title, DueDate, Description
4. Optionally link to task
5. Refresh deliverable list after creation

**API Status:** Endpoint exists in DeliverablesController (needs verification for creation)

**Database Entity:** Deliverable (Deliverables table)

**Role:** Supervisor creates, Intern submits, Supervisor validates

---

### Phase 3: Feature Flag UI Enhancement (Medium Priority)

**Location:** AdminDashboard (already exists)

**Notes:**
- MissionFeatureFlagsSection.tsx already handles this
- Could expose to Supervisors for their assigned interns
- Currently Admin-only

---

## 9. Risk Notes and Dependencies

### Risks

1. **Duplicate Content:** Need to ensure new deliverable/task forms don't conflict with existing validation flows
2. **Data Consistency:** When creating deliverables, should auto-create linked tasks (API already supports via taskWorkflowService.EnsureTasksFromDeliverablesAsync)
3. **Notification Overload:** Creating tasks/deliverables triggers notifications - ensure rate limiting not hit

### Dependencies

1. **Phase 1 (Tasks):** No backend changes needed - API endpoint exists
2. **Phase 2 (Deliverables):** Verify POST endpoint exists for supervisor scope or create one
3. **Both Phases:** Need to fetch intern list (useSupervisorWorkload hook provides this)

---

## 10. Recommendation Summary

| Card | Action | Reason |
|------|--------|--------|
| MissionCard | Keep as-is | Working correctly |
| QuickStatsCard | Keep as-is | Computes from live data |
| TasksCard | Keep as-is + ADD supervisor UI | API wired, need creation UI |
| DeliverablesCard | Keep as-is + ADD supervisor UI | Validation works, need creation UI |
| EvaluationCard | Keep as-is | Working correctly |
| JournalCard | Keep as-is | Working correctly |
| MeetingCard | Keep as-is | Working correctly |

---

## Appendix: Key File References

### Frontend
- Intern Dashboard: `client/src/features/dashboard/pages/InternDashboard.tsx`
- Cards: `client/src/features/dashboard/components/intern/InternDashboardCards/`
- Hook: `client/src/features/dashboard/hooks/intern/useInternDashboard.ts`
- Supervisor Dashboard: `client/src/features/dashboard/pages/SupervisorDashboard/SupervisorDashboardView.tsx`

### Backend
- TasksController: `api/Controllers/TasksController.cs`
- DeliverablesController: `api/Controllers/DeliverablesController.cs`
- MeetingsController: `api/Controllers/MeetingsController.cs`
- EvaluationsController: `api/Controllers/EvaluationsController.cs`
- JournalController: `api/Controllers/JournalController.cs`
- EvaluationReleaseController: `api/Controllers/EvaluationReleaseController.cs`

---

*End of Implementation Plan*