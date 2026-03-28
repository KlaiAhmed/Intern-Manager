# AGENT README - Axia Intern Manager

Ce document est la reference operationnelle pour l'agent IA. Il doit rester court, exact et a jour.

## 1) Regles obligatoires

1. Mise a jour continue du README agent
- Apres chaque changement significatif (fonctionnalite, route API, structure, conventions, dependances), ajouter une entree dans le journal de modifications.

2. Langue de documentation
- Les commentaires de code, messages de logs de dev et documentation technique doivent etre en francais.
- Les noms techniques (fichiers, variables, fonctions, classes, routes) restent en anglais.

## 2) Objectif produit

Axia Intern Manager remplace les fichiers Excel/emails par une application qui couvre le cycle complet de stage:
- affectation et mission,
- suivi de progression,
- evaluation,
- pilotage global pour management.

Cible: MVP stable, demonstrable, pret a recevoir du feedback metier.

## 3) Roles applicatifs (RBAC)

- Admin: gestion globale (utilisateurs, affectations, securite)
- Supervisor: missions, suivi, validation livrables, evaluations
- Intern: profil, progression, livrables
- Manager: consultation des KPIs globaux
- HR: role present dans l'UI d'inscription, validation finale cote administration

## 4) Perimetre MVP

Inclure:
- Authentification JWT + RBAC
- Gestion utilisateurs (creation, edition, archivage)
- Gestion stages/missions (assignation, statuts, suivi)
- Progress updates + commentaires de suivi
- Evaluations (mid/final)
- Dashboard global (stats programme)

Exclure pour l'instant:
- moteur IA de matching,
- dashboards BI avances,
- notifications email automatiques,
- audit logs complets,
- SSO.

## 5) Architecture actuelle

```text
/
├── client/
│    ├── public/
│    ├── src/
│    │  ├── app/
│    │  │  ├── App.tsx
│    │  │  ├── providers/RootProviders.tsx
│    │  │  └── routes/AppRouter.tsx
│    │  ├── features/
│    │  │  ├── auth/
│    │  │  └── home/
│    │  ├── shared/
│    │  │  ├── i18n/
│    │  │  ├── layout/
│    │  │  ├── seo/
│    │  │  ├── state/
│    │  │  ├── theme/
│    │  │  ├── ui/
│    │  │  └── utils/
│    │  ├── main.tsx
│    │  ├── index.css
│    └── package.json
└── api/
│    ├── Common/                       # Shared app-wide building blocks
│    │   ├── Enums/                    # Shared enumerations
│    │   ├── Options/                  # Configuration option classes
│    │   └── Utilities/                # Common helpers and utilities
│    ├── Controllers/                  # HTTP API endpoints
│    ├── Data/                         # Database context and seeding
│    ├── Extensions/                   # DI and pipeline registration extensions
│    ├── Middleware/                   # Custom request/response middleware logic
│    ├── Models/                       # Data models used by the API
│    │   ├── DTOs/                     # Request and response shapes
│    │   └── Entities/                 # EF Core entity classes
│    ├── Properties/                   # Local run and debug settings
│    ├── Services/                     # Business logic services
│    │    └── Auth/                    # Authentication services
│    ├── .env                          # Local environment variables
│    ├── .env.example                  # Environment template
│    ├── appsettings.json
│    ├── appsettings.Development.json
│    ├── Program.cs                    # Application bootstrap
│    ├── InternManager.Api.csproj
│    └── README.md
```

## 6) Frontend - conventions essentielles

- React fonctionnel uniquement (hooks)
- Routing via React Router
- Providers globaux: Theme, I18n, Role preference, Router
- I18n: EN/FR/AR + support RTL
- Theme: light/dark/system via tokens CSS
- Etats UX obligatoires sur actions async: loading + erreur visible

## 7) Backend - conventions essentielles

- ASP.NET Core Web API (.NET 8+)
- JWT + autorisation par role sur endpoints sensibles
- DTO obligatoires (ne pas exposer directement les entites)
- Validation des entrees (DataAnnotations / FluentValidation)
- Methodes IO/metier asynchrones

## 8) Securite minimale attendue

- Passwords hashes (jamais en clair)
- JWT a duree de vie courte
- CORS restreint aux origines client autorisees
- Validation/sanitation des donnees entrantes

## 9) Definition de done (MVP)

- Chaque role accede uniquement a ses fonctionnalites
- Admin peut gerer users, missions et affectations
- Supervisor peut suivre et evaluer
- Application stable pour demo interne
- Base technique propre pour evolutions post-MVP

## 10) Journal des modifications

| Date | Auteur | Modification |
├──-----├──-------├──-------------|
| 2026-03-28 | Agent IA (Copilot) | Ajout de commentaires XML en francais dans tous les fichiers C# du dossier `api/` (en-tete fichier, classes, interfaces, enums, proprietes, champs, methodes, endpoints HTTP avec verbes/routes, et exceptions explicites) |
| 2026-03-28 | Agent IA (Copilot) | Ajout du README backend `api/README.md` avec description concise de la structure, de la logique de demarrage, de la stack, des variables d environnement et des commandes d execution |
| 2026-03-28 | Agent IA (Copilot) | Migration backend vers cible `.NET 10` (`net10.0`) et alignement EF Core 10 pour compatibilite avec runtime ASP.NET Core 10 installe |
| 2026-03-28 | Agent IA (Copilot) | Implementation complete du module d authentification JWT cookie-based: `AuthController` (`/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`), `AuthService` avec rotation atomique des refresh tokens (hash SHA-256 cote serveur), filtre global CSRF Double Submit (`X-CSRF-Token` vs claim `csrf`), et branchement via `AddAuth(...)` + `UseAuthentication()` |
| 2026-03-28 | Agent IA (Copilot) | Correction erreur de demarrage auth: mise a jour de `JWT__KEY` dans `.env`/`.env.example` avec une valeur >= 32 octets et alignement de la documentation backend sur cette contrainte |
| 2026-03-28 | Agent IA (Copilot) | Correction login SuperAdmin: remplacement du store auth stub en memoire par un store base SQL (`DbAuthUserStore`) pour authentifier les comptes reels seedes (email + mot de passe) |
| 2026-03-28 | Agent IA (Copilot) | Route `POST /auth/login` alignee sur `email/password` (DTO, controller, service et store), avec harmonisation des claims auth sur l email |
| 2026-03-28 | Agent IA (Copilot) | Mise a jour de la section Project Structure du README backend en structure dossier uniquement, avec descriptions courtes par dossier |

---

Maintenir ce fichier concise, exact et synchronise avec le code reel.
