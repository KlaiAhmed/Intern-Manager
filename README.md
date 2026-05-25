# Axia Intern Manager

An internship management platform built with ASP.NET Core 10 and React/TypeScript.

## Getting Started

### 1. Clone and Setup

In your terminal:
```bash
git clone https://github.com/KlaiAhmed/Intern-Manager

cd "Intern Manager"
```


### 2. Configure Environment

Create these two files with any editor:

| File | Purpose | Example |
| --- | --- | --- |
| `api/.env` | API and database settings | `api/.env.example` |
| `client/.env` | Frontend API URL | `client/.env.example` |


### 3. Start SQL EXPRESS Server

| Platform | What to do |
| --- | --- |
| Windows | Start `SQL Server (SQLEXPRESS)` from Services, or run `net start "SQL Server (SQLEXPRESS)"`. |
| Linux/macOS | Connect the app to a running SQL Server instance, usually Docker or a remote server. |

### 4. Run the API

```bash
cd api

# Run the API:
dotnet run

# Or with hot reload:
dotnet watch run
```

Open:

- API: `http://localhost:5184`
- Swagger: `http://localhost:5184/swagger`

The API automatically:
- Creates the database on first run
- Seeds the SuperAdmin account
- Seeds reference data (departments, schools, etc.)

### 5. Run the Client

```bash
cd client

# Install dependencies:
npm install

# Start the frontend:
npm run dev
```

Open:

- Client: `http://localhost:5173`

## Technology Stack

- Backend: ASP.NET Core 10, EF Core 10, SQL Server
- Frontend: React 19, TypeScript 5.9, Vite 8, React Router 7
- Security: JWT, BCrypt, CSRF protection
- Rate limiting: Built-in ASP.NET Core rate limiting


## Project Structure Overview

Modern view:

```text
intern-manager/
├── client/                          # React + Vite frontend
│   ├── src/         
│   │   ├── app/                     # App shell, providers, and routing setup
│   │   ├── assets/                  # Static assets imported in the app
│   │   ├── components/              # Shared reusable UI components
│   │   ├── features/                # Feature-based modules (auth, dashboard, home, notifications)
│   │   ├── hooks/                   # Shared custom hooks
│   │   ├── lib/                     # API clients and utility wrappers
│   │   ├── locales/                 # Global translations and i18n setup
│   │   ├── pages/                   # Route-level page components
│   │   ├── routes/                  # Router configuration and guards
│   │   ├── stores/                  # Global state and context providers
│   │   ├── styles/                  # Global styles
│   │   ├── types/                   # Shared TypeScript types
│   │   ├── utils/                   # General utility helpers
│   │   ├── main.tsx                 # Frontend entry point
│   │   └── vite-env.d.ts            # Vite type declarations
│   ├── public/                      # Static files served directly
│   ├── package.json                 # Frontend dependencies and scripts
│   ├── tsconfig.json                # TypeScript configuration
│   ├── vite.config.ts               # Vite configuration
│   └── .env                         # Frontend environment variables
│        
├── api/                             # ASP.NET Core backend
│   ├── Controllers/                 # API endpoints
│   ├── Data/                        # DbContext, migrations, and seeding
│   ├── Models/                      # Entities, DTOs, and request/response models
│   ├── Services/                    # Business logic
│   ├── Common/                      # Shared enums, options, and helpers
│   ├── Extensions/                  # Startup and DI extensions
│   ├── Middleware/                  # Custom middleware
│   ├── Properties/                  # Launch settings and metadata
│   ├── Program.cs                   # Backend entry point
│   ├── appsettings.json             # Base configuration
│   ├── appsettings.Development.json # Development overrides
│   ├── uploads/                     # Uploaded files
│   └── .env                         # Backend environment variables
│        
├── AGENTS.md                        # Instructions for agents
├── .gitignore                       # Git ignored files and folders
└── README.md                        # Project overview and setup guide
```

## Client Architecture Highlights

The client follows a **feature-first architecture**:

- **`src/features/`**: Contains business logic organized by domain (auth, dashboard, home, notifications)
- **`src/components/`**: Shared, reusable UI components (layout, buttons, cards, etc.)
- **`src/stores/`**: Global state management (Auth, Theme, RolePreference)
- **`src/lib/`**: Third-party library wrappers and helpers (API client, auth API)
- **`src/locales/`**: Global internationalization (ar, en, fr)
- **`src/pages/`**: Page components used by the router
- **`src/routes/`**: Routing configuration and guards

Each feature module is self-contained with:
- `api/` - API calls specific to the feature
- `components/` - UI components for the feature
- `hooks/` - Custom React hooks for the feature
- `locales/` - Translations for the feature
- `types/` - TypeScript types for the feature
- `styles/` - CSS specific to the feature

## API Reference

Swagger UI is available at `http://localhost:5184/swagger`.

Main endpoints:

- `POST /auth/login` - Sign in
- `GET /auth/me` - Current user
- `POST /api/auth/forgot-password` - Request a 6-digit reset code
- `POST /api/auth/verify-reset-code` - Verify code and get verification token
- `POST /api/auth/reset-password` - Reset password with verification token
- `GET /users` - Users list for Admin/SuperAdmin
- `GET/POST /internships` - Internship management
- `GET/POST /missions` - Mission management
- `GET/POST /deliverables` - Deliverable tracking



## Context Structure

`useAuth()` gives you:

| Field | Meaning |
| --- | --- |
| `user` | Current signed-in user, or `null` |
| `isAuthenticated` | `true` when the user is signed in |
| `login(email, password)` | Signs the user in |
| `logout()` | Signs the user out |
| `refreshToken()` | Renews the session |
| `isLoading` | `true` while auth is still loading |


### Handle API Errors

| Status | Meaning | What to do |
| --- | --- | --- |
| `401` | Not signed in or session expired | Log in again or refresh the session |
| `403` | Signed in, but not allowed | Use an account with the right role |
| `429` | Too many requests | Wait and try again later |
| Other | Request failed | Show the message returned by the API |

### Configure Protected Route

Think of it as a simple gate:

- Loading -> show a spinner
- Not signed in -> send the user to `/login`
- Wrong role -> send the user to `/dashboard`
- Allowed -> render the page

## Rate Limiting

Use rate limits to protect busy actions.

| Policy | Limit | Typical use |
| --- | --- | --- |
| `auth` | 10 requests per minute | Login and auth endpoints |
| `upload` | 5 requests per minute | File uploads |
| `write-heavy` | 20 requests per minute | Regular write actions |

Add the matching policy name to the action you want to protect, for example `upload` for file uploads.


## Security Configuration

### JWT Configuration

- The API uses JWT access tokens plus refresh cookies.
- Token validation checks issuer, audience, signature, and expiry.
- Protected requests also use a CSRF token.

### CORS for Production

- Allow only the real frontend domains in production.
- Keep credentials enabled so cookies still work.

### Secure File Upload

- Allow only `.pdf`, `.doc`, `.docx`, and `.zip`.
- Limit uploads to 10 MB.
- Generate a safe file name instead of trusting the original one.
- Create the upload folder before saving the file.

## Testing the API
Swagger UI is available at `http://localhost:5184/swagger`
