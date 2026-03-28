# SmartAxiaInternManager API

README backend du dossier api. Ce document explique la structure, la logique de demarrage, la stack, et comment executer le serveur localement.

## 1) Stack

- .NET 10 (ASP.NET Core Web API)
- Entity Framework Core 10
- SQL Server Express (SQLEXPRESS par defaut)
- BCrypt.Net-Next (hash mot de passe)
- Swagger / OpenAPI (en environnement Development)

## 2) Structure du dossier api

```text
api/
|- .env                 # variables locales
|- .env.example         # modele unique de variables (fusionne)
|- README.md            # ce document
|- Program.cs           # bootstrap app + DB init + seed
|- Data/
|  |- AppDbContext.cs
|  |- DbSeeder.cs
|- Extensions/
|  |- EnvLoader.cs
|- Models/
|  |- User.cs
|  |- Enums/
|     |- UserRole.cs
|     |- UserStatus.cs
|- Controllers/
|- Properties/
|  |- launchSettings.json
|- appsettings.json
|- appsettings.Development.json
|- InternManager.Api.csproj
```

Note: le dossier `InternManager.Api/` a ete supprime, tout son contenu est maintenant directement dans `api/`.

## 3) Logique de demarrage

Au lancement, le serveur suit ce flux:

1. Charge le fichier .env via EnvLoader avant la creation du host.
2. Lit SERVER_PORT depuis la configuration et construit l URL d ecoute HTTP.
3. Lit DATABASE_PATH depuis la configuration.
4. Construit une connection SQL Server Express:
  - Server=.\\SQLEXPRESS (ou SQLSERVER_INSTANCE si defini)
   - Database=SmartAxiaInternManager_<nom_de_DATABASE_PATH_sans_extension>
5. Enregistre AppDbContext dans le conteneur DI.
6. Build de l application.
7. Tente la creation automatique de la base avec EnsureCreatedAsync().
8. Lance le seed SuperAdmin via DbSeeder.SeedSuperAdminAsync(app.Services).
9. Active Swagger en Development.
10. Demarre l API.

Note: les erreurs de creation DB et seed sont loggees sans stopper le serveur.

## 4) Modele User (table Users)

La table Users est configuree en Fluent API dans AppDbContext.OnModelCreating:

- Id: Guid, PK, auto-genere (NEWID)
- FirstName: requis, max 100
- LastName: requis, max 100
- Email: requis, max 255, index unique
- PasswordHash: requis (bcrypt uniquement)
- Role: enum stocke en string
  - SuperAdmin, Admin, Manager, Supervisor, Intern
- Status: enum stocke en string
  - Active, Archived
- CreatedAt: UTC auto
- UpdatedAt: UTC auto

UpdatedAt est remis a jour automatiquement sur SaveChanges.

## 5) Seed SuperAdmin

DbSeeder fait les operations suivantes:

1. Verifie si un utilisateur SuperAdmin existe deja.
2. Si oui: log "SuperAdmin already exists." et stop.
3. Sinon: lit SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_FIRSTNAME, SUPERADMIN_LASTNAME.
4. Si une variable obligatoire manque: leve InvalidOperationException descriptive.
5. Hash le mot de passe avec BCrypt.
6. Cree l utilisateur SuperAdmin puis sauvegarde.

## 6) Variables d environnement

Creer api/.env a partir de api/.env.example:

```env
ASPNETCORE_ENVIRONMENT=Development
SERVER_PORT=5184
JWT__KEY=change_me_in_dev
JWT__ISSUER=SmartAxiaInternManager
JWT__AUDIENCE=SmartAxiaInternManagerClient
DATABASE_PATH=app.db
SQLSERVER_INSTANCE=.\SQLEXPRESS
SUPERADMIN_EMAIL=admin@axia.com
SUPERADMIN_PASSWORD=Admin@1234
SUPERADMIN_FIRSTNAME=Super
SUPERADMIN_LASTNAME=Admin
```

Important:
- SERVER_PORT controle le port HTTP du serveur Kestrel (par defaut 5184).
- DATABASE_PATH sert actuellement a nommer la base SQL Server (pas un fichier SQLite).
- Exemple: app.db -> base SmartAxiaInternManager_app.
- SQLSERVER_INSTANCE est optionnelle. Par defaut, l API utilise .\SQLEXPRESS.

## 7) Comment executer

Depuis le dossier api/:

```bash
dotnet restore
dotnet build InternManager.Api.csproj
dotnet run --project InternManager.Api.csproj
```

URL locale:
- http://localhost:<SERVER_PORT>
- Exemple par defaut: http://localhost:5184

Swagger (Development):
- /swagger

## 8) Prerequis machine

- Packages obligatoires (a installer):
  - .NET SDK 10 x64
  - ASP.NET Core Runtime 10 x64
  - SQL Server Express 2022 (instance SQLEXPRESS)

- Optionnel mais recommande:
  - SQL Server Management Studio (SSMS) pour visualiser la base et verifier les donnees

- Verifications rapides apres installation:
  - dotnet --version
  - dotnet --list-runtimes
  - service Windows "SQL Server (SQLEXPRESS)" en etat Running

Si dotnet run echoue avec "Framework version 10.0.0 missing", installer le runtime ASP.NET Core 10 x64 puis relancer.
