# Colyseus Cloud Deployment

## 1. Create the application

1. Sign in at <https://cloud.colyseus.io/>.
2. Create a new application named `stickrpg`.
3. Choose the nearest US-East / Virginia-style region.
4. Start with a single instance on a production-oriented compute plan.

## 2. Configure build and environment

1. In the Colyseus Cloud application settings, keep the build command on the package `build` script.
   If the UI requires an explicit command, use `npm run build`.
2. Add these environment variables:
   - `DATABASE_URL`
   - `WORLD_KEY=primary`
   - `WORLD_LAYOUT_SEED_PATH=server/data/world-layout.json`
   - `OPENAI_API_KEY`
   - `OPENAI_NPC_MODEL=gpt-5.4-mini`
   - `OPENAI_TIMEOUT_MS=12000`

## 3. Deploy from the repo

Before deploying, make sure generated dependency folders are not tracked by git:

```bash
git ls-files node_modules
```

That command should print nothing. Colyseus Cloud installs dependencies during
the remote build, and tracked `node_modules` contents can break deployment on
the Linux host.

1. From the repo root, run:

   ```bash
   npm run deploy:colyseus
   ```

2. Complete the browser flow and select the `stickrpg` application.
3. Keep the generated `.colyseus-cloud.json` file local only. It is ignored by git.

## 4. Smoke test

1. Open the deployed site and confirm the frontend loads.
2. Check `/health` and verify it reports `persistenceMode: "postgres"`.
3. Join the `world` room and make a world edit.
4. Redeploy and confirm the edit persists.

## Notes

- The production deployment expects `DATABASE_URL`.
- Local development can still use file-backed persistence when `DATABASE_URL` is unset.
- PM2 is pinned to a single instance in `ecosystem.config.cjs` so the world remains authoritative in one process.
- This repo uses ESM (`"type": "module"`), so the PM2 ecosystem file must stay `.cjs` instead of `.js`.
