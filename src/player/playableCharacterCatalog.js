import { assets } from '../world/assetManifest.js';

export const DEFAULT_PLAYABLE_CHARACTER_ID = 'xBot';

export const PLAYABLE_CHARACTER_CATALOG = Object.freeze([
  Object.freeze({
    id: 'xBot',
    label: 'X Bot',
    subtitle: 'Balanced Rookie',
    characterRig: assets.mixamo.characters.xBot,
    characterVariant: 'mixamo',
    idleClip: assets.playerAnimationSet.idle,
    previewClip: assets.playerAnimationSet.fightingIdle,
    portraitClip: assets.playerAnimationSet.idle,
    walkClip: assets.playerAnimationSet.walking,
    emotes: assets.playerAnimationSet.emotes
  }),
  Object.freeze({
    id: 'brute',
    label: 'Brute',
    subtitle: 'Heavy Hitter',
    characterRig: assets.mixamo.characters.brute,
    characterVariant: 'mixamo',
    idleClip: assets.playerAnimationSet.idle,
    previewClip: assets.playerAnimationSet.fightingIdle,
    portraitClip: assets.playerAnimationSet.idle,
    walkClip: assets.playerAnimationSet.walking,
    emotes: assets.playerAnimationSet.emotes
  }),
  Object.freeze({
    id: 'ch18NonPbr',
    label: 'Ch18',
    subtitle: 'Street Specialist',
    characterRig: assets.mixamo.characters.ch18NonPbr,
    characterVariant: 'mixamo',
    idleClip: assets.playerAnimationSet.idle,
    previewClip: assets.playerAnimationSet.fightingIdle,
    portraitClip: assets.playerAnimationSet.idle,
    walkClip: assets.playerAnimationSet.walking,
    emotes: assets.playerAnimationSet.emotes
  }),
  Object.freeze({
    id: 'classicBot',
    label: 'OSRS Bot',
    subtitle: 'Procedural Throwback',
    characterRig: assets.mixamo.characters.xBot,
    characterVariant: 'classicBot',
    idleClip: assets.playerAnimationSet.idle,
    previewClip: assets.playerAnimationSet.fightingIdle,
    portraitClip: assets.playerAnimationSet.idle,
    walkClip: assets.playerAnimationSet.walking,
    emotes: assets.playerAnimationSet.emotes
  })
]);

const PLAYABLE_CHARACTER_BY_ID = new Map(
  PLAYABLE_CHARACTER_CATALOG.map((entry) => [entry.id, entry])
);

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
