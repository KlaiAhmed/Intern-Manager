# Intern Manager API

The API is an ASP.NET Core 10 application backed by SQL Server. It owns authentication, authorization, data storage, file uploads, notifications, dashboard data, and the role-specific workflows used by the React client.

## What It Runs

- HTTP controllers under `Controllers/`
- EF Core data model and migrations under `Data/`
- Business services under `Services/`
- Auth, CSRF, error handling, feature gates, and development auth middleware
- xUnit tests under `tests/InternManager.Api.Tests/`

## Quick Start

Create `api/.env` from the template:

```powershell
Copy-Item .env.example .env
```

Start SQL Server Express or set `SQLSERVER_INSTANCE` to another SQL Server instance.

Run the API:

```powershell
dotnet restore
dotnet build InternManager.Api.csproj
dotnet run --project InternManager.Api.csproj
```

Local endpoints:

- API base: `http://localhost:5184`
- Swagger: `http://localhost:5184/swagger`

Swagger is enabled in Development only.

## Environment

`DotNetEnv.Env.Load()` loads `api/.env` during startup. No manual loading call is needed elsewhere.

| Variable | Purpose |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | Usually `Development` locally |
| `SERVER_PORT` | API port, default `5184` |
| `CLIENT_ORIGIN` | Allowed browser origin, default `http://localhost:5173` |
| `JWT__KEY` | JWT signing secret, at least 32 bytes |
| `JWT__ISSUER` | Must be `AxiaInternManager` |
| `JWT__AUDIENCE` | Must be `AxiaInternManagerClient` |
| `DATABASE_PATH` | Used to build the database name |
| `SQLSERVER_INSTANCE` | Defaults to `.\SQLEXPRESS` |
| `SUPERADMIN_*` | Seed account created on first startup |
| `EMAIL_*` | SMTP settings required by password reset |

With `DATABASE_PATH=app.db`, the database name is `AxiaInternManager_app`.

## Startup Flow

`Program.cs` does the runtime setup:

1. Loads `.env`.
2. Rejects the placeholder JWT secret.
3. Builds `http://localhost:{SERVER_PORT}`.
4. Builds the SQL Server connection string.
5. Registers controllers, EF Core, auth, validation, services, CORS, rate limiting, and Swagger.
6. Ensures EF migration history can handle an existing baseline schema.
7. Runs `Database.MigrateAsync()`.
8. Applies SQL migration scripts, seeds status reference data, seeds development auth users, and creates the SuperAdmin account if missing.
9. Enables Swagger in Development.
10. Adds exception handling, API problem responses, CORS, security headers, auth, development auth bypass, rate limiting, authorization, and controllers.

Database or seed failures are treated as startup failures.

## Main Folders

```text
api/
|-- Application/          Use-case code that does not belong to controllers
|-- Common/               Enums, options, attributes, OpenAPI helpers, utilities
|-- Controllers/          HTTP endpoints
|-- Data/                 DbContext, EF migrations, initialization helpers
|-- Extensions/           Service registration helpers
|-- Middleware/           CSRF, feature gates, exception handling, dev auth bypass
|-- Models/               Entities, DTOs, requests, responses, validators
|-- Services/             Auth, email, dashboard, mission, intern, notification services
|-- tests/                xUnit project
`-- uploads/              Runtime upload storage
```

## Data Model

`AppDbContext` maps the main tables:

- Users, refresh tokens, password reset tokens, audit logs
- Departments, schools, internship types, skills, and status references
- Intern profiles and intern profile skills
- Missions, mission assignments, mission feature flags, and mission history
- Deliverables and deliverable versions
- Tasks, meetings, evaluations
- Journal entries, comments, and evaluation links
- General notifications and intern notifications

`SaveChanges` and `SaveChangesAsync` update timestamps for users, reference data, and intern profiles.

## Endpoint Areas

| Area | Routes |
| --- | --- |
| Auth | `/auth/login`, `/auth/signup`, `/auth/refresh`, `/auth/logout`, `/auth/me` |
| Password reset | `/api/auth/forgot-password`, `/api/auth/verify-reset-code`, `/api/auth/reset-password` |
| Users | `/api/users`, `/api/users/{id}`, `/api/users/me/summary` |
| Admin settings | `/api/admin/settings/departments`, `/api/admin/settings/schools`, `/api/admin/settings/internship-types`, `/api/admin/settings/skills` |
| Admin reporting | `/api/stats/*`, `/api/admin/audit-logs` |
| Intern profile | `/api/intern/me/profile`, `/api/intern/me/profile/skills`, `/api/intern/me/profile/cv`, `/api/interns/me/onboarding` |
| Intern dashboard | `/api/intern/me/internship`, `/api/intern/me/tasks`, `/api/intern/me/deliverables`, `/api/intern/me/evaluations`, `/api/intern/me/journal`, `/api/intern/me/notifications`, `/api/intern/me/feature-flags` |
| Supervisor dashboard | `/api/supervisor/me/*`, `/api/supervisor/interns/{internId}/journal`, `/api/supervisor/journal-entries/*` |
| Work tracking | `/api/internships`, `/api/missions`, `/api/tasks`, `/api/deliverables`, `/api/meetings`, `/api/evaluations` |
| Other | `/api/matching`, `/api/stages`, `/api/notifications` |

Use Swagger for exact request and response shapes.

## Auth And CSRF

The API uses cookie-based JWT auth:

- `access_token`: JWT access token, HttpOnly
- `refresh_token`: opaque refresh token, HttpOnly, stored hashed in the database
- `csrf_token`: readable token used by the client

The JWT contains a `csrf` claim. For protected write requests, `CsrfValidationFilter` compares the `X-CSRF-Token` header to that claim. Anonymous endpoints are exempt.

`AuthService` rotates refresh tokens. Only one concurrent refresh should succeed for the same token.

Password reset uses an 8-digit email code that expires after 10 minutes. A verified code returns a short-lived JWT verification token, also valid for 10 minutes.

## Development Auth Bypass

In Development, `DevelopmentLazyAuthBypassMiddleware` can create a matching authenticated user for protected endpoints. It reads the endpoint's `[Authorize(Roles = "...")]` metadata and picks a seeded dev user with the required role.

This middleware is guarded by `app.Environment.IsDevelopment()`.

## Rate Limits

| Policy | Limit |
| --- | --- |
| `auth` | 5 requests per minute |
| `auth-refresh` | 10 requests per minute |
| `upload` | 5 requests per minute |
| `write-heavy` | 20 requests per minute |
| `write-operations` | 30 requests per minute per user |
| `read-frequent` | 100 requests per minute per user |
| `delete-operations` | 15 requests per minute per user |

Apply a policy with `[EnableRateLimiting("policy-name")]`.

## Files

- Intern CV upload accepts PDF only, up to 2 MB.
- Deliverable submission accepts `.pdf`, `.doc`, `.docx`, and `.zip`, up to 10 MB.
- Runtime files are stored under `api/uploads/`.

## Tests

Run the API test project:

```powershell
dotnet test tests\InternManager.Api.Tests\InternManager.Api.Tests.csproj
```

Current tests cover deliverables, admin settings cleanup, feature flag gates, intern onboarding contracts, and intern notification behavior.

Normal API builds exclude `tests/**/*.cs`; test files compile through `dotnet test`.
