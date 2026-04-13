import { assets } from '../world/assetManifest.js';
import { MIXAMO_CHARACTER_DEFINITIONS } from '../shared/mixamoCharacterCatalog.js';

function createNpcCollisionProfile({ height, colliderRadius }) {
  const colliderHeight = Math.max(1.6, height * 0.82);
  return {
    collider: Object.freeze({
      radius: colliderRadius,
      height: colliderHeight
    }),
    pickCollider: Object.freeze({
      radius: colliderRadius + 0.4,
      height: Math.max(colliderHeight, height * 0.94)
    })
  };
}

function createNpcModel(definition) {
  const collisionProfile = createNpcCollisionProfile(definition);
  return Object.freeze({
    ...definition,
    ...collisionProfile
  });
}

export const NPC_MODEL_CATALOG = Object.freeze([
  ...MIXAMO_CHARACTER_DEFINITIONS.map((definition) => ({
    id: definition.id,
    itemId: definition.itemId,
    label: definition.npcLabel,
    asset: assets.mixamo.characters[definition.id],
    portraitFileName: definition.portraitFileName,
    height: definition.npcProfile.height,
    footprint: [...definition.npcProfile.footprint],
    interactionOffset: definition.npcProfile.interactionOffset,
    interactionRadius: definition.npcProfile.interactionRadius,
    colliderRadius: definition.npcProfile.colliderRadius
  }))
].map(createNpcModel));

export const NPC_MODELS_BY_ID = new Map(NPC_MODEL_CATALOG.map((entry) => [entry.id, entry]));
export const NPC_MODELS_BY_ITEM_ID = new Map(NPC_MODEL_CATALOG.map((entry) => [entry.itemId, entry]));

export function getNpcModelById(modelId) {
  return NPC_MODELS_BY_ID.get(modelId) ?? null;
}

export function getNpcModelByItemId(itemId) {
  return NPC_MODELS_BY_ITEM_ID.get(itemId) ?? null;
}
