import * as THREE from 'three';

const sharedBounds = new THREE.Box3();
const sharedNodeBounds = new THREE.Box3();
const sharedCenter = new THREE.Vector3();

function boxHasFiniteExtents(box) {
  return Boolean(
    box
    && Number.isFinite(box.min?.x)
    && Number.isFinite(box.min?.y)
    && Number.isFinite(box.min?.z)
    && Number.isFinite(box.max?.x)
    && Number.isFinite(box.max?.y)
    && Number.isFinite(box.max?.z)
  );
}

function normalizeNodeNameParts(nodeNameParts = []) {
  const source = typeof nodeNameParts === 'string' ? [nodeNameParts] : nodeNameParts;
  if (!source || typeof source[Symbol.iterator] !== 'function') {
    return [];
  }

  const parts = [];
  for (const rawPart of source) {
    const part = String(rawPart ?? '').trim().toLowerCase();
    if (part) {
      parts.push(part);
    }
  }
  return parts;
}

function nodeNameMatchesParts(node, nodeNameParts) {
  if (!nodeNameParts.length) {
    return false;
  }

  const name = String(node?.name ?? '').toLowerCase();
  for (let index = 0; index < nodeNameParts.length; index += 1) {
    if (name.includes(nodeNameParts[index])) {
      return true;
    }
  }
  return false;
}

export function getObjectBounds(root, nodeNameParts = []) {
  if (!root) {
    return sharedBounds.makeEmpty();
  }

  const normalizedNodeNameParts = normalizeNodeNameParts(nodeNameParts);
  if (!root || normalizedNodeNameParts.length === 0) {
    return sharedBounds.setFromObject(root);
  }

  sharedBounds.makeEmpty();
  root.updateWorldMatrix?.(true, true);
  root.traverse?.((node) => {
    if (!node?.isMesh || !node.geometry || !nodeNameMatchesParts(node, normalizedNodeNameParts)) {
      return;
    }

    if (!node.geometry.boundingBox) {
      node.geometry.computeBoundingBox();
    }
    sharedNodeBounds.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);
    if (boxHasFiniteExtents(sharedNodeBounds)) {
      sharedBounds.union(sharedNodeBounds);
    }
  });

  return boxHasFiniteExtents(sharedBounds)
    ? sharedBounds
    : sharedBounds.setFromObject(root);
}

export function snapObjectToGround(root, {
  clearance = 0,
  groundNodeNameParts = []
} = {}) {
  const bounds = getObjectBounds(root, groundNodeNameParts);
  if (!boxHasFiniteExtents(bounds)) {
    return root;
  }

  root.position.y -= bounds.min.y;
  root.position.y += Number(clearance) || 0;
  root.updateWorldMatrix?.(true, true);
  return root;
}

export function fitObjectToFootprint(root, targetWidth, targetDepth) {
  const width = Number(targetWidth);
  const depth = Number(targetDepth);
  if (!root || !Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) {
    return 1;
  }

  const bounds = getObjectBounds(root);
  if (!boxHasFiniteExtents(bounds)) {
    return 1;
  }

  const size = bounds.getSize(sharedCenter);
  const scaleX = size.x > 0 ? width / size.x : 1;
  const scaleZ = size.z > 0 ? depth / size.z : 1;
  const scale = Math.min(scaleX, scaleZ);
  if (Number.isFinite(scale) && scale > 0) {
    root.scale.multiplyScalar(scale);
    root.updateWorldMatrix?.(true, true);
    return scale;
  }

  return 1;
}

export function centerObjectOnXZAndSnapToGround(root, {
  clearance = 0,
  groundNodeNameParts = []
} = {}) {
  const bounds = getObjectBounds(root);
  if (!boxHasFiniteExtents(bounds)) {
    return root;
  }

  bounds.getCenter(sharedCenter);
  root.position.x -= sharedCenter.x;
  root.position.z -= sharedCenter.z;
  return snapObjectToGround(root, { clearance, groundNodeNameParts });
}
