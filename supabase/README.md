# Supabase: Authz + RLS

This folder contains the Supabase CLI project for **cashfast-admin**: migrations, seed data, and config. Auth and authorization are implemented via a dedicated `authz` schema, RBAC tables, helper functions, and RLS policies.

## CLI setup

The Supabase CLI must be available on your PATH. Install it globally so `supabase` (and `npx supabase`) work:

**macOS (Homebrew):**
```bash
brew install supabase/tap/supabase
```

**npm (any OS):**
```bash
npm install -g supabase
```

Then from the project root you can run `npx supabase migration new <name>`, `supabase db reset`, etc.

## Linking to a remote project

Before you can run `supabase db push`, link this repo to your hosted Supabase project:

1. In the [Supabase Dashboard](https://supabase.com/dashboard), open your project.
2. Get the **Project ref**: either from the URL (`https://supabase.com/dashboard/project/<ref>`) or **Settings → General → Reference ID**.
3. From the project root, run:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
   When prompted, enter your database password (from **Settings → Database**).

After linking, `npx supabase db push` will apply migrations to the remote database.

## Layout

- **`config.toml`** – Local Supabase project config (API, DB, Auth, etc.).
- **`migrations/`** – SQL migrations only. All schema changes go here (no manual changes in the Dashboard).
- **`seed.sql`** – Idempotent seed data (roles, permissions, role–permission mappings). Runs after migrations on `supabase db reset`.

## Schemas

| Schema  | Purpose |
|---------|--------|
| `auth`  | Managed by Supabase (e.g. `auth.users`). |
| `authz` | Authorization: roles, permissions, role_permissions, user_roles, organizations, organization_members, helper functions. |
| `public`| Application data: profiles, resources, and other domain tables. |

## Migration workflow

1. **Create a new migration**  
   From project root:
   ```bash
   npx supabase migration new <short_description>
   ```
   This creates a file like `supabase/migrations/YYYYMMDDHHMMSS_short_description.sql`.

2. **Edit the new file**  
   Add only the SQL for this change. Keep migrations small and ordered.

3. **Apply locally**  
   ```bash
   npx supabase db reset
   ```
   This applies all migrations and then runs `seed.sql`.

4. **Push to remote** (when using a linked project)  
   ```bash
   npx supabase db push
   ```

## NPM scripts

From project root:

- `pnpm supabase:start` – Start local Supabase (Docker required).
- `pnpm supabase:stop` – Stop local Supabase.
- `pnpm supabase:reset` – Reset DB: re-run migrations + seed.
- `pnpm supabase:push` – Push migrations to linked remote project.
- `pnpm supabase:types` – Regenerate TypeScript types into `lib/types/supabase.ts` (requires local Supabase running or `--project-id`).

## Authorization

- **Security is enforced in the database.** RLS and `authz` helper functions decide what rows a user can see or change. The frontend must not enforce security.
- **Helper functions** (in `authz`): `is_authenticated()`, `is_super_admin()`, `has_role(role_name)`, `has_permission(permission_name)`, `is_org_member(org_id)`.
- **Permission format:** `resource.action` (e.g. `resource.read`, `resource.manage`). `has_permission` supports a wildcard: e.g. `resource.update` is allowed if the user has `resource.manage`.
- **Tenant isolation:** Tables like `public.resources` are scoped by `organization_id`. Policies use `authz.is_org_member(organization_id)` and optionally `authz.has_permission(...)`.
- **Super-admin override:** Many policies allow full access when `authz.is_super_admin()` is true.

## Adding permissions / policies

1. **New permission:** Insert into `authz.permissions` (e.g. in a migration or in seed). Example: `feature.create`, `feature.delete`.
2. **Assign to roles:** Insert into `authz.role_permissions` for the right `role_id` and `permission_id`.
3. **New RLS policy:** In a migration, add a policy that uses `authz.has_permission('feature.create')` and/or `authz.is_org_member(organization_id)` (and `authz.is_super_admin()` if you want override).

Avoid broad “public” policies; keep default deny and explicit allow via these helpers.
