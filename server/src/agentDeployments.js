import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AGENT_DEPLOYMENTS_FILE_PATH = process.env.AGENT_DEPLOYMENTS_FILE_PATH
  ? path.resolve(process.env.AGENT_DEPLOYMENTS_FILE_PATH)
  : fileURLToPath(new URL('../data/agent-deployments.json', import.meta.url));

const DEPLOYMENT_HISTORY_LIMIT = 50;

let deploymentStoreQueue = Promise.resolve();

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
    history: history.slice(-DEPLOYMENT_HISTORY_LIMIT).map((entry) => ({
      at: normalizeTimestamp(entry?.at),
      action: String(entry?.action ?? ''),
      taskId: String(entry?.taskId ?? ''),
      currentCommitSha: String(entry?.currentCommitSha ?? ''),
      previousCommitSha: String(entry?.previousCommitSha ?? ''),
      rollbackCommitSha: String(entry?.rollbackCommitSha ?? ''),
      deployUrl: String(entry?.deployUrl ?? '')
    }))
  };
}

async function readDeploymentState(filePath = AGENT_DEPLOYMENTS_FILE_PATH) {
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

function withDeploymentStore(mutator, {
  filePath = AGENT_DEPLOYMENTS_FILE_PATH,
  write = true
} = {}) {
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
    state.history = [
      ...state.history,
      {
        at: now,
        action,
        taskId,
        currentCommitSha,
        previousCommitSha,
        rollbackCommitSha,
        deployUrl
      }
    ].slice(-DEPLOYMENT_HISTORY_LIMIT);

    return state;
  }, { filePath });
}
