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
|- client/                 React + TypeScript + Vite
|  |- src/
|     |- app/              bootstrap, routes, providers
|     |- features/         modules metier (home, auth)
|     |- shared/           UI, layout, i18n, theme, seo, utils
|- api/
|  |- InternManager.Api/   ASP.NET Core Web API (.NET)
|     |- Program.cs
|     |- Controllers/
|     |- appsettings*.json
|- AGENT_README.md
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
|------|--------|--------------|
| Init | Agent IA | Creation du README initial |
| 2026-03-26 | Agent IA (Copilot) | Mise en place du scaffold frontend React + backend .NET minimal |
| 2026-03-26 | Agent IA (Copilot) | Refonte frontend modulaire (app/features/shared), i18n EN/FR/AR+RTL, theming, SEO, home page complete |
| 2026-03-26 | Agent IA (Copilot) | Ajout routes auth `/login` et `/signin` avec validations UI et parcours utilisateur |
| 2026-03-26 | Agent IA (Copilot) | Migration hors Tailwind pour auth vers module CSS dedie |
| 2026-03-26 | Agent IA (Copilot) | Harmonisation UI navbar et dropdowns (role/langue/theme) + corrections UX |
| 2026-03-26 | Agent IA (Copilot) | Nettoyage/condensation du present AGENT_README pour supprimer doublons et sections verbeuses |
| 2026-03-26 | Agent IA (Copilot) | Internationalisation complete des ecrans `/login` et `/signin` (suppression des textes hardcodes, validations et labels relies au dictionnaire i18n EN/FR/AR) |
| 2026-03-26 | Agent IA (Copilot) | Creation des pages 404 et erreur globale cote client (fallback React Error Boundary, routes `/404` et `/error`, style moderne coherent + i18n EN/FR/AR) |
| 2026-03-26 | Agent IA (Copilot) | Ajustement UX ecran `/signin` pour limiter le depassement vertical (fit viewport desktop) + correction des menus dropdown role qui s'ouvrent vers le haut quand l'espace bas est insuffisant |
| 2026-03-26 | Agent IA (Copilot) | Ajustements UX ecran `/login`: suppression du bouton SSO, libelle CTA principal force a `Login`, et masquage du panneau branding sur mobile pour n'afficher que le formulaire |

---

Maintenir ce fichier concise, exact et synchronise avec le code reel.
