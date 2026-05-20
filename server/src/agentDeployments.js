import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readPostgresAgentState,
  shouldUsePostgresAgentState,
  withPostgresAgentState
} from './agentJsonStateStore.js';

const AGENT_DEPLOYMENTS_FILE_PATH_CONFIGURED = Boolean(process.env.AGENT_DEPLOYMENTS_FILE_PATH);
export const AGENT_DEPLOYMENTS_FILE_PATH = process.env.AGENT_DEPLOYMENTS_FILE_PATH
  ? path.resolve(process.env.AGENT_DEPLOYMENTS_FILE_PATH)
  : fileURLToPath(new URL('../data/agent-deployments.json', import.meta.url));
const DEFAULT_AGENT_DEPLOYMENTS_FILE_PATH = fileURLToPath(new URL('../data/agent-deployments.json', import.meta.url));
const AGENT_DEPLOYMENTS_STATE_KEY = 'agent_deployments';

const DEPLOYMENT_HISTORY_LIMIT = 50;
const AGENT_DEPLOYMENT_TARGET_VALUES = new Set(['frontend', 'backend']);

let deploymentStoreQueue = Promise.resolve();

function removeFirstArrayEntry(values) {
  if (!Array.isArray(values) || !values.length) {
    return null;
  }
  const entry = values[0];
  for (let index = 1; index < values.length; index += 1) {
    values[index - 1] = values[index];
  }
  values.length -= 1;
  return entry;
}

function createEmptyState() {
  return {
    version: 1,
    currentCommitSha: '',
    previousCommitSha: '',
    currentTaskId: '',
    lastAction: '',
    deployedAt: 0,
    rolledBackAt: 0,
    updatedAt: 0,
    history: []
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function normalizeTimestamp(value = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function normalizeDeployTargets(value = []) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[\n,]/u);
  const seen = new Set();
  const targets = [];
  for (let index = 0; index < rawItems.length; index += 1) {
    const target = String(rawItems[index] ?? '').trim().toLowerCase();
    if (AGENT_DEPLOYMENT_TARGET_VALUES.has(target) && !seen.has(target)) {
      seen.add(target);
      targets.push(target);
    }
  }
  return targets;
}

function normalizeState(raw = {}) {
  const history = Array.isArray(raw.history) ? raw.history : [];
  return {
    version: 1,
    currentCommitSha: String(raw.currentCommitSha ?? ''),
    previousCommitSha: String(raw.previousCommitSha ?? ''),
    currentTaskId: String(raw.currentTaskId ?? ''),
    lastAction: String(raw.lastAction ?? ''),
    deployedAt: normalizeTimestamp(raw.deployedAt),
    rolledBackAt: normalizeTimestamp(raw.rolledBackAt),
    updatedAt: normalizeTimestamp(raw.updatedAt),
    history: normalizeDeploymentHistory(history)
  };
}

function normalizeDeploymentHistory(history = []) {
  const startIndex = Math.max(0, history.length - DEPLOYMENT_HISTORY_LIMIT);
  const normalizedHistory = [];
  for (let index = startIndex; index < history.length; index += 1) {
    const entry = history[index];
    normalizedHistory.push({
      at: normalizeTimestamp(entry?.at),
      action: String(entry?.action ?? ''),
      taskId: String(entry?.taskId ?? ''),
      currentCommitSha: String(entry?.currentCommitSha ?? ''),
      previousCommitSha: String(entry?.previousCommitSha ?? ''),
      rollbackCommitSha: String(entry?.rollbackCommitSha ?? ''),
      deployUrl: String(entry?.deployUrl ?? ''),
      deployTargets: normalizeDeployTargets(entry?.deployTargets)
    });
  }
  return normalizedHistory;
}

async function readDeploymentState(filePath = AGENT_DEPLOYMENTS_FILE_PATH) {
  if (shouldUseDeploymentPostgresState(filePath)) {
    return normalizeState(await readPostgresAgentState(
      AGENT_DEPLOYMENTS_STATE_KEY,
      await readDeploymentFileState(filePath)
    ));
  }

  return readDeploymentFileState(filePath);
}

async function readDeploymentFileState(filePath = AGENT_DEPLOYMENTS_FILE_PATH) {
  const text = await fsp.readFile(filePath, 'utf8').catch((error) => {
    if (error?.code === 'ENOENT') {
      return '';
    }
    throw error;
  });

  if (!text.trim()) {
    return createEmptyState();
  }

  return normalizeState(JSON.parse(text));
}

async function writeDeploymentState(state, filePath = AGENT_DEPLOYMENTS_FILE_PATH) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(normalizeState(state), null, 2)}\n`, 'utf8');
}

function shouldUseDeploymentPostgresState(filePath = AGENT_DEPLOYMENTS_FILE_PATH) {
  return shouldUsePostgresAgentState({
    filePath,
    defaultFilePath: DEFAULT_AGENT_DEPLOYMENTS_FILE_PATH,
    filePathConfigured: AGENT_DEPLOYMENTS_FILE_PATH_CONFIGURED
  });
}

function withDeploymentStore(mutator, {
  filePath = AGENT_DEPLOYMENTS_FILE_PATH,
  write = true
} = {}) {
  if (shouldUseDeploymentPostgresState(filePath)) {
    const operation = deploymentStoreQueue.then(async () => {
      const fallbackState = await readDeploymentFileState(filePath);
      return withPostgresAgentState(AGENT_DEPLOYMENTS_STATE_KEY, fallbackState, async (rawState) => {
        const state = normalizeState(rawState);
        const result = await mutator(state);
        rawState.version = 1;
        rawState.currentCommitSha = state.currentCommitSha;
        rawState.previousCommitSha = state.previousCommitSha;
        rawState.currentTaskId = state.currentTaskId;
        rawState.lastAction = state.lastAction;
        rawState.deployedAt = state.deployedAt;
        rawState.rolledBackAt = state.rolledBackAt;
        rawState.updatedAt = state.updatedAt;
        rawState.history = normalizeState(state).history;
        return cloneJson(result);
      }, { write });
    });

    deploymentStoreQueue = operation.catch(() => {});
    return operation;
  }

  const operation = deploymentStoreQueue.then(async () => {
    const state = await readDeploymentState(filePath);
    const result = await mutator(state);
    if (write) {
      await writeDeploymentState(state, filePath);
    }
    return cloneJson(result);
  });

  deploymentStoreQueue = operation.catch(() => {});
  return operation;
}

export async function getAgentDeploymentState({
  filePath = AGENT_DEPLOYMENTS_FILE_PATH
} = {}) {
  return withDeploymentStore((state) => state, { filePath, write: false });
}

export async function recordAgentDeploymentState(payload = {}, {
  filePath = AGENT_DEPLOYMENTS_FILE_PATH
} = {}) {
  return withDeploymentStore((state) => {
    const now = Date.now();
    const action = String(payload.action ?? payload.lastAction ?? '').trim();
    const taskId = String(payload.taskId ?? payload.currentTaskId ?? '').trim();
    const currentCommitSha = String(payload.currentCommitSha ?? '').trim();
    const previousCommitSha = String(payload.previousCommitSha ?? '').trim();
    const rollbackCommitSha = String(payload.rollbackCommitSha ?? '').trim();
    const deployUrl = String(payload.deployUrl ?? '').trim();
    const deployTargets = normalizeDeployTargets(payload.deployTargets);

    if (currentCommitSha) {
      state.currentCommitSha = currentCommitSha;
    }
    if (previousCommitSha) {
      state.previousCommitSha = previousCommitSha;
    }
    if (taskId) {
      state.currentTaskId = taskId;
    }
    if (action) {
      state.lastAction = action;
    }

    if (action === 'rollback') {
      state.rolledBackAt = now;
    } else if (action === 'deploy') {
      state.deployedAt = now;
    }
    state.updatedAt = now;
    state.history.push({
      at: now,
      action,
      taskId,
      currentCommitSha,
      previousCommitSha,
      rollbackCommitSha,
      deployUrl,
      deployTargets
    });
    while (state.history.length > DEPLOYMENT_HISTORY_LIMIT) {
      removeFirstArrayEntry(state.history);
    }

    return state;
  }, { filePath });
}
