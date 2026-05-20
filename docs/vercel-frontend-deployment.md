# Vercel frontend deployment

Vibe Theft Auto uses a split production deployment:

- Vercel serves the static frontend from `dist`.
- Colyseus Cloud runs the multiplayer websocket backend, persistence, and NPC services.

This keeps static asset delivery and rollback independent from the long-running game server.

The canonical public game URL is `https://www.vibetheftauto.xyz`. The apex domain `https://vibetheftauto.xyz` redirects there.

## Vercel project settings

Import the GitHub repository into Vercel and use these settings:

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Root directory | `.` |
| Install command | `npm install` |
| Build command | `npm run build:web` |
| Output directory | `dist` |
| Ignored build step | `node scripts/vercel-ignore-build.mjs` |

Set this Vercel environment variable for Production and Preview:

```text
VTA_SERVER_URL=wss://<colyseus-backend-host>
```

Use a backend-only hostname, not the public frontend hostname. The current backend hostname is `us-atl-06d422c8.vibetheftauto.xyz`, so set:

```text
VTA_SERVER_URL=wss://us-atl-06d422c8.vibetheftauto.xyz
```

Do not copy backend secrets such as `DATABASE_URL`, `OPENAI_API_KEY`, or `AGENT_WORKER_TOKENS` into Vercel unless a future frontend-only feature explicitly needs a public value. Those remain on Colyseus Cloud.

## DNS cutover

1. Keep one hostname pointed at Colyseus Cloud for the backend.
2. Confirm the backend responds at `https://<colyseus-backend-host>/health`.
3. Point `vibetheftauto.xyz` and `www.vibetheftauto.xyz` to Vercel.
4. Redeploy the Vercel project after `VTA_SERVER_URL` is set.
5. Open the Vercel-hosted site and confirm the browser console logs a Colyseus connection to the configured backend.

## Colyseus Cloud settings

Once Vercel serves the frontend, Colyseus Cloud no longer needs to build the web bundle. Keep its install/start settings, but change the build command to the fast backend check if the dashboard allows it:

```text
npm run build:server
```

The start command remains:

```text
npm start
```

The package `build` script is backend-only so Colyseus Cloud can use its default `npm run build` hook without rebuilding frontend assets. Use `npm run build:web` for Vercel and `npm run build:all` when you want to validate both deploy targets locally.

## Ignored frontend builds

The Vercel Git integration sees every push to `main`, including backend-only
and worker-only commits. The ignored build script compares the pending commit
against Vercel's last successful deployment SHA and skips the build unless the
diff includes frontend-affecting paths such as `src/`, `assets/`, `vendor/`,
`index.html`, `styles.css`, `vercel.json`, `package.json`, `package-lock.json`,
`scripts/build-web.mjs`, or `scripts/vercel-ignore-build.mjs`. If the diff
cannot be read, the script lets Vercel build so a frontend deploy is never
accidentally missed.

## Codex worker deployment

The Codex worker must treat frontend and backend deploys separately:

- Keep `AGENT_API_BASE` pointed at the Colyseus backend hostname because the task API lives on the backend.
- The worker validation gate runs both `npm run build:web` and `npm run build:server`.
- Frontend task changes deploy through Vercel after the worker pushes the approved commit to `main`. If Git integration is enabled, leave `FRONTEND_DEPLOY_COMMAND` unset. If the worker should run the Vercel CLI itself, set `FRONTEND_DEPLOY_COMMAND`, for example `npx vercel deploy --prod --yes`.
- Frontend builds stamp the served HTML with `VTA_BUILD_COMMIT_SHA`. Vercel sets this from `VERCEL_GIT_COMMIT_SHA`; other hosts can set `VTA_BUILD_COMMIT_SHA` explicitly.
- The worker waits for the production frontend to serve the expected commit before it marks frontend deploys or rollbacks complete. Set `FRONTEND_VERIFY_URL` to the production URL, for example `https://www.vibetheftauto.xyz/`; if unset, the worker falls back to the `homepage` field in `package.json`.
- Backend task changes deploy through `BACKEND_DEPLOY_COMMAND`, normally `npm run deploy:colyseus`.
- If Colyseus Cloud is also connected directly to `main`, every frontend push
  restarts the backend too. Disable Colyseus Git auto deploys for the smoothest
  player experience, or set `BACKEND_DEPLOY_STRATEGY=git` on the worker to avoid
  running a duplicate backend CLI deploy.

Do not set the legacy `DEPLOY_COMMAND` to a combined frontend/backend deploy. It remains supported only as a backend deploy alias for older worker environments.
