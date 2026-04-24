import * as THREE from 'three';

export const OLYMPIC_BARBELL_LENGTH = 5.6;
export const OLYMPIC_BARBELL_PLATE_RADIUS = 0.78;
export const OLYMPIC_BARBELL_FOOTPRINT = Object.freeze([5.6, 1.7]);
export const VIBE_JAM_PORTAL_FOOTPRINT = Object.freeze([8.4, 5.2]);

const PORTAL_RING_RADIUS = 2.45;
const PORTAL_RING_TUBE_RADIUS = 0.36;
const PORTAL_CENTER_HEIGHT = 3.1;
const PORTAL_BASE_WIDTH = 4.8;
const PORTAL_BASE_DEPTH = 1.6;
const PORTAL_BASE_HEIGHT = 0.48;
const PORTAL_PILLAR_HEIGHT = 5.25;
const PORTAL_PILLAR_WIDTH = 0.48;
const PORTAL_PILLAR_DEPTH = 0.72;
const PORTAL_PILLAR_OFFSET_X = 2.8;
const PORTAL_LABEL_WIDTH = 5.6;
const PORTAL_LABEL_HEIGHT = 1.05;
const PORTAL_LABEL_Y = 6.35;
const PORTAL_ORBITER_RADIUS = 0.12;
const PORTAL_INNER_RADIUS = 2.02;
const PORTAL_TRIGGER_RADIUS = 2.25;
const PORTAL_PROMPT_RADIUS = 6.8;
const PORTAL_SPAWN_LOCAL_OFFSET = Object.freeze([0, -6.2]);

function createMaterial(color, roughness = 0.5, metalness = 0.25) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });
}

function createCylinder(radiusTop, radiusBottom, height, radialSegments, material) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
    material
  );
}

function buildPlateStack(side, material) {
  const group = new THREE.Group();
  const direction = side >= 0 ? 1 : -1;
  const sleeveOffset = (OLYMPIC_BARBELL_LENGTH * 0.5) - 0.55;
  const plateConfigs = [
    { radius: OLYMPIC_BARBELL_PLATE_RADIUS, thickness: 0.15, x: sleeveOffset - 0.31 },
    { radius: 0.64, thickness: 0.11, x: sleeveOffset - 0.17 },
    { radius: 0.52, thickness: 0.08, x: sleeveOffset + 0.02 }
  ];

  for (const config of plateConfigs) {
    const plate = createCylinder(config.radius, config.radius, config.thickness, 24, material);
    plate.rotation.z = Math.PI * 0.5;
    plate.position.set(config.x * direction, 0, 0);
    plate.castShadow = true;
    plate.receiveShadow = true;
    group.add(plate);
  }

  return group;
}

function createPortalGlowMaterial(color, {
  roughness = 0.25,
  metalness = 0.35,
  emissiveIntensity = 1.25
} = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity,
    roughness,
    metalness,
    transparent: true,
    opacity: 0.96
  });
}

function createPortalCoreMaterial(color, opacity = 0.62) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
}

function createPortalLabelTexture(text, fillStyle, strokeStyle) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(7, 11, 18, 0.65)';
  context.strokeStyle = strokeStyle;
  context.lineWidth = 8;
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(24, 28, canvas.width - 48, canvas.height - 56, 42);
    context.fill();
    context.stroke();
  } else {
    context.fillRect(24, 28, canvas.width - 48, canvas.height - 56);
    context.strokeRect(24, 28, canvas.width - 48, canvas.height - 56);
  }

  context.font = '700 82px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = fillStyle;
  context.shadowColor = fillStyle;
  context.shadowBlur = 24;
  context.fillText(text, canvas.width * 0.5, canvas.height * 0.52);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createPortalLabel(text, fillStyle, strokeStyle) {
  const texture = createPortalLabelTexture(text, fillStyle, strokeStyle);
  if (!texture) {
    return new THREE.Group();
  }

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(PORTAL_LABEL_WIDTH, PORTAL_LABEL_HEIGHT),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  label.position.set(0, PORTAL_LABEL_Y, 0);
  return label;
}

function buildPortalBase(root, material, accentMaterial) {
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(PORTAL_BASE_WIDTH, PORTAL_BASE_HEIGHT, PORTAL_BASE_DEPTH),
    material
  );
  base.position.y = PORTAL_BASE_HEIGHT * 0.5;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(PORTAL_BASE_WIDTH + 0.85, 0.14, PORTAL_BASE_DEPTH + 0.45),
    accentMaterial
  );
  lip.position.y = PORTAL_BASE_HEIGHT + 0.07;
  lip.castShadow = true;
  lip.receiveShadow = true;
  root.add(lip);
}

function buildPortalPillars(root, material, accentMaterial, topGeometry) {
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(PORTAL_PILLAR_WIDTH, PORTAL_PILLAR_HEIGHT, PORTAL_PILLAR_DEPTH),
      material
    );
    pillar.position.set(side * PORTAL_PILLAR_OFFSET_X, (PORTAL_PILLAR_HEIGHT * 0.5) + 0.25, 0);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    root.add(pillar);

    const cap = new THREE.Mesh(topGeometry, accentMaterial);
    cap.position.set(side * PORTAL_PILLAR_OFFSET_X, PORTAL_PILLAR_HEIGHT + 0.68, 0);
    cap.rotation.z = side * 0.16;
    cap.castShadow = true;
    cap.receiveShadow = true;
    root.add(cap);
  }
}

function createPortalOrbiter(material) {
  const orbiter = new THREE.Mesh(
    new THREE.SphereGeometry(PORTAL_ORBITER_RADIUS, 14, 14),
    material
  );
  orbiter.castShadow = true;
  orbiter.receiveShadow = true;
  return orbiter;
}

function attachPortalAnimator(root, {
  phaseOffset = 0,
  portalRing = null,
  innerCore = null,
  shimmerRing = null,
  orbiters = []
} = {}) {
  root.userData.onWorldUpdate = (deltaSeconds = 0, timeSeconds = 0) => {
    const pulse = 0.94 + (Math.sin((timeSeconds * 2.15) + phaseOffset) * 0.08);
    if (portalRing) {
      portalRing.rotation.z += deltaSeconds * 0.42;
      portalRing.scale.setScalar(0.98 + (pulse * 0.03));
    }

    if (innerCore?.material) {
      innerCore.material.opacity = 0.48 + (pulse * 0.18);
      innerCore.scale.setScalar(0.98 + (pulse * 0.06));
    }

    if (shimmerRing?.material) {
      shimmerRing.rotation.z -= deltaSeconds * 0.86;
      shimmerRing.material.opacity = 0.25 + (pulse * 0.18);
    }

    orbiters.forEach((orbiter, index) => {
      const angle = (timeSeconds * (0.72 + (index * 0.08))) + phaseOffset + (index * ((Math.PI * 2) / Math.max(1, orbiters.length)));
      const radius = PORTAL_RING_RADIUS + 0.22 + (Math.sin(angle * 1.7) * 0.14);
      orbiter.position.set(
        Math.cos(angle) * radius,
        PORTAL_CENTER_HEIGHT + (Math.sin(angle * 2.2) * 0.62),
        Math.sin(angle * 1.4) * 0.42
      );
      orbiter.scale.setScalar(0.85 + ((Math.sin(angle * 2.8) + 1) * 0.14));
    });
  };
}

function buildPortalVisual({
  labelText,
  ringColor,
  coreColor,
  shellColor,
  accentColor,
  labelFill,
  labelStroke,
  phaseOffset = 0,
  topGeometry
}) {
  const root = new THREE.Group();
  root.name = labelText.replace(/\s+/g, '');

  const shellMaterial = createMaterial(shellColor, 0.5, 0.42);
  const accentMaterial = createPortalGlowMaterial(accentColor, {
    roughness: 0.22,
    metalness: 0.5,
    emissiveIntensity: 1.45
  });
  const ringMaterial = createPortalGlowMaterial(ringColor, {
    roughness: 0.18,
    metalness: 0.58,
    emissiveIntensity: 1.9
  });
  const coreMaterial = createPortalCoreMaterial(coreColor, 0.58);
  const shimmerMaterial = createPortalCoreMaterial(accentColor, 0.34);
  const orbiterMaterial = createPortalGlowMaterial(accentColor, {
    roughness: 0.18,
    metalness: 0.38,
    emissiveIntensity: 1.55
  });

  buildPortalBase(root, shellMaterial, accentMaterial);
  buildPortalPillars(root, shellMaterial, accentMaterial, topGeometry);

  const portalRing = new THREE.Mesh(
    new THREE.TorusGeometry(PORTAL_RING_RADIUS, PORTAL_RING_TUBE_RADIUS, 18, 96),
    ringMaterial
  );
  portalRing.position.y = PORTAL_CENTER_HEIGHT;
  portalRing.castShadow = true;
  portalRing.receiveShadow = true;
  root.add(portalRing);

  const innerCore = new THREE.Mesh(
    new THREE.CircleGeometry(PORTAL_INNER_RADIUS, 48),
    coreMaterial
  );
  innerCore.position.set(0, PORTAL_CENTER_HEIGHT, 0);
  root.add(innerCore);

  const shimmerRing = new THREE.Mesh(
    new THREE.RingGeometry(PORTAL_INNER_RADIUS * 0.4, PORTAL_INNER_RADIUS * 0.92, 5, 1),
    shimmerMaterial
  );
  shimmerRing.position.set(0, PORTAL_CENTER_HEIGHT, 0.02);
  root.add(shimmerRing);

  const orbiters = Array.from({ length: 6 }, () => {
    const orbiter = createPortalOrbiter(orbiterMaterial);
    root.add(orbiter);
    return orbiter;
  });

  const floorHalo = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 2.6, 40),
    createPortalCoreMaterial(accentColor, 0.28)
  );
  floorHalo.rotation.x = -Math.PI / 2;
  floorHalo.position.y = 0.06;
  root.add(floorHalo);

  root.add(createPortalLabel(labelText, labelFill, labelStroke));
  attachPortalAnimator(root, {
    phaseOffset,
    portalRing,
    innerCore,
    shimmerRing,
    orbiters
  });

  return root;
}

export function createOlympicBarbellVisual(options = {}) {
  const { origin = 'ground' } = options;
  const root = new THREE.Group();
  root.name = 'OlympicBarbell';
  const assembly = new THREE.Group();
  assembly.position.y = origin === 'ground' ? OLYMPIC_BARBELL_PLATE_RADIUS : 0;
  root.add(assembly);

  const steelMaterial = createMaterial(0xc2c8d0, 0.28, 0.7);
  const sleeveMaterial = createMaterial(0x949ca8, 0.34, 0.58);
  const plateMaterial = createMaterial(0x15171b, 0.9, 0.08);
  const collarMaterial = createMaterial(0xd48e26, 0.42, 0.52);

  const shaft = createCylinder(0.06, 0.06, OLYMPIC_BARBELL_LENGTH, 24, steelMaterial);
  shaft.rotation.z = Math.PI * 0.5;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  assembly.add(shaft);

  for (const side of [-1, 1]) {
    const sleeve = createCylinder(0.09, 0.09, 0.62, 18, sleeveMaterial);
    sleeve.rotation.z = Math.PI * 0.5;
    sleeve.position.x = side * 2.18;
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    assembly.add(sleeve);

    const collar = createCylinder(0.11, 0.11, 0.08, 18, collarMaterial);
    collar.rotation.z = Math.PI * 0.5;
    collar.position.x = side * 1.78;
    collar.castShadow = true;
    collar.receiveShadow = true;
    assembly.add(collar);

    assembly.add(buildPlateStack(side, plateMaterial));
  }

  return root;
}

export function createVibeJamExitPortalVisual() {
  return buildPortalVisual({
    labelText: 'Vibe Jam Exit',
    ringColor: 0x33f5b1,
    coreColor: 0x0e6e78,
    shellColor: 0x13303a,
    accentColor: 0xf6cf62,
    labelFill: '#9fffe4',
    labelStroke: '#f6cf62',
    phaseOffset: 0.35,
    topGeometry: new THREE.CylinderGeometry(0.34, 0.46, 0.78, 6)
  });
}

export function createVibeJamStartPortalVisual() {
  return buildPortalVisual({
    labelText: 'Vibe Jam Start',
    ringColor: 0x51d8ff,
    coreColor: 0x2a3fd2,
    shellColor: 0x1a223f,
    accentColor: 0xff7e54,
    labelFill: '#d2f5ff',
    labelStroke: '#ff7e54',
    phaseOffset: 1.8,
    topGeometry: new THREE.ConeGeometry(0.46, 0.88, 4)
  });
}

export const VIBE_JAM_PORTAL_INTERACTABLE = Object.freeze({
  radius: PORTAL_PROMPT_RADIUS,
  localOffset: [0, 0],
  portal: {
    triggerRadius: PORTAL_TRIGGER_RADIUS,
    triggerLocalOffset: [0, 0],
    spawnLocalOffset: PORTAL_SPAWN_LOCAL_OFFSET,
    spawnRotationOffsetY: Math.PI
  }
});
