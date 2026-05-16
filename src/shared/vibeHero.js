export const VIBE_HERO_GAME_ID = 'vibe-hero';
export const VIBE_HERO_DEFAULT_SONG_ID = 'twinkle-skyline';
export const VIBE_HERO_LANE_COUNT = 4;

const NOTE_FREQUENCIES = Object.freeze({
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25
});

const NOTE_LANES = Object.freeze({
  C4: 0,
  D4: 1,
  E4: 2,
  F4: 3,
  G4: 1,
  A4: 2,
  C5: 3
});

function createChart(sequence, {
  startMs = 700,
  stepMs = 640,
  noteMs = 360
} = {}) {
  return sequence.map((pitch, index) => ({
    id: `n${index + 1}`,
    timeMs: startMs + (index * stepMs),
    durationMs: noteMs,
    lane: NOTE_LANES[pitch] ?? (index % VIBE_HERO_LANE_COUNT),
    pitch,
    frequency: NOTE_FREQUENCIES[pitch] ?? NOTE_FREQUENCIES.C4
  }));
}

const TWINKLE_SEQUENCE = Object.freeze([
  'C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4',
  'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4',
  'G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4',
  'G4', 'G4', 'F4', 'F4', 'E4', 'E4', 'D4',
  'C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4',
  'F4', 'F4', 'E4', 'E4', 'D4', 'D4', 'C4'
]);

const FRERE_SEQUENCE = Object.freeze([
  'C4', 'D4', 'E4', 'C4',
  'C4', 'D4', 'E4', 'C4',
  'E4', 'F4', 'G4',
  'E4', 'F4', 'G4',
  'G4', 'A4', 'G4', 'F4', 'E4', 'C4',
  'G4', 'A4', 'G4', 'F4', 'E4', 'C4',
  'C4', 'G4', 'C4',
  'C4', 'G4', 'C4'
]);

const VIBE_HERO_SONGS = Object.freeze([
  Object.freeze({
    id: 'twinkle-skyline',
    title: 'Twinkle Skyline',
    artist: 'Traditional',
    sourceTitle: 'Twinkle, Twinkle, Little Star',
    publicDomainBasis: 'Traditional melody arranged as original Web Audio synth playback; no recording asset is used.',
    durationMs: 27850,
    bpm: 94,
    previewColor: '#54d7ff',
    chart: Object.freeze(createChart(TWINKLE_SEQUENCE, {
      startMs: 760,
      stepMs: 600,
      noteMs: 390
    }))
  }),
  Object.freeze({
    id: 'frere-night-drive',
    title: 'Frere Night Drive',
    artist: 'Traditional',
    sourceTitle: 'Frere Jacques',
    publicDomainBasis: 'Traditional melody arranged as original Web Audio synth playback; no recording asset is used.',
    durationMs: 25450,
    bpm: 82,
    previewColor: '#ffd15c',
    chart: Object.freeze(createChart(FRERE_SEQUENCE, {
      startMs: 720,
      stepMs: 730,
      noteMs: 430
    }))
  })
]);

export function listVibeHeroSongs() {
  return VIBE_HERO_SONGS.map((song) => ({
    ...song,
    chart: song.chart.map((note) => ({ ...note }))
  }));
}

export function getVibeHeroSong(songId = VIBE_HERO_DEFAULT_SONG_ID) {
  const normalizedId = normalizeVibeHeroSongId(songId);
  const song = VIBE_HERO_SONGS.find((entry) => entry.id === normalizedId)
    ?? VIBE_HERO_SONGS[0];
  return song
    ? {
        ...song,
        chart: song.chart.map((note) => ({ ...note }))
      }
    : null;
}

export function normalizeVibeHeroSongId(songId = VIBE_HERO_DEFAULT_SONG_ID) {
  const normalizedId = String(songId ?? '').trim().toLowerCase();
  return VIBE_HERO_SONGS.some((song) => song.id === normalizedId)
    ? normalizedId
    : VIBE_HERO_DEFAULT_SONG_ID;
}
