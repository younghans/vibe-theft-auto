const DEFAULT_FRONTEND_URL = 'https://www.vibetheftauto.xyz/';
const DEFAULT_BACKEND_URL = 'https://us-atl-06d422c8.vibetheftauto.xyz';

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`;
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === name) {
      return '1';
    }
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return fallback;
}

function normalizeBaseUrl(value = '') {
  return String(value || '').replace(/\/+$/u, '');
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    ...options
  });
  const text = await response.text();
  return { response, text };
}

function assertCheck(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

function getAppScriptUrls(html = '', baseUrl = '') {
  const appScriptUrls = [];
  const appScriptPattern = /<script[^>]+src="([^"]*\/assets\/app-[^"]+\.js[^"]*)"/gu;
  for (const match of html.matchAll(appScriptPattern)) {
    appScriptUrls.push(new URL(match[1], baseUrl).toString());
  }
  return appScriptUrls;
}

async function checkFrontend(frontendUrl) {
  const url = new URL(frontendUrl);
  url.searchParams.set('authRolloutCheck', String(Date.now()));

  const { response, text: html } = await fetchText(url.toString());
  assertCheck(response.ok, 'Frontend did not return OK.', {
    status: response.status,
    url: response.url
  });
  assertCheck(html.includes('globalThis.VTA_SUPABASE_URL'), 'Frontend HTML is missing VTA_SUPABASE_URL runtime config.');
  assertCheck(
    html.includes('globalThis.VTA_SUPABASE_PUBLISHABLE_KEY'),
    'Frontend HTML is missing VTA_SUPABASE_PUBLISHABLE_KEY runtime config.'
  );

  const appScriptUrl = getAppScriptUrls(html, response.url)[0];
  assertCheck(appScriptUrl, 'Frontend HTML did not reference an app bundle.');
  const scriptUrl = new URL(appScriptUrl);
  scriptUrl.searchParams.set('authRolloutCheck', String(Date.now()));
  const { response: scriptResponse, text: script } = await fetchText(scriptUrl.toString());
  assertCheck(scriptResponse.ok, 'Frontend app bundle did not return OK.', {
    status: scriptResponse.status,
    url: scriptResponse.url
  });
  assertCheck(script.includes('getAdminAuthHeaders'), 'Frontend app bundle is missing Supabase admin auth request wiring.');
  assertCheck(!script.includes('adminKey'), 'Frontend app bundle still contains legacy adminKey literal.');

  return {
    appBundle: appScriptUrl,
    finalUrl: response.url
  };
}

async function checkBackendHealth(backendUrl) {
  const healthUrl = `${normalizeBaseUrl(backendUrl)}/health`;
  const { response, text } = await fetchText(healthUrl);
  assertCheck(response.ok, 'Backend health did not return OK.', {
    status: response.status,
    url: healthUrl
  });
  const health = JSON.parse(text);
  assertCheck(health.ok === true, 'Backend health did not report ok=true.', health);
  assertCheck(health.persistenceMode === 'postgres', 'Backend is not using Postgres world persistence.', health);
  assertCheck(health.playerAccountPersistenceMode === 'postgres', 'Backend is not using Postgres account persistence.', health);
  assertCheck(
    Object.hasOwn(health, 'supabaseAuthConfigured'),
    'Backend health is missing supabaseAuthConfigured; deploy the latest Phase 7 backend before running this check.',
    health
  );
  assertCheck(health.supabaseAuthConfigured === true, 'Backend Supabase auth verification is not configured.', health);

  return health;
}

async function checkAdminRouteRejections(backendUrl) {
  const baseUrl = normalizeBaseUrl(backendUrl);
  const checks = [
    {
      label: 'missing admin auth',
      url: `${baseUrl}/admin/agent-tasks`,
      options: {}
    },
    {
      label: 'legacy adminKey query',
      url: `${baseUrl}/admin/agent-tasks?adminKey=yodiegang`,
      options: {}
    },
    {
      label: 'invalid bearer token',
      url: `${baseUrl}/admin/agent-tasks`,
      options: {
        headers: {
          authorization: 'Bearer not-a-real-token'
        }
      }
    }
  ];

  const results = [];
  for (const check of checks) {
    const { response } = await fetchText(check.url, check.options);
    results.push({
      label: check.label,
      status: response.status
    });
    assertCheck(response.status === 401 || response.status === 403, `Admin route did not reject ${check.label}.`, {
      label: check.label,
      status: response.status
    });
  }

  return results;
}

const frontendUrl = getArgValue('--frontend', process.env.FRONTEND_PRODUCTION_URL || DEFAULT_FRONTEND_URL);
const backendUrl = getArgValue('--backend', process.env.BACKEND_VERIFY_URL || DEFAULT_BACKEND_URL);

const frontend = await checkFrontend(frontendUrl);
const health = await checkBackendHealth(backendUrl);
const adminRejections = await checkAdminRouteRejections(backendUrl);

console.log(JSON.stringify({
  ok: true,
  frontend,
  backend: {
    commitSha: health.commitSha,
    persistenceMode: health.persistenceMode,
    playerAccountPersistenceMode: health.playerAccountPersistenceMode,
    supabaseAuthConfigured: health.supabaseAuthConfigured
  },
  adminRejections
}, null, 2));
