import * as THREE from 'three';

export const OLYMPIC_BARBELL_LENGTH = 5.6;
export const OLYMPIC_BARBELL_PLATE_RADIUS = 0.78;
export const OLYMPIC_BARBELL_FOOTPRINT = Object.freeze([5.6, 1.7]);
export const BASKETBALL_HOOP_FOOTPRINT = Object.freeze([3.6, 3.6]);
export const BASKETBALL_HOOP_RIM_HEIGHT = 7.2;
export const STANDING_DESK_COMPUTER_FOOTPRINT = Object.freeze([4.4, 3]);
export const BLACKJACK_TABLE_FOOTPRINT = Object.freeze([5.8, 4.3]);
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
const PORTAL_TRIGGER_HALF_HEIGHT = 4.5;
const PORTAL_PROMPT_RADIUS = 6.8;
const PORTAL_SPAWN_LOCAL_OFFSET = Object.freeze([0, -6.2]);
const BASKETBALL_HOOP_BACKBOARD_CENTER_Y = BASKETBALL_HOOP_RIM_HEIGHT + 0.9;
const BASKETBALL_HOOP_BACKBOARD_Z = -0.31;
const BASKETBALL_HOOP_POLE_Z = -1.54;

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

function createBox(name, size, position, material, {
  rotation = null,
  castShadow = true,
  receiveShadow = true
} = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    material
  );
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  if (Array.isArray(rotation)) {
    mesh.rotation.set(rotation[0] ?? 0, rotation[1] ?? 0, rotation[2] ?? 0);
  }
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

function createCylinderBetween(name, start, end, radius, material, {
  radialSegments = 14,
  castShadow = true,
  receiveShadow = true
} = {}) {
  const startVector = new THREE.Vector3(start[0], start[1], start[2]);
  const endVector = new THREE.Vector3(end[0], end[1], end[2]);
  const midpoint = startVector.clone().add(endVector).multiplyScalar(0.5);
  const direction = endVector.clone().sub(startVector);
  const length = direction.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, Math.max(length, 0.001), radialSegments),
    material
  );
  mesh.name = name;
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

function createDTableGeometry(width, depth, thickness, {
  bevelSize = 0.04,
  bevelSegments = 3
} = {}) {
  const halfWidth = width * 0.5;
  const halfDepth = depth * 0.5;
  const frontZ = -halfDepth;
  const sideTopZ = halfDepth * 0.16;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, frontZ);
  shape.lineTo(-halfWidth, sideTopZ);
  shape.quadraticCurveTo(-halfWidth * 0.72, halfDepth, 0, halfDepth);
  shape.quadraticCurveTo(halfWidth * 0.72, halfDepth, halfWidth, sideTopZ);
  shape.lineTo(halfWidth, frontZ);
  shape.lineTo(-halfWidth, frontZ);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize,
    bevelThickness: bevelSize,
    bevelSegments
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.center();
  return geometry;
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

function createBackboardLine(name, size, position, material) {
  return createBox(name, size, position, material, {
    castShadow: false,
    receiveShadow: false
  });
}

function addBackboardFrame(root, material) {
  const z = -0.245;
  root.add(createBackboardLine(
    'basketballHoopBackboardTopFrame',
    [3.46, 0.09, 0.08],
    [0, BASKETBALL_HOOP_BACKBOARD_CENTER_Y + 1.27, z],
    material
  ));
  root.add(createBackboardLine(
    'basketballHoopBackboardBottomFrame',
    [3.46, 0.09, 0.08],
    [0, BASKETBALL_HOOP_BACKBOARD_CENTER_Y - 1.27, z],
    material
  ));
  root.add(createBackboardLine(
    'basketballHoopBackboardLeftFrame',
    [0.09, 2.54, 0.08],
    [-1.68, BASKETBALL_HOOP_BACKBOARD_CENTER_Y, z],
    material
  ));
  root.add(createBackboardLine(
    'basketballHoopBackboardRightFrame',
    [0.09, 2.54, 0.08],
    [1.68, BASKETBALL_HOOP_BACKBOARD_CENTER_Y, z],
    material
  ));
}

function addBackboardTarget(root, material) {
  const z = -0.19;
  const targetCenterY = BASKETBALL_HOOP_RIM_HEIGHT + 0.38;
  root.add(createBackboardLine('basketballHoopTargetTop', [1.18, 0.045, 0.035], [0, targetCenterY + 0.34, z], material));
  root.add(createBackboardLine('basketballHoopTargetBottom', [1.18, 0.045, 0.035], [0, targetCenterY - 0.34, z], material));
  root.add(createBackboardLine('basketballHoopTargetLeft', [0.045, 0.72, 0.035], [-0.59, targetCenterY, z], material));
  root.add(createBackboardLine('basketballHoopTargetRight', [0.045, 0.72, 0.035], [0.59, targetCenterY, z], material));
}

function addRimNet(root, rimMaterial, netMaterial) {
  const rimCenter = new THREE.Vector3(0, BASKETBALL_HOOP_RIM_HEIGHT, 0.42);
  const rimRadius = 0.48;
  const lowerRadius = 0.28;
  const lowerY = BASKETBALL_HOOP_RIM_HEIGHT - 0.64;
  const segmentCount = 12;

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(rimRadius, 0.04, 14, 72),
    rimMaterial
  );
  rim.name = 'basketballHoopOrangeRim';
  rim.rotation.x = Math.PI * 0.5;
  rim.position.copy(rimCenter);
  rim.castShadow = true;
  rim.receiveShadow = true;
  root.add(rim);

  const lowerCord = new THREE.Mesh(
    new THREE.TorusGeometry(lowerRadius, 0.012, 6, 48),
    netMaterial
  );
  lowerCord.name = 'basketballHoopNetLowerCord';
  lowerCord.rotation.x = Math.PI * 0.5;
  lowerCord.position.set(rimCenter.x, lowerY, rimCenter.z);
  lowerCord.castShadow = true;
  lowerCord.receiveShadow = true;
  root.add(lowerCord);

  for (let index = 0; index < segmentCount; index += 1) {
    const angle = (index / segmentCount) * Math.PI * 2;
    const nextAngle = ((index + 1) / segmentCount) * Math.PI * 2;
    const upper = [
      rimCenter.x + Math.cos(angle) * rimRadius,
      rimCenter.y - 0.04,
      rimCenter.z + Math.sin(angle) * rimRadius
    ];
    const lower = [
      rimCenter.x + Math.cos(nextAngle) * lowerRadius,
      lowerY,
      rimCenter.z + Math.sin(nextAngle) * lowerRadius
    ];
    const lowerOpposite = [
      rimCenter.x + Math.cos(angle - ((Math.PI * 2) / segmentCount)) * lowerRadius,
      lowerY,
      rimCenter.z + Math.sin(angle - ((Math.PI * 2) / segmentCount)) * lowerRadius
    ];

    root.add(createCylinderBetween(`basketballHoopNetStrand${index + 1}`, upper, lower, 0.011, netMaterial, {
      radialSegments: 5,
      castShadow: false,
      receiveShadow: true
    }));
    root.add(createCylinderBetween(`basketballHoopNetCross${index + 1}`, upper, lowerOpposite, 0.008, netMaterial, {
      radialSegments: 5,
      castShadow: false,
      receiveShadow: true
    }));
  }
}

function addBasketballHoopBolts(root, material) {
  const boltPositions = [
    [-1.38, BASKETBALL_HOOP_BACKBOARD_CENTER_Y + 0.94, -0.17],
    [1.38, BASKETBALL_HOOP_BACKBOARD_CENTER_Y + 0.94, -0.17],
    [-1.38, BASKETBALL_HOOP_BACKBOARD_CENTER_Y - 0.94, -0.17],
    [1.38, BASKETBALL_HOOP_BACKBOARD_CENTER_Y - 0.94, -0.17],
    [-0.34, BASKETBALL_HOOP_RIM_HEIGHT, -0.15],
    [0.34, BASKETBALL_HOOP_RIM_HEIGHT, -0.15]
  ];

  boltPositions.forEach(([x, y, z], index) => {
    const bolt = createCylinder(0.045, 0.045, 0.03, 12, material);
    bolt.name = `basketballHoopBolt${index + 1}`;
    bolt.rotation.x = Math.PI * 0.5;
    bolt.position.set(x, y, z);
    bolt.castShadow = true;
    bolt.receiveShadow = true;
    root.add(bolt);
  });
}

function addBasketball(root, ballMaterial, seamMaterial) {
  const ballCenter = new THREE.Vector3(0.8, 0.24, -0.42);
  const ballRadius = 0.24;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 24, 16),
    ballMaterial
  );
  ball.name = 'basketballHoopBasketball';
  ball.position.copy(ballCenter);
  ball.castShadow = true;
  ball.receiveShadow = true;
  root.add(ball);

  const seamRotations = [
    [0, 0, 0],
    [Math.PI * 0.5, 0, 0],
    [0, Math.PI * 0.5, 0],
    [0.58, 0, 0.34],
    [-0.58, 0, -0.34]
  ];
  seamRotations.forEach((rotation, index) => {
    const seam = new THREE.Mesh(
      new THREE.TorusGeometry(ballRadius * 1.01, 0.006, 5, 48),
      seamMaterial
    );
    seam.name = `basketballHoopBasketballSeam${index + 1}`;
    seam.rotation.set(rotation[0], rotation[1], rotation[2]);
    seam.position.copy(ballCenter);
    seam.castShadow = false;
    seam.receiveShadow = true;
    root.add(seam);
  });
}

export function createBasketballHoopVisual() {
  const root = new THREE.Group();
  root.name = 'BasketballHoop';
  root.userData.footprint = [...BASKETBALL_HOOP_FOOTPRINT];

  const poleMaterial = createMaterial(0x8e98a6, 0.32, 0.62);
  const bracketMaterial = createMaterial(0x39404a, 0.36, 0.58);
  const rimMaterial = createMaterial(0xe46f1f, 0.34, 0.34);
  const netMaterial = createMaterial(0xf3f4f0, 0.84, 0.02);
  const lineMaterial = createMaterial(0xf8fbff, 0.38, 0.04);
  const boltMaterial = createMaterial(0xc4ccd6, 0.28, 0.72);
  const ballMaterial = createMaterial(0xc76823, 0.62, 0.05);
  const ballSeamMaterial = createMaterial(0x19130f, 0.76, 0.02);
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd8f2ff,
    roughness: 0.08,
    metalness: 0.02,
    transmission: 0.2,
    transparent: true,
    opacity: 0.46,
    clearcoat: 0.5,
    clearcoatRoughness: 0.18,
    side: THREE.DoubleSide
  });

  root.add(createCylinderBetween('basketballHoopGroundPole', [0, 0, BASKETBALL_HOOP_POLE_Z], [0, 8.18, BASKETBALL_HOOP_POLE_Z], 0.14, poleMaterial, {
    radialSegments: 22
  }));

  root.add(createCylinderBetween('basketballHoopMainBoom', [0, 7.92, -1.48], [0, 7.78, -0.58], 0.08, poleMaterial, {
    radialSegments: 18
  }));
  root.add(createCylinderBetween('basketballHoopLowerBoom', [0, 7.16, -1.48], [0, 7.1, -0.58], 0.058, bracketMaterial, {
    radialSegments: 14
  }));
  root.add(createCylinderBetween('basketballHoopLeftDiagonalBrace', [0, 7.55, -1.43], [-1.18, 7.62, -0.52], 0.04, bracketMaterial));
  root.add(createCylinderBetween('basketballHoopRightDiagonalBrace', [0, 7.55, -1.43], [1.18, 7.62, -0.52], 0.04, bracketMaterial));
  root.add(createCylinderBetween('basketballHoopCentralBrace', [0, 3.22, BASKETBALL_HOOP_POLE_Z], [0, 7.08, -0.63], 0.046, bracketMaterial));

  const backboard = createBox('basketballHoopTemperedGlassBackboard', [3.3, 2.45, 0.12], [0, BASKETBALL_HOOP_BACKBOARD_CENTER_Y, BASKETBALL_HOOP_BACKBOARD_Z], glassMaterial, {
    castShadow: true,
    receiveShadow: true
  });
  root.add(backboard);
  addBackboardFrame(root, bracketMaterial);
  addBackboardTarget(root, lineMaterial);
  root.add(createBox('basketballHoopRimMountPlate', [0.82, 0.34, 0.1], [0, BASKETBALL_HOOP_RIM_HEIGHT - 0.01, -0.18], bracketMaterial));
  root.add(createCylinderBetween('basketballHoopRimLeftSupport', [-0.22, BASKETBALL_HOOP_RIM_HEIGHT - 0.01, -0.13], [-0.36, BASKETBALL_HOOP_RIM_HEIGHT - 0.01, 0.32], 0.028, rimMaterial, {
    radialSegments: 10
  }));
  root.add(createCylinderBetween('basketballHoopRimRightSupport', [0.22, BASKETBALL_HOOP_RIM_HEIGHT - 0.01, -0.13], [0.36, BASKETBALL_HOOP_RIM_HEIGHT - 0.01, 0.32], 0.028, rimMaterial, {
    radialSegments: 10
  }));

  addRimNet(root, rimMaterial, netMaterial);
  addBasketballHoopBolts(root, boltMaterial);
  addBasketball(root, ballMaterial, ballSeamMaterial);

  return root;
}

export function createStandingDeskComputerVisual() {
  const root = new THREE.Group();
  root.name = 'StandingDeskComputer';
  root.userData.footprint = [...STANDING_DESK_COMPUTER_FOOTPRINT];

  const floorPadMaterial = createMaterial(0x0e1117, 0.86, 0.05);
  const deskTopMaterial = createMaterial(0x6f5238, 0.42, 0.04);
  const deskEdgeMaterial = createMaterial(0x32251b, 0.5, 0.08);
  const legMaterial = createMaterial(0x7a8592, 0.32, 0.55);
  const darkMetalMaterial = createMaterial(0x171c24, 0.44, 0.42);
  const blackPlasticMaterial = createMaterial(0x080b10, 0.58, 0.08);
  const keyMaterial = createMaterial(0xd5dce5, 0.46, 0.04);
  const accentKeyMaterial = createMaterial(0x6cc6ff, 0.35, 0.08);
  const mouseMaterial = createMaterial(0xf2f4f7, 0.36, 0.02);
  const cableMaterial = createMaterial(0x0c0f14, 0.62, 0.1);
  const screenMaterial = new THREE.MeshStandardMaterial({
    color: 0x1bd6e8,
    emissive: new THREE.Color(0x0d9fca),
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.04
  });
  const screenDarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x0e2630,
    emissive: new THREE.Color(0x10394a),
    emissiveIntensity: 0.65,
    roughness: 0.4,
    metalness: 0.02
  });
  const screenWarmMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5c256,
    emissive: new THREE.Color(0xf0a722),
    emissiveIntensity: 0.9,
    roughness: 0.32,
    metalness: 0.04
  });

  const desktopY = 2.55;
  const desktopTopY = desktopY + 0.1;

  root.add(createBox('standingDeskFloorPad', [4.1, 0.05, 2.35], [0, 0.025, 0.05], floorPadMaterial, {
    castShadow: false,
    receiveShadow: true
  }));

  root.add(createBox('standingDeskDesktop', [3.85, 0.2, 1.45], [0, desktopY, 0], deskTopMaterial));
  root.add(createBox('standingDeskFrontEdge', [3.98, 0.18, 0.12], [0, desktopY - 0.01, 0.78], deskEdgeMaterial));
  root.add(createBox('standingDeskBackEdge', [3.98, 0.16, 0.1], [0, desktopY - 0.01, -0.78], deskEdgeMaterial));
  root.add(createBox('standingDeskLeftEdge', [0.12, 0.16, 1.54], [-1.99, desktopY - 0.01, 0], deskEdgeMaterial));
  root.add(createBox('standingDeskRightEdge', [0.12, 0.16, 1.54], [1.99, desktopY - 0.01, 0], deskEdgeMaterial));

  for (const side of [-1, 1]) {
    root.add(createBox(`standingDeskOuterLeg${side < 0 ? 'Left' : 'Right'}`, [0.25, 1.55, 0.24], [side * 1.45, 0.86, 0], legMaterial));
    root.add(createBox(`standingDeskInnerLeg${side < 0 ? 'Left' : 'Right'}`, [0.16, 2.28, 0.16], [side * 1.45, 1.35, 0], legMaterial));
    root.add(createBox(`standingDeskFoot${side < 0 ? 'Left' : 'Right'}`, [0.42, 0.14, 1.7], [side * 1.45, 0.08, 0.06], darkMetalMaterial));
    root.add(createBox(`standingDeskLevelerFront${side < 0 ? 'Left' : 'Right'}`, [0.58, 0.08, 0.22], [side * 1.45, 0.08, 0.88], blackPlasticMaterial));
    root.add(createBox(`standingDeskLevelerBack${side < 0 ? 'Left' : 'Right'}`, [0.58, 0.08, 0.22], [side * 1.45, 0.08, -0.76], blackPlasticMaterial));
  }

  root.add(createBox('standingDeskCrossbar', [3.08, 0.13, 0.14], [0, 2.18, -0.52], darkMetalMaterial));
  root.add(createBox('standingDeskCableTray', [2.55, 0.12, 0.32], [0, 2.36, -0.48], blackPlasticMaterial));

  root.add(createBox('standingDeskMonitorBase', [0.8, 0.08, 0.48], [0, desktopTopY + 0.04, -0.35], darkMetalMaterial));
  root.add(createBox('standingDeskMonitorNeck', [0.14, 0.78, 0.14], [0, desktopTopY + 0.42, -0.43], darkMetalMaterial));
  root.add(createBox('standingDeskMonitor', [1.78, 1.06, 0.15], [0, desktopTopY + 1.03, -0.62], blackPlasticMaterial));
  root.add(createBox('standingDeskScreen', [1.52, 0.82, 0.026], [0, desktopTopY + 1.03, -0.529], screenMaterial, {
    castShadow: false,
    receiveShadow: false
  }));
  root.add(createBox('standingDeskScreenSidebar', [0.24, 0.72, 0.03], [-0.59, desktopTopY + 1.03, -0.505], screenDarkMaterial, {
    castShadow: false,
    receiveShadow: false
  }));
  root.add(createBox('standingDeskScreenTopbar', [1.4, 0.08, 0.032], [0.02, desktopTopY + 1.39, -0.502], screenWarmMaterial, {
    castShadow: false,
    receiveShadow: false
  }));
  for (let index = 0; index < 5; index += 1) {
    const width = 0.74 - (index * 0.08);
    root.add(createBox(
      `standingDeskScreenLine${index + 1}`,
      [width, 0.045, 0.034],
      [0.23 - (index * 0.015), desktopTopY + 1.21 - (index * 0.13), -0.498],
      index % 2 === 0 ? screenWarmMaterial : screenDarkMaterial,
      { castShadow: false, receiveShadow: false }
    ));
  }

  const keyboard = createBox('standingDeskKeyboard', [1.42, 0.08, 0.43], [-0.2, desktopTopY + 0.05, 0.36], blackPlasticMaterial);
  root.add(keyboard);
  for (let row = 0; row < 4; row += 1) {
    const keyCount = row === 3 ? 7 : 10;
    const startX = -0.78 + (row * 0.045);
    const z = 0.22 + (row * 0.09);
    for (let column = 0; column < keyCount; column += 1) {
      const isSpaceRow = row === 3 && column >= 2 && column <= 4;
      const keyWidth = isSpaceRow ? 0.18 : 0.095;
      root.add(createBox(
        `standingDeskKey${row + 1}_${column + 1}`,
        [keyWidth, 0.035, 0.055],
        [startX + (column * 0.14) + (isSpaceRow ? 0.04 : 0), desktopTopY + 0.12, z],
        row === 0 && column >= 7 ? accentKeyMaterial : keyMaterial
      ));
    }
  }

  const mouse = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 18, 12),
    mouseMaterial
  );
  mouse.name = 'standingDeskMouse';
  mouse.scale.set(0.82, 0.24, 1.24);
  mouse.position.set(1.22, desktopTopY + 0.09, 0.35);
  mouse.castShadow = true;
  mouse.receiveShadow = true;
  root.add(mouse);

  const mouseWheel = createCylinder(0.019, 0.019, 0.1, 10, blackPlasticMaterial);
  mouseWheel.name = 'standingDeskMouseWheel';
  mouseWheel.rotation.x = Math.PI * 0.5;
  mouseWheel.position.set(1.22, desktopTopY + 0.155, 0.24);
  mouseWheel.castShadow = true;
  mouseWheel.receiveShadow = true;
  root.add(mouseWheel);

  root.add(createBox('standingDeskMouseSplit', [0.018, 0.025, 0.18], [1.22, desktopTopY + 0.158, 0.24], blackPlasticMaterial));
  root.add(createBox('standingDeskStickyNote', [0.35, 0.018, 0.26], [-1.42, desktopTopY + 0.02, 0.18], screenWarmMaterial, {
    rotation: [0, 0.12, 0],
    castShadow: false,
    receiveShadow: true
  }));

  const cablePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.35, desktopTopY + 0.04, 0.23),
    new THREE.Vector3(-0.32, desktopTopY + 0.025, -0.05),
    new THREE.Vector3(-0.16, desktopTopY + 0.04, -0.33),
    new THREE.Vector3(0, desktopTopY + 0.09, -0.42)
  ]);
  const keyboardCable = new THREE.Mesh(
    new THREE.TubeGeometry(cablePath, 18, 0.018, 6),
    cableMaterial
  );
  keyboardCable.name = 'standingDeskKeyboardCable';
  keyboardCable.castShadow = true;
  keyboardCable.receiveShadow = true;
  root.add(keyboardCable);

  return root;
}

export function createBlackjackTableVisual() {
  const root = new THREE.Group();
  root.name = 'BlackjackTable';
  root.userData.footprint = [...BLACKJACK_TABLE_FOOTPRINT];

  const baseMaterial = createMaterial(0x1b1511, 0.62, 0.12);
  const brassMaterial = createMaterial(0xc49443, 0.32, 0.48);
  const railMaterial = createMaterial(0x4f2b1c, 0.48, 0.08);
  const railTrimMaterial = createMaterial(0xd6aa57, 0.34, 0.34);
  const feltMaterial = new THREE.MeshStandardMaterial({
    color: 0x146b45,
    roughness: 0.86,
    metalness: 0.02
  });
  const feltLineMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8d493,
    roughness: 0.68,
    metalness: 0.02,
    transparent: true,
    opacity: 0.78
  });
  const chipRedMaterial = createMaterial(0xb9233b, 0.42, 0.12);
  const chipBlueMaterial = createMaterial(0x2868c7, 0.38, 0.16);
  const chipWhiteMaterial = createMaterial(0xf5efe1, 0.5, 0.04);
  const cardMaterial = createMaterial(0xf8f1df, 0.44, 0.02);
  const cardRedMaterial = createMaterial(0xb9233b, 0.36, 0.04);
  const cardBlackMaterial = createMaterial(0x101821, 0.42, 0.08);
  const shoeMaterial = createMaterial(0x151c27, 0.46, 0.32);
  const trayMaterial = createMaterial(0x0b1118, 0.5, 0.16);

  root.add(createBox('blackjackTableBasePlate', [4.8, 0.18, 2.9], [0, 0.09, -0.12], baseMaterial));
  root.add(createBox('blackjackTablePedestal', [1.55, 0.92, 1.08], [0, 0.58, -0.1], baseMaterial));
  root.add(createBox('blackjackTablePedestalTrim', [1.78, 0.12, 1.28], [0, 1.08, -0.1], brassMaterial));

  const tabletop = new THREE.Mesh(
    createDTableGeometry(5.7, 4.15, 0.32, { bevelSize: 0.08, bevelSegments: 5 }),
    railMaterial
  );
  tabletop.name = 'blackjackTablePaddedRail';
  tabletop.position.y = 1.24;
  tabletop.castShadow = true;
  tabletop.receiveShadow = true;
  root.add(tabletop);

  const felt = new THREE.Mesh(
    createDTableGeometry(4.75, 3.32, 0.06, { bevelSize: 0.02, bevelSegments: 3 }),
    feltMaterial
  );
  felt.name = 'blackjackTableFelt';
  felt.position.y = 1.46;
  felt.castShadow = true;
  felt.receiveShadow = true;
  root.add(felt);

  const trim = new THREE.Mesh(
    createDTableGeometry(5.92, 4.36, 0.08, { bevelSize: 0.04, bevelSegments: 4 }),
    railTrimMaterial
  );
  trim.name = 'blackjackTableOuterTrim';
  trim.position.y = 1.38;
  trim.castShadow = true;
  trim.receiveShadow = true;
  root.add(trim);

  for (const [index, x] of [-1.55, 0, 1.55].entries()) {
    const betSpot = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.018, 8, 36),
      feltLineMaterial
    );
    betSpot.name = `blackjackTableBettingCircle${index + 1}`;
    betSpot.rotation.x = -Math.PI / 2;
    betSpot.position.set(x, 1.505, 0.52);
    root.add(betSpot);

    const seatLine = createBox(
      `blackjackTablePlayerArc${index + 1}`,
      [0.92, 0.018, 0.045],
      [x, 1.51, 1.14],
      feltLineMaterial,
      { castShadow: false, receiveShadow: false }
    );
    seatLine.rotation.y = (index - 1) * 0.18;
    root.add(seatLine);
  }

  const dealerLine = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.018, 8, 42, Math.PI),
    feltLineMaterial
  );
  dealerLine.name = 'blackjackTableDealerArc';
  dealerLine.rotation.x = -Math.PI / 2;
  dealerLine.rotation.z = Math.PI;
  dealerLine.position.set(0, 1.512, -0.78);
  root.add(dealerLine);

  const chipTray = createBox('blackjackTableChipTray', [1.55, 0.12, 0.42], [-1.48, 1.56, -1.26], trayMaterial);
  root.add(chipTray);
  for (let stackIndex = 0; stackIndex < 4; stackIndex += 1) {
    const material = stackIndex % 3 === 0 ? chipRedMaterial : stackIndex % 3 === 1 ? chipBlueMaterial : chipWhiteMaterial;
    for (let chipIndex = 0; chipIndex < 4; chipIndex += 1) {
      const chip = createCylinder(0.14, 0.14, 0.035, 22, material);
      chip.name = `blackjackTableChipStack${stackIndex + 1}_${chipIndex + 1}`;
      chip.position.set(-2.05 + (stackIndex * 0.32), 1.65 + (chipIndex * 0.036), -1.26);
      chip.castShadow = true;
      chip.receiveShadow = true;
      root.add(chip);
    }
  }

  const shoe = createBox('blackjackTableCardShoe', [0.82, 0.34, 0.58], [1.58, 1.64, -1.22], shoeMaterial, {
    rotation: [0, -0.22, 0]
  });
  root.add(shoe);
  const discardTray = createBox('blackjackTableDiscardTray', [0.72, 0.08, 0.48], [0.74, 1.58, -1.32], trayMaterial, {
    rotation: [0, 0.18, 0]
  });
  root.add(discardTray);

  const cardPositions = [
    [-0.36, -0.8, -0.08],
    [-0.05, -0.76, 0.08],
    [-1.55, 0.18, -0.16],
    [-1.26, 0.2, 0.12],
    [0.0, 0.25, -0.08],
    [0.3, 0.24, 0.1],
    [1.25, 0.18, -0.12],
    [1.54, 0.2, 0.13]
  ];
  cardPositions.forEach(([x, z, rotation], index) => {
    const card = createBox(
      `blackjackTableCard${index + 1}`,
      [0.34, 0.022, 0.48],
      [x, 1.545, z],
      cardMaterial,
      { rotation: [0, rotation, 0], castShadow: false, receiveShadow: true }
    );
    root.add(card);
    root.add(createBox(
      `blackjackTableCardPip${index + 1}`,
      [0.11, 0.024, 0.13],
      [x + 0.02, 1.562, z],
      index % 2 === 0 ? cardRedMaterial : cardBlackMaterial,
      { rotation: [0, rotation, 0], castShadow: false, receiveShadow: false }
    ));
  });

  root.add(createBox('blackjackTableDealerPlaque', [1.08, 0.036, 0.22], [0, 1.555, -1.5], railTrimMaterial, {
    castShadow: false,
    receiveShadow: true
  }));
  root.add(createBox('blackjackTableFeltCenterStripe', [3.7, 0.016, 0.035], [0, 1.512, -0.18], feltLineMaterial, {
    castShadow: false,
    receiveShadow: false
  }));

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
    triggerHalfHeight: PORTAL_TRIGGER_HALF_HEIGHT,
    triggerLocalOffset: [0, 0],
    spawnLocalOffset: PORTAL_SPAWN_LOCAL_OFFSET,
    spawnRotationOffsetY: Math.PI
  }
});
