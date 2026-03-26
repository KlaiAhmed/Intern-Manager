# Axia Intern Manager - Client

Frontend web du projet Axia Intern Manager, construit avec React, TypeScript et Vite.

## Apercu

Le client fournit:
- une landing page produit,
- un parcours d'authentification (`/login`, `/signin`),
- un socle transverse (theme, i18n, role preference, layout, composants UI reutilisables).

## Stack technique

- React 19
- TypeScript 5
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
|- public/
|- src/
|  |- app/
|  |  |- App.tsx
|  |  |- providers/RootProviders.tsx
|  |  |- routes/AppRouter.tsx
|  |- features/
|  |  |- auth/
|  |  |- home/
|  |- shared/
|  |  |- i18n/
|  |  |- layout/
|  |  |- seo/
|  |  |- state/
|  |  |- theme/
|  |  |- ui/
|  |  |- utils/
|  |- main.tsx
|  |- index.css
|- package.json
```

## Routage

Routes principales:
- `/`: homepage (dans le shell applicatif)
- `/login`: connexion
- `/signin`: inscription
- `/404`: page non trouvee

## Providers globaux

L'application est montee avec les providers suivants (ordre stable):
1. Theme provider
2. I18n provider
3. Role preference provider
4. Browser router

Ce montage est defini dans `src/app/providers/RootProviders.tsx`.

## Bonnes pratiques de contribution

- Garder une architecture feature-first (`src/features`) pour le metier.
- Centraliser le code transversal dans `src/shared`.
- Maintenir les composants UI atomiques et reutilisables.
- Eviter la logique metier dans les composants de presentation.
- Toujours ajouter des etats UX explicites pour les actions asynchrones (loading/erreur/succes).
- Preserver l'accessibilite (focus visible, labels, navigation clavier).

## Qualite et validation attendues

Avant de proposer un changement:
1. `npm run lint`
2. `npm run build`
3. verification manuelle rapide des routes impactees

## Depannage rapide

- Erreurs de typage: verifier `tsconfig.app.json` et `tsconfig.node.json`, puis relancer `npm run build`.
- Styles non appliques: verifier les imports CSS dans les composants/pages concernes.
- Route inaccessible: controler `src/app/routes/AppRouter.tsx`.

## License

Projet interne Axia. Usage reserve a l'equipe produit/developpement.
