import { randomUUID } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readPostgresAgentTaskThread,
  readPostgresAgentTaskThreadSummaries,
  readPostgresAgentState,
  shouldUsePostgresAgentState,
  withPostgresAgentState
} from './agentJsonStateStore.js';

const AGENT_TASKS_FILE_PATH_CONFIGURED = Boolean(process.env.AGENT_TASKS_FILE_PATH);
export const AGENT_TASKS_FILE_PATH = process.env.AGENT_TASKS_FILE_PATH
  ? path.resolve(process.env.AGENT_TASKS_FILE_PATH)
  : fileURLToPath(new URL('../data/agent-tasks.json', import.meta.url));
const DEFAULT_AGENT_TASKS_FILE_PATH = fileURLToPath(new URL('../data/agent-tasks.json', import.meta.url));
const AGENT_TASKS_STATE_KEY = 'agent_tasks';

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
  'workerHeartbeatAt',
  'workerHeartbeatStatus',
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
const WORKER_HEARTBEAT_ACTIVE_STATUSES = new Set([
  'claimed',
  'preparing',
  'coding',
  'testing'
]);
const FOLLOWUP_BASE_STATUSES = new Set([
  'ready_for_review',
  'deployed'
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
  const workerHeartbeatAt = normalizeTimestamp(raw.workerHeartbeatAt, 0);
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
    workerHeartbeatAt,
    workerHeartbeatStatus: String(raw.workerHeartbeatStatus ?? '').trim().slice(0, 120),
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

function getTaskActivityTimestamp(task = {}) {
  return Math.max(
    normalizeTimestamp(task.updatedAt, 0),
    normalizeTimestamp(task.workCompletedAt, 0),
    normalizeTimestamp(task.workStartedAt, 0),
    normalizeTimestamp(task.deployStartedAt, 0),
    normalizeTimestamp(task.deployedAt, 0),
    normalizeTimestamp(task.rollbackStartedAt, 0),
    normalizeTimestamp(task.rolledBackAt, 0),
    normalizeTimestamp(task.deployApprovedAt, 0),
    normalizeTimestamp(task.rollbackApprovedAt, 0),
    normalizeTimestamp(task.claimedAt, 0),
    normalizeTimestamp(task.createdAt, 0)
  );
}

function projectAgentTaskForPrompt(task = {}, {
  includeMessages = false
} = {}) {
  const projected = {
    id: task.id,
    type: task.type,
    threadId: task.threadId,
    parentTaskId: task.parentTaskId,
    threadTitle: task.threadTitle,
    scope: task.scope,
    gameId: task.gameId,
    contextType: task.contextType,
    contextLabel: task.contextLabel,
    prompt: includeMessages ? task.prompt : truncateText(task.prompt, 1200),
    mode: task.mode,
    status: task.status,
    createdBy: task.createdBy,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    claimedBy: task.claimedBy,
    claimedAt: task.claimedAt,
    workerHeartbeatAt: task.workerHeartbeatAt,
    workerHeartbeatStatus: task.workerHeartbeatStatus,
    workStartedAt: task.workStartedAt,
    workCompletedAt: task.workCompletedAt,
    branch: task.branch,
    commitSha: task.commitSha,
    previewUrl: task.previewUrl,
    deployUrl: task.deployUrl,
    changedFiles: task.changedFiles,
    deployTargets: task.deployTargets,
    deployApprovedAt: task.deployApprovedAt,
    deployApprovedBy: task.deployApprovedBy,
    deployStartedAt: task.deployStartedAt,
    deployedAt: task.deployedAt,
    previousDeployCommitSha: task.previousDeployCommitSha,
    newDeployCommitSha: task.newDeployCommitSha,
    rollbackApprovedAt: task.rollbackApprovedAt,
    rollbackApprovedBy: task.rollbackApprovedBy,
    rollbackStartedAt: task.rollbackStartedAt,
    rolledBackAt: task.rolledBackAt,
    rollbackCommitSha: task.rollbackCommitSha
  };

  if (includeMessages) {
    projected.error = task.error;
    projected.summary = task.summary;
    projected.agentMessage = task.agentMessage;
  } else if (task.error) {
    projected.error = truncateText(task.error, 1200);
  }

  return projected;
}

function getLatestTaskByThread(tasks = []) {
  const groups = new Map();
  for (const task of tasks) {
    const threadId = getTaskThreadId(task);
    if (!threadId) {
      continue;
    }
    if (!groups.has(threadId)) {
      groups.set(threadId, []);
    }
    groups.get(threadId).push(task);
  }

  return [...groups.values()]
    .map((threadTasks) => ({
      latestTask: sortTasks(threadTasks)[0] ?? null,
      activityAt: threadTasks.reduce((latest, task) => Math.max(latest, getTaskActivityTimestamp(task)), 0)
    }))
    .filter((thread) => thread.latestTask)
    .sort((a, b) => b.activityAt - a.activityAt)
    .map((thread) => thread.latestTask);
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
      FOLLOWUP_BASE_STATUSES.has(String(task.status ?? ''))
      && (
        String(task.branch ?? '').trim()
        || String(task.newDeployCommitSha ?? '').trim()
        || String(task.commitSha ?? '').trim()
      )
      && String(getFollowupBaseCommitSha(task)).trim()
    )) ?? null;
}

function getFollowupBaseBranch(task = null) {
  if (!task || task.status === 'deployed') {
    return '';
  }

  return String(task.branch ?? '').trim();
}

function getFollowupBaseCommitSha(task = null) {
  if (!task) {
    return '';
  }

  return String(task.status === 'deployed'
    ? task.newDeployCommitSha || task.commitSha
    : task.commitSha).trim();
}

async function readTaskState(filePath = AGENT_TASKS_FILE_PATH) {
  if (shouldUseTaskPostgresState(filePath)) {
    return normalizeTaskState(await readPostgresAgentState(
      AGENT_TASKS_STATE_KEY,
      await readTaskFileState(filePath)
    ));
  }

  return readTaskFileState(filePath);
}

async function readTaskFileState(filePath = AGENT_TASKS_FILE_PATH) {
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
  return normalizeTaskState(parsed);
}

function normalizeTaskState(parsed = {}) {
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

function shouldUseTaskPostgresState(filePath = AGENT_TASKS_FILE_PATH) {
  return shouldUsePostgresAgentState({
    filePath,
    defaultFilePath: DEFAULT_AGENT_TASKS_FILE_PATH,
    filePathConfigured: AGENT_TASKS_FILE_PATH_CONFIGURED
  });
}

function withTaskStore(operation, { filePath = AGENT_TASKS_FILE_PATH, write = true } = {}) {
  if (shouldUseTaskPostgresState(filePath)) {
    const run = taskStoreQueue.then(async () => {
      const fallbackState = await readTaskFileState(filePath);
      return withPostgresAgentState(AGENT_TASKS_STATE_KEY, fallbackState, async (rawState) => {
        const state = normalizeTaskState(rawState);
        const result = await operation(state);
        rawState.version = 1;
        rawState.tasks = sortTasks(state.tasks).map(normalizeTask);
        return result;
      }, { write });
    });

    taskStoreQueue = run.catch(() => {});
    return run;
  }

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

function getStaleActiveMs(value) {
  return Math.max(0, Number(value) || 0);
}

function getStaleDeployReferenceAt(task = {}) {
  return Number(task.workerHeartbeatAt || 0)
    || Number(task.deployStartedAt || task.claimedAt || task.updatedAt || 0);
}

function isDeployTaskStale(task = {}, now = Date.now(), staleDeployingMs = 0) {
  const referenceAt = getStaleDeployReferenceAt(task);
  return referenceAt > 0 && now - referenceAt >= staleDeployingMs;
}

function failStaleActiveTasks(state, {
  now = Date.now(),
  staleActiveAfterMs = 0,
  scope = '',
  shouldFilterScope = false
} = {}) {
  const staleActiveMs = getStaleActiveMs(staleActiveAfterMs);
  if (staleActiveMs <= 0) {
    return [];
  }

  const failedTasks = [];
  for (const task of state.tasks) {
    if (shouldFilterScope && task.scope !== scope) {
      continue;
    }
    if (!WORKER_HEARTBEAT_ACTIVE_STATUSES.has(String(task.status ?? ''))) {
      continue;
    }

    const heartbeatAt = Number(task.workerHeartbeatAt || 0);
    if (heartbeatAt <= 0 || now - heartbeatAt < staleActiveMs) {
      continue;
    }

    const previousStatus = String(task.status ?? '');
    const staleMs = now - heartbeatAt;
    task.status = 'failed';
    task.workCompletedAt = Number(task.workCompletedAt) > 0 ? task.workCompletedAt : now;
    task.updatedAt = now;
    task.workerHeartbeatStatus = 'expired';
    task.error = truncateText(
      `Worker heartbeat expired while task was ${previousStatus || 'active'}. Last heartbeat was ${Math.round(staleMs / 1000)} seconds ago.`,
      AGENT_TASK_ERROR_MAX_LENGTH
    );
    task.summary = truncateText('Worker stopped sending heartbeats before completing the task.', AGENT_TASK_SUMMARY_MAX_LENGTH);
    addTaskLog(task, 'Worker heartbeat expired; marking task failed.', {
      level: 'error',
      at: now,
      data: {
        previousStatus,
        claimedBy: task.claimedBy ?? '',
        workerHeartbeatAt: heartbeatAt,
        staleActiveAfterMs: staleActiveMs,
        staleMs
      }
    });
    failedTasks.push(task);
  }

  return failedTasks;
}

export async function listAgentTasks({
  scope = '',
  gameId = '',
  limit = 25,
  staleActiveAfterMs = 0,
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const staleActiveMs = getStaleActiveMs(staleActiveAfterMs);
  return withTaskStore((state) => {
    const normalizedScope = normalizeScope(scope);
    const shouldFilterScope = String(scope ?? '').trim() !== '';
    failStaleActiveTasks(state, {
      now: Date.now(),
      staleActiveAfterMs: staleActiveMs,
      scope: normalizedScope,
      shouldFilterScope
    });
    const normalizedGameId = String(gameId ?? '').trim();
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(Number(limit) || 25)));
    return sortTasks(state.tasks)
      .filter((task) => !shouldFilterScope || task.scope === normalizedScope)
      .filter((task) => !normalizedGameId || task.gameId === normalizedGameId)
      .slice(0, safeLimit);
  }, { filePath, write: staleActiveMs > 0 });
}

export async function listAgentTaskThreads({
  scope = '',
  gameId = '',
  limit = 10,
  offset = 0,
  compact = false,
  staleActiveAfterMs = 0,
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const staleActiveMs = getStaleActiveMs(staleActiveAfterMs);
  const safeLimit = Math.max(1, Math.min(101, Math.trunc(Number(limit) || 10)));
  const safeOffset = Math.max(0, Math.trunc(Number(offset) || 0));
  if (compact && staleActiveMs <= 0 && shouldUseTaskPostgresState(filePath)) {
    return readPostgresAgentTaskThreadSummaries(AGENT_TASKS_STATE_KEY, {
      fallbackState: await readTaskFileState(filePath),
      scope,
      gameId,
      limit: safeLimit,
      offset: safeOffset
    });
  }

  return withTaskStore((state) => {
    const normalizedScope = normalizeScope(scope);
    const shouldFilterScope = String(scope ?? '').trim() !== '';
    failStaleActiveTasks(state, {
      now: Date.now(),
      staleActiveAfterMs: staleActiveMs,
      scope: normalizedScope,
      shouldFilterScope
    });
    const normalizedGameId = String(gameId ?? '').trim();
    const filteredTasks = state.tasks
      .filter((task) => !shouldFilterScope || task.scope === normalizedScope)
      .filter((task) => !normalizedGameId || task.gameId === normalizedGameId);
    const latestTasks = getLatestTaskByThread(filteredTasks).slice(safeOffset, safeOffset + safeLimit);
    return compact
      ? latestTasks.map((task) => projectAgentTaskForPrompt(task))
      : latestTasks;
  }, { filePath, write: staleActiveMs > 0 });
}

export async function getAgentTask(taskId, {
  staleActiveAfterMs = 0,
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const id = normalizeTaskId(taskId);
  if (!id) {
    return null;
  }

  const staleActiveMs = getStaleActiveMs(staleActiveAfterMs);
  return withTaskStore((state) => {
    failStaleActiveTasks(state, {
      now: Date.now(),
      staleActiveAfterMs: staleActiveMs
    });
    return state.tasks.find((task) => task.id === id) ?? null;
  }, {
    filePath,
    write: staleActiveMs > 0
  });
}

export async function getAgentTaskThread(taskId, {
  compact = false,
  staleActiveAfterMs = 0,
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const id = normalizeTaskId(taskId);
  if (!id) {
    return [];
  }

  const staleActiveMs = getStaleActiveMs(staleActiveAfterMs);
  if (compact && staleActiveMs <= 0 && shouldUseTaskPostgresState(filePath)) {
    return readPostgresAgentTaskThread(AGENT_TASKS_STATE_KEY, {
      fallbackState: await readTaskFileState(filePath),
      taskId: id
    });
  }

  return withTaskStore((state) => {
    failStaleActiveTasks(state, {
      now: Date.now(),
      staleActiveAfterMs: staleActiveMs
    });
    const selectedTask = state.tasks.find((task) => task.id === id);
    if (!selectedTask) {
      return [];
    }
    const threadId = getTaskThreadId(selectedTask);
    const threadTasks = sortTasksAscending(
      state.tasks.filter((task) => getTaskThreadId(task) === threadId)
    );
    return compact
      ? threadTasks.map((task) => projectAgentTaskForPrompt(task, { includeMessages: true }))
      : threadTasks;
  }, {
    filePath,
    write: staleActiveMs > 0
  });
}

export async function createAgentTask(payload = {}, {
  createdBy = '',
  staleActiveAfterMs = 0,
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
    failStaleActiveTasks(state, {
      now,
      staleActiveAfterMs: getStaleActiveMs(staleActiveAfterMs)
    });
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
    const baseBranch = getFollowupBaseBranch(baseTask);
    const baseCommitSha = getFollowupBaseCommitSha(baseTask);
    const task = normalizeTask({
      id,
      type: 'code_change',
      threadId,
      parentTaskId: parentTask?.id ?? '',
      threadTitle,
      baseBranch,
      baseCommitSha,
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
            baseBranch,
            baseCommitSha
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
  codeEnabled = true,
  staleDeployingAfterMs = 0,
  staleActiveAfterMs = 0,
  workerHeartbeatEnabled = false,
  filePath = AGENT_TASKS_FILE_PATH
} = {}) {
  const normalizedScope = normalizeScope(scope);
  const shouldFilterScope = String(scope ?? '').trim() !== '';
  const normalizedWorkerId = String(workerId ?? '').trim() || 'agent-worker';
  const canClaimDeployActions = deployEnabled !== false;
  const canClaimCodeActions = codeEnabled !== false;
  const staleDeployingMs = Math.max(0, Number(staleDeployingAfterMs) || 0);
  const staleActiveMs = getStaleActiveMs(staleActiveAfterMs);
  const shouldRecordHeartbeat = workerHeartbeatEnabled === true;
  const now = Date.now();

  return withTaskStore((state) => {
    failStaleActiveTasks(state, {
      now,
      staleActiveAfterMs: staleActiveMs,
      scope: normalizedScope,
      shouldFilterScope
    });

    if (canClaimDeployActions) {
      if (staleDeployingMs > 0) {
        const staleDeployingTask = sortTasks(state.tasks)
          .reverse()
          .find((task) => {
            if (shouldFilterScope && task.scope !== normalizedScope) {
              return false;
            }

            if (task.status !== 'deploying' || !String(task.commitSha ?? '').trim()) {
              return false;
            }

            return isDeployTaskStale(task, now, staleDeployingMs);
          });

        if (staleDeployingTask) {
          const staleReferenceAt = getStaleDeployReferenceAt(staleDeployingTask);
          staleDeployingTask.claimedBy = normalizedWorkerId;
          staleDeployingTask.claimedAt = now;
          if (shouldRecordHeartbeat) {
            staleDeployingTask.workerHeartbeatAt = now;
            staleDeployingTask.workerHeartbeatStatus = 'reconciling_deploy';
          }
          staleDeployingTask.updatedAt = now;
          addTaskLog(staleDeployingTask, 'Worker claimed stale deploy reconciliation.', {
            level: 'warn',
            data: {
              workerId: normalizedWorkerId,
              staleDeployingAfterMs: staleDeployingMs,
              staleReferenceAt
            }
          });
          return {
            action: 'reconcile_deploy',
            task: staleDeployingTask
          };
        }
      }

      const activeDeployTask = sortTasks(state.tasks)
        .reverse()
        .find((task) => {
          if (shouldFilterScope && task.scope !== normalizedScope) {
            return false;
          }

          if (!['deploying', 'rolling_back'].includes(task.status)) {
            return false;
          }

          if (task.status === 'deploying' && staleDeployingMs > 0) {
            return !isDeployTaskStale(task, now, staleDeployingMs);
          }

          return true;
        });

      if (!activeDeployTask) {
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
          if (shouldRecordHeartbeat) {
            rollbackTask.workerHeartbeatAt = now;
            rollbackTask.workerHeartbeatStatus = 'rolling_back';
          }
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
          if (shouldRecordHeartbeat) {
            deployTask.workerHeartbeatAt = now;
            deployTask.workerHeartbeatStatus = 'deploying';
          }
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
    }

    if (!canClaimCodeActions) {
      return {
        action: '',
        task: null
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
    if (shouldRecordHeartbeat) {
      queuedTask.workerHeartbeatAt = now;
      queuedTask.workerHeartbeatStatus = 'claimed';
    }
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
        const previousStatus = task.status;
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
        if (
          status === 'ready_for_review'
          && previousStatus === 'failed'
          && Number(task.deployStartedAt) > 0
        ) {
          task.deployApprovedAt = 0;
          task.deployApprovedBy = '';
          task.deployStartedAt = 0;
          task.claimedBy = '';
          task.claimedAt = 0;
          task.workerHeartbeatAt = 0;
          task.workerHeartbeatStatus = '';
          addTaskLog(task, 'Failed deploy reset to ready for review; stale deploy approval cleared.', {
            level: 'warn',
            data: { previousStatus }
          });
        }
      } else if (['claimedAt', 'workerHeartbeatAt', 'workStartedAt', 'workCompletedAt', 'deployStartedAt', 'deployedAt', 'rollbackStartedAt', 'rolledBackAt'].includes(key)) {
        task[key] = Number.isFinite(Number(value)) ? Number(value) : 0;
      } else if (key === 'changedFiles') {
        task.changedFiles = normalizeStringList(value);
      } else if (key === 'deployTargets') {
        task.deployTargets = normalizeDeployTargets(value);
      } else if (key === 'error') {
        task.error = truncateText(value, AGENT_TASK_ERROR_MAX_LENGTH);
      } else if (['summary', 'agentMessage', 'deployLog', 'rollbackLog'].includes(key)) {
        task[key] = truncateText(value, AGENT_TASK_SUMMARY_MAX_LENGTH);
      } else if (key === 'workerHeartbeatStatus') {
        task.workerHeartbeatStatus = String(value ?? '').trim().slice(0, 120);
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

    const now = Date.now();
    task.deployApprovedAt = now;
    task.deployApprovedBy = String(approvedBy ?? '');
    task.updatedAt = now;
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
