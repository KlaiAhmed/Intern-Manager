# AGENTS.md

## Dev Commands

### API (`api/`)
```bash
dotnet restore
dotnet build InternManager.Api.csproj
dotnet run --project InternManager.Api.csproj
dotnet watch run --project InternManager.Api.csproj
dotnet ef migrations add <Name> --project InternManager.Api.csproj
dotnet ef database update --project InternManager.Api.csproj
```

### Client (`client/`)
```bash
npm install
npm run dev         # Vite dev server (port 5173)
npm run build       # tsconfig build check + Vite build
npm run lint
npm run preview     # serve production build
npm run test        # vitest run
```

**Verify order**: `npm run lint` → `npm run build` (build includes `tsc -b` typecheck)

## Repo Structure

- `api/` — ASP.NET Core 10, SQL Server (requires `SQL Server (SQLEXPRESS)` running on Windows), EF Core 10
- `client/` — React 19, TypeScript 5.9, Vite 8, React Router 7
- API auto-creates and seeds the database on first run. No manual migration step needed initially.
- `opencode.json` does not exist; instructions live in `CLAUDE.md`.

## Key Gotchas

- **API tests excluded from build**: `InternManager.Api.csproj` has `<Compile Remove="tests\**\*.cs" />` — tests are compiled only when running `dotnet test`, not during normal builds.
- **JWT issuer/audience**: Must match exactly — `AxiaInternManager` (issuer) and `AxiaInternManagerClient` (audience). DotNetEnv loads `api/.env` automatically; no manual `Load()` call needed.
- **Dev auth bypass**: When `ASPNETCORE_ENVIRONMENT=Development`, add `?role=<Role>` to any URL to get a bypass token (e.g., `http://localhost:5184/?role=Supervisor`). Useful for testing without credentials.
- **Rate limit policies**: `auth` (10/min), `upload` (5/min), `write-heavy` (20/min). Apply via `[EnableRateLimiting("policyName")]`.
- **CSRF**: API uses cookie-based JWT auth with `X-CSRF-Token` header matching JWT `csrf` claim. Client `apiClient.ts` handles this automatically.
- **CSS**: Dashboard components use global CSS imported via `dashboard.css` entry point. Layout/shared components use CSS modules (`.module.css`). Never mix the two approaches in the same component.
- **i18n**: Wrap all user-facing strings with `const { t } = useI18n()` from `src/locales/`. Add keys to `ar.ts`, `en.ts`, `fr.ts`.
- **CSS token bridge**: Use `--color-*` (global), `--dash-*` (dashboard) design tokens. Prefer these over hardcoded values.
- **Client .env variable naming**: All client env vars must be prefixed `VITE_` (e.g., `VITE_API_BASE_URL`). Non-prefixed vars are silently ignored by Vite.
- **File upload allowed extensions**: `.pdf`, `.doc`, `.docx`, `.zip` only, max 10MB.
- **API project name**: `InternManager.Api.csproj` — not `InternManager.Api`.