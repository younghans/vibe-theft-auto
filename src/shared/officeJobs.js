import { SKILL_IDS } from './skills.js';

export const OFFICE_JOB_TERMINAL_ITEM_ID = 'standing_desk_computer';
export const OFFICE_JOB_TERMINAL_RADIUS = 5.25;

export const OFFICE_JOB_IDS = Object.freeze({
  janitor: 'janitor',
  officeManager: 'office-manager',
  ceo: 'ceo'
});

export const OFFICE_JOB_GAME_IDS = Object.freeze({
  janitor: 'office-janitor-trash-toss',
  officeManager: 'office-manager-coffee-fill',
  ceo: 'office-ceo-power-nap'
});

export const OFFICE_JOB_SKILL_ID = SKILL_IDS.intelligence;

const OFFICE_JOB_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: OFFICE_JOB_IDS.janitor,
    gameId: OFFICE_JOB_GAME_IDS.janitor,
    title: 'Janitor',
    roleLabel: 'Janitor',
    shortTitle: 'Janitor',
    subtitle: 'Toss trash into the basket cleanly.',
    description: 'Throw the trash when the marker lines up with the basket.',
    prompt: 'Throw trash',
    eyebrow: 'Office Job',
    rewardMoney: 25,
    rewardXp: 0,
    intelligenceRequired: 5,
    accent: '#6fe6a2',
    secondaryAccent: '#f4d35e',
    icon: 'TRASH'
  }),
  Object.freeze({
    id: OFFICE_JOB_IDS.officeManager,
    gameId: OFFICE_JOB_GAME_IDS.officeManager,
    title: 'Office Manager',
    roleLabel: 'Office Manager',
    shortTitle: 'Manager',
    subtitle: 'Fill coffee to the perfect line.',
    description: 'Start the pour, then stop inside the marked fill band.',
    prompt: 'Fill coffee',
    eyebrow: 'Office Job',
    rewardMoney: 100,
    rewardXp: 0,
    intelligenceRequired: 50,
    accent: '#8cd6ff',
    secondaryAccent: '#d99a5f',
    icon: 'COFFEE'
  }),
  Object.freeze({
    id: OFFICE_JOB_IDS.ceo,
    gameId: OFFICE_JOB_GAME_IDS.ceo,
    title: 'CEO',
    roleLabel: 'CEO',
    shortTitle: 'CEO',
    subtitle: 'Sleep only while no one is watching.',
    description: 'Hold sleep while the coast is clear. Wake up before anyone looks.',
    prompt: 'Power nap',
    eyebrow: 'Executive Job',
    rewardMoney: 500,
    rewardXp: 0,
    intelligenceRequired: 200,
    accent: '#c38bff',
    secondaryAccent: '#73f2d0',
    icon: 'CEO'
  })
]);

const OFFICE_JOB_BY_ID = new Map(OFFICE_JOB_DEFINITIONS.map((job) => [job.id, job]));
const OFFICE_JOB_BY_GAME_ID = new Map(OFFICE_JOB_DEFINITIONS.map((job) => [job.gameId, job]));
const OFFICE_JOB_ALIAS_BY_ID = new Map();

for (const job of OFFICE_JOB_DEFINITIONS) {
  const aliases = [
    job.id,
    job.gameId,
    job.title,
    job.roleLabel,
    job.shortTitle,
    job.title.replaceAll(' ', '-'),
    job.title.replaceAll(' ', '_'),
    job.title.replaceAll(' ', '')
  ];
  for (const alias of aliases) {
    OFFICE_JOB_ALIAS_BY_ID.set(String(alias).trim().toLowerCase(), job.id);
  }
}

OFFICE_JOB_ALIAS_BY_ID.set('manager', OFFICE_JOB_IDS.officeManager);
OFFICE_JOB_ALIAS_BY_ID.set('office-manager', OFFICE_JOB_IDS.officeManager);
OFFICE_JOB_ALIAS_BY_ID.set('office_manager', OFFICE_JOB_IDS.officeManager);
OFFICE_JOB_ALIAS_BY_ID.set('chief-executive', OFFICE_JOB_IDS.ceo);
OFFICE_JOB_ALIAS_BY_ID.set('chief-executive-officer', OFFICE_JOB_IDS.ceo);

export function listOfficeJobDefinitions() {
  return OFFICE_JOB_DEFINITIONS;
}

export function normalizeOfficeJobId(value = '', fallback = '') {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  const squashed = normalized.replaceAll('_', '-').replace(/\s+/g, '-');
  return OFFICE_JOB_ALIAS_BY_ID.get(normalized)
    ?? OFFICE_JOB_ALIAS_BY_ID.get(squashed)
    ?? fallback;
}

export function getOfficeJobDefinition(value = '') {
  const id = normalizeOfficeJobId(value, '');
  return OFFICE_JOB_BY_ID.get(id) ?? null;
}

export function getOfficeJobDefinitionByGameId(value = '') {
  return OFFICE_JOB_BY_GAME_ID.get(String(value ?? '').trim()) ?? null;
}

export function isOfficeJobGameId(value = '') {
  return OFFICE_JOB_BY_GAME_ID.has(String(value ?? '').trim());
}

export function getOfficeJobReward(value = '') {
  const job = getOfficeJobDefinition(value) ?? getOfficeJobDefinitionByGameId(value);
  return {
    money: Math.max(0, Math.trunc(Number(job?.rewardMoney ?? 0) || 0)),
    xp: Math.max(0, Math.trunc(Number(job?.rewardXp ?? 0) || 0)),
    skill: OFFICE_JOB_SKILL_ID
  };
}

export function getOfficeJobRequirement(value = '') {
  const job = getOfficeJobDefinition(value) ?? getOfficeJobDefinitionByGameId(value);
  return Math.max(0, Math.trunc(Number(job?.intelligenceRequired ?? 0) || 0));
}

export function canPlayerWorkOfficeJob(playerIntelligence = 0, jobOrId = '') {
  const job = typeof jobOrId === 'object'
    ? jobOrId
    : (getOfficeJobDefinition(jobOrId) ?? getOfficeJobDefinitionByGameId(jobOrId));
  const intelligence = Math.max(0, Math.trunc(Number(playerIntelligence ?? 0) || 0));
  return Boolean(job && intelligence >= getOfficeJobRequirement(job.id));
}
