# AGENTS.md

## Dev Commands

### API (`api/`)
```bash
dotnet restore
dotnet build InternManager.Api.csproj
dotnet run --project InternManager.Api.csproj           # http://localhost:5184, /swagger (Dev only)
dotnet watch run --project InternManager.Api.csproj      # hot reload
dotnet ef migrations add <Name> --project InternManager.Api.csproj
dotnet ef database update --project InternManager.Api.csproj
dotnet test tests\InternManager.Api.Tests\InternManager.Api.Tests.csproj   # xunit tests
```

### Client (`client/`)
```bash
npm install
npm run dev           # Vite dev server (port 5173)
npm run build         # tsc -b + Vite build
npm run lint          # ESLint
npm run test          # vitest run
npm run preview       # serve production build
```

**Verify order**: `npm run lint` → `npm run test` → `npm run build`

## Repo Structure

- `api/` — ASP.NET Core 10, SQL Server (SQLEXPRESS), EF Core 10, xunit tests in `api/tests/`
- `client/` — React 19, TypeScript 5.9, Vite 8, React Router 7, Vitest
- Solution file: `Intern Manager.sln` at repo root (gitignored)
- API auto-loads `.env` via `DotNetEnv.Env.Load()` at `Program.cs:3`, auto-creates DB via `MigrateAsync()` on startup, and seeds SuperAdmin. No manual migration step needed initially.
- `opencode.json` does not exist; instructions live in `AGENTS.md` (referenced by `CLAUDE.md`).

## Gotchas

- **Dev auth bypass (Development only)**: `DevelopmentLazyAuthBypassMiddleware` auto-detects the required role from endpoint `[Authorize(Roles = "...")]` metadata and injects a matching dev user (e.g., `dev.supervisor@axia.local`). No query param needed — just hit any protected route.
- **API tests excluded from build**: `<Compile Remove="tests\**\*.cs" />` — tests compile only via `dotnet test`, not during normal builds.
- **JWT issuer/audience**: Must match exactly — `AxiaInternManager` / `AxiaInternManagerClient` (in `appsettings.json` or `.env` as `JWT__ISSUER` / `JWT__AUDIENCE`).
- **Email config required at startup**: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_ENABLE_SSL`, `EMAIL_USERNAME`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_PASSWORD` must all be set in `.env` or environment. Missing vars throw at startup.
- **Swagger**: Guarded by `app.Environment.IsDevelopment()` — only available in Development.
- **Rate limit policies**: `auth` (5/min), `auth-refresh` (10/min), `upload` (5/min), `write-heavy` (20/min), `write-operations` (30/min), `read-frequent` (100/min), `delete-operations` (15/min). Apply via `[EnableRateLimiting("policyName")]`.
- **CSRF**: API compares `X-CSRF-Token` header to JWT `csrf` claim. Client `apiClient.ts` reads CSRF token from `csrf_token` cookie — but only when the caller includes the `X-CSRF-Token` key in the request `headers`. Not automatic on every request.
- **Refresh token rotation**: Only one concurrent refresh should succeed for the same token.
 - **File upload — deliverables**: `.pdf`, `.doc`, `.docx`, `.zip` only, max 10MB. **CV upload**: PDF only, max 2MB.
- **CSS**: Dashboard components use global CSS via `dashboard.css` entry point. Layout/shared components use CSS modules (`.module.css`). Never mix both in one component.
- **`@` path alias**: `@` maps to `client/src/` (Vite resolve alias). Used in some imports alongside relative paths.
- **i18n**: Wrap user-facing strings with `const { t } = useI18n()` from `src/locales/I18nContext`. Add keys to `ar.ts`, `en.ts`, `fr.ts`.
- **CSS tokens**: `--color-*` (global `index.css`), `--dash-*` (dashboard) design tokens. Prefer over hardcoded values.
- **Client env vars**: Must be prefixed `VITE_` (e.g., `VITE_API_BASE_URL`). Non-prefixed vars are silently ignored by Vite.
- **API project name**: The `.csproj` is `InternManager.Api.csproj` (not `InternManager.Api`).
- **.env files**: `api/.env` and `client/.env` are gitignored. Use `.env.example` files as templates.
