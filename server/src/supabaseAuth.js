import process from 'node:process';

const AUTH_USER_ENDPOINT = '/auth/v1/user';

function readEnvString(names) {
  for (const name of names) {
    const value = String(process.env[name] ?? '').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function getSupabaseUrl() {
  return readEnvString([
    'VTA_SUPABASE_URL',
    'SUPABASE_URL',
    'STICKRPG_SUPABASE_URL'
  ]).replace(/\/+$/u, '');
}

function getSupabasePublishableKey() {
  return readEnvString([
    'VTA_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'VTA_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'STICKRPG_SUPABASE_PUBLISHABLE_KEY',
    'STICKRPG_SUPABASE_ANON_KEY'
  ]);
}

function normalizeAccessToken(value = '') {
  return String(value ?? '').trim();
}

function normalizeAuthUser(raw = null) {
  const id = typeof raw?.id === 'string' ? raw.id.trim() : '';
  if (!id) {
    return null;
  }

  return {
    id,
    email: typeof raw?.email === 'string' ? raw.email.trim() : '',
    appMetadata: raw?.app_metadata && typeof raw.app_metadata === 'object' ? raw.app_metadata : {},
    userMetadata: raw?.user_metadata && typeof raw.user_metadata === 'object' ? raw.user_metadata : {}
  };
}

export function getSupabaseAuthInfo() {
  return {
    configured: Boolean(getSupabaseUrl() && getSupabasePublishableKey())
  };
}

export async function verifySupabaseAccessToken(accessToken = '') {
  const token = normalizeAccessToken(accessToken);
  if (!token) {
    return null;
  }

  const supabaseUrl = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Supabase auth verification is not configured.');
  }

  const response = await fetch(`${supabaseUrl}${AUTH_USER_ENDPOINT}`, {
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${token}`
    }
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body?.msg === 'string'
      ? body.msg
      : typeof body?.message === 'string'
        ? body.message
        : 'Supabase access token is invalid.';
    throw new Error(message);
  }

  const user = normalizeAuthUser(body);
  if (!user) {
    throw new Error('Supabase access token did not resolve to a user.');
  }

  return user;
}
