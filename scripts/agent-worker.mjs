import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_SCOPE = String(process.env.AGENT_TASK_SCOPE || 'game');
const DEFAULT_POLL_MS = 5000;
const DEFAULT_COMMAND_TIMEOUT_MS = 20 * 60 * 1000;
const CODEX_TIMEOUT_MS = Number(process.env.CODEX_TIMEOUT_MS || (45 * 60 * 1000));
const WORKER_ID = process.env.AGENT_WORKER_ID || `${os.hostname()}-${process.pid}`;
const API_BASE = String(process.env.AGENT_API_BASE || '').replace(/\/+$/u, '');
const WORKER_TOKEN = String(process.env.AGENT_WORKER_TOKEN || '');
const WORK_ROOT = path.resolve(process.env.AGENT_WORK_ROOT || path.join(os.homedir(), 'stickrpg-agent-work'));
const REPO_PATH = path.join(WORK_ROOT, 'repo');
const TASKS_ROOT = path.join(WORK_ROOT, 'tasks');
const GIT_REMOTE = String(process.env.GIT_REMOTE || '');
const GIT_BASE_BRANCH = String(process.env.GIT_BASE_BRANCH || 'main');
const AUTO_DEPLOY = ['1', 'true', 'yes'].includes(String(process.env.AUTO_DEPLOY || '').toLowerCase());
const DEPLOY_ENABLED = AUTO_DEPLOY || ['1', 'true', 'yes'].includes(String(process.env.DEPLOY_ENABLED || '').toLowerCase());
const DEPLOY_COMMAND = process.env.DEPLOY_COMMAND || 'npm run deploy:colyseus';
const RUN_ONCE = process.argv.includes('--once');

const ALLOWED_EXACT_FILES = new Set([
  'index.html',
  'package.json',
  'package-lock.json',
  'styles.css'
]);

const ALLOWED_PREFIXES = [
  'assets/',
  'server/',
  'src/',
  'scripts/',
  'docs/'
];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function truncateText(value = '', maxLength = 6000) {
  const text = String(value ?? '');
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 24))}\n...[truncated]`;
}

function normalizeRepoPath(value = '') {
  return String(value ?? '').replaceAll('\\', '/').replace(/^\.\/+/u, '');
}

function isAllowedChangedFile(filePath = '') {
  const normalized = normalizeRepoPath(filePath);
  return ALLOWED_EXACT_FILES.has(normalized)
    || ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function safeTaskSlug(value = '') {
  return String(value || 'task')
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 96) || 'task';
}

function commandForPlatform(command = '', args = []) {
  if (process.platform !== 'win32') {
    return { command, args };
  }

  const normalizedCommand = path.basename(String(command)).toLowerCase();
  if (normalizedCommand === 'npm' || normalizedCommand === 'npm.cmd') {
    return {
      command: process.execPath,
      args: [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'), ...args]
    };
  }

  if (normalizedCommand === 'npx' || normalizedCommand === 'npx.cmd') {
    return {
      command: process.execPath,
      args: [path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js'), ...args]
    };
  }

  if (normalizedCommand === 'codex') {
    return { command: 'codex.exe', args };
  }

  return { command, args };
}

function splitCommandLine(value = '') {
  const parts = [];
  const pattern = /"([^"]*)"|'([^']*)'|([^\s]+)/gu;
  for (const match of value.matchAll(pattern)) {
    parts.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return parts.filter(Boolean);
}

function assertInside(parentPath, childPath) {
  const parent = path.resolve(parentPath);
  const child = path.resolve(childPath);
  const relative = path.relative(parent, child);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to operate outside ${parent}: ${child}`);
  }
}

async function apiRequest(endpoint, {
  method = 'GET',
  query = null,
  body = null
} = {}) {
  if (!API_BASE) {
    throw new Error('AGENT_API_BASE is required.');
  }
  if (!WORKER_TOKEN) {
    throw new Error('AGENT_WORKER_TOKEN is required.');
  }

  const url = new URL(endpoint, `${API_BASE}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      authorization: `Bearer ${WORKER_TOKEN}`,
      'content-type': 'application/json',
      'x-agent-worker-id': WORKER_ID
    },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `API request failed: ${response.status}`);
  }

  return payload;
}

async function updateTask(taskId, updates = {}) {
  return apiRequest(`/admin/agent-tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: updates
  });
}

async function appendLog(taskId, message, { level = 'info', data = null } = {}) {
  try {
    await apiRequest(`/admin/agent-tasks/${encodeURIComponent(taskId)}/logs`, {
      method: 'POST',
      body: {
        level,
        message: truncateText(message, 4000),
        data
      }
    });
  } catch (error) {
    console.warn(`[agent-worker] Could not append task log for ${taskId}.`, error);
  }
}

async function recordDeployment(payload = {}) {
  return apiRequest('/admin/agent-deployments', {
    method: 'PATCH',
    body: payload
  });
}

async function runCommand(command, args = [], {
  cwd = process.cwd(),
  input = null,
  timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS,
  taskId = '',
  label = command
} = {}) {
  const printable = [command, ...args].join(' ');
  console.log(`[agent-worker] ${label}: ${printable}`);
  if (taskId) {
    await appendLog(taskId, `Running ${label}.`, {
      data: { command: printable, cwd }
    });
  }

  return new Promise((resolve, reject) => {
    const platformCommand = commandForPlatform(command, args);
    const child = spawn(platformCommand.command, platformCommand.args, {
      cwd,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let output = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        child.kill('SIGTERM');
        settled = true;
        reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);

    const collect = (chunk) => {
      const text = chunk.toString('utf8');
      process.stdout.write(text);
      output = truncateText(`${output}${text}`, 80000);
    };
    const collectError = (chunk) => {
      const text = chunk.toString('utf8');
      process.stderr.write(text);
      output = truncateText(`${output}${text}`, 80000);
    };

    child.stdout.on('data', collect);
    child.stderr.on('data', collectError);
    child.on('error', (error) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.on('close', async (code) => {
      clearTimeout(timeout);
      if (settled) {
        return;
      }
      settled = true;
      if (taskId) {
        await appendLog(taskId, `${label} exited with code ${code}.`, {
          level: code === 0 ? 'info' : 'error',
          data: { output: truncateText(output, 5000) }
        });
      }
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`${label} failed with code ${code}.\n${truncateText(output, 8000)}`));
      }
    });

    if (input != null) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
  });
}

async function git(args = [], options = {}) {
  return runCommand('git', args, {
    ...options,
    label: options.label || `git ${args[0] ?? ''}`
  });
}

async function ensureBaseRepository(taskId = '') {
  await fsp.mkdir(WORK_ROOT, { recursive: true });
  await fsp.mkdir(TASKS_ROOT, { recursive: true });

  const gitDir = path.join(REPO_PATH, '.git');
  const hasRepo = await fsp.stat(gitDir).then((stats) => stats.isDirectory()).catch(() => false);
  if (!hasRepo) {
    if (!GIT_REMOTE) {
      throw new Error('GIT_REMOTE is required to clone the repository.');
    }
    await git(['clone', GIT_REMOTE, REPO_PATH], {
      cwd: WORK_ROOT,
      taskId,
      label: 'git clone'
    });
  } else if (GIT_REMOTE) {
    await git(['remote', 'set-url', 'origin', GIT_REMOTE], {
      cwd: REPO_PATH,
      taskId,
      label: 'git remote set-url'
    });
  }

  await git(['fetch', 'origin', GIT_BASE_BRANCH, '--prune'], {
    cwd: REPO_PATH,
    taskId,
    label: 'git fetch base'
  });
  await git(['worktree', 'prune'], {
    cwd: REPO_PATH,
    taskId,
    label: 'git worktree prune'
  });
}

async function cleanTaskWorktree(worktreePath, taskId = '') {
  assertInside(TASKS_ROOT, worktreePath);
  const exists = await fsp.stat(worktreePath).then(() => true).catch(() => false);
  if (!exists) {
    return;
  }

  await git(['worktree', 'remove', '--force', worktreePath], {
    cwd: REPO_PATH,
    taskId,
    label: 'git worktree remove'
  }).catch(() => {});
  await fsp.rm(worktreePath, { recursive: true, force: true });
}

async function createCodeWorktree(task) {
  await ensureBaseRepository(task.id);
  const slug = safeTaskSlug(task.id);
  const branch = `agent/task-${slug}`;
  const worktreePath = path.join(TASKS_ROOT, slug);
  await cleanTaskWorktree(worktreePath, task.id);
  await git(['worktree', 'add', '-B', branch, worktreePath, `origin/${GIT_BASE_BRANCH}`], {
    cwd: REPO_PATH,
    taskId: task.id,
    label: 'git worktree add'
  });
  return { branch, worktreePath };
}

async function createDeployWorktree(task) {
  await ensureBaseRepository(task.id);
  const branch = String(task.branch || '').trim();
  const commitSha = String(task.commitSha || '').trim();
  if (!branch && !commitSha) {
    throw new Error('Deploy task has no branch or commit SHA.');
  }

  if (branch) {
    await git(['fetch', 'origin', branch], {
      cwd: REPO_PATH,
      taskId: task.id,
      label: 'git fetch deploy branch'
    });
  }

  const slug = `${safeTaskSlug(task.id)}-deploy`;
  const worktreePath = path.join(TASKS_ROOT, slug);
  await cleanTaskWorktree(worktreePath, task.id);
  const ref = branch ? `origin/${branch}` : commitSha;
  await git(['worktree', 'add', worktreePath, ref], {
    cwd: REPO_PATH,
    taskId: task.id,
    label: 'git worktree add deploy'
  });
  return { branch, worktreePath };
}

async function createRollbackWorktree(task) {
  await ensureBaseRepository(task.id);
  const slug = `${safeTaskSlug(task.id)}-rollback`;
  const branch = `agent/rollback-${safeTaskSlug(task.id)}`;
  const worktreePath = path.join(TASKS_ROOT, slug);
  await cleanTaskWorktree(worktreePath, task.id);
  await git(['worktree', 'add', '-B', branch, worktreePath, `origin/${GIT_BASE_BRANCH}`], {
    cwd: REPO_PATH,
    taskId: task.id,
    label: 'git worktree add rollback'
  });
  return { branch, worktreePath };
}

function indentBlock(value = '') {
  return String(value ?? '')
    .split(/\r?\n/u)
    .map((line) => `  ${line}`)
    .join('\n');
}

async function writePromptFile(task, worktreePath) {
  const promptPath = path.join(worktreePath, '.codex', 'agent-task-prompt.md');
  await fsp.mkdir(path.dirname(promptPath), { recursive: true });
  const prompt = `You are Codex working in the StickRPG repository.

Task ID:
${task.id}

Admin request:
${indentBlock(task.prompt)}

Scope:
Game-wide admin prompt. Keep edits focused on the requested behavior and the referenced context.

Current context:
- Type: ${task.contextType || task.scope || 'game'}
- Label: ${task.contextLabel || 'Game'}
- Game ID: ${task.gameId || 'none'}

Runtime snapshot:
\`\`\`json
${JSON.stringify(task.snapshot ?? null, null, 2)}
\`\`\`

Expected behavior:
- Implement the requested game change.
- Keep the game polished and playable.
- Preserve unrelated features.
- Add or update focused validation where useful.
- Run or prepare for \`npm run build\`.

Repo file allowlist:
- src/
- server/
- scripts/
- docs/
- assets/
- styles.css
- index.html
- package.json / package-lock.json

Important constraints:
- Do not read or modify secrets.
- Do not edit deployment credentials.
- Do not run production deploy commands.
- Do not revert unrelated user changes.
- Keep the final result commit-ready.
`;
  await fsp.writeFile(promptPath, prompt, 'utf8');
  return promptPath;
}

async function runCodex(task, worktreePath, promptPath) {
  const prompt = await fsp.readFile(promptPath, 'utf8');
  const configuredArgs = process.env.CODEX_EXEC_ARGS
    ? splitCommandLine(process.env.CODEX_EXEC_ARGS).map((arg) => arg.replaceAll('{worktree}', worktreePath))
    : ['exec', '--full-auto', '--sandbox', 'workspace-write', '-C', worktreePath];

  return runCommand(process.env.CODEX_COMMAND || 'codex', configuredArgs, {
    cwd: worktreePath,
    input: prompt,
    timeoutMs: CODEX_TIMEOUT_MS,
    taskId: task.id,
    label: 'codex exec'
  });
}

async function installAndCheck(task, worktreePath) {
  await runCommand('npm', ['ci'], {
    cwd: worktreePath,
    taskId: task.id,
    timeoutMs: 15 * 60 * 1000,
    label: 'npm ci'
  });
  await runCommand('npm', ['run', 'build'], {
    cwd: worktreePath,
    taskId: task.id,
    timeoutMs: 15 * 60 * 1000,
    label: 'npm run build'
  });
  await git(['diff', '--check'], {
    cwd: worktreePath,
    taskId: task.id,
    label: 'git diff check'
  });
}

async function getChangedFiles(worktreePath) {
  const trackedOutput = await git(['diff', '--name-only', 'HEAD', '--'], {
    cwd: worktreePath,
    label: 'git diff name-only'
  });
  const untrackedOutput = await git(['ls-files', '--others', '--exclude-standard'], {
    cwd: worktreePath,
    label: 'git ls-files untracked'
  });
  return [...new Set(`${trackedOutput}\n${untrackedOutput}`
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('warning:'))
    .filter(Boolean))];
}

async function enforceAllowlist(task, worktreePath) {
  const changedFiles = await getChangedFiles(worktreePath);
  const disallowed = changedFiles.filter((filePath) => !isAllowedChangedFile(filePath));
  if (disallowed.length > 0) {
    throw new Error(`Codex changed files outside the MVP allowlist: ${disallowed.join(', ')}`);
  }
  if (changedFiles.length === 0) {
    throw new Error('Codex did not leave any file changes to commit.');
  }

  await appendLog(task.id, 'Changed files passed allowlist.', {
    data: { changedFiles }
  });
  return changedFiles;
}

async function commitAndPush(task, worktreePath, branch, changedFiles) {
  await git(['add', '--', ...changedFiles], {
    cwd: worktreePath,
    taskId: task.id,
    label: 'git add'
  });
  await git(['commit', '-m', `Agent task ${task.id}`], {
    cwd: worktreePath,
    taskId: task.id,
    label: 'git commit'
  });
  const commitSha = (await git(['rev-parse', 'HEAD'], {
    cwd: worktreePath,
    taskId: task.id,
    label: 'git rev-parse'
  })).trim();
  await git(['push', '-u', 'origin', branch], {
    cwd: worktreePath,
    taskId: task.id,
    timeoutMs: 10 * 60 * 1000,
    label: 'git push'
  });
  return { branch, commitSha };
}

async function runDeployCommand(task, worktreePath) {
  const deployParts = splitCommandLine(DEPLOY_COMMAND);
  if (!deployParts.length) {
    throw new Error('DEPLOY_COMMAND is empty.');
  }

  return runCommand(deployParts[0], deployParts.slice(1), {
    cwd: worktreePath,
    taskId: task.id,
    timeoutMs: 30 * 60 * 1000,
    label: 'deploy'
  });
}

async function verifyDeployFastForward(task, worktreePath) {
  await git(['fetch', 'origin', GIT_BASE_BRANCH, '--prune'], {
    cwd: REPO_PATH,
    taskId: task.id,
    label: 'git fetch deploy base'
  });
  const headCommitSha = (await git(['rev-parse', 'HEAD'], {
    cwd: worktreePath,
    taskId: task.id,
    label: 'git rev-parse deploy head'
  })).trim();
  const expectedCommitSha = String(task.commitSha || '').trim();
  if (expectedCommitSha && headCommitSha !== expectedCommitSha) {
    throw new Error(`Deploy checkout is at ${headCommitSha}, expected task commit ${expectedCommitSha}.`);
  }

  const previousDeployCommitSha = (await git(['rev-parse', `origin/${GIT_BASE_BRANCH}`], {
    cwd: REPO_PATH,
    taskId: task.id,
    label: 'git rev-parse previous deploy'
  })).trim();
  await git(['merge-base', '--is-ancestor', previousDeployCommitSha, 'HEAD'], {
    cwd: worktreePath,
    taskId: task.id,
    label: 'git verify deploy fast-forward'
  }).catch(() => {
    throw new Error(`Task commit ${headCommitSha} is not a fast-forward from origin/${GIT_BASE_BRANCH}. Rebase or rerun the prompt before deploying.`);
  });

  return {
    previousDeployCommitSha,
    newDeployCommitSha: headCommitSha
  };
}

async function pushWorktreeToMain(task, worktreePath) {
  await git(['push', 'origin', `HEAD:${GIT_BASE_BRANCH}`], {
    cwd: worktreePath,
    taskId: task.id,
    timeoutMs: 10 * 60 * 1000,
    label: 'git push main'
  });
  await git(['fetch', 'origin', GIT_BASE_BRANCH, '--prune'], {
    cwd: REPO_PATH,
    taskId: task.id,
    label: 'git fetch pushed main'
  });
}

async function deployTask(task, worktreePath) {
  if (!DEPLOY_ENABLED) {
    throw new Error('Deployment is disabled. Set DEPLOY_ENABLED=true or AUTO_DEPLOY=true on the worker.');
  }

  const deployRefs = await verifyDeployFastForward(task, worktreePath);
  await installAndCheck(task, worktreePath);
  await pushWorktreeToMain(task, worktreePath);
  const deployOutput = await runDeployCommand(task, worktreePath);
  await recordDeployment({
    action: 'deploy',
    taskId: task.id,
    previousCommitSha: deployRefs.previousDeployCommitSha,
    currentCommitSha: deployRefs.newDeployCommitSha,
    deployUrl: task.deployUrl || ''
  });
  await updateTask(task.id, {
    status: 'deployed',
    previousDeployCommitSha: deployRefs.previousDeployCommitSha,
    newDeployCommitSha: deployRefs.newDeployCommitSha,
    commitSha: deployRefs.newDeployCommitSha,
    deployedAt: Date.now(),
    deployLog: truncateText(deployOutput, 10000),
    summary: 'Deployment completed successfully.'
  });
}

async function rollbackTask(task, worktreePath) {
  if (!DEPLOY_ENABLED) {
    throw new Error('Rollback is disabled. Set DEPLOY_ENABLED=true or AUTO_DEPLOY=true on the worker.');
  }

  const targetCommitSha = String(task.newDeployCommitSha || task.commitSha || '').trim();
  if (!targetCommitSha) {
    throw new Error('Rollback task has no deployed commit SHA.');
  }

  const previousDeployCommitSha = (await git(['rev-parse', 'HEAD'], {
    cwd: worktreePath,
    taskId: task.id,
    label: 'git rev-parse rollback base'
  })).trim();
  await git(['revert', '--no-edit', targetCommitSha], {
    cwd: worktreePath,
    taskId: task.id,
    timeoutMs: 10 * 60 * 1000,
    label: 'git revert deployed task'
  });
  const rollbackCommitSha = (await git(['rev-parse', 'HEAD'], {
    cwd: worktreePath,
    taskId: task.id,
    label: 'git rev-parse rollback'
  })).trim();

  await installAndCheck(task, worktreePath);
  await pushWorktreeToMain(task, worktreePath);
  const deployOutput = await runDeployCommand(task, worktreePath);
  await recordDeployment({
    action: 'rollback',
    taskId: task.id,
    previousCommitSha: previousDeployCommitSha,
    currentCommitSha: rollbackCommitSha,
    rollbackCommitSha,
    deployUrl: task.deployUrl || ''
  });
  await updateTask(task.id, {
    status: 'rolled_back',
    rolledBackAt: Date.now(),
    rollbackCommitSha,
    rollbackLog: truncateText(deployOutput, 10000),
    summary: 'Rollback deployed successfully.'
  });
}

async function handleCodeTask(task) {
  let worktreePath = '';
  try {
    await updateTask(task.id, { status: 'preparing' });
    const worktree = await createCodeWorktree(task);
    worktreePath = worktree.worktreePath;
    const promptPath = await writePromptFile(task, worktreePath);

    await updateTask(task.id, { status: 'coding', branch: worktree.branch });
    const codexOutput = await runCodex(task, worktreePath, promptPath);

    await updateTask(task.id, { status: 'testing', summary: truncateText(codexOutput, 10000) });
    await installAndCheck(task, worktreePath);
    const changedFiles = await enforceAllowlist(task, worktreePath);
    const commit = await commitAndPush(task, worktreePath, worktree.branch, changedFiles);

    if (task.mode === 'auto' && AUTO_DEPLOY) {
      await updateTask(task.id, {
        status: 'deploying',
        branch: commit.branch,
        commitSha: commit.commitSha
      });
      await deployTask({ ...task, branch: commit.branch, commitSha: commit.commitSha }, worktreePath);
    } else {
      const autoDeployNote = task.mode === 'auto' && !AUTO_DEPLOY
        ? ' Auto deploy was requested, but AUTO_DEPLOY is disabled on this worker.'
        : '';
      await updateTask(task.id, {
        status: 'ready_for_review',
        branch: commit.branch,
        commitSha: commit.commitSha,
        summary: `Branch pushed and checks passed.${autoDeployNote}`
      });
    }
  } catch (error) {
    const errorMessage = String(error?.message ?? '');
    const status = /(npm ci|npm run build|diff --check)/u.test(errorMessage) ? 'test_failed' : 'failed';
    await updateTask(task.id, {
      status,
      error: String(error?.stack ?? error)
    }).catch(() => {});
    throw error;
  } finally {
    if (worktreePath) {
      await cleanTaskWorktree(worktreePath, task.id).catch((error) => {
        console.warn('[agent-worker] Worktree cleanup failed.', error);
      });
    }
  }
}

async function handleDeployTask(task) {
  let worktreePath = '';
  try {
    const worktree = await createDeployWorktree(task);
    worktreePath = worktree.worktreePath;
    await deployTask(task, worktreePath);
  } catch (error) {
    await updateTask(task.id, {
      status: 'failed',
      error: String(error?.stack ?? error)
    }).catch(() => {});
    throw error;
  } finally {
    if (worktreePath) {
      await cleanTaskWorktree(worktreePath, task.id).catch((error) => {
        console.warn('[agent-worker] Deploy worktree cleanup failed.', error);
      });
    }
  }
}

async function handleRollbackTask(task) {
  let worktreePath = '';
  try {
    const worktree = await createRollbackWorktree(task);
    worktreePath = worktree.worktreePath;
    await rollbackTask(task, worktreePath);
  } catch (error) {
    await updateTask(task.id, {
      status: 'failed',
      error: String(error?.stack ?? error)
    }).catch(() => {});
    throw error;
  } finally {
    if (worktreePath) {
      await cleanTaskWorktree(worktreePath, task.id).catch((error) => {
        console.warn('[agent-worker] Rollback worktree cleanup failed.', error);
      });
    }
  }
}

async function claimNextTask() {
  return apiRequest('/admin/agent-tasks/next', {
    query: { scope: DEFAULT_SCOPE }
  });
}

async function runIteration() {
  const result = await claimNextTask();
  if (!result.task) {
    return false;
  }

  const task = result.task;
  await appendLog(task.id, `Worker ${WORKER_ID} started ${result.action || 'task'}.`);
  if (result.action === 'deploy') {
    await handleDeployTask(task);
  } else if (result.action === 'rollback') {
    await handleRollbackTask(task);
  } else {
    await handleCodeTask(task);
  }
  return true;
}

function validateConfig() {
  const missing = [];
  if (!API_BASE) {
    missing.push('AGENT_API_BASE');
  }
  if (!WORKER_TOKEN) {
    missing.push('AGENT_WORKER_TOKEN');
  }
  if (!GIT_REMOTE) {
    missing.push('GIT_REMOTE');
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateConfig();
console.log('[agent-worker] Starting StickRPG Codex worker.', {
  workerId: WORKER_ID,
  apiBase: API_BASE,
  workRoot: WORK_ROOT,
  baseBranch: GIT_BASE_BRANCH,
  scope: DEFAULT_SCOPE,
  autoDeploy: AUTO_DEPLOY,
  deployEnabled: DEPLOY_ENABLED,
  runOnce: RUN_ONCE
});

while (true) {
  try {
    const didWork = await runIteration();
    if (RUN_ONCE) {
      process.exit(0);
    }
    if (!didWork) {
      await sleep(Number(process.env.AGENT_POLL_MS || DEFAULT_POLL_MS));
    }
  } catch (error) {
    console.error('[agent-worker] Iteration failed.', error);
    if (RUN_ONCE) {
      process.exitCode = 1;
      break;
    }
    await sleep(Number(process.env.AGENT_ERROR_POLL_MS || 10000));
  }
}
