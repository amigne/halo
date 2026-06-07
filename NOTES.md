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
