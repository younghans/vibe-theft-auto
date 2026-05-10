export const SCHOOL_MICROGAME_IDS = Object.freeze({
  popQuiz: 'pop-quiz-panic',
  popQuizPanic: 'pop-quiz-panic',
  lockerCombo: 'locker-combo',
  copyNotes: 'copy-the-notes',
  copyTheNotes: 'copy-the-notes',
  teacherLooking: 'teacher-is-looking',
  teacherIsLooking: 'teacher-is-looking',
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
export const SCHOOL_POP_QUIZ_ROUND_COUNT = 3;

const QUESTION_BANK = Object.freeze([
  Object.freeze({ question: 'What is 9 x 7?', answers: Object.freeze(['54', '63', '72']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is a noun?', answers: Object.freeze(['Quickly', 'Locker', 'Blue']), correctIndex: 1 }),
  Object.freeze({ question: 'What planet is known as the red planet?', answers: Object.freeze(['Mars', 'Venus', 'Jupiter']), correctIndex: 0 }),
  Object.freeze({ question: 'Solve: 18 + 24', answers: Object.freeze(['32', '42', '46']), correctIndex: 1 }),
  Object.freeze({ question: 'Which is a complete sentence?', answers: Object.freeze(['Ran fast', 'Because lunch', 'The bell rang']), correctIndex: 2 }),
  Object.freeze({ question: 'What is 12 x 6?', answers: Object.freeze(['66', '72', '78']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is a verb?', answers: Object.freeze(['Jump', 'Pencil', 'Quiet']), correctIndex: 0 }),
  Object.freeze({ question: 'How many sides does a hexagon have?', answers: Object.freeze(['5', '6', '8']), correctIndex: 1 }),
  Object.freeze({ question: 'What gas do plants take in?', answers: Object.freeze(['Oxygen', 'Nitrogen', 'Carbon dioxide']), correctIndex: 2 }),
  Object.freeze({ question: 'What is 144 divided by 12?', answers: Object.freeze(['10', '12', '14']), correctIndex: 1 }),
  Object.freeze({ question: 'Which punctuation ends a question?', answers: Object.freeze(['Period', 'Comma', 'Question mark']), correctIndex: 2 }),
  Object.freeze({ question: 'What is the largest ocean?', answers: Object.freeze(['Atlantic', 'Pacific', 'Indian']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 15 percent of 100?', answers: Object.freeze(['10', '15', '25']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word means the opposite of ancient?', answers: Object.freeze(['Modern', 'Fragile', 'Silent']), correctIndex: 0 }),
  Object.freeze({ question: 'What is the square root of 81?', answers: Object.freeze(['8', '9', '10']), correctIndex: 1 }),
  Object.freeze({ question: 'Which animal is a mammal?', answers: Object.freeze(['Shark', 'Frog', 'Whale']), correctIndex: 2 }),
  Object.freeze({ question: 'What is 3/4 as a decimal?', answers: Object.freeze(['0.25', '0.5', '0.75']), correctIndex: 2 }),
  Object.freeze({ question: 'Which sentence uses their correctly?', answers: Object.freeze(['Their books fell', 'There books fell', 'Theyre books fell']), correctIndex: 0 }),
  Object.freeze({ question: 'What is the capital of California?', answers: Object.freeze(['Sacramento', 'Los Angeles', 'San Diego']), correctIndex: 0 }),
  Object.freeze({ question: 'Which planet is closest to the sun?', answers: Object.freeze(['Venus', 'Mercury', 'Earth']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 27 + 38?', answers: Object.freeze(['55', '65', '75']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is an adjective?', answers: Object.freeze(['Bright', 'Running', 'Desk']), correctIndex: 0 }),
  Object.freeze({ question: 'What is the past tense of teach?', answers: Object.freeze(['Teached', 'Taught', 'Teaching']), correctIndex: 1 }),
  Object.freeze({ question: 'How many minutes are in two hours?', answers: Object.freeze(['60', '90', '120']), correctIndex: 2 }),
  Object.freeze({ question: 'Which layer of Earth is liquid metal?', answers: Object.freeze(['Crust', 'Outer core', 'Mantle']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 11 squared?', answers: Object.freeze(['111', '121', '131']), correctIndex: 1 }),
  Object.freeze({ question: 'Which number is prime?', answers: Object.freeze(['21', '29', '35']), correctIndex: 1 }),
  Object.freeze({ question: 'What do bees collect from flowers?', answers: Object.freeze(['Nectar', 'Granite', 'Salt']), correctIndex: 0 }),
  Object.freeze({ question: 'Which word is a synonym for quick?', answers: Object.freeze(['Rapid', 'Heavy', 'Empty']), correctIndex: 0 }),
  Object.freeze({ question: 'What is 5 cubed?', answers: Object.freeze(['25', '75', '125']), correctIndex: 2 }),
  Object.freeze({ question: 'Which branch makes federal laws?', answers: Object.freeze(['Judicial', 'Legislative', 'Executive']), correctIndex: 1 }),
  Object.freeze({ question: 'What is the chemical symbol for water?', answers: Object.freeze(['CO2', 'H2O', 'O2']), correctIndex: 1 }),
  Object.freeze({ question: 'Which continent is Brazil in?', answers: Object.freeze(['Africa', 'South America', 'Europe']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 90 degrees called?', answers: Object.freeze(['Acute angle', 'Right angle', 'Obtuse angle']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is plural?', answers: Object.freeze(['Class', 'Boxes', 'Child']), correctIndex: 1 }),
  Object.freeze({ question: 'What force pulls objects toward Earth?', answers: Object.freeze(['Gravity', 'Friction', 'Magnetism']), correctIndex: 0 }),
  Object.freeze({ question: 'What is 64 minus 27?', answers: Object.freeze(['37', '41', '47']), correctIndex: 0 }),
  Object.freeze({ question: 'Which is a primary color?', answers: Object.freeze(['Green', 'Purple', 'Red']), correctIndex: 2 }),
  Object.freeze({ question: 'What is the main idea of a paragraph?', answers: Object.freeze(['The central point', 'The page number', 'The longest word']), correctIndex: 0 }),
  Object.freeze({ question: 'Which shape has four equal sides?', answers: Object.freeze(['Triangle', 'Square', 'Pentagon']), correctIndex: 1 }),
  Object.freeze({ question: 'What is 7 x 8?', answers: Object.freeze(['54', '56', '64']), correctIndex: 1 }),
  Object.freeze({ question: 'Which organ pumps blood?', answers: Object.freeze(['Heart', 'Liver', 'Lung']), correctIndex: 0 }),
  Object.freeze({ question: 'What is half of 86?', answers: Object.freeze(['41', '43', '46']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is spelled correctly?', answers: Object.freeze(['Recieve', 'Receive', 'Receeve']), correctIndex: 1 }),
  Object.freeze({ question: 'What is the freezing point of water in C?', answers: Object.freeze(['0', '32', '100']), correctIndex: 0 }),
  Object.freeze({ question: 'Who wrote the Declaration of Independence?', answers: Object.freeze(['Thomas Jefferson', 'Abraham Lincoln', 'George Washington']), correctIndex: 0 }),
  Object.freeze({ question: 'What is 1,000 divided by 10?', answers: Object.freeze(['10', '100', '1,000']), correctIndex: 1 }),
  Object.freeze({ question: 'Which sentence has correct capitalization?', answers: Object.freeze(['i like math', 'I like math', 'I Like Math']), correctIndex: 1 }),
  Object.freeze({ question: 'What is the perimeter of a 4 by 6 rectangle?', answers: Object.freeze(['10', '20', '24']), correctIndex: 1 }),
  Object.freeze({ question: 'Which simple machine is a ramp?', answers: Object.freeze(['Lever', 'Pulley', 'Inclined plane']), correctIndex: 2 }),
  Object.freeze({ question: 'What is the antonym of generous?', answers: Object.freeze(['Stingy', 'Helpful', 'Friendly']), correctIndex: 0 }),
  Object.freeze({ question: 'What is 13 + 19 + 8?', answers: Object.freeze(['38', '40', '42']), correctIndex: 1 }),
  Object.freeze({ question: 'Which planet has rings most famously?', answers: Object.freeze(['Mars', 'Saturn', 'Mercury']), correctIndex: 1 }),
  Object.freeze({ question: 'Which word is a contraction?', answers: Object.freeze(['Cannot', 'Cant', "Can't"]), correctIndex: 2 }),
  Object.freeze({ question: 'What is 6 x 12?', answers: Object.freeze(['62', '72', '82']), correctIndex: 1 }),
  Object.freeze({ question: 'Which fraction equals 0.5?', answers: Object.freeze(['1/2', '1/3', '2/3']), correctIndex: 0 })
]);

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
    subtitle: 'Answer all three questions before the bell bites.',
    description: 'Get three questions in a row correct before the clock eats the grade.',
    eyebrow: 'Classroom',
    prompt: 'Start pop quiz',
    overheadText: 'E to take pop quiz',
    durationMs: 18000,
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

function formatQuizQuestion(question) {
  return {
    question: question.question,
    answers: question.answers.map((label, index) => ({ label, index })),
    correctIndex: question.correctIndex
  };
}

export function createSchoolPopQuizQuestions({ rng = Math.random, count = SCHOOL_POP_QUIZ_ROUND_COUNT } = {}) {
  const questionCount = Math.max(1, Math.min(QUESTION_BANK.length, Math.trunc(Number(count) || SCHOOL_POP_QUIZ_ROUND_COUNT)));
  return shuffle(QUESTION_BANK, rng).slice(0, questionCount).map(formatQuizQuestion);
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
    const questions = createSchoolPopQuizQuestions({ rng });
    const question = questions[0];
    return {
      ...base,
      questionCount: questions.length,
      questions,
      question: question.question,
      answers: question.answers,
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
