# Axia Intern Manager

Axia Intern Manager is a full-stack application for running an internship program. It covers user accounts, intern onboarding, missions, tasks, deliverables, meetings, evaluations, notifications, audit logs, admin settings, and dashboard reporting.

The repository is split into an ASP.NET Core API and a React client. Each folder has its own README with deeper implementation notes.

## Repository Map

```text
.
|-- api/                 ASP.NET Core Web API, EF Core models, migrations, services, tests
|-- client/              React + TypeScript single-page app
|-- docs/                Discovery notes and feature planning documents
|-- AGENTS.md            Local development notes for coding agents
|-- CLAUDE.md            Pointer to AGENTS.md
|-- Intern Manager.sln   Visual Studio solution
`-- README.md            Project-level overview
```

## Stack

| Area | Tools |
| --- | --- |
| API | .NET 10, ASP.NET Core controllers, EF Core 10, SQL Server, FluentValidation |
| Auth | JWT access cookies, refresh cookies, CSRF cookie/header check, role-based authorization |
| Email | MailKit/MimeKit for password reset emails |
| Client | React 19, TypeScript 5.9, Vite 8, React Router 7, Recharts |
| Tests | xUnit for API tests, Vitest and Testing Library for client tests |

## Local Setup

Prerequisites:

- .NET SDK 10
- Node.js 20+ and npm 10+
- SQL Server Express, or another SQL Server instance reachable from the API

Create local environment files:

```powershell
Copy-Item api\.env.example api\.env
Copy-Item client\.env.example client\.env
```

Important API values:

- `JWT__ISSUER` must be `AxiaInternManager`.
- `JWT__AUDIENCE` must be `AxiaInternManagerClient`.
- `JWT__KEY` must be a real secret of at least 32 bytes.
- `SQLSERVER_INSTANCE` defaults to `.\SQLEXPRESS`.
- `DATABASE_PATH=app.db` creates a SQL Server database named `AxiaInternManager_app`.
- `EMAIL_*` settings are required at startup because password reset emails are wired in.
- `SUPERADMIN_PASSWORD` must be at least 8 characters and include uppercase, lowercase, digit, and special character.

Run the API:

```powershell
cd api
dotnet restore
dotnet build InternManager.Api.csproj
dotnet run --project InternManager.Api.csproj
```

Run the client:

```powershell
cd client
npm install
npm run dev
```

Default local URLs:

- API: `http://localhost:5184`
- Swagger: `http://localhost:5184/swagger`
- Client: `http://localhost:5173`

## How The App Starts

On API startup, `Program.cs` loads `api/.env`, validates JWT and email settings, builds the SQL Server connection string, registers application services, runs EF Core migrations, seeds reference data, creates the SuperAdmin account if needed, and then maps controllers.

In Development, Swagger is enabled and `DevelopmentLazyAuthBypassMiddleware` can inject a matching dev user for protected endpoints. It reads endpoint role metadata such as `[Authorize(Roles = "...")]`; no query string flag is needed.

The client reads `VITE_API_BASE_URL` from `client/.env`, sends requests with cookies, retries once after a `401` by calling `/auth/refresh`, and redirects to `/login` when the session cannot be renewed.

## Main Product Areas

Roles in the API are `SuperAdmin`, `Admin`, `Manager`, `Supervisor`, and `Intern`.

The current backend surface includes:

- Auth and password reset
- User management and account archiving/deletion checks
- Admin settings for departments, schools, internship types, and skills
- Intern profile, onboarding, CV upload, and feature flags
- Internships, missions, mission assignments, and mission history
- Tasks, deliverables, deliverable versions, meetings, and evaluations
- Supervisor journal review and supervisor dashboard metrics
- In-app notifications and intern-specific notifications
- Admin audit logs and dashboard/BI statistics

The client exposes public pages, auth pages, password reset, protected dashboards, role-specific dashboard sections, notifications, language/theme controls, and intern onboarding flows.

## Security Notes

- Access and refresh tokens are stored in secure cookies.
- The readable `csrf_token` cookie must be copied to the `X-CSRF-Token` header for protected write requests.
- `apiClient.ts` only injects the CSRF token when the request already includes an `X-CSRF-Token` header key.
- CORS uses `CLIENT_ORIGIN` and allows credentials.
- Deliverable uploads accept `.pdf`, `.doc`, `.docx`, and `.zip` up to 10 MB.
- Intern CV upload accepts PDF files up to 2 MB.

## Validation Commands

Client verification order:

```powershell
cd client
npm run lint
npm run build
npm run test
```

API verification:

```powershell
cd api
dotnet test tests\InternManager.Api.Tests\InternManager.Api.Tests.csproj
```

## Code Conventions

- Keep API endpoints in controllers and business rules in services.
- Add request/response models under `api/Models` when an endpoint needs a clear contract.
- Use existing rate limit policy names from `Program.cs`.
- Keep client feature code under `client/src/features`.
- Put shared client UI under `client/src/components`.
- Use `useI18n()` for user-facing text and update `ar.ts`, `en.ts`, and `fr.ts`.
- Use CSS modules for shared/layout components. Dashboard components use the global dashboard CSS entry point.
- Client environment variables must start with `VITE_`.
