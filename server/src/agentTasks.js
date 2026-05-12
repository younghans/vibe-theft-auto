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
export const AGENT_TASK_THREAD_HISTORY_LIMIT = 12;
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
  'agentMessage',
  'codexSessionId',
  'claimedBy',
  'claimedAt',
  'workStartedAt',
  'workCompletedAt',
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

const THREAD_ACTIVE_STATUSES = new Set([
  'queued',
  'claimed',
  'preparing',
  'coding',
  'testing',
  'deploying',
  'rolling_back'
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

function normalizeTimestamp(value, fallback = 0) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : fallback;
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

function normalizeThreadHistory(history = []) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history.slice(-AGENT_TASK_THREAD_HISTORY_LIMIT).map((entry) => ({
    taskId: normalizeTaskId(entry?.taskId),
    parentTaskId: normalizeTaskId(entry?.parentTaskId),
    prompt: truncateText(entry?.prompt ?? '', AGENT_TASK_PROMPT_MAX_LENGTH),
    status: normalizeStatus(entry?.status) || 'queued',
    summary: truncateText(entry?.summary ?? '', AGENT_TASK_SUMMARY_MAX_LENGTH),
    agentMessage: truncateText(entry?.agentMessage ?? '', AGENT_TASK_SUMMARY_MAX_LENGTH),
    error: truncateText(entry?.error ?? '', AGENT_TASK_ERROR_MAX_LENGTH),
    branch: String(entry?.branch ?? ''),
    commitSha: String(entry?.commitSha ?? ''),
    deployTargets: normalizeDeployTargets(entry?.deployTargets),
    changedFiles: normalizeStringList(entry?.changedFiles),
    createdAt: Number.isFinite(Number(entry?.createdAt)) ? Number(entry.createdAt) : 0,
    updatedAt: Number.isFinite(Number(entry?.updatedAt)) ? Number(entry.updatedAt) : 0
  })).filter((entry) => entry.taskId || entry.prompt || entry.agentMessage || entry.summary);
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
  const status = normalizeStatus(raw.status) || 'queued';
  const createdAt = normalizeTimestamp(raw.createdAt, now);
  const updatedAt = normalizeTimestamp(raw.updatedAt, now);
  const claimedAt = normalizeTimestamp(raw.claimedAt, 0);
  const workStartedAt = normalizeTimestamp(raw.workStartedAt, claimedAt);
  const workCompletedAt = normalizeTimestamp(
    raw.workCompletedAt,
    status === 'ready_for_review' ? updatedAt : 0
  );
  const threadId = normalizeTaskId(raw.threadId) || id;
  return {
    id,
    type: String(raw.type ?? 'code_change') || 'code_change',
    threadId,
    parentTaskId: normalizeTaskId(raw.parentTaskId),
    threadTitle: String(raw.threadTitle ?? '').trim().slice(0, 160),
    baseBranch: String(raw.baseBranch ?? '').trim(),
    baseCommitSha: String(raw.baseCommitSha ?? '').trim(),
    scope: normalizeScope(raw.scope),
    gameId: String(raw.gameId ?? '').trim(),
    contextType: normalizeContextType(raw.contextType ?? raw.scope),
    contextLabel: String(raw.contextLabel ?? '').trim().slice(0, 160),
    prompt: truncateText(raw.prompt ?? '', AGENT_TASK_PROMPT_MAX_LENGTH),
    mode: normalizeMode(raw.mode),
    status,
    createdBy: String(raw.createdBy ?? ''),
    createdAt,
    updatedAt,
    claimedBy: String(raw.claimedBy ?? ''),
    claimedAt,
    workStartedAt,
    workCompletedAt,
    branch: String(raw.branch ?? ''),
    commitSha: String(raw.commitSha ?? ''),
    previewUrl: String(raw.previewUrl ?? ''),
    deployUrl: String(raw.deployUrl ?? ''),
    changedFiles: normalizeStringList(raw.changedFiles),
    deployTargets: normalizeDeployTargets(raw.deployTargets),
    error: truncateText(raw.error ?? '', AGENT_TASK_ERROR_MAX_LENGTH),
    summary: truncateText(raw.summary ?? '', AGENT_TASK_SUMMARY_MAX_LENGTH),
    agentMessage: truncateText(raw.agentMessage ?? '', AGENT_TASK_SUMMARY_MAX_LENGTH),
    codexSessionId: String(raw.codexSessionId ?? '').trim(),
    threadHistory: normalizeThreadHistory(raw.threadHistory),
    logs: normalizeLogs(raw.logs),
    snapshot: raw.snapshot == null ? null : cloneJson(raw.snapshot),
    deployApprovedAt: normalizeTimestamp(raw.deployApprovedAt, 0),
    deployApprovedBy: String(raw.deployApprovedBy ?? ''),
    deployStartedAt: normalizeTimestamp(raw.deployStartedAt, 0),
    deployedAt: normalizeTimestamp(raw.deployedAt, 0),
    previousDeployCommitSha: String(raw.previousDeployCommitSha ?? ''),
    newDeployCommitSha: String(raw.newDeployCommitSha ?? ''),
    deployLog: truncateText(raw.deployLog ?? '', AGENT_TASK_SUMMARY_MAX_LENGTH),
    rollbackApprovedAt: normalizeTimestamp(raw.rollbackApprovedAt, 0),
    rollbackApprovedBy: String(raw.rollbackApprovedBy ?? ''),
    rollbackStartedAt: normalizeTimestamp(raw.rollbackStartedAt, 0),
    rolledBackAt: normalizeTimestamp(raw.rolledBackAt, 0),
    rollbackCommitSha: String(raw.rollbackCommitSha ?? ''),
    rollbackLog: truncateText(raw.rollbackLog ?? '', AGENT_TASK_SUMMARY_MAX_LENGTH)
  };
}

function sortTasks(tasks = []) {
  return [...tasks].sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0));
}

function sortTasksAscending(tasks = []) {
  return [...tasks].sort((a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0));
}

function getTaskThreadId(task = {}) {
  return normalizeTaskId(task.threadId) || normalizeTaskId(task.id);
}

function isThreadActiveTask(task = {}) {
  if (THREAD_ACTIVE_STATUSES.has(String(task.status ?? ''))) {
    return true;
  }

  return task.status === 'ready_for_review' && Number(task.deployApprovedAt ?? 0) > 0;
}

function getThreadTitleFromTask(task = {}) {
  return String(task.threadTitle || task.prompt || task.contextLabel || task.gameId || 'Game prompt')
    .trim()
    .slice(0, 160);
}

function createThreadHistoryEntry(task = {}) {
  return {
    taskId: String(task.id ?? ''),
    parentTaskId: String(task.parentTaskId ?? ''),
    prompt: task.prompt ?? '',
    status: task.status ?? '',
    summary: task.summary ?? '',
    agentMessage: task.agentMessage ?? '',
    error: task.error ?? '',
    branch: task.branch ?? '',
    commitSha: task.commitSha ?? '',
    deployTargets: task.deployTargets ?? [],
    changedFiles: task.changedFiles ?? [],
    createdAt: task.createdAt ?? 0,
    updatedAt: task.updatedAt ?? 0
  };
}

function buildThreadHistory(tasks = [], threadId = '') {
  return normalizeThreadHistory(sortTasksAscending(tasks)
    .filter((task) => getTaskThreadId(task) === threadId)
    .map(createThreadHistoryEntry));
}

function getFollowupBaseTask(threadTasks = []) {
  return sortTasks(threadTasks)
    .find((task) => (
      task.status === 'ready_for_review'
      && String(task.branch ?? '').trim()
      && String(task.commitSha ?? '').trim()
    )) ?? null;
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
  return withTaskStore((state) => {
    const id = `task_${now.toString(36)}_${randomUUID().slice(0, 8)}`;
    const parentTaskId = normalizeTaskId(payload.parentTaskId);
    const parentTask = parentTaskId
      ? state.tasks.find((candidate) => candidate.id === parentTaskId)
      : null;

    if (parentTaskId && !parentTask) {
      throw new Error('Parent task not found.');
    }

    const explicitThreadId = normalizeTaskId(payload.threadId);
    const threadId = parentTask
      ? getTaskThreadId(parentTask)
      : explicitThreadId || id;
    const threadTasks = state.tasks.filter((task) => getTaskThreadId(task) === threadId);
    const activeThreadTask = threadTasks.find(isThreadActiveTask);
    if (parentTask && activeThreadTask) {
      throw new Error('This prompt thread already has an active worker run.');
    }

    const baseTask = parentTask ? getFollowupBaseTask(threadTasks) : null;
    const threadTitle = String(payload.threadTitle ?? '').trim()
      || (parentTask ? getThreadTitleFromTask(parentTask) : '')
      || prompt;
    const threadHistory = parentTask ? buildThreadHistory(state.tasks, threadId) : [];
    const task = normalizeTask({
      id,
      type: 'code_change',
      threadId,
      parentTaskId: parentTask?.id ?? '',
      threadTitle,
      baseBranch: baseTask?.branch ?? '',
      baseCommitSha: baseTask?.commitSha ?? '',
      scope: normalizeScope(payload.scope || parentTask?.scope),
      gameId: String(payload.gameId ?? parentTask?.gameId ?? '').trim(),
      contextType: normalizeContextType(payload.contextType ?? parentTask?.contextType ?? payload.scope),
      contextLabel: String(payload.contextLabel ?? parentTask?.contextLabel ?? '').trim(),
      prompt,
      mode: normalizeMode(payload.mode),
      status: 'queued',
      createdBy,
      createdAt: now,
      updatedAt: now,
      snapshot: payload.snapshot == null ? null : cloneJson(payload.snapshot),
      threadHistory,
      logs: [
        {
          at: now,
          level: 'info',
          message: parentTask ? 'Follow-up queued in prompt thread.' : 'Task queued from in-game admin feedback.',
          data: {
            mode: normalizeMode(payload.mode),
            scope: normalizeScope(payload.scope || parentTask?.scope),
            contextType: normalizeContextType(payload.contextType ?? parentTask?.contextType ?? payload.scope),
            threadId,
            parentTaskId: parentTask?.id ?? '',
            baseBranch: baseTask?.branch ?? ''
          }
        }
      ]
    });
    state.tasks.push(task);
    return task;
  }, { filePath });
}

export async function claimNextAgentTask({
  workerId = '',
  scope = '',
  deployEnabled = true,
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const normalizedScope = normalizeScope(scope);
  const shouldFilterScope = String(scope ?? '').trim() !== '';
  const normalizedWorkerId = String(workerId ?? '').trim() || 'agent-worker';
  const canClaimDeployActions = deployEnabled !== false;
  const now = Date.now();

  return withTaskStore((state) => {
    if (canClaimDeployActions) {
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
    queuedTask.workStartedAt = now;
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

    const now = Date.now();
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
        if (['claimed', 'preparing', 'coding', 'testing'].includes(status) && Number(task.workStartedAt) <= 0) {
          task.workStartedAt = now;
        }
        if (status === 'ready_for_review' && Number(task.workCompletedAt) <= 0) {
          task.workCompletedAt = now;
        }
      } else if (['claimedAt', 'workStartedAt', 'workCompletedAt', 'deployStartedAt', 'deployedAt', 'rollbackStartedAt', 'rolledBackAt'].includes(key)) {
        task[key] = Number.isFinite(Number(value)) ? Number(value) : 0;
      } else if (key === 'changedFiles') {
        task.changedFiles = normalizeStringList(value);
      } else if (key === 'deployTargets') {
        task.deployTargets = normalizeDeployTargets(value);
      } else if (key === 'error') {
        task.error = truncateText(value, AGENT_TASK_ERROR_MAX_LENGTH);
      } else if (['summary', 'agentMessage', 'deployLog', 'rollbackLog'].includes(key)) {
        task[key] = truncateText(value, AGENT_TASK_SUMMARY_MAX_LENGTH);
      } else {
        task[key] = String(value ?? '');
      }
    }

    task.updatedAt = now;
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
