#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

const FRONTEND_EXACT_PATHS = new Set([
  'index.html',
  'styles.css',
  'vercel.json',
  'scripts/build-web.mjs',
  'scripts/vercel-ignore-build.mjs',
  'package.json',
  'package-lock.json'
]);

const FRONTEND_PATH_PREFIXES = [
  'assets/',
  'src/',
  'vendor/'
];

const WINDOWS_GIT_CANDIDATES = [
  'C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files\\Git\\bin\\git.exe'
];

function log(message) {
  console.log(`[vercel-ignore] ${message}`);
}

function normalizeRepoPath(filePath = '') {
  return String(filePath || '')
    .replaceAll('\\', '/')
    .replace(/^\.\/+/u, '')
    .trim();
}

function isFrontendPath(filePath = '') {
  const normalized = normalizeRepoPath(filePath).toLowerCase();
  if (FRONTEND_EXACT_PATHS.has(normalized)) {
    return true;
  }

  for (const prefix of FRONTEND_PATH_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

function resolveGitCommand() {
  const configured = String(process.env.GIT_COMMAND || '').trim();
  if (configured) {
    return configured;
  }

  if (process.platform === 'win32') {
    for (const filePath of WINDOWS_GIT_CANDIDATES) {
      if (existsSync(filePath)) {
        return filePath;
      }
    }
  }

  return 'git';
}

function runGit(args) {
  return spawnSync(resolveGitCommand(), args, {
    encoding: 'utf8',
    windowsHide: true
  });
}

function getGitOutput(args) {
  const result = runGit(args);
  if (result.status !== 0) {
    const detail = `${result.stderr || result.stdout || ''}`.trim();
    throw new Error(`git ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
  }
  return String(result.stdout || '').trim();
}

function getHeadSha() {
  return String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim()
    || getGitOutput(['rev-parse', 'HEAD']);
}

function getDiffBase() {
  const previousSuccessfulDeploy = String(process.env.VERCEL_GIT_PREVIOUS_SHA || '').trim();
  if (previousSuccessfulDeploy) {
    return previousSuccessfulDeploy;
  }

  return 'HEAD^';
}

function getChangedFiles(baseRef, headRef) {
  const result = runGit(['diff', '--name-only', baseRef, headRef, '--']);
  if (result.status !== 0) {
    const detail = `${result.stderr || result.stdout || ''}`.trim();
    throw new Error(`Could not read changed files from ${baseRef} to ${headRef}${detail ? `: ${detail}` : ''}`);
  }

  const lines = String(result.stdout || '').split(/\r?\n/u);
  const changedFiles = [];
  for (const line of lines) {
    const normalized = normalizeRepoPath(line);
    if (normalized) {
      changedFiles.push(normalized);
    }
  }
  return changedFiles;
}

function shouldInspectDeployment() {
  const vercelEnv = String(process.env.VERCEL_ENV || '').trim().toLowerCase();
  const gitRef = String(process.env.VERCEL_GIT_COMMIT_REF || '').trim();
  return vercelEnv === 'production' || gitRef === 'main';
}

function main() {
  if (!shouldInspectDeployment()) {
    log(`Skipping non-production branch ${process.env.VERCEL_GIT_COMMIT_REF || '(unknown)'} in ${process.env.VERCEL_ENV || '(unknown)'} environment.`);
    process.exit(0);
  }

  let headRef = '';
  let baseRef = '';
  let changedFiles = [];
  try {
    headRef = getHeadSha();
    baseRef = getDiffBase();
    changedFiles = getChangedFiles(baseRef, headRef);
  } catch (error) {
    log(`${error?.message || String(error)}. Continuing build to avoid missing a frontend deploy.`);
    process.exit(1);
  }

  if (changedFiles.length === 0) {
    log(`No changed files from ${baseRef} to ${headRef}; skipping build.`);
    process.exit(0);
  }

  const frontendFiles = [];
  for (const filePath of changedFiles) {
    if (isFrontendPath(filePath)) {
      frontendFiles.push(filePath);
    }
  }
  if (frontendFiles.length > 0) {
    log(`Frontend changes detected from ${baseRef} to ${headRef}: ${frontendFiles.join(', ')}`);
    process.exit(1);
  }

  log(`No frontend changes from ${baseRef} to ${headRef}; skipping build. Changed files: ${changedFiles.join(', ')}`);
  process.exit(0);
}

main();
