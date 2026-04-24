import {
  VIBE_JAM_PORTAL_PARAM_KEYS,
  VIBE_JAM_PORTAL_URL
} from '../shared/vibeJamPortalConfig.js';

export { VIBE_JAM_PORTAL_URL } from '../shared/vibeJamPortalConfig.js';

export function hasPortalFlag(search = '') {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(search);
  const value = params.get('portal');
  if (value === null) {
    return false;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized !== '0' && normalized !== 'false' && normalized !== 'off';
}

export function normalizePortalUrl(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(String(rawUrl));
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function getCurrentGameBaseUrl(locationLike = globalThis.location) {
  if (!locationLike?.origin || !locationLike?.pathname) {
    return '';
  }

  try {
    return new URL(locationLike.pathname, locationLike.origin).toString();
  } catch {
    return `${locationLike.origin}${locationLike.pathname}`;
  }
}

export function parsePortalArrival(search = '') {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(search);

  return {
    viaPortal: hasPortalFlag(params),
    refUrl: normalizePortalUrl(params.get('ref')),
    forwardedParams: pickForwardedPortalParams(params)
  };
}

export function pickForwardedPortalParams(paramsLike) {
  const params = paramsLike instanceof URLSearchParams
    ? paramsLike
    : new URLSearchParams(paramsLike);
  const forwarded = new URLSearchParams();

  for (const key of VIBE_JAM_PORTAL_PARAM_KEYS) {
    const value = params.get(key);
    if (value !== null && value !== '') {
      forwarded.set(key, value);
    }
  }

  return forwarded;
}

export function buildPortalRedirectUrl({
  targetUrl,
  currentSearch = '',
  currentBaseUrl = '',
  continuity = {}
} = {}) {
  const normalizedTargetUrl = normalizePortalUrl(targetUrl);
  if (!normalizedTargetUrl) {
    return null;
  }

  const currentParams = currentSearch instanceof URLSearchParams
    ? currentSearch
    : new URLSearchParams(currentSearch);
  const nextParams = pickForwardedPortalParams(currentParams);

  for (const [key, value] of Object.entries(continuity ?? {})) {
    if (!VIBE_JAM_PORTAL_PARAM_KEYS.includes(key)) {
      continue;
    }

    if (value === undefined || value === null || value === '') {
      nextParams.delete(key);
      continue;
    }

    nextParams.set(key, String(value));
  }

  nextParams.set('portal', 'true');
  if (currentBaseUrl) {
    nextParams.set('ref', currentBaseUrl);
  } else {
    nextParams.delete('ref');
  }

  const url = new URL(normalizedTargetUrl);
  url.search = nextParams.toString();
  return url.toString();
}
