const VIBE_RADIO_TRACK_ID_PREFIX = 'vibe-radio-track-';
const VIBE_RADIO_TRACK_ID_MAX_LENGTH = 96;
const VIBE_RADIO_TRACK_TITLE_MAX_LENGTH = 64;
const VIBE_RADIO_TRACK_SOURCE_MAX_LENGTH = 640;
const VIBE_RADIO_TRACK_SOURCE_TYPES = Object.freeze(['link', 'file']);

function normalizeVibeRadioText(value = '', maxLength = VIBE_RADIO_TRACK_TITLE_MAX_LENGTH) {
  return String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
}

function normalizeVibeRadioSource(value = '') {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/gu, '')
    .trim()
    .slice(0, VIBE_RADIO_TRACK_SOURCE_MAX_LENGTH)
    .trim();
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
  const existingIds = new Set(normalizeVibeRadioTracks(tracks).map((entry) => entry.id));
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
  const fileName = withoutQuery.split(/[\\/]+/u).filter(Boolean).at(-1) ?? '';
  const baseName = fileName.replace(/\.[a-z0-9]{2,6}$/iu, '').replace(/[-_]+/gu, ' ');
  return normalizeVibeRadioText(baseName, VIBE_RADIO_TRACK_TITLE_MAX_LENGTH);
}

export function normalizeVibeRadioSourceType(sourceType = 'link') {
  const normalized = String(sourceType ?? '').trim().toLowerCase();
  return VIBE_RADIO_TRACK_SOURCE_TYPES.includes(normalized) ? normalized : 'link';
}

export function getVibeRadioSourceTypeLabel(sourceType = 'link') {
  return normalizeVibeRadioSourceType(sourceType) === 'file' ? 'MP3 file' : 'Link';
}

export function createDefaultVibeRadioTracks() {
  return [];
}

export function normalizeVibeRadioTrack(entry = {}, tracks = []) {
  const sourceUrl = normalizeVibeRadioSource(entry.sourceUrl ?? entry.url ?? entry.src ?? entry.fileName);
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
    sourceType: normalizeVibeRadioSourceType(entry.sourceType ?? entry.type),
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
    if (seenIds.has(track.id)) {
      continue;
    }

    seenIds.add(track.id);
    output.push(track);
  }

  return output;
}

export function cloneVibeRadioTracks(tracks = null) {
  return normalizeVibeRadioTracks(tracks).map((track) => ({ ...track }));
}

export function appendVibeRadioTrack(tracks = null, draft = {}) {
  const sourceUrl = normalizeVibeRadioSource(draft.sourceUrl ?? draft.url ?? draft.src ?? draft.fileName);
  if (!sourceUrl) {
    return cloneVibeRadioTracks(tracks);
  }

  const entries = cloneVibeRadioTracks(tracks);
  entries.push({
    id: createVibeRadioTrackId({ ...draft, sourceUrl }, entries),
    title: normalizeVibeRadioText(draft.title ?? draft.label ?? getTrackTitleFromSource(sourceUrl)),
    sourceType: normalizeVibeRadioSourceType(draft.sourceType ?? draft.type),
    sourceUrl
  });

  return cloneVibeRadioTracks(entries);
}

export function updateVibeRadioTrack(tracks = null, trackId = '', updates = {}) {
  const normalizedTrackId = normalizeVibeRadioTrackId(trackId);
  if (!normalizedTrackId) {
    return cloneVibeRadioTracks(tracks);
  }

  return cloneVibeRadioTracks(tracks).map((track) => {
    if (track.id !== normalizedTrackId) {
      return track;
    }

    return normalizeVibeRadioTrack({
      ...track,
      ...(Object.hasOwn(updates, 'title') ? { title: updates.title } : {}),
      ...(Object.hasOwn(updates, 'sourceType') ? { sourceType: updates.sourceType } : {}),
      ...(Object.hasOwn(updates, 'sourceUrl') ? { sourceUrl: updates.sourceUrl } : {})
    });
  });
}

export function removeVibeRadioTrack(tracks = null, trackId = '') {
  const normalizedTrackId = normalizeVibeRadioTrackId(trackId);
  if (!normalizedTrackId) {
    return cloneVibeRadioTracks(tracks);
  }

  return cloneVibeRadioTracks(tracks).filter((track) => track.id !== normalizedTrackId);
}

export function moveVibeRadioTrack(tracks = null, fromIndex = 0, toIndex = 0) {
  const entries = cloneVibeRadioTracks(tracks);
  const from = Math.floor(Number(fromIndex));
  const to = Math.floor(Number(toIndex));
  if (
    !Number.isFinite(from)
    || !Number.isFinite(to)
    || from < 0
    || to < 0
    || from >= entries.length
    || to >= entries.length
    || from === to
  ) {
    return entries;
  }

  const [entry] = entries.splice(from, 1);
  entries.splice(to, 0, entry);
  return cloneVibeRadioTracks(entries);
}

export function getVibeRadioViewModel(tracks = null) {
  return cloneVibeRadioTracks(tracks).map((track, index) => ({
    ...track,
    trackNumber: index + 1,
    sourceLabel: getVibeRadioSourceTypeLabel(track.sourceType)
  }));
}
