# API Explained

This document explains how the ASP.NET Core <a href="./08_glossary_for_beginners.md#backend" target="_blank">backend</a> works.

---

## What is an <a href="./08_glossary_for_beginners.md#api" target="_blank">API</a>?

An <a href="./08_glossary_for_beginners.md#api" target="_blank">API</a> (Application Programming Interface) is the <a href="./08_glossary_for_beginners.md#backend" target="_blank">backend</a> server that handles data and business logic. It's like the "brain" of the application - users don't see it directly, but it handles everything they request.

---

## How the <a href="./08_glossary_for_beginners.md#backend" target="_blank">Backend</a> is Organized

The API source code (`api/`) follows a layered architecture:

```
api/
├── Controllers/       # API endpoints (entry points)
├── Services/         # Business logic (operations)
├── Models/
│   ├── Entities/   # Database tables
│   ├── DTOs/      # Data transfer objects
│   ├── Requests/    # Input formats
│   └── Responses/  # Output formats
├── Data/           # Database context
├── Common/         # Shared utilities
├── Middleware/     # Custom filters
└── Extensions/     # DI setup
```

---

## API Endpoints (Controllers)

Every API endpoint is defined in a Controller. Each controller handles a specific domain:

| Controller | Route | What It Does |
|------------|-------|-------------|
| **AuthController** | `/auth/*` | Login, logout, signup, password reset |
| **UsersController** | `/api/users/*` | User CRUD operations |
| **InternsController** | `/api/interns/*` | Intern profiles |
| **InternshipsController** | `/api/internships/*` | Internship programs |
| **MissionsController** | `/api/missions/*` | Mission management |
| **DeliverablesController** | `/api/deliverables/*` | Work submissions |
| **EvaluationsController** | `/api/evaluations/*` | Performance reviews |
| **MeetingsController** | `/api/meetings/*` | Meeting scheduling |
| **JournalController** | `/api/journal/*` | Intern journal entries |
| **SupervisorJournalController** | `/api/supervisor-journal/*` | Journal comments |
| **NotificationsController** | `/api/notifications/*` | System notifications |
| **UsersController** | `/api/users/*` | System administration |

---

## Request Format

Clients send HTTP requests to the API:

```
Method: POST
URL: http://localhost:5184/api/auth/login
Headers:
  Content-Type: application/json
Body:
  {
    "email": "user@example.com",
    "password": "securePassword123"
  }
```

---

## Response Format

The API responds with JSON:

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "abc-123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "intern",
  "status": "active"
}
```

---

## Authentication Flow (API)

```
Request: POST /auth/login
        { email, password }
              ↓
        Lookup user in database
              ↓
        Verify password hash
              ↓
        ├─ Invalid → Return 401
        └─ Valid → Create JWT tokens
                   ↓
              Save refresh token in DB
                   ↓
              Set cookies (access, refresh, csrf)
                   ↓
              Return 200 OK
```

---

## <a href="./08_glossary_for_beginners.md#jwt" target="_blank">JWT</a> Token Structure

The API uses <a href="./08_glossary_for_beginners.md#jwt" target="_blank">JWT</a> (JSON Web Tokens) for <a href="./08_glossary_for_beginners.md#authentication" target="_blank">authentication</a>:

```json
{
  "sub": "user-id-123",
  "email": "user@example.com",
  "role": "intern",
  "csrf": "csrf-token-value",
  "exp": 1234567890
}
```

- **Access token**: 15 minutes validity
- **Refresh token**: 7 days validity
- <a href="./08_glossary_for_beginners.md#csrf" target="_blank">CSRF</a> token: Security against cross-site attacks

---

## <a href="./08_glossary_for_beginners.md#authorization" target="_blank">Authorization</a> (Who Can Access What)

The API uses the `[Authorize]` attribute to protect endpoints:

```csharp
// Everyone can access (login page)
[AllowAnonymous]
[HttpPost("login")]

// Only logged-in users
[Authorize]
[HttpGet("me")]

// Only specific roles
[Authorize(Roles = "SuperAdmin,Admin")]
[HttpGet("users")]
```

---

## Role-Based Access Control (RBAC)

The API checks the user's role before allowing access:

```csharp
// Route: GET /api/interns
// Only SuperAdmin, Admin, Manager, Supervisor can access
[Authorize(Roles = "SuperAdmin,Admin,Manager,Supervisor")]
```

Supervisors only see their assigned interns (enforced in the service layer).

---

## Database Access (<a href="./08_glossary_for_beginners.md#entity-framework-core" target="_blank">Entity Framework</a>)

The API uses **Entity Framework Core** to talk to SQL Server:

```csharp
// Example: Get all users
var users = await dbContext.Users
    .Where(u => u.Status == UserStatus.Active)
    .ToListAsync();
```

---

## <a href="./08_glossary_for_beginners.md#rate-limiting" target="_blank">Rate Limiting</a>

The API protects against abuse using rate limiting:

| Policy | Limit | Use Case |
|--------|-------|---------|
| `auth` | 5/min | Login attempts |
| `upload` | 5/min | File uploads |
| `write-heavy` | 20/min | Data modifications |
| `read-frequent` | 100/min | List views |

---

## Error Handling

All errors go through `GlobalExceptionMiddleware`:

```
Error occurs
    ↓
Catch and log error
    ↓
Return standardized error format
{
  "type": "https://httpstatuses.com/500",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "Error message"
}
```

---

## Key API Features

### 1. <a href="./08_glossary_for_beginners.md#audit-log" target="_blank">Audit Logging</a>

Every important action is logged:

```csharp
dbContext.AuditLogs.Add(new AuditLog
{
    ActorUserId = currentUserId,
    Actor = currentUserEmail,
    Action = "user.create",
    Entity = "user:123"
});
```

---

### 2. <a href="./08_glossary_for_beginners.md#feature-flag" target="_blank">Feature Flags</a>

Dashboard cards can be toggled per mission:

```csharp
// Mission has custom feature flags
var flags = new MissionCardConfig
{
    journal = new CardConfig(isVisible: true, isInteractive: true),
    tasks = new CardConfig(isVisible: false)
};
```

---

### 3. Onboarding Validation

Interns must complete profile before accessing dashboard:

```csharp
// Check intern status before allowing access
if (user.VerificationStatus == InternVerificationStatus.INCOMPLETE)
{
    return Redirect("/application-form");
}
```

---

## Development Helpers

### Lazy Auth Bypass (Development Only)

In development mode, you can bypass login:

```
http://localhost:5184/api/example?role=admin
```

This allows quick testing without real authentication.

---

### <a href="./08_glossary_for_beginners.md#swagger" target="_blank">Swagger</a> Documentation

In development, API docs available at:
```
http://localhost:5184/swagger
```

Shows all endpoints, parameters, and response formats.

---

## Common API Patterns

### 1. GET - Retrieve Data

```csharp
[HttpGet]
public async Task<IActionResult> GetItems()
{
    var items = await service.GetAllAsync();
    return Ok(items);
}
```

### 2. POST - Create Data

```csharp
[HttpPost]
public async Task<IActionResult> CreateItem([FromBody] CreateRequest request)
{
    var item = await service.CreateAsync(request);
    return Created($"/api/items/{item.Id}", item);
}
```

### 3. PUT/PATCH - Update Data

```csharp
[HttpPatch("{id:guid}")]
public async Task<IActionResult> UpdateItem(Guid id, [FromBody] UpdateRequest request)
{
    var updated = await service.UpdateAsync(id, request);
    return Ok(updated);
}
```

### 4. DELETE - Delete Data

```csharp
[HttpDelete("{id:guid}")]
public async Task<IActionResult> DeleteItem(Guid id)
{
    await service.DeleteAsync(id);
    return NoContent();
}
```

---

## Service Layer Pattern

Business logic goes in Services, not Controllers:

```
Controller    →  Receives request
    ↓
Service      →  Business logic
    ���
Repository  →  Database access
    ↓
Database    →  SQL Server
```

Example:

```csharp
// Controller
[HttpGet("interns")]
public async Task<IActionResult> GetInterns()
{
    var interns = await internService.GetAllAsync();
    return Ok(interns);
}

// Service
public async Task<List<Intern>> GetAllAsync()
{
    return await repository.GetAllAsync();
}
```

---

## Next Steps

Now you understand the API, continue to:

- [Database Structure](06_database_structure.md) - Database organization
- [Key Decisions and Reasoning](07_key_decisions_and_reasoning.md) - Why it was built this way

---