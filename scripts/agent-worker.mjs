import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  getAgentTaskCommitBody,
  getAgentTaskCommitSubject
} from '../src/shared/agentTaskSummary.js';

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
const BACKEND_DEPLOY_COMMAND = process.env.BACKEND_DEPLOY_COMMAND
  || process.env.COLYSEUS_DEPLOY_COMMAND
  || process.env.DEPLOY_COMMAND
  || 'npm run deploy:colyseus';
const BACKEND_DEPLOY_STRATEGY = String(process.env.BACKEND_DEPLOY_STRATEGY || 'command').trim().toLowerCase();
const FRONTEND_DEPLOY_COMMAND = process.env.FRONTEND_DEPLOY_COMMAND
  || process.env.VERCEL_DEPLOY_COMMAND
  || '';
const BACKEND_VERIFY_URL = String(
  process.env.BACKEND_VERIFY_URL
  || process.env.COLYSEUS_VERIFY_URL
  || (API_BASE ? `${API_BASE}/health` : '')
).trim();
const FRONTEND_VERIFY_URL = String(
  process.env.FRONTEND_VERIFY_URL
  || process.env.FRONTEND_PRODUCTION_URL
  || process.env.PUBLIC_FRONTEND_URL
  || ''
).trim();
const BACKEND_VERIFY_TIMEOUT_MS = getPositiveIntegerEnv('BACKEND_VERIFY_TIMEOUT_MS', 10 * 60 * 1000);
const BACKEND_VERIFY_POLL_MS = getPositiveIntegerEnv('BACKEND_VERIFY_POLL_MS', 10 * 1000);
const BACKEND_VERIFY_REQUEST_TIMEOUT_MS = getPositiveIntegerEnv('BACKEND_VERIFY_REQUEST_TIMEOUT_MS', 20 * 1000);
const FRONTEND_VERIFY_TIMEOUT_MS = getPositiveIntegerEnv('FRONTEND_VERIFY_TIMEOUT_MS', 10 * 60 * 1000);
const FRONTEND_VERIFY_POLL_MS = getPositiveIntegerEnv('FRONTEND_VERIFY_POLL_MS', 10 * 1000);
const FRONTEND_VERIFY_REQUEST_TIMEOUT_MS = getPositiveIntegerEnv('FRONTEND_VERIFY_REQUEST_TIMEOUT_MS', 20 * 1000);
const RUN_ONCE = process.argv.includes('--once');
const RUN_SELF_TEST = process.argv.includes('--self-test');

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

function getPositiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
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

function normalizeStringList(value = []) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[\n,]/u);
  return [...new Set(rawItems
    .map((item) => String(item ?? '').trim())
    .filter(Boolean))];
}

function normalizeChangedFiles(value = []) {
  return normalizeStringList(value)
    .map(normalizeRepoPath)
    .filter(Boolean);
}

function normalizeDeployTargets(value = []) {
  const allowedTargets = new Set(['frontend', 'backend']);
  return normalizeStringList(value)
    .map((target) => target.toLowerCase())
    .filter((target) => allowedTargets.has(target));
}

function inferDeployTargets(changedFiles = []) {
  const targets = new Set();
  for (const filePath of normalizeChangedFiles(changedFiles)) {
    const normalized = filePath.toLowerCase();
    if (normalized === 'package.json' || normalized === 'package-lock.json') {
      targets.add('frontend');
      targets.add('backend');
      continue;
    }

    if (
      normalized === 'index.html'
      || normalized === 'styles.css'
      || normalized === 'vercel.json'
      || normalized === 'scripts/build-web.mjs'
      || normalized.startsWith('src/')
      || normalized.startsWith('assets/')
      || normalized.startsWith('vendor/')
    ) {
      targets.add('frontend');
    }

    if (
      normalized === 'ecosystem.config.cjs'
      || normalized.startsWith('server/')
    ) {
      targets.add('backend');
    }
  }

  return [...targets];
}

function formatDeployTargets(targets = []) {
  const normalizedTargets = normalizeDeployTargets(targets);
  return normalizedTargets.length ? normalizedTargets.join(', ') : 'none';
}

function extractFirstHttpUrl(value = '') {
  return String(value ?? '').match(/https?:\/\/[^\s"'<>]+/u)?.[0] ?? '';
}

function isBackendDeployGitManaged() {
  return ['git', 'git-integration', 'colyseus-git'].includes(BACKEND_DEPLOY_STRATEGY);
}

function getInstallCheckPlan(targets = []) {
  const deployTargets = normalizeDeployTargets(targets);
  const commands = [];
  if (deployTargets.includes('frontend') || deployTargets.includes('backend')) {
    commands.push('npm ci');
  }
  if (deployTargets.includes('frontend')) {
    commands.push('npm run build:web');
  }
  if (deployTargets.includes('backend')) {
    commands.push('npm run build:server');
  }
  commands.push('git diff --check');
  return commands;
}

function summarizeDeployResult(actionLabel, targets = []) {
  const deployTargets = normalizeDeployTargets(targets);
  if (deployTargets.length === 0) {
    return `${actionLabel} completed; no runtime deploy target was inferred.`;
  }
  if (deployTargets.includes('frontend') && !FRONTEND_DEPLOY_COMMAND.trim()) {
    return `${actionLabel} completed for ${formatDeployTargets(deployTargets)}; Vercel Git integration handled frontend deploy and the served commit was verified.`;
  }
  return `${actionLabel} completed for ${formatDeployTargets(deployTargets)}.`;
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
    const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return {
      command: process.execPath,
      args: [
        path.join(appDataPath, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js'),
        ...args
      ]
    };
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
  const baseBranch = String(task.baseBranch || '').trim();
  const baseRef = baseBranch ? `origin/${baseBranch}` : `origin/${GIT_BASE_BRANCH}`;
  if (baseBranch) {
    await git(['fetch', 'origin', `+refs/heads/${baseBranch}:refs/remotes/origin/${baseBranch}`], {
      cwd: REPO_PATH,
      taskId: task.id,
      label: 'git fetch thread base'
    });
  }
  await cleanTaskWorktree(worktreePath, task.id);
  await git(['worktree', 'add', '-B', branch, worktreePath, baseRef], {
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

function formatThreadHistoryForPrompt(history = []) {
  if (!Array.isArray(history) || history.length === 0) {
    return 'No prior thread messages.';
  }

  return history.map((entry, index) => {
    const prompt = truncateText(entry?.prompt ?? '', 1200);
    const agentMessage = truncateText(entry?.agentMessage || entry?.summary || entry?.error || '', 1600);
    const metadata = [
      entry?.status ? `status=${entry.status}` : '',
      entry?.branch ? `branch=${entry.branch}` : '',
      entry?.commitSha ? `commit=${String(entry.commitSha).slice(0, 12)}` : ''
    ].filter(Boolean).join(', ');
    return [
      `Thread turn ${index + 1}${metadata ? ` (${metadata})` : ''}:`,
      prompt ? `Admin asked:\n${indentBlock(prompt)}` : '',
      agentMessage ? `Agent replied:\n${indentBlock(agentMessage)}` : ''
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function extractCodexSessionId(output = '') {
  const match = String(output ?? '').match(/session id:\s*([0-9a-f-]{20,})/iu);
  return match?.[1] ?? '';
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
- Thread ID: ${task.threadId || task.id}
- Parent task: ${task.parentTaskId || 'none'}
- Base branch: ${task.baseBranch || `origin/${GIT_BASE_BRANCH}`}

Ongoing thread context:
${formatThreadHistoryForPrompt(task.threadHistory)}

Runtime snapshot:
\`\`\`json
${JSON.stringify(task.snapshot ?? null, null, 2)}
\`\`\`

Expected behavior:
- Implement the requested game change.
- Keep the game polished and playable.
- Preserve unrelated features.
- Add or update focused validation where useful.
- Run or prepare for \`npm run build:all\`.

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
  const lastMessagePath = path.join(worktreePath, '.codex', 'agent-task-last-message.md');
  const configuredArgs = process.env.CODEX_EXEC_ARGS
    ? splitCommandLine(process.env.CODEX_EXEC_ARGS).map((arg) => arg.replaceAll('{worktree}', worktreePath))
    : ['exec', '--full-auto', '--sandbox', 'workspace-write', '-C', worktreePath, '-o', lastMessagePath];

  const output = await runCommand(process.env.CODEX_COMMAND || 'codex', configuredArgs, {
    cwd: worktreePath,
    input: prompt,
    timeoutMs: CODEX_TIMEOUT_MS,
    taskId: task.id,
    label: 'codex exec'
  });
  const lastMessage = await fsp.readFile(lastMessagePath, 'utf8')
    .then((text) => truncateText(text.trim(), 10000))
    .catch(() => '');
  return {
    output,
    lastMessage,
    sessionId: extractCodexSessionId(output)
  };
}

async function installAndCheck(task, worktreePath, {
  targets = []
} = {}) {
  const plan = getInstallCheckPlan(targets);
  if (plan.includes('npm ci')) {
    await runCommand('npm', ['ci'], {
      cwd: worktreePath,
      taskId: task.id,
      timeoutMs: 15 * 60 * 1000,
      label: 'npm ci'
    });
  }
  if (plan.includes('npm run build:web')) {
    await runCommand('npm', ['run', 'build:web'], {
      cwd: worktreePath,
      taskId: task.id,
      timeoutMs: 15 * 60 * 1000,
      label: 'npm run build:web'
    });
  }
  if (plan.includes('npm run build:server')) {
    await runCommand('npm', ['run', 'build:server'], {
      cwd: worktreePath,
      taskId: task.id,
      timeoutMs: 15 * 60 * 1000,
      label: 'npm run build:server'
    });
  }
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
  return normalizeChangedFiles([...new Set(`${trackedOutput}\n${untrackedOutput}`
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('warning:'))
    .filter(Boolean))]);
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

function assertAllowedChangedFiles(changedFiles = []) {
  const disallowed = normalizeChangedFiles(changedFiles)
    .filter((filePath) => !isAllowedChangedFile(filePath));
  if (disallowed.length > 0) {
    throw new Error(`Deploy diff includes files outside the allowlist: ${disallowed.join(', ')}`);
  }
}

async function commitAndPush(task, worktreePath, branch, changedFiles) {
  await git(['add', '--', ...changedFiles], {
    cwd: worktreePath,
    taskId: task.id,
    label: 'git add'
  });
  await git([
    'commit',
    '-m',
    getAgentTaskCommitSubject(task),
    '-m',
    getAgentTaskCommitBody(task, changedFiles)
  ], {
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

async function getDiffChangedFiles(worktreePath, fromRef, toRef = 'HEAD') {
  const diffOutput = await git(['diff', '--name-only', fromRef, toRef, '--'], {
    cwd: worktreePath,
    label: 'git diff deploy changed files'
  });
  return normalizeChangedFiles(diffOutput
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith('warning:')));
}

async function getDeployChangedFiles(task, worktreePath, fromRef) {
  const taskChangedFiles = normalizeChangedFiles(task.changedFiles);
  if (taskChangedFiles.length > 0) {
    return taskChangedFiles;
  }

  if (!fromRef) {
    return [];
  }

  return getDiffChangedFiles(worktreePath, fromRef, 'HEAD');
}

async function runDeployCommand(task, worktreePath, {
  command = '',
  label = 'deploy'
} = {}) {
  const deployParts = splitCommandLine(command);
  if (!deployParts.length) {
    throw new Error(`${label} command is empty.`);
  }

  return runCommand(deployParts[0], deployParts.slice(1), {
    cwd: worktreePath,
    taskId: task.id,
    timeoutMs: 30 * 60 * 1000,
    label
  });
}

function normalizeHttpUrl(value = '') {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    return '';
  }

  try {
    const url = new URL(rawValue);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

async function getFrontendVerifyUrl(worktreePath) {
  const configuredUrl = normalizeHttpUrl(FRONTEND_VERIFY_URL);
  if (configuredUrl) {
    return configuredUrl;
  }

  try {
    const packageJson = JSON.parse(await fsp.readFile(path.join(worktreePath, 'package.json'), 'utf8'));
    return normalizeHttpUrl(packageJson.homepage);
  } catch {
    return '';
  }
}

function withVerifyCacheBuster(urlString) {
  const url = new URL(urlString);
  url.searchParams.set('_stickrpg_verify', `${Date.now()}`);
  return url.toString();
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'cache-control': 'no-cache',
        pragma: 'no-cache'
      }
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }

    return {
      text,
      url: response.url || url,
      etag: response.headers.get('etag') || '',
      cacheControl: response.headers.get('cache-control') || ''
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, timeoutMs) {
  const result = await fetchText(url, timeoutMs);
  return {
    ...result,
    json: JSON.parse(result.text)
  };
}

function extractHtmlAssetUrls(html = '', baseUrl = '') {
  const assets = [];
  for (const match of String(html).matchAll(/(?:src|href)="([^"]+)"/gu)) {
    const assetPath = match[1] ?? '';
    if (!/\.(?:js|css)(?:\?|$)/u.test(assetPath)) {
      continue;
    }

    try {
      assets.push(new URL(assetPath, baseUrl).toString());
    } catch {
      assets.push(assetPath);
    }
  }

  return [...new Set(assets)];
}

async function verifyFrontendDeployment(task, worktreePath, {
  expectedCommitSha = '',
  actionLabel = 'Deployment'
} = {}) {
  const commitSha = String(expectedCommitSha || '').trim();
  const verifyUrl = await getFrontendVerifyUrl(worktreePath);
  if (!verifyUrl) {
    const message = 'Frontend deployment verification skipped; no FRONTEND_VERIFY_URL or package homepage is configured.';
    await appendLog(task.id, message, { level: 'warn' });
    return { deployUrl: '', output: message };
  }

  if (!commitSha) {
    const message = 'Frontend deployment verification skipped; expected commit SHA is missing.';
    await appendLog(task.id, message, {
      level: 'warn',
      data: { verifyUrl }
    });
    return { deployUrl: verifyUrl, output: message };
  }

  const startedAt = Date.now();
  const deadline = startedAt + FRONTEND_VERIFY_TIMEOUT_MS;
  let attempt = 0;
  let lastError = '';
  let lastAssets = [];
  let lastEtag = '';
  while (Date.now() <= deadline) {
    attempt += 1;
    try {
      const result = await fetchText(withVerifyCacheBuster(verifyUrl), FRONTEND_VERIFY_REQUEST_TIMEOUT_MS);
      lastEtag = result.etag;
      lastAssets = extractHtmlAssetUrls(result.text, result.url);
      if (result.text.includes(commitSha)) {
        const message = `${actionLabel} verified: frontend is serving commit ${commitSha.slice(0, 12)}.`;
        await appendLog(task.id, message, {
          data: {
            verifyUrl,
            responseUrl: result.url,
            expectedCommitSha: commitSha,
            attempts: attempt,
            etag: result.etag,
            cacheControl: result.cacheControl,
            assets: lastAssets.slice(0, 8)
          }
        });
        return {
          deployUrl: verifyUrl,
          output: [
            message,
            `URL: ${verifyUrl}`,
            `Attempts: ${attempt}`,
            result.etag ? `ETag: ${result.etag}` : '',
            lastAssets.length ? `Assets: ${lastAssets.slice(0, 8).join(', ')}` : ''
          ].filter(Boolean).join('\n')
        };
      }

      lastError = `expected commit ${commitSha} was not found in HTML`;
    } catch (error) {
      lastError = error?.message || String(error);
    }

    if (Date.now() + FRONTEND_VERIFY_POLL_MS > deadline) {
      break;
    }
    await sleep(FRONTEND_VERIFY_POLL_MS);
  }

  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  throw new Error(`${actionLabel} frontend verification timed out after ${elapsedSeconds}s at ${verifyUrl}: ${lastError}${lastEtag ? `; last etag ${lastEtag}` : ''}${lastAssets.length ? `; last assets ${lastAssets.slice(0, 5).join(', ')}` : ''}`);
}

async function verifyBackendDeployment(task, {
  expectedCommitSha = '',
  actionLabel = 'Deployment'
} = {}) {
  const commitSha = String(expectedCommitSha || '').trim();
  const verifyUrl = normalizeHttpUrl(BACKEND_VERIFY_URL);
  if (!verifyUrl) {
    const message = 'Backend deployment verification skipped; no BACKEND_VERIFY_URL or AGENT_API_BASE is configured.';
    await appendLog(task.id, message, { level: 'warn' });
    return { deployUrl: '', output: message };
  }

  if (!commitSha) {
    const message = 'Backend deployment verification skipped; expected commit SHA is missing.';
    await appendLog(task.id, message, {
      level: 'warn',
      data: { verifyUrl }
    });
    return { deployUrl: verifyUrl, output: message };
  }

  const startedAt = Date.now();
  const deadline = startedAt + BACKEND_VERIFY_TIMEOUT_MS;
  let attempt = 0;
  let lastError = '';
  while (Date.now() <= deadline) {
    attempt += 1;
    try {
      const result = await fetchJson(withVerifyCacheBuster(verifyUrl), BACKEND_VERIFY_REQUEST_TIMEOUT_MS);
      const servedCommitSha = String(
        result.json?.commitSha
        || result.json?.buildCommitSha
        || ''
      ).trim();
      if (!servedCommitSha) {
        const message = `${actionLabel} backend verification skipped; health endpoint does not expose a commit SHA yet.`;
        await appendLog(task.id, message, {
          level: 'warn',
          data: {
            verifyUrl,
            responseUrl: result.url,
            expectedCommitSha: commitSha,
            attempts: attempt
          }
        });
        return { deployUrl: verifyUrl, output: message };
      }

      if (servedCommitSha === commitSha || servedCommitSha.startsWith(commitSha) || commitSha.startsWith(servedCommitSha)) {
        const message = `${actionLabel} verified: backend is serving commit ${servedCommitSha.slice(0, 12)}.`;
        await appendLog(task.id, message, {
          data: {
            verifyUrl,
            responseUrl: result.url,
            expectedCommitSha: commitSha,
            servedCommitSha,
            attempts: attempt,
            persistenceMode: result.json?.persistenceMode ?? '',
            playerSnapshotPersistenceMode: result.json?.playerSnapshotPersistenceMode ?? ''
          }
        });
        return {
          deployUrl: verifyUrl,
          output: [
            message,
            `URL: ${verifyUrl}`,
            `Attempts: ${attempt}`,
            result.json?.persistenceMode ? `World persistence: ${result.json.persistenceMode}` : '',
            result.json?.playerSnapshotPersistenceMode ? `Player snapshots: ${result.json.playerSnapshotPersistenceMode}` : ''
          ].filter(Boolean).join('\n')
        };
      }

      lastError = `expected commit ${commitSha.slice(0, 12)}, saw ${servedCommitSha.slice(0, 12)}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }

    if (Date.now() + BACKEND_VERIFY_POLL_MS > deadline) {
      break;
    }
    await sleep(BACKEND_VERIFY_POLL_MS);
  }

  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  throw new Error(`${actionLabel} backend verification timed out after ${elapsedSeconds}s at ${verifyUrl}: ${lastError}`);
}

async function runDeployTargets(task, worktreePath, targets = [], {
  expectedCommitSha = '',
  actionLabel = 'Deployment'
} = {}) {
  const deployTargets = normalizeDeployTargets(targets);
  const outputs = [];
  let deployUrl = '';

  if (deployTargets.includes('frontend')) {
    if (FRONTEND_DEPLOY_COMMAND.trim()) {
      const output = await runDeployCommand(task, worktreePath, {
        command: FRONTEND_DEPLOY_COMMAND,
        label: 'frontend deploy'
      });
      deployUrl = extractFirstHttpUrl(output) || deployUrl;
      outputs.push(`[frontend]\n${output.trim()}`);
    } else {
      const message = 'Frontend deploy is handled by Vercel Git integration after the main branch push.';
      await appendLog(task.id, message, {
        data: { target: 'frontend' }
      });
      outputs.push(`[frontend]\n${message}`);
    }

    const verification = await verifyFrontendDeployment(task, worktreePath, {
      expectedCommitSha,
      actionLabel
    });
    deployUrl = verification.deployUrl || deployUrl;
    if (verification.output) {
      outputs.push(`[frontend verify]\n${verification.output}`);
    }
  }

  if (deployTargets.includes('backend')) {
    if (isBackendDeployGitManaged()) {
      const message = 'Backend deploy is handled by Colyseus Git integration after the main branch push.';
      await appendLog(task.id, message, {
        data: { target: 'backend', backendDeployStrategy: BACKEND_DEPLOY_STRATEGY }
      });
      outputs.push(`[backend]\n${message}`);
    } else {
      const output = await runDeployCommand(task, worktreePath, {
        command: BACKEND_DEPLOY_COMMAND,
        label: 'backend deploy'
      });
      outputs.push(`[backend]\n${output.trim()}`);
    }

    const verification = await verifyBackendDeployment(task, {
      expectedCommitSha,
      actionLabel
    });
    if (verification.deployUrl && !deployUrl) {
      deployUrl = verification.deployUrl;
    }
    if (verification.output) {
      outputs.push(`[backend verify]\n${verification.output}`);
    }
  }

  if (outputs.length === 0) {
    const message = 'No frontend or backend deploy target was inferred; main branch push completed without a runtime deploy command.';
    await appendLog(task.id, message);
    outputs.push(message);
  }

  return {
    deployUrl,
    output: outputs.join('\n\n')
  };
}

async function isAncestor(worktreePath, ancestorRef, descendantRef = 'HEAD', taskId = '') {
  return git(['merge-base', '--is-ancestor', ancestorRef, descendantRef], {
    cwd: worktreePath,
    taskId,
    label: 'git verify deploy ancestry'
  }).then(() => true).catch(() => false);
}

async function commitExists(worktreePath, commitSha = '', taskId = '') {
  const normalizedCommitSha = String(commitSha || '').trim();
  if (!normalizedCommitSha) {
    return false;
  }

  return git(['cat-file', '-e', `${normalizedCommitSha}^{commit}`], {
    cwd: worktreePath,
    taskId,
    label: 'git verify expected commit'
  }).then(() => true).catch(() => false);
}

async function pushRebasedTaskBranch(task, worktreePath, branch = '') {
  const normalizedBranch = String(branch || task.branch || '').trim();
  if (!normalizedBranch) {
    return;
  }

  await git(['push', '--force-with-lease', 'origin', `HEAD:${normalizedBranch}`], {
    cwd: worktreePath,
    taskId: task.id,
    timeoutMs: 10 * 60 * 1000,
    label: 'git push rebased task branch'
  });
}

async function prepareDeployCommit(task, worktreePath) {
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
  const taskBranchCommitChanged = Boolean(expectedCommitSha && headCommitSha !== expectedCommitSha);
  if (expectedCommitSha && headCommitSha !== expectedCommitSha) {
    const expectedExists = await commitExists(worktreePath, expectedCommitSha, task.id);
    const expectedIsAncestor = expectedExists
      ? await isAncestor(worktreePath, expectedCommitSha, 'HEAD', task.id)
      : false;
    const headSubject = (await git(['log', '-1', '--format=%s'], {
      cwd: worktreePath,
      taskId: task.id,
      label: 'git read deploy head subject'
    })).trim();
    const expectedSubjects = new Set([
      `Agent task ${task.id}`,
      getAgentTaskCommitSubject(task)
    ]);
    if (!expectedIsAncestor && !expectedSubjects.has(headSubject)) {
      throw new Error(`Deploy checkout is at ${headCommitSha}, expected task commit ${expectedCommitSha}.`);
    }

    await appendLog(task.id, 'Task branch head differs from stored commit; using verified branch head for deploy.', {
      level: 'warn',
      data: {
        storedCommitSha: expectedCommitSha,
        branchHeadCommitSha: headCommitSha,
        expectedCommitFound: expectedExists,
        storedCommitIsAncestor: expectedIsAncestor
      }
    });
  }

  const previousDeployCommitSha = (await git(['rev-parse', `origin/${GIT_BASE_BRANCH}`], {
    cwd: REPO_PATH,
    taskId: task.id,
    label: 'git rev-parse previous deploy'
  })).trim();

  const alreadyCurrent = await isAncestor(worktreePath, previousDeployCommitSha, 'HEAD', task.id);
  if (alreadyCurrent) {
    const changedFiles = taskBranchCommitChanged
      ? await getDiffChangedFiles(worktreePath, previousDeployCommitSha, 'HEAD')
      : await getDeployChangedFiles(task, worktreePath, previousDeployCommitSha);
    assertAllowedChangedFiles(changedFiles);
    return {
      previousDeployCommitSha,
      newDeployCommitSha: headCommitSha,
      changedFiles,
      rebased: false,
      taskBranchCommitChanged
    };
  }

  await appendLog(task.id, `Task commit is behind origin/${GIT_BASE_BRANCH}; rebasing before deploy.`, {
    data: {
      baseBranch: GIT_BASE_BRANCH,
      previousDeployCommitSha,
      taskCommitSha: headCommitSha
    }
  });

  try {
    await git(['rebase', `origin/${GIT_BASE_BRANCH}`], {
      cwd: worktreePath,
      taskId: task.id,
      timeoutMs: 10 * 60 * 1000,
      label: 'git rebase deploy task'
    });
  } catch (error) {
    await git(['rebase', '--abort'], {
      cwd: worktreePath,
      taskId: task.id,
      label: 'git rebase abort'
    }).catch(() => {});
    throw new Error(`Task commit ${headCommitSha} could not be automatically rebased onto origin/${GIT_BASE_BRANCH}. Rerun the prompt or resolve the task branch conflicts before approving deploy again.\n${error?.message ?? error}`);
  }

  const rebasedCommitSha = (await git(['rev-parse', 'HEAD'], {
    cwd: worktreePath,
    taskId: task.id,
    label: 'git rev-parse rebased deploy head'
  })).trim();
  const changedFiles = await getDiffChangedFiles(worktreePath, previousDeployCommitSha, 'HEAD');
  assertAllowedChangedFiles(changedFiles);
  await appendLog(task.id, `Task branch rebased onto latest origin/${GIT_BASE_BRANCH}.`, {
    data: {
      previousCommitSha: headCommitSha,
      rebasedCommitSha,
      changedFiles
    }
  });

  return {
    previousDeployCommitSha,
    newDeployCommitSha: rebasedCommitSha,
    changedFiles,
    rebased: true,
    taskBranchCommitChanged: true
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

  const deployRefs = await prepareDeployCommit(task, worktreePath);
  const changedFiles = normalizeChangedFiles(deployRefs.changedFiles);
  const deployTargets = normalizeDeployTargets(task.deployTargets);
  const inferredTargets = deployTargets.length > 0 ? deployTargets : inferDeployTargets(changedFiles);
  await appendLog(task.id, `Deploy targets: ${formatDeployTargets(inferredTargets)}.`, {
    data: {
      deployTargets: inferredTargets,
      changedFiles
    }
  });
  await installAndCheck(task, worktreePath, { targets: inferredTargets });
  if (deployRefs.rebased) {
    await pushRebasedTaskBranch(task, worktreePath);
  }
  if (deployRefs.rebased || deployRefs.taskBranchCommitChanged) {
    await updateTask(task.id, {
      branch: String(task.branch || '').trim(),
      commitSha: deployRefs.newDeployCommitSha,
      changedFiles,
      deployTargets: inferredTargets,
      summary: deployRefs.rebased
        ? `Task branch rebased onto latest ${GIT_BASE_BRANCH}; checks passed and deploy is continuing.`
        : 'Task branch head verified; checks passed and deploy is continuing.'
    });
  }
  await pushWorktreeToMain(task, worktreePath);
  const deployResult = await runDeployTargets(task, worktreePath, inferredTargets, {
    expectedCommitSha: deployRefs.newDeployCommitSha,
    actionLabel: 'Deployment'
  });
  await recordDeployment({
    action: 'deploy',
    taskId: task.id,
    previousCommitSha: deployRefs.previousDeployCommitSha,
    currentCommitSha: deployRefs.newDeployCommitSha,
    deployUrl: deployResult.deployUrl || task.deployUrl || '',
    deployTargets: inferredTargets
  });
  await updateTask(task.id, {
    status: 'deployed',
    previousDeployCommitSha: deployRefs.previousDeployCommitSha,
    newDeployCommitSha: deployRefs.newDeployCommitSha,
    commitSha: deployRefs.newDeployCommitSha,
    deployedAt: Date.now(),
    changedFiles,
    deployTargets: inferredTargets,
    deployUrl: deployResult.deployUrl || task.deployUrl || '',
    deployLog: truncateText(deployResult.output, 10000),
    summary: summarizeDeployResult('Deployment', inferredTargets)
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
  const changedFiles = normalizeChangedFiles(task.changedFiles).length > 0
    ? normalizeChangedFiles(task.changedFiles)
    : await getDiffChangedFiles(worktreePath, previousDeployCommitSha, 'HEAD');
  const deployTargets = normalizeDeployTargets(task.deployTargets);
  const inferredTargets = deployTargets.length > 0 ? deployTargets : inferDeployTargets(changedFiles);
  await appendLog(task.id, `Rollback deploy targets: ${formatDeployTargets(inferredTargets)}.`, {
    level: 'warn',
    data: {
      deployTargets: inferredTargets,
      changedFiles
    }
  });

  await installAndCheck(task, worktreePath, { targets: inferredTargets });
  await pushWorktreeToMain(task, worktreePath);
  const deployResult = await runDeployTargets(task, worktreePath, inferredTargets, {
    expectedCommitSha: rollbackCommitSha,
    actionLabel: 'Rollback deploy'
  });
  await recordDeployment({
    action: 'rollback',
    taskId: task.id,
    previousCommitSha: previousDeployCommitSha,
    currentCommitSha: rollbackCommitSha,
    rollbackCommitSha,
    deployUrl: deployResult.deployUrl || task.deployUrl || '',
    deployTargets: inferredTargets
  });
  await updateTask(task.id, {
    status: 'rolled_back',
    rolledBackAt: Date.now(),
    rollbackCommitSha,
    deployTargets: inferredTargets,
    deployUrl: deployResult.deployUrl || task.deployUrl || '',
    rollbackLog: truncateText(deployResult.output, 10000),
    summary: summarizeDeployResult('Rollback deploy', inferredTargets)
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
    const codexResult = await runCodex(task, worktreePath, promptPath);

    await updateTask(task.id, {
      status: 'testing',
      summary: truncateText(codexResult.output, 10000),
      agentMessage: codexResult.lastMessage || truncateText(codexResult.output, 4000),
      codexSessionId: codexResult.sessionId
    });
    const changedFiles = await enforceAllowlist(task, worktreePath);
    const deployTargets = inferDeployTargets(changedFiles);
    await installAndCheck(task, worktreePath, { targets: deployTargets });
    const commit = await commitAndPush(task, worktreePath, worktree.branch, changedFiles);

    if (task.mode === 'auto' && AUTO_DEPLOY) {
      await updateTask(task.id, {
        status: 'deploying',
        branch: commit.branch,
        commitSha: commit.commitSha,
        changedFiles,
        deployTargets
      });
      await deployTask({
        ...task,
        branch: commit.branch,
        commitSha: commit.commitSha,
        changedFiles,
        deployTargets
      }, worktreePath);
    } else {
      const autoDeployNote = task.mode === 'auto' && !AUTO_DEPLOY
        ? ' Auto deploy was requested, but AUTO_DEPLOY is disabled on this worker.'
        : '';
      await updateTask(task.id, {
        status: 'ready_for_review',
        branch: commit.branch,
        commitSha: commit.commitSha,
        changedFiles,
        deployTargets,
        summary: `Branch pushed and checks passed. Deploy targets: ${formatDeployTargets(deployTargets)}.${autoDeployNote}`
      });
    }
  } catch (error) {
    const errorMessage = String(error?.message ?? '');
    const status = /(npm ci|npm run build:(?:web|server)|diff --check)/u.test(errorMessage) ? 'test_failed' : 'failed';
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
    query: {
      scope: DEFAULT_SCOPE,
      deployEnabled: DEPLOY_ENABLED ? '1' : '0'
    }
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

function assertSelfTestEqual(actual, expected, label) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) {
    throw new Error(`${label}: expected ${expectedText}, received ${actualText}`);
  }
}

function getSimulatedDeployPlan(changedFiles = []) {
  const deployTargets = inferDeployTargets(changedFiles);
  return {
    changedFiles: normalizeChangedFiles(changedFiles),
    deployTargets,
    checks: getInstallCheckPlan(deployTargets),
    frontendDeploy: deployTargets.includes('frontend')
      ? (FRONTEND_DEPLOY_COMMAND.trim() ? 'command' : 'git-integration')
      : 'none',
    backendDeploy: deployTargets.includes('backend')
      ? (isBackendDeployGitManaged() ? 'git-integration' : 'command')
      : 'none',
    backendVerify: deployTargets.includes('backend')
      ? (normalizeHttpUrl(BACKEND_VERIFY_URL) ? 'enabled' : 'missing')
      : 'none'
  };
}

function runSelfTest() {
  const scenarios = [
    {
      label: 'frontend-only',
      changedFiles: ['src/ui/Hud.js', 'styles.css'],
      deployTargets: ['frontend'],
      checks: ['npm ci', 'npm run build:web', 'git diff --check'],
      frontendDeploy: FRONTEND_DEPLOY_COMMAND.trim() ? 'command' : 'git-integration',
      backendDeploy: 'none'
    },
    {
      label: 'backend-only',
      changedFiles: ['server/src/WorldRoom.js'],
      deployTargets: ['backend'],
      checks: ['npm ci', 'npm run build:server', 'git diff --check'],
      frontendDeploy: 'none',
      backendDeploy: isBackendDeployGitManaged() ? 'git-integration' : 'command'
    },
    {
      label: 'mixed',
      changedFiles: ['src/game/Game.js', 'server/src/WorldRoom.js'],
      deployTargets: ['frontend', 'backend'],
      checks: ['npm ci', 'npm run build:web', 'npm run build:server', 'git diff --check'],
      frontendDeploy: FRONTEND_DEPLOY_COMMAND.trim() ? 'command' : 'git-integration',
      backendDeploy: isBackendDeployGitManaged() ? 'git-integration' : 'command'
    },
    {
      label: 'docs-only',
      changedFiles: ['docs/admin-codex-worker.md'],
      deployTargets: [],
      checks: ['git diff --check'],
      frontendDeploy: 'none',
      backendDeploy: 'none'
    }
  ];

  const output = scenarios.map((scenario) => {
    const plan = getSimulatedDeployPlan(scenario.changedFiles);
    assertSelfTestEqual(plan.deployTargets, scenario.deployTargets, `${scenario.label} deploy targets`);
    assertSelfTestEqual(plan.checks, scenario.checks, `${scenario.label} checks`);
    assertSelfTestEqual(plan.frontendDeploy, scenario.frontendDeploy, `${scenario.label} frontend deploy`);
    assertSelfTestEqual(plan.backendDeploy, scenario.backendDeploy, `${scenario.label} backend deploy`);
    return {
      label: scenario.label,
      deployTargets: plan.deployTargets,
      checks: plan.checks,
      frontendDeploy: plan.frontendDeploy,
      backendDeploy: plan.backendDeploy,
      backendVerify: plan.backendVerify
    };
  });

  console.log(JSON.stringify({
    ok: true,
    workerMode: {
      backendDeployStrategy: BACKEND_DEPLOY_STRATEGY,
      backendVerifyUrl: normalizeHttpUrl(BACKEND_VERIFY_URL) ? 'configured' : 'missing',
      frontendDeployCommand: FRONTEND_DEPLOY_COMMAND.trim() ? 'configured' : 'git-integration',
      frontendVerifyUrl: normalizeHttpUrl(FRONTEND_VERIFY_URL) ? 'configured' : 'package-homepage'
    },
    scenarios: output
  }, null, 2));
}

if (RUN_SELF_TEST) {
  runSelfTest();
  process.exit(0);
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
  backendDeployCommand: BACKEND_DEPLOY_COMMAND ? 'configured' : 'missing',
  backendDeployStrategy: BACKEND_DEPLOY_STRATEGY,
  backendVerifyUrl: BACKEND_VERIFY_URL ? 'configured' : 'missing',
  frontendDeployCommand: FRONTEND_DEPLOY_COMMAND ? 'configured' : 'git-integration',
  frontendVerifyUrl: FRONTEND_VERIFY_URL ? 'configured' : 'package-homepage',
  frontendVerifyTimeoutMs: FRONTEND_VERIFY_TIMEOUT_MS,
  runOnce: RUN_ONCE,
  selfTest: RUN_SELF_TEST
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
