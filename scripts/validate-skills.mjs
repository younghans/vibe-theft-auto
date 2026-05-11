import assert from 'node:assert/strict';
import fs from 'node:fs';
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
import { assets } from '../src/world/assetManifest.js';

const root = process.cwd();
const gameSource = fs.readFileSync(`${root}/src/game/Game.js`, 'utf8');
const hudSource = fs.readFileSync(`${root}/src/ui/Hud.js`, 'utf8');

function assertMp3Audio(buffer, label) {
  const hasId3Header = buffer.subarray(0, 3).toString('ascii') === 'ID3';
  const hasFrameSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  assert.ok(hasId3Header || hasFrameSync, `${label} should be an MP3 file.`);
}

assert.equal(getSkillXpForLevel(1), 0, 'level 1 starts at 0 XP');
assert.equal(getClassicXpForLevel(99), 13034431, 'classic level 99 XP matches RuneScape curve');
assert.equal(getSkillXpForLevel(99), 651721, 'scaled level 99 XP is 20x faster');
assert.equal(getSkillLevelFromXp(0), 1, '0 XP is level 1');
assert.equal(getSkillLevelFromXp(getSkillXpForLevel(2)), 2, 'threshold XP reaches level 2');
assert.equal(getSkillLevelFromXp(getSkillXpForLevel(99)), SKILL_MAX_LEVEL, 'level 99 threshold reaches level 99');
assert.equal(getSkillLevelFromXp(getSkillXpForLevel(99) + 999999), SKILL_MAX_LEVEL, 'levels cap at 99');
assert.equal(STRENGTH_SNATCH_XP, 10, 'barbell snatching awards 10 strength XP');

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

assert.equal(AGILITY_DISTANCE_PER_XP, 90, 'agility distance rate is five times slower than the original walking XP pace');
assert.equal(AGILITY_MAX_XP_PER_UPDATE, 3, 'agility per-update cap matches plan');

assert.match(gameSource, /spawnSkillXpFloater/, 'game spawns XP floaters for skill awards');
assert.match(gameSource, /0x1f3c3/, 'agility XP floaters use a running icon');
assert.match(gameSource, /skillXpGainSound/, 'game registers the skill XP gain sound');
assert.match(gameSource, /levelUpSound/, 'game registers the level-up sound');
assert.match(gameSource, /showSkillLevelUpFeedback/, 'game centralizes level-up feedback');
assert.match(hudSource, /is-xp/, 'HUD styles XP floaters separately from money');
assert.match(hudSource, /agility: '&#127939;'/, 'agility skill UI uses a running icon');
assert.match(hudSource, /originElement: this\.skillLevelUpRoot/, 'level-up popup triggers confetti from the popup');

assert.ok(assets.audio.skillXpGain, 'Skill XP gain audio should be registered.');
assert.match(assets.audio.skillXpGain, /gain_experience_point_ding\.mp3$/, 'Skill XP gain audio should use the optimized ding file.');
const skillXpGainAudio = fs.readFileSync(new URL(assets.audio.skillXpGain));
assert.ok(skillXpGainAudio.length > 12, 'Skill XP gain audio should not be empty.');
assertMp3Audio(skillXpGainAudio, 'Skill XP gain audio');

assert.ok(assets.audio.levelUp, 'Level-up audio should be registered.');
assert.match(assets.audio.levelUp, /level_up_ding\.mp3$/, 'Level-up audio should use the optimized ding file.');
const levelUpAudio = fs.readFileSync(new URL(assets.audio.levelUp));
assert.ok(levelUpAudio.length > 12, 'Level-up audio should not be empty.');
assertMp3Audio(levelUpAudio, 'Level-up audio');

console.log('Skills validation passed.');
