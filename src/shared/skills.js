export const SKILL_IDS = Object.freeze({
  strength: 'strength',
  agility: 'agility',
  intelligence: 'intelligence',
  charisma: 'charisma'
});

export const SKILL_MAX_LEVEL = 99;
export const SKILL_XP_SCALE = 20;
export const STRENGTH_SNATCH_XP = 10;
export const BASKETBALL_SHOT_STRENGTH_XP = 15;
export const BASKETBALL_SHOT_AGILITY_XP = 15;
export const AGILITY_DISTANCE_PER_XP = 90;
export const AGILITY_MIN_DISTANCE = 0.05;
export const AGILITY_MAX_XP_PER_UPDATE = 3;
export const CHARISMA_NPC_CHAT_XP = 2;
export const CHARISMA_BEER_XP = 2;
export const CHARISMA_PLASTERED_XP = 15;
export const CHARISMA_VIBE_HERO_XP = 40;
export const CHARISMA_PLASTERED_LEVEL = 5;

export const SKILL_XP_FIELDS = Object.freeze({
  [SKILL_IDS.strength]: 'strengthXp',
  [SKILL_IDS.agility]: 'agilityXp',
  [SKILL_IDS.intelligence]: 'intelligenceXp',
  [SKILL_IDS.charisma]: 'charismaXp'
});

export const SKILL_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: SKILL_IDS.strength,
    label: 'Strength',
    icon: 'strength',
    accent: '#68e08f'
  }),
  Object.freeze({
    id: SKILL_IDS.agility,
    label: 'Agility',
    icon: 'agility',
    accent: '#f0d85a'
  }),
  Object.freeze({
    id: SKILL_IDS.intelligence,
    label: 'Intelligence',
    icon: 'intelligence',
    accent: '#58b8ff'
  }),
  Object.freeze({
    id: SKILL_IDS.charisma,
    label: 'Charisma',
    icon: 'charisma',
    accent: '#ff7ab6'
  })
]);

const SKILL_BY_ID = new Map(SKILL_DEFINITIONS.map((skill) => [skill.id, skill]));

export function normalizeSkillId(skillId = '') {
  const normalized = String(skillId ?? '').trim();
  return SKILL_BY_ID.has(normalized) ? normalized : '';
}

export function getSkillDefinition(skillId = '') {
  return SKILL_BY_ID.get(normalizeSkillId(skillId)) ?? null;
}

export function getClassicXpForLevel(level = 1) {
  const targetLevel = Math.max(1, Math.min(SKILL_MAX_LEVEL, Math.floor(Number(level) || 1)));
  let points = 0;
  for (let currentLevel = 1; currentLevel < targetLevel; currentLevel += 1) {
    points += Math.floor(currentLevel + (300 * Math.pow(2, currentLevel / 7)));
  }
  return Math.floor(points / 4);
}

export function getSkillXpForLevel(level = 1) {
  const targetLevel = Math.max(1, Math.min(SKILL_MAX_LEVEL, Math.floor(Number(level) || 1)));
  if (targetLevel <= 1) {
    return 0;
  }
  return Math.max(1, Math.floor(getClassicXpForLevel(targetLevel) / SKILL_XP_SCALE));
}

export const SKILL_LEVEL_THRESHOLDS = Object.freeze(
  Array.from({ length: SKILL_MAX_LEVEL + 1 }, (_, level) => getSkillXpForLevel(level))
);

export function normalizeSkillXp(value = 0) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.floor(numeric);
}

export function getSkillLevelFromXp(xp = 0) {
  const normalizedXp = normalizeSkillXp(xp);
  let level = 1;
  for (let nextLevel = 2; nextLevel <= SKILL_MAX_LEVEL; nextLevel += 1) {
    if (normalizedXp < SKILL_LEVEL_THRESHOLDS[nextLevel]) {
      break;
    }
    level = nextLevel;
  }
  return level;
}

export function getPlayerSkillXp(player = null, skillId = '') {
  const id = normalizeSkillId(skillId);
  if (!id || !player) {
    return 0;
  }

  const nestedXp = player.skills?.[id]?.xp;
  if (nestedXp !== undefined) {
    return normalizeSkillXp(nestedXp);
  }

  return normalizeSkillXp(player[SKILL_XP_FIELDS[id]]);
}

export function getSkillSnapshot(skillId = '', xp = 0) {
  const definition = getSkillDefinition(skillId);
  if (!definition) {
    return null;
  }

  const normalizedXp = normalizeSkillXp(xp);
  const level = getSkillLevelFromXp(normalizedXp);
  const currentLevelXp = SKILL_LEVEL_THRESHOLDS[level] ?? 0;
  const nextLevelXp = level >= SKILL_MAX_LEVEL
    ? currentLevelXp
    : SKILL_LEVEL_THRESHOLDS[level + 1];
  const levelSpan = Math.max(1, nextLevelXp - currentLevelXp);
  const progress = level >= SKILL_MAX_LEVEL
    ? 1
    : Math.max(0, Math.min(1, (normalizedXp - currentLevelXp) / levelSpan));

  return {
    ...definition,
    xp: normalizedXp,
    level,
    maxLevel: SKILL_MAX_LEVEL,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel: Math.max(0, normalizedXp - currentLevelXp),
    xpToNextLevel: level >= SKILL_MAX_LEVEL ? 0 : Math.max(0, nextLevelXp - normalizedXp),
    progress
  };
}

export function getPlayerSkillSnapshot(player = null, skillId = '') {
  return getSkillSnapshot(skillId, getPlayerSkillXp(player, skillId));
}

export function getPlayerSkillsSnapshot(player = null) {
  return SKILL_DEFINITIONS
    .map((definition) => getPlayerSkillSnapshot(player, definition.id))
    .filter(Boolean);
}

export function createSkillAward(skillId = '', oldXp = 0, newXp = 0) {
  const definition = getSkillDefinition(skillId);
  if (!definition) {
    return null;
  }

  const previousXp = normalizeSkillXp(oldXp);
  const nextXp = normalizeSkillXp(newXp);
  const xpGained = Math.max(0, nextXp - previousXp);
  const oldLevel = getSkillLevelFromXp(previousXp);
  const newLevel = getSkillLevelFromXp(nextXp);
  return {
    skillId: definition.id,
    label: definition.label,
    icon: definition.icon,
    accent: definition.accent,
    xpGained,
    oldXp: previousXp,
    newXp: nextXp,
    oldLevel,
    newLevel,
    leveledUp: newLevel > oldLevel
  };
}

export function applySkillXpToPlayer(player = null, skillId = '', amount = 0) {
  const id = normalizeSkillId(skillId);
  const xpField = SKILL_XP_FIELDS[id];
  const xpAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (!player || !id || !xpField || xpAmount <= 0) {
    return null;
  }

  const oldXp = getPlayerSkillXp(player, id);
  const nextXp = oldXp + xpAmount;
  player[xpField] = nextXp;
  return createSkillAward(id, oldXp, nextXp);
}

export function getCharismaDrinkXp({
  itemId = '',
  previousDrunknessLevel = 0,
  nextDrunknessLevel = 0
} = {}) {
  const normalizedItemId = String(itemId ?? '').trim().toLowerCase();
  const previousLevel = Math.max(0, Math.floor(Number(previousDrunknessLevel) || 0));
  const nextLevel = Math.max(0, Math.floor(Number(nextDrunknessLevel) || 0));
  let xp = normalizedItemId === 'beer' ? CHARISMA_BEER_XP : 0;
  if (previousLevel < CHARISMA_PLASTERED_LEVEL && nextLevel >= CHARISMA_PLASTERED_LEVEL) {
    xp += CHARISMA_PLASTERED_XP;
  }
  return xp;
}
