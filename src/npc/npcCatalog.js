import { assets } from '../world/assetManifest.js';
import { MIXAMO_CHARACTER_DEFINITIONS } from '../shared/mixamoCharacterCatalog.js';
import { getDefaultNpcVoiceForModelId } from '../shared/npcVoice.js';

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

const NPC_MODEL_CATALOG_ENTRIES = [];
for (const definition of MIXAMO_CHARACTER_DEFINITIONS) {
  const footprint = definition.npcProfile.footprint;
  NPC_MODEL_CATALOG_ENTRIES.push(createNpcModel({
    id: definition.id,
    itemId: definition.itemId,
    label: definition.npcLabel,
    asset: assets.mixamo.characters[definition.id],
    portraitFileName: definition.portraitFileName,
    height: definition.npcProfile.height,
    footprint: [footprint[0], footprint[1]],
    interactionOffset: definition.npcProfile.interactionOffset,
    interactionRadius: definition.npcProfile.interactionRadius,
    colliderRadius: definition.npcProfile.colliderRadius,
    voice: getDefaultNpcVoiceForModelId(definition.id)
  }));
}

export const NPC_MODEL_CATALOG = Object.freeze(NPC_MODEL_CATALOG_ENTRIES);
export const NPC_MODELS_BY_ID = new Map();
export const NPC_MODELS_BY_ITEM_ID = new Map();
for (const entry of NPC_MODEL_CATALOG) {
  NPC_MODELS_BY_ID.set(entry.id, entry);
  NPC_MODELS_BY_ITEM_ID.set(entry.itemId, entry);
}

export function getNpcModelById(modelId) {
  return NPC_MODELS_BY_ID.get(modelId) ?? null;
}

export function getNpcModelByItemId(itemId) {
  return NPC_MODELS_BY_ITEM_ID.get(itemId) ?? null;
}
