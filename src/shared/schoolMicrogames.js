export const SCHOOL_MICROGAME_IDS = Object.freeze({
  popQuiz: 'pop-quiz-panic',
  popQuizPanic: 'pop-quiz-panic',
  lockerCombo: 'locker-combo',
  hallPass: 'hall-pass-check',
  hallPassCheck: 'hall-pass-check',
  copyNotes: 'copy-the-notes',
  copyTheNotes: 'copy-the-notes',
  teacherLooking: 'teacher-is-looking',
  teacherIsLooking: 'teacher-is-looking',
  cafeteriaTray: 'cafeteria-tray-save',
  cafeteriaTraySave: 'cafeteria-tray-save',
  dodgeChalk: 'dodge-the-chalk',
  dodgeTheChalk: 'dodge-the-chalk',
  sortBackpack: 'sort-the-backpack',
  sortTheBackpack: 'sort-the-backpack',
  bellSprint: 'bell-sprint',
  scantron: 'scantron-speedrun',
  scantronSpeedrun: 'scantron-speedrun'
});

export const SCHOOL_MICROGAME_DEFAULT_ID = SCHOOL_MICROGAME_IDS.popQuizPanic;
export const SCHOOL_MICROGAME_ALL_ID = 'all';
export const SCHOOL_MICROGAME_DEFAULT_REWARD_XP = 8;
export const SCHOOL_MICROGAME_DEFAULT_REWARD_MONEY = 12;

const QUESTION_BANK = Object.freeze([
  Object.freeze({ question: 'What is 9 x 7?', answers: Object.freeze(['54', '63', '72']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is a noun?', answers: Object.freeze(['Quickly', 'Locker', 'Blue']), correctIndex: 1 }),
  Object.freeze({ question: 'What planet is known as the red planet?', answers: Object.freeze(['Mars', 'Venus', 'Jupiter']), correctIndex: 0 }),
  Object.freeze({ question: 'Solve: 18 + 24', answers: Object.freeze(['32', '42', '46']), correctIndex: 1 }),
  Object.freeze({ question: 'Which is a complete sentence?', answers: Object.freeze(['Ran fast', 'Because lunch', 'The bell rang']), correctIndex: 2 })
]);

const HALL_PASS_ROUNDS = Object.freeze([
  Object.freeze({ prompt: 'Return a graphing calculator before algebra starts.', correct: 'Math' }),
  Object.freeze({ prompt: 'Coach says dodgeball drills are already running.', correct: 'Gym' }),
  Object.freeze({ prompt: 'Check out the book before the final bell.', correct: 'Library' }),
  Object.freeze({ prompt: 'The tray line closes in a few seconds.', correct: 'Cafeteria' }),
  Object.freeze({ prompt: 'Scheduling slip says to report downstairs.', correct: 'Office' })
]);

const PASS_OPTIONS = Object.freeze(['Math', 'Gym', 'Library', 'Cafeteria', 'Office']);

const NOTE_SEQUENCES = Object.freeze([
  Object.freeze(['W', 'A', 'S', 'D']),
  Object.freeze(['A', 'D', 'A', 'W']),
  Object.freeze(['D', 'S', 'A', 'W']),
  Object.freeze(['W', 'W', 'A', 'D']),
  Object.freeze(['S', 'A', 'D', 'W'])
]);

const BACKPACK_ITEMS = Object.freeze([
  Object.freeze({ id: 'math-book', label: 'Math Book', category: 'Book' }),
  Object.freeze({ id: 'history-notes', label: 'Notes', category: 'Book' }),
  Object.freeze({ id: 'apple', label: 'Apple', category: 'Snack' }),
  Object.freeze({ id: 'chips', label: 'Chips', category: 'Snack' }),
  Object.freeze({ id: 'slingshot', label: 'Slingshot', category: 'Contraband' }),
  Object.freeze({ id: 'spray-can', label: 'Spray Can', category: 'Contraband' }),
  Object.freeze({ id: 'pencil', label: 'Pencil', category: 'Supply' }),
  Object.freeze({ id: 'eraser', label: 'Eraser', category: 'Supply' })
]);

const BACKPACK_BINS = Object.freeze(['Book', 'Snack', 'Supply', 'Contraband']);

const SCANTRON_KEYS = Object.freeze([
  Object.freeze(['B', 'A', 'D', 'C']),
  Object.freeze(['C', 'D', 'A', 'B']),
  Object.freeze(['A', 'C', 'B', 'D']),
  Object.freeze(['D', 'B', 'C', 'A'])
]);

const SCHOOL_MICROGAME_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.popQuizPanic,
    title: 'Pop Quiz Panic',
    shortTitle: 'Quiz',
    subtitle: 'Pick the answer before the bell bites.',
    description: 'Pick the correct answer before the clock eats the grade.',
    eyebrow: 'Classroom',
    prompt: 'Start pop quiz',
    overheadText: 'E to take pop quiz',
    durationMs: 7000,
    rewardXp: 12,
    rewardMoney: 16,
    accent: '#38d3ff',
    accent2: '#ffd84f',
    secondaryAccent: '#ffd84f',
    icon: '?',
    skill: 'intelligence'
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.lockerCombo,
    title: 'Locker Combo',
    shortTitle: 'Locker',
    subtitle: 'Memorize the flash, then punch it in clean.',
    description: 'Memorize the flash, then punch in the combo cleanly.',
    eyebrow: 'Hallway',
    prompt: 'Crack locker combo',
    overheadText: 'E to crack locker',
    durationMs: 8500,
    rewardXp: 10,
    rewardMoney: 14,
    accent: '#f28d35',
    accent2: '#58e2a5',
    secondaryAccent: '#58e2a5',
    icon: '#',
    skill: 'intelligence'
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.hallPassCheck,
    title: 'Hall Pass Check',
    shortTitle: 'Hall Pass',
    subtitle: 'Match the monitor with the right pass.',
    description: 'Match the pass to the excuse before suspicion spikes.',
    eyebrow: 'Hall Monitor',
    prompt: 'Show hall pass',
    overheadText: 'E for hall pass check',
    durationMs: 6500,
    rewardXp: 11,
    rewardMoney: 12,
    accent: '#6ee7a8',
    accent2: '#69a7ff',
    secondaryAccent: '#69a7ff',
    icon: 'PASS',
    skill: 'intelligence'
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.copyTheNotes,
    title: 'Copy The Notes',
    shortTitle: 'Notes',
    subtitle: 'Repeat the chalkboard sequence fast.',
    description: 'Repeat the sequence exactly while the board is still readable.',
    eyebrow: 'Study Sprint',
    prompt: 'Copy notes',
    overheadText: 'E to copy notes',
    durationMs: 8500,
    rewardXp: 14,
    rewardMoney: 15,
    accent: '#7cc7ff',
    accent2: '#f4d35e',
    secondaryAccent: '#f4d35e',
    icon: 'AB',
    skill: 'intelligence'
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.teacherIsLooking,
    title: 'Teacher Is Looking',
    shortTitle: 'Teacher',
    subtitle: 'Green light: type. Red light: freeze.',
    description: 'Type the sentence while the teacher faces the board. Stop when they turn around.',
    eyebrow: 'Risky Notes',
    prompt: 'Type secret sentence',
    overheadText: 'E for risky writing',
    durationMs: 16000,
    rewardXp: 13,
    rewardMoney: 20,
    accent: '#ff7a66',
    accent2: '#78f0b5',
    secondaryAccent: '#78f0b5',
    icon: 'EYE',
    skill: 'intelligence'
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.cafeteriaTraySave,
    title: 'Cafeteria Tray Save',
    shortTitle: 'Tray Save',
    subtitle: 'Tap left and right to keep lunch alive.',
    description: 'Tap left and right to keep lunch from becoming floor art.',
    eyebrow: 'Cafeteria',
    prompt: 'Balance tray',
    overheadText: 'E to balance tray',
    durationMs: 9000,
    rewardXp: 10,
    rewardMoney: 17,
    accent: '#f2c14e',
    accent2: '#4ecdc4',
    secondaryAccent: '#4ecdc4',
    icon: 'TRAY',
    skill: 'intelligence'
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.dodgeTheChalk,
    title: 'Dodge The Chalk',
    shortTitle: 'Chalk Dodge',
    subtitle: 'Three lanes, flying chalk, zero dignity lost.',
    description: 'Shift lanes and stay sharp while chalk flies across the room.',
    eyebrow: 'Class Chaos',
    prompt: 'Dodge chalk',
    overheadText: 'E to dodge chalk',
    durationMs: 8500,
    rewardXp: 10,
    rewardMoney: 18,
    accent: '#f5f7fa',
    accent2: '#ff5f7e',
    secondaryAccent: '#ff5f7e',
    icon: '!',
    skill: 'intelligence'
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.sortTheBackpack,
    title: 'Sort The Backpack',
    shortTitle: 'Backpack',
    subtitle: 'Toss items into the right bins before the zipper gives up.',
    description: 'Pick an item, then drop it into the right bin before time runs out.',
    eyebrow: 'Bag Check',
    prompt: 'Sort backpack',
    overheadText: 'E to sort backpack',
    durationMs: 10000,
    rewardXp: 12,
    rewardMoney: 16,
    accent: '#b983ff',
    accent2: '#68e08f',
    secondaryAccent: '#68e08f',
    icon: 'BAG',
    skill: 'intelligence'
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.bellSprint,
    title: 'Bell Sprint',
    shortTitle: 'Bell Sprint',
    subtitle: 'Stop on the classroom door, not the hallway wall.',
    description: 'Stop the hallway marker inside the classroom-door zone.',
    eyebrow: 'Final Seconds',
    prompt: 'Run for bell',
    overheadText: 'E for bell sprint',
    durationMs: 7000,
    rewardXp: 9,
    rewardMoney: 13,
    accent: '#ffcf56',
    accent2: '#4da3ff',
    secondaryAccent: '#4da3ff',
    icon: 'GO',
    skill: 'intelligence'
  }),
  Object.freeze({
    id: SCHOOL_MICROGAME_IDS.scantronSpeedrun,
    title: 'Scantron Speedrun',
    shortTitle: 'Scantron',
    subtitle: 'Bubble the key without melting your pencil.',
    description: 'Fill the matching bubbles fast, clean, and in order.',
    eyebrow: 'Test Sheet',
    prompt: 'Fill scantron',
    overheadText: 'E for scantron',
    durationMs: 9000,
    rewardXp: 15,
    rewardMoney: 19,
    accent: '#62d7ff',
    accent2: '#ff8fb3',
    secondaryAccent: '#ff8fb3',
    icon: 'TEST',
    skill: 'intelligence'
  })
]);

const SCHOOL_MICROGAME_BY_ID = new Map(SCHOOL_MICROGAME_DEFINITIONS.map((game) => [game.id, game]));
const SCHOOL_MICROGAME_ALIAS_BY_ID = new Map();

for (const game of SCHOOL_MICROGAME_DEFINITIONS) {
  const aliases = [
    game.id,
    game.title,
    game.shortTitle,
    game.id.replaceAll('-', ''),
    game.id.replaceAll('-', '_'),
    game.title.replaceAll(' ', ''),
    game.title.replaceAll(' ', '-'),
    game.title.replaceAll(' ', '_')
  ];
  for (const alias of aliases) {
    SCHOOL_MICROGAME_ALIAS_BY_ID.set(String(alias).trim().toLowerCase(), game.id);
  }
}

SCHOOL_MICROGAME_ALIAS_BY_ID.set('pop-quiz', SCHOOL_MICROGAME_IDS.popQuizPanic);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('hall-pass', SCHOOL_MICROGAME_IDS.hallPassCheck);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('copy-notes', SCHOOL_MICROGAME_IDS.copyTheNotes);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('teacher-looking', SCHOOL_MICROGAME_IDS.teacherIsLooking);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('dodge-chalk', SCHOOL_MICROGAME_IDS.dodgeTheChalk);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('sort-backpack', SCHOOL_MICROGAME_IDS.sortTheBackpack);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('school', SCHOOL_MICROGAME_DEFAULT_ID);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('school-microgame', SCHOOL_MICROGAME_DEFAULT_ID);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('school-microgames', SCHOOL_MICROGAME_ALL_ID);
SCHOOL_MICROGAME_ALIAS_BY_ID.set('random-school', SCHOOL_MICROGAME_ALL_ID);
SCHOOL_MICROGAME_ALIAS_BY_ID.set(SCHOOL_MICROGAME_ALL_ID, SCHOOL_MICROGAME_ALL_ID);

function choose(list, rng) {
  if (!Array.isArray(list) || list.length <= 0) {
    return null;
  }

  return list[Math.floor(rng() * list.length) % list.length];
}

function shuffle(list, rng) {
  const next = [...list];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function createCombo(rng) {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  return digits.slice(0, 3 + Math.floor(rng() * 2));
}

function createBackpackRound(rng) {
  return shuffle(BACKPACK_ITEMS, rng).slice(0, 6).map((item, index) => ({
    ...item,
    id: `${item.id}-${index}`
  }));
}

export function listSchoolMicrogames() {
  return SCHOOL_MICROGAME_DEFINITIONS;
}

export function listSchoolMicrogameDefinitions() {
  return SCHOOL_MICROGAME_DEFINITIONS;
}

export function normalizeSchoolMicrogameId(value = '', fallback = SCHOOL_MICROGAME_DEFAULT_ID) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  const squashed = normalized.replaceAll('_', '-').replace(/\s+/g, '-');
  return SCHOOL_MICROGAME_ALIAS_BY_ID.get(normalized)
    ?? SCHOOL_MICROGAME_ALIAS_BY_ID.get(squashed)
    ?? fallback;
}

export function getSchoolMicrogameDefinition(value = '') {
  const id = normalizeSchoolMicrogameId(value, '');
  return SCHOOL_MICROGAME_BY_ID.get(id) ?? null;
}

export function getRandomSchoolMicrogameId(rng = Math.random) {
  return choose(SCHOOL_MICROGAME_DEFINITIONS, rng)?.id ?? SCHOOL_MICROGAME_DEFAULT_ID;
}

export function normalizeSchoolMicrogameEnabled(value) {
  return value === true;
}

export function isSchoolMicrogameNpc(npc = null) {
  return npc?.schoolMicrogameEnabled === true;
}

export function getSchoolMicrogamePromptRadius(npc = null, fallbackRadius = 4.8) {
  const radius = Number(npc?.interactRadius ?? fallbackRadius);
  return Math.max(1.5, Number.isFinite(radius) ? radius : fallbackRadius);
}

export function normalizeSchoolMicrogameNpcId(value = '') {
  const normalized = normalizeSchoolMicrogameId(value, SCHOOL_MICROGAME_ALL_ID);
  return normalized === SCHOOL_MICROGAME_ALL_ID ? SCHOOL_MICROGAME_ALL_ID : normalized;
}

export function getSchoolMicrogameReward(value = '') {
  const game = getSchoolMicrogameDefinition(value);
  return {
    money: Math.max(0, Math.trunc(Number(game?.rewardMoney ?? SCHOOL_MICROGAME_DEFAULT_REWARD_MONEY) || 0)),
    xp: Math.max(0, Math.trunc(Number(game?.rewardXp ?? SCHOOL_MICROGAME_DEFAULT_REWARD_XP) || 0)),
    skill: 'intelligence'
  };
}

export function buildSchoolMicrogameRound(gameId = '', { rng = Math.random, now = Date.now() } = {}) {
  const definition = getSchoolMicrogameDefinition(gameId) ?? SCHOOL_MICROGAME_DEFINITIONS[0];
  const base = {
    id: `school_${definition.id}_${Math.max(0, Math.floor(now))}_${Math.floor(rng() * 100000)}`,
    gameId: definition.id,
    title: definition.title,
    shortTitle: definition.shortTitle,
    eyebrow: definition.eyebrow,
    description: definition.description,
    durationMs: definition.durationMs,
    rewardXp: definition.rewardXp,
    rewardMoney: definition.rewardMoney,
    accent: definition.accent,
    accent2: definition.accent2,
    secondaryAccent: definition.secondaryAccent,
    icon: definition.icon
  };

  if (definition.id === SCHOOL_MICROGAME_IDS.popQuizPanic) {
    const question = choose(QUESTION_BANK, rng);
    return {
      ...base,
      question: question.question,
      answers: question.answers.map((label, index) => ({ label, index })),
      correctIndex: question.correctIndex
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.lockerCombo) {
    return {
      ...base,
      combo: createCombo(rng),
      previewMs: 1450,
      keypad: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.hallPassCheck) {
    const pass = choose(HALL_PASS_ROUNDS, rng);
    return {
      ...base,
      promptText: pass.prompt,
      correctPass: pass.correct,
      passes: shuffle(PASS_OPTIONS, rng)
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.copyTheNotes) {
    return {
      ...base,
      sequence: [...choose(NOTE_SEQUENCES, rng)],
      keys: ['W', 'A', 'S', 'D']
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.teacherIsLooking) {
    return {
      ...base,
      targetProgress: 100,
      lookCycleMs: 2600,
      lookWindowMs: 1050,
      startingPhaseMs: Math.floor(rng() * 700)
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.cafeteriaTraySave) {
    return {
      ...base,
      safeZone: 0.46,
      spillZone: 1,
      wobble: rng() > 0.5 ? 1 : -1
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.dodgeTheChalk) {
    return {
      ...base,
      lanes: ['Left', 'Center', 'Right'],
      lives: 2,
      spawnEveryMs: 780
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.sortTheBackpack) {
    return {
      ...base,
      items: createBackpackRound(rng),
      bins: [...BACKPACK_BINS],
      targetCorrect: 5,
      maxWrong: 2
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.bellSprint) {
    const targetStart = 0.58 + (rng() * 0.12);
    return {
      ...base,
      targetStart,
      targetEnd: Math.min(0.88, targetStart + 0.17),
      markerSpeed: 1.56 + (rng() * 0.2)
    };
  }

  if (definition.id === SCHOOL_MICROGAME_IDS.scantronSpeedrun) {
    return {
      ...base,
      answerKey: [...choose(SCANTRON_KEYS, rng)],
      options: ['A', 'B', 'C', 'D'],
      maxWrong: 1
    };
  }

  return base;
}
