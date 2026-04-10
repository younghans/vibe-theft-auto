import * as THREE from 'three';
import { getTileLocalCellOffsets, getTileLocalCenterOffset } from '../shared/tileFootprint.js';
import { getBuilderItemById } from './builderCatalog.js';
import { createOlympicBarbellVisual } from './proceduralProps.js';

export function fitObjectToFootprint(root, targetWidth, targetDepth) {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const scaleX = size.x > 0 ? targetWidth / size.x : 1;
  const scaleZ = size.z > 0 ? targetDepth / size.z : 1;
  root.scale.multiplyScalar(Math.min(scaleX, scaleZ));
}

export function snapObjectToGround(root) {
  const bounds = new THREE.Box3().setFromObject(root);
  root.position.y -= bounds.min.y;
}

function getUnderlayItem(item) {
  if (item?.layer !== 'tile' || !item.underlayTileId) {
    return null;
  }

  const underlayItem = getBuilderItemById(item.underlayTileId);
  return underlayItem?.layer === 'tile' ? underlayItem : null;
}

export async function instantiateItemVisual(library, item) {
  const underlayItem = getUnderlayItem(item);
  let primaryObject = null;

  if (typeof item?.createVisual === 'function') {
    primaryObject = item.createVisual();
  } else if (item?.id === 'olympic_barbell' || item?.assetName === 'olympic_barbell') {
    // Procedural props can lose function fields when copied through plain-object workflows.
    primaryObject = createOlympicBarbellVisual();
  } else if (typeof item?.asset === 'string' && item.asset) {
    primaryObject = await library.instantiate(item.asset);
  } else {
    throw new Error(`Item "${item?.id ?? item?.assetName ?? 'unknown'}" does not define a usable visual source.`);
  }
  const needsTileRoot = item?.layer === 'tile';
  const root = needsTileRoot ? new THREE.Group() : primaryObject;
  const tileCenterOffset = needsTileRoot ? getTileLocalCenterOffset(item) : { x: 0, z: 0 };

  if (needsTileRoot) {
    root.add(primaryObject);
  }

  if (!underlayItem) {
    return {
      root,
      colliderObject: primaryObject,
      parts: [{ object: primaryObject, item, role: 'primary' }]
    };
  }

  const underlayOffsets = item?.layer === 'tile'
    ? getTileLocalCellOffsets(item)
    : [{ x: 0, z: 0 }];
  const underlayObjects = await Promise.all(
    underlayOffsets.map(async (offset) => {
      const underlayObject = await library.instantiate(underlayItem.asset);
      underlayObject.position.set(
        offset.x - tileCenterOffset.x,
        0,
        offset.z - tileCenterOffset.z
      );
      root.add(underlayObject);
      return underlayObject;
    })
  );

  return {
    root,
    colliderObject: primaryObject,
    parts: [
      ...underlayObjects.map((object) => ({ object, item: underlayItem, role: 'underlay' })),
      { object: primaryObject, item, role: 'primary' }
    ]
  };
}

export function prepareItemVisual(visual, applyObjectSetup = null) {
  for (const part of visual.parts) {
    applyObjectSetup?.(part.object, part);
    fitObjectToFootprint(part.object, part.item.size[0], part.item.size[1]);
    snapObjectToGround(part.object);
  }

  return visual.root;
}
