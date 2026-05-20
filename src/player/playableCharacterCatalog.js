import { assetUrl, assets } from '../world/assetManifest.js';
import { MIXAMO_CHARACTER_DEFINITIONS } from '../shared/mixamoCharacterCatalog.js';

export const DEFAULT_PLAYABLE_CHARACTER_ID = 'ch08NonPbr';

function portraitAssetUrl(fileName = '') {
  return fileName ? assetUrl('mixamo', 'portraits', fileName) : '';
}

function createPlayableCharacter(definition) {
  return Object.freeze({
    id: definition.id,
    label: definition.label,
    subtitle: definition.subtitle,
    portraitFileName: definition.portraitFileName,
    portraitStaticSrc: portraitAssetUrl(definition.portraitFileName),
    characterRig: assets.mixamo.characters[definition.id],
    characterVariant: 'mixamo',
    idleClip: assets.playerAnimationSet.idle,
    previewClip: assets.playerAnimationSet.fightingIdle,
    portraitClip: assets.playerAnimationSet.idle,
    walkClip: assets.playerAnimationSet.walking,
    slowRunClip: assets.playerAnimationSet.slowRun,
    fastRunClip: assets.playerAnimationSet.fastRun,
    drunkIdleClip: assets.playerAnimationSet.drunkIdle,
    drunkWalkClip: assets.playerAnimationSet.drunkWalk,
    emotes: assets.playerAnimationSet.emotes
  });
}

const playableCharacters = [];
for (let index = 0; index < MIXAMO_CHARACTER_DEFINITIONS.length; index += 1) {
  playableCharacters.push(createPlayableCharacter(MIXAMO_CHARACTER_DEFINITIONS[index]));
}
playableCharacters.push(
  Object.freeze({
    id: 'classicBot',
    label: 'OSRS Bot',
    subtitle: 'Procedural Throwback',
    portraitFileName: 'classic_bot.png',
    portraitStaticSrc: portraitAssetUrl('classic_bot.png'),
    characterRig: assets.mixamo.characters.xBot,
    characterVariant: 'classicBot',
    idleClip: assets.playerAnimationSet.idle,
    previewClip: assets.playerAnimationSet.fightingIdle,
    portraitClip: assets.playerAnimationSet.idle,
    walkClip: assets.playerAnimationSet.walking,
    slowRunClip: assets.playerAnimationSet.slowRun,
    fastRunClip: assets.playerAnimationSet.fastRun,
    drunkIdleClip: assets.playerAnimationSet.drunkIdle,
    drunkWalkClip: assets.playerAnimationSet.drunkWalk,
    emotes: assets.playerAnimationSet.emotes
  })
);

export const PLAYABLE_CHARACTER_CATALOG = Object.freeze(playableCharacters);

const PLAYABLE_CHARACTER_BY_ID = new Map();
for (let index = 0; index < PLAYABLE_CHARACTER_CATALOG.length; index += 1) {
  const entry = PLAYABLE_CHARACTER_CATALOG[index];
  PLAYABLE_CHARACTER_BY_ID.set(entry.id, entry);
}

export function listPlayableCharacters() {
  return PLAYABLE_CHARACTER_CATALOG;
}

export function isPlayableCharacterId(characterId) {
  return PLAYABLE_CHARACTER_BY_ID.has(characterId);
}

export function getPlayableCharacterById(characterId) {
  return PLAYABLE_CHARACTER_BY_ID.get(characterId)
    ?? PLAYABLE_CHARACTER_BY_ID.get(DEFAULT_PLAYABLE_CHARACTER_ID)
    ?? PLAYABLE_CHARACTER_CATALOG[0];
}
