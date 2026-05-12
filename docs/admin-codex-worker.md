# Admin Codex Worker Plan

This document describes the implementation plan for letting admins submit in-game prompts that become full code changes through a Codex worker running on a separate PC.

The first supported scope is school minigames. The long-term goal is to support broader game systems such as HUDs, models, animations, inputs, NPC behavior, world tools, and other mechanics.

## Goals

- Let trusted admins submit improvement prompts from inside the game.
- Run full-power code changes through Codex on a separate worker machine.
- Build, test, and optionally deploy the result.
- Report status back into the game so the admin can see what happened.
- Keep production safe by isolating code generation from the live Colyseus server.
- Avoid redeploys when a change is data-only in the future, but support real code changes as the primary path.

## Non-Goals

- Do not run Codex inside the production Colyseus process.
- Do not expose a public shell endpoint.
- Do not let prompt text directly execute commands.
- Do not give ordinary players access to the workflow.
- Do not auto-deploy failed builds or untested changes.

## High-Level Architecture

```text
Admin in game
  -> submits feedback prompt
  -> POST /admin/agent-tasks

Production server
  -> validates adminKey
  -> stores task
  -> exposes task status

Extra PC worker
  -> polls /admin/agent-tasks/next
  -> claims task
  -> creates clean git worktree
  -> runs Codex CLI in non-interactive mode
  -> runs build/tests/smoke checks
  -> commits and pushes branch
  -> optionally deploys
  -> reports result back to server

Admin in game
  -> sees queued/coding/testing/ready/deployed status
```

The worker uses an outbound polling connection. The extra PC does not need to accept inbound traffic from the internet.

## Why A Pull-Based Worker

The extra PC should poll for work instead of receiving webhooks directly.

This is simpler and safer:

- No router port forwarding.
- No public worker endpoint to secure.
- The worker can go offline without breaking production.
- Production never needs direct filesystem or shell access.
- The worker can be replaced later by a cloud VM without changing the game UI.

## Codex CLI Usage

The worker should use the Codex CLI locally on the extra PC.

OpenAI documentation:

- Codex CLI: <https://developers.openai.com/codex/cli>
- Non-interactive `codex exec`: <https://www.mintlify.com/openai/codex/cli/exec>

Install on the worker machine:

```bash
npm i -g @openai/codex
codex
```

Sign in once interactively. After that, the worker script should call Codex non-interactively:

```bash
codex exec --full-auto --sandbox workspace-write -C <worktree> < <prompt-file>
```

The exact flags may be adjusted after testing. Start with `workspace-write`, not unrestricted host access.

## Task Lifecycle

Recommended statuses:

```text
queued
claimed
preparing
coding
testing
test_failed
ready_for_review
deploying
deployed
failed
cancelled
```

Recommended modes:

```text
draft       Create branch only. No deploy.
preview     Create branch and preview. No production deploy.
auto        Build, test, and deploy if checks pass.
```

Initial default should be `preview`.

## Task Record

Minimum task shape:

```json
{
  "id": "task_123",
  "type": "code_change",
  "scope": "school_minigame",
  "gameId": "teacher-is-looking",
  "prompt": "Make the teacher use a real 3D model and improve the turn animation.",
  "mode": "preview",
  "status": "queued",
  "createdBy": "admin-session-id",
  "createdAt": 1760000000000,
  "claimedBy": "",
  "claimedAt": 0,
  "branch": "",
  "commitSha": "",
  "previewUrl": "",
  "deployUrl": "",
  "changedFiles": [],
  "deployTargets": [],
  "error": "",
  "summary": "",
  "logs": [],
  "snapshot": {
    "url": "",
    "buildVersion": "",
    "game": null,
    "adminPosition": null
  }
}
```

Agent task storage uses Postgres when `DATABASE_URL` is present and no explicit file path override is configured. Local development and tests can still use JSON files:

```text
server/data/agent-tasks.json
server/data/agent-deployments.json
```

Set `AGENT_STATE_STORE=file`, `AGENT_TASKS_FILE_PATH`, or `AGENT_DEPLOYMENTS_FILE_PATH` only for local debugging or tests. Production should keep `DATABASE_URL` configured so prompt threads, deployed history, rollback state, and agent completion messages survive server restarts and redeploys.

## Server Endpoints

Add admin endpoints. These should use the existing admin key validation pattern already used by `/admin/world-map`.

```text
POST  /admin/agent-tasks
GET   /admin/agent-tasks
GET   /admin/agent-tasks/:id
GET   /admin/agent-tasks/next
PATCH /admin/agent-tasks/:id
POST  /admin/agent-tasks/:id/logs
POST  /admin/agent-tasks/:id/cancel
POST  /admin/agent-tasks/:id/approve-deploy
```

Two credentials should exist:

```text
ADMIN_KEYS              Used by in-game admins.
AGENT_WORKER_TOKENS     Used by worker machines.
```

Do not reuse player/admin keys as worker credentials.

## Claiming Work

`GET /admin/agent-tasks/next` should atomically claim one queued task.

Request:

```http
GET /admin/agent-tasks/next?scope=school_minigame
Authorization: Bearer <AGENT_WORKER_TOKEN>
```

Response when work exists:

```json
{
  "ok": true,
  "task": {
    "id": "task_123",
    "status": "claimed"
  }
}
```

Response when no work exists:

```json
{
  "ok": true,
  "task": null
}
```

## In-Game UI

For the first version, add this only to school minigame HUDs when admin mode is available.

UI pieces:

- `Improve` button in the school minigame HUD.
- Modal with textarea for prompt.
- Mode selector: `Preview` and `Auto deploy` if enabled.
- Submit button.
- Status panel listing recent tasks.
- Task detail view with logs, branch, commit, preview URL, deploy status, and failure message.

Useful snapshot fields to send with the prompt:

- `gameId`
- `round`
- `data`
- `phase`
- `remainingMs`
- `resultTitle`
- `resultDetail`
- `npcId`
- `npcName`
- `npcModelId`
- current URL
- client build version if available

Screenshots can be added later. Text context is enough for the first pass.

## Worker Machine Setup

Recommended environment variables:

```bash
AGENT_API_BASE=https://us-atl-06d422c8.vibetheftauto.xyz
AGENT_WORKER_TOKEN=<long random token>
AGENT_WORK_ROOT=D:\agent-work
GIT_REMOTE=git@github.com:<org-or-user>/<repo>.git
GIT_BASE_BRANCH=main
AUTO_DEPLOY=false
```

The worker PC needs:

- Git access to the repository.
- Node version matching `package.json` engines.
- Codex CLI installed and authenticated.
- Colyseus Cloud CLI access only if deploy mode is enabled.
- Enough disk space for temporary worktrees.

## Implemented MVP Setup

This repo now includes the first vertical slice:

- `server/src/agentTasks.js` stores tasks through a Postgres-backed JSON state store in production, with local JSON-file fallback for tests and development.
- `server/app.config.js` exposes `/admin/agent-tasks` admin and worker endpoints.
- The school microgame HUD has an admin-only `Improve` panel for prompts, task status, logs, branch, commit, and deploy approval.
- `scripts/agent-worker.mjs` polls for work, creates isolated git worktrees, runs Codex, runs `npm ci`, `npm run build:web`, `npm run build:server`, and `git diff --check`, enforces the MVP file allowlist, commits, pushes an `agent/task-...` branch, infers frontend/backend deploy targets from changed files, and reports updates back to the game.
- `npm run validate:agent-tasks` validates the local JSON task lifecycle.

On the game server, configure:

```bash
ADMIN_KEYS=<existing-admin-key-list>
AGENT_WORKER_TOKENS=<long-random-worker-token>
```

The admin browser URL still needs `?adminKey=<admin-key>`. Add `&agentAutoDeploy=1` only for admins who should see the `Auto deploy` mode. The worker still refuses production deploys unless its own deploy environment enables them. Do not commit, screenshot, paste, or link URLs containing a real admin key; rotate the key if one is accidentally shared.

On the extra PC, install prerequisites:

```bash
npm i -g @openai/codex
codex
git --version
node --version
git config --global user.name "<worker name>"
git config --global user.email "<worker email>"
```

Then set the worker environment. PowerShell example:

```powershell
$env:AGENT_API_BASE = "https://us-atl-06d422c8.vibetheftauto.xyz"
$env:AGENT_WORKER_TOKEN = "<same long random token from AGENT_WORKER_TOKENS>"
$env:AGENT_WORK_ROOT = "D:\agent-work"
$env:GIT_REMOTE = "git@github.com:<org-or-user>/<repo>.git"
$env:GIT_BASE_BRANCH = "main"
$env:AUTO_DEPLOY = "false"
$env:DEPLOY_ENABLED = "false"
node scripts/agent-worker.mjs
```

The production defaults above are also available through a one-command launcher. Put only the secret token in an ignored local file at the repository root:

```powershell
"AGENT_WORKER_TOKEN=<same long random token from AGENT_WORKER_TOKENS>" | Set-Content .env.worker.production
```

Then start the production worker:

```powershell
npm run worker:prod
```

For a one-task smoke run with the same production defaults:

```powershell
npm run worker:prod:once
```

For a one-task smoke run:

```powershell
node scripts/agent-worker.mjs --once
```

## Prompt threads

In-game prompts are grouped into lightweight threads. The first prompt in a thread creates the initial task; follow-up prompts create new tasks with the same `threadId` and a `parentTaskId` pointing at the selected task. The server snapshots recent thread history onto the follow-up task so the worker prompt includes the prior admin requests and agent replies.

The worker writes Codex's final response with `codex exec --output-last-message` and stores it as `agentMessage`. The Prompt panel renders that message in the selected thread so admins can see the relevant completion note after a task reaches ready, deployed, failed, or rolled-back states.

Only one worker run can be active in a thread at a time. Follow-ups are allowed once the thread is idle, including from a ready-for-review branch or a deployed task. If the latest idle task is ready for review, the follow-up starts from that task branch so the next change continues the undeployed work.

For manual deploy approval from the game, keep `AGENT_API_BASE` pointed at the Colyseus backend host, not the Vercel frontend host. The worker first fetches the latest `main`. If the approved task branch is behind `main`, it attempts to rebase the task commit onto the current `main`, reruns checks, updates the task branch, and only then pushes to `main`. If the rebase conflicts or the rebuilt task fails checks, deployment stops before touching `main`.

For local development workers, keep `DEPLOY_ENABLED=false` and `AUTO_DEPLOY=false`. Those workers still claim and run prompt coding tasks, but they do not claim approved deploy or rollback actions. To test a ready task locally, check out the pushed `agent/task-...` branch or create a local git worktree for that branch and run the dev server there.

After that safety pass, the worker deploys only the inferred runtime targets:

- `frontend` changes are served by Vercel. With Git integration, no command is required; Vercel deploys the pushed `main` commit. The worker then verifies that the production frontend is serving the expected commit SHA before it marks the task deployed or rolled back. To force the worker to run a Vercel CLI deploy instead, set `FRONTEND_DEPLOY_COMMAND`.
- `backend` changes are served by Colyseus Cloud. Install and authenticate the Colyseus Cloud CLI on the worker, then set `BACKEND_DEPLOY_COMMAND`.

PowerShell example:

```powershell
$env:DEPLOY_ENABLED = "true"
$env:BACKEND_DEPLOY_COMMAND = "npm run deploy:colyseus"
$env:BACKEND_DEPLOY_STRATEGY = "command"
$env:BACKEND_VERIFY_URL = "https://us-atl-06d422c8.vibetheftauto.xyz/health"
$env:FRONTEND_VERIFY_URL = "https://www.vibetheftauto.xyz/"
# Optional; leave unset when Vercel Git integration deploys pushes to main.
$env:FRONTEND_DEPLOY_COMMAND = "npx vercel deploy --prod --yes"
```

`DEPLOY_COMMAND` is still accepted as a legacy alias for the backend deploy command.
If Colyseus Cloud Git integration remains enabled for `main`, use
`BACKEND_DEPLOY_STRATEGY=git` so the worker records and verifies the backend
deploy without running a second CLI deploy. The smoother setup is to disable
Colyseus automatic Git deploys and keep `BACKEND_DEPLOY_STRATEGY=command`,
because then frontend-only tasks do not restart connected players.

For full auto deploy, set both the admin URL flag and worker opt-in:

```powershell
$env:AUTO_DEPLOY = "true"
$env:DEPLOY_ENABLED = "true"
```

Keep the worker token off the client and out of git. The extra PC only needs outbound access to the game server and GitHub; no router port forwarding is required.

## Worker Loop

The worker should live in:

```text
scripts/agent-worker.mjs
```

Pseudo-code:

```js
while (true) {
  const task = await claimNextTask();
  if (!task) {
    await sleep(5000);
    continue;
  }

  try {
    await updateTask(task.id, { status: 'preparing' });

    const worktree = await createWorktree(task);
    const promptFile = await writePromptFile(task, worktree);

    await updateTask(task.id, { status: 'coding' });
    await runCodex(worktree, promptFile, task);

    await updateTask(task.id, { status: 'testing' });
    await runChecks(worktree, task);

    const commit = await commitAndPush(worktree, task);

    if (task.mode === 'auto') {
      await updateTask(task.id, { status: 'deploying' });
      await deploy(worktree, task);
      await updateTask(task.id, { status: 'deployed', commitSha: commit.sha });
    } else {
      await updateTask(task.id, {
        status: 'ready_for_review',
        branch: commit.branch,
        commitSha: commit.sha
      });
    }
  } catch (error) {
    await updateTask(task.id, {
      status: 'failed',
      error: String(error?.stack ?? error)
    });
  } finally {
    await cleanupWorktree(task);
  }
}
```

## Codex Prompt Template

The worker should generate a prompt file instead of passing raw admin text directly.

Template:

```md
You are Codex working in the StickRPG repository.

Task ID:
<task id>

Admin request:
<admin prompt>

Scope:
School minigames. Keep edits scoped unless the request genuinely requires shared input/HUD systems.

Relevant current game:
<game id>

Runtime snapshot:
```json
<snapshot json>
```

Expected behavior:
- Implement the requested game change.
- Keep the game polished and playable.
- Preserve unrelated features.
- Add or update focused validation where useful.
- Run or prepare for `npm run build`.

Important constraints:
- Do not read or modify secrets.
- Do not edit deployment credentials.
- Do not run production deploy commands.
- Do not revert unrelated user changes.
- Keep the final result commit-ready.
```

## File Allowlist For MVP

The first worker implementation should instruct Codex to stay in these areas:

```text
src/shared/schoolMicrogames.js
src/game/Game.js
src/game/Input.js
src/ui/Hud.js
styles.css
scripts/
docs/
```

This is not a hard security boundary by itself. It is a task constraint. Actual enforcement can be added by checking `git diff --name-only` after Codex runs and failing tasks that touch disallowed files.

## Checks

Minimum checks before marking a task ready:

```bash
npm run build
git diff --check
```

Recommended school minigame smoke checks:

- Open the requested minigame by debug URL.
- Verify HUD loads.
- Start the minigame.
- Exercise success path if deterministic enough.
- Exercise failure path if deterministic enough.
- Capture screenshot artifact.

The worker should upload or store:

- final Codex summary
- build logs
- test logs
- screenshot paths or URLs
- branch name
- commit SHA

## Deployment

Production deploy should be opt-in at first.

Manual approval flow:

```text
ready_for_review
  -> admin clicks Approve Deploy
  -> worker claims deploy action
  -> worker fetches latest main
  -> if main moved, worker rebases the task branch and reruns checks
  -> worker validates npm run build:web and npm run build:server
  -> worker pushes commit to main
  -> frontend changes deploy through Vercel Git integration or FRONTEND_DEPLOY_COMMAND
  -> worker waits until production frontend serves the pushed commit SHA
  -> backend changes deploy through BACKEND_DEPLOY_COMMAND
  -> deployed
```

Auto deploy flow:

```text
testing passed
  -> worker pushes commit to main
  -> worker deploys inferred frontend/backend targets
  -> deployed
```

Use auto deploy only after the preview workflow is stable.

## Preview Options

Start with branch-only review. Then add preview.

Possible preview strategies:

1. Worker PC preview through Tailscale or Cloudflare Tunnel.
2. Staging Colyseus Cloud app.
3. GitHub branch plus local instructions.

The most practical first preview is a worker-hosted preview server exposed only to admins.

## Security Rules

- Worker token must be long and random.
- Worker token must not be visible in client code.
- Server must verify worker token for claim/update endpoints.
- Admin prompts must be stored as data, not executed as commands.
- The worker script owns all shell commands.
- Codex should not receive `.env` contents.
- Codex should not receive deployment tokens in prompt context.
- Failed build means no deploy.
- Disallowed file changes should fail the task.
- Keep a rollback path documented.

## Rollback

For production deploys, the task result should store:

- previous deployed commit SHA
- new deployed commit SHA
- deploy timestamp
- deploy log

Rollback options:

1. Revert the merged commit and deploy.
2. Redeploy the previous known-good commit.
3. Disable the affected admin workflow while investigating.

The implemented worker rollback path uses option 1. It creates a revert commit, reruns the same checks used for deploy approval, pushes the revert to `main`, and then waits until the production frontend is serving the rollback commit SHA before setting the task to `rolled_back`.

## MVP Implementation Order

1. Add task storage and admin/worker endpoints.
2. Add the in-game school minigame `Improve` modal.
3. Add in-game task status panel.
4. Add `scripts/agent-worker.mjs` with polling and status updates.
5. Implement git worktree creation.
6. Implement prompt file generation.
7. Implement `codex exec` invocation.
8. Implement `npm run build:web`, `npm run build:server`, and `git diff --check` gates.
9. Implement commit and push.
10. Add manual deploy approval.
11. Add preview URLs.
12. Consider auto deploy after enough successful manual runs.

## First Vertical Slice

The smallest useful version:

- Admin submits prompt from `Teacher Is Looking`.
- Server writes a queued task to `server/data/agent-tasks.json`.
- Worker polls, claims the task, creates branch `agent/task-<id>`.
- Worker runs Codex.
- Worker runs `npm run build:web` and `npm run build:server`.
- Worker commits and pushes the branch.
- Game status panel shows `ready_for_review` with branch and commit.

This proves the end-to-end connection before adding deployment.
