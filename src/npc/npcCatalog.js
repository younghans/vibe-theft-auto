import { assets } from '../world/assetManifest.js';

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
  {
    id: 'xBot',
    itemId: 'npc_x_bot',
    label: 'X Bot',
    asset: assets.mixamo.characters.xBot,
    height: 4.5,
    footprint: [3.2, 3.2],
    interactionOffset: 2.3,
    interactionRadius: 4.2,
    colliderRadius: 1.35
  },
  {
    id: 'brute',
    itemId: 'npc_brute',
    label: 'Brute',
    asset: assets.mixamo.characters.brute,
    height: 5.4,
    footprint: [4.4, 4.4],
    interactionOffset: 2.8,
    interactionRadius: 4.8,
    colliderRadius: 1.65
  },
  {
    id: 'ch18NonPbr',
    itemId: 'npc_ch18_non_pbr',
    label: 'Ch18 Non-PBR',
    asset: assets.mixamo.characters.ch18NonPbr,
    height: 4.9,
    footprint: [3.6, 3.6],
    interactionOffset: 2.5,
    interactionRadius: 4.4,
    colliderRadius: 1.45
  }
].map(createNpcModel));

export const NPC_MODELS_BY_ID = new Map(NPC_MODEL_CATALOG.map((entry) => [entry.id, entry]));
export const NPC_MODELS_BY_ITEM_ID = new Map(NPC_MODEL_CATALOG.map((entry) => [entry.itemId, entry]));

export function getNpcModelById(modelId) {
  return NPC_MODELS_BY_ID.get(modelId) ?? null;
}

export function getNpcModelByItemId(itemId) {
  return NPC_MODELS_BY_ITEM_ID.get(itemId) ?? null;
}
