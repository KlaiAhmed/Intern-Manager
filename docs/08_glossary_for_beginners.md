# Glossary for Beginners

Welcome! This guide explains the technical terms used in the Axia Intern Manager project. Each term is explained in simple, plain English with examples.

---

## **A**

### API
**What it is**: API stands for "Application Programming Interface." Think of it as a messenger that connects two programs.

**Simple explanation**: Imagine you're ordering food at a restaurant. You talk to the waiter (API), and the waiter talks to the kitchen (server). You don't talk directly to the chefs. In our project, the API is the messenger between what users see (the website) and where data is stored (the database).

**Example**:
```
User clicks "View Interns" 
    ↓
Website asks API: "Give me the intern list"
    ↓
API asks database: "What interns are there?"
    ↓
Database says: "Here are 10 interns"
    ↓
API sends list back to website
    ↓
Website shows intern names
```

---

### Audit Log
**What it is**: A record that tracks who did what in the system.

**Simple explanation**: Like a security camera or a diary that records every important action. If something goes wrong, you can look back and see exactly who did it and when.

**Example**:
```
John (Admin) creates a new user account
    ↓
System automatically writes: "John created user 'alice' at 10:30 AM"
    ↓
This entry is saved in the Audit Log forever
```

**Why we need it**: For security and to solve problems. If someone reports "My account was deleted!", we check the audit log and see who did it.

---

### Authentication
**What it is**: The process of proving who you are when logging in.

**Simple explanation**: Like showing your ID at a club. The bouncer checks your ID and says "Okay, you can come in" if it's valid, or "Go away" if it's fake.

**Example**:
```
You type your email and password
    ↓
Server checks: Is this password correct?
    ↓
If yes → "You're authenticated! Welcome back."
    ↓
If no → "Wrong password. Try again."
```

---

### Authorization
**What it is**: Checking if you have permission to do something.

**Simple explanation**: After proving who you are (authentication), the system checks if you're allowed to do what you want. Like being 18+ to enter a bar - you prove who you are first, then you prove you're old enough.

**Example**:
```
You log in as an Intern
    ↓
You try to access Admin settings
    ↓
System asks: "Is Intern allowed to see Admin settings?"
    ↓
Answer: NO → "Sorry, that's not for you."
```

---

### Backend
**What it is**: The server-side part of the application that handles data and logic.

**Simple explanation**: The "brain" of the application - what happens behind the scenes. You don't see it, but it does all the work.

**Example**:
```
Frontend (what you see)           Backend (what happens)
┌─────────────┐                    ┌─────────────────┐
│  Website    │                    │  Server Code    │
│  Buttons    │                    │  Database Access│
│  Forms      │ ← Requests →       │  Security Checks│
│  Results    │  ← Responses ←     │  Business Logic │
└─────────────┘                    └─────────────────┘
```

---

### Component
**What it is**: A reusable piece of code that creates part of the user interface.

**Simple explanation**: Like LEGO blocks. You build one button once, then use it everywhere. Instead of writing the same button code 50 times, you write it once as a component and reuse it.

**Example**:
```
// One component written once
function Button({ label }) {
  return <button>{label}</button>
}

// Used many times
<Button label="Submit"/>
<Button label="Cancel"/>
<Button label="Delete"/>
```

---

### Context
**What it is**: A way to share data across the entire application without passing it around.

**Simple explanation**: Like a school backpack. Everyone in the class (components) can access the same backpack (context) and see what's in it. You don't need to carry your backpack in every single class - it just exists and everyone can use it.

**Example**:
```
// One place to store user info
const AuthContext = createContext()

// Any component can access it
function MyComponent() {
  const user = useContext(AuthContext)
  return <p>Welcome, {user.name}!</p>
}
```

---

### CSRF
**What it is**: CSRF stands for "Cross-Site Request Forgery" protection.

**Simple explanation**: Like a secret handshake. Without it, a hacker could trick you into clicking a link that does something on your account (like changing your password). CSRF tokens make sure the request actually came from you, not a hacker.

**Example**:
```
Hacker creates fake link: "click me to delete account"
    ↓
Without CSRF: You click it → Account deleted! (bad)
    ↓
With CSRF: You click it → System checks secret token
    ↓
Token doesn't match → "Sorry, I didn't authorize this."
```

---

### Database
**What it is**: A place where data is stored permanently.

**Simple explanation**: Like a digital filing cabinet. When you save information (like user names, intern details), it goes into the database and stays there until deleted.

**Example**:
```
You create a user: "John Doe, email: john@example.com"
    ↓
This info is saved in the Users table in the database
    ↓
Even if you close the app, the info is still there
    ↓
Next time you log in, the system finds John in the database
```

---

### Entity Framework Core
**What it is**: A tool that helps the application talk to the database.

**Simple explanation**: Like a translator. Instead of writing complex SQL code (the language databases speak), you write normal C# code, and Entity Framework translates it for you.

**Example**:
```
// Without Entity Framework (hard SQL)
SELECT * FROM Users WHERE Role = 'Admin'

// With Entity Framework (easy C#)
var admins = db.Users.Where(u => u.Role == "Admin").ToList();
```

---

### Frontend
**What it is**: The part of the application that users see and interact with.

**Simple explanation**: The "face" of the application. Everything you see - buttons, forms, colors, text - is the frontend. The backend does the work, but the frontend shows you the results.

**Example**:
```
Frontend elements:
- Login form with email/password fields
- Dashboard with colorful cards
- Buttons that say "Submit" or "Cancel"
- Navigation menu at the top
```

---

### Feature Flag
**What it is**: A switch that can turn features on or off.

**Simple explanation**: Like a light switch. You can turn a feature on for everyone, or off for specific people or missions. This lets you test new features without making them available to everyone.

**Example**:
```
// New "Journal" feature
Feature Flag: journal.isVisible = true for everyone

// Testing with only some users
Feature Flag: journal.isVisible = true for "Test Group"
             journal.isVisible = false for everyone else
```

---

### Frontend
**What it is**: The part of the application that users see and interact with.

**Simple explanation**: The "face" of the application. Everything you see - buttons, forms, colors, text - is the frontend. The backend does the work, but the frontend shows you the results.

**Example**:
```
Frontend elements:
- Login form with email/password fields
- Dashboard with colorful cards
- Buttons that say "Submit" or "Cancel"
- Navigation menu at the top
```

---

### HTTP
**What it is**: HTTP stands for "HyperText Transfer Protocol" - the language browsers and servers use to talk to each other.

**Simple explanation**: Like a conversation protocol. When you visit a website, your browser sends HTTP requests to the server, and the server sends HTTP responses back.

**Example types**:
- GET: "Show me this page"
- POST: "I'm sending you new data"
- PUT: "I'm updating existing data"
- DELETE: "Remove this item"

---

### Index
**What it is**: A special structure that makes database lookups faster.

**Simple explanation**: Like the index at the back of a book. Instead of reading every page to find a word, you look up the index and jump straight to where it is.

**Example**:
```
Without Index: Search "John" → Scan every user record (slow)
With Index: Search "John" → Look up "John" in index → Go straight to page 42 (fast)
```

---

### Intern
**What it is**: A person doing an internship - someone learning their job.

**Simple explanation**: In our system, an Intern is a user role. They're the people who sign up and complete their internship tasks.

**What interns can do**:
- Create their profile
- View their assigned mission
- Submit work (deliverables)
- Write daily journal entries
- View their evaluations

**What interns can't do**:
- See other interns' work
- Create users
- Access admin settings

---

### JSON
**What it is**: JSON stands for "JavaScript Object Notation" - a simple way to format data.

**Simple explanation**: Like a standardized way to exchange information. When the frontend asks the backend for data, it uses JSON. It's just text that looks like this:

**Example**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "intern"
}
```

The backend sends this format, and the frontend reads it and displays it.

---

### JWT
**What it is**: JWT stands for "JSON Web Token" - a secure way to prove you're logged in.

**Simple explanation**: Like a digital ID card. After you log in, the server gives you a JWT token. Every time you make a request, you show this token to prove you're who you say you are.

**What's in a JWT**:
- User ID
- Email
- Role (intern, supervisor, admin, etc.)
- Expiration time

**Two types**:
- Access token: Short-lived (15 minutes)
- Refresh token: Longer-lived (7 days) - used to get new access tokens

---

### Manager
**What it is**: A role in the system who oversees departments.

**Simple explanation**: Think of a manager as a department head. They can't create users or change settings, but they can see all the interns and missions in their department.

**What managers can do**:
- View department statistics
- See all interns in their department
- Monitor progress across supervisors
- View all missions

**What managers can't do**:
- Create or edit users
- Access system settings
- Supervise interns directly

---

### Mission
**What it is**: An assigned internship position.

**Simple explanation**: A specific internship that's been created and assigned to an intern. One mission = one intern doing work.

**Example**:
```
Supervisor creates a mission:
- Title: "Develop Mobile App Feature"
- Intern: "John"
- Start Date: Jan 15, 2026
- End Date: Mar 15, 2026
```

This mission stays in the system until it's completed.

---

### RBAC
**What it is**: RBAC stands for "Role-Based Access Control."

**Simple explanation**: A permission system where what you can do depends on your role. If you're an intern, you can only do intern things. If you're an admin, you can do admin things.

**How it works**:
```
Role: Intern
→ Can: View own missions, submit work
→ Can't: See other interns, create users

Role: Admin
→ Can: Create users, manage settings
→ Can't: Delete accounts permanently
```

---

### React
**What it is**: A library for building user interfaces.

**Simple explanation**: A tool for making websites. Instead of writing HTML every time something changes, React lets you describe how things should look, and it updates automatically when the data changes.

**Why we use it**:
- Easy to build complex interfaces
- Fast updates when data changes
- Great for large applications

---

### Refresh Token
**What it is**: A token used to get a new access token when the old one expires.

**Simple explanation**: Like a VIP pass. Your access token (daily pass) expires after 15 minutes. But you have a refresh token (VIP pass good for 7 days) that you can use to get a new daily pass without logging in again.

**How it works**:
```
15 minutes pass → Access token expires
    ↓
Clicking a button would fail
    ↓
System uses Refresh Token to get new Access Token
    ↓
You can continue using the app
```

---

### Role
**What it is**: A category of user with specific permissions.

**Simple explanation**: Like job titles. Your role determines what you can see and do in the system.

**The 5 roles**:

| Role | Level | Key Responsibility |
|------|-------|-------------------|
| SuperAdmin | Top | Create admins, full system control |
| Admin | High | Manage users and settings |
| Manager | Medium | View department stats |
| Supervisor | Medium | Guide assigned interns |
| Intern | Bottom | Complete internship tasks |

---

### SQL Server
**What it is**: A database management system made by Microsoft.

**Simple explanation**: Software that stores and organizes data. It's like a really advanced spreadsheet that can handle millions of records.

**Why we use it**:
- Reliable and secure
- Handles large amounts of data
- Well-supported and well-documented

---

### State
**What it is**: The current condition or data of your application.

**Simple explanation**: Like your backpack's contents. At any moment, your app has certain data: who's logged in, what language you're using, what theme (light/dark). This collection of data is called "state."

**Example states**:
```
User is logged in: true
Current language: English
Theme: Dark mode
```

---

### Table
**What it is**: A database structure that stores related data in rows and columns.

**Simple explanation**: Like a spreadsheet. Each row is a record, each column is a field.

**Example - Users table**:
```
| Id    | FirstName | Email              | Role    |
|-------|-----------|--------------------|---------|
| 1     | John      | john@example.com   | intern  |
| 2     | Alice     | alice@test.com     | admin   |
```

---

### Token
**What it is**: A small piece of data that proves something.

**Simple explanation**: Like a digital key or pass. In our system, tokens prove you're logged in (authentication tokens) or that a request is legitimate (CSRF tokens).

**Types of tokens**:
- JWT tokens (for logging in)
- CSRF tokens (for security)
- Refresh tokens (for getting new access tokens)

---

### TypeScript
**What it is**: JavaScript with extra safety checks.

**Simple explanation**: JavaScript is like writing code without a map - you can go anywhere, but you might get lost. TypeScript adds type hints (like street signs) so you know where things are. It catches errors before you even run the code.

**Why we use it**:
- Catches mistakes early
- Better autocomplete in editors
- Easier to maintain large codebases

---

### Vite
**What it is**: A tool that helps developers work with frontend applications.

**Simple explanation**: Like a fast development server that helps you build and run your React app quickly. It also creates optimized production builds.

**What it does**:
- Starts a development server (localhost:5173)
- Compiles TypeScript and React code
- Handles hot reloading (changes appear instantly)
- Creates production-ready builds

---

## **O**

### OAuth
**What it is**: A standard way to allow users to log in with their existing accounts.

**Simple explanation**: Like using "Continue with Google" or "Sign in with Facebook." Instead of creating a new password, you use your existing account from another service.

**Why we use it**: Makes it easier for users to sign up without creating new accounts.

---

## **P**

### Pending
**What it is**: A status meaning "waiting for something to happen."

**Simple explanation**: Like an application waiting to be approved. An intern with "Pending" status has completed their profile but hasn't been assigned to a mission yet.

**Example flow**:
```
Intern completes profile
    ↓
Status: "Pending" (waiting for admin)
    ↓
Admin reviews and assigns mission
    ↓
Status: "Active" (now working!)
```

---

## **S**

### Scope
**What it is**: A limit on what a user can access.

**Simple explanation**: Like a map with boundaries. A supervisor's scope is limited to only their assigned interns. They can't see other supervisors' interns because that's outside their scope.

**Example**:
```
Supervisor Alice's scope:
- Interns assigned to her: John, Sarah
- Interns assigned to Bob: NOT visible (outside scope)
```

---

## **T**

### Table
**What it is**: A database structure that stores related data in rows and columns.

**Simple explanation**: Like a spreadsheet. Each row is a record, each column is a field.

**Example - Users table**:
```
| Id    | FirstName | Email              | Role    |
|-------|-----------|--------------------|---------|
| 1     | John      | john@example.com   | intern  |
| 2     | Alice     | alice@test.com     | admin   |
```

---

## **U**

### User
**What it is**: Anyone who has an account in the system.

**Simple explanation**: A person who can log in and use the application. Every user has a profile with information like name, email, and password.

**All users are one of 5 roles**:
- SuperAdmin
- Admin
- Manager
- Supervisor
- Intern

---

## **W**

### Workflow
**What it is**: The step-by-step process something goes through.

**Simple explanation**: Like a recipe. An intern's workflow is: Sign up → Complete profile → Wait for assignment → Start working → Submit work → Get evaluated → Complete.

**Example - Intern workflow**:
```
1. Sign up with email
2. Fill out application form
3. Upload CV
4. Wait for admin approval
5. Get assigned to mission
6. Work on tasks daily
7. Submit deliverables
8. Get evaluated
9. Mark as complete
```

---

## **X**

### XSS
**What it is**: XSS stands for "Cross-Site Scripting" - a security attack.

**Simple explanation**: Like leaving your house door unlocked. A hacker injects malicious code into the website, and when other users visit, the code runs in their browsers. We prevent XSS by sanitizing (cleaning) all user input.

**How we protect**:
- Never trust user input
- Escape all data before displaying
- Use secure HTML rendering

---

## **Summary**

Here are the key terms at a glance:

| Term | One-Sentence Summary |
|------|---------------------|
| API | The messenger between frontend and backend |
| Backend | The server-side logic you don't see |
| Database | Where data is permanently stored |
| Frontend | What users see and interact with |
| JWT | Secure digital ID card for logging in |
| Role | Category that determines what you can do |
| Component | Reusable piece of user interface code |
| State | The current data of your application |
