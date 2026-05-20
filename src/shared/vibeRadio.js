const VIBE_RADIO_TRACK_ID_PREFIX = 'vibe-radio-track-';
const VIBE_RADIO_TRACK_ID_MAX_LENGTH = 96;
const VIBE_RADIO_TRACK_TITLE_MAX_LENGTH = 64;
const VIBE_RADIO_TRACK_SOURCE_MAX_LENGTH = 640;
const VIBE_RADIO_AUDIO_PATH_PREFIX = 'assets/audio/';

const VIBE_RADIO_DEFAULT_TRACKS = Object.freeze([
  Object.freeze({
    id: 'vibe-radio-track-bright-light-and-spacious',
    title: 'Bright Light and Spacious',
    sourceUrl: 'assets/audio/vibe-radio/bright-light-and-spacious.mp3'
  }),
  Object.freeze({
    id: 'vibe-radio-track-kiss-of-life',
    title: 'Kiss of Life',
    sourceUrl: 'assets/audio/vibe-radio/kiss-of-life.mp3'
  }),
  Object.freeze({
    id: 'vibe-radio-track-retro-game-arcade',
    title: 'Retro Game Arcade',
    sourceUrl: 'assets/audio/vibe-radio/retro-game-arcade.mp3'
  }),
  Object.freeze({
    id: 'vibe-radio-track-retrowave-ambient-dreamwave',
    title: 'Retrowave Ambient Dreamwave',
    sourceUrl: 'assets/audio/vibe-radio/retrowave-ambient-dreamwave.mp3'
  }),
  Object.freeze({
    id: 'vibe-radio-track-retro-swing',
    title: 'Retro Swing',
    sourceUrl: 'assets/audio/vibe-radio/retro-swing.mp3'
  }),
  Object.freeze({
    id: 'vibe-radio-track-lo-fi-chillout',
    title: 'Lo-Fi Chillout',
    sourceUrl: 'assets/audio/vibe-radio/lo-fi-chillout.mp3'
  })
]);

function normalizeVibeRadioText(value = '', maxLength = VIBE_RADIO_TRACK_TITLE_MAX_LENGTH) {
  return String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
}

function normalizeVibeRadioSource(value = '') {
  const trimmed = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .replace(/\\/gu, '/')
    .trim()
    .slice(0, VIBE_RADIO_TRACK_SOURCE_MAX_LENGTH)
    .trim();

  if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed) || trimmed.startsWith('//')) {
    return '';
  }

  const normalized = trimmed
    .replace(/^\/+/u, '')
    .replace(/^\.\//u, '');
  const sourcePath = normalized.split(/[?#]/u)[0] ?? normalized;
  const lowerPath = sourcePath.toLowerCase();

  if (
    !sourcePath
    || !lowerPath.startsWith(VIBE_RADIO_AUDIO_PATH_PREFIX)
    || !lowerPath.endsWith('.mp3')
    || hasParentPathSegment(sourcePath)
  ) {
    return '';
  }

  return normalized;
}

function hasParentPathSegment(sourcePath = '') {
  let segmentStart = 0;
  for (let index = 0; index <= sourcePath.length; index += 1) {
    if (index < sourcePath.length && sourcePath[index] !== '/') {
      continue;
    }
    if (sourcePath.slice(segmentStart, index) === '..') {
      return true;
    }
    segmentStart = index + 1;
  }
  return false;
}

function slugifyVibeRadioTrack(value = '') {
  return normalizeVibeRadioText(value, 96)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 42)
    || 'track';
}

function hashVibeRadioTrack(value = '') {
  let hash = 2166136261;
  const text = normalizeVibeRadioSource(value) || normalizeVibeRadioText(value, 128);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 7);
}

function normalizeVibeRadioTrackId(trackId = '') {
  const normalized = String(trackId ?? '').trim();
  if (
    normalized.startsWith(VIBE_RADIO_TRACK_ID_PREFIX)
    && normalized.length <= VIBE_RADIO_TRACK_ID_MAX_LENGTH
    && /^[a-z0-9-]+$/u.test(normalized)
  ) {
    return normalized;
  }

  return '';
}

function createVibeRadioTrackId(track = {}, tracks = []) {
  const source = normalizeVibeRadioSource(track.sourceUrl ?? track.url ?? track.src ?? track.fileName);
  const title = normalizeVibeRadioText(track.title ?? track.label ?? '');
  const base = `${VIBE_RADIO_TRACK_ID_PREFIX}${slugifyVibeRadioTrack(title || source)}-${hashVibeRadioTrack(source || title)}`;
  const existingIds = new Set();
  for (const entry of normalizeVibeRadioTracks(tracks)) {
    existingIds.add(entry.id);
  }
  if (!existingIds.has(base)) {
    return base;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36).slice(-5)}`;
}

function getTrackTitleFromSource(sourceUrl = '') {
  const normalized = normalizeVibeRadioSource(sourceUrl);
  if (!normalized) {
    return '';
  }

  const withoutQuery = normalized.split(/[?#]/u)[0] ?? normalized;
  const parts = withoutQuery.split(/[\\/]+/u);
  let fileName = '';
  for (const part of parts) {
    if (part) {
      fileName = part;
    }
  }
  const baseName = fileName.replace(/\.[a-z0-9]{2,6}$/iu, '').replace(/[-_]+/gu, ' ');
  return normalizeVibeRadioText(baseName, VIBE_RADIO_TRACK_TITLE_MAX_LENGTH);
}

export function createDefaultVibeRadioTracks() {
  return cloneVibeRadioTracks(VIBE_RADIO_DEFAULT_TRACKS);
}

export function normalizeVibeRadioTrack(entry = {}, tracks = []) {
  const sourceUrl = normalizeVibeRadioSource(entry.sourceUrl ?? entry.url ?? entry.src ?? entry.fileName);
  if (!sourceUrl) {
    return null;
  }

  const title = normalizeVibeRadioText(
    entry.title
    ?? entry.label
    ?? getTrackTitleFromSource(sourceUrl),
    VIBE_RADIO_TRACK_TITLE_MAX_LENGTH
  );
  const normalizedTitle = title || 'Untitled track';
  const normalizedEntry = {
    id: normalizeVibeRadioTrackId(entry.id ?? entry.trackId) || createVibeRadioTrackId({
      ...entry,
      title: normalizedTitle,
      sourceUrl
    }, tracks),
    title: normalizedTitle,
    sourceUrl
  };

  return Object.freeze(normalizedEntry);
}

export function normalizeVibeRadioTracks(tracks = null) {
  const rawTracks = Array.isArray(tracks) ? tracks : [];
  const output = [];
  const seenIds = new Set();

  for (const entry of rawTracks) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const track = normalizeVibeRadioTrack(entry, output);
    if (!track || seenIds.has(track.id)) {
      continue;
    }

    seenIds.add(track.id);
    output.push(track);
  }

  return output;
}

function cloneVibeRadioTracks(tracks = null) {
  const clones = [];
  for (const track of normalizeVibeRadioTracks(tracks)) {
    clones.push({ ...track });
  }
  return clones;
}
