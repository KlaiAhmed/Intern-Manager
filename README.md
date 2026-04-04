# Axia Intern Manager

An internship management platform built with ASP.NET Core 10 and React/typecript.

## Getting Started

### 1. Clone and Setup

In your terminal: 
```bash
git clone https://github.com/KlaiAhmed/Intern-Manager

cd "Intern Manager"
```


### 2. Configure Environment

Create these two files with any editor:

| File | Purpose | values |
| --- | --- | --- |
| `api/.env` | API and database settings | `api/.env.example` |
| `client/.env` | Frontend API URL | `api/.env.example` |


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
├── client/                             # React frontend application
│   ├── src/                            # Main frontend source code
│   │   ├── app/                        # App shell, providers, and routing
│   │   │   ├── App.tsx                 # App wrapper used by routing
│   │   │   ├── providers/              # Root providers for auth, theme, and i18n
│   │   │   └── routes/                 # Route definitions and guards
│   │   ├── assets/                     # Imported images, icons, and media
│   │   ├── components/                 # Reusable UI components
│   │   ├── features/                   # Feature-based screens and logic
│   │   │   ├── auth/                   # Login, signup, and session flows
│   │   │   ├── dashboard/              # Role-based dashboard pages
│   │   │   └── home/                   # Public landing page content
│   │   ├── hooks/                      # Shared React hooks
│   │   ├── lib/                        # Helper functions and library wrappers
│   │   ├── shared/                     # Cross-cutting UI, state, theme, i18n, and utilities
│   │   │   ├── api/                    # API client and request helpers
│   │   │   ├── config/                 # App configuration
│   │   │   ├── constants/              # Shared constants
│   │   │   ├── errors/                 # Error helpers and error UI
│   │   │   ├── i18n/                   # Translations and localization helpers
│   │   │   ├── layout/                 # Shared layout components
│   │   │   ├── seo/                    # Metadata and page title helpers
│   │   │   ├── state/                  # Shared state management
│   │   │   ├── theme/                  # Theme setup and design tokens
│   │   │   ├── types/                  # Shared TypeScript types for shared code
│   │   │   ├── ui/                     # Generic UI primitives
│   │   │   └── utils/                  # General-purpose utility helpers
│   │   ├── types/                      # Frontend-wide TypeScript types
│   │   ├── App.tsx                     # Root React component
│   │   ├── main.tsx                    # Frontend entry point
│   │   ├── App.css                     # App-specific styles
│   │   └── index.css                   # Global styles
│   ├── public/                         # Static files served by Vite
│   ├── package.json                    # Frontend scripts and dependencies
│   └── vite.config.ts                  # Vite build configuration
│
├── api/                                # ASP.NET Core backend
│   ├── Controllers/                    # API endpoints grouped by feature
│   ├── Data/                           # DbContext, migrations, and seeding
│   ├── Models/                         # Entities, DTOs, requests, and responses
│   ├── Services/                       # Business logic and workflows
│   ├── Common/                         # Shared enums, options, and helpers
│   ├── Extensions/                     # Dependency injection and startup helpers
│   ├── Middleware/                     # Custom request pipeline components
│   ├── Properties/                     # Launch profiles and project metadata
│   ├── Program.cs                      # Backend entry point
│   ├── appsettings.json                # Base configuration
│   ├── appsettings.Development.json    # Development configuration overrides
│   └── uploads/                        # Stored uploaded files
│
└── README.md                           # Quick start and overview
```

## API Reference

Swagger UI is available at `http://localhost:5184/swagger`.

Main endpoints:

- `POST /auth/login` - Sign in
- `GET /auth/me` - Current user
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

