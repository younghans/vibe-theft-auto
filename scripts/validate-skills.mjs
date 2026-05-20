import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SCHOOL_MICROGAME_IDS,
  createSchoolPopQuizQuestions,
  getSchoolMicrogameReward,
  listSchoolMicrogames
} from '../src/shared/schoolMicrogames.js';
import {
  AGILITY_DISTANCE_PER_XP,
  AGILITY_MAX_XP_PER_UPDATE,
  BASKETBALL_SHOT_AGILITY_XP,
  BASKETBALL_SHOT_STRENGTH_XP,
  CHARISMA_BEER_XP,
  CHARISMA_NPC_CHAT_XP,
  CHARISMA_PLASTERED_XP,
  CHARISMA_VIBE_HERO_XP,
  SKILL_IDS,
  SKILL_MAX_LEVEL,
  STRENGTH_SNATCH_XP,
  applySkillXpToPlayer,
  createSkillAward,
  getCharismaDrinkXp,
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
const roomSource = fs.readFileSync(`${root}/server/src/WorldRoom.js`, 'utf8');
const mockServiceSource = fs.readFileSync(`${root}/src/npc/NpcServiceMock.js`, 'utf8');
const stylesSource = fs.readFileSync(`${root}/styles.css`, 'utf8');

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
assert.equal(BASKETBALL_SHOT_STRENGTH_XP, 15, 'basketball clean releases award a slightly reduced medium amount of strength XP');
assert.equal(BASKETBALL_SHOT_AGILITY_XP, 15, 'basketball clean releases award a slightly reduced medium amount of agility XP');
assert.equal(CHARISMA_NPC_CHAT_XP, 2, 'NPC chat awards a small amount of charisma XP');
assert.equal(CHARISMA_BEER_XP, 2, 'beer awards a small amount of charisma XP');
assert.equal(CHARISMA_PLASTERED_XP, 15, 'getting plastered awards a medium amount of charisma XP');
assert.equal(CHARISMA_VIBE_HERO_XP, 40, 'Vibe Hero awards a large amount of charisma XP');
assert.equal(
  getCharismaDrinkXp({ itemId: 'beer', previousDrunknessLevel: 0, nextDrunknessLevel: 1 }),
  CHARISMA_BEER_XP,
  'one beer grants the beer charisma reward'
);
assert.equal(
  getCharismaDrinkXp({ itemId: 'shot', previousDrunknessLevel: 4, nextDrunknessLevel: 5 }),
  CHARISMA_PLASTERED_XP,
  'crossing into plastered grants the plastered charisma reward'
);
assert.equal(
  getCharismaDrinkXp({ itemId: 'beer', previousDrunknessLevel: 4, nextDrunknessLevel: 5 }),
  CHARISMA_BEER_XP + CHARISMA_PLASTERED_XP,
  'a beer that gets the player plastered combines both charisma rewards'
);

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
  intelligenceXp: 0,
  charismaXp: CHARISMA_BEER_XP
});
assert.equal(playerSkills.length, 4, 'all initial skills are present');
assert.equal(playerSkills.find((skill) => skill.id === SKILL_IDS.strength)?.xp, STRENGTH_SNATCH_XP, 'strength XP reads from player state');
assert.equal(playerSkills.find((skill) => skill.id === SKILL_IDS.charisma)?.xp, CHARISMA_BEER_XP, 'charisma XP reads from player state');

const serverPlayerShape = { strengthXp: 0, agilityXp: 0, intelligenceXp: 0, charismaXp: 0 };
const strengthAward = applySkillXpToPlayer(serverPlayerShape, SKILL_IDS.strength, STRENGTH_SNATCH_XP);
assert.equal(serverPlayerShape.strengthXp, STRENGTH_SNATCH_XP, 'shared award mutates server player XP field');
assert.equal(strengthAward.xpGained, STRENGTH_SNATCH_XP, 'shared award payload reports strength XP');

const agilityAward = applySkillXpToPlayer(serverPlayerShape, SKILL_IDS.agility, AGILITY_MAX_XP_PER_UPDATE);
assert.equal(serverPlayerShape.agilityXp, AGILITY_MAX_XP_PER_UPDATE, 'shared award mutates agility XP field');
assert.equal(agilityAward.skillId, SKILL_IDS.agility, 'shared award payload reports agility skill');

const basketballStrengthAward = applySkillXpToPlayer(serverPlayerShape, SKILL_IDS.strength, BASKETBALL_SHOT_STRENGTH_XP);
assert.equal(basketballStrengthAward.xpGained, BASKETBALL_SHOT_STRENGTH_XP, 'shared award payload reports basketball strength XP');
const basketballAgilityAward = applySkillXpToPlayer(serverPlayerShape, SKILL_IDS.agility, BASKETBALL_SHOT_AGILITY_XP);
assert.equal(basketballAgilityAward.xpGained, BASKETBALL_SHOT_AGILITY_XP, 'shared award payload reports basketball agility XP');

const charismaAward = applySkillXpToPlayer(serverPlayerShape, SKILL_IDS.charisma, CHARISMA_VIBE_HERO_XP);
assert.equal(serverPlayerShape.charismaXp, CHARISMA_VIBE_HERO_XP, 'shared award mutates charisma XP field');
assert.equal(charismaAward.skillId, SKILL_IDS.charisma, 'shared award payload reports charisma skill');

assert.equal(AGILITY_DISTANCE_PER_XP, 90, 'agility distance rate is five times slower than the original walking XP pace');
assert.equal(AGILITY_MAX_XP_PER_UPDATE, 3, 'agility per-update cap matches plan');

assert.match(gameSource, /spawnSkillXpFloater/, 'game spawns XP floaters for skill awards');
assert.match(gameSource, /0x1f3c3/, 'agility XP floaters use a running icon');
assert.match(gameSource, /0x1f60e/, 'charisma XP floaters use a charisma icon');
assert.match(gameSource, /skillXpGainSound/, 'game registers the skill XP gain sound');
assert.match(gameSource, /shouldPlaySkillXpGainSound/, 'game gates skill XP gain audio per skill');
assert.match(gameSource, /skillId !== SKILL_IDS\.agility/, 'agility movement XP should keep feedback animation without playing the XP gain sound');
assert.match(gameSource, /levelUpSound/, 'game registers the level-up sound');
assert.match(gameSource, /showSkillLevelUpFeedback/, 'game centralizes level-up feedback');
assert.match(gameSource, /playSkillLevelUpSound/, 'skill level-up audio goes through a shared overlap guard');
assert.match(gameSource, /SKILL_LEVEL_UP_SOUND_SUPPRESS_MS/, 'simultaneous skill level-ups should not overlap level-up audio');
assert.match(gameSource, /SKILL_LEVEL_UP_FEEDBACK_DEDUPE_MS/, 'duplicate level-up feedback should be suppressed briefly');
assert.match(gameSource, /recentSkillLevelUpFeedback/, 'game tracks recently shown level-up feedback keys');
assert.match(gameSource, /markSkillLevelUpFeedbackPresented/, 'game deduplicates level-up popups before playing feedback');
assert.match(gameSource, /dedupe:\s*false/, 'skill award feedback should avoid double-marking already accepted level-ups');
assert.match(gameSource, /!leveledUp && xpGained > 0/, 'level-up awards should not also play the regular XP gain sound');
assert.match(hudSource, /skillLevelUpPopups/, 'HUD tracks active skill level-up popups independently');
assert.match(hudSource, /cloneNode\(true\)/, 'HUD creates one level-up popup per level-up event');
assert.match(hudSource, /syncSkillLevelUpPopupStack/, 'HUD stacks simultaneous skill level-up popups instead of replacing them');
assert.match(stylesSource, /--skill-level-up-offset/, 'level-up popup styles include a stack offset');
assert.match(hudSource, /is-xp/, 'HUD styles XP floaters separately from money');
assert.match(hudSource, /agility: '&#127939;'/, 'agility skill UI uses a running icon');
assert.match(hudSource, /charisma: '&#128526;'/, 'charisma skill UI uses a charisma icon');
assert.match(hudSource, /originElement: popup/, 'level-up popup triggers confetti from the active popup');
assert.match(roomSource, /CHARISMA_NPC_CHAT_XP/, 'server awards charisma XP when NPC chat starts');
assert.match(roomSource, /getCharismaDrinkXp/, 'server awards charisma XP for beer and plastered drunkness');
assert.match(roomSource, /vibeHero:complete/, 'server exposes a Vibe Hero charisma reward RPC');
assert.match(mockServiceSource, /CHARISMA_NPC_CHAT_XP/, 'mock service awards charisma XP when NPC chat starts');
assert.match(mockServiceSource, /getCharismaDrinkXp/, 'mock service awards charisma XP for beer and plastered drunkness');
assert.match(mockServiceSource, /completeVibeHero/, 'mock service exposes a Vibe Hero charisma reward method');
assert.match(gameSource, /presentSkillAwardsFromResult/, 'game can present multi-skill workout rewards');
assert.match(roomSource, /BASKETBALL_SHOT_STRENGTH_XP/, 'server awards basketball strength XP');
assert.match(roomSource, /BASKETBALL_SHOT_AGILITY_XP/, 'server awards basketball agility XP');
assert.match(mockServiceSource, /BASKETBALL_SHOT_STRENGTH_XP/, 'mock service awards basketball strength XP');
assert.match(mockServiceSource, /BASKETBALL_SHOT_AGILITY_XP/, 'mock service awards basketball agility XP');
assert.match(gameSource, /TREADMILL_RUN_REWARD_SCORE\s*=\s*90/, 'treadmill rhythm run uses a 90% XP reward threshold');
assert.match(gameSource, /run\.awardXp = run\.score >= TREADMILL_RUN_REWARD_SCORE/, 'treadmill rhythm score controls XP eligibility');
assert.match(roomSource, /target\.workoutType === 'basketball-shot' \|\| target\.workoutType === 'treadmill'/, 'server treadmill runs share basketball XP awards');
assert.match(mockServiceSource, /target\.workoutType === 'basketball-shot' \|\| target\.workoutType === 'treadmill'/, 'mock service treadmill runs share basketball XP awards');
assert.match(gameSource, /phase:\s*countdown\s*\?\s*'countdown'/, 'school rounds start in countdown instead of a start-button ready state');
assert.match(gameSource, /continueSchoolMicrogameSession/, 'school minigame sessions continue into another random round');
assert.match(hudSource, /createSchoolCountdownMarkup/, 'HUD renders the school round countdown');
assert.match(stylesSource, /hud-school-countdown-pop/, 'school countdown has a dedicated animation');

const activeSchoolGames = listSchoolMicrogames();
assert.deepEqual(
  activeSchoolGames.map((game) => game.id),
  [
    SCHOOL_MICROGAME_IDS.popQuizPanic,
    SCHOOL_MICROGAME_IDS.teacherIsLooking,
    SCHOOL_MICROGAME_IDS.memoryMatch
  ],
  'school microgame roster is limited to quiz, teacher, and memory card flip'
);
for (const game of activeSchoolGames) {
  const reward = getSchoolMicrogameReward(game.id);
  assert.equal(reward.money, 0, `${game.id} should not award cash`);
  assert.equal(reward.skill, SKILL_IDS.intelligence, `${game.id} should award Intelligence XP`);
  assert.ok(reward.xp > 0, `${game.id} should award positive Intelligence XP`);
}

const allPopQuizQuestions = createSchoolPopQuizQuestions({
  count: 999,
  rng: (() => {
    let cursor = 0;
    return () => ((cursor += 37) % 101) / 101;
  })()
});
assert.ok(allPopQuizQuestions.length >= 120, 'pop quiz should have a large question bank for variation');
assert.equal(
  new Set(allPopQuizQuestions.map((question) => question.question)).size,
  allPopQuizQuestions.length,
  'pop quiz questions should be unique'
);

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
