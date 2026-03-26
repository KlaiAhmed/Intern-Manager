# 🤖 AGENT README — Smart Axia Intern Manager
> **Ce fichier est destiné à l'agent IA.** Il contient tout ce que l'agent doit savoir pour comprendre le projet, coder correctement, respecter les conventions, et maintenir ce README à jour.

---

## 📌 RÈGLE ABSOLUE N°1 — MISE À JOUR DU README

> **Après chaque ajout ou modification de fonctionnalité, l'agent DOIT mettre à jour ce fichier README.**  
> Cela inclut : nouvelles routes API, nouveaux composants React, changements de schéma de base de données, nouvelles dépendances, ou tout changement de comportement fonctionnel.  
> Le README doit toujours refléter l'état **actuel et réel** du projet.

---

## 📌 RÈGLE ABSOLUE N°2 — LANGUE DE DOCUMENTATION

> **Tout le code doit être hautement documenté en FRANÇAIS.**  
> Cela s'applique à : les commentaires de fonctions, les commentaires de classes, les commentaires de blocs logiques complexes, les fichiers de configuration, et les messages d'erreur dans les logs de développement.  
> Les noms de variables, fonctions et fichiers restent en **anglais** (convention technique universelle).  
> Exemple :
> ```csharp
> // Vérifie si le stagiaire est déjà affecté à une mission active avant d'effectuer l'assignation
> public async Task<bool> IsInternAlreadyAssigned(int internId) { ... }
> ```

---

## 🗂️ Structure du Projet

```
/
├── client/                → Application web React + TypeScript (Vite)
│   ├── src/
│   ├── .env
│   └── .env.example
├── api/                   → Backend .NET (scaffold initial)
│   ├── InternManager.Api/
│   │   ├── InternManager.Api.csproj
│   │   ├── Program.cs
│   │   ├── appsettings.json
│   │   ├── appsettings.Development.json
│   │   └── Properties/launchSettings.json
│   ├── .env
│   └── .env.example
└── AGENT_README.md        → Ce fichier (mis à jour par l'agent après chaque changement)
```

---

## 🎯 Vue d'ensemble du Projet

**Nom :** Smart Axia Intern Manager  
**Objectif :** Remplacer les feuilles Excel et les emails pour gérer le cycle complet des stages en entreprise — de l'affectation à l'évaluation finale.  
**Livrable ciblé :** Un MVP fonctionnel, stable, démontrable et prêt pour les retours des parties prenantes.

---

## 👥 Rôles Utilisateurs

| Rôle | Nom FR | Responsabilités |
|------|--------|-----------------|
| `Admin` | Administrateur | Gère tous les comptes, départements et la sécurité |
| `Encadrant` | Superviseur / Mentor | Crée les missions, suit la progression quotidienne, valide les livrables, rédige les évaluations |
| `Stagiaire` | Intern / Talent | Gère son profil et CV, upload ses livrables, met à jour ses tâches |
| `Manager` | Manager | Consulte les tableaux de bord pour une vue macro du programme de stage |

> L'accès aux fonctionnalités est strictement contrôlé par le rôle de l'utilisateur connecté (RBAC).

---

## 🔄 Cycle de Vie d'un Stage

### Phase 1 — Avant (Setup)
- Un **Encadrant** crée une **Mission** (titre, description, compétences requises, livrables attendus)
- Un **Stagiaire** crée son profil et uploade son CV avec ses compétences taguées
- Un **Admin** affecte le stagiaire à une mission et lui assigne un encadrant

### Phase 2 — Pendant (Exécution)
- Le **Stagiaire** met à jour son journal de bord (logbook) et son pourcentage de progression sur ses tâches
- L'**Encadrant** consulte la progression, ajoute des commentaires de suivi
- Le **Stagiaire** uploade des livrables (rapports, code) → L'**Encadrant** les accepte ou refuse

### Phase 3 — Après (Conclusion)
- L'**Encadrant** remplit le formulaire d'évaluation (mi-parcours et finale)
- Le dossier de stage est archivé pour consultation future

---

## ✅ Périmètre du MVP (Ce qui DOIT être livré)

### 🔐 Accès & Authentification
- [ ] Login / Logout avec JWT
- [ ] Contrôle d'accès basé sur les rôles (RBAC) : Admin, Encadrant, Stagiaire, Manager

### 👤 Gestion des Utilisateurs
- [ ] Créer, modifier, archiver des utilisateurs
- [ ] Gestion du profil stagiaire
- [ ] Upload de CV (fichier PDF ou DOCX)

### 🗂️ Gestion des Stages
- [ ] Créer un dossier de stage
- [ ] Affecter un stagiaire à une mission et un encadrant
- [ ] Gérer les statuts : `planned` → `active` → `completed` → `archived`

### 📋 Gestion des Missions
- [ ] Créer et modifier des missions
- [ ] Définir description, compétences requises, livrables attendus
- [ ] Affecter une mission à un stagiaire

### 📈 Suivi & Progression
- [ ] Mises à jour de progression (journal quotidien ou hebdomadaire)
- [ ] Liste de tâches simple avec pourcentage de complétion
- [ ] Notes et commentaires de suivi par l'encadrant

### 📝 Évaluation
- [ ] Formulaire d'évaluation (compétences techniques, communication, autonomie)
- [ ] Champs pour évaluation mi-parcours et finale
- [ ] Score et commentaires libres

### 📊 Dashboard
- [ ] Nombre total de stagiaires
- [ ] Stages actifs
- [ ] Stages complétés
- [ ] Vue de statut globale (accessible au Manager)

---

## ❌ Exclusions du MVP (Ne PAS implémenter maintenant)

- BI Dashboards avancés
- Moteur de matching IA
- Notifications email automatiques
- Versioning de documents
- Journaux d'audit (Audit logs)
- Rapports avancés
- Intégration SSO

---

## 🖥️ Frontend — `client/` (React)

### Stack Technique
- **Framework :** React (avec hooks fonctionnels uniquement, pas de classes)
- **Routing :** React Router (architecture prête à évoluer vers les modules métier)
- **State Management :** React Context API (thème, langue, rôle actif) avec persistance locale
- **Internationalisation :** EN / FR / AR avec support RTL natif pour l'arabe
- **Theming :** Système clair/sombre/système via tokens CSS centralisés
- **SEO Frontend :** Métadonnées de page (title, description, canonical) gérées côté client
- **UI :** Design system maison (primitives réutilisables : Button, Card, Badge, Section)

### Conventions de Code Frontend
```
client/
├── src/
│   ├── app/            → Point d'entrée applicatif (routes + providers globaux)
│   ├── features/       → Modules fonctionnels (ex: home)
│   ├── shared/         → UI primitives, layout, i18n, thème, SEO, types, utils
│   ├── index.css       → Tokens et styles globaux (responsive + accessibilité)
│   └── main.tsx        → Bootstrap React + injection des providers
```

### Règles Frontend Importantes
1. **Protection des routes :** Chaque route doit être protégée par un composant `<ProtectedRoute>` vérifiant le rôle de l'utilisateur connecté.
2. **Gestion des erreurs :** Toute erreur API doit afficher un feedback visuel à l'utilisateur (toast, message d'erreur).
3. **Chargement :** Tout appel asynchrone doit afficher un état de chargement (spinner ou skeleton).
4. **Commentaires :** Documenter chaque composant et hook avec un commentaire en français expliquant son rôle.

---

## ⚙️ Backend — `api/` (.NET)

### Stack Technique
- **Framework :** ASP.NET Core Web API (.NET 8+)
- **ORM :** Entity Framework Core avec Migrations
- **Base de données :** SQL Server (ou PostgreSQL selon configuration)
- **Authentification :** JWT Bearer Tokens
- **Documentation API :** Swagger / OpenAPI (activé en dev)
- **Architecture :** Clean Architecture — séparation en couches

### Architecture des Couches

```
api/
├── Controllers/        → Reçoit les requêtes HTTP, délègue au Service, retourne la réponse
├── Services/           → Contient toute la logique métier
├── Repositories/       → Accès aux données via EF Core (pattern Repository)
├── Models/             → Entités de base de données (EF Core)
├── DTOs/               → Objets de transfert de données (entrée/sortie des endpoints)
├── Middleware/         → Gestion globale des erreurs, logging
├── Migrations/         → Migrations EF Core (auto-générées, ne pas modifier manuellement)
└── Program.cs          → Configuration de l'application (DI, middleware pipeline)
```

### Conventions de Code Backend
1. **Nommage :** `PascalCase` pour les classes et méthodes, `camelCase` pour les variables locales.
2. **DTOs :** Ne jamais exposer directement une entité EF dans une réponse API. Toujours utiliser un DTO.
3. **Validation :** Utiliser les Data Annotations ou FluentValidation sur les DTOs d'entrée.
4. **Async/Await :** Toutes les méthodes d'accès aux données et de service doivent être `async`.
5. **Commentaires :** Chaque contrôleur, service et repository doit avoir un commentaire XML summary en français.

### Exemple de Convention de Commentaire Backend
```csharp
/// <summary>
/// Service gérant la logique métier des stages.
/// Inclut la création, l'affectation, le suivi et l'archivage des dossiers de stage.
/// </summary>
public class InternshipService : IInternshipService
{
    /// <summary>
    /// Récupère tous les stages actifs pour un encadrant donné.
    /// </summary>
    /// <param name="supervisorId">L'identifiant unique de l'encadrant</param>
    /// <returns>Liste des stages actifs avec les informations du stagiaire</returns>
    public async Task<List<InternshipDto>> GetActiveInternshipsBySupervisor(int supervisorId) { ... }
}
```

### Endpoints API Prévus (MVP)

#### Auth
| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/login` | Public | Authentification, retourne un JWT |
| POST | `/api/auth/logout` | Authentifié | Invalidation du token côté client |

#### Users
| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| GET | `/api/users` | Admin | Liste tous les utilisateurs |
| POST | `/api/users` | Admin | Créer un utilisateur |
| PUT | `/api/users/{id}` | Admin | Modifier un utilisateur |
| DELETE | `/api/users/{id}` | Admin | Archiver un utilisateur |

#### Internships
| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| GET | `/api/internships` | Admin, Manager | Liste tous les stages |
| GET | `/api/internships/{id}` | Admin, Encadrant, Stagiaire | Détail d'un stage |
| POST | `/api/internships` | Admin | Créer un stage |
| PUT | `/api/internships/{id}/status` | Admin, Encadrant | Modifier le statut |

#### Missions
| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| GET | `/api/missions` | Tous | Liste des missions |
| POST | `/api/missions` | Encadrant, Admin | Créer une mission |
| PUT | `/api/missions/{id}` | Encadrant, Admin | Modifier une mission |

#### Tracking
| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| POST | `/api/internships/{id}/progress` | Stagiaire | Ajouter une mise à jour de progression |
| GET | `/api/internships/{id}/progress` | Encadrant, Admin | Voir l'historique de progression |

#### Evaluations
| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| POST | `/api/internships/{id}/evaluations` | Encadrant | Créer une évaluation |
| GET | `/api/internships/{id}/evaluations` | Encadrant, Admin, Stagiaire | Voir les évaluations |

#### Dashboard
| Méthode | Route | Rôle | Description |
|---------|-------|------|-------------|
| GET | `/api/dashboard/stats` | Manager, Admin | Statistiques globales du programme |

---

## 🔒 Sécurité — Règles Obligatoires

1. **Mots de passe :** Toujours hashés avec `BCrypt` avant stockage. Ne jamais stocker en clair.
2. **JWT :** Durée de vie courte (ex: 1h), avec possibilité de refresh token pour le MVP si le temps le permet.
3. **RBAC :** Chaque endpoint backend doit être décoré avec `[Authorize(Roles = "...")]`.
4. **CORS :** Configurer CORS pour n'accepter que l'origine du client React (en dev : `localhost:3000` ou port configuré).
5. **Validation des entrées :** Valider et sanitiser toutes les entrées utilisateur pour prévenir les injections.

---

## 🗄️ Schéma de Base de Données (MVP)

```
Users
  - Id, FirstName, LastName, Email, PasswordHash, Role, IsArchived, CreatedAt

Missions
  - Id, Title, Description, RequiredSkills (JSON ou table liée), ExpectedDeliverables, CreatedBy (UserId), CreatedAt

Internships
  - Id, InternId (→ Users), SupervisorId (→ Users), MissionId (→ Missions)
  - Status (planned/active/completed/archived), StartDate, EndDate, CreatedAt

ProgressUpdates
  - Id, InternshipId (→ Internships), Date, Description, CompletionPercentage, CreatedAt

Evaluations
  - Id, InternshipId (→ Internships), Stage (mid/final), TechnicalScore, CommunicationScore
  - AutonomyScore, Comments, CreatedAt

InternProfiles
  - Id, UserId (→ Users), CVFilePath, Skills (JSON), Bio, UpdatedAt
```

> **Note :** Mettre à jour ce schéma à chaque migration EF Core créée.

---

## 📏 Critères de Succès du MVP

- [ ] Un utilisateur peut se connecter et accéder aux fonctionnalités de son rôle uniquement
- [ ] L'Admin peut gérer les stagiaires, les missions et les affectations
- [ ] Un Encadrant peut suivre la progression et ajouter des évaluations
- [ ] Le système est stable pour une démo et un usage interne
- [ ] Le code est suffisamment propre pour être montré aux parties prenantes
- [ ] Le système est prêt à recevoir du feedback avant l'ajout des fonctionnalités BI/IA

---

## 🚀 Prochaines Phases (Post-MVP)

> À ne PAS implémenter maintenant. Documentées ici pour que l'agent comprenne la direction future.

- **Moteur de matching IA :** Comparaison des compétences du stagiaire avec les exigences de la mission, génération d'un score de compatibilité avec justification.
- **BI Dashboards :** Graphiques interactifs (ex: départements avec le plus de retards, taux de complétion par mission).
- **Notifications email :** Alertes automatiques lors d'une affectation, d'un refus de livrable, ou d'une évaluation.
- **Audit Logs :** Traçabilité de toutes les actions sensibles.

---

## 📝 Journal des Modifications (Mis à jour par l'agent)

| Date | Auteur | Modification |
|------|--------|--------------|
| Init | Agent IA | Création du README initial basé sur les documents de spécification |
| 2026-03-26 | Agent IA (Copilot) | Initialisation du scaffold: frontend React + TypeScript (Vite), backend .NET minimal, ajout des fichiers `.env` et `.env.example` pour `client/` et `api/` |
| 2026-03-26 | Agent IA (Copilot) | Refonte frontend production-ready: architecture modulaire (`app/features/shared`), homepage SaaS complète, i18n EN/FR/AR avec RTL, thème clair/sombre/système, SEO de landing, composants UI réutilisables, lazy loading sections non critiques, validation lint + build OK |
| 2026-03-26 | Agent IA (Copilot) | Correction des erreurs de configuration dans `client/` : assainissement de `tsconfig.node.json`, validation locale TypeScript, lint et build Vite confirmés sans erreur bloquante |
| 2026-03-26 | Agent IA (Copilot) | Application ciblée des correctifs TypeScript Node: activation de `types: ["node"]`, ajout de `typeRoots` local et nettoyage des options de lint non essentielles dans `client/tsconfig.node.json`, avec validation `tsc -p` et build OK |
| 2026-03-26 | Agent IA (Copilot) | Conversion des switchers navbar (rôle, langue, thème) en sélection par menu déroulant natif tout en conservant le rendu visuel actuel des boutons à icônes |
| 2026-03-26 | Agent IA (Copilot) | Harmonisation visuelle des menus déroulants navbar via un composant dropdown custom stylé pour correspondre exactement au design des boutons icônes |
| 2026-03-26 | Agent IA (Copilot) | Correction du bug d'affichage: fermeture automatique des menus déroulants navbar (rôle/langue/thème) lorsque la navbar se masque au scroll |

> **L'agent doit ajouter une ligne ici après chaque modification significative du projet.**

---

*Ce README est un document vivant. Il appartient autant à l'agent IA qu'à l'équipe de développement.*