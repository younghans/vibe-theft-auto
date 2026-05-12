import { randomUUID } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AGENT_TASKS_FILE_PATH = process.env.AGENT_TASKS_FILE_PATH
  ? path.resolve(process.env.AGENT_TASKS_FILE_PATH)
  : fileURLToPath(new URL('../data/agent-tasks.json', import.meta.url));

export const AGENT_TASK_STATUSES = Object.freeze([
  'queued',
  'claimed',
  'preparing',
  'coding',
  'testing',
  'test_failed',
  'ready_for_review',
  'deploying',
  'deployed',
  'rolling_back',
  'rolled_back',
  'failed',
  'cancelled'
]);

export const AGENT_TASK_MODES = Object.freeze(['draft', 'preview', 'auto']);
export const AGENT_TASK_DEFAULT_SCOPE = 'game';
export const AGENT_TASK_LOG_LIMIT = 240;
export const AGENT_TASK_PROMPT_MAX_LENGTH = 6000;
export const AGENT_TASK_ERROR_MAX_LENGTH = 12000;
export const AGENT_TASK_SUMMARY_MAX_LENGTH = 12000;

const MUTABLE_TASK_FIELDS = new Set([
  'status',
  'branch',
  'commitSha',
  'previewUrl',
  'deployUrl',
  'changedFiles',
  'deployTargets',
  'error',
  'summary',
  'claimedBy',
  'claimedAt',
  'deployStartedAt',
  'previousDeployCommitSha',
  'newDeployCommitSha',
  'deployedAt',
  'deployLog',
  'rollbackStartedAt',
  'rolledBackAt',
  'rollbackCommitSha',
  'rollbackLog'
]);

let taskStoreQueue = Promise.resolve();

function createEmptyState() {
  return {
    version: 1,
    tasks: []
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function truncateText(value = '', maxLength = 4000) {
  const text = String(value ?? '');
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 24))}\n...[truncated]`;
}

function normalizeTaskId(value = '') {
  return String(value ?? '').trim();
}

function normalizeScope(value = '') {
  const scope = String(value ?? '').trim().toLowerCase();
  return scope || AGENT_TASK_DEFAULT_SCOPE;
}

function normalizeMode(value = '') {
  const mode = String(value ?? '').trim().toLowerCase();
  return AGENT_TASK_MODES.includes(mode) ? mode : 'preview';
}

function normalizeContextType(value = '') {
  const contextType = String(value ?? '').trim().toLowerCase();
  return contextType || 'game';
}

function normalizeStatus(value = '') {
  const status = String(value ?? '').trim().toLowerCase();
  return AGENT_TASK_STATUSES.includes(status) ? status : '';
}

function normalizeLogs(logs = []) {
  if (!Array.isArray(logs)) {
    return [];
  }

  return logs.slice(-AGENT_TASK_LOG_LIMIT).map((entry) => ({
    at: Number.isFinite(Number(entry?.at)) ? Number(entry.at) : Date.now(),
    level: String(entry?.level ?? 'info').slice(0, 24),
    message: truncateText(entry?.message ?? '', 4000),
    data: entry?.data == null ? null : cloneJson(entry.data)
  }));
}

function normalizeStringList(value = [], {
  maxItems = 200,
  maxLength = 240
} = {}) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[\n,]/u);
  return [...new Set(rawItems
    .map((item) => String(item ?? '').trim().replaceAll('\\', '/').replace(/^\.\/+/u, ''))
    .filter(Boolean)
    .map((item) => item.slice(0, maxLength)))]
    .slice(0, maxItems);
}

function normalizeDeployTargets(value = []) {
  const allowedTargets = new Set(['frontend', 'backend']);
  return normalizeStringList(value, { maxItems: 4, maxLength: 32 })
    .map((target) => target.toLowerCase())
    .filter((target) => allowedTargets.has(target));
}

function normalizeTask(raw = {}) {
  const now = Date.now();
  const id = normalizeTaskId(raw.id);
  return {
    id,
    type: String(raw.type ?? 'code_change') || 'code_change',
    scope: normalizeScope(raw.scope),
    gameId: String(raw.gameId ?? '').trim(),
    contextType: normalizeContextType(raw.contextType ?? raw.scope),
    contextLabel: String(raw.contextLabel ?? '').trim().slice(0, 160),
    prompt: truncateText(raw.prompt ?? '', AGENT_TASK_PROMPT_MAX_LENGTH),
    mode: normalizeMode(raw.mode),
    status: normalizeStatus(raw.status) || 'queued',
    createdBy: String(raw.createdBy ?? ''),
    createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : now,
    updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : now,
    claimedBy: String(raw.claimedBy ?? ''),
    claimedAt: Number.isFinite(Number(raw.claimedAt)) ? Number(raw.claimedAt) : 0,
    branch: String(raw.branch ?? ''),
    commitSha: String(raw.commitSha ?? ''),
    previewUrl: String(raw.previewUrl ?? ''),
    deployUrl: String(raw.deployUrl ?? ''),
    changedFiles: normalizeStringList(raw.changedFiles),
    deployTargets: normalizeDeployTargets(raw.deployTargets),
    error: truncateText(raw.error ?? '', AGENT_TASK_ERROR_MAX_LENGTH),
    summary: truncateText(raw.summary ?? '', AGENT_TASK_SUMMARY_MAX_LENGTH),
    logs: normalizeLogs(raw.logs),
    snapshot: raw.snapshot == null ? null : cloneJson(raw.snapshot),
    deployApprovedAt: Number.isFinite(Number(raw.deployApprovedAt)) ? Number(raw.deployApprovedAt) : 0,
    deployApprovedBy: String(raw.deployApprovedBy ?? ''),
    deployStartedAt: Number.isFinite(Number(raw.deployStartedAt)) ? Number(raw.deployStartedAt) : 0,
    deployedAt: Number.isFinite(Number(raw.deployedAt)) ? Number(raw.deployedAt) : 0,
    previousDeployCommitSha: String(raw.previousDeployCommitSha ?? ''),
    newDeployCommitSha: String(raw.newDeployCommitSha ?? ''),
    deployLog: truncateText(raw.deployLog ?? '', AGENT_TASK_SUMMARY_MAX_LENGTH),
    rollbackApprovedAt: Number.isFinite(Number(raw.rollbackApprovedAt)) ? Number(raw.rollbackApprovedAt) : 0,
    rollbackApprovedBy: String(raw.rollbackApprovedBy ?? ''),
    rollbackStartedAt: Number.isFinite(Number(raw.rollbackStartedAt)) ? Number(raw.rollbackStartedAt) : 0,
    rolledBackAt: Number.isFinite(Number(raw.rolledBackAt)) ? Number(raw.rolledBackAt) : 0,
    rollbackCommitSha: String(raw.rollbackCommitSha ?? ''),
    rollbackLog: truncateText(raw.rollbackLog ?? '', AGENT_TASK_SUMMARY_MAX_LENGTH)
  };
}

function sortTasks(tasks = []) {
  return [...tasks].sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
}

async function readTaskState(filePath = AGENT_TASKS_FILE_PATH) {
  const text = await fsp.readFile(filePath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') {
      return '';
    }
    throw error;
  });

  if (!text.trim()) {
    return createEmptyState();
  }

  const parsed = JSON.parse(text);
  const rawTasks = Array.isArray(parsed) ? parsed : parsed?.tasks;
  return {
    version: Number(parsed?.version ?? 1) || 1,
    tasks: Array.isArray(rawTasks)
      ? rawTasks.map(normalizeTask).filter((task) => task.id)
      : []
  };
}

async function writeTaskState(state, filePath = AGENT_TASKS_FILE_PATH) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const payload = {
    version: 1,
    tasks: sortTasks(state.tasks).map(normalizeTask)
  };
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fsp.rename(tempPath, filePath);
}

function withTaskStore(operation, { filePath = AGENT_TASKS_FILE_PATH, write = true } = {}) {
  const run = taskStoreQueue.then(async () => {
    const state = await readTaskState(filePath);
    const result = await operation(state);
    if (write) {
      await writeTaskState(state, filePath);
    }
    return result;
  });

  taskStoreQueue = run.catch(() => {});
  return run;
}

function addTaskLog(task, message, { level = 'info', data = null, at = Date.now() } = {}) {
  task.logs = normalizeLogs([
    ...(Array.isArray(task.logs) ? task.logs : []),
    {
      at,
      level,
      message,
      data
    }
  ]);
}

export async function listAgentTasks({
  scope = '',
  gameId = '',
  limit = 25,
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  return withTaskStore((state) => {
    const normalizedScope = normalizeScope(scope);
    const normalizedGameId = String(gameId ?? '').trim();
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(Number(limit) || 25)));
    return sortTasks(state.tasks)
      .filter((task) => !scope || task.scope === normalizedScope)
      .filter((task) => !normalizedGameId || task.gameId === normalizedGameId)
      .slice(0, safeLimit);
  }, { filePath, write: false });
}

export async function getAgentTask(taskId, { filePath = AGENT_TASKS_FILE_PATH } = {}) {
  const id = normalizeTaskId(taskId);
  if (!id) {
    return null;
  }

  return withTaskStore((state) => state.tasks.find((task) => task.id === id) ?? null, {
    filePath,
    write: false
  });
}

export async function createAgentTask(payload = {}, {
  createdBy = '',
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const prompt = String(payload.prompt ?? '').trim();
  if (prompt.length < 8) {
    throw new Error('Prompt must be at least 8 characters.');
  }
  if (prompt.length > AGENT_TASK_PROMPT_MAX_LENGTH) {
    throw new Error(`Prompt must be ${AGENT_TASK_PROMPT_MAX_LENGTH} characters or less.`);
  }

  const now = Date.now();
  const task = normalizeTask({
    id: `task_${now.toString(36)}_${randomUUID().slice(0, 8)}`,
    type: 'code_change',
    scope: normalizeScope(payload.scope),
    gameId: String(payload.gameId ?? '').trim(),
    contextType: normalizeContextType(payload.contextType ?? payload.scope),
    contextLabel: String(payload.contextLabel ?? '').trim(),
    prompt,
    mode: normalizeMode(payload.mode),
    status: 'queued',
    createdBy,
    createdAt: now,
    updatedAt: now,
    snapshot: payload.snapshot == null ? null : cloneJson(payload.snapshot),
    logs: [
      {
        at: now,
        level: 'info',
        message: 'Task queued from in-game admin feedback.',
        data: {
          mode: normalizeMode(payload.mode),
          scope: normalizeScope(payload.scope),
          contextType: normalizeContextType(payload.contextType ?? payload.scope)
        }
      }
    ]
  });

  return withTaskStore((state) => {
    state.tasks.push(task);
    return task;
  }, { filePath });
}

export async function claimNextAgentTask({
  workerId = '',
  scope = '',
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const normalizedScope = normalizeScope(scope);
  const shouldFilterScope = String(scope ?? '').trim() !== '';
  const normalizedWorkerId = String(workerId ?? '').trim() || 'agent-worker';
  const now = Date.now();

  return withTaskStore((state) => {
    const rollbackTask = sortTasks(state.tasks)
      .reverse()
      .find((task) => (
        (!shouldFilterScope || task.scope === normalizedScope)
        && task.status === 'deployed'
        && Number(task.rollbackApprovedAt) > 0
        && !Number(task.rollbackStartedAt)
      ));

    if (rollbackTask) {
      rollbackTask.status = 'rolling_back';
      rollbackTask.claimedBy = normalizedWorkerId;
      rollbackTask.claimedAt = now;
      rollbackTask.rollbackStartedAt = now;
      rollbackTask.updatedAt = now;
      addTaskLog(rollbackTask, 'Worker claimed rollback approval.', {
        data: { workerId: normalizedWorkerId }
      });
      return {
        action: 'rollback',
        task: rollbackTask
      };
    }

    const deployTask = sortTasks(state.tasks)
      .reverse()
      .find((task) => (
        (!shouldFilterScope || task.scope === normalizedScope)
        && task.status === 'ready_for_review'
        && Number(task.deployApprovedAt) > 0
        && !Number(task.deployStartedAt)
      ));

    if (deployTask) {
      deployTask.status = 'deploying';
      deployTask.claimedBy = normalizedWorkerId;
      deployTask.claimedAt = now;
      deployTask.deployStartedAt = now;
      deployTask.updatedAt = now;
      addTaskLog(deployTask, 'Worker claimed deploy approval.', {
        data: { workerId: normalizedWorkerId }
      });
      return {
        action: 'deploy',
        task: deployTask
      };
    }

    const queuedTask = sortTasks(state.tasks)
      .reverse()
      .find((task) => (!shouldFilterScope || task.scope === normalizedScope) && task.status === 'queued');

    if (!queuedTask) {
      return {
        action: '',
        task: null
      };
    }

    queuedTask.status = 'claimed';
    queuedTask.claimedBy = normalizedWorkerId;
    queuedTask.claimedAt = now;
    queuedTask.updatedAt = now;
    addTaskLog(queuedTask, 'Worker claimed task.', {
      data: { workerId: normalizedWorkerId }
    });
    return {
      action: 'code_change',
      task: queuedTask
    };
  }, { filePath });
}

export async function updateAgentTask(taskId, updates = {}, {
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const id = normalizeTaskId(taskId);
  if (!id) {
    throw new Error('Task id is required.');
  }

  return withTaskStore((state) => {
    const task = state.tasks.find((entry) => entry.id === id);
    if (!task) {
      return null;
    }

    for (const [key, value] of Object.entries(updates ?? {})) {
      if (!MUTABLE_TASK_FIELDS.has(key)) {
        continue;
      }

      if (key === 'status') {
        const status = normalizeStatus(value);
        if (!status) {
          throw new Error(`Invalid task status: ${String(value)}`);
        }
        task.status = status;
      } else if (['claimedAt', 'deployStartedAt', 'deployedAt', 'rollbackStartedAt', 'rolledBackAt'].includes(key)) {
        task[key] = Number.isFinite(Number(value)) ? Number(value) : 0;
      } else if (key === 'changedFiles') {
        task.changedFiles = normalizeStringList(value);
      } else if (key === 'deployTargets') {
        task.deployTargets = normalizeDeployTargets(value);
      } else if (key === 'error') {
        task.error = truncateText(value, AGENT_TASK_ERROR_MAX_LENGTH);
      } else if (key === 'summary' || key === 'deployLog' || key === 'rollbackLog') {
        task[key] = truncateText(value, AGENT_TASK_SUMMARY_MAX_LENGTH);
      } else {
        task[key] = String(value ?? '');
      }
    }

    task.updatedAt = Date.now();
    return task;
  }, { filePath });
}

export async function appendAgentTaskLog(taskId, entry = {}, {
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const id = normalizeTaskId(taskId);
  if (!id) {
    throw new Error('Task id is required.');
  }

  return withTaskStore((state) => {
    const task = state.tasks.find((candidate) => candidate.id === id);
    if (!task) {
      return null;
    }

    addTaskLog(task, entry.message ?? '', {
      level: entry.level ?? 'info',
      data: entry.data ?? null,
      at: entry.at
    });
    task.updatedAt = Date.now();
    return task;
  }, { filePath });
}

export async function cancelAgentTask(taskId, {
  cancelledBy = '',
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const terminalStatuses = new Set(['deployed', 'rolled_back', 'cancelled']);
  const id = normalizeTaskId(taskId);
  if (!id) {
    throw new Error('Task id is required.');
  }

  return withTaskStore((state) => {
    const task = state.tasks.find((candidate) => candidate.id === id);
    if (!task) {
      return null;
    }

    if (terminalStatuses.has(task.status)) {
      return task;
    }

    task.status = 'cancelled';
    task.updatedAt = Date.now();
    addTaskLog(task, 'Task cancelled by admin.', {
      level: 'warn',
      data: { cancelledBy }
    });
    return task;
  }, { filePath });
}

export async function approveAgentTaskDeploy(taskId, {
  approvedBy = '',
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const id = normalizeTaskId(taskId);
  if (!id) {
    throw new Error('Task id is required.');
  }

  return withTaskStore((state) => {
    const task = state.tasks.find((candidate) => candidate.id === id);
    if (!task) {
      return null;
    }

    if (task.status !== 'ready_for_review') {
      throw new Error('Only ready-for-review tasks can be approved for deploy.');
    }

    task.deployApprovedAt = Date.now();
    task.deployApprovedBy = String(approvedBy ?? '');
    task.updatedAt = Date.now();
    addTaskLog(task, 'Admin approved production deploy.', {
      data: { approvedBy }
    });
    return task;
  }, { filePath });
}

export async function approveAgentTaskRollback(taskId, {
  approvedBy = '',
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const id = normalizeTaskId(taskId);
  if (!id) {
    throw new Error('Task id is required.');
  }

  return withTaskStore((state) => {
    const task = state.tasks.find((candidate) => candidate.id === id);
    if (!task) {
      return null;
    }

    if (task.status !== 'deployed') {
      throw new Error('Only deployed tasks can be approved for rollback.');
    }

    if (Number(task.rollbackApprovedAt) > 0) {
      return task;
    }

    task.rollbackApprovedAt = Date.now();
    task.rollbackApprovedBy = String(approvedBy ?? '');
    task.updatedAt = Date.now();
    addTaskLog(task, 'Admin approved rollback.', {
      level: 'warn',
      data: { approvedBy }
    });
    return task;
  }, { filePath });
}
