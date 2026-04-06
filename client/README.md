# Axia Intern Manager - Client

Frontend web du projet Axia Intern Manager, construit avec React, TypeScript et Vite.

## Apercu

Le client fournit:
- une landing page produit,
- un parcours d'authentification (`/login`, `/signin`),
- un socle transverse (theme, i18n, role preference, layout, composants UI reutilisables).

## Stack technique

- React 19
- TypeScript 5.9
- Vite 8
- React Router 7
- ESLint 9

## Demarrage rapide

### Prerequis

- Node.js 20+
- npm 10+

### Installation

```bash
npm install
```

### Lancer en developpement

```bash
npm run dev
```

### Build production

```bash
npm run build
```

### Preview du build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Scripts disponibles

- `npm run dev`: lance le serveur Vite en mode developpement
- `npm run build`: verification TypeScript (`tsc -b`) puis build Vite
- `npm run preview`: sert localement le build de production
- `npm run lint`: execute ESLint sur le projet

## Structure du projet

```text
client/
├── public/                    # Static files served by Vite
├── src/
│   ├── app/                   # App shell and providers
│   │   ├── App.tsx           # Root component
│   │   └── providers/        # RootProviders, theme, i18n, auth contexts
│   ├── assets/                # Imported images, icons, and media
│   ├── components/            # Reusable shared components
│   │   ├── layout/           # AppShell, Header, Footer
│   │   └── ui/               # Badge, Button, Card, Section, switches
│   ├── config/                # App configuration and constants
│   ├── features/              # Feature-based modules
│   │   ├── auth/             # Authentication screens and logic
│   │   │   ├── api/          # Auth API calls
│   │   │   ├── components/   # AuthScreen, LoginView, SignUpView
│   │   │   ├── hooks/        # useAuthScreenLogic
│   │   │   ├── locales/      # ar, en, fr translations
│   │   │   ├── types/        # Auth-specific types
│   │   │   └── styles/       # Auth-specific styles
│   │   ├── dashboard/        # Role-based dashboards
│   │   │   ├── api/          # Dashboard API calls
│   │   │   ├── components/   # Charts, cards, tables
│   │   │   │   └── intern/   # Intern-specific dashboard cards
│   │   │   ├── hooks/        # Dashboard data hooks
│   │   │   ├── locales/      # Dashboard translations
│   │   │   ├── pages/        # Manager, Supervisor dashboards
│   │   │   ├── styles/       # Dashboard CSS
│   │   │   └── types/        # Dashboard types
│   │   ├── home/             # Landing page sections
│   │   │   ├── locales/      # Home translations
│   │   │   └── sections/     # Hero, Benefits, Lifecycle, etc.
│   │   └── notifications/    # Notification components
│   │       ├── api/          # Notification API
│   │       ├── components/   # NotificationBell
│   │       ├── hooks/        # useNotifications
│   │       └── locales/      # Notification translations
│   ├── hooks/                 # Shared custom hooks
│   ├── lib/                   # Third-party library wrappers
│   │   ├── apiClient.ts      # Axios instance and helpers
│   │   └── authApi.ts        # Auth API functions
│   ├── locales/               # Global i18n translations
│   │   ├── I18nContext.tsx   # I18n provider
│   │   ├── ar.ts, en.ts, fr.ts
│   │   └── index.ts          # Translation aggregator
│   ├── pages/                 # Page components (routing targets)
│   │   ├── DashboardPage/
│   │   ├── HomePage/
│   │   ├── LoginPage/
│   │   ├── SignUpPage/
│   │   ├── ErrorPage/
│   │   └── NotFoundPage/
│   ├── routes/                # Routing configuration
│   │   ├── AppRouter.tsx     # Main router
│   │   ├── guards/           # ProtectedRoute
│   │   ├── lazyPages.ts      # Lazy-loaded pages
│   │   └── routeConfig.ts    # Route definitions
│   ├── shared/                # Cross-cutting concerns
│   │   └── errors/           # ErrorPage, NotFoundPage
│   ├── stores/                # Global state management
│   │   ├── AuthContext.tsx   # Auth state provider
│   │   ├── RolePreferenceContext.tsx
│   │   └── ThemeContext.tsx  # Theme state provider
│   ├── styles/                # Global styles
│   │   ├── index.css         # Main stylesheet
│   │   └── partials/         # CSS partials
│   ├── types/                 # Global TypeScript types
│   │   └── role.ts           # Role types
│   ├── utils/                 # Utility functions
│   │   └── classNames.ts     # Class name helper
│   ├── main.tsx               # App entry point
│   └── vite-env.d.ts          # Vite TypeScript declarations
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript config
├── tsconfig.app.json          # App TypeScript config
├── tsconfig.node.json         # Node TypeScript config
├── vite.config.ts             # Vite configuration
├── eslint.config.js           # ESLint configuration
└── .env                       # Environment variables
```

## Routage

Routes principales:
- `/`: homepage (dans le shell applicatif)
- `/login`: connexion
- `/signin`: inscription
- `/dashboard`: tableau de bord (protege par role)
- `/404`: page non trouvee

## Providers globaux

L'application est montee avec les providers suivants (ordre stable):
1. Theme provider
2. I18n provider
3. Role preference provider
4. Browser router

Ce montage est defini dans `src/app/providers/RootProviders.tsx`.

## Architecture Feature-First

Le projet suit une architecture feature-first:
- **`src/features/`**: Contient le code metier organise par fonctionnalite
- **`src/components/`**: Composants UI partagés reutilisables
- **`src/stores/`**: State management global (Auth, Theme, RolePreference)
- **`src/lib/`**: Wrappers et helpers pour bibliotheques tierces
- **`src/locales/`**: Traductions centralisees
- **`src/pages/`**: Pages utilisees par le routeur
- **`src/routes/`**: Configuration du routage et gardes

Chaque feature (`auth`, `dashboard`, `home`, `notifications`) est autonome avec:
- `api/` - Appels API specifiques
- `components/` - Composants UI de la feature
- `hooks/` - Hooks React specifiques
- `locales/` - Traductions de la feature
- `types/` - Types TypeScript specifiques
- `styles/` - Styles CSS de la feature

## Bonnes pratiques de contribution

- Garder une architecture feature-first (`src/features`) pour le metier.
- Centraliser le code transversal dans `src/components`, `src/stores`, `src/lib`.
- Maintenir les composants UI atomiques et reutilisables.
- Eviter la logique metier dans les composants de presentation.
- Toujours ajouter des etats UX explicites pour les actions asynchrones (loading/erreur/succes).
- Preserver l'accessibilite (focus visible, labels, navigation clavier).
- Ajouter les traductions pour les nouvelles fonctionnalites (ar, en, fr).

## Qualite et validation attendues

Avant de proposer un changement:
1. `npm run lint`
2. `npm run build`
3. verification manuelle rapide des routes impactees

## Depannage rapide

- Erreurs de typage: verifier `tsconfig.app.json` et `tsconfig.node.json`, puis relancer `npm run build`.
- Styles non appliques: verifier les imports CSS dans les composants/pages concernes.
- Route inaccessible: controler `src/routes/AppRouter.tsx`.
- Traductions manquantes: ajouter les cles dans `src/locales/` et `src/features/*/locales/`.

## License

Projet interne Axia. Usage reserve a l'equipe produit/developpement.
