import { getNpcModelById } from '../npc/npcCatalog.js';
import {
  cloneNpcBehavior,
  normalizeNpcBehavior
} from '../npc/npcBehavior.js';
import { getTileOccupiedCells } from '../shared/tileFootprint.js';
import { getBuilderItemById } from './builderCatalog.js';

function cloneInterior(interior) {
  if (!interior) {
    return null;
  }

  return {
    ...interior,
    cutawayNodeNames: [...(interior.cutawayNodeNames ?? [])],
    exteriorDoorOffset: [...(interior.exteriorDoorOffset ?? [0, 0])],
    exteriorSpawnOffset: [...(interior.exteriorSpawnOffset ?? [0, 0])]
  };
}

function cloneInteractable(interactable) {
  if (!interactable) {
    return null;
  }

  return {
    ...interactable,
    localOffset: Array.isArray(interactable.localOffset) ? [...interactable.localOffset] : interactable.localOffset,
    approachLocalOffset: Array.isArray(interactable.approachLocalOffset)
      ? [...interactable.approachLocalOffset]
      : interactable.approachLocalOffset,
    interior: cloneInterior(interactable.interior)
  };
}

function clonePlacement(placement) {
  return {
    id: placement.id,
    itemId: placement.itemId,
    layer: placement.layer,
    rotationQuarterTurns: placement.rotationQuarterTurns,
    cellX: placement.cellX,
    cellZ: placement.cellZ,
    position: placement.position ? [...placement.position] : null,
    interactable: cloneInteractable(placement.interactable),
    npc: placement.npc ? cloneNpcBehavior(placement.npc) : null
  };
}

function normalizeRotationQuarterTurns(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return ((Math.round(numeric) % 4) + 4) % 4;
}

function normalizePositionValue(value) {
  return Number(Number(value ?? 0).toFixed(2));
}

function toPlacementRecord(entry, item, id) {
  return {
    id,
    itemId: item.id,
    layer: item.layer,
    rotationQuarterTurns: normalizeRotationQuarterTurns(entry.rotationQuarterTurns),
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
          interactRadius: entry.interactRadius ?? item.interactionRadius ?? 4.2,
          speed: entry.speed,
          routine: entry.routine,
          combat: entry.combat,
          respawnDelayMs: entry.respawnDelayMs,
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

  return {
    id: placement.id,
    layer: 'prop',
    itemId: placement.itemId,
    position: [
      normalizePositionValue(placement.position[0]),
      normalizePositionValue(placement.position[1])
    ],
    rotationQuarterTurns: normalizeRotationQuarterTurns(placement.rotationQuarterTurns),
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
    this.placementSequence = 0;
  }

  clear() {
    this.tilePlacements.clear();
    this.tileCells.clear();
    this.propPlacements.clear();
    this.npcPlacements.clear();
    this.placementsById.clear();
    this.placementSequence = 0;
  }

  getPlacement(id) {
    return id ? this.placementsById.get(id) ?? null : null;
  }

  getPlacements() {
    return [...this.placementsById.values()].map(clonePlacement);
  }

  getPlacementAtCell(cellX, cellZ) {
    const placementId = this.tileCells.get(this.getCellKey(cellX, cellZ));
    return placementId ? (this.tilePlacements.get(placementId) ?? null) : null;
  }

  loadLayout(layout = { tiles: [], props: [], npcs: [] }) {
    this.clear();

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

  placeProp(item, x, z, rotationQuarterTurns, interactable = null) {
    const placement = {
      id: this.createPlacementId(),
      itemId: item.id,
      layer: item.layer,
      rotationQuarterTurns,
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
      cellX: null,
      cellZ: null,
      position: [x, z],
      interactable: null,
      npc: {
        ...normalizeNpcBehavior({
          modelId: npc.modelId,
          name: npc.name,
          prompt: npc.prompt,
          interactRadius: npc.interactRadius ?? item.interactionRadius ?? 4.2,
          speed: npc.speed,
          routine: npc.routine,
          combat: npc.combat,
          respawnDelayMs: npc.respawnDelayMs,
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
    }

    placement.npc = normalizeNpcBehavior({
      ...placement.npc,
      ...npcUpdates
    }, {
      position: placement.position,
      rotationQuarterTurns: placement.rotationQuarterTurns
    });

    return clonePlacement(placement);
  }

  updatePlacementInteractable(id, interactable = null) {
    const placement = this.getPlacement(id);
    if (!placement || placement.layer === 'npc') {
      return null;
    }

    placement.interactable = cloneInteractable(interactable);
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
    const tiles = [...this.tilePlacements.values()]
      .sort((a, b) => (a.cellZ - b.cellZ) || (a.cellX - b.cellX))
      .map((placement) => ({
        id: placement.id,
        itemId: placement.itemId,
        cell: [placement.cellX, placement.cellZ],
        rotationQuarterTurns: placement.rotationQuarterTurns,
        ...(placement.interactable ? { interactable: cloneInteractable(placement.interactable) } : {})
      }));

    const props = [...this.propPlacements.values()]
      .sort((a, b) => (a.position[1] - b.position[1]) || (a.position[0] - b.position[0]))
      .map((placement) => ({
        id: placement.id,
        itemId: placement.itemId,
        position: [
          Number(placement.position[0].toFixed(2)),
          Number(placement.position[1].toFixed(2))
        ],
        rotationQuarterTurns: placement.rotationQuarterTurns,
        ...(placement.interactable ? { interactable: cloneInteractable(placement.interactable) } : {})
      }));

    const npcs = [...this.npcPlacements.values()]
      .sort((a, b) => (a.position[1] - b.position[1]) || (a.position[0] - b.position[0]))
      .map((placement) => ({
        id: placement.id,
        modelId: placement.npc.modelId,
        position: [
          Number(placement.position[0].toFixed(2)),
          Number(placement.position[1].toFixed(2))
        ],
        rotationQuarterTurns: placement.rotationQuarterTurns,
        name: placement.npc.name,
        prompt: placement.npc.prompt,
        interactRadius: placement.npc.interactRadius,
        speed: placement.npc.speed,
        routine: placement.npc.routine,
        combat: placement.npc.combat,
        respawnDelayMs: placement.npc.respawnDelayMs,
        spawnPosition: Array.isArray(placement.npc.spawnPosition)
          ? [
              Number(placement.npc.spawnPosition[0].toFixed(2)),
              Number(placement.npc.spawnPosition[1].toFixed(2))
            ]
          : [
              Number(placement.position[0].toFixed(2)),
              Number(placement.position[1].toFixed(2))
            ],
        spawnRotationQuarterTurns: normalizeRotationQuarterTurns(
          placement.npc.spawnRotationQuarterTurns ?? placement.rotationQuarterTurns
        )
      }));

    return { tiles, props, npcs };
  }

  serializePlacement(idOrPlacement) {
    const placement = typeof idOrPlacement === 'string'
      ? this.getPlacement(idOrPlacement)
      : idOrPlacement;
    return toSerializedPlacement(placement);
  }

  registerPlacement(placement) {
    this.placementsById.set(placement.id, placement);

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

    return [...overlappingIds];
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
