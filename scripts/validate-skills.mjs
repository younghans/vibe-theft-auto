import assert from 'node:assert/strict';
import {
  AGILITY_DISTANCE_PER_XP,
  AGILITY_MAX_XP_PER_UPDATE,
  SKILL_IDS,
  SKILL_MAX_LEVEL,
  STRENGTH_SNATCH_XP,
  applySkillXpToPlayer,
  createSkillAward,
  getClassicXpForLevel,
  getPlayerSkillsSnapshot,
  getSkillLevelFromXp,
  getSkillSnapshot,
  getSkillXpForLevel
} from '../src/shared/skills.js';

assert.equal(getSkillXpForLevel(1), 0, 'level 1 starts at 0 XP');
assert.equal(getClassicXpForLevel(99), 13034431, 'classic level 99 XP matches RuneScape curve');
assert.equal(getSkillXpForLevel(99), 651721, 'scaled level 99 XP is 20x faster');
assert.equal(getSkillLevelFromXp(0), 1, '0 XP is level 1');
assert.equal(getSkillLevelFromXp(getSkillXpForLevel(2)), 2, 'threshold XP reaches level 2');
assert.equal(getSkillLevelFromXp(getSkillXpForLevel(99)), SKILL_MAX_LEVEL, 'level 99 threshold reaches level 99');
assert.equal(getSkillLevelFromXp(getSkillXpForLevel(99) + 999999), SKILL_MAX_LEVEL, 'levels cap at 99');

const levelTwoSnapshot = getSkillSnapshot(SKILL_IDS.strength, getSkillXpForLevel(2));
assert.equal(levelTwoSnapshot.level, 2, 'snapshot level is derived from XP');
assert.equal(levelTwoSnapshot.currentLevelXp, getSkillXpForLevel(2), 'snapshot exposes current level floor');
assert.equal(levelTwoSnapshot.nextLevelXp, getSkillXpForLevel(3), 'snapshot exposes next level threshold');
assert.equal(levelTwoSnapshot.xpToNextLevel, getSkillXpForLevel(3) - getSkillXpForLevel(2), 'snapshot exposes XP to next level');

const maxSnapshot = getSkillSnapshot(SKILL_IDS.agility, getSkillXpForLevel(99));
assert.equal(maxSnapshot.progress, 1, 'level 99 progress is full');
assert.equal(maxSnapshot.xpToNextLevel, 0, 'level 99 has no XP to next level');

const award = createSkillAward(SKILL_IDS.strength, 0, STRENGTH_SNATCH_XP);
assert.equal(award.skillId, SKILL_IDS.strength, 'award keeps skill id');
assert.equal(award.xpGained, STRENGTH_SNATCH_XP, 'award reports XP gained');
assert.equal(award.oldLevel, 1, 'award reports old level');
assert.ok(award.newLevel >= 1, 'award reports new level');

const playerSkills = getPlayerSkillsSnapshot({
  strengthXp: STRENGTH_SNATCH_XP,
  agilityXp: AGILITY_MAX_XP_PER_UPDATE,
  intelligenceXp: 0
});
assert.equal(playerSkills.length, 3, 'all initial skills are present');
assert.equal(playerSkills.find((skill) => skill.id === SKILL_IDS.strength)?.xp, STRENGTH_SNATCH_XP, 'strength XP reads from player state');

const serverPlayerShape = { strengthXp: 0, agilityXp: 0, intelligenceXp: 0 };
const strengthAward = applySkillXpToPlayer(serverPlayerShape, SKILL_IDS.strength, STRENGTH_SNATCH_XP);
assert.equal(serverPlayerShape.strengthXp, STRENGTH_SNATCH_XP, 'shared award mutates server player XP field');
assert.equal(strengthAward.xpGained, STRENGTH_SNATCH_XP, 'shared award payload reports strength XP');

const agilityAward = applySkillXpToPlayer(serverPlayerShape, SKILL_IDS.agility, AGILITY_MAX_XP_PER_UPDATE);
assert.equal(serverPlayerShape.agilityXp, AGILITY_MAX_XP_PER_UPDATE, 'shared award mutates agility XP field');
assert.equal(agilityAward.skillId, SKILL_IDS.agility, 'shared award payload reports agility skill');

assert.equal(AGILITY_DISTANCE_PER_XP, 18, 'agility distance rate matches plan');
assert.equal(AGILITY_MAX_XP_PER_UPDATE, 3, 'agility per-update cap matches plan');

console.log('Skills validation passed.');
