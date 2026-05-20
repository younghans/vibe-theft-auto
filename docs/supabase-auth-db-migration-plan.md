# Supabase Auth + Database Migration Plan

This plan centralizes identity, admin roles, and durable game persistence in Supabase while keeping the Colyseus server authoritative for gameplay state changes.

## Target Architecture

```text
Browser
  -> Supabase Auth for login/session
  -> Colyseus for realtime gameplay

Colyseus Cloud
  -> verifies Supabase access tokens
  -> checks game admin roles in Supabase Postgres
  -> reads/writes all authoritative game state

Supabase
  -> Auth users
  -> game_users/admin roles
  -> permanent player saves
  -> migrated world, stock, and backup tables
```

## Core Principles

- The browser may use the Supabase project URL and publishable key.
- The browser must not receive the Supabase database URL, database password, secret key, or service-role key.
- Colyseus remains the only writer for gameplay-critical state: money, inventory, skills, missions, world edits, admin actions, stock state, and saves.
- Guest mode can keep using the existing local `vta.playerId` and TTL `player_snapshots` during rollout.
- Signed-in players should use a permanent Supabase Auth user id for durable saves.
- Database migration should happen before auth migration so we can prove Supabase Postgres is a drop-in replacement for the current Render Postgres setup.

## Current Repo Touchpoints

- Frontend runtime config is injected by `scripts/build-web.mjs`.
- The client creates a local guest player id in `src/npc/createNpcService.js`.
- The Colyseus client passes `playerId` and signed-in `accessToken` join options through `src/npc/NpcServiceColyseus.js`.
- The server loads and saves temporary player snapshots in `server/src/playerSnapshots.js`.
- The server grants admin access from `game_users.is_admin` in `server/src/WorldRoom.js`.
- The browser admin HTTP endpoints require Supabase Bearer-token auth in `server/app.config.js`.
- Existing Postgres-backed game tables are created by:
  - `server/src/worldPersistence.js`
  - `server/src/playerSnapshots.js`
  - `server/src/stockMarketPersistence.js`

## Phase 1: Supabase Foundation

Goal: finish Supabase project setup and collect the environment values we need before changing code.

Status: completed locally on 2026-05-19.

Decisions and notes:

- Supabase CLI is linked to project `abulktuxhtwtcjsmengk`.
- Local `DATABASE_URL` is stored in ignored `.env.local`.
- The Supabase session pooler connection was selected for the Colyseus runtime.
- The local stored connection string uses a URL-encoded password component.
- The local stored connection string uses `sslmode=no-verify` because Node `pg` hit certificate-chain verification errors with the shared pooler when using `sslmode=require`.
- A read-only local Node `pg` probe connected successfully to Supabase Postgres.

### Values We Already Have

- `SUPABASE_URL`: public browser-safe project URL.
- `SUPABASE_PUBLISHABLE_KEY`: public browser-safe key, usually `sb_publishable_...`.

### Values To Collect

Public frontend values:

- `VTA_SUPABASE_URL`: same as `SUPABASE_URL`, injected into the frontend build.
- `VTA_SUPABASE_PUBLISHABLE_KEY`: same as `SUPABASE_PUBLISHABLE_KEY`, injected into the frontend build.

Server-only values:

- `DATABASE_URL`: Supabase Postgres connection string for Colyseus.
- Database password used inside the connection string.
- Optional `SUPABASE_SECRET_KEY`: `sb_secret_...`, server-only, only if we need Supabase Admin API operations.

Do not paste server-only values into chat, issue trackers, URLs, or frontend code.

### Supabase Dashboard Setup

1. Confirm the project region. Prefer the closest region to the Colyseus Cloud backend.
2. In Auth settings, set the production site URL to `https://www.vibetheftauto.xyz`.
3. Add redirect URLs for local and deployed environments:
   - `http://localhost:4173`
   - `http://localhost:4173/*`
   - `https://www.vibetheftauto.xyz`
   - `https://www.vibetheftauto.xyz/*`
   - Any Vercel preview domains we want to support.
4. Choose the first login providers. Start simple:
   - Email magic link or email/password.
   - Google OAuth if we want a lower-friction login button.
5. Decide whether to configure custom SMTP before production. Supabase's default email is fine for development, but production games usually want branded email delivery.
6. Open the Database connection panel and copy the Postgres connection string:
   - Use direct connection if the Colyseus environment supports IPv6.
   - Use session pooler if Colyseus needs IPv4 support.
   - Avoid transaction pooler for the long-lived Colyseus server unless we explicitly tune the `pg` client for it.
7. Store `DATABASE_URL` in the Colyseus Cloud production environment, not in the browser or Vercel frontend environment.
8. Store frontend-safe `VTA_SUPABASE_URL` and `VTA_SUPABASE_PUBLISHABLE_KEY` in the Vercel frontend environment.

### Phase 1 Exit Criteria

- Supabase project has Auth enabled and a chosen initial login provider.
- Production and local redirect URLs are configured.
- We have the browser-safe URL and publishable key ready for frontend config.
- We have the server-only Postgres connection string ready for Colyseus.
- We know whether Colyseus should use direct connection or session pooler.
- Supabase CLI is linked to project `abulktuxhtwtcjsmengk`.

### Optional CLI Workflow

The Supabase CLI is useful for local migrations, schema diffs, database dumps, generating types, and linking this repo to the hosted Supabase project. It does not replace all dashboard setup; Auth URL configuration and OAuth provider setup are usually fastest to confirm in the dashboard.

Install or run the CLI:

```sh
npx supabase --help
```

Initialize this repo for Supabase migrations:

```sh
npx supabase init
```

Log in with a Supabase personal access token. Do not paste this token into chat.

```sh
npx supabase login
```

Link the local repo to the hosted project:

```sh
npx supabase link --project-ref <project-ref>
```

Useful commands after linking:

```sh
npx supabase db pull initial_remote_schema
npx supabase migration new create_game_users
npx supabase db push --dry-run
npx supabase db push
npx supabase db dump --linked -f supabase/schema.sql
```

For the Render-to-Supabase database migration, use `pg_dump`/`psql` or a Supabase-supported dump/restore workflow for the actual data transfer, then use the CLI for ongoing migrations.

## Phase 2: Move Render Postgres To Supabase

Goal: prove Supabase Postgres can run the current game persistence unchanged.

Status: migrated and verified locally on 2026-05-19.

Notes:

- Render external database URL is stored in ignored `.env.migration.local` as `RENDER_DATABASE_URL`.
- Supabase target database URL is stored in ignored `.env.local` as `DATABASE_URL`.
- The baseline game persistence schema lives in `supabase/migrations/20260519225000_baseline_game_persistence.sql`.
- The reusable sync command is `npm run db:sync:render-to-supabase`.
- The source Render database is still live, so run the sync command again immediately before switching Colyseus production to Supabase.
- The migrated tables are:
  - `agent_json_state`
  - `world_snapshots`
  - `world_snapshot_backups`
  - `stock_market_snapshots`
  - `player_snapshots`
- The baseline persistence tables are server-owned; migration `20260519233500_lock_down_baseline_persistence_rls.sql` enables RLS and revokes `anon`/`authenticated` access so they are not readable or writable through the browser-facing Data API.

1. Export the current Render Postgres database.
2. Restore the export into Supabase Postgres.
3. Verify these tables and row counts:
   - `world_snapshots`
   - `world_snapshot_backups`
   - `player_snapshots`
   - `stock_market_snapshots`
4. Point a staging Colyseus deployment at Supabase `DATABASE_URL`.
5. Verify:
   - world loads
   - world edits persist
   - stock market state persists
   - player snapshots persist
   - world backups still rotate

## Phase 3: Add Account Tables

Goal: add app-owned tables that connect Supabase Auth users to game roles and permanent saves.

Status: completed on 2026-05-19.

Notes:

- `game_users` and `player_saves` were created fresh with zero starting rows.
- Existing guest `player_snapshots` were not migrated.
- RLS is enabled on both account tables.
- Authenticated browser clients can only select their own `game_users` row.
- Browser clients have no direct access policy for `player_saves`; Colyseus remains the authoritative writer.
- A trigger on `auth.users` creates a matching `game_users` row after signup.
- A trigger on `player_saves` keeps `updated_at` current on updates.
- Remote Supabase migration history includes `20260519232500_add_auth_account_tables.sql`.

```sql
create table public.game_users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table public.player_saves (
  world_key text not null,
  user_id uuid not null references public.game_users(id) on delete cascade,
  snapshot jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (world_key, user_id)
);
```

Optional later additions:

- `admin_audit_logs`
- `player_save_backups`
- `player_public_profiles`
- `linked_guest_saves`

## Phase 4: Client Auth

Goal: let players sign in from the static frontend and pass the current access token to Colyseus.

Status: completed locally on 2026-05-19.

Notes:

- Google is the primary sign-in method in the phone Settings account panel.
- Local browser auth was verified with `oldfeet@gmail.com`.
- The frontend passes the current Supabase access token to Colyseus join options when signed in.
- Guest mode still passes the existing local `playerId`.

1. Add `@supabase/supabase-js`.
2. Add a small frontend auth module.
3. Inject `VTA_SUPABASE_URL` and `VTA_SUPABASE_PUBLISHABLE_KEY` during build.
4. Add sign in, sign out, and auth state UI.
5. Update `createNpcService()`:
   - signed-in mode passes `accessToken`
   - guest mode keeps passing local `playerId`
6. Refresh/rejoin behavior must handle token refresh.

## Phase 5: Colyseus Auth

Goal: authenticate room joins and map Supabase users to saves/admin roles.

Status: completed locally on 2026-05-19.

Notes:

- Colyseus verifies Supabase access tokens before accepting signed-in account joins.
- Signed-in users are upserted into `game_users`.
- Authenticated player saves load from and write to `player_saves`.
- Guest players continue using TTL `player_snapshots`.
- The local backend `/health` endpoint reports `playerAccountPersistenceMode: "postgres"`.
- A rollback-only DB smoke test verified that `player_saves` can be written without leaving test data behind.
- `oldfeet@gmail.com` has a matching `game_users` row and is not marked admin yet.

1. Add token verification in the server before `onJoin`.
2. For signed-in users:
   - verify token
   - read Supabase user id from `sub`
   - upsert `game_users`
   - load from `player_saves`
   - set `player.isAdmin` from `game_users.is_admin`
3. For guests:
   - keep current local `playerId` behavior
   - keep TTL snapshot persistence
4. Save authenticated players to `player_saves` instead of expiring `player_snapshots`.

## Phase 6: Replace Admin Key Flow

Goal: remove URL-key based admin access.

Status: completed locally on 2026-05-19.

Notes:

- `?adminKey=` no longer grants in-game admin access.
- Colyseus join options no longer include `adminKey`.
- Browser admin HTTP routes require `Authorization: Bearer <supabase access token>`.
- Admin HTTP routes verify the Supabase token and require `game_users.is_admin = true`.
- Agent worker routes still use separate `AGENT_WORKER_TOKEN` / `AGENT_WORKER_TOKENS`.

1. Stop granting admin from `?adminKey=`.
2. Admin UI visibility comes from server-owned `player.isAdmin`.
3. Admin HTTP endpoints require `Authorization: Bearer <supabase access token>`.
4. Backend checks:
   - token is valid
   - `game_users.is_admin = true`
5. Keep worker-only auth separate from browser admin auth.

## Phase 7: Rollout

Goal: prove production auth, saves, and admin authorization work end to end.

Status: completed on 2026-05-20.

Notes:

- Production Vercel must include `VTA_SUPABASE_URL` and `VTA_SUPABASE_PUBLISHABLE_KEY` so the browser can initialize Supabase Auth.
- Production Colyseus must include `VTA_SUPABASE_URL` and `VTA_SUPABASE_PUBLISHABLE_KEY` so signed-in room joins can verify Supabase access tokens.
- Backend `/health` reports `supabaseAuthConfigured`.
- `npm run validate:auth-rollout` verifies the public frontend runtime config, backend Supabase auth configuration, Postgres persistence modes, and admin route rejection behavior.

1. Deploy Supabase DB migration.
2. Deploy backend with dual support: guest snapshots and authenticated saves.
3. Deploy frontend auth UI.
4. Mark the first admin in Supabase:

```sql
update public.game_users
set is_admin = true
where id = '<your-auth-user-id>';
```

5. Test:
   - guest can play
   - user can log in
   - progress survives browser/device switch
   - non-admin cannot access builder/admin actions
   - admin can access builder/admin actions
   - `/admin/*` rejects missing or invalid tokens

## Phase 8: Save Hardening And Operations

Goal: make account saves safer to operate before adding more account-facing UX.

Status: completed locally on 2026-05-20.

Notes:

- Account saves are still server-owned. The browser never writes `player_saves` directly.
- Account save JSON should remain a narrow schema: identity metadata, player payload, and stock portfolio payloads.
- Runtime health should expose enough non-secret account-save metadata to tell whether the backend is ready.

1. Validate authenticated save blobs before writing them:
   - valid Supabase user id
   - matching `auth:<user-id>` player id
   - matching world key
   - supported schema version
   - required core player fields
   - JSON object stock payloads
   - configured max size
   - no secret-like keys
2. Ignore malformed stored account saves and let the player join with a fresh server-created state instead of crashing room join.
3. Add a local validation command for the account-save boundary.
4. Add safe `/health` metadata for account-save schema version and configured max save size.
5. Keep production rollout validation separate from this local hardening until the backend is deployed.

## Phase 9: Main Menu And Player Identity

Goal: introduce a first-screen flow before world join where players choose a display name and decide whether to play as guest or sign in with Google.

Status: planned.

Proposed flow:

1. Show a main menu before connecting to Colyseus.
2. Require or strongly prompt for a player name.
3. Offer two clear actions:
   - `Play as guest`
   - `Sign in with Google`
4. For guests, store the chosen name locally and pass it as a sanitized join option.
5. For signed-in players, use Google as the primary auth action and let the chosen name override or confirm the game display name.
6. Server remains authoritative:
   - sanitize guest display names
   - upsert signed-in display names into `game_users`
   - keep `is_admin` server-owned
   - never trust browser-supplied admin state
7. Later, decide whether signing in after guest play should offer to move the current guest progress into the account save.

## Useful Official Docs

- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase JWTs: https://supabase.com/docs/guides/auth/jwts
- Supabase user data tables: https://supabase.com/docs/guides/auth/managing-user-data
- Supabase Postgres connection strings: https://supabase.com/docs/reference/postgres/connection-strings
- Supabase Postgres migration: https://supabase.com/docs/guides/platform/migrating-to-supabase/postgres
