import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
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

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env };
    const gitCommand = String(childEnv.GIT_COMMAND ?? '').trim();
    const gitDirectory = gitCommand ? path.dirname(gitCommand) : '';
    if (gitDirectory) {
      const currentPath = String(childEnv.PATH ?? childEnv.Path ?? '');
      const separator = path.delimiter;
      const pathEntries = currentPath.split(separator).filter(Boolean);
      if (!pathEntries.some((entry) => entry.toLowerCase() === gitDirectory.toLowerCase())) {
        childEnv.PATH = `${gitDirectory}${separator}${currentPath}`;
        childEnv.Path = childEnv.PATH;
      }
    }

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
