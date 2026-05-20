import { getNpcModelById } from '../npc/npcCatalog.js';
import {
  cloneNpcBehavior,
  NPC_DEFAULT_INTERACT_RADIUS,
  normalizeNpcBehavior
} from '../npc/npcBehavior.js';
import {
  normalizeRotationQuarterTurns,
  normalizeRotationRadians,
  quantizeRotation,
  quantizePosition as normalizePositionValue,
  rotationQuarterTurnsToRadians,
  rotationRadiansToQuarterTurns
} from '../shared/numberMath.js';
import {
  getDefaultPropPlacementScale,
  getPlacementScale,
  normalizePropPlacementScale
} from '../shared/placementScale.js';
import {
  cloneMissionSequence
} from '../shared/missions.js';
import { placementToCollisionRects } from '../shared/combatMath.js';
import {
  cloneNpcModelVoiceMap,
  getNpcModelVoice,
  updateNpcModelVoiceMap
} from '../shared/npcVoice.js';
import {
  clonePassiveTrafficRoutes
} from '../shared/passiveTrafficRoutes.js';
import { getTileOccupiedCells } from '../shared/tileFootprint.js';
import { getBuilderItemById } from './builderCatalog.js';
import { cloneInteractableDefinition } from './interactableMetadata.js';

const PROP_ROTATION_STEP_RADIANS = Math.PI / 4;

function cloneInteractable(interactable) {
  return cloneInteractableDefinition(interactable);
}

function clonePosition(position) {
  return position ? [position[0], position[1]] : null;
}

function clonePlacement(placement) {
  return {
    id: placement.id,
    itemId: placement.itemId,
    layer: placement.layer,
    rotationQuarterTurns: placement.rotationQuarterTurns,
    rotationY: placement.layer === 'prop' && Number.isFinite(Number(placement.rotationY))
      ? quantizeRotation(placement.rotationY)
      : undefined,
    scale: placement.layer === 'prop' ? getPlacementScale(placement) : undefined,
    cellX: placement.cellX,
    cellZ: placement.cellZ,
    position: clonePosition(placement.position),
    interactable: cloneInteractableDefinition(placement.interactable),
    npc: placement.npc ? cloneNpcBehavior(placement.npc) : null
  };
}

function serializeNpcPlacement(placement) {
  return {
    id: placement.id,
    modelId: placement.npc.modelId,
    position: [
      normalizePositionValue(placement.position[0]),
      normalizePositionValue(placement.position[1])
    ],
    rotationQuarterTurns: placement.rotationQuarterTurns,
    name: placement.npc.name,
    prompt: placement.npc.prompt,
    interactRadius: placement.npc.interactRadius,
    speed: placement.npc.speed,
    routine: placement.npc.routine,
    combat: placement.npc.combat,
    respawnDelayMs: placement.npc.respawnDelayMs,
    deliveryQuestEnabled: placement.npc.deliveryQuestEnabled === true,
    gymCheckInEnabled: placement.npc.gymCheckInEnabled === true,
    rentCollectorEnabled: placement.npc.rentCollectorEnabled === true,
    stockMarketEnabled: placement.npc.stockMarketEnabled === true,
    bartenderEnabled: placement.npc.bartenderEnabled === true,
    pawnShopOwnerEnabled: placement.npc.pawnShopOwnerEnabled === true,
    carDealerEnabled: placement.npc.carDealerEnabled === true,
    marthaEnabled: placement.npc.marthaEnabled === true,
    blackjackDealerEnabled: placement.npc.blackjackDealerEnabled === true,
    schoolMicrogameEnabled: placement.npc.schoolMicrogameEnabled === true,
    schoolMicrogameId: placement.npc.schoolMicrogameId,
    spawnPosition: Array.isArray(placement.npc.spawnPosition)
      ? [
          normalizePositionValue(placement.npc.spawnPosition[0]),
          normalizePositionValue(placement.npc.spawnPosition[1])
        ]
      : [
          normalizePositionValue(placement.position[0]),
          normalizePositionValue(placement.position[1])
        ],
    spawnRotationQuarterTurns: normalizeRotationQuarterTurns(
      placement.npc.spawnRotationQuarterTurns ?? placement.rotationQuarterTurns
    )
  };
}

function toPlacementRecord(entry, item, id) {
  return {
    id,
    itemId: item.id,
    layer: item.layer,
    rotationQuarterTurns: normalizeRotationQuarterTurns(entry.rotationQuarterTurns),
    rotationY: item.layer === 'prop' && Number.isFinite(Number(entry.rotationY))
      ? quantizeRotation(entry.rotationY)
      : undefined,
    scale: item.layer === 'prop'
      ? normalizePropPlacementScale(entry.scale, getDefaultPropPlacementScale(item))
      : undefined,
    cellX: item.layer === 'tile' ? entry.cell[0] : null,
    cellZ: item.layer === 'tile' ? entry.cell[1] : null,
    position: item.layer === 'tile'
      ? null
      : [
          normalizePositionValue(entry.position[0]),
          normalizePositionValue(entry.position[1])
        ],
    interactable: cloneInteractable(entry.interactable),
    npc: item.layer === 'npc'
        ? normalizeNpcBehavior({
          modelId: entry.modelId,
          name: entry.name,
          prompt: entry.prompt,
          interactRadius: entry.interactRadius ?? NPC_DEFAULT_INTERACT_RADIUS,
          speed: entry.speed,
          routine: entry.routine,
          combat: entry.combat,
          respawnDelayMs: entry.respawnDelayMs,
          deliveryQuestEnabled: entry.deliveryQuestEnabled,
          gymCheckInEnabled: entry.gymCheckInEnabled,
          rentCollectorEnabled: entry.rentCollectorEnabled,
          stockMarketEnabled: entry.stockMarketEnabled,
          bartenderEnabled: entry.bartenderEnabled,
          pawnShopOwnerEnabled: entry.pawnShopOwnerEnabled,
          carDealerEnabled: entry.carDealerEnabled,
          marthaEnabled: entry.marthaEnabled,
          blackjackDealerEnabled: entry.blackjackDealerEnabled,
          schoolMicrogameEnabled: entry.schoolMicrogameEnabled,
          schoolMicrogameId: entry.schoolMicrogameId,
          spawnPosition: entry.spawnPosition,
          spawnRotationQuarterTurns: entry.spawnRotationQuarterTurns
        }, {
          position: item.layer === 'npc'
            ? [
                normalizePositionValue(entry.position[0]),
                normalizePositionValue(entry.position[1])
              ]
            : null,
          rotationQuarterTurns: normalizeRotationQuarterTurns(entry.rotationQuarterTurns)
        })
      : null
  };
}

function getSerializedPlacementItem(entry) {
  if (entry.layer === 'npc') {
    const model = getNpcModelById(entry.modelId);
    return model ? getBuilderItemById(model.itemId) : null;
  }

  return getBuilderItemById(entry.itemId);
}

function toSerializedPlacement(placement) {
  if (!placement) {
    return null;
  }

  if (placement.layer === 'tile') {
    return {
      id: placement.id,
      layer: 'tile',
      itemId: placement.itemId,
      cell: [placement.cellX, placement.cellZ],
      rotationQuarterTurns: normalizeRotationQuarterTurns(placement.rotationQuarterTurns),
      ...(placement.interactable ? { interactable: cloneInteractable(placement.interactable) } : {})
    };
  }

  if (placement.layer === 'npc' && placement.npc) {
      return {
        id: placement.id,
        layer: 'npc',
      modelId: placement.npc.modelId,
      position: [
        normalizePositionValue(placement.position[0]),
        normalizePositionValue(placement.position[1])
      ],
      rotationQuarterTurns: normalizeRotationQuarterTurns(placement.rotationQuarterTurns),
        name: placement.npc.name,
        prompt: placement.npc.prompt,
        interactRadius: placement.npc.interactRadius,
        speed: placement.npc.speed,
        routine: placement.npc.routine,
        combat: placement.npc.combat,
        respawnDelayMs: placement.npc.respawnDelayMs,
        deliveryQuestEnabled: placement.npc.deliveryQuestEnabled === true,
        gymCheckInEnabled: placement.npc.gymCheckInEnabled === true,
        rentCollectorEnabled: placement.npc.rentCollectorEnabled === true,
        stockMarketEnabled: placement.npc.stockMarketEnabled === true,
        bartenderEnabled: placement.npc.bartenderEnabled === true,
        pawnShopOwnerEnabled: placement.npc.pawnShopOwnerEnabled === true,
        carDealerEnabled: placement.npc.carDealerEnabled === true,
        marthaEnabled: placement.npc.marthaEnabled === true,
        blackjackDealerEnabled: placement.npc.blackjackDealerEnabled === true,
        schoolMicrogameEnabled: placement.npc.schoolMicrogameEnabled === true,
        schoolMicrogameId: placement.npc.schoolMicrogameId,
        spawnPosition: Array.isArray(placement.npc.spawnPosition)
          ? [
              normalizePositionValue(placement.npc.spawnPosition[0]),
              normalizePositionValue(placement.npc.spawnPosition[1])
            ]
          : undefined,
        spawnRotationQuarterTurns: normalizeRotationQuarterTurns(
          placement.npc.spawnRotationQuarterTurns ?? placement.rotationQuarterTurns
        )
      };
    }

  const scale = getPlacementScale(placement);
  const defaultScale = getDefaultPropPlacementScale(placement);
  return {
    id: placement.id,
    layer: 'prop',
    itemId: placement.itemId,
    position: [
      normalizePositionValue(placement.position[0]),
      normalizePositionValue(placement.position[1])
    ],
    rotationQuarterTurns: normalizeRotationQuarterTurns(placement.rotationQuarterTurns),
    ...(Number.isFinite(Number(placement.rotationY)) ? { rotationY: quantizeRotation(placement.rotationY) } : {}),
    ...(scale !== defaultScale ? { scale } : {}),
    ...(placement.interactable ? { interactable: cloneInteractable(placement.interactable) } : {})
  };
}

export class WorldState {
  constructor() {
    this.tilePlacements = new Map();
    this.tileCells = new Map();
    this.propPlacements = new Map();
    this.npcPlacements = new Map();
    this.placementsById = new Map();
    this.collisionRectsByPlacementId = new Map();
    this.collisionRectEntriesByKey = new Map();
    this.placementSequence = 0;
    this.placementRevision = 0;
    this.missionSequence = cloneMissionSequence();
    this.npcModelVoices = cloneNpcModelVoiceMap();
    this.passiveTrafficRoutes = clonePassiveTrafficRoutes();
  }

  clear() {
    this.tilePlacements.clear();
    this.tileCells.clear();
    this.propPlacements.clear();
    this.npcPlacements.clear();
    this.placementsById.clear();
    this.collisionRectsByPlacementId.clear();
    this.collisionRectEntriesByKey.clear();
    this.placementSequence = 0;
    this.bumpPlacementRevision();
    this.missionSequence = cloneMissionSequence();
    this.npcModelVoices = cloneNpcModelVoiceMap();
    this.passiveTrafficRoutes = clonePassiveTrafficRoutes();
  }

  getPlacement(id) {
    return id ? this.placementsById.get(id) ?? null : null;
  }

  getPlacements() {
    const placements = [];
    for (const placement of this.placementsById.values()) {
      placements.push(clonePlacement(placement));
    }
    return placements;
  }

  forEachPlacement(callback) {
    for (const placement of this.placementsById.values()) {
      callback(placement);
    }
  }

  forEachNpcDefinition(callback) {
    for (const placement of this.npcPlacements.values()) {
      callback(serializeNpcPlacement(placement));
    }
  }

  getPlacementRevision() {
    return this.placementRevision;
  }

  getPlacementCollisionRects(placementOrId, item = null, { collisionKey = 'blocksShots' } = {}) {
    const placement = typeof placementOrId === 'string'
      ? this.getPlacement(placementOrId)
      : placementOrId;
    if (!placement?.id) {
      return [];
    }

    let rectsByKey = this.collisionRectsByPlacementId.get(placement.id);
    if (!rectsByKey) {
      rectsByKey = new Map();
      this.collisionRectsByPlacementId.set(placement.id, rectsByKey);
    }

    const normalizedCollisionKey = String(collisionKey || 'blocksShots');
    const cachedRects = rectsByKey.get(normalizedCollisionKey);
    if (cachedRects) {
      return cachedRects;
    }

    const resolvedItem = item ?? getBuilderItemById(placement.itemId);
    const rects = placementToCollisionRects(placement, resolvedItem, {
      collisionKey: normalizedCollisionKey
    });
    rectsByKey.set(normalizedCollisionKey, rects);
    return rects;
  }

  forEachPlacementCollisionRect(callback, { collisionKey = 'blocksShots' } = {}) {
    const normalizedCollisionKey = String(collisionKey || 'blocksShots');
    let entries = this.collisionRectEntriesByKey.get(normalizedCollisionKey);
    if (!entries) {
      entries = [];
      for (const placement of this.placementsById.values()) {
        const rects = this.getPlacementCollisionRects(placement, null, {
          collisionKey: normalizedCollisionKey
        });
        for (const rect of rects) {
          entries.push({
            placementId: placement.id,
            rect
          });
        }
      }
      this.collisionRectEntriesByKey.set(normalizedCollisionKey, entries);
    }

    for (const entry of entries) {
      callback(entry);
    }
  }

  getMissionSequence() {
    return cloneMissionSequence(this.missionSequence);
  }

  getNpcModelVoices() {
    return cloneNpcModelVoiceMap(this.npcModelVoices);
  }

  getPassiveTrafficRoutes() {
    return clonePassiveTrafficRoutes(this.passiveTrafficRoutes);
  }

  getNpcModelVoice(modelId = '') {
    return getNpcModelVoice(this.npcModelVoices, modelId);
  }

  updateMissionSequence(sequence = null) {
    this.missionSequence = cloneMissionSequence(sequence);
    return this.getMissionSequence();
  }

  updateNpcModelVoice(modelId = '', voice = {}) {
    this.npcModelVoices = updateNpcModelVoiceMap(this.npcModelVoices, modelId, voice);
    return this.getNpcModelVoice(modelId);
  }

  updatePassiveTrafficRoutes(routes = []) {
    this.passiveTrafficRoutes = clonePassiveTrafficRoutes(routes);
    return this.getPassiveTrafficRoutes();
  }

  getPlacementAtCell(cellX, cellZ) {
    const placementId = this.tileCells.get(this.getCellKey(cellX, cellZ));
    return placementId ? (this.tilePlacements.get(placementId) ?? null) : null;
  }

  loadLayout(layout = { tiles: [], props: [], npcs: [] }) {
    this.clear();
    this.missionSequence = cloneMissionSequence(layout.missionSequence);
    this.npcModelVoices = cloneNpcModelVoiceMap(layout.npcModelVoices);
    this.passiveTrafficRoutes = clonePassiveTrafficRoutes(layout.passiveTrafficRoutes);

    for (const entry of layout.tiles ?? []) {
      const item = getBuilderItemById(entry.itemId);
      if (!item || item.layer !== 'tile') {
        continue;
      }

      const placement = toPlacementRecord(entry, item, this.reservePlacementId(entry.id));
      this.registerPlacement(placement);
    }

    for (const entry of layout.props ?? []) {
      const item = getBuilderItemById(entry.itemId);
      if (!item || item.layer !== 'prop') {
        continue;
      }

      const placement = toPlacementRecord(entry, item, this.reservePlacementId(entry.id));
      this.registerPlacement(placement);
    }

    for (const entry of layout.npcs ?? []) {
      const model = getNpcModelById(entry.modelId);
      const placementItem = model ? getBuilderItemById(model.itemId) : null;
      if (!placementItem || placementItem.layer !== 'npc') {
        continue;
      }

      const placement = toPlacementRecord(entry, placementItem, this.reservePlacementId(entry.id));
      this.registerPlacement(placement);
    }
  }

  upsertSerializedPlacement(entry) {
    if (!entry || typeof entry !== 'object' || typeof entry.layer !== 'string') {
      return null;
    }

    const item = getSerializedPlacementItem(entry);
    if (!item || item.layer !== entry.layer) {
      return null;
    }

    const placementId = this.reservePlacementId(entry.id);
    const nextEntry = {
      ...entry,
      id: placementId
    };
    const placement = toPlacementRecord(nextEntry, item, placementId);
    const existing = this.getPlacement(placementId);

    if (existing) {
      this.unregisterPlacement(placementId);
    }

    let replacedPlacementIds = [];
    if (placement.layer === 'tile') {
      replacedPlacementIds = this.getOverlappingTilePlacementIds(
        item,
        placement.cellX,
        placement.cellZ,
        placement.rotationQuarterTurns,
        placement.id
      );
      for (const replacedPlacementId of replacedPlacementIds) {
        this.unregisterPlacement(replacedPlacementId);
      }
    }

    this.registerPlacement(placement);
    return {
      placement: clonePlacement(placement),
      replacedPlacementIds,
      replacedPlacementId: replacedPlacementIds[0] ?? null
    };
  }

  placeTile(item, cellX, cellZ, rotationQuarterTurns, interactable = null) {
    const replacedPlacementIds = this.getOverlappingTilePlacementIds(item, cellX, cellZ, rotationQuarterTurns);
    for (const placementId of replacedPlacementIds) {
      this.unregisterPlacement(placementId);
    }

    const placement = {
      id: this.createPlacementId(),
      itemId: item.id,
      layer: item.layer,
      rotationQuarterTurns,
      scale: undefined,
      cellX,
      cellZ,
      position: null,
      interactable: cloneInteractable(interactable),
      npc: null
    };

    this.registerPlacement(placement);
    return {
      placement: clonePlacement(placement),
      replacedPlacementIds,
      replacedPlacementId: replacedPlacementIds[0] ?? null
    };
  }

  placeProp(item, x, z, rotationQuarterTurns, interactable = null, scale = undefined, rotationY = null) {
    const exactRotationY = Number(rotationY);
    const placement = {
      id: this.createPlacementId(),
      itemId: item.id,
      layer: item.layer,
      rotationQuarterTurns: normalizeRotationQuarterTurns(rotationQuarterTurns),
      rotationY: Number.isFinite(exactRotationY) ? quantizeRotation(exactRotationY) : undefined,
      scale: normalizePropPlacementScale(scale, getDefaultPropPlacementScale(item)),
      cellX: null,
      cellZ: null,
      position: [x, z],
      interactable: cloneInteractable(interactable),
      npc: null
    };

    this.registerPlacement(placement);
    return clonePlacement(placement);
  }

  placeNpc(item, x, z, rotationQuarterTurns, npc) {
    const placement = {
      id: this.createPlacementId(),
      itemId: item.id,
      layer: item.layer,
      rotationQuarterTurns,
      scale: undefined,
      cellX: null,
      cellZ: null,
      position: [x, z],
      interactable: null,
      npc: {
        ...normalizeNpcBehavior({
          modelId: npc.modelId,
          name: npc.name,
          prompt: npc.prompt,
          interactRadius: npc.interactRadius ?? NPC_DEFAULT_INTERACT_RADIUS,
          speed: npc.speed,
          routine: npc.routine,
          combat: npc.combat,
          respawnDelayMs: npc.respawnDelayMs,
          deliveryQuestEnabled: npc.deliveryQuestEnabled,
          gymCheckInEnabled: npc.gymCheckInEnabled,
          rentCollectorEnabled: npc.rentCollectorEnabled,
          stockMarketEnabled: npc.stockMarketEnabled,
          bartenderEnabled: npc.bartenderEnabled,
          pawnShopOwnerEnabled: npc.pawnShopOwnerEnabled,
          carDealerEnabled: npc.carDealerEnabled,
          marthaEnabled: npc.marthaEnabled,
          blackjackDealerEnabled: npc.blackjackDealerEnabled,
          schoolMicrogameEnabled: npc.schoolMicrogameEnabled,
          schoolMicrogameId: npc.schoolMicrogameId,
          spawnPosition: [x, z],
          spawnRotationQuarterTurns: rotationQuarterTurns
        }, {
          position: [x, z],
          rotationQuarterTurns
        })
      }
    };

    this.registerPlacement(placement);
    return clonePlacement(placement);
  }

  updateNpc(id, updates = {}) {
    const placement = this.getPlacement(id);
    if (!placement || placement.layer !== 'npc' || !placement.npc) {
      return null;
    }

    const { itemId, ...npcUpdates } = updates;

    if (itemId && itemId !== placement.itemId) {
      placement.itemId = itemId;
      this.invalidatePlacementCollisionRects(placement.id);
    }

    placement.npc = normalizeNpcBehavior({
      ...placement.npc,
      ...npcUpdates
    }, {
      position: placement.position,
      rotationQuarterTurns: placement.rotationQuarterTurns
    });
    this.bumpPlacementRevision();

    return clonePlacement(placement);
  }

  updatePlacementInteractable(id, interactable = null) {
    const placement = this.getPlacement(id);
    if (!placement || placement.layer === 'npc') {
      return null;
    }

    placement.interactable = cloneInteractable(interactable);
    this.bumpPlacementRevision();
    return clonePlacement(placement);
  }

  updatePlacementScale(id, scale = undefined) {
    const placement = this.getPlacement(id);
    if (!placement || placement.layer !== 'prop') {
      return null;
    }

    placement.scale = normalizePropPlacementScale(scale, getDefaultPropPlacementScale(placement));
    this.invalidatePlacementCollisionRects(placement.id);
    this.bumpPlacementRevision();
    return clonePlacement(placement);
  }

  movePlacement(id, target = {}) {
    const placement = this.getPlacement(id);
    if (!placement) {
      return { placement: null, error: 'That placement is not available.' };
    }

    if (placement.layer === 'tile') {
      const item = getBuilderItemById(placement.itemId);
      if (!item) {
        return { placement: null, error: 'That placement is not available.' };
      }

      const cellX = Math.round(Number(target.cellX ?? placement.cellX ?? 0));
      const cellZ = Math.round(Number(target.cellZ ?? placement.cellZ ?? 0));
      const replacedPlacementIds = this.getOverlappingTilePlacementIds(
        item,
        cellX,
        cellZ,
        placement.rotationQuarterTurns,
        placement.id
      );

      this.unregisterPlacement(placement.id);
      for (const replacedPlacementId of replacedPlacementIds) {
        this.unregisterPlacement(replacedPlacementId);
      }

      placement.cellX = cellX;
      placement.cellZ = cellZ;
      placement.position = null;
      this.registerPlacement(placement);

      return {
        placement: clonePlacement(placement),
        error: null,
        replacedPlacementIds,
        replacedPlacementId: replacedPlacementIds[0] ?? null
      };
    }

    const x = Number(target.x ?? target.position?.[0]);
    const z = Number(target.z ?? target.position?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return { placement: null, error: 'That placement needs a valid destination.' };
    }

    placement.cellX = null;
    placement.cellZ = null;
    placement.position = [x, z];
    if (placement.layer === 'npc' && placement.npc) {
      placement.npc.spawnPosition = [x, z];
    }
    this.invalidatePlacementCollisionRects(placement.id);
    this.bumpPlacementRevision();
    return {
      placement: clonePlacement(placement),
      error: null,
      replacedPlacementIds: [],
      replacedPlacementId: null
    };
  }

  rotatePlacement(id, delta = 1) {
    const placement = this.getPlacement(id);
    if (!placement) {
      return { placement: null, error: 'That placement is not available.' };
    }

    if (placement.layer === 'prop') {
      const currentRotationY = Number.isFinite(Number(placement.rotationY))
        ? Number(placement.rotationY)
        : rotationQuarterTurnsToRadians(placement.rotationQuarterTurns);
      const rawNextRotationY = normalizeRotationRadians(
        currentRotationY + (delta * PROP_ROTATION_STEP_RADIANS)
      );
      const nextRotationY = quantizeRotation(rawNextRotationY);
      placement.rotationY = nextRotationY;
      placement.rotationQuarterTurns = rotationRadiansToQuarterTurns(rawNextRotationY);
      this.invalidatePlacementCollisionRects(placement.id);
      this.bumpPlacementRevision();
      return { placement: clonePlacement(placement), error: null };
    }

    const nextRotationQuarterTurns = (placement.rotationQuarterTurns + delta + 4) % 4;
    if (placement.layer === 'tile') {
      const item = getBuilderItemById(placement.itemId);
      if (!item) {
        return { placement: null, error: 'That placement is not available.' };
      }

      const conflicts = this.getOverlappingTilePlacementIds(
        item,
        placement.cellX,
        placement.cellZ,
        nextRotationQuarterTurns,
        placement.id
      );
      if (conflicts.length) {
        return { placement: null, error: 'That piece needs more empty tiles before it can rotate.' };
      }
    }

    if (placement.layer === 'tile') {
      this.unregisterPlacement(placement.id);
      placement.rotationQuarterTurns = nextRotationQuarterTurns;
      this.registerPlacement(placement);
    } else {
      placement.rotationQuarterTurns = nextRotationQuarterTurns;
      if (placement.layer === 'npc' && placement.npc) {
        placement.npc.spawnRotationQuarterTurns = nextRotationQuarterTurns;
      }
      this.invalidatePlacementCollisionRects(placement.id);
      this.bumpPlacementRevision();
    }

    return { placement: clonePlacement(placement), error: null };
  }

  deletePlacement(id) {
    const placement = this.getPlacement(id);
    if (!placement) {
      return null;
    }

    this.unregisterPlacement(id);
    return clonePlacement(placement);
  }

  serializeLayout() {
    const sortedTiles = [];
    for (const placement of this.tilePlacements.values()) {
      sortedTiles.push(placement);
    }
    sortedTiles.sort((a, b) => (a.cellZ - b.cellZ) || (a.cellX - b.cellX));
    const tiles = [];
    for (const placement of sortedTiles) {
      tiles.push({
        id: placement.id,
        itemId: placement.itemId,
        cell: [placement.cellX, placement.cellZ],
        rotationQuarterTurns: placement.rotationQuarterTurns,
        ...(placement.interactable ? { interactable: cloneInteractable(placement.interactable) } : {})
      });
    }

    const sortedProps = [];
    for (const placement of this.propPlacements.values()) {
      sortedProps.push(placement);
    }
    sortedProps.sort((a, b) => (a.position[1] - b.position[1]) || (a.position[0] - b.position[0]));
    const props = [];
    for (const placement of sortedProps) {
      const scale = getPlacementScale(placement);
      const defaultScale = getDefaultPropPlacementScale(placement);
      props.push({
        id: placement.id,
        itemId: placement.itemId,
        position: [
          normalizePositionValue(placement.position[0]),
          normalizePositionValue(placement.position[1])
        ],
        rotationQuarterTurns: placement.rotationQuarterTurns,
        ...(Number.isFinite(Number(placement.rotationY)) ? { rotationY: quantizeRotation(placement.rotationY) } : {}),
        ...(scale !== defaultScale ? { scale } : {}),
        ...(placement.interactable ? { interactable: cloneInteractable(placement.interactable) } : {})
      });
    }

    const sortedNpcs = [];
    for (const placement of this.npcPlacements.values()) {
      sortedNpcs.push(placement);
    }
    sortedNpcs.sort((a, b) => (a.position[1] - b.position[1]) || (a.position[0] - b.position[0]));
    const npcs = [];
    for (const placement of sortedNpcs) {
      npcs.push(serializeNpcPlacement(placement));
    }

    return {
      tiles,
      props,
      npcs,
      missionSequence: cloneMissionSequence(this.missionSequence),
      npcModelVoices: this.getNpcModelVoices(),
      passiveTrafficRoutes: this.getPassiveTrafficRoutes()
    };
  }

  serializePlacement(idOrPlacement) {
    const placement = typeof idOrPlacement === 'string'
      ? this.getPlacement(idOrPlacement)
      : idOrPlacement;
    return toSerializedPlacement(placement);
  }

  registerPlacement(placement) {
    this.invalidatePlacementCollisionRects(placement.id);
    this.placementsById.set(placement.id, placement);
    this.bumpPlacementRevision();

    if (placement.layer === 'tile') {
      this.tilePlacements.set(placement.id, placement);
      const item = getBuilderItemById(placement.itemId);
      const occupiedCells = getTileOccupiedCells(item, placement.cellX, placement.cellZ, placement.rotationQuarterTurns);
      for (const cell of occupiedCells) {
        this.tileCells.set(this.getCellKey(cell.x, cell.z), placement.id);
      }
      return;
    }

    if (placement.layer === 'npc') {
      this.npcPlacements.set(placement.id, placement);
      return;
    }

    this.propPlacements.set(placement.id, placement);
  }

  unregisterPlacement(id) {
    const placement = this.getPlacement(id);
    if (!placement) {
      return;
    }

    this.placementsById.delete(id);
    this.invalidatePlacementCollisionRects(id);
    this.bumpPlacementRevision();
    if (placement.layer === 'tile') {
      this.tilePlacements.delete(id);
      const item = getBuilderItemById(placement.itemId);
      const occupiedCells = getTileOccupiedCells(item, placement.cellX, placement.cellZ, placement.rotationQuarterTurns);
      for (const cell of occupiedCells) {
        const key = this.getCellKey(cell.x, cell.z);
        if (this.tileCells.get(key) === placement.id) {
          this.tileCells.delete(key);
        }
      }
      return;
    }

    if (placement.layer === 'npc') {
      this.npcPlacements.delete(id);
      return;
    }

    this.propPlacements.delete(id);
  }

  getCellKey(x, z) {
    return `${x},${z}`;
  }

  invalidatePlacementCollisionRects(id) {
    if (!id) {
      return;
    }

    this.collisionRectsByPlacementId.delete(id);
    this.collisionRectEntriesByKey.clear();
  }

  bumpPlacementRevision() {
    this.placementRevision += 1;
  }

  getOverlappingTilePlacementIds(item, cellX, cellZ, rotationQuarterTurns, ignorePlacementId = null) {
    const overlappingIds = new Set();
    const occupiedCells = getTileOccupiedCells(item, cellX, cellZ, rotationQuarterTurns);

    for (const cell of occupiedCells) {
      const placement = this.getPlacementAtCell(cell.x, cell.z);
      if (!placement || placement.id === ignorePlacementId) {
        continue;
      }
      overlappingIds.add(placement.id);
    }

    const overlapping = [];
    for (const id of overlappingIds) {
      overlapping.push(id);
    }
    return overlapping;
  }

  createPlacementId() {
    this.placementSequence += 1;
    return `placement_${this.placementSequence}`;
  }

  reservePlacementId(id) {
    if (!id) {
      return this.createPlacementId();
    }

    const match = /^placement_(\d+)$/.exec(id);
    if (match) {
      this.placementSequence = Math.max(this.placementSequence, Number(match[1]));
    }
    return id;
  }
}
