# Key Decisions and Reasoning

This document explains the important design choices made when building the system.

---

## Architecture Decisions

### 1. Split <a href="./08_glossary_for_beginners.md#api" target="_blank">API</a> and Client

**Decision**: Separate the <a href="./08_glossary_for_beginners.md#backend" target="_blank">backend</a> (ASP.NET Core) from the <a href="./08_glossary_for_beginners.md#frontend" target="_blank">frontend</a> (<a href="./08_glossary_for_beginners.md#react" target="_blank">React</a>).

**Why**: 
- Different concerns: business logic vs user interface
- Different teams can work on each
- Flexibility to replace either without touching the other
- Better performance optimization

**Tradeoff**: More complexity in setup and deployment

---

### 2. <a href="./08_glossary_for_beginners.md#role" target="_blank">Role</a>-Based Access Control (<a href="./08_glossary_for_beginners.md#rbac" target="_blank">RBAC</a>)

**Decision**: Every endpoint checks the user's role before returning data.

**Why**:
- Security by default - nothing leaks by accident
- Simple to understand - "who can access what"
- Audit trail - every action is logged (see <a href="./08_glossary_for_beginners.md#audit-log" target="_blank">audit log</a>)

**Tradeoff**: More code to write, must maintain role lists

---

### 3. Token-Based Authentication with <a href="./08_glossary_for_beginners.md#jwt" target="_blank">JWT</a>

**Decision**: Use JWT tokens instead of server-side sessions.

**Why**:
- Stateless - server doesn't store sessions
- Works across multiple servers
- Mobile-friendly (no cookies needed)
- Token contains user info (no database lookup needed)

**Tradeoff**: Token management, refresh logic needed

---

### 4. Feature Flags Per Mission

**Decision**: Each mission can have custom dashboard card visibility.

**Why**:
- Different internship types need different cards
- Supervisors can customize intern experience
- Can hide features for specific interns

**Tradeoff**: More database complexity, code complexity

---

### 5. Supervisor Scope Isolation

**Decision**: Supervisors only see their assigned interns.

**Why**:
- Privacy - interns aren't visible to other supervisors
- Focus - supervisors see only their workload
- No data leakage between departments

**Tradeoff**: More complex queries

---

## Data Model Decisions

### 1. InternProfile Separate from User

**Decision**: Intern details stored in separate table, not in User table.

**Why**:
- Clean separation of auth vs profile data
- Intern-specific fields (CV, skills, etc.) not in main user table
- Different update patterns

---

### 2. Mission as Assignment

**Decision**: Mission represents the internship position, not the program.

**Why**:
- One mission = one intern assignment
- Easy to track, easy to end
- Simpler than more complex models

---

### 3. Deliverable Versions

**Decision**: Track every version of submitted work.

**Why**:
- Audit trail - see all changes
- Never lose previous work
- Supervisor can compare versions

---

### 4. Journal Entries

**Decision**: Interns write daily journal entries.

**Why**:
- Document daily work (good for reviews)
- Supervisors can provide feedback
- Shows work progress over time

---

## API Design Decisions

### 1. RESTful Endpoints

**Decision**: Use standard HTTP methods (GET, POST, PUT, PATCH, DELETE).

**Why**:
- Industry standard
- Easy to understand
- Great tooling available

---

### 2. Returns JSON

**Decision**: Always return JSON, even for errors.

**Why**:
- Consistent client parsing
- Structured error handling
- Easy to debug

---

### 3. <a href="./08_glossary_for_beginners.md#rate-limiting" target="_blank">Rate Limiting</a>

**Decision**: Limit requests per IP/user.

**Why**:
- Prevent abuse
- Protect server resources
- Stop brute force attacks

---

### 4. <a href="./08_glossary_for_beginners.md#csrf" target="_blank">CSRF</a> Protection

**Decision**: Use CSRF tokens in requests.

**Why**:
- Prevent cross-site request forgery
- Security best practice

---

### 5. Audit Logging

**Decision**: Log every important action.

**Why**:
- Accountability - who did what
- Debugging - trace problems
- Compliance - audit trail requirement

---

## Frontend Design Decisions

### 1. Card-Based Dashboard

**Decision**: Display data in cards rather than tables.

**Why**:
- More visual
- Easier to scan
- Better mobile experience

---

### 2. Single Page Application

**Decision**: All on one page, no full reloads.

**Why**:
- Faster transitions
- Better UX
- Modern feel

---

### 3. Feature-Based Organization

**Decision**: Organize code by feature, not by technical type.

**Why**:
- Easier to find related code
- Better for feature development
- Scales well

---

### 4. Multi-Language Support

**Decision**: Support Arabic, English, French.

**Why**:
- Required for the region
- Right-to-left support for Arabic

---

### 5. Theme Support

**Decision**: Light and dark themes.

**Why**:
- User preference
- Accessibility

---

## Security Decisions

### 1. Password Hashing

**Decision**: Use BCrypt for password hashing.

**Why**:
- Industry standard
- Slow - prevents brute force
- Salt included

---

### 2. Secure Cookies

**Decision**: HttpOnly, Secure, SameSite=Strict cookies.

**Why**:
- Prevent XSS attacks
- Require HTTPS
- Prevent CSRF

---

### 3. Email Case Insensitivity

**Decision**: Treat emails as case-insensitive.

**Why**:
- Email standard (user@EXAMPLE.com = user@example.com)
- Prevents duplicate accounts

---

### 4. Account Archive Instead of Delete

**Decision**: Archive accounts instead of hard delete.

**Why**:
- Keep historical data
- Audit requirements
- Can restore if needed

---

## Performance Decisions

### 4. <a href="./08_glossary_for_beginners.md#index" target="_blank">Indexes</a> on Foreign Keys

**Decision**: Index all foreign key fields.

**Why**:
- Faster joins
- Faster lookups

---

### 2. Async/Await

**Decision**: All database calls are async.

**Why**:
non-blocking
- Better scalability
- Don't block threads

---

### 3. No Tracking for Read-Only Queries

**Decision**: Use AsNoTracking() for read-only queries.

**Why**:
- Faster
- Less memory
- No change tracking overhead

---

### 4. Pagination

**Decision**: Limit all list endpoints.

**Why**:
- Prevent huge payloads
- Better performance across network

---

## Maintainability Decisions

### 1. DTOs for Data Transfer

**Decision**: Use separate objects for API requests/responses.

**Why**:
- Hide database structure
- Version control
- Validate input

---

### 2. Services Layer

**Decision**: Business logic in Services, not Controllers.

**Why**:
- Separation of concerns
- Testable
- Reusable

---

### 3. Code Comments

**Decision**: Use XML comments for documentation.

**Why**:
- Swagger auto-docs
- Intellisense
- Self-documenting

---

### 4. Enums for Status Types

**Decision**: Use enums for status, not strings.

**Why**:
- Type safety
- IDE autocomplete
- Compile-time errors

---

## Limitation Decision Explanations

### Why "One Account Per User"

**Not implemented**: Multiple roles on one account

**Reason**:
- User experience is clearer
- Simpler permission model
- More secure

---

### Why No Real-Time Updates

**Not implemented**: WebSocket updates

**Reason**:
- More complexity
- Added infrastructure
- Current polling is sufficient

---

### Why No Native Mobile App

**Not implemented**: iOS/Android app

**Reason**:
- Web app is responsive
- More cost-effective
- Good cross-platform support

---

### Why No Offline Mode

**Not implemented**: Offline-first

**Reason**:
- Real-time data is critical
- Not required by current users
- Added complexity

---

## What Would Break If Changed

| Change | What Breaks |
|--------|------------|
| Remove JWT | All logins fail |
| Remove role checks | Security vulnerabilities |
| Remove feature flags | Mission-specific dashboard customization |
| Remove supervisor scope | Privacy issues |
| Remove audit logging | Compliance issues |
| Remove rate limiting | Server abuse possible |

---

## Next Steps

Now you understand the reasoning, continue to:

- [08_glossary_for_beginners.md](08_glossary_for_beginners.md) - Simple explanations of technical terms

<!-- Wiki-Link Preview System -->
<script src="wiki-link-preview.js"></script>