export const VIBE_HERO_GAME_ID = 'vibe-hero';
export const VIBE_HERO_DEFAULT_SONG_ID = 'debussy-arabesque-no-1';
export const VIBE_HERO_LANE_COUNT = 5;
export const VIBE_HERO_NOTE_TRAVEL_MS = 850;

const DEBUSSY_DURATION_MS = 75000;
const VIVALDI_SNIPPET_START_MS = 30000;
const VIVALDI_DURATION_MS = 95000;
const ONSET_CHART_MIN_NOTE_MS = 86;
const ONSET_CHART_MAX_NOTE_MS = 340;

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

const CHART_PITCHES = Object.freeze([
  'F3', 'A3', 'A#3', 'C4', 'C#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5', 'C6', 'C#6', 'D6', 'D#6', 'E6'
]);
const DEBUSSY_SOURCE_ONSET_TIMES = Object.freeze([
  1548, 1977, 2094, 2279, 2465, 2639, 3034, 3231, 3382, 3568, 3742, 3928, 4114, 4299,
  4485, 4671, 5089, 5762, 6227, 6412, 6598, 6784, 6958, 7144, 7330, 7515, 7701, 7887,
  8061, 8247, 8433, 8607, 8804, 8978, 9164, 9338, 9524, 9721, 9907, 10081, 10267, 10511,
  10743, 10987, 11265, 11544, 11707, 11823, 12438, 13042, 14203, 14388, 14563, 14748, 14934, 15108,
  15306, 15491, 15666, 15863, 16037, 16142, 16420, 16536, 16676, 19149, 19334, 19520, 19706, 19903,
  20077, 20263, 20530, 20635, 20809, 22539, 22678, 22829, 23026, 24199, 24385, 24803, 25209, 25488,
  25859, 26103, 26312, 27136, 27241, 27415, 28239, 28402, 28506, 28796, 29063, 29354, 29609, 29888,
  30178, 30712, 30875, 31049, 31211, 31490, 31734, 31978, 32233, 32465, 32686, 32848, 32999, 33150,
  33382, 33591, 33800, 34021, 34253, 34485, 34718, 34950, 35194, 35472, 35762, 36064, 36389, 36807,
  37214, 37632, 38270, 38468, 38874, 39013, 39199, 39385, 39919, 40023, 41057, 41393, 42322, 42519,
  43228, 43413, 43773, 43959, 44075, 44331, 44470, 44702, 45701, 45979, 46258, 46537, 46734, 46908,
  47094, 47906, 48011, 48185, 48464, 48731, 48905, 50089, 50345, 50600, 50844, 51099, 51204, 51355,
  51471, 51575, 53688, 53955, 54060, 54234, 54420, 54605, 55000, 55360, 55848, 56092, 56347, 56602,
  56858, 57067, 57775, 57961, 58135, 60167, 60434, 61165, 61351, 61537, 61722, 61920, 62280, 62454,
  62640, 66146, 66332, 66506, 66680, 66877, 67051, 67225, 67400, 67585, 67771, 68015, 68143, 68282,
  68526, 68746, 68967, 69211, 69664, 70128, 70360, 70592, 71068, 71521, 71835, 72020, 72171, 72311,
  72462, 72624, 72775, 72926, 73077, 73239, 73390, 73855, 74400, 74935
]);
const DEBUSSY_EDITOR_EXTRA_NOTE_TIMES = Object.freeze([
  1763, 2837, 4880, 5392, 5971, 12100, 12710, 13240, 13483, 13757, 13958, 17033, 17295, 17616, 17878, 18199,
  18560, 18825, 21105, 21466, 21670, 21874, 22173, 23227, 23472, 23748, 23951, 24594, 25006, 26625, 26855, 27728,
  27958, 30418, 36598, 37011, 37423, 37919, 38671, 39625, 40416, 40704, 41746, 42005, 42788, 42986, 45082, 45361,
  47403, 47629, 49108, 49355, 49634, 49839, 51880, 52104, 52378, 52602, 52876, 53185, 53411, 55580, 57336, 57534,
  58428, 58644, 58907, 59123, 59386, 59683, 59901, 60712, 60916, 62868, 63146, 63460, 63690, 63972, 64286, 64516,
  64798, 65028, 65310, 65628, 65861, 69415, 69873, 70806, 71272, 73599, 74100, 74641
]);
const VIVALDI_SOURCE_ONSET_TIMES = Object.freeze([
  8328, 8700, 8885, 8978, 9176, 9268, 9477, 9652, 9733, 9814, 9965, 10162, 10313, 10395,
  10476, 10894, 11056, 11138, 11753, 11846, 11927, 12090, 12171, 12252, 12403, 12484, 12612, 12717,
  12833, 16188, 16316, 16490, 16594, 16676, 16757, 16838, 16966, 17047, 17256, 17407, 17488, 17570,
  17709, 17790, 17976, 18127, 18220, 18429, 18615, 18777, 18858, 19625, 19834, 19926, 20008, 20147,
  20228, 20310, 20472, 23943, 24118, 24211, 24303, 24385, 24547, 24675, 24884, 25046, 25139, 25337,
  25430, 25557, 25720, 25801, 25894, 26045, 26126, 26312, 26474, 26556, 26707, 27055, 27206, 27368,
  27519, 27682, 27844, 28053, 28158, 39571, 39954, 40174, 40360, 40569, 40766, 40975, 41149, 41358,
  41556, 41788, 41916, 42067, 42160, 42252, 42334, 42519, 42717, 42879, 43065, 43286, 43471, 43669,
  43866, 44087, 44273, 44470, 44656, 44888, 44981, 45074, 45155, 45248, 45341, 45422, 45631, 45828,
  46014, 46200, 46409, 46606, 46792, 46966, 47187, 47384, 47593, 47767, 47976, 48081, 48162, 48255,
  48348, 48522, 48708, 48893, 49067, 49276, 49497, 49671, 49892, 50078, 50275, 50461, 50658, 50855,
  51053, 51157, 51250, 51331, 51413, 51506, 51587, 51796, 51982, 52179, 52376, 52574, 52771, 52968,
  53166, 53352, 53537, 53735, 53944, 54164, 54338, 54420, 54513, 54605, 54710, 54791, 54931, 55035,
  55116, 55221, 55314, 55395, 55499, 55604, 55766, 55871, 55952, 56045, 56126, 56428, 56509, 56591,
  56695, 56788, 56881, 57044, 57160, 57287, 57369, 57601, 57705, 57798, 57903, 57984, 58077, 58181,
  58541, 59052, 59133, 59238, 59319, 59435, 59621, 59725, 59830, 59911, 60120, 60213, 60306, 60480,
  60596, 60759, 60886, 60991, 61107, 61246, 61328, 61409, 61502, 61653, 61757, 61908, 62059, 62164,
  62314, 62849, 62953, 63812, 64195, 64311, 64497, 64578, 64706, 64787, 64985, 65171, 65298, 65461,
  65623, 65751, 65902, 66030, 66262, 66355, 66459, 66564, 66738, 66935, 67806, 67910, 68561, 68979,
  69083, 69176, 69385, 69571, 69791, 69873, 69989, 70186, 70302, 70395, 70488, 70581, 70708, 70813,
  71010, 71126, 71208, 71289, 71382, 71475, 71568, 71660, 71869, 72078, 72241, 72601, 72694, 72787,
  72972, 73054, 73158, 73251, 73344, 73936, 74029, 74110, 74203, 74308, 74389, 74482, 74563, 74656,
  74737, 74830, 74923, 75318, 75422, 75527, 75619, 75712, 75828, 76014, 76096, 76200, 76479, 76897,
  77048, 77164, 77257, 77361, 77489, 77582, 77674, 77756, 77918, 78011, 78127, 78359, 78476, 78568,
  78673, 78766, 78847, 78975, 79068, 79149, 79253, 79335, 79428, 79520, 79625, 79846, 79950, 80031,
  80136, 80240, 80333, 80438, 80542, 80635, 80739, 80821, 80925, 81007, 81111, 81192, 81645, 81738,
  81831, 81912, 82005, 82098, 82191, 82272, 82365, 82481, 82632, 82771, 82864, 82957, 83038, 83154,
  83259, 83363, 83479, 83654, 83758, 83851, 83944, 84025, 84118, 84211, 84304, 84490, 84582, 84780,
  84977, 85163, 85267, 85349, 85430, 85534, 85639, 85720, 85801, 85918, 86022, 86115, 86208, 86312,
  86405, 86498, 86591, 86695, 86788, 86881, 86986, 87079, 87171, 87253, 87334, 87438, 87764, 87868,
  88123, 88251, 88356, 88437, 88530, 88623, 88739, 88820, 88901, 89029, 89122, 89226, 89331, 89412,
  89668, 89807, 89900, 89993, 90086, 90225, 90376, 90480, 90573, 90689, 90805, 90898, 90991, 91096,
  91188, 91270, 91363, 91456, 91560, 91653, 91746, 91850, 91943, 92140
]);
const DEBUSSY_SOURCE_ONSET_LANES =
  '330122023123011240212120324221430323441003411340333441123402302002340122423411211122401142234221' +
  '120403103224112301134333323333332234003332323442334303234342343222233340122341310022321011134101' +
  '230011340120101034022122232233041203012224';
const DEBUSSY_EDITOR_EXTRA_NOTE_LANES =
  '2334430200202403440122202032222433110412102032104100440313434023' +
  '1423413043143343044120131002';
const VIVALDI_SOURCE_ONSET_LANES =
  '420112001220012240212040320004401234412340123441234210340113341233412234023340234302234004244234' +
  '412334012340122442123201231012300224202211012040124321244002340120101230222403234012340123401244' +
  '132301223014340023031244402330122301223402240124444234012340013440134001440223441124412344013300' +
  '032411344012131123411234112331032311140023401012041133402240123401234012304214010340123401234012' +
  '24412344123401232040343423401234001330123201034012444122401032042340423204';
const DEBUSSY_SOURCE_ONSET_PITCHES =
  'hllgg9111aaeggc9o1aaa11etam1qetaj1mmmem71mq77gggmmhjehcc99cllo995eccecc7oooo2oo55599o1145gaa9995' +
  '5e1n2en2h99q4eee2l9lqlhhlbljjllmahllgcjjhcgghhoooggg1h9lc12aaah99aahhjjgggamemo511aahf89871jo522' +
  '12222723212cc233332aa7cc9la9mam5aao7a99adt';
const VIVALDI_SOURCE_ONSET_PITCHES =
  'pdkkddpkkkdplljdlkdddpddpdpldnnsspppknspppnnnpmsssodsdsnsskkkksspkksskkkksrmkksrrkkskkkkdpepeppp' +
  'ipokkkkkkkkkkddlddddddeedeqeeeekekdkddkd1ndddpddddp7deaiea6baebbbqqebbdhthdhlhiiihiikklkllklllnl' +
  'nlllpnpmlpppppsipp1iqp1riirpirqqimnqniiilnmsrqqqsrspsspnspqnllpsnjknpp0mrrp0rorlnlknknnnnllinlni' +
  '9n9tthnnikkd8dtkkkknkkktthhkereraiohbonlnnops0adndididadmdm0mmmmmmmmmmmmmnnrfrnrdrrrrooooooooooo' +
  'ioioppnknppnnnsrarffrrffrrrrrrrrrl5ngsnnr9nn9snsnnsngnnhsnrfrfrfprrrfrrfrf';

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

function getOnsetDurationMs(times, index) {
  const currentTimeMs = Number(times[index] ?? 0) || 0;
  const nextTimeMs = Number(times[index + 1] ?? currentTimeMs + 240) || currentTimeMs + 240;
  const gapMs = Math.max(ONSET_CHART_MIN_NOTE_MS, nextTimeMs - currentTimeMs);
  return Math.max(
    ONSET_CHART_MIN_NOTE_MS,
    Math.min(ONSET_CHART_MAX_NOTE_MS, gapMs * 0.62)
  );
}

function decodePitch(encodedPitches, index) {
  const pitchIndex = Number.parseInt(String(encodedPitches[index] ?? 'a'), 36);
  return CHART_PITCHES[pitchIndex] ?? 'A4';
}

function createSourceOnsetChart({
  times,
  lanes,
  pitches,
  idPrefix
}) {
  const chart = [];
  for (let index = 0; index < times.length; index += 1) {
    chart.push(createChartNote({
      id: `${idPrefix}-${index + 1}`,
      timeMs: times[index],
      lane: Number(lanes[index] ?? 0),
      pitch: decodePitch(pitches, index),
      durationMs: getOnsetDurationMs(times, index)
    }));
  }
  return finalizeChart(chart);
}

function getNearestChartNoteForLane(chart, lane, timeMs) {
  let bestNote = null;
  let bestDistance = Infinity;
  for (const note of chart) {
    const lanePenalty = note.lane === lane ? 0 : 1000000;
    const distance = Math.abs((Number(note.timeMs) || 0) - timeMs) + lanePenalty;
    if (distance < bestDistance) {
      bestNote = note;
      bestDistance = distance;
    }
  }
  return bestNote;
}

function createEditorExtraChart({
  times,
  lanes,
  sourceChart,
  idPrefix
}) {
  const chart = [];
  for (let index = 0; index < times.length; index += 1) {
    const timeMs = times[index];
    const lane = Number(lanes[index] ?? 0);
    const referenceNote = getNearestChartNoteForLane(sourceChart, lane, timeMs);
    chart.push(createChartNote({
      id: `${idPrefix}-${index + 1}`,
      timeMs,
      lane,
      pitch: referenceNote?.pitch ?? 'A4',
      durationMs: referenceNote?.durationMs ?? 150
    }));
  }
  return chart;
}

function finalizeChart(chart) {
  const filtered = [];
  for (const note of chart) {
    if (note.timeMs >= 0) {
      filtered.push(note);
    }
  }
  filtered.sort((left, right) => left.timeMs - right.timeMs);
  const finalized = [];
  for (let index = 0; index < filtered.length; index += 1) {
    const note = filtered[index];
    finalized.push(Object.freeze({
      ...note,
      id: note.id || `n${index + 1}`
    }));
  }
  return Object.freeze(finalized);
}

function createDebussyArabesqueChart() {
  const sourceChart = createSourceOnsetChart({
    times: DEBUSSY_SOURCE_ONSET_TIMES,
    lanes: DEBUSSY_SOURCE_ONSET_LANES,
    pitches: DEBUSSY_SOURCE_ONSET_PITCHES,
    idPrefix: 'debussy-onset'
  });
  return finalizeChart([
    ...sourceChart,
    ...createEditorExtraChart({
      times: DEBUSSY_EDITOR_EXTRA_NOTE_TIMES,
      lanes: DEBUSSY_EDITOR_EXTRA_NOTE_LANES,
      sourceChart,
      idPrefix: 'debussy-editor-extra'
    })
  ]);
}

function createVivaldiWinterChart() {
  return createSourceOnsetChart({
    times: VIVALDI_SOURCE_ONSET_TIMES,
    lanes: VIVALDI_SOURCE_ONSET_LANES,
    pitches: VIVALDI_SOURCE_ONSET_PITCHES,
    idPrefix: 'vivaldi-onset'
  });
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
    chartSource: 'Editor-polished source-MP3 onset chart for substantial piano key attacks in the opening 75 seconds.',
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
    chartSource: 'Source-MP3 onset chart for substantial violin attacks from 30s to 125s of the supplied MP3.',
    audioAssetKey: 'vivaldiWinterMvt1',
    snippetStartMs: VIVALDI_SNIPPET_START_MS,
    durationMs: VIVALDI_DURATION_MS,
    bpm: 148,
    difficulty: 'Expert+',
    previewColor: '#f26d78',
    chart: createVivaldiWinterChart()
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
