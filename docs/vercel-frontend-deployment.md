# Vercel frontend deployment

StickRPG uses a split production deployment:

- Vercel serves the static frontend from `dist`.
- Colyseus Cloud runs the multiplayer websocket backend, persistence, and NPC services.

This keeps static asset delivery and rollback independent from the long-running game server.

## Vercel project settings

Import the GitHub repository into Vercel and use these settings:

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Root directory | `.` |
| Install command | `npm install` |
| Build command | `npm run build:web` |
| Output directory | `dist` |

Set this Vercel environment variable for Production and Preview:

```text
STICKRPG_SERVER_URL=wss://<colyseus-backend-host>
```

Use a backend-only hostname, not the public frontend hostname. For example, keep or create a Colyseus Cloud hostname such as `server.vibetheftauto.xyz` or `us-atl-06d422c8.vibetheftauto.xyz`, then set:

```text
STICKRPG_SERVER_URL=wss://server.vibetheftauto.xyz
```

Do not copy backend secrets such as `DATABASE_URL`, `OPENAI_API_KEY`, or `ADMIN_KEYS` into Vercel unless a future frontend-only feature explicitly needs a public value. Those remain on Colyseus Cloud.

## DNS cutover

1. Keep one hostname pointed at Colyseus Cloud for the backend.
2. Confirm the backend responds at `https://<colyseus-backend-host>/health`.
3. Point `vibetheftauto.xyz` and optionally `www.vibetheftauto.xyz` to Vercel.
4. Redeploy the Vercel project after `STICKRPG_SERVER_URL` is set.
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
