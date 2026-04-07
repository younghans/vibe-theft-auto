import * as THREE from 'three';
import { getBuilderItemById } from './builderCatalog.js';

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
  const primaryObject = await library.instantiate(item.asset);

  if (!underlayItem) {
    return {
      root: primaryObject,
      colliderObject: primaryObject,
      parts: [{ object: primaryObject, item, role: 'primary' }]
    };
  }

  const underlayObject = await library.instantiate(underlayItem.asset);
  const root = new THREE.Group();
  root.add(underlayObject);
  root.add(primaryObject);

  return {
    root,
    colliderObject: primaryObject,
    parts: [
      { object: underlayObject, item: underlayItem, role: 'underlay' },
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
