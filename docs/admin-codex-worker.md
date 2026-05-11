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

For MVP storage, a JSON file is acceptable:

```text
server/data/agent-tasks.json
```

Move to Postgres when this becomes used by multiple admins or when task history matters.

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
AGENT_API_BASE=https://vibetheftauto.xyz
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

- `server/src/agentTasks.js` stores tasks in `server/data/agent-tasks.json`.
- `server/app.config.js` exposes `/admin/agent-tasks` admin and worker endpoints.
- The school microgame HUD has an admin-only `Improve` panel for prompts, task status, logs, branch, commit, and deploy approval.
- `scripts/agent-worker.mjs` polls for work, creates isolated git worktrees, runs Codex, runs `npm ci`, `npm run build`, and `git diff --check`, enforces the MVP file allowlist, commits, pushes an `agent/task-...` branch, and reports updates back to the game.
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
$env:AGENT_API_BASE = "https://vibetheftauto.xyz"
$env:AGENT_WORKER_TOKEN = "<same long random token from AGENT_WORKER_TOKENS>"
$env:AGENT_WORK_ROOT = "D:\agent-work"
$env:GIT_REMOTE = "git@github.com:<org-or-user>/<repo>.git"
$env:GIT_BASE_BRANCH = "main"
$env:AUTO_DEPLOY = "false"
$env:DEPLOY_ENABLED = "false"
node scripts/agent-worker.mjs
```

For a one-task smoke run:

```powershell
node scripts/agent-worker.mjs --once
```

For manual deploy approval from the game, install and authenticate the Colyseus Cloud CLI on the worker, then set:

```powershell
$env:DEPLOY_ENABLED = "true"
$env:DEPLOY_COMMAND = "npm run deploy:colyseus"
```

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
  -> npm run deploy:colyseus
  -> deployed
```

Auto deploy flow:

```text
testing passed
  -> npm run deploy:colyseus
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

## MVP Implementation Order

1. Add task storage and admin/worker endpoints.
2. Add the in-game school minigame `Improve` modal.
3. Add in-game task status panel.
4. Add `scripts/agent-worker.mjs` with polling and status updates.
5. Implement git worktree creation.
6. Implement prompt file generation.
7. Implement `codex exec` invocation.
8. Implement `npm run build` and `git diff --check` gates.
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
- Worker runs `npm run build`.
- Worker commits and pushes the branch.
- Game status panel shows `ready_for_review` with branch and commit.

This proves the end-to-end connection before adding deployment.
