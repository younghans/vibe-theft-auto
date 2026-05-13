import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  getAgentTaskCommitBody,
  getAgentTaskCommitSubject
} from '../src/shared/agentTaskSummary.js';

const LOCAL_REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
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
const WORKER_LOG_ROOT = path.resolve(process.env.AGENT_WORKER_LOG_ROOT || path.join(WORK_ROOT, 'logs'));
const GIT_REMOTE = String(process.env.GIT_REMOTE || '');
const GIT_COMMAND = String(process.env.GIT_COMMAND || 'git').trim() || 'git';
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
const STALE_DEPLOY_RECONCILE_AFTER_MS = getPositiveIntegerEnv('AGENT_DEPLOY_RECONCILE_AFTER_MS', 15 * 60 * 1000);
const CODE_CONCURRENCY = getNonNegativeIntegerEnv('AGENT_CODE_CONCURRENCY', 2);
const REQUESTED_DEPLOY_CONCURRENCY = getNonNegativeIntegerEnv('AGENT_DEPLOY_CONCURRENCY', 1);
const DEPLOY_CONCURRENCY = DEPLOY_ENABLED ? Math.min(REQUESTED_DEPLOY_CONCURRENCY, 1) : 0;
const DEPLOY_REBASE_REPAIR_ATTEMPTS = getNonNegativeIntegerEnv('AGENT_DEPLOY_REBASE_REPAIR_ATTEMPTS', 2);
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

function getNonNegativeIntegerEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function truncateText(value = '', maxLength = 6000) {
  const text = String(value ?? '');
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 24))}\n...[truncated]`;
}

function getErrorDiagnostic(error) {
  return {
    name: String(error?.name ?? 'Error'),
    message: truncateText(error?.message ?? String(error ?? ''), 2000),
    stack: truncateText(error?.stack ?? '', 6000),
    code: error?.code == null ? '' : String(error.code),
    status: error?.status == null ? '' : String(error.status)
  };
}

function sanitizeDiagnosticValue(value, key = '', depth = 0) {
  if (/token|secret|password|credential|authorization|adminKey|workerToken/iu.test(key)) {
    return '<redacted>';
  }
  if (value == null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return truncateText(value, 2000);
  }
  if (value instanceof Error) {
    return getErrorDiagnostic(value);
  }
  if (depth >= 4) {
    return '[max-depth]';
  }
  if (Array.isArray(value)) {
    return value.slice(0, 40).map((item) => sanitizeDiagnosticValue(item, '', depth + 1));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 60).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeDiagnosticValue(entryValue, entryKey, depth + 1)
    ]));
  }
  return String(value);
}

function getWorkerLogPath(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return path.join(WORKER_LOG_ROOT, `agent-worker-${day}.jsonl`);
}

async function writeWorkerDiagnostic(level = 'info', event = '', data = {}) {
  try {
    await fsp.mkdir(WORKER_LOG_ROOT, { recursive: true });
    const entry = {
      at: new Date().toISOString(),
      level,
      event,
      workerId: WORKER_ID,
      pid: process.pid,
      data: sanitizeDiagnosticValue(data)
    };
    await fsp.appendFile(getWorkerLogPath(), `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (error) {
    console.warn('[agent-worker] Could not write worker diagnostic log.', error);
  }
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

function mergeChangedFiles(...values) {
  return normalizeChangedFiles(values.flatMap((value) => (
    Array.isArray(value) ? value : String(value ?? '').split(/[\n,]/u)
  )));
}

function normalizeDeployTargets(value = []) {
  const allowedTargets = new Set(['frontend', 'backend']);
  return normalizeStringList(value)
    .map((target) => target.toLowerCase())
    .filter((target) => allowedTargets.has(target));
}

function mergeDeployTargets(...values) {
  return normalizeDeployTargets(values.flatMap((value) => (
    Array.isArray(value) ? value : String(value ?? '').split(/[\n,]/u)
  )));
}

function isBackendSharedSourcePath(normalizedPath = '') {
  return normalizedPath.startsWith('src/shared/')
    || normalizedPath.startsWith('src/npc/')
    || normalizedPath.startsWith('src/player/')
    || normalizedPath.startsWith('src/world/');
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
      || isBackendSharedSourcePath(normalized)
    ) {
      targets.add('backend');
    }
  }

  return [...targets];
}

function resolveDeployTargets(changedFiles = [], recordedTargets = []) {
  return mergeDeployTargets(recordedTargets, inferDeployTargets(changedFiles));
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
    await writeWorkerDiagnostic('error', 'api_request_failed', {
      endpoint,
      method,
      responseStatus: response.status,
      responseError: payload?.error || '',
      responsePayload: payload
    });
    const error = new Error(payload?.error || `API request failed: ${response.status}`);
    error.status = response.status;
    throw error;
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
    await writeWorkerDiagnostic('warn', 'append_task_log_failed', {
      taskId,
      message,
      level,
      error: getErrorDiagnostic(error)
    });
  }
}

async function recordDeployment(payload = {}) {
  return apiRequest('/admin/agent-deployments', {
    method: 'PATCH',
    body: payload
  });
}

async function recordTaskFailure(task = {}, phase = 'task', error = null, details = {}) {
  const taskId = String(task?.id ?? '').trim();
  const diagnostic = sanitizeDiagnosticValue({
    phase,
    taskId,
    status: task?.status ?? '',
    branch: task?.branch ?? '',
    commitSha: task?.commitSha ?? '',
    deployTargets: task?.deployTargets ?? [],
    changedFiles: task?.changedFiles ?? [],
    workerId: WORKER_ID,
    workRoot: WORK_ROOT,
    repoPath: REPO_PATH,
    baseBranch: GIT_BASE_BRANCH,
    details,
    error: getErrorDiagnostic(error)
  });
  await writeWorkerDiagnostic('error', 'task_failed', diagnostic);
  if (taskId) {
    await appendLog(taskId, `${phase} failed: ${diagnostic.error?.message || 'unknown error'}`, {
      level: 'error',
      data: diagnostic
    });
  }
}

async function runCommand(command, args = [], {
  cwd = process.cwd(),
  env = {},
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
      env: {
        ...process.env,
        ...env
      },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let output = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        child.kill('SIGTERM');
        settled = true;
        if (taskId) {
          void appendLog(taskId, `${label} timed out.`, {
            level: 'error',
            data: { command: printable, cwd, timeoutMs }
          });
        }
        void writeWorkerDiagnostic('error', 'command_timeout', {
          taskId,
          label,
          command: printable,
          cwd,
          timeoutMs
        });
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
        if (taskId) {
          void appendLog(taskId, `${label} could not start.`, {
            level: 'error',
            data: {
              command: printable,
              cwd,
              error: getErrorDiagnostic(error)
            }
          });
        }
        void writeWorkerDiagnostic('error', 'command_spawn_failed', {
          taskId,
          label,
          command: printable,
          cwd,
          error: getErrorDiagnostic(error)
        });
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
        void writeWorkerDiagnostic('error', 'command_failed', {
          taskId,
          label,
          command: printable,
          cwd,
          exitCode: code,
          output: truncateText(output, 8000)
        });
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
  return runCommand(GIT_COMMAND, args, {
    ...options,
    label: options.label || `git ${args[0] ?? ''}`
  });
}

function isRetryableNetworkError(error) {
  const text = String(error?.stack || error?.message || error || '');
  return /connection was reset|recv failure|failed to connect|could not resolve host|early eof|rpc failed|http\/2 stream|timeout|timed out|tls connection|network/i.test(text);
}

async function retryTransientCommand(taskId, label, operation, {
  attempts = 3,
  delayMs = 5000
} = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isRetryableNetworkError(error)) {
        throw error;
      }

      const nextDelayMs = delayMs * attempt;
      if (taskId) {
        await appendLog(taskId, `${label} hit a transient network error; retrying (${attempt + 1}/${attempts}).`, {
          level: 'warn',
          data: {
            delayMs: nextDelayMs,
            error: truncateText(error?.message || String(error), 1200)
          }
        });
      }
      await sleep(nextDelayMs);
    }
  }

  throw lastError;
}

let baseRepoLock = Promise.resolve();

async function withBaseRepoLock(operation) {
  const previousLock = baseRepoLock;
  const nextLock = previousLock.then(operation, operation);
  baseRepoLock = nextLock.catch(() => {});
  return nextLock;
}

async function ensureBaseRepository(taskId = '') {
  return withBaseRepoLock(async () => {
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
  });
}

async function removeTaskWorktree(worktreePath, taskId = '') {
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

async function cleanTaskWorktree(worktreePath, taskId = '') {
  return withBaseRepoLock(() => removeTaskWorktree(worktreePath, taskId));
}

async function createCodeWorktree(task) {
  await ensureBaseRepository(task.id);
  const slug = safeTaskSlug(task.id);
  const branch = `agent/task-${slug}`;
  const worktreePath = path.join(TASKS_ROOT, slug);
  const baseBranch = String(task.baseBranch || '').trim();
  const baseRef = baseBranch ? `origin/${baseBranch}` : `origin/${GIT_BASE_BRANCH}`;
  await withBaseRepoLock(async () => {
    if (baseBranch) {
      await git(['fetch', 'origin', `+refs/heads/${baseBranch}:refs/remotes/origin/${baseBranch}`], {
        cwd: REPO_PATH,
        taskId: task.id,
        label: 'git fetch thread base'
      });
    }
    await removeTaskWorktree(worktreePath, task.id);
    await git(['worktree', 'add', '-B', branch, worktreePath, baseRef], {
      cwd: REPO_PATH,
      taskId: task.id,
      label: 'git worktree add'
    });
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

  const slug = `${safeTaskSlug(task.id)}-deploy`;
  const worktreePath = path.join(TASKS_ROOT, slug);
  const ref = branch ? `origin/${branch}` : commitSha;
  await withBaseRepoLock(async () => {
    if (branch) {
      await git(['fetch', 'origin', branch], {
        cwd: REPO_PATH,
        taskId: task.id,
        label: 'git fetch deploy branch'
      });
    }
    await removeTaskWorktree(worktreePath, task.id);
    await git(['worktree', 'add', worktreePath, ref], {
      cwd: REPO_PATH,
      taskId: task.id,
      label: 'git worktree add deploy'
    });
  });
  return { branch, worktreePath };
}

async function createRollbackWorktree(task) {
  await ensureBaseRepository(task.id);
  const slug = `${safeTaskSlug(task.id)}-rollback`;
  const branch = `agent/rollback-${safeTaskSlug(task.id)}`;
  const worktreePath = path.join(TASKS_ROOT, slug);
  await withBaseRepoLock(async () => {
    await removeTaskWorktree(worktreePath, task.id);
    await git(['worktree', 'add', '-B', branch, worktreePath, `origin/${GIT_BASE_BRANCH}`], {
      cwd: REPO_PATH,
      taskId: task.id,
      label: 'git worktree add rollback'
    });
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

async function getUnmergedFiles(worktreePath, taskId = '') {
  const output = await git(['diff', '--name-only', '--diff-filter=U'], {
    cwd: worktreePath,
    taskId,
    label: 'git list unmerged files'
  });
  return normalizeChangedFiles(output
    .split(/\r?\n/u)
    .filter((line) => !line.startsWith('warning:')));
}

async function getFilesWithConflictMarkers(worktreePath, filePaths = []) {
  const filesWithMarkers = [];
  for (const filePath of normalizeChangedFiles(filePaths)) {
    const absolutePath = path.resolve(worktreePath, filePath);
    assertInside(worktreePath, absolutePath);
    const text = await fsp.readFile(absolutePath, 'utf8').catch(() => '');
    if (/^(<<<<<<<|=======|>>>>>>>)/mu.test(text)) {
      filesWithMarkers.push(filePath);
    }
  }
  return filesWithMarkers;
}

async function writeDeployRebaseRepairPrompt(task, worktreePath, {
  conflictFiles = [],
  attempt = 1,
  rebaseError = null
} = {}) {
  const promptPath = path.join(worktreePath, '.codex', 'deploy-rebase-repair-prompt.md');
  await fsp.mkdir(path.dirname(promptPath), { recursive: true });
  const prompt = `You are Codex resolving a deploy rebase conflict in the StickRPG repository.

Task ID:
${task.id}

Admin request:
${indentBlock(task.prompt)}

Current state:
- The repository is mid-\`git rebase origin/${GIT_BASE_BRANCH}\`.
- This is deploy conflict repair attempt ${attempt} of ${DEPLOY_REBASE_REPAIR_ATTEMPTS}.
- Do not abort the rebase.
- Do not run production deploy commands.
- Do not push.

Conflicted files:
${conflictFiles.length ? conflictFiles.map((filePath) => `- ${filePath}`).join('\n') : '- none detected'}

Ongoing thread context:
${formatThreadHistoryForPrompt(task.threadHistory)}

Rebase error:
\`\`\`text
${truncateText(rebaseError?.message || String(rebaseError ?? ''), 6000)}
\`\`\`

Instructions:
- Resolve the conflict markers in the conflicted files.
- Preserve current \`origin/${GIT_BASE_BRANCH}\` behavior unless the task explicitly needs to extend it.
- Re-apply the task's intended behavior on top of current main.
- Keep edits focused to the conflicted task files and any directly required companion files.
- Leave the worktree with no conflict markers and no unmerged paths.
- Do not run \`git rebase --continue\`; the worker will stage resolved files and continue the rebase after you finish.
`;
  await fsp.writeFile(promptPath, prompt, 'utf8');
  return promptPath;
}

async function repairDeployRebaseConflict(task, worktreePath, {
  conflictFiles = [],
  attempt = 1,
  rebaseError = null
} = {}) {
  await appendLog(task.id, `Deploy rebase conflict detected; asking Codex to repair it (${attempt}/${DEPLOY_REBASE_REPAIR_ATTEMPTS}).`, {
    level: 'warn',
    data: {
      conflictFiles,
      error: truncateText(rebaseError?.message || String(rebaseError ?? ''), 2000)
    }
  });

  const promptPath = await writeDeployRebaseRepairPrompt(task, worktreePath, {
    conflictFiles,
    attempt,
    rebaseError
  });
  const codexResult = await runCodex(task, worktreePath, promptPath);
  if (codexResult.lastMessage) {
    await appendLog(task.id, 'Codex deploy conflict repair response recorded.', {
      data: { message: truncateText(codexResult.lastMessage, 4000) }
    });
  }

  const filesWithMarkers = await getFilesWithConflictMarkers(worktreePath, conflictFiles);
  if (filesWithMarkers.length > 0) {
    throw new Error(`Codex left conflict markers in deploy rebase files: ${filesWithMarkers.join(', ')}`);
  }

  const resolutionFiles = mergeChangedFiles(conflictFiles, await getChangedFiles(worktreePath));
  assertAllowedChangedFiles(resolutionFiles);
  if (resolutionFiles.length > 0) {
    await git(['add', '--', ...resolutionFiles], {
      cwd: worktreePath,
      taskId: task.id,
      label: 'git add deploy rebase repair'
    });
  }

  const remainingUnmerged = await getUnmergedFiles(worktreePath, task.id);
  if (remainingUnmerged.length > 0) {
    throw new Error(`Codex did not resolve all deploy rebase conflicts: ${remainingUnmerged.join(', ')}`);
  }
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
  await retryTransientCommand(task.id, 'git push', () => git(['push', '-u', 'origin', branch], {
    cwd: worktreePath,
    taskId: task.id,
    timeoutMs: 10 * 60 * 1000,
    label: 'git push'
  }));
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
  if (!fromRef) {
    return taskChangedFiles;
  }

  const diffChangedFiles = await getDiffChangedFiles(worktreePath, fromRef, 'HEAD');
  return mergeChangedFiles(taskChangedFiles, diffChangedFiles);
}

function createDeployRebaseFailureError(headCommitSha, lastError, {
  conflictFiles = [],
  repairAttempts = 0
} = {}) {
  const repairText = repairAttempts > 0
    ? ` The worker attempted automated conflict repair ${repairAttempts} time(s), but the rebase still could not finish.`
    : '';
  const conflictText = conflictFiles.length
    ? ` Conflicted files: ${conflictFiles.join(', ')}.`
    : '';
  return new Error(`Task commit ${headCommitSha} could not be automatically rebased onto origin/${GIT_BASE_BRANCH}.${repairText}${conflictText} Retry deploy from the game after reviewing the failure, rerun the prompt, or resolve the task branch conflicts manually.\n${lastError?.message ?? lastError}`);
}

async function rebaseDeployTaskWithRepair(task, worktreePath, headCommitSha) {
  try {
    await git(['rebase', `origin/${GIT_BASE_BRANCH}`], {
      cwd: worktreePath,
      taskId: task.id,
      timeoutMs: 10 * 60 * 1000,
      label: 'git rebase deploy task'
    });
    return {
      repairAttempts: 0,
      conflictFiles: []
    };
  } catch (initialError) {
    let lastError = initialError;
    let allConflictFiles = [];
    let repairAttemptsUsed = 0;

    for (let attempt = 1; attempt <= DEPLOY_REBASE_REPAIR_ATTEMPTS; attempt += 1) {
      const conflictFiles = await getUnmergedFiles(worktreePath, task.id);
      if (conflictFiles.length === 0) {
        break;
      }

      repairAttemptsUsed = attempt;
      allConflictFiles = mergeChangedFiles(allConflictFiles, conflictFiles);
      try {
        await repairDeployRebaseConflict(task, worktreePath, {
          conflictFiles,
          attempt,
          rebaseError: lastError
        });
        await git(['-c', 'core.editor=true', '-c', 'sequence.editor=true', 'rebase', '--continue'], {
          cwd: worktreePath,
          env: {
            GIT_EDITOR: 'true',
            GIT_SEQUENCE_EDITOR: 'true'
          },
          taskId: task.id,
          timeoutMs: 10 * 60 * 1000,
          label: 'git rebase continue deploy task'
        });
        await appendLog(task.id, `Automated deploy rebase repair succeeded (${attempt}/${DEPLOY_REBASE_REPAIR_ATTEMPTS}).`, {
          data: { conflictFiles: allConflictFiles }
        });
        return {
          repairAttempts: attempt,
          conflictFiles: allConflictFiles
        };
      } catch (repairError) {
        lastError = repairError;
        const nextConflictFiles = await getUnmergedFiles(worktreePath, task.id).catch(() => []);
        if (nextConflictFiles.length === 0) {
          break;
        }
        allConflictFiles = mergeChangedFiles(allConflictFiles, nextConflictFiles);
      }
    }

    await git(['rebase', '--abort'], {
      cwd: worktreePath,
      taskId: task.id,
      label: 'git rebase abort'
    }).catch(() => {});
    throw createDeployRebaseFailureError(headCommitSha, lastError, {
      conflictFiles: allConflictFiles,
      repairAttempts: repairAttemptsUsed
    });
  }
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

function readEnvCredential(name, aliases = []) {
  for (const key of [name, ...aliases]) {
    const value = String(process.env[key] ?? '').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

async function readLocalColyseusDeployConfig() {
  try {
    const raw = await fsp.readFile(path.join(LOCAL_REPO_ROOT, '.colyseus-cloud.json'), 'utf8');
    const envName = process.env.COLYSEUS_DEPLOY_ENV || process.env.COLYSEUS_ENV || 'production';
    return JSON.parse(raw)?.[envName] ?? null;
  } catch {
    return null;
  }
}

async function hasColyseusDeployCredentials() {
  const envApplicationId = readEnvCredential('COLYSEUS_APPLICATION_ID', ['COLYSEUS_APP_ID']);
  const envToken = readEnvCredential('COLYSEUS_DEPLOY_TOKEN', ['COLYSEUS_TOKEN']);
  if (envApplicationId && envToken) {
    return true;
  }

  const config = await readLocalColyseusDeployConfig();
  return Boolean(String(config?.applicationId ?? '').trim() && String(config?.token ?? '').trim());
}

function isColyseusBackendDeployCommand(command = '') {
  const normalized = String(command ?? '').trim().toLowerCase();
  return normalized.includes('deploy:colyseus')
    || normalized.includes('deploy-colyseus-noninteractive.mjs')
    || normalized.includes('@colyseus/cloud');
}

async function validateDeployPrerequisites(task, targets = []) {
  const deployTargets = normalizeDeployTargets(targets);
  if (
    deployTargets.includes('backend')
    && !isBackendDeployGitManaged()
    && isColyseusBackendDeployCommand(BACKEND_DEPLOY_COMMAND)
    && !(await hasColyseusDeployCredentials())
  ) {
    const message = 'Backend deploy is configured for Colyseus CLI, but this worker has no Colyseus deploy credentials. '
      + 'Set COLYSEUS_APPLICATION_ID and COLYSEUS_DEPLOY_TOKEN, add a local .colyseus-cloud.json, '
      + 'or set BACKEND_DEPLOY_STRATEGY=git if Colyseus Cloud deploys main through Git integration.';
    await appendLog(task.id, message, {
      level: 'error',
      data: {
        backendDeployStrategy: BACKEND_DEPLOY_STRATEGY,
        backendDeployCommand: BACKEND_DEPLOY_COMMAND
      }
    });
    throw new Error(message);
  }
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

function getFrontendVersionManifestUrl(verifyUrl = '') {
  const url = new URL(verifyUrl);
  const basePath = url.pathname.endsWith('/')
    ? url.pathname
    : url.pathname.replace(/[^/]*$/u, '');
  url.pathname = `${basePath.replace(/\/?$/u, '/')}version.json`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function getJsonCommitSha(json = {}) {
  return String(json?.commitSha || json?.buildCommitSha || '').trim();
}

function commitShaMatches(expectedCommitSha = '', servedCommitSha = '') {
  const expected = String(expectedCommitSha || '').trim();
  const served = String(servedCommitSha || '').trim();
  return Boolean(expected && served)
    && (served === expected || served.startsWith(expected) || expected.startsWith(served));
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
      const versionUrl = getFrontendVersionManifestUrl(verifyUrl);
      const versionResult = await fetchJson(withVerifyCacheBuster(versionUrl), FRONTEND_VERIFY_REQUEST_TIMEOUT_MS);
      const servedCommitSha = getJsonCommitSha(versionResult.json);
      if (commitShaMatches(commitSha, servedCommitSha)) {
        const message = `${actionLabel} verified: frontend version manifest is serving commit ${servedCommitSha.slice(0, 12)}.`;
        await appendLog(task.id, message, {
          data: {
            verifyUrl: versionUrl,
            responseUrl: versionResult.url,
            expectedCommitSha: commitSha,
            servedCommitSha,
            attempts: attempt,
            cacheControl: versionResult.cacheControl
          }
        });
        return {
          deployUrl: verifyUrl,
          output: [
            message,
            `URL: ${verifyUrl}`,
            `Version: ${versionUrl}`,
            `Attempts: ${attempt}`
          ].join('\n')
        };
      }

      if (servedCommitSha) {
        lastError = `version manifest expected commit ${commitSha.slice(0, 12)}, saw ${servedCommitSha.slice(0, 12)}`;
      }
    } catch (error) {
      lastError = `version manifest check failed: ${error?.message || String(error)}`;
    }

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
      lastError = `${lastError ? `${lastError}; ` : ''}HTML check failed: ${error?.message || String(error)}`;
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
      const servedCommitSha = getJsonCommitSha(result.json);
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

      if (commitShaMatches(commitSha, servedCommitSha)) {
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

async function readFrontendServedCommit(worktreePath) {
  const verifyUrl = await getFrontendVerifyUrl(worktreePath);
  if (!verifyUrl) {
    return {
      target: 'frontend',
      ok: false,
      deployUrl: '',
      servedCommitSha: '',
      output: 'Frontend reconciliation skipped; no FRONTEND_VERIFY_URL or package homepage is configured.'
    };
  }

  const versionUrl = getFrontendVersionManifestUrl(verifyUrl);
  try {
    const result = await fetchJson(withVerifyCacheBuster(versionUrl), FRONTEND_VERIFY_REQUEST_TIMEOUT_MS);
    return {
      target: 'frontend',
      ok: true,
      deployUrl: verifyUrl,
      sourceUrl: result.url,
      servedCommitSha: getJsonCommitSha(result.json),
      output: `Frontend version manifest ${versionUrl} reported ${getJsonCommitSha(result.json) || 'no commit SHA'}.`
    };
  } catch (error) {
    return {
      target: 'frontend',
      ok: false,
      deployUrl: verifyUrl,
      sourceUrl: versionUrl,
      servedCommitSha: '',
      output: `Frontend version manifest check failed: ${error?.message || String(error)}`
    };
  }
}

async function readBackendServedCommit() {
  const verifyUrl = normalizeHttpUrl(BACKEND_VERIFY_URL);
  if (!verifyUrl) {
    return {
      target: 'backend',
      ok: false,
      deployUrl: '',
      servedCommitSha: '',
      output: 'Backend reconciliation skipped; no BACKEND_VERIFY_URL or AGENT_API_BASE is configured.'
    };
  }

  try {
    const result = await fetchJson(withVerifyCacheBuster(verifyUrl), BACKEND_VERIFY_REQUEST_TIMEOUT_MS);
    return {
      target: 'backend',
      ok: true,
      deployUrl: verifyUrl,
      sourceUrl: result.url,
      servedCommitSha: getJsonCommitSha(result.json),
      output: `Backend health ${verifyUrl} reported ${getJsonCommitSha(result.json) || 'no commit SHA'}.`
    };
  } catch (error) {
    return {
      target: 'backend',
      ok: false,
      deployUrl: verifyUrl,
      servedCommitSha: '',
      output: `Backend health check failed: ${error?.message || String(error)}`
    };
  }
}

async function servedCommitIncludesExpected(task, expectedCommitSha = '', servedCommitSha = '') {
  if (commitShaMatches(expectedCommitSha, servedCommitSha)) {
    return true;
  }

  const expected = String(expectedCommitSha || '').trim();
  const served = String(servedCommitSha || '').trim();
  if (!expected || !served) {
    return false;
  }

  const hasExpected = await commitExists(REPO_PATH, expected, task.id);
  const hasServed = await commitExists(REPO_PATH, served, task.id);
  if (!hasExpected || !hasServed) {
    return false;
  }

  return isAncestor(REPO_PATH, expected, served, task.id);
}

async function chooseReconciledLiveCommitSha(task, results = [], fallbackCommitSha = '') {
  const commits = [...new Set(results
    .map((result) => String(result.servedCommitSha || '').trim())
    .filter(Boolean))];
  for (const candidate of commits) {
    let includesAllServedCommits = true;
    for (const other of commits) {
      if (commitShaMatches(other, candidate)) {
        continue;
      }
      if (!await servedCommitIncludesExpected(task, other, candidate)) {
        includesAllServedCommits = false;
        break;
      }
    }
    if (includesAllServedCommits) {
      return candidate;
    }
  }

  return commits[0] || fallbackCommitSha;
}

async function reconcileStaleDeployTask(task) {
  const expectedCommitSha = String(task.newDeployCommitSha || task.commitSha || '').trim();
  if (!expectedCommitSha) {
    throw new Error('Stale deploy task has no commit SHA to reconcile.');
  }

  await ensureBaseRepository(task.id);
  await git(['fetch', 'origin', GIT_BASE_BRANCH, '--prune'], {
    cwd: REPO_PATH,
    taskId: task.id,
    label: 'git fetch reconciliation base'
  });

  const deployTargets = normalizeDeployTargets(task.deployTargets);
  const inferredTargets = deployTargets.length > 0
    ? deployTargets
    : inferDeployTargets(normalizeChangedFiles(task.changedFiles));
  const targets = inferredTargets.length > 0 ? inferredTargets : ['frontend', 'backend'];
  const results = [];

  if (targets.includes('frontend')) {
    results.push(await readFrontendServedCommit(REPO_PATH));
  }
  if (targets.includes('backend')) {
    results.push(await readBackendServedCommit());
  }

  for (const result of results) {
    result.includesExpectedCommit = result.ok
      && await servedCommitIncludesExpected(task, expectedCommitSha, result.servedCommitSha);
  }

  const output = results.map((result) => [
    `[${result.target}] ${result.output}`,
    result.servedCommitSha ? `Served commit: ${result.servedCommitSha}` : '',
    result.includesExpectedCommit ? `Includes task commit: ${expectedCommitSha}` : 'Includes task commit: no'
  ].filter(Boolean).join('\n')).join('\n\n');

  if (!results.length || results.some((result) => !result.includesExpectedCommit)) {
    throw new Error(`Stale deploy could not be reconciled against the live runtime.\n${output}`);
  }

  const liveCommitSha = await chooseReconciledLiveCommitSha(task, results, expectedCommitSha);
  const deployUrl = results.find((result) => result.deployUrl)?.deployUrl || task.deployUrl || '';
  const message = liveCommitSha === expectedCommitSha
    ? `Deployment reconciled: live runtime is serving commit ${expectedCommitSha.slice(0, 12)}.`
    : `Deployment reconciled: live runtime is serving ${liveCommitSha.slice(0, 12)}, which includes task commit ${expectedCommitSha.slice(0, 12)}.`;
  await appendLog(task.id, message, {
    data: {
      expectedCommitSha,
      liveCommitSha,
      deployTargets: targets,
      results
    }
  });
  await recordDeployment({
    action: 'deploy',
    taskId: task.id,
    previousCommitSha: task.previousDeployCommitSha || '',
    currentCommitSha: liveCommitSha,
    deployUrl,
    deployTargets: targets
  });
  await updateTask(task.id, {
    status: 'deployed',
    newDeployCommitSha: expectedCommitSha,
    deployedAt: Date.now(),
    deployTargets: targets,
    deployUrl,
    deployLog: truncateText(`${message}\n\n${output}`, 10000),
    summary: `${message} ${summarizeDeployResult('Deployment', targets)}`
  });
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

  await retryTransientCommand(task.id, 'git push rebased task branch', () => git(['push', '--force-with-lease', 'origin', `HEAD:${normalizedBranch}`], {
    cwd: worktreePath,
    taskId: task.id,
    timeoutMs: 10 * 60 * 1000,
    label: 'git push rebased task branch'
  }));
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

  const rebaseResult = await rebaseDeployTaskWithRepair(task, worktreePath, headCommitSha);

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
      changedFiles,
      rebaseRepairAttempts: rebaseResult.repairAttempts,
      rebaseConflictFiles: rebaseResult.conflictFiles
    }
  });

  return {
    previousDeployCommitSha,
    newDeployCommitSha: rebasedCommitSha,
    changedFiles,
    rebased: true,
    rebaseRepairAttempts: rebaseResult.repairAttempts,
    rebaseConflictFiles: rebaseResult.conflictFiles,
    taskBranchCommitChanged: true
  };
}

async function pushWorktreeToMain(task, worktreePath) {
  await retryTransientCommand(task.id, 'git push main', () => git(['push', 'origin', `HEAD:${GIT_BASE_BRANCH}`], {
    cwd: worktreePath,
    taskId: task.id,
    timeoutMs: 10 * 60 * 1000,
    label: 'git push main'
  }));
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
  const recordedTargets = normalizeDeployTargets(task.deployTargets);
  const inferredTargets = inferDeployTargets(changedFiles);
  const deployTargets = resolveDeployTargets(changedFiles, recordedTargets);
  await appendLog(task.id, `Deploy targets: ${formatDeployTargets(deployTargets)}.`, {
    data: {
      deployTargets,
      recordedDeployTargets: recordedTargets,
      inferredDeployTargets: inferredTargets,
      changedFiles
    }
  });
  if (recordedTargets.length > 0 && deployTargets.length > recordedTargets.length) {
    await appendLog(task.id, 'Deploy targets expanded from the commit diff.', {
      level: 'warn',
      data: {
        recordedDeployTargets: recordedTargets,
        inferredDeployTargets: inferredTargets,
        deployTargets
      }
    });
  }
  await validateDeployPrerequisites(task, deployTargets);
  await installAndCheck(task, worktreePath, { targets: deployTargets });
  if (deployRefs.rebased) {
    await pushRebasedTaskBranch(task, worktreePath);
  }
  if (deployRefs.rebased || deployRefs.taskBranchCommitChanged) {
    await updateTask(task.id, {
      branch: String(task.branch || '').trim(),
      commitSha: deployRefs.newDeployCommitSha,
      changedFiles,
      deployTargets,
      summary: deployRefs.rebased
        ? `Task branch rebased onto latest ${GIT_BASE_BRANCH}${deployRefs.rebaseRepairAttempts > 0 ? ' after automated conflict repair' : ''}; checks passed and deploy is continuing.`
        : 'Task branch head verified; checks passed and deploy is continuing.'
    });
  }
  await pushWorktreeToMain(task, worktreePath);
  const deployResult = await runDeployTargets(task, worktreePath, deployTargets, {
    expectedCommitSha: deployRefs.newDeployCommitSha,
    actionLabel: 'Deployment'
  });
  await recordDeployment({
    action: 'deploy',
    taskId: task.id,
    previousCommitSha: deployRefs.previousDeployCommitSha,
    currentCommitSha: deployRefs.newDeployCommitSha,
    deployUrl: deployResult.deployUrl || task.deployUrl || '',
    deployTargets
  });
  await updateTask(task.id, {
    status: 'deployed',
    previousDeployCommitSha: deployRefs.previousDeployCommitSha,
    newDeployCommitSha: deployRefs.newDeployCommitSha,
    commitSha: deployRefs.newDeployCommitSha,
    deployedAt: Date.now(),
    changedFiles,
    deployTargets,
    deployUrl: deployResult.deployUrl || task.deployUrl || '',
    deployLog: truncateText(deployResult.output, 10000),
    summary: summarizeDeployResult('Deployment', deployTargets)
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
  const changedFiles = await getDeployChangedFiles(task, worktreePath, previousDeployCommitSha);
  const recordedTargets = normalizeDeployTargets(task.deployTargets);
  const inferredTargets = inferDeployTargets(changedFiles);
  const deployTargets = resolveDeployTargets(changedFiles, recordedTargets);
  await appendLog(task.id, `Rollback deploy targets: ${formatDeployTargets(deployTargets)}.`, {
    level: 'warn',
    data: {
      deployTargets,
      recordedDeployTargets: recordedTargets,
      inferredDeployTargets: inferredTargets,
      changedFiles
    }
  });

  await installAndCheck(task, worktreePath, { targets: deployTargets });
  await pushWorktreeToMain(task, worktreePath);
  const deployResult = await runDeployTargets(task, worktreePath, deployTargets, {
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
    deployTargets
  });
  await updateTask(task.id, {
    status: 'rolled_back',
    rolledBackAt: Date.now(),
    rollbackCommitSha,
    deployTargets,
    deployUrl: deployResult.deployUrl || task.deployUrl || '',
    rollbackLog: truncateText(deployResult.output, 10000),
    summary: summarizeDeployResult('Rollback deploy', deployTargets)
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
    await recordTaskFailure(task, 'code task', error, {
      status,
      worktreePath
    });
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
    await recordTaskFailure(task, 'deploy task', error, {
      worktreePath
    });
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

async function handleReconcileDeployTask(task) {
  try {
    await reconcileStaleDeployTask(task);
  } catch (error) {
    await recordTaskFailure(task, 'deploy reconciliation', error);
    await updateTask(task.id, {
      status: 'failed',
      error: String(error?.stack ?? error)
    }).catch(() => {});
    throw error;
  }
}

async function handleRollbackTask(task) {
  let worktreePath = '';
  try {
    const worktree = await createRollbackWorktree(task);
    worktreePath = worktree.worktreePath;
    await rollbackTask(task, worktreePath);
  } catch (error) {
    await recordTaskFailure(task, 'rollback task', error, {
      worktreePath
    });
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

async function claimNextTask({
  deployEnabled = DEPLOY_ENABLED,
  codeEnabled = true
} = {}) {
  return apiRequest('/admin/agent-tasks/next', {
    query: {
      scope: DEFAULT_SCOPE,
      deployEnabled: deployEnabled ? '1' : '0',
      codeEnabled: codeEnabled ? '1' : '0',
      staleDeployingAfterMs: deployEnabled ? String(STALE_DEPLOY_RECONCILE_AFTER_MS) : '0'
    }
  });
}

async function runIteration({
  lane = 'worker',
  deployEnabled = DEPLOY_ENABLED,
  codeEnabled = true
} = {}) {
  const result = await claimNextTask({
    deployEnabled,
    codeEnabled
  });
  if (!result.task) {
    return false;
  }

  const task = result.task;
  await appendLog(task.id, `Worker ${WORKER_ID} ${lane} lane started ${result.action || 'task'}.`);
  if (result.action === 'deploy') {
    await handleDeployTask(task);
  } else if (result.action === 'reconcile_deploy') {
    await handleReconcileDeployTask(task);
  } else if (result.action === 'rollback') {
    await handleRollbackTask(task);
  } else {
    await handleCodeTask(task);
  }
  return true;
}

async function runLane({
  lane = 'worker',
  slot = 1,
  deployEnabled = DEPLOY_ENABLED,
  codeEnabled = true,
  idlePollMs = Number(process.env.AGENT_POLL_MS || DEFAULT_POLL_MS),
  errorPollMs = Number(process.env.AGENT_ERROR_POLL_MS || 10000)
} = {}) {
  const laneLabel = `${lane}-${slot}`;
  while (true) {
    try {
      const didWork = await runIteration({
        lane: laneLabel,
        deployEnabled,
        codeEnabled
      });
      if (RUN_ONCE) {
        return didWork;
      }
      if (!didWork) {
        await sleep(idlePollMs);
      }
    } catch (error) {
      console.error(`[agent-worker] ${laneLabel} iteration failed.`, error);
      await writeWorkerDiagnostic('error', 'lane_iteration_failed', {
        lane: laneLabel,
        deployEnabled,
        codeEnabled,
        error: getErrorDiagnostic(error)
      });
      if (RUN_ONCE) {
        process.exitCode = 1;
        return false;
      }
      await sleep(errorPollMs);
    }
  }
}

async function runWorker() {
  if (RUN_ONCE) {
    await runLane({
      lane: 'once',
      slot: 1,
      deployEnabled: DEPLOY_ENABLED,
      codeEnabled: true
    });
    return;
  }

  const lanes = [];
  for (let slot = 1; slot <= CODE_CONCURRENCY; slot += 1) {
    lanes.push(runLane({
      lane: 'code',
      slot,
      deployEnabled: false,
      codeEnabled: true
    }));
  }

  for (let slot = 1; slot <= DEPLOY_CONCURRENCY; slot += 1) {
    lanes.push(runLane({
      lane: 'deploy',
      slot,
      deployEnabled: true,
      codeEnabled: false
    }));
  }

  if (lanes.length === 0) {
    throw new Error('No worker lanes are enabled. Set AGENT_CODE_CONCURRENCY above 0 or enable DEPLOY_ENABLED.');
  }

  await Promise.all(lanes);
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

async function hydrateColyseusDeployEnv() {
  if (
    String(process.env.COLYSEUS_APPLICATION_ID ?? process.env.COLYSEUS_APP_ID ?? '').trim()
    && String(process.env.COLYSEUS_DEPLOY_TOKEN ?? process.env.COLYSEUS_TOKEN ?? '').trim()
  ) {
    return;
  }

  try {
    const config = await readLocalColyseusDeployConfig();
    if (!String(process.env.COLYSEUS_APPLICATION_ID ?? process.env.COLYSEUS_APP_ID ?? '').trim() && config?.applicationId) {
      process.env.COLYSEUS_APPLICATION_ID = String(config.applicationId);
    }
    if (!String(process.env.COLYSEUS_DEPLOY_TOKEN ?? process.env.COLYSEUS_TOKEN ?? '').trim() && config?.token) {
      process.env.COLYSEUS_DEPLOY_TOKEN = String(config.token);
    }
  } catch {}
}

function assertSelfTestEqual(actual, expected, label) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) {
    throw new Error(`${label}: expected ${expectedText}, received ${actualText}`);
  }
}

function getSimulatedDeployPlan(changedFiles = [], recordedTargets = []) {
  const deployTargets = resolveDeployTargets(changedFiles, recordedTargets);
  return {
    changedFiles: normalizeChangedFiles(changedFiles),
    recordedDeployTargets: normalizeDeployTargets(recordedTargets),
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
      label: 'shared-world-catalog',
      changedFiles: ['src/world/builderCatalog.js', 'src/world/proceduralProps.js'],
      deployTargets: ['frontend', 'backend'],
      checks: ['npm ci', 'npm run build:web', 'npm run build:server', 'git diff --check'],
      frontendDeploy: FRONTEND_DEPLOY_COMMAND.trim() ? 'command' : 'git-integration',
      backendDeploy: isBackendDeployGitManaged() ? 'git-integration' : 'command'
    },
    {
      label: 'stale-frontend-recorded-shared-world-catalog',
      changedFiles: ['src/world/builderCatalog.js'],
      recordedDeployTargets: ['frontend'],
      deployTargets: ['frontend', 'backend'],
      checks: ['npm ci', 'npm run build:web', 'npm run build:server', 'git diff --check'],
      frontendDeploy: FRONTEND_DEPLOY_COMMAND.trim() ? 'command' : 'git-integration',
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
    const plan = getSimulatedDeployPlan(scenario.changedFiles, scenario.recordedDeployTargets);
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

await hydrateColyseusDeployEnv();

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
  gitCommand: GIT_COMMAND,
  scope: DEFAULT_SCOPE,
  autoDeploy: AUTO_DEPLOY,
  deployEnabled: DEPLOY_ENABLED,
  codeConcurrency: RUN_ONCE ? 1 : CODE_CONCURRENCY,
  deployConcurrency: RUN_ONCE ? (DEPLOY_ENABLED ? 1 : 0) : DEPLOY_CONCURRENCY,
  requestedDeployConcurrency: REQUESTED_DEPLOY_CONCURRENCY,
  backendDeployCommand: BACKEND_DEPLOY_COMMAND ? 'configured' : 'missing',
  backendDeployStrategy: BACKEND_DEPLOY_STRATEGY,
  backendVerifyUrl: BACKEND_VERIFY_URL ? 'configured' : 'missing',
  frontendDeployCommand: FRONTEND_DEPLOY_COMMAND ? 'configured' : 'git-integration',
  frontendVerifyUrl: FRONTEND_VERIFY_URL ? 'configured' : 'package-homepage',
  frontendVerifyTimeoutMs: FRONTEND_VERIFY_TIMEOUT_MS,
  runOnce: RUN_ONCE,
  selfTest: RUN_SELF_TEST
});

await runWorker();
