# AGENTS.md

## Dev Commands

### API (`api/`)
```powershell
dotnet restore
dotnet build InternManager.Api.csproj
dotnet run --project InternManager.Api.csproj           # http://localhost:5184, /swagger (Dev only)
dotnet watch run --project InternManager.Api.csproj      # hot reload
dotnet ef migrations add <Name> --project InternManager.Api.csproj
dotnet ef database update --project InternManager.Api.csproj
dotnet test tests\InternManager.Api.Tests\InternManager.Api.Tests.csproj   # xunit, EF Core InMemory
```

### Client (`client/`)
```powershell
npm install
npm run dev           # Vite dev server (port 5173)
npm run build         # tsc -b + Vite build
npm run lint          # ESLint (flat config)
npm run test          # vitest run, jsdom, Testing Library
npm run preview       # serve production build
```

**Client verify order**: `npm run lint` → `npm run test` → `npm run build`

## Repo Structure

- `api/` — ASP.NET Core 10, SQL Server (SQLEXPRESS), EF Core 10, FluentValidation, MailKit
- `client/` — React 19, TypeScript 5.9, Vite 8, React Router 7, Recharts, Vitest
- `api/tests/InternManager.Api.Tests/` — xUnit tests with EF Core InMemory
- `docs/` — gitignored; sketch notes only
- `Intern Manager.sln` — Visual Studio solution (space in name)
- Instructions in `AGENTS.md` (referenced by `CLAUDE.md`); no `opencode.json`

## Gotchas

- **Dev auth bypass (Development/Testing)**: `DevelopmentLazyAuthBypassMiddleware` reads endpoint `[Authorize(Roles = "...")]` metadata and injects a matching dev user + `X-CSRF-Token` header. Applies to `/api` and `/auth` routes. Routes containing `/me/` are skipped. Also allowed in `Testing` environment.
- **API tests excluded from build**: `<Compile Remove="tests\**\*.cs" />` — compile only via `dotnet test`.
- **JWT issuer/audience**: Must match exactly — `AxiaInternManager` / `AxiaInternManagerClient`.
- **Email config required at startup**: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_ENABLE_SSL`, `EMAIL_USERNAME`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_PASSWORD` all required.
- **Swagger**: Guarded by `app.Environment.IsDevelopment()`.
- **Rate limit policies**: `auth` (5/min), `auth-refresh` (10/min), `upload` (5/min), `write-heavy` (20/min), `write-operations` (30/min per user), `read-frequent` (100/min per user), `delete-operations` (15/min per user). Apply via `[EnableRateLimiting("policyName")]`.
- **CSRF**: API's `CsrfValidationFilter` compares `X-CSRF-Token` header to JWT `csrf` claim for POST/PUT/PATCH/DELETE (skipped for anonymous routes and dev bypass). Client `apiClient.ts` reads CSRF from `csrf_token` cookie — but only when request headers already include `X-CSRF-Token` key.
- **Refresh token rotation**: Only one concurrent refresh should succeed for the same token.
- **File upload**: Deliverables: `.pdf`, `.doc`, `.docx`, `.zip` up to 10MB. CV: PDF only, up to 2MB. Stored under `api/uploads/`.
- **CSS**: Dashboard components use global CSS via `dashboard.css` entry (imports `dashboard-tokens.css` + per-component files). Shared/layout components use CSS modules. Never mix both in one component.
- **Design tokens**: `--color-*` in `src/styles/index.css`, `--dash-*` in `src/features/dashboard/styles/dashboard-tokens.css`.
- **`@` path alias**: Maps to `client/src/` (configured in both `vite.config.ts` and `vitest.config.ts`).
- **i18n**: `const { t } = useI18n()` from `src/locales/I18nContext`. Add keys to `ar.ts`, `en.ts`, `fr.ts`. English is sync fallback; `fr`, `ar` are lazy-loaded. Feature translations under each `features/*/locales/`.
- **Client env vars**: Must be prefixed `VITE_`. `apiClient.ts` also falls back to `VITE_API_URL` if `VITE_API_BASE_URL` unset.
- **API project name**: `.csproj` is `InternManager.Api.csproj` (not `InternManager.Api`).
- **.env files**: `api/.env` and `client/.env` are gitignored. Use `.env.example` templates.
- **Startup flow**: `Program.cs` loads `.env`, rejects placeholder JWT KEY, sets `http://localhost:{SERVER_PORT}`, builds SQL Server connection string, runs `Database.MigrateAsync()`, applies `.sql` migration scripts, seeds reference data + dev auth users + SuperAdmin. DB/seed failures are critical startup failures.
- **Global controller filter**: `FeatureFlagGateFilter` is registered globally via `options.Filters.AddService<FeatureFlagGateFilter>()`.
- **Test helpers**: `TestSupport/` provides `TestUsers`, `TestDbContext`, `TestFiles` utilities.
