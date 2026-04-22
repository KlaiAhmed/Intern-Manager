# Frontend Explained

This document explains what users see in the <a href="./08_glossary_for_beginners.md#react" target="_blank">React</a> <a href="./08_glossary_for_beginners.md#frontend" target="_blank">frontend</a>.

---

## How the Frontend is Organized

The client's source code (`client/src/`) is organized by **feature** rather than by technical layer:

```
src/
├── app/              # Main app setup
├── routes/           # Navigation definitions
├── pages/            # Page components (routing targets)
├── features/         # Feature modules
│   ├── auth/        # Login, signup components
│   ├── home/        # Landing page
│   ├── dashboard/   # All dashboard components
│   └── notifications/
├── components/      # Reusable UI components
├── stores/          # Global state management
├── hooks/           # Shared React hooks
├── lib/             # API client setup
├── locales/         # Translations
├── styles/          # Global styles
└── types/           # TypeScript types
```

---

## Page Routes

| Path | Who Can Access | Description |
|------|---------------|-------------|
| `/` | Everyone | Public landing page |
| `/login` | Guests only | Login form |
| `/signup` | Guests only | Registration form |
| `/forgot-password` | Guests only | Password reset request |
| `/dashboard` | Logged in | Role-based dashboard |

---

## Authentication Flow (Frontend)

```
 ┌────────────┐
 │ Home Page  │
 └─────┬──────┘
      │
      ↓ Click Login
 ┌────────────┐
 │ Login Page │ ← Enter email/password
 └─────┬──────┘
      │
      ↓ Submit
 ┌─────────────┐
 │ API Verify │ ← POST /auth/login
 └─────┬──────┘
      │
      ├─ Success → Save tokens → Redirect to dashboard
      └─ Failure → Show error message
```

---

## Dashboard Routing

The `/dashboard` page is shared, but content changes based on role:

```typescript
// From routeConfig.ts
/dashboard → InternDashboard   (role: intern)
/dashboard → SupervisorDashboard (role: supervisor)
/dashboard → ManagerDashboard  (role: manager)
/dashboard → AdminDashboard     (role: admin)
/dashboard → SuperAdminDashboard (role: superadmin)
```

The routing system checks the user's role from their authentication token and renders the appropriate dashboard.

---

## Intern Dashboard Layout

The Intern dashboard has a card-based layout:

```
┌─────────────────────────────────────────────────────────┐
│                    INTERN HEADER                        │
│  [Avatar] Welcome back, [Name]!                         │
│          Here's your internship overview                  │
└─────────────────────────────────────────────────────────┘
     ┌──────────────────┐    ┌──────────────────┐
     │   Mission Card   │    │  Quick Stats     │
     │ (Assigned work)  │    │ (Progress info)  │
     └──────────────────┘    └──────────────────┘
     ┌──────────────────┐    ┌──────────────────┐
     │    Tasks Card    │    │ Deliverables    │
     │ (To-do items)   │    │   (Work to do)   │
     └────────────��─────┘    └──────────────────┘
     ┌──────────────────┐    ┌──────────────────┐
     │  Evaluation Card │    │   Journal Card   │
     │ (Reviews)       │    │  (Daily log)     │
     └──────────────────┘    └──────────────────┘
     ┌──────────────────┐
     │  Meeting Card   │
     │ (Scheduled)    │
     └──────────────────┘
          [+ FAB Button]  ← Add journal entry
```

Each card shows a different aspect of the intern's work.

---

## Supervisor Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│              SUPERVISOR SIDEBAR                          │
│  [Logo]  │  Active Interns  │  Pending Deliv.         │
│         │  Overdue Work    │  Delays Alert            │
│         │  My Workload    │  Stats                  │
└─────────────────────────────────────────────────────────┘
     ┌────────────────────────┐
     │     KPI Cards          │ ← Key metrics at top
     │  [Active] [Pending]    │
     │  [Late]   [Capacity]   │
     └────────────────────────┘
     ┌────────────────────────┐
     │   Intern Progress     │ ← Progress per intern
     │  John: ● On Track     │
     │  Jane: ● At Risk     │
     └────────────────────────┘
     ┌────────────────────────┐
     │  Validation Queue    │ ← Items needing review
     │  Deliverable 1       │
     │  Deliverable 2       │
     └────────────────────────┘
     ┌────────────────────────┐
     │   Delays & Alerts      │ ← Overdue items
     └────────────────────────┘
```

---

## Admin Dashboard Layout

The Admin dashboard uses "operational sections" that can be navigated:

```
┌──────────────────────────────────┐
│          ADMIN SIDEBAR            │
│  [Logo] Axia Intern Manager      │
│                                  │
│  Overview ────────────────►     │
│  Users ────────────────────►     │
│  Interns ───────────────────►    │
│  Internships ────────────────►      │
│  Evaluations ─────────────►       │
│  Settings ────────────────►      │
│  Audit ────────────────────►     │
│  Notifications ────────────►      │
│  Archive ─────────────────►     │
│  BI Access ────────────────►      │
└──────────────────────────────────┘

Main content area shows selected section
```

---

## Reusable UI Components

The frontend has shared components used across all dashboards:

| Component | Purpose |
|-----------|---------|
| <a href="./08_glossary_for_beginners.md#component" target="_blank">Button</a> | Clickable actions with variants (primary, secondary, etc.) |
| <a href="./08_glossary_for_beginners.md#component" target="_blank">Input</a> | Text input fields with validation |
| **Badge** | Status indicators (Active, Pending, etc.) |
| <a href="./08_glossary_for_beginners.md#component" target="_blank">Card</a> | Content containers |
| **CustomSelect** | Dropdown menus |
| **CustomRadio** | Radio button groups |
| **CustomDatePicker** | Date selection |
| **Modal** | Dialog popups |
| **ThemeSwitcher** | Light/dark theme toggle |
| **LanguageSwitcher** | AR/EN/FR language selection |

---

## State Management {#state-management}

The frontend uses <a href="./08_glossary_for_beginners.md#react" target="_blank">React</a> <a href="./08_glossary_for_beginners.md#context" target="_blank">Context</a> for global <a href="./08_glossary_for_beginners.md#state" target="_blank">state</a>:

```
AuthContext        → User login state, tokens
ThemeContext     → Light/dark theme preference  
RolePreferenceContext → Role selection (for multi-role users)
```

---

## API Client (Making Requests)

All API calls go through `lib/apiClient.ts`:

```typescript
// Example: Fetch intern's data
const response = await apiClient.get('/api/interns/me')
const data = await response.json()
```

The client:
- Attaches <a href="./08_glossary_for_beginners.md#jwt" target="_blank">JWT</a> token to requests
- Handles <a href="./08_glossary_for_beginners.md#token-refresh" target="_blank">token refresh</a> automatically
- Routes errors to appropriate handlers

---

## Feature Flags (Frontend)

The frontend supports "feature flags" that can show/hide dashboard cards per mission:

```typescript
// Each mission can have custom flags
flags = {
  missionOverview: { isVisible: true, isInteractive: true },
  journal: { isVisible: true, isInteractive: false },  // Read-only
  tasks: { isVisible: false }  // Hidden
}
```

This allows per-mission customization of dashboard cards.

---

## Internationalization (<a href="./08_glossary_for_beginners.md#internationalization" target="_blank">i18n</a>)

Users can view the app in three languages:

- **Arabic (ar)** - Right-to-left
- **English (en)** - Default
- **French (fr)**

Translations are in `locales/` folder:
- `locales/ar.ts`
- `locales/en.ts`
- `locales/fr.ts`

Components use the translation hook:
```typescript
const { t } = useI18n()
return <p>{t('dashboard.welcome')}</p>
```

---

## CSS Architecture

Style approach:

| Type | Used For | Example |
|------|---------|---------|
| **Global CSS** | Design tokens, utilities | `styles/index.css` |
| **Module CSS** | Layout components | `Header/index.module.css` |
| **Feature CSS** | Dashboard pages | `features/dashboard/styles/` |

---

## Loading States

The app handles loading gracefully:

1. **Auth Loading**: Show nothing while checking authentication
2. **Page Loading**: Show skeleton or spinner
3. **Data Loading**: Show loading indicator in cards
4. **Error States**: Show retry button with error message

---

## Next Steps

Now you understand the frontend, continue to:

- [API Explained](05_api_explained.md) - How the API logic works
- [Database Structure](06_database_structure.md) - Database organization

---