# NOTES.md — Décisions et reports

## FK `modules.enabled_by → users.id` (reportée à l'étape 2 / v0.0.2)

La colonne `modules.enabled_by` est de type `sa.Uuid()` (nullable) mais **aucune
contrainte `ForeignKey("users.id")`** n'est déclarée à ce stade car la table
`users` n'existe pas encore (création prévue en v0.0.2 / étape 2).

À faire en étape 2 :
- Ajouter `ForeignKey("users.id")` dans le modèle `Module.enabled_by`.
- Créer une migration Alembic qui ajoute la contrainte FK (les données existantes
  restent compatibles : la colonne est déjà du bon type).

## UUIDv7 — convention PK

Toutes les tables d'enregistrements utilisent `UUIDPKMixin` (défini dans
`core/db.py`) pour leur clé primaire :
- `id: Mapped[uuid.UUID]` avec `sa.Uuid()` et `default=uuid.uuid7()`.
- Les FK vers ces tables utilisent également `sa.Uuid()`.

Exception documentée (specs/03 §5) : la table `modules` utilise une **clé
naturelle** (`key`, slug technique) au lieu d'un UUIDv7 — c'est un registre de
configuration, pas un enregistrement utilisateur.

## `.npmrc legacy-peer-deps=true` (étape 1d-bis)

`openapi-typescript@7.13.0` déclare un peer-dependency `typescript@"^5.x"` mais
le projet utilise TypeScript `~6.0.0` (spécifié par specs/03 §2). Le flag
`legacy-peer-deps=true` est nécessaire jusqu'à ce que la spec autorise TS 5.x ou
qu'`openapi-typescript` publie une version compatible TS 6.0.

Le `npm ci` échoue sans ce fichier (`ERESOLVE: peer typescript@"^5.x"`).

## Healthchecks Docker : `127.0.0.1` au lieu de `localhost` (étape 1e)

Les conteneurs Alpine (node, nginx, Caddy) résolvent `localhost` en `::1` (IPv6)
mais Vite, Nginx et certains services n'écoutent qu'en IPv4. Les healthchecks
`wget` utilisent donc `127.0.0.1` pour éviter les `Connection refused`.

Le backend Python utilise `urllib.request.urlopen` qui gère correctement IPv6.

## Volume Postgres 18+ : `/var/lib/postgresql` (étape 1e)

À partir de Postgres 18, l'image Docker attend un montage sur
`/var/lib/postgresql` (répertoire parent) au lieu de `/var/lib/postgresql/data`.
Le conteneur crée lui-même un sous-répertoire par version majeure, permettant
les mises à niveau `pg_upgrade --link`.

## E2E Playwright (étape 3-10)

Les tests E2E sont dans `src/frontend/e2e/` et utilisent Playwright 1.60.

**Lancement :**
```bash
cd src/frontend
npx playwright test
```
Le `webServer` configuré dans `playwright.config.ts` démarre automatiquement
Vite sur le port 5173. Pour utiliser un serveur déjà lancé :
```bash
npx playwright test --ignore-url
```
Ou depuis la racine du projet avec Docker Compose :
```bash
docker compose -f docker-compose.dev.yml up -d
cd src/frontend && npx playwright test
```

Les tests mockent les appels API (`/api/v1/auth/me`, `/api/v1/users/me`) pour
être indépendants du backend.

## `uv sync --all-extras` (étape 1e)

`uv 0.11.18` n'installe pas les `[project.optional-dependencies]` par défaut.
Le flag `--dev` ne fonctionne pas pour les optional-deps (il concerne les
`[dependency-groups]` PEP 735). Il faut utiliser `--all-extras` ou `--extra dev`
pour inclure pytest, ruff, mypy, httpx dans l'environnement.