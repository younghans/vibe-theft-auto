# Colyseus Cloud Deployment

## 1. Create the application

1. Sign in at <https://cloud.colyseus.io/>.
2. Create a new application named `stickrpg`.
3. Choose the nearest US-East / Virginia-style region.
4. Start with a single instance on a production-oriented compute plan.

## 2. Configure build and environment

1. In the Colyseus Cloud application settings, use the backend-only build command:
   `npm run build:server`.
2. Add these environment variables:
   - `DATABASE_URL`
   - `WORLD_KEY=primary`
   - `WORLD_LAYOUT_SEED_PATH=server/data/world-layout.json`
   - `PLAYER_SNAPSHOT_TTL_MS=1800000` to keep restart/deploy player restores available for 30 minutes
   - `COLYSEUS_PUBLIC_ADDRESS=your-backend-domain.example/2567` only when Colyseus support recommends an explicit public room address
   - `OPENAI_API_KEY`
   - `OPENAI_NPC_MODEL=gpt-5.4-mini`
   - `OPENAI_TIMEOUT_MS=12000`

## Asset pipeline

- Optimized Mixamo runtime assets live in `assets/runtime/mixamo/characters/` and are committed to git.
- Raw Mixamo character FBX files are local-only source inputs in `assets/mixamo/characters/` and are ignored by git. Run `npm run optimize:assets` locally when those source files change. This installs the isolated optimizer package in `tools/mixamo-optimizer/`, then updates the runtime GLBs for commit.
- Do not wire `optimize:assets` into `prebuild` or the Colyseus Cloud build/start path. Cloud deployment should only install dependencies, run the backend-only package `build` script, and start the server.
- `npm run build:web` enforces dist size budgets so oversized source character assets do not quietly return to the frontend deployment payload.

## 3. Deploy from the repo

1. From the repo root, run:

   ```bash
   npm run deploy:colyseus
   ```

2. Complete the browser flow and select the `stickrpg` application.
3. Keep the generated `.colyseus-cloud.json` file local only. It is ignored by git.

## 4. Smoke test

1. Check `/health` on the Colyseus backend hostname and verify it reports `persistenceMode: "postgres"`.
2. Join the `world` room through the Vercel frontend.
3. Make a world edit.
4. Redeploy the backend and confirm the edit persists.

## Notes

- The production deployment expects `DATABASE_URL`.
- Colyseus Cloud Git integration deploys every push to its configured branch. If
  Vercel also deploys from `main`, that means frontend-only agent tasks still
  restart the game server. For smoother player sessions, disable automatic
  Colyseus deploys from Git and let the worker run `BACKEND_DEPLOY_COMMAND`
  only when backend files change.
- If Colyseus Git integration stays enabled, set `BACKEND_DEPLOY_STRATEGY=git`
  on the worker so backend-target tasks do not also run the Colyseus CLI deploy
  command.
- The public frontend is deployed separately on Vercel. See `docs/vercel-frontend-deployment.md`.
- For custom backend domains, set `COLYSEUS_PUBLIC_ADDRESS` to the public websocket host/path the browser should use after matchmaking only if needed. Do not include `ws://` or `wss://`.
- Local development can still use file-backed persistence when `DATABASE_URL` is unset.
- `WORLD_PERSISTENCE_ALLOW_FILE_FALLBACK=true` is an emergency production safety valve only. It can keep the app online without Postgres, but world edits may not survive restarts or redeploys.
- PM2 is pinned to a single instance in `ecosystem.config.cjs` so the world remains authoritative in one process.
- This repo uses ESM (`"type": "module"`), so the PM2 ecosystem file must stay `.cjs` instead of `.js`.
