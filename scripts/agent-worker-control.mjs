import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const ENV_FILE = path.join(REPO_ROOT, '.env.worker.production');

function importEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
    if (!match) {
      continue;
    }

    const [, name, rawValue] = match;
    if (process.env[name]) {
      continue;
    }

    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[name] = value;
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid) || numericPid <= 0) {
    return false;
  }

  try {
    process.kill(numericPid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function usage(exitCode = 0) {
  const text = `Usage:
  node scripts/agent-worker-control.mjs status
  node scripts/agent-worker-control.mjs drain [--all] [reason...]
  node scripts/agent-worker-control.mjs resume

Commands:
  status   Show the active worker lock and drain request.
  drain    Ask the active worker to finish current lanes, then exit before claiming more work.
  resume   Clear any drain request.

By default, drain targets the active worker lock owner. Use --all only when you
intentionally want a global drain request that also affects future workers until
resume clears it.`;
  console.log(text);
  process.exit(exitCode);
}

importEnvFile(ENV_FILE);

const DEFAULT_WORK_ROOT = process.platform === 'win32'
  ? 'D:\\agent-work'
  : path.join(os.homedir(), 'vibe-theft-auto-agent-work');
const WORK_ROOT = path.resolve(process.env.AGENT_WORK_ROOT || DEFAULT_WORK_ROOT);
const LOCK_ROOT = path.join(WORK_ROOT, '.agent-worker.lock');
const OWNER_FILE = path.join(LOCK_ROOT, 'owner.json');
const CONTROL_FILE = path.join(WORK_ROOT, '.agent-worker-control.json');

const command = String(process.argv[2] || 'status').toLowerCase();
const args = process.argv.slice(3);

function getOwner() {
  const owner = readJson(OWNER_FILE);
  if (!owner) {
    return null;
  }

  return {
    ...owner,
    active: isProcessAlive(owner.pid)
  };
}

function printStatus() {
  const owner = getOwner();
  const control = readJson(CONTROL_FILE);
  console.log(`workRoot: ${WORK_ROOT}`);
  if (owner) {
    console.log(`worker: ${owner.active ? 'active' : 'stale'} pid=${owner.pid || ''} workerId=${owner.workerId || ''}`);
    console.log(`startedAt: ${owner.startedAt || ''}`);
  } else {
    console.log('worker: none');
  }

  if (control) {
    console.log(`control: ${control.mode || 'unknown'}`);
    console.log(`requestedAt: ${control.requestedAt || ''}`);
    console.log(`requestedBy: ${control.requestedBy || ''}`);
    console.log(`targetWorkerId: ${control.targetWorkerId || ''}`);
    console.log(`targetPid: ${control.targetPid || ''}`);
    if (control.reason) {
      console.log(`reason: ${control.reason}`);
    }
  } else {
    console.log('control: none');
  }
}

function requestDrain() {
  const all = args.includes('--all');
  const reason = args.filter((arg) => arg !== '--all').join(' ').trim();
  const owner = getOwner();
  if (!all && !owner?.active) {
    console.error('No active worker lock was found. Use --all to create a global drain request.');
    process.exit(1);
  }

  const control = {
    mode: 'drain',
    requestedAt: new Date().toISOString(),
    requestedBy: `${os.hostname()}-${process.pid}`,
    targetWorkerId: all ? '' : String(owner.workerId || ''),
    targetPid: all ? 0 : Number(owner.pid || 0),
    reason
  };

  mkdirSync(WORK_ROOT, { recursive: true });
  writeFileSync(CONTROL_FILE, `${JSON.stringify(control, null, 2)}\n`, 'utf8');
  if (all) {
    console.log(`Global drain requested at ${CONTROL_FILE}.`);
  } else {
    console.log(`Drain requested for worker ${control.targetWorkerId || control.targetPid} at ${CONTROL_FILE}.`);
  }
}

function resumeWorker() {
  rmSync(CONTROL_FILE, { force: true });
  console.log(`Drain request cleared at ${CONTROL_FILE}.`);
}

if (command === 'help' || command === '--help' || command === '-h') {
  usage(0);
}

if (command === 'status') {
  printStatus();
} else if (command === 'drain') {
  requestDrain();
} else if (command === 'resume' || command === 'clear' || command === 'clear-drain') {
  resumeWorker();
} else {
  console.error(`Unknown command: ${command}`);
  usage(1);
}
