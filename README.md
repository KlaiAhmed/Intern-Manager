# Axia Intern Manager

A full-stack internship management platform built with ASP.NET Core 10 and React 19.

## Getting Started

### 1. Clone and Setup

```bash
git clone <repository-url>
cd "Intern Manager"
```

### 2. Configure Environment

Create the API configuration:

```bash
# In api/.env
cat > api/.env << 'EOF'
SERVER_PORT=5184
CLIENT_ORIGIN=http://localhost:5173
DATABASE_PATH=app.db
SQLSERVER_INSTANCE=.\SQLEXPRESS
JWT__KEY=your-minimum-32-byte-secret-key-here

# SuperAdmin account (seeded on first run)
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PASSWORD=changeme123!
SUPERADMIN_FIRSTNAME=Admin
SUPERADMIN_LASTNAME=User
EOF
```

Create the client configuration:

```bash
# In client/.env
cat > client/.env << 'EOF'
VITE_API_BASE_URL=http://localhost:5184
EOF
```

### 3. Start SQL Server

Ensure SQL Server is running locally:

```bash
# Check if SQL Server Express is running
sqlcmd -S ".\SQLEXPRESS" -Q "SELECT @@VERSION"

# Or start it if not running
net start "SQL Server (SQLEXPRESS)"
```

### 4. Run the API

```bash
cd api

# Restore dependencies
dotnet restore

# Build and run
dotnet run --project InternManager.Api.csproj

# API available at: http://localhost:5184
# Swagger UI: http://localhost:5184/swagger
```

The API automatically:
- Creates the database on first run
- Seeds the SuperAdmin account
- Seeds reference data (departments, schools, etc.)

### 5. Run the Client

```bash
cd client

# Install dependencies
npm install

# Start development server
npm run dev

# Client available at: http://localhost:5173
```

## First API Request

Test the API with curl:

```bash
# Login as SuperAdmin
curl -X POST http://localhost:5184/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"changeme123!"}' \
  -c cookies.txt

# Get current user info
curl http://localhost:5184/auth/me \
  -b cookies.txt

# List all users (admin only)
curl http://localhost:5184/users \
  -b cookies.txt
```

Or with JavaScript:

```javascript
// Login and store tokens in cookies
const response = await fetch('http://localhost:5184/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'changeme123!'
  })
});

const data = await response.json();
// Response: { id, email, firstName, lastName, roles, csrfToken }

// Make authenticated request with CSRF token
const users = await fetch('http://localhost:5184/users', {
  credentials: 'include',
  headers: {
    'X-CSRF-Token': data.csrfToken
  }
});
```

## Context Structure

```typescript
// AuthContext returns this structure
interface AuthContextType {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: ('SuperAdmin' | 'Admin' | 'Supervisor' | 'Intern')[];
  } | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  isLoading: boolean;
}
```

## Common Operations

### Create a New Internship

```bash
# POST /internships
curl -X POST http://localhost:5184/internships \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: your-csrf-token" \
  -b cookies.txt \
  -d '{
    "internId": "uuid-of-intern",
    "supervisorId": "uuid-of-supervisor",
    "startDate": "2026-04-01",
    "endDate": "2026-09-30",
    "type": "FullTime",
    "departmentId": 1
  }'
```

### Register New Intern

```bash
# POST /auth/signup/intern
curl -X POST http://localhost:5184/auth/signup/intern \
  -H "Content-Type: application/json" \
  -d '{
    "email": "intern@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "schoolId": 1,
    "studyLevel": "Bachelor3",
    "specialization": "Computer Science"
  }'
```

### Handle API Errors

```typescript
// Client-side error handling
async function apiRequest(url: string, options: RequestInit) {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include'
    });

    if (response.status === 401) {
      // Token expired - refresh and retry
      await refreshToken();
      return apiRequest(url, options);
    }

    if (response.status === 403) {
      throw new Error('Access denied - insufficient permissions');
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new Error(`Rate limit exceeded. Retry after ${retryAfter}s`);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}
```

### Configure Protected Route

```typescript
// React Router protected route component
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';

function ProtectedRoute({ children, requiredRole }: {
  children: React.ReactNode;
  requiredRole?: string;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !user?.roles.includes(requiredRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Usage in router
<Route path="/admin" element={
  <ProtectedRoute requiredRole="Admin">
    <AdminDashboard />
  </ProtectedRoute>
} />
```

## Adding Rate Limiting to an Endpoint

```csharp
// Controller endpoint with rate limiting
using Microsoft.AspNetCore.RateLimiting;

[ApiController]
[Route("api/[controller]")]
public class UploadController : ControllerBase
{
    // Strict limit for uploads
    [HttpPost("deliverables")]
    [EnableRateLimiting("upload")]  // 5 requests per minute
    [Authorize(Roles = "Intern")]
    public async Task<IActionResult> UploadDeliverable(IFormFile file)
    {
        // Handle file upload
    }

    // Standard limit for writes
    [HttpPost("feedback")]
    [EnableRateLimiting("write-heavy")]  // 20 requests per minute
    [Authorize]
    public async Task<IActionResult> SubmitFeedback([FromBody] FeedbackRequest request)
    {
        // Handle submission
    }
}
```

Configure policies in `Program.cs`:

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Auth endpoints: 10/min
    options.AddFixedWindowLimiter("auth", opt => {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
    });

    // File uploads: 5/min
    options.AddFixedWindowLimiter("upload", opt => {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromMinutes(1);
    });

    // General writes: 20/min
    options.AddFixedWindowLimiter("write-heavy", opt => {
        opt.PermitLimit = 20;
        opt.Window = TimeSpan.FromMinutes(1);
    });
});
```

## Database Operations

### Add a Migration

```bash
cd api

# Create migration
dotnet ef migrations add AddNotificationsTable \
  --project InternManager.Api.csproj

# Apply to database
dotnet ef database update \
  --project InternManager.Api.csproj

# Remove last migration (if not applied)
dotnet ef migrations remove \
  --project InternManager.Api.csproj
```

### Seed Reference Data

```csharp
// In Data/DbSeeder.cs
public static async Task SeedReferenceDataAsync(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // Seed departments if empty
    if (!context.Departments.Any())
    {
        context.Departments.AddRange(
            new Department { Name = "Engineering", Code = "ENG" },
            new Department { Name = "Marketing", Code = "MKT" },
            new Department { Name = "Sales", Code = "SAL" }
        );
        await context.SaveChangesAsync();
    }

    // Seed schools if empty
    if (!context.Schools.Any())
    {
        context.Schools.AddRange(
            new School { Name = "MIT", Country = "USA" },
            new School { Name = "Stanford", Country = "USA" }
        );
        await context.SaveChangesAsync();
    }
}
```

### Query with Related Data

```csharp
// Controller with eager loading
[HttpGet("{id}")]
public async Task<ActionResult<InternshipDto>> GetById(Guid id)
{
    var internship = await _context.Internships
        .Include(i => i.Intern)
            .ThenInclude(p => p!.User)
        .Include(i => i.Supervisor)
            .ThenInclude(s => s!.User)
        .Include(i => i.Department)
        .Include(i => i.Missions)
            .ThenInclude(m => m.Deliverables)
        .FirstOrDefaultAsync(i => i.Id == id);

    if (internship == null)
        return NotFound();

    return Ok(_mapper.Map<InternshipDto>(internship));
}
```

## Security Configuration

### JWT Configuration

```csharp
// In Program.cs or Extensions/AuthExtensions.cs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "AxiaInternManager",
            ValidAudience = "AxiaInternManagerClient",
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.Zero
        };

        // Read token from cookie
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                context.Token = context.Request.Cookies["access_token"];
                return Task.CompletedTask;
            }
        };
    });
```

### CORS for Production

```csharp
// Configure CORS with specific origins
builder.Services.AddCors(options =>
{
    options.AddPolicy("ProductionCors", policy =>
    {
        policy.WithOrigins(
                "https://app.yourdomain.com",
                "https://admin.yourdomain.com")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Use in app pipeline
if (app.Environment.IsProduction())
{
    app.UseCors("ProductionCors");
}
```

### Secure File Upload

```csharp
[HttpPost("upload")]
[Authorize(Roles = "Intern,Supervisor")]
public async Task<IActionResult> UploadFile(IFormFile file)
{
    // Validate file type
    var allowedTypes = new[] { ".pdf", ".doc", ".docx", ".zip" };
    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

    if (!allowedTypes.Contains(extension))
    {
        return BadRequest(new { error = "File type not allowed" });
    }

    // Validate file size (max 10MB)
    if (file.Length > 10 * 1024 * 1024)
    {
        return BadRequest(new { error = "File too large (max 10MB)" });
    }

    // Generate safe filename
    var safeFileName = Guid.NewGuid().ToString() + extension;
    var uploadsPath = Path.Combine(_env.WebRootPath, "uploads");
    var filePath = Path.Combine(uploadsPath, safeFileName);

    // Ensure directory exists
    Directory.CreateDirectory(uploadsPath);

    // Save file
    using var stream = new FileStream(filePath, FileMode.Create);
    await file.CopyToAsync(stream);

    // Return reference
    return Ok(new {
        fileId = safeFileName,
        originalName = file.FileName,
        size = file.Length
    });
}
```

## Testing the API

### Using HTTP Client (VS Code REST Client)

Create a `test.http` file:

```http
### Variables
@baseUrl = http://localhost:5184
@csrfToken = your-csrf-token-here

### Login
# @name login
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "changeme123!"
}

### Get Users
GET {{baseUrl}}/users

### Create Internship
POST {{baseUrl}}/internships
Content-Type: application/json
X-CSRF-Token: {{csrfToken}}

{
  "internId": "550e8400-e29b-41d4-a716-446655440000",
  "supervisorId": "550e8400-e29b-41d4-a716-446655440001",
  "startDate": "2026-04-01",
  "endDate": "2026-09-30",
  "departmentId": 1
}
```

### Integration Test Example

```csharp
// Tests/InternshipsControllerTests.cs
public class InternshipsControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public InternshipsControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetInternships_ReturnsOk()
    {
        // Arrange
        await AuthenticateAsync();

        // Act
        var response = await _client.GetAsync("/api/internships");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadFromJsonAsync<List<InternshipDto>>();
        content.Should().NotBeNull();
    }

    private async Task AuthenticateAsync()
    {
        var loginResponse = await _client.PostAsJsonAsync("/auth/login", new
        {
            Email = "admin@example.com",
            Password = "testpass123!"
        });

        loginResponse.EnsureSuccessStatusCode();
    }
}
```

## Project Structure Overview

Key directories and files:

- `api/Program.cs` - Entry point, DI configuration
- `api/Data/AppDbContext.cs` - EF Core database context
- `api/Controllers/` - API controllers
- `api/Services/` - Business logic layer
- `client/src/features/` - React feature modules
- `client/src/shared/` - Shared components and utilities
- `CLAUDE.md` - Development guidelines

## Technology Stack

- **Backend**: ASP.NET Core 10, EF Core 10, SQL Server
- **Frontend**: React 19, TypeScript 5.9, Vite 8, React Router 7
- **Security**: JWT authentication, BCrypt, CSRF protection
- **Rate Limiting**: Built-in ASP.NET Core rate limiting

## API Reference

See Swagger UI at `http://localhost:5184/swagger` for complete API documentation with interactive testing.

Key endpoints:
- `POST /auth/login` - Login (10/min rate limit)
- `GET /auth/me` - Get current user
- `GET /users` - List users (Admin/SuperAdmin)
- `GET/POST /internships` - Internship CRUD
- `GET/POST /missions` - Mission management
- `GET/POST /deliverables` - Deliverable tracking
