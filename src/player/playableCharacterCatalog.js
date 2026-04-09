import { assets } from '../world/assetManifest.js';
import { MIXAMO_CHARACTER_DEFINITIONS } from '../shared/mixamoCharacterCatalog.js';

export const DEFAULT_PLAYABLE_CHARACTER_ID = 'ch08NonPbr';

function createPlayableCharacter(definition) {
  return Object.freeze({
    id: definition.id,
    label: definition.label,
    subtitle: definition.subtitle,
    characterRig: assets.mixamo.characters[definition.id],
    characterVariant: 'mixamo',
    idleClip: assets.playerAnimationSet.idle,
    previewClip: assets.playerAnimationSet.fightingIdle,
    portraitClip: assets.playerAnimationSet.idle,
    walkClip: assets.playerAnimationSet.walking,
    emotes: assets.playerAnimationSet.emotes
  });
}

export const PLAYABLE_CHARACTER_CATALOG = Object.freeze([
  ...MIXAMO_CHARACTER_DEFINITIONS.map(createPlayableCharacter),
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
