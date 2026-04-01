import { getBuilderItemById } from './builderCatalog.js';

function cloneInteractable(interactable) {
  return interactable ? { ...interactable } : null;
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
    interactable: cloneInteractable(placement.interactable)
  };
}

function toPlacementRecord(entry, item, id) {
  return {
    id,
    itemId: item.id,
    layer: item.layer,
    rotationQuarterTurns: entry.rotationQuarterTurns ?? 0,
    cellX: item.layer === 'tile' ? entry.cell[0] : null,
    cellZ: item.layer === 'tile' ? entry.cell[1] : null,
    position: item.layer === 'prop' ? [entry.position[0], entry.position[1]] : null,
    interactable: cloneInteractable(entry.interactable)
  };
}

export class WorldState {
  constructor() {
    this.tilePlacements = new Map();
    this.propPlacements = new Map();
    this.placementsById = new Map();
    this.placementSequence = 0;
  }

  clear() {
    this.tilePlacements.clear();
    this.propPlacements.clear();
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
    return this.tilePlacements.get(this.getCellKey(cellX, cellZ)) ?? null;
  }

  loadLayout(layout = { tiles: [], props: [] }) {
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
  }

  placeTile(item, cellX, cellZ, rotationQuarterTurns, interactable = null) {
    const existing = this.getPlacementAtCell(cellX, cellZ);
    if (existing) {
      this.unregisterPlacement(existing.id);
    }

    const placement = {
      id: this.createPlacementId(),
      itemId: item.id,
      layer: item.layer,
      rotationQuarterTurns,
      cellX,
      cellZ,
      position: null,
      interactable: cloneInteractable(interactable)
    };

    this.registerPlacement(placement);
    return {
      placement: clonePlacement(placement),
      replacedPlacementId: existing?.id ?? null
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
      interactable: cloneInteractable(interactable)
    };

    this.registerPlacement(placement);
    return clonePlacement(placement);
  }

  rotatePlacement(id, delta = 1) {
    const placement = this.getPlacement(id);
    if (!placement) {
      return null;
    }

    placement.rotationQuarterTurns = (placement.rotationQuarterTurns + delta + 4) % 4;
    return clonePlacement(placement);
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

    return { tiles, props };
  }

  registerPlacement(placement) {
    this.placementsById.set(placement.id, placement);

    if (placement.layer === 'tile') {
      this.tilePlacements.set(this.getCellKey(placement.cellX, placement.cellZ), placement);
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
      this.tilePlacements.delete(this.getCellKey(placement.cellX, placement.cellZ));
      return;
    }

    this.propPlacements.delete(id);
  }

  getCellKey(x, z) {
    return `${x},${z}`;
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
