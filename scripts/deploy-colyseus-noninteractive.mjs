import { spawn, spawnSync } from 'node:child_process';
import { existsSync, promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const configPath = path.join(root, '.colyseus-cloud.json');
const env = process.env.COLYSEUS_DEPLOY_ENV || process.env.COLYSEUS_ENV || 'production';
const extraArgs = process.argv.slice(2);

function hasCliOption(args = [], option = '') {
  return args.some((arg) => arg === option || arg.startsWith(`${option}=`));
}

async function readLocalConfig() {
  try {
    const raw = (await fsp.readFile(configPath, 'utf8')).replace(/^\uFEFF/u, '');
    return JSON.parse(raw)?.[env] ?? null;
  } catch {
    return null;
  }
}

function readCredential(name, aliases = []) {
  for (const key of [name, ...aliases]) {
    const value = String(process.env[key] ?? '').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function getPathValue(childEnv) {
  return String(childEnv.PATH ?? childEnv.Path ?? '');
}

function setPathValue(childEnv, value) {
  childEnv.PATH = value;
  childEnv.Path = value;
}

function addPathDirectory(childEnv, directory = '') {
  const normalizedDirectory = String(directory ?? '').trim();
  if (!normalizedDirectory) {
    return;
  }

  const currentPath = getPathValue(childEnv);
  const pathEntries = currentPath.split(path.delimiter).filter(Boolean);
  if (pathEntries.some((entry) => entry.toLowerCase() === normalizedDirectory.toLowerCase())) {
    return;
  }
  setPathValue(childEnv, `${normalizedDirectory}${path.delimiter}${currentPath}`);
}

function getDiscoveredGitCommands(childEnv) {
  const lookupCommand = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(lookupCommand, ['git'], {
    cwd: root,
    env: childEnv,
    encoding: 'utf8',
    shell: false
  });
  if (result.status !== 0) {
    return [];
  }
  return String(result.stdout ?? '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getGitCandidates(childEnv) {
  const candidates = [];
  const addCandidate = (candidate) => {
    const normalized = String(candidate ?? '').trim();
    if (normalized && !candidates.some((value) => value.toLowerCase() === normalized.toLowerCase())) {
      candidates.push(normalized);
    }
  };

  addCandidate(childEnv.GIT_COMMAND);
  if (process.platform === 'win32') {
    addCandidate('C:\\Program Files\\Git\\cmd\\git.exe');
    addCandidate('C:\\Program Files\\Git\\bin\\git.exe');
    addCandidate('C:\\Program Files (x86)\\Git\\cmd\\git.exe');
    addCandidate('C:\\Program Files (x86)\\Git\\bin\\git.exe');
    if (childEnv.LOCALAPPDATA) {
      addCandidate(path.join(childEnv.LOCALAPPDATA, 'Programs\\Git\\cmd\\git.exe'));
      addCandidate(path.join(childEnv.LOCALAPPDATA, 'Programs\\Git\\bin\\git.exe'));
    }
  }
  for (const discovered of getDiscoveredGitCommands(childEnv)) {
    addCandidate(discovered);
  }
  return candidates;
}

function getExecutableDirectory(command = '') {
  const normalized = String(command ?? '').trim();
  if (!normalized) {
    return '';
  }
  if ((path.isAbsolute(normalized) || normalized.includes('\\') || normalized.includes('/')) && existsSync(normalized)) {
    return path.dirname(normalized);
  }
  return '';
}

function addGitToPath(childEnv) {
  const gitCandidates = getGitCandidates(childEnv);
  for (const candidate of gitCandidates) {
    const gitDirectory = getExecutableDirectory(candidate);
    if (!gitDirectory) {
      continue;
    }

    childEnv.GIT_COMMAND = candidate;
    addPathDirectory(childEnv, gitDirectory);
    if (process.platform === 'win32') {
      const parentDirectory = path.dirname(gitDirectory);
      if (path.basename(gitDirectory).toLowerCase() === 'cmd') {
        addPathDirectory(childEnv, path.join(parentDirectory, 'bin'));
      } else if (path.basename(gitDirectory).toLowerCase() === 'bin') {
        addPathDirectory(childEnv, path.join(parentDirectory, 'cmd'));
      }
    }
    return;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env };
    addGitToPath(childEnv);

    const child = spawn(command, args, {
      cwd: root,
      env: childEnv,
      shell: process.platform === 'win32',
      stdio: 'inherit',
      ...options
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with ${signal || code}`));
    });
  });
}

const localConfig = await readLocalConfig();
const applicationId = readCredential('COLYSEUS_APPLICATION_ID', ['COLYSEUS_APP_ID'])
  || String(localConfig?.applicationId ?? '').trim();
const token = readCredential('COLYSEUS_DEPLOY_TOKEN', ['COLYSEUS_TOKEN'])
  || String(localConfig?.token ?? '').trim();
const deployBranch = readCredential('COLYSEUS_DEPLOY_BRANCH', ['COLYSEUS_BRANCH', 'GIT_BASE_BRANCH'])
  || 'main';
const deployRemote = readCredential('COLYSEUS_DEPLOY_REMOTE', ['COLYSEUS_REMOTE']);

if (!applicationId || !token) {
  throw new Error(
    'Colyseus deploy needs COLYSEUS_APPLICATION_ID and COLYSEUS_DEPLOY_TOKEN, '
    + 'or a local .colyseus-cloud.json in the repository root.'
  );
}

const deployArgs = [
  '@colyseus/cloud',
  'deploy',
  '--env',
  env,
  '--applicationId',
  applicationId,
  '--token',
  token,
  ...(!hasCliOption(extraArgs, '--branch') ? ['--branch', deployBranch] : []),
  ...(deployRemote && !hasCliOption(extraArgs, '--remote') ? ['--remote', deployRemote] : []),
  ...extraArgs
];

console.log(`[colyseus-deploy] Deploying application ${applicationId} to ${env} from branch ${deployBranch}.`);
await run('npx', deployArgs);
