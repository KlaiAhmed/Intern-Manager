# Intern Manager Client

The client is a React 19 single-page app for Axia Smart Intern Manager. It provides the public home page, login/signup, password reset, protected dashboards, role-specific workflows, notifications, language switching, and theme switching.

## Quick Start

Create `client/.env`:

```powershell
Copy-Item .env.example .env
```

Install and run:

```powershell
npm install
npm run dev
```

Default local URL:

- `http://localhost:5173`

`VITE_API_BASE_URL` must point to the API, usually `http://localhost:5184`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run lint` | Run ESLint |
| `npm run build` | Run TypeScript build, then Vite build |
| `npm run test` | Run Vitest once |
| `npm run preview` | Serve the production build locally |

Use this order before handing off client changes:

```powershell
npm run lint
npm run build
```

## App Structure

```text
client/
|-- public/              Static files served by Vite
|-- src/
|   |-- app/             Root app component and providers
|   |-- assets/          Imported images and media
|   |-- components/      Shared layout and UI components
|   |-- config/          Client constants
|   |-- features/        Auth, dashboard, home, notifications
|   |-- hooks/           Shared hooks
|   |-- lib/             API client and auth helpers
|   |-- locales/         Global i18n setup and translations
|   |-- pages/           Route-level page wrappers
|   |-- routes/          Router, lazy pages, guards, route config
|   |-- shared/          Shared error pages and error boundary
|   |-- stores/          Auth, theme, and role preference contexts
|   |-- styles/          Global CSS
|   |-- test/            Vitest setup
|   |-- types/           Shared TypeScript types
|   `-- utils/           Small utilities
|-- package.json
|-- vite.config.ts
`-- eslint.config.js
```

The `@` import alias points to `client/src`.

## Routes

Routes are defined in `src/routes/routeConfig.ts`.

| Route | Purpose |
| --- | --- |
| `/` | Public home page |
| `/login` | Guest-only login |
| `/signup` | Guest-only signup |
| `/forgot-password` | Guest-only password reset flow |
| `/dashboard` | Protected dashboard entry point |
| `/dashboard/admin/*` | Admin dashboard sections |
| `/dashboard/admin/missions/:missionId/feature-flags` | Mission dashboard card settings |
| `/dashboard/supervisor/interns/:internId/journal` | Supervisor journal review |
| `/404`, `/error` | Error pages |

`ProtectedRoute` sends unauthenticated users to `/login`. If a signed-in user lacks the required role, it sends them back to `/dashboard`. `GuestRoute` sends signed-in users away from login/signup/reset pages.

## Providers

`src/app/providers/RootProviders.tsx` mounts providers in this order:

1. Theme
2. I18n
3. Auth
4. Role preference
5. Browser router

`AuthContext` exposes login, signup, logout, current user refresh, loading state, and the current user.

## API Access

`src/lib/apiClient.ts` is the shared fetch wrapper.

It:

- Reads `VITE_API_BASE_URL`.
- Sends `credentials: 'include'` for cookie auth.
- Adds `Accept: application/json` by default.
- Retries one time after a `401` by calling `/auth/refresh`.
- Redirects to `/login` when refresh fails.
- Copies the CSRF cookie into `X-CSRF-Token` only when the request headers already include an `X-CSRF-Token` key.

Feature code should use existing API helpers when available. For upload progress, the dashboard uses `XMLHttpRequest` in `features/dashboard/api/internCvApi.ts`.

## Features

| Feature | Location | Notes |
| --- | --- | --- |
| Auth | `src/features/auth` | Login, signup, forgot password, form logic, auth translations |
| Dashboard | `src/features/dashboard` | Admin, SuperAdmin, Manager, Supervisor, and Intern dashboards |
| Home | `src/features/home` | Public landing sections and home stats |
| Notifications | `src/features/notifications` | Notification bell, API calls, hooks, translations |

Dashboard intern cards are gated by mission feature flags. The matching API and dashboard reporting live behind backend role checks.

## Styling

- Shared layout and UI components use CSS modules.
- Dashboard components use global CSS through `src/features/dashboard/styles/dashboard.css`.
- Reuse global `--color-*` tokens and dashboard `--dash-*` tokens.
- Keep user-facing text in translations instead of hardcoding it in components.

## Internationalization

Use `useI18n()` from `src/locales/I18nContext`.

When adding visible text, update:

- `src/locales/ar.ts`
- `src/locales/en.ts`
- `src/locales/fr.ts`

Feature-level translations live under each feature's `locales/` folder.

## Tests

Run all client tests:

```powershell
npm run test
```

Current test files cover:

- Notification bell behavior
- Settings panel behavior
- Intern dashboard feature gates
- Intern multi-step application form
