import {
  SKILL_IDS,
  getPlayerSkillXp,
  getSkillLevelFromXp
} from './skills.js';

export const OFFICE_JOB_TERMINAL_ITEM_ID = 'standing_desk_computer';
export const OFFICE_CEO_MEETING_TABLE_ITEM_ID = 'office_ceo_meeting_table';
export const OFFICE_JOB_TERMINAL_RADIUS = 5.25;

export const OFFICE_JOB_IDS = Object.freeze({
  janitor: 'janitor',
  officeManager: 'office-manager',
  ceo: 'ceo'
});

export const OFFICE_JOB_GAME_IDS = Object.freeze({
  janitor: 'office-janitor-trash-toss',
  janitorTrashToss: 'office-janitor-trash-toss',
  janitorMopHero: 'office-janitor-mop-hero',
  officeManager: 'office-manager-coffee-fill',
  ceo: 'office-ceo-memo-stamp'
});

export const OFFICE_JANITOR_GAME_IDS = Object.freeze([
  OFFICE_JOB_GAME_IDS.janitorTrashToss,
  OFFICE_JOB_GAME_IDS.janitorMopHero
]);

export const OFFICE_JOB_SKILL_ID = SKILL_IDS.intelligence;

const OFFICE_JOB_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: OFFICE_JOB_IDS.janitor,
    gameId: OFFICE_JOB_GAME_IDS.janitor,
    gameIds: OFFICE_JANITOR_GAME_IDS,
    title: 'Janitor',
    roleLabel: 'Janitor',
    shortTitle: 'Janitor',
    tier: 1,
    subtitle: 'Alternate Paper Toss and Mop Hero.',
    description: 'The Janitor shift cycles between Paper Toss and Mop Hero so each game plays once before repeating.',
    prompt: 'Handle the Janitor task with no mistakes.',
    instructions: 'Paper Toss uses Spacebar or Throw. Mop Hero uses your mouse as the mop to clean every brown dirt patch.',
    eyebrow: 'Office Job',
    rewardMoney: 25,
    rewardXp: 0,
    intelligenceRequired: 5,
    durationMs: 16000,
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
    tier: 2,
    subtitle: 'Brew the mug to the perfect line.',
    description: 'Run the office coffee maker and land the brew inside the perfect mug line.',
    prompt: 'Hold brew, release inside the marked mug band.',
    instructions: 'Hold Spacebar or the Hold Brew button, then release inside the perfect mug line.',
    eyebrow: 'Office Job',
    rewardMoney: 100,
    rewardXp: 0,
    intelligenceRequired: 10,
    charismaLevelRequired: 5,
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
    tier: 3,
    subtitle: 'Stamp memos inside the approval window.',
    description: 'Time the executive stamp through varied approval windows.',
    prompt: 'Stamp three memos cleanly as the stamp sweeps out and back. One bad stamp tanks the quarter.',
    instructions: 'Press Spacebar or click Stamp when the moving stamp is inside the approval window.',
    eyebrow: 'Executive Job',
    rewardMoney: 500,
    rewardXp: 0,
    intelligenceRequired: 20,
    charismaLevelRequired: 10,
    strengthLevelRequired: 10,
    durationMs: 18000,
    accent: '#facc15',
    secondaryAccent: '#fb7185',
    icon: 'OK'
  })
]);

const OFFICE_JOB_BY_ID = new Map(OFFICE_JOB_DEFINITIONS.map((job) => [job.id, job]));
const OFFICE_JOB_BY_GAME_ID = new Map(OFFICE_JOB_DEFINITIONS.flatMap((job) => {
  const gameIds = new Set([
    job.gameId,
    ...(Array.isArray(job.gameIds) ? job.gameIds : [])
  ]);
  return [...gameIds].map((gameId) => [gameId, job]);
}));
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
  const job = resolveOfficeJob(value);
  return Math.max(0, Math.trunc(Number(job?.intelligenceRequired ?? 0) || 0));
}

export function getOfficeJobCharismaLevelRequirement(value = '') {
  const job = resolveOfficeJob(value);
  return Math.max(0, Math.trunc(Number(job?.charismaLevelRequired ?? 0) || 0));
}

export function getOfficeJobStrengthLevelRequirement(value = '') {
  const job = resolveOfficeJob(value);
  return Math.max(0, Math.trunc(Number(job?.strengthLevelRequired ?? 0) || 0));
}

function resolveOfficeJob(jobOrId = '') {
  return typeof jobOrId === 'object' && jobOrId
    ? jobOrId
    : (getOfficeJobDefinition(jobOrId) ?? getOfficeJobDefinitionByGameId(jobOrId));
}

function normalizeOfficeJobSkillValue(value = 0) {
  return Math.max(0, Math.trunc(Number(value ?? 0) || 0));
}

export function getPlayerOfficeJobIntelligenceLevel(player = null) {
  return getSkillLevelFromXp(getPlayerSkillXp(player, OFFICE_JOB_SKILL_ID));
}

export function getOfficeJobRequirementSummary(
  jobOrId = '',
  { intelligence = 0, intelligenceLevel = intelligence, charismaLevel = 0, strengthLevel = 0 } = {}
) {
  const job = resolveOfficeJob(jobOrId);
  const intelligenceRequired = normalizeOfficeJobSkillValue(job?.intelligenceRequired);
  const charismaLevelRequired = normalizeOfficeJobSkillValue(job?.charismaLevelRequired);
  const strengthLevelRequired = normalizeOfficeJobSkillValue(job?.strengthLevelRequired);
  const currentIntelligenceLevel = normalizeOfficeJobSkillValue(intelligenceLevel);
  return [
    intelligenceRequired > 0 ? `Intelligence Lv ${currentIntelligenceLevel}/${intelligenceRequired}` : '',
    strengthLevelRequired > 0 ? `Strength Lv ${normalizeOfficeJobSkillValue(strengthLevel)}/${strengthLevelRequired}` : '',
    charismaLevelRequired > 0 ? `Charisma Lv ${normalizeOfficeJobSkillValue(charismaLevel)}/${charismaLevelRequired}` : ''
  ].filter(Boolean).join(' / ');
}

export function getOfficeJobLockedMessage(
  jobOrId = '',
  { intelligence = 0, intelligenceLevel = intelligence, charismaLevel = 0, strengthLevel = 0 } = {}
) {
  const job = resolveOfficeJob(jobOrId);
  if (!job) {
    return 'That office job is not available.';
  }

  const intelligenceRequired = normalizeOfficeJobSkillValue(job.intelligenceRequired);
  const charismaLevelRequired = normalizeOfficeJobSkillValue(job.charismaLevelRequired);
  const strengthLevelRequired = normalizeOfficeJobSkillValue(job.strengthLevelRequired);
  const currentIntelligenceLevel = normalizeOfficeJobSkillValue(intelligenceLevel);
  const missing = [
    currentIntelligenceLevel < intelligenceRequired ? `Level ${intelligenceRequired} Intelligence` : '',
    normalizeOfficeJobSkillValue(strengthLevel) < strengthLevelRequired ? `Level ${strengthLevelRequired} Strength` : '',
    normalizeOfficeJobSkillValue(charismaLevel) < charismaLevelRequired ? `Level ${charismaLevelRequired} Charisma` : ''
  ].filter(Boolean);
  return missing.length > 0 ? `${job.roleLabel} requires ${missing.join(' and ')}.` : '';
}

export function canPlayerWorkOfficeJob(playerIntelligenceLevel = 0, jobOrId = '', playerCharismaLevel = 0, playerStrengthLevel = 0) {
  const job = resolveOfficeJob(jobOrId);
  const intelligenceLevel = normalizeOfficeJobSkillValue(playerIntelligenceLevel);
  const charismaLevel = normalizeOfficeJobSkillValue(playerCharismaLevel);
  const strengthLevel = normalizeOfficeJobSkillValue(playerStrengthLevel);
  return Boolean(
    job
    && intelligenceLevel >= getOfficeJobRequirement(job.id)
    && charismaLevel >= getOfficeJobCharismaLevelRequirement(job.id)
    && strengthLevel >= getOfficeJobStrengthLevelRequirement(job.id)
  );
}
