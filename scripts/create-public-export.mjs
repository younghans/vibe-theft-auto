import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const force = args.includes('--force') || process.env.npm_config_force === 'true';
const initGit = args.includes('--init-git') || process.env.npm_config_init_git === 'true';
const targetArg = args.find((arg) => !arg.startsWith('--')) ?? '.public-export/vibe-theft-auto';
const targetRoot = path.resolve(root, targetArg);

function fail(message) {
  console.error(`[public-export] ${message}`);
  process.exit(1);
}

function assertSafeTarget() {
  const relativeToRoot = path.relative(root, targetRoot);
  if (!relativeToRoot || relativeToRoot === '.') {
    fail('Refusing to export over the repository root.');
  }

  const parsed = path.parse(targetRoot);
  if (targetRoot === parsed.root || targetRoot === os.homedir()) {
    fail('Refusing to use a filesystem root or home directory as the export target.');
  }

  const targetGitPath = path.join(targetRoot, '.git');
  return fs.stat(targetGitPath)
    .then((stats) => {
      if (stats) {
        fail('Refusing to overwrite a directory that already contains .git.');
      }
    })
    .catch((error) => {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    });
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'buffer'
  });
  if (result.status !== 0) {
    fail(Buffer.concat([result.stdout, result.stderr]).toString('utf8').trim() || `git ${args.join(' ')} failed`);
  }
  return result.stdout;
}

async function copyTrackedFiles() {
  const raw = runGit(['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  const files = raw.toString('utf8').split('\0').filter(Boolean);

  for (const relativePath of files) {
    const source = path.join(root, relativePath);
    const target = path.join(targetRoot, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }

  return files.length;
}

async function prepareTarget() {
  await assertSafeTarget();
  const existingEntries = await fs.readdir(targetRoot).catch((error) => {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  });

  if (existingEntries?.length && !force) {
    fail(`Target is not empty: ${targetRoot}. Re-run with --force to replace it.`);
  }

  if (existingEntries?.length) {
    await fs.rm(targetRoot, { recursive: true, force: true });
  }

  await fs.mkdir(targetRoot, { recursive: true });
}

function runExportGit(args) {
  const result = spawnSync('git', args, {
    cwd: targetRoot,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  if (result.status !== 0) {
    fail((result.stdout + result.stderr).trim() || `git ${args.join(' ')} failed in export`);
  }
}

async function main() {
  await prepareTarget();
  const copiedCount = await copyTrackedFiles();

  if (initGit) {
    runExportGit(['init', '-b', 'main']);
    runExportGit(['add', '.']);
  }

  console.log(`[public-export] Copied ${copiedCount} tracked and untracked non-ignored files to ${targetRoot}`);
  if (initGit) {
    console.log('[public-export] Initialized a fresh git repository and staged the exported tree.');
  } else {
    console.log('[public-export] No git history was copied. Run with --init-git to initialize and stage a fresh repository.');
  }
}

await main();
