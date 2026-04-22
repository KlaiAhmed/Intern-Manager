# Axia Intern Manager - Project Overview

## What This Project Does

**Axia Intern Manager** is a complete software application for managing internship programs. It helps organizations track and manage the entire lifecycle of interns - from their initial application through their internship completion.

Think of it as a digital headquarters for internship management where different people (admins, managers, supervisors, and interns) can all do their specific jobs in one unified system.

## The Two Parts of the Application

This project has two main parts that work together:

| Part | Name | Purpose | Technology |
|------|------|---------|------------|
| <a href="./08_glossary_for_beginners.md#backend" target="_blank">Backend</a> | API | The "brain" - handles data, security, and business logic | ASP.NET Core 10 (C#) |
| <a href="./08_glossary_for_beginners.md#frontend" target="_blank">Frontend</a> | Client | The "face" - what users see and interact with | React 19 (TypeScript) |

---

## How the Backend and Frontend Talk to Each Other

```
┌──────────────────┐         HTTP Requests        ┌─────────────────┐
│                  │  ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ → │                 │
│    React UI      │        JSON Data             │  ASP.NET API    │
│  (User's Screen) │ ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ →  │  (Server)       │
│                  │        JSON Responses        │                 │
└──────────────────┘                              └─────────────────┘
```

The Frontend sends requests (like "give me all interns") to the <a href="./08_glossary_for_beginners.md#backend" target="_blank">backend</a> <a href="./08_glossary_for_beginners.md#api" target="_blank">API</a>. The <a href="./08_glossary_for_beginners.md#backend" target="_blank">backend</a> processes these requests, talks to the <a href="./08_glossary_for_beginners.md#database" target="_blank">database</a>, and sends back the requested data in <a href="./08_glossary_for_beginners.md#json" target="_blank">JSON</a> format.

---

## Major Backend Folders (api/)

| Folder | What It Does |
|--------|--------------|
| **Controllers/** | API endpoints - the "front door" for all requests |
| **Services/** | Business logic - the actual calculations and operations |
| **Models/Entities/** | Database tables - how data is stored |
| **Models/DTOs/** | Data transfer objects - standardized data packages |
| **Models/Requests/** | Request formats - what clients send |
| **Models/Responses/** | Response formats - what clients receive |
| **Data/** | Database context and configuration |
| **Common/** | Shared utilities, enums, and constants |
| **Middleware/** | Request filters and processing |
| **Extensions/** | Dependency injection setup |

---

## Major Frontend Folders (client/src/)

| Folder | What It Does |
|--------|--------------|
| **app/** | Main app setup and providers |
| **routes/** | Navigation definitions and guards |
| **pages/** | Full page components |
| **features/** | Feature modules (auth, home, dashboard, notifications) |
| **components/** | Reusable UI components |
| **stores/** | Global state (auth, theme, role preference) |
| **hooks/** | Shared React hooks |
| **lib/** | API client setup |
| **locales/** | Translations (Arabic, English, French) |
| **styles/** | Global CSS and design tokens |
| **types/** | Shared TypeScript types |

---

## How a User Gets Started

1. **Sign Up**: User creates an account with email and password
2. **Auto-Login**: After signup, they're automatically logged in
3. <a href="./08_glossary_for_beginners.md#jwt" target="_blank">JWT</a> Tokens: The server gives them two secure tokens:
   - Access token (lasts 15 minutes)
   - Refresh token (lasts 7 days)
4. **Dashboard Access**: Based on their role, they see the appropriate dashboard

---

## Basic Data Flow

```
User logs in
    ↓
API validates credentials
    ↓
Server creates JWT tokens
    ↓
Tokens stored in secure cookies
    ↓
User redirected to their dashboard
    ↓
Dashboard fetches data via API
    ↓
Data displayed in tables/cards
```

---

## Key Technologies Used

| Technology | Purpose |
|------------|---------|
| <a href="./08_glossary_for_beginners.md#database" target="_blank">SQL Server</a> | Database for storing all data |
| <a href="./08_glossary_for_beginners.md#entity-framework-core" target="_blank">Entity Framework Core</a> | Database interactions |
| <a href="./08_glossary_for_beginners.md#jwt" target="_blank">JWT</a> | Secure authentication tokens |
| <a href="./08_glossary_for_beginners.md#react" target="_blank">React</a> Router | Page navigation |
| **Axios** | HTTP client for API calls |
| **Vite** | Development server and build tool |
| **TypeScript** | Type-safe JavaScript |

---

## Next Steps

Now that you understand the big picture, continue to:

- [Roles and Permissions](02_roles_and_permissions.md) - What each role can do
- [Role Workflows](03_role_workflows.md) - Step-by-step workflows for each role
- [Database Structure](06_database_structure.md) - How data is organized

---

## Quick Reference

- **API runs on**: http://localhost:5184
- **Client runs on**: http://localhost:5173
- **Database**: SQL Server (local)