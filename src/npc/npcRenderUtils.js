import * as THREE from 'three';

function createAdornmentMaterial(color, roughness = 0.72, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });
}

function createAdornmentSphere(name, radius, position, material, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 12),
    material
  );
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createAdornmentBox(name, size, position, material, rotation = null) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    material
  );
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  if (Array.isArray(rotation)) {
    mesh.rotation.set(rotation[0] ?? 0, rotation[1] ?? 0, rotation[2] ?? 0);
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createMarthaSmile(material) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.25, -0.08, 0),
    new THREE.Vector3(-0.11, -0.17, 0.02),
    new THREE.Vector3(0, -0.2, 0.03),
    new THREE.Vector3(0.11, -0.17, 0.02),
    new THREE.Vector3(0.25, -0.08, 0)
  ]);
  const smile = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, 0.026, 8, false),
    material
  );
  smile.name = 'marthaBigSmile';
  smile.position.set(0, 0.02, 0.53);
  smile.castShadow = false;
  smile.receiveShadow = false;
  return smile;
}

export function createMarthaNpcAdornment(model = {}) {
  const height = Math.max(3.2, Number(model.height ?? 4.8) || 4.8);
  const root = new THREE.Group();
  root.name = 'marthaNpcAdornment';

  const materials = {
    hair: createAdornmentMaterial(0xf4f0df, 0.92, 0.01),
    hairShadow: createAdornmentMaterial(0xd9d0b9, 0.9, 0.01),
    skin: createAdornmentMaterial(0xe7b885, 0.78, 0.02),
    cheek: createAdornmentMaterial(0xd87673, 0.74, 0.02),
    smile: createAdornmentMaterial(0x7c2f2b, 0.62, 0.02),
    apron: createAdornmentMaterial(0xfff4d2, 0.82, 0.02),
    dress: createAdornmentMaterial(0x7b6295, 0.74, 0.04)
  };

  const head = new THREE.Group();
  head.name = 'marthaHeadDetail';
  head.position.set(0, height * 0.79, 0.08);
  root.add(head);

  head.add(createAdornmentSphere('marthaRoundFace', 0.38, [0, 0, 0.24], materials.skin, [0.92, 1.02, 0.54]));
  head.add(createAdornmentSphere('marthaFluffyHairHalo', 0.46, [0, 0.16, 0.04], materials.hair, [1.1, 0.82, 0.76]));
  head.add(createAdornmentSphere('marthaFluffyHairTop', 0.3, [0, 0.48, 0.02], materials.hair, [1.05, 0.82, 0.94]));
  head.add(createAdornmentSphere('marthaFluffyHairLeft', 0.28, [-0.34, 0.18, 0.08], materials.hair, [0.86, 1.1, 0.78]));
  head.add(createAdornmentSphere('marthaFluffyHairRight', 0.28, [0.34, 0.18, 0.08], materials.hair, [0.86, 1.1, 0.78]));
  head.add(createAdornmentSphere('marthaFluffyHairBack', 0.34, [0, 0.08, -0.18], materials.hairShadow, [1.02, 0.9, 0.72]));
  head.add(createAdornmentSphere('marthaLeftCheek', 0.08, [-0.19, -0.04, 0.53], materials.cheek, [1.25, 0.76, 0.28]));
  head.add(createAdornmentSphere('marthaRightCheek', 0.08, [0.19, -0.04, 0.53], materials.cheek, [1.25, 0.76, 0.28]));
  head.add(createMarthaSmile(materials.smile));

  const body = new THREE.Group();
  body.name = 'marthaCookOutfitDetail';
  body.position.set(0, height * 0.44, 0.31);
  root.add(body);
  body.add(createAdornmentBox('marthaApronPanel', [0.72, 1.24, 0.08], [0, 0, 0], materials.apron));
  body.add(createAdornmentBox('marthaApronTop', [0.52, 0.34, 0.09], [0, 0.72, 0.02], materials.apron));
  body.add(createAdornmentBox('marthaDressLeftHint', [0.16, 1.16, 0.07], [-0.48, -0.1, -0.01], materials.dress, [0, 0, -0.08]));
  body.add(createAdornmentBox('marthaDressRightHint', [0.16, 1.16, 0.07], [0.48, -0.1, -0.01], materials.dress, [0, 0, 0.08]));

  return root;
}

export function shouldApplyMarthaNpcAdornment(model = null, definition = null) {
  const name = String(definition?.name ?? '').toLowerCase();
  return model?.id === 'martha' && name.includes('martha');
}

export function applyNpcCharacterAdornment(root, model = null, definition = null) {
  if (!root || !shouldApplyMarthaNpcAdornment(model, definition)) {
    return null;
  }

  if (root.getObjectByName?.('marthaNpcAdornment')) {
    return root.getObjectByName('marthaNpcAdornment');
  }

  const adornment = createMarthaNpcAdornment(model);
  root.add(adornment);
  return adornment;
}

export function normalizeNpcCharacter(root, targetHeight) {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  root.scale.multiplyScalar(scale);

  const groundedBounds = new THREE.Box3().setFromObject(root);
  root.position.y -= groundedBounds.min.y;
}

export function markNpcRenderable(root) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.castShadow = true;
    node.receiveShadow = true;
  });
}

export function prepareNpcRenderObject(root, model, { enableShadows = true } = {}) {
  if (enableShadows) {
    markNpcRenderable(root);
  }

  normalizeNpcCharacter(root, model.height);
}
