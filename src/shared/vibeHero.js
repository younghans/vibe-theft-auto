import { VIBE_HERO_EDITED_CHART_ROWS } from './vibeHeroEditedCharts.js';

export const VIBE_HERO_GAME_ID = 'vibe-hero';
export const VIBE_HERO_DEFAULT_SONG_ID = 'debussy-arabesque-no-1';
export const VIBE_HERO_LANE_COUNT = 5;
export const VIBE_HERO_NOTE_TRAVEL_MS = 850;

const DEBUSSY_DURATION_MS = 75000;
const VIVALDI_SNIPPET_START_MS = 30000;
const VIVALDI_DURATION_MS = 95000;

const PITCH_CLASS_INDEX = Object.freeze({
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11
});

const NOTE_FREQUENCIES = Object.freeze({
  A4: 440
});

function getNoteFrequency(pitch = 'A4') {
  const normalizedPitch = String(pitch ?? 'A4').trim() || 'A4';
  if (NOTE_FREQUENCIES[normalizedPitch]) {
    return NOTE_FREQUENCIES[normalizedPitch];
  }

  const match = /^([A-G]#?)(-?\d+)$/u.exec(normalizedPitch);
  if (!match) {
    return NOTE_FREQUENCIES.A4;
  }

  const pitchClass = PITCH_CLASS_INDEX[match[1]];
  const octave = Number(match[2]);
  if (!Number.isFinite(pitchClass) || !Number.isFinite(octave)) {
    return NOTE_FREQUENCIES.A4;
  }

  const midi = ((octave + 1) * 12) + pitchClass;
  return Number((440 * (2 ** ((midi - 69) / 12))).toFixed(2));
}

function createChartNote({
  id,
  timeMs,
  lane,
  pitch,
  durationMs = 150
}) {
  const normalizedPitch = String(pitch ?? 'A4').trim() || 'A4';
  return {
    id,
    timeMs: Math.round(timeMs),
    durationMs: Math.round(durationMs),
    lane: Math.max(0, Math.min(VIBE_HERO_LANE_COUNT - 1, Math.trunc(Number(lane) || 0))),
    pitch: normalizedPitch,
    frequency: getNoteFrequency(normalizedPitch)
  };
}

function finalizeChart(chart) {
  const filtered = [];
  for (const note of chart) {
    if (note.timeMs >= 0) {
      filtered.push(note);
    }
  }
  filtered.sort((left, right) => (left.timeMs - right.timeMs) || (left.lane - right.lane));
  const finalized = [];
  for (let index = 0; index < filtered.length; index += 1) {
    const note = filtered[index];
    finalized.push(Object.freeze({
      ...note,
      id: note.id || 'n' + String(index + 1)
    }));
  }
  return Object.freeze(finalized);
}

function createRecordedEditorChart(songId) {
  const rows = VIBE_HERO_EDITED_CHART_ROWS[songId] ?? [];
  const chart = [];
  for (const row of rows) {
    chart.push(createChartNote({
      id: row[0],
      timeMs: row[1],
      lane: row[2],
      pitch: row[3],
      durationMs: row[4]
    }));
  }
  return finalizeChart(chart);
}

const VIBE_HERO_SONGS = Object.freeze([
  Object.freeze({
    id: 'debussy-arabesque-no-1',
    title: 'Debussy - Arabesque No. 1',
    artist: 'Claude Debussy',
    performer: 'Gregor Quendel',
    sourceTitle: 'Arabesque No. 1, L. 66',
    sourceUrl: 'https://www.classicals.de/debussy-arabesques',
    sourceDownloadUrl: 'https://library.classicalmusicarchive.org/music/GQ%20Collection/Classicals.de%20-%20Debussy%20-%20Arabesque%20No.%201%20-%20L.%2066.mp3',
    sourceLicense: 'Classicals.de / Pixabay-published recording attribution; snippet is from the start of the supplied MP3.',
    publicDomainBasis: 'Composition by Claude Debussy is public domain in the United States; recording source and attribution are documented in assets/audio/vibe-hero/License.txt.',
    chartSource: 'Admin-recorded editor chart promoted as the shipped main chart for the opening 75 seconds of the source MP3.',
    chartEdited: true,
    audioAssetKey: 'debussyArabesqueNo1',
    snippetStartMs: 0,
    durationMs: DEBUSSY_DURATION_MS,
    bpm: 118,
    difficulty: 'Expert',
    previewColor: '#54d7ff',
    chart: createRecordedEditorChart('debussy-arabesque-no-1')
  }),
  Object.freeze({
    id: 'vivaldi-winter',
    title: 'Vivaldi - Winter',
    artist: 'Antonio Vivaldi',
    performer: 'John Harrison with the Wichita State University Chamber Players',
    sourceTitle: 'The Four Seasons, Winter - I. Allegro non molto',
    sourceUrl: 'https://www.classicals.de/vivaldi-seasons',
    sourceDownloadUrl: 'https://www.classicals.de/s/Classicalsde-Vivaldi-The-Four-Seasons-10-John-Harrison-with-the-Wichita-State-University-Chamber-Pla.mp3',
    sourceLicense: 'Classicals.de lists the John Harrison movement recordings as CC BY-SA 4.0; Wikimedia/Musopen also marks the same movement recording public-domain.',
    publicDomainBasis: 'Composition by Antonio Vivaldi is public domain; recording source and attribution are documented in assets/audio/vibe-hero/License.txt.',
    chartSource: 'Admin-recorded editor chart promoted as the shipped main chart for the 30s-125s source MP3 window.',
    chartEdited: true,
    audioAssetKey: 'vivaldiWinterMvt1',
    snippetStartMs: VIVALDI_SNIPPET_START_MS,
    durationMs: VIVALDI_DURATION_MS,
    bpm: 148,
    difficulty: 'Expert+',
    previewColor: '#f26d78',
    chart: createRecordedEditorChart('vivaldi-winter')
  })
]);
const VIBE_HERO_SONG_BY_ID = new Map();
for (let index = 0; index < VIBE_HERO_SONGS.length; index += 1) {
  const song = VIBE_HERO_SONGS[index];
  VIBE_HERO_SONG_BY_ID.set(song.id, song);
}

function cloneVibeHeroSong(song = null) {
  if (!song) {
    return null;
  }

  const chart = [];
  for (const note of song.chart) {
    chart.push({ ...note });
  }
  return {
    ...song,
    chart
  };
}

export function listVibeHeroSongs() {
  const songs = [];
  for (const song of VIBE_HERO_SONGS) {
    songs.push(cloneVibeHeroSong(song));
  }
  return songs;
}

export function getVibeHeroSong(songId = VIBE_HERO_DEFAULT_SONG_ID) {
  const normalizedId = normalizeVibeHeroSongId(songId);
  const song = VIBE_HERO_SONG_BY_ID.get(normalizedId)
    ?? VIBE_HERO_SONGS[0];
  return cloneVibeHeroSong(song);
}

export function normalizeVibeHeroSongId(songId = VIBE_HERO_DEFAULT_SONG_ID) {
  const normalizedId = String(songId ?? '').trim().toLowerCase();
  return VIBE_HERO_SONG_BY_ID.has(normalizedId)
    ? normalizedId
    : VIBE_HERO_DEFAULT_SONG_ID;
}
