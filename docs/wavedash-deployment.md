# Wavedash Deployment

Wavedash can host the browser build for a game jam, but it does not replace the
Colyseus backend used by this project. Keep the backend on Colyseus Cloud or
another websocket host, then build the Wavedash upload with `VTA_SERVER_URL`
pointing at that backend.

## One-time setup

1. Install the Wavedash CLI and confirm it is on `PATH`:

   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; irm https://wavedash.com/cli/install.ps1 | iex
   wavedash --version
   ```

2. Sign in:

   ```powershell
   wavedash auth login
   wavedash auth status
   ```

3. From the repo root, create or connect the Wavedash game:

   ```powershell
   wavedash init
   ```

   Use `./dist` for `upload_dir`. For a custom browser build, the resulting
   `wavedash.toml` should look like this:

   ```toml
   game_id = "YOUR_GAME_ID_HERE"
   upload_dir = "./dist"
   entrypoint = "index.html"
   ```

## Local sandbox test

Build the static client with the backend URL embedded, then start the Wavedash
sandbox:

```powershell
$env:VTA_SERVER_URL = "wss://<colyseus-backend-host>"
npm run wavedash:dev
```

The first `wavedash dev` run may prompt for local HTTPS certificate setup. Run it
manually in a terminal and follow the CLI prompts.

## Upload a jam build

```powershell
$env:VTA_SERVER_URL = "wss://<colyseus-backend-host>"
npm run deploy:wavedash -- -m "Game jam build"
```

`wavedash build push` uploads a new immutable build, but it does not make it
live. Open the Wavedash Developer Portal, go to the game's Builds tab, and
publish the uploaded build there.

If the CLI is not available during the jam, run `npm run build:web` and upload
the `dist/` folder from the Developer Portal instead.

## Notes

- `src/main.js` calls `Wavedash.updateLoadProgressZeroToOne()` and
  `Wavedash.init()` when the injected SDK exists. The calls no-op on Vercel and
  local non-Wavedash runs.
- If `VTA_SERVER_URL` is omitted, the client will try to connect to the current
  page host. That is wrong for Wavedash because the Colyseus server is hosted
  separately.
- Keep backend secrets such as `DATABASE_URL`, `AGENT_WORKER_TOKENS`, and
  `OPENAI_API_KEY` out of Wavedash frontend builds.
