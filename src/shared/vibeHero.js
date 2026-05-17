export const VIBE_HERO_GAME_ID = 'vibe-hero';
export const VIBE_HERO_DEFAULT_SONG_ID = 'debussy-arabesque-no-1';
export const VIBE_HERO_LANE_COUNT = 5;

const NOTE_FREQUENCIES = Object.freeze({
  F3: 174.61,
  'F#3': 185.0,
  G3: 196.0,
  'G#3': 207.65,
  A3: 220.0,
  'A#3': 233.08,
  B3: 246.94,
  C4: 261.63,
  'C#4': 277.18,
  D4: 293.66,
  'D#4': 311.13,
  E4: 329.63,
  F4: 349.23,
  'F#4': 369.99,
  G4: 392.0,
  'G#4': 415.3,
  A4: 440.0,
  'A#4': 466.16,
  B4: 493.88,
  C5: 523.25,
  'C#5': 554.37,
  D5: 587.33,
  'D#5': 622.25,
  E5: 659.25,
  F5: 698.46,
  'F#5': 739.99,
  G5: 783.99,
  'G#5': 830.61,
  A5: 880.0,
  'A#5': 932.33,
  B5: 987.77,
  C6: 1046.5,
  'C#6': 1108.73,
  D6: 1174.66,
  E6: 1318.51
});

const DEBUSSY_DURATION_MS = 75000;
const VIVALDI_DURATION_MS = 65000;

function getNoteFrequency(pitch = 'A4') {
  return NOTE_FREQUENCIES[pitch] ?? NOTE_FREQUENCIES.A4;
}

function createChartNote({
  id,
  timeMs,
  lane,
  pitch,
  durationMs = 150
}) {
  return {
    id,
    timeMs: Math.round(timeMs),
    durationMs: Math.round(durationMs),
    lane: Math.max(0, Math.min(VIBE_HERO_LANE_COUNT - 1, Math.trunc(Number(lane) || 0))),
    pitch,
    frequency: getNoteFrequency(pitch)
  };
}

function pushPattern(chart, pattern, {
  startMs,
  stepMs,
  durationMs,
  endMs,
  idPrefix
}) {
  let cursor = Number(startMs) || 0;
  for (const entry of pattern) {
    if (cursor >= endMs) {
      break;
    }
    const [lane, pitch, hold = 1] = entry;
    chart.push(createChartNote({
      id: `${idPrefix}-${chart.length + 1}`,
      timeMs: cursor,
      lane,
      pitch,
      durationMs: durationMs * hold
    }));
    cursor += stepMs;
  }
  return cursor;
}

function finalizeChart(chart) {
  return Object.freeze(
    chart
      .filter((note) => note.timeMs >= 0)
      .sort((left, right) => left.timeMs - right.timeMs)
      .map((note, index) => Object.freeze({
        ...note,
        id: note.id || `n${index + 1}`
      }))
  );
}

function createDebussyArabesqueChart() {
  const chart = [];
  const patterns = [
    [
      [0, 'E4', 1.4], [2, 'B4'], [4, 'E5'], [1, 'G#4'], [3, 'B5'], [4, 'E6'],
      [2, 'C#5'], [0, 'G#4'], [3, 'E5'], [1, 'C#5'], [4, 'G#5'], [2, 'B5']
    ],
    [
      [1, 'F#4', 1.25], [3, 'C#5'], [4, 'F#5'], [0, 'A4'], [2, 'C#6'], [4, 'A5'],
      [3, 'E5'], [1, 'B4'], [0, 'G#4'], [2, 'E5'], [4, 'B5'], [3, 'G#5']
    ],
    [
      [0, 'G#3', 1.4], [2, 'D#4'], [4, 'G#4'], [1, 'B4'], [3, 'D#5'], [4, 'G#5'],
      [2, 'F#5'], [0, 'D#5'], [1, 'B4'], [3, 'G#4'], [4, 'C#5'], [2, 'E5']
    ],
    [
      [2, 'C#4', 1.3], [4, 'G#4'], [1, 'C#5'], [3, 'E5'], [0, 'G#5'], [4, 'C#6'],
      [1, 'B5'], [3, 'G#5'], [2, 'E5'], [0, 'C#5'], [4, 'A5'], [1, 'F#5']
    ]
  ];
  const turn = [
    [3, 'B4'], [1, 'C#5'], [4, 'E5'], [2, 'G#5'], [0, 'F#5'], [3, 'E5'], [1, 'C#5']
  ];
  let timeMs = 620;
  let phrase = 0;
  while (timeMs < DEBUSSY_DURATION_MS - 900) {
    const stepMs = phrase % 5 === 4 ? 205 : 225;
    timeMs = pushPattern(chart, patterns[phrase % patterns.length], {
      startMs: timeMs,
      stepMs,
      durationMs: phrase % 3 === 1 ? 145 : 165,
      endMs: DEBUSSY_DURATION_MS - 500,
      idPrefix: 'debussy'
    });
    if (phrase % 3 === 2 && timeMs < DEBUSSY_DURATION_MS - 1200) {
      timeMs += 80;
      timeMs = pushPattern(chart, turn, {
        startMs: timeMs,
        stepMs: 150,
        durationMs: 118,
        endMs: DEBUSSY_DURATION_MS - 500,
        idPrefix: 'debussy-turn'
      });
    } else {
      timeMs += phrase % 4 === 1 ? 170 : 90;
    }
    phrase += 1;
  }
  return finalizeChart(chart);
}

function createVivaldiWinterChart() {
  const chart = [];
  const frostPulse = [
    [0, 'F4'], [2, 'C5'], [4, 'F5'], [1, 'G#4'], [3, 'C6'], [4, 'F5'],
    [2, 'C5'], [1, 'G#4']
  ];
  const violinRunUp = [
    [0, 'F4'], [1, 'G4'], [2, 'G#4'], [3, 'A#4'], [4, 'C5'],
    [3, 'D5'], [2, 'D#5'], [1, 'F5'], [0, 'G5'], [2, 'G#5']
  ];
  const violinRunDown = [
    [4, 'C6'], [3, 'A#5'], [2, 'G#5'], [1, 'G5'], [0, 'F5'],
    [1, 'D#5'], [2, 'D5'], [3, 'C5'], [4, 'A#4'], [2, 'G#4']
  ];
  const bite = [
    [0, 'F4', 1.3], [4, 'C6'], [1, 'G#4'], [3, 'D#5'], [2, 'C5'],
    [4, 'F5'], [0, 'F4'], [2, 'G#4'], [1, 'C5'], [3, 'F5'], [4, 'G#5']
  ];

  let timeMs = 480;
  for (let repeat = 0; repeat < 10; repeat += 1) {
    timeMs = pushPattern(chart, frostPulse, {
      startMs: timeMs,
      stepMs: 145,
      durationMs: 96,
      endMs: 11800,
      idPrefix: 'vivaldi-frost'
    });
    timeMs += repeat % 2 === 0 ? 70 : 35;
  }

  timeMs = 12080;
  for (let repeat = 0; repeat < 8; repeat += 1) {
    timeMs = pushPattern(chart, repeat % 2 === 0 ? violinRunUp : violinRunDown, {
      startMs: timeMs,
      stepMs: repeat < 4 ? 118 : 108,
      durationMs: 82,
      endMs: 28600,
      idPrefix: 'vivaldi-run'
    });
    timeMs += 46;
  }

  timeMs = 28750;
  for (let repeat = 0; repeat < 9; repeat += 1) {
    timeMs = pushPattern(chart, bite, {
      startMs: timeMs,
      stepMs: repeat % 3 === 2 ? 122 : 134,
      durationMs: 86,
      endMs: 43600,
      idPrefix: 'vivaldi-bite'
    });
    timeMs += repeat % 2 === 0 ? 82 : 34;
  }

  timeMs = 43880;
  let sprint = 0;
  while (timeMs < VIVALDI_DURATION_MS - 550) {
    const pattern = sprint % 4 === 0
      ? violinRunUp
      : sprint % 4 === 1
        ? frostPulse
        : sprint % 4 === 2
          ? violinRunDown
          : bite;
    timeMs = pushPattern(chart, pattern, {
      startMs: timeMs,
      stepMs: sprint > 7 ? 96 : 104,
      durationMs: 72,
      endMs: VIVALDI_DURATION_MS - 450,
      idPrefix: 'vivaldi-sprint'
    });
    timeMs += sprint % 3 === 0 ? 28 : 12;
    sprint += 1;
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
    audioAssetKey: 'debussyArabesqueNo1',
    snippetStartMs: 0,
    durationMs: DEBUSSY_DURATION_MS,
    bpm: 118,
    difficulty: 'Expert',
    previewColor: '#54d7ff',
    chart: createDebussyArabesqueChart()
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
    audioAssetKey: 'vivaldiWinterMvt1',
    snippetStartMs: 0,
    durationMs: VIVALDI_DURATION_MS,
    bpm: 148,
    difficulty: 'Expert+',
    previewColor: '#f26d78',
    chart: createVivaldiWinterChart()
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
