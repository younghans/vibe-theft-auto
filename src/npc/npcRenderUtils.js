import * as THREE from 'three';

const MARTHA_HAIR_COLOR = 0xf8f4e8;
const MARTHA_HAIR_SHADOW_COLOR = 0xded7c7;
const MARTHA_SKIN_COLOR = 0xf1c9ad;
const MARTHA_CHEEK_COLOR = 0xe08a81;
const MARTHA_WRINKLE_COLOR = 0xb78470;
const MARTHA_GLASSES_COLOR = 0x251b16;

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

function createAdornmentTorus(name, radius, tube, position, material, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 8, 24),
    material
  );
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
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
  root.userData.appearance = 'fat old white lady with extremely fluffy white hair, round glasses, and a big smile';

  const materials = {
    hair: createAdornmentMaterial(MARTHA_HAIR_COLOR, 0.92, 0.01),
    hairShadow: createAdornmentMaterial(MARTHA_HAIR_SHADOW_COLOR, 0.9, 0.01),
    skin: createAdornmentMaterial(MARTHA_SKIN_COLOR, 0.78, 0.02),
    cheek: createAdornmentMaterial(MARTHA_CHEEK_COLOR, 0.74, 0.02),
    smile: createAdornmentMaterial(0x7c2f2b, 0.62, 0.02),
    glasses: createAdornmentMaterial(MARTHA_GLASSES_COLOR, 0.48, 0.05),
    wrinkle: createAdornmentMaterial(MARTHA_WRINKLE_COLOR, 0.82, 0.01),
    apron: createAdornmentMaterial(0xfff4d2, 0.82, 0.02),
    dress: createAdornmentMaterial(0x7b6295, 0.74, 0.04)
  };

  const head = new THREE.Group();
  head.name = 'marthaHeadDetail';
  head.position.set(0, height * 0.79, 0.08);
  root.add(head);

  head.add(createAdornmentSphere('marthaRoundFace', 0.38, [0, 0, 0.24], materials.skin, [0.92, 1.02, 0.54]));
  head.add(createAdornmentSphere('marthaFluffyHairHalo', 0.5, [0, 0.16, 0.04], materials.hair, [1.26, 0.92, 0.84]));
  head.add(createAdornmentSphere('marthaFluffyHairTop', 0.34, [0, 0.52, 0.02], materials.hair, [1.12, 0.9, 1.04]));
  head.add(createAdornmentSphere('marthaFluffyHairCrownLeft', 0.22, [-0.23, 0.58, 0.06], materials.hair, [1.02, 0.88, 0.9]));
  head.add(createAdornmentSphere('marthaFluffyHairCrownRight', 0.22, [0.23, 0.58, 0.06], materials.hair, [1.02, 0.88, 0.9]));
  head.add(createAdornmentSphere('marthaFluffyHairForeheadCenter', 0.18, [0, 0.34, 0.44], materials.hair, [1.22, 0.78, 0.54]));
  head.add(createAdornmentSphere('marthaFluffyHairForeheadLeft', 0.18, [-0.23, 0.3, 0.42], materials.hair, [1.08, 0.82, 0.54]));
  head.add(createAdornmentSphere('marthaFluffyHairForeheadRight', 0.18, [0.23, 0.3, 0.42], materials.hair, [1.08, 0.82, 0.54]));
  head.add(createAdornmentSphere('marthaFluffyHairLeft', 0.34, [-0.42, 0.18, 0.08], materials.hair, [0.92, 1.2, 0.82]));
  head.add(createAdornmentSphere('marthaFluffyHairRight', 0.34, [0.42, 0.18, 0.08], materials.hair, [0.92, 1.2, 0.82]));
  head.add(createAdornmentSphere('marthaFluffyHairOuterLeft', 0.3, [-0.58, 0.19, 0.04], materials.hair, [0.88, 1.08, 0.72]));
  head.add(createAdornmentSphere('marthaFluffyHairOuterRight', 0.3, [0.58, 0.19, 0.04], materials.hair, [0.88, 1.08, 0.72]));
  head.add(createAdornmentSphere('marthaFluffyHairSideLeftLower', 0.22, [-0.5, -0.04, 0.08], materials.hair, [0.88, 0.95, 0.72]));
  head.add(createAdornmentSphere('marthaFluffyHairSideRightLower', 0.22, [0.5, -0.04, 0.08], materials.hair, [0.88, 0.95, 0.72]));
  head.add(createAdornmentSphere('marthaFluffyHairBack', 0.4, [0, 0.08, -0.2], materials.hairShadow, [1.18, 1.02, 0.82]));
  head.add(createAdornmentSphere('marthaSoftDoubleChin', 0.13, [0, -0.32, 0.46], materials.skin, [1.42, 0.48, 0.44]));
  head.add(createAdornmentTorus('marthaLeftGlassesLens', 0.105, 0.014, [-0.15, 0.05, 0.54], materials.glasses, [1.18, 0.86, 1]));
  head.add(createAdornmentTorus('marthaRightGlassesLens', 0.105, 0.014, [0.15, 0.05, 0.54], materials.glasses, [1.18, 0.86, 1]));
  head.add(createAdornmentBox('marthaGlassesBridge', [0.12, 0.025, 0.025], [0, 0.05, 0.54], materials.glasses));
  head.add(createAdornmentBox('marthaLeftGlassesArm', [0.14, 0.025, 0.025], [-0.31, 0.06, 0.47], materials.glasses, [0, -0.42, 0]));
  head.add(createAdornmentBox('marthaRightGlassesArm', [0.14, 0.025, 0.025], [0.31, 0.06, 0.47], materials.glasses, [0, 0.42, 0]));
  head.add(createAdornmentBox('marthaForeheadWrinkle1', [0.28, 0.012, 0.018], [0, 0.2, 0.56], materials.wrinkle));
  head.add(createAdornmentBox('marthaForeheadWrinkle2', [0.22, 0.012, 0.018], [0, 0.15, 0.565], materials.wrinkle));
  head.add(createAdornmentSphere('marthaLeftCheek', 0.08, [-0.19, -0.04, 0.53], materials.cheek, [1.25, 0.76, 0.28]));
  head.add(createAdornmentSphere('marthaRightCheek', 0.08, [0.19, -0.04, 0.53], materials.cheek, [1.25, 0.76, 0.28]));
  head.add(createMarthaSmile(materials.smile));

  const body = new THREE.Group();
  body.name = 'marthaCookOutfitDetail';
  body.position.set(0, height * 0.44, 0.31);
  root.add(body);
  body.add(createAdornmentSphere('marthaWideTorso', 0.58, [0, 0.18, -0.06], materials.dress, [1.46, 1.08, 0.72]));
  body.add(createAdornmentSphere('marthaRoundBelly', 0.62, [0, -0.12, -0.03], materials.dress, [1.46, 1.1, 0.78]));
  body.add(createAdornmentSphere('marthaSoftSideLeft', 0.34, [-0.6, -0.04, -0.02], materials.dress, [0.86, 1.0, 0.66]));
  body.add(createAdornmentSphere('marthaSoftSideRight', 0.34, [0.6, -0.04, -0.02], materials.dress, [0.86, 1.0, 0.66]));
  body.add(createAdornmentSphere('marthaWideHipLeft', 0.34, [-0.5, -0.44, -0.04], materials.dress, [0.98, 0.9, 0.66]));
  body.add(createAdornmentSphere('marthaWideHipRight', 0.34, [0.5, -0.44, -0.04], materials.dress, [0.98, 0.9, 0.66]));
  body.add(createAdornmentSphere('marthaUpperArmLeft', 0.2, [-0.72, 0.26, 0.02], materials.dress, [0.78, 1.48, 0.72]));
  body.add(createAdornmentSphere('marthaUpperArmRight', 0.2, [0.72, 0.26, 0.02], materials.dress, [0.78, 1.48, 0.72]));
  body.add(createAdornmentBox('marthaApronPanel', [0.98, 1.32, 0.08], [0, -0.04, 0.23], materials.apron));
  body.add(createAdornmentSphere('marthaApronBellyCurve', 0.42, [0, -0.16, 0.35], materials.apron, [1.3, 0.94, 0.24]));
  body.add(createAdornmentBox('marthaApronTop', [0.68, 0.36, 0.09], [0, 0.74, 0.25], materials.apron));
  body.add(createAdornmentBox('marthaDressLeftHint', [0.2, 1.16, 0.07], [-0.58, -0.1, -0.01], materials.dress, [0, 0, -0.08]));
  body.add(createAdornmentBox('marthaDressRightHint', [0.2, 1.16, 0.07], [0.58, -0.1, -0.01], materials.dress, [0, 0, 0.08]));

  return root;
}

export function shouldApplyMarthaNpcAdornment(model = null, definition = null) {
  const name = String(definition?.name ?? '').toLowerCase();
  return model?.id === 'martha' && (definition?.marthaEnabled === true || name.includes('martha'));
}

function cloneMarthaStyledMaterial(material, {
  color,
  roughness,
  metalness,
  style,
  clearMap = false
}) {
  const styled = material?.clone ? material.clone() : new THREE.MeshStandardMaterial();
  if (styled.color) {
    styled.color.setHex(color);
  }
  if (Number.isFinite(roughness)) {
    styled.roughness = roughness;
  }
  if (Number.isFinite(metalness)) {
    styled.metalness = metalness;
  }
  if (clearMap) {
    styled.map = null;
  }
  if (Number.isFinite(styled.opacity)) {
    styled.opacity = 1;
  }
  styled.transparent = false;
  styled.depthWrite = true;
  styled.userData = {
    ...styled.userData,
    marthaAppearanceStyle: style
  };
  styled.needsUpdate = true;
  return styled;
}

export function applyMarthaNpcBaseStyle(root, model = null, definition = null) {
  if (!root || !shouldApplyMarthaNpcAdornment(model, definition)) {
    return false;
  }

  let styledAny = false;
  root.traverse?.((node) => {
    if (!node?.isMesh || !node.material) {
      return;
    }

    const nodeName = String(node.name ?? '').toLowerCase();
    const styleMaterial = (material) => {
      const materialName = String(material?.name ?? '').toLowerCase();
      const descriptor = `${nodeName} ${materialName}`;
      if (descriptor.includes('hair') && !descriptor.includes('eyelash')) {
        styledAny = true;
        return cloneMarthaStyledMaterial(material, {
          color: MARTHA_HAIR_COLOR,
          roughness: 0.94,
          metalness: 0.01,
          style: 'whiteHair',
          clearMap: true
        });
      }
      if (nodeName.includes('body')) {
        styledAny = true;
        return cloneMarthaStyledMaterial(material, {
          color: MARTHA_SKIN_COLOR,
          roughness: 0.82,
          metalness: 0.01,
          style: 'paleSkin'
        });
      }
      if (descriptor.includes('eyelash')) {
        styledAny = true;
        return cloneMarthaStyledMaterial(material, {
          color: MARTHA_GLASSES_COLOR,
          roughness: 0.64,
          metalness: 0.02,
          style: 'darkEyelashes'
        });
      }
      return material;
    };

    if (Array.isArray(node.material)) {
      const materials = [];
      for (const material of node.material) {
        materials.push(styleMaterial(material));
      }
      node.material = materials;
    } else {
      node.material = styleMaterial(node.material);
    }
  });

  return styledAny;
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
