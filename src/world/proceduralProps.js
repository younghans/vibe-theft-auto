import * as THREE from 'three';
import { OFFICE_INTERIOR_CEO_MEETING_TABLE } from '../shared/officeInteriorLayout.js';
import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';

export const OLYMPIC_BARBELL_LENGTH = 5.6;
export const OLYMPIC_BARBELL_PLATE_RADIUS = 0.78;
export const OLYMPIC_BARBELL_FOOTPRINT = Object.freeze([5.6, 1.7]);
export const BASKETBALL_HALF_COURT_TILE_FOOTPRINT = Object.freeze([BUILDER_TILE_SIZE, BUILDER_TILE_SIZE]);
export const BASKETBALL_HALF_COURT_TILE_SURFACE_HEIGHT = 0.7;
export const BASKETBALL_HOOP_FOOTPRINT = Object.freeze([3.6, 3.6]);
export const BASKETBALL_HOOP_RIM_HEIGHT = 7.2;
export const STANDING_DESK_COMPUTER_FOOTPRINT = Object.freeze([4.4, 3]);
export const OFFICE_LOBBY_CHAIR_FOOTPRINT = Object.freeze([1.05, 1.05]);
export const OFFICE_LOBBY_TABLE_FOOTPRINT = Object.freeze([3.15, 1.35]);
export const OFFICE_LOBBY_SIDE_TABLE_FOOTPRINT = Object.freeze([1.35, 1.15]);
export const OFFICE_CUBICLE_WORKSTATION_FOOTPRINT = Object.freeze([3.15, 2.35]);
export const OFFICE_CEO_MEETING_TABLE_FOOTPRINT = Object.freeze([
  OFFICE_INTERIOR_CEO_MEETING_TABLE.rugWidth,
  OFFICE_INTERIOR_CEO_MEETING_TABLE.rugDepth
]);
export const INSTRUMENT_CLUSTER_FOOTPRINT = Object.freeze([4.2, 2.75]);
export const BLACKJACK_TABLE_FOOTPRINT = Object.freeze([5.8, 4.3]);
export const VIBE_JAM_PORTAL_FOOTPRINT = Object.freeze([8.4, 5.2]);
export const PISTOL_PICKUP_SPAWN_FOOTPRINT = Object.freeze([2.8, 2.8]);
export const MARTHAS_GRILLE_BUILDING_FOOTPRINT = Object.freeze([BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82]);
export const REAL_ESTATE_OFFICE_BUILDING_FOOTPRINT = Object.freeze([BUILDER_TILE_SIZE * 0.82, BUILDER_TILE_SIZE * 0.82]);

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
const BASKETBALL_HALF_COURT_LINE_RADIUS = 0.035;
const BASKETBALL_HALF_COURT_LINE_HEIGHT = 0.035;
const BASKETBALL_HALF_COURT_TOP_Y = BASKETBALL_HALF_COURT_TILE_SURFACE_HEIGHT + 0.028;
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

function createSphere(name, radius, position, material, {
  scale = [1, 1, 1],
  widthSegments = 24,
  heightSegments = 16,
  castShadow = true,
  receiveShadow = true
} = {}) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, widthSegments, heightSegments),
    material
  );
  mesh.name = name;
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
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

function createFlatLine(name, width, depth, x, z, material) {
  return createBox(
    name,
    [width, BASKETBALL_HALF_COURT_LINE_HEIGHT, depth],
    [x, BASKETBALL_HALF_COURT_TOP_Y, z],
    material,
    { castShadow: false, receiveShadow: true }
  );
}

function createCourtArcLine(name, centerX, centerZ, radius, startAngle, endAngle, material, {
  segments = 48
} = {}) {
  const points = [];

  for (let index = 0; index <= segments; index += 1) {
    const angle = startAngle + ((endAngle - startAngle) * (index / segments));
    points.push(new THREE.Vector3(
      centerX + Math.cos(angle) * radius,
      BASKETBALL_HALF_COURT_TOP_Y,
      centerZ + Math.sin(angle) * radius
    ));
  }

  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      segments,
      BASKETBALL_HALF_COURT_LINE_RADIUS,
      6,
      false
    ),
    material
  );
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function createCourtCircleLine(name, centerX, centerZ, radius, material) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, BASKETBALL_HALF_COURT_LINE_RADIUS, 6, 72),
    material
  );
  mesh.name = name;
  mesh.rotation.x = Math.PI * 0.5;
  mesh.position.set(centerX, BASKETBALL_HALF_COURT_TOP_Y, centerZ);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
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

function createGuitarBodyGeometry(width, height, depth) {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(0, -halfHeight);
  shape.bezierCurveTo(halfWidth * 0.9, -halfHeight * 0.96, halfWidth * 1.05, -halfHeight * 0.36, halfWidth * 0.42, -halfHeight * 0.12);
  shape.bezierCurveTo(halfWidth * 0.78, halfHeight * 0.14, halfWidth * 0.52, halfHeight * 0.78, 0, halfHeight);
  shape.bezierCurveTo(-halfWidth * 0.52, halfHeight * 0.78, -halfWidth * 0.78, halfHeight * 0.14, -halfWidth * 0.42, -halfHeight * 0.12);
  shape.bezierCurveTo(-halfWidth * 1.05, -halfHeight * 0.36, -halfWidth * 0.9, -halfHeight * 0.96, 0, -halfHeight);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.018,
    bevelSegments: 3
  });
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

export function createBasketballHalfCourtTileVisual() {
  const root = new THREE.Group();
  root.name = 'BasketballHalfCourtTile';
  root.userData.footprint = [...BASKETBALL_HALF_COURT_TILE_FOOTPRINT];

  const tileSize = BUILDER_TILE_SIZE;
  const halfTile = tileSize * 0.5;
  const courtEdge = halfTile - 0.28;
  const lineWidth = 0.1;
  const surfaceMaterial = createMaterial(0x2f7a67, 0.92, 0.02);
  const borderMaterial = createMaterial(0x1d413a, 0.94, 0.02);
  const keyPaintMaterial = createMaterial(0xb96a33, 0.88, 0.02);
  const lineMaterial = createMaterial(0xf4f1df, 0.58, 0.02);
  const hoopMarkerMaterial = createMaterial(0xf0a23c, 0.5, 0.04);

  root.add(createBox(
    'basketballCourtHalfSurface',
    [tileSize, BASKETBALL_HALF_COURT_TILE_SURFACE_HEIGHT, tileSize],
    [0, BASKETBALL_HALF_COURT_TILE_SURFACE_HEIGHT * 0.5, 0],
    surfaceMaterial,
    { castShadow: false, receiveShadow: true }
  ));
  root.add(createFlatLine('basketballCourtHalfBackBorder', tileSize, 0.22, 0, -courtEdge, borderMaterial));
  root.add(createFlatLine('basketballCourtHalfLeftBorder', 0.22, tileSize, -courtEdge, 0, borderMaterial));
  root.add(createFlatLine('basketballCourtHalfRightBorder', 0.22, tileSize, courtEdge, 0, borderMaterial));

  const paintDepth = 4.65;
  const paintCenterZ = -courtEdge + (paintDepth * 0.5);
  root.add(createBox(
    'basketballCourtHalfKeyPaint',
    [3.42, 0.018, paintDepth],
    [0, BASKETBALL_HALF_COURT_TOP_Y - 0.018, paintCenterZ],
    keyPaintMaterial,
    { castShadow: false, receiveShadow: true }
  ));

  root.add(createFlatLine('basketballCourtHalfLeftSideline', lineWidth, tileSize - 0.72, -courtEdge + 0.2, 0, lineMaterial));
  root.add(createFlatLine('basketballCourtHalfRightSideline', lineWidth, tileSize - 0.72, courtEdge - 0.2, 0, lineMaterial));
  root.add(createFlatLine('basketballCourtHalfBaseline', tileSize - 0.72, lineWidth, 0, -courtEdge + 0.2, lineMaterial));
  root.add(createFlatLine('basketballCourtHalfCenterLine', tileSize - 0.72, lineWidth, 0, courtEdge - 0.2, lineMaterial));

  const keyLeftX = -1.71;
  const keyRightX = 1.71;
  const freeThrowZ = -2.1;
  const baselineZ = -courtEdge + 0.2;
  const keyCenterZ = (baselineZ + freeThrowZ) * 0.5;
  root.add(createFlatLine('basketballCourtHalfKeyLeftLine', lineWidth, Math.abs(freeThrowZ - baselineZ), keyLeftX, keyCenterZ, lineMaterial));
  root.add(createFlatLine('basketballCourtHalfKeyRightLine', lineWidth, Math.abs(freeThrowZ - baselineZ), keyRightX, keyCenterZ, lineMaterial));
  root.add(createFlatLine('basketballCourtHalfFreeThrowLine', Math.abs(keyRightX - keyLeftX) + lineWidth, lineWidth, 0, freeThrowZ, lineMaterial));
  root.add(createCourtCircleLine('basketballCourtHalfFreeThrowCircle', 0, freeThrowZ, 1.24, lineMaterial));

  const hoopCenterZ = -4.85;
  const threePointRadius = 5.28;
  root.add(createFlatLine('basketballCourtHalfThreePointLeftCorner', lineWidth, 2.92, -5.12, -5.02, lineMaterial));
  root.add(createFlatLine('basketballCourtHalfThreePointRightCorner', lineWidth, 2.92, 5.12, -5.02, lineMaterial));
  root.add(createCourtArcLine(
    'basketballCourtHalfThreePointArc',
    0,
    hoopCenterZ,
    threePointRadius,
    0.25,
    Math.PI - 0.25,
    lineMaterial,
    { segments: 72 }
  ));
  root.add(createCourtArcLine(
    'basketballCourtHalfRestrictedArc',
    0,
    hoopCenterZ,
    0.92,
    0.08,
    Math.PI - 0.08,
    lineMaterial,
    { segments: 28 }
  ));
  root.add(createCourtCircleLine('basketballCourtHalfHoopMarker', 0, hoopCenterZ, 0.22, hoopMarkerMaterial));

  root.add(createCourtArcLine(
    'basketballCourtHalfCenterCircleArc',
    0,
    courtEdge - 0.2,
    1.42,
    Math.PI,
    Math.PI * 2,
    lineMaterial,
    { segments: 38 }
  ));

  for (const side of [-1, 1]) {
    root.add(createFlatLine(`basketballCourtHalfLaneHash${side < 0 ? 'Left' : 'Right'}1`, 0.46, 0.07, side * 2.06, -3.55, lineMaterial));
    root.add(createFlatLine(`basketballCourtHalfLaneHash${side < 0 ? 'Left' : 'Right'}2`, 0.46, 0.07, side * 2.06, -4.28, lineMaterial));
  }

  return root;
}

function createPawnShopMaterials() {
  return {
    slab: createMaterial(0x565d62, 0.9, 0.04),
    pavement: createMaterial(0xd8d1c4, 0.86, 0.02),
    facade: createMaterial(0xb5b8ad, 0.9, 0.03),
    facadeAlt: createMaterial(0x738078, 0.88, 0.04),
    roof: createMaterial(0x4d555c, 0.86, 0.08),
    trim: createMaterial(0xebdfc6, 0.66, 0.06),
    trimDark: createMaterial(0x6c726d, 0.7, 0.12),
    sign: createMaterial(0x26313a, 0.72, 0.08),
    signFace: createMaterial(0xfff1bb, 0.55, 0.08),
    signShadow: createMaterial(0x101820, 0.7, 0.06),
    accent: createMaterial(0xd2a542, 0.5, 0.24),
    accentDark: createMaterial(0x6b4e25, 0.68, 0.1),
    glass: new THREE.MeshStandardMaterial({
      color: 0x648891,
      roughness: 0.18,
      metalness: 0.02,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    }),
    glassLite: new THREE.MeshStandardMaterial({
      color: 0xbde3dd,
      roughness: 0.12,
      metalness: 0.02,
      transparent: true,
      opacity: 0.66,
      depthWrite: false
    }),
    floor: createMaterial(0x5e625f, 0.92, 0.02),
    floorStripe: createMaterial(0x696e69, 0.92, 0.02),
    floorAccent: createMaterial(0x515651, 0.92, 0.02),
    wood: createMaterial(0x9a6b3f, 0.7, 0.04),
    woodDark: createMaterial(0x4f3322, 0.76, 0.04),
    metalDark: createMaterial(0x2d3438, 0.46, 0.42),
    gold: createMaterial(0xd2aa44, 0.38, 0.42),
    screen: createMaterial(0x202b31, 0.36, 0.08)
  };
}

function addPawnBox(group, name, size, position, material, options = {}) {
  group.add(createBox(name, size, position, material, options));
}

function addPawnFloor(group, materials) {
  addPawnBox(group, 'pawnShopFloorBase', [20.6, 0.16, 18.9], [0, 0.72, 0.35], materials.floor);
  const rowDepth = 18.9 / 13;
  for (let row = 0; row < 13; row += 1) {
    const z = 0.35 - (18.9 * 0.5) + (rowDepth * 0.5) + (row * rowDepth);
    addPawnBox(
      group,
      `pawnShopFloorStripe${row + 1}`,
      [20.24, 0.03, Math.max(0.08, rowDepth - 0.08)],
      [0, 0.82, z],
      row % 2 === 0 ? materials.floorStripe : materials.floorAccent,
      { castShadow: false, receiveShadow: true }
    );
  }
}

function createPawnShopSignLabel() {
  const labelRoot = new THREE.Group();
  labelRoot.name = 'pawnShopSignLabel';

  if (typeof document === 'undefined') {
    return labelRoot;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) {
    return labelRoot;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '900 150px Arial Black, Impact, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 18;
  context.strokeStyle = '#111820';
  context.fillStyle = '#fff1bb';
  context.strokeText('PAWN', canvas.width * 0.5, canvas.height * 0.54);
  context.fillText('PAWN', canvas.width * 0.5, canvas.height * 0.54);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(8.8, 2.2),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  label.name = 'pawnShopPawnLetters';
  label.position.set(0, 6.14, 11.31);
  labelRoot.add(label);
  return labelRoot;
}

function addPawnWindow(group, materials, x) {
  addPawnBox(group, `pawnShopFrontWindow${x}`, [1.46, 1.72, 0.1], [x, 2.35, 11.05], materials.glass);
  addPawnBox(group, `pawnShopFrontWindowFrame${x}`, [1.72, 1.96, 0.08], [x, 2.35, 10.98], materials.trim);
  for (const [index, offset] of [-0.42, 0, 0.42].entries()) {
    addPawnBox(
      group,
      `pawnShopWindowSecurityBar${x}_${index}`,
      [0.08, 1.78, 0.14],
      [x + offset, 2.35, 11.14],
      materials.metalDark
    );
  }
}

function addPawnCounterSegment(group, materials, name, {
  position,
  length,
  rotationY = 0,
  glassSide = 1
}) {
  const counter = new THREE.Group();
  counter.name = name;
  counter.position.set(...position);
  counter.rotation.y = rotationY;
  addPawnBox(counter, `${name}Base`, [length, 1.12, 1.02], [0, 0.82, 0], materials.woodDark);
  addPawnBox(counter, `${name}Top`, [length + 0.28, 0.26, 1.34], [0, 1.48, 0], materials.wood);
  addPawnBox(counter, `${name}Glass`, [length - 0.56, 0.58, 0.12], [0, 1.94, glassSide * 0.58], materials.glassLite);
  addPawnBox(counter, `${name}GlassCap`, [length - 0.34, 0.08, 0.18], [0, 2.28, glassSide * 0.58], materials.metalDark);
  group.add(counter);
}

function addPawnDisplayObject(group, materials, name, position, variant) {
  const item = new THREE.Group();
  item.name = name;
  item.position.set(...position);

  if (variant === 'guitar') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), materials.accentDark);
    body.name = `${name}Body`;
    body.scale.set(0.82, 1.08, 0.26);
    body.position.set(0, 0.42, 0);
    item.add(body);
    const neck = createCylinder(0.05, 0.06, 1.16, 8, materials.woodDark);
    neck.name = `${name}Neck`;
    neck.position.set(0, 1.05, 0);
    neck.rotation.z = -0.2;
    item.add(neck);
    addPawnBox(item, `${name}Head`, [0.42, 0.08, 0.06], [0, 1.66, 0], materials.metalDark, {
      rotation: [0, 0, -0.2]
    });
  } else if (variant === 'watch') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 12), materials.gold);
    ring.name = `${name}Ring`;
    ring.rotation.x = Math.PI * 0.5;
    ring.position.set(0, 0.56, 0);
    item.add(ring);
    const face = createCylinder(0.16, 0.16, 0.08, 14, materials.signFace);
    face.name = `${name}Face`;
    face.rotation.x = Math.PI * 0.5;
    face.position.set(0, 0.56, 0.02);
    item.add(face);
  } else {
    addPawnBox(item, `${name}Screen`, [0.76, 0.48, 0.12], [0, 0.64, 0], materials.screen);
    addPawnBox(item, `${name}Base`, [0.9, 0.1, 0.18], [0, 0.34, 0.04], materials.metalDark);
  }

  group.add(item);
}

export function createPawnShopBuildingVisual() {
  const root = new THREE.Group();
  root.name = 'pawn_building';
  root.userData.footprint = [BUILDER_TILE_SIZE * 0.82 * 2, BUILDER_TILE_SIZE * 0.82 * 2];
  const materials = createPawnShopMaterials();

  const foundation = new THREE.Group();
  foundation.name = 'pawn_foundation';
  root.add(foundation);
  addPawnBox(foundation, 'pawnShopSlab', [22.8, 0.62, 22.6], [0, 0.31, 0], materials.slab);
  addPawnBox(foundation, 'pawnShopFrontPavement', [18.8, 0.16, 2.6], [0, 0.68, 10], materials.pavement);
  addPawnBox(foundation, 'pawnShopDoorStep', [7.2, 0.18, 1.2], [0, 0.74, 11.1], materials.trimDark);

  const interior = new THREE.Group();
  interior.name = 'pawn_interior';
  root.add(interior);
  addPawnFloor(interior, materials);

  const shell = new THREE.Group();
  shell.name = 'pawn_hull_wall';
  root.add(shell);
  const shellBack = new THREE.Group();
  shellBack.name = 'pawn_hull_wall_back';
  const shellLeft = new THREE.Group();
  shellLeft.name = 'pawn_hull_wall_left';
  const shellRight = new THREE.Group();
  shellRight.name = 'pawn_hull_wall_right';
  const shellFront = new THREE.Group();
  shellFront.name = 'pawn_hull_wall_front';
  shell.add(shellBack, shellLeft, shellRight, shellFront);
  addPawnBox(shellBack, 'pawnShopBackWall', [21.7, 7.45, 0.36], [0, 4.3, -10.1], materials.facade);
  addPawnBox(shellLeft, 'pawnShopLeftWall', [0.36, 7.45, 20.9], [-10.67, 4.3, 0.35], materials.facade);
  addPawnBox(shellRight, 'pawnShopRightWall', [0.36, 7.45, 20.9], [10.67, 4.3, 0.35], materials.facade);
  addPawnBox(shellFront, 'pawnShopFrontWallLeft', [7.5, 7.45, 0.36], [-7.1, 4.3, 10.8], materials.facade);
  addPawnBox(shellFront, 'pawnShopFrontWallRight', [7.5, 7.45, 0.36], [7.1, 4.3, 10.8], materials.facade);
  addPawnBox(shellFront, 'pawnShopDoorHeader', [6.7, 3.9, 0.36], [0, 5.58, 10.8], materials.facade);

  const roof = new THREE.Group();
  roof.name = 'pawn_cutaway_roof';
  root.add(roof);
  addPawnBox(roof, 'pawnShopMainRoof', [21.7, 0.36, 20.9], [0, 7.85, 0.35], materials.roof);
  addPawnBox(roof, 'pawnShopFrontParapet', [21.3, 0.34, 0.2], [0, 8.21, 10.5], materials.trim);
  addPawnBox(roof, 'pawnShopBackParapet', [21.3, 0.34, 0.2], [0, 8.21, -9.8], materials.trim);
  addPawnBox(roof, 'pawnShopLeftParapet', [0.2, 0.34, 20.5], [-10.55, 8.21, 0.35], materials.trim);
  addPawnBox(roof, 'pawnShopRightParapet', [0.2, 0.34, 20.5], [10.55, 8.21, 0.35], materials.trim);

  const upper = new THREE.Group();
  upper.name = 'pawn_cutaway_upper';
  root.add(upper);
  addPawnBox(upper, 'pawnShopUpperBlock', [12.8, 4.3, 7.2], [0, 9.75, -2.9], materials.facadeAlt);
  addPawnBox(upper, 'pawnShopUpperRoof', [13.2, 0.32, 7.6], [0, 12.08, -2.9], materials.roof);

  const exterior = new THREE.Group();
  exterior.name = 'pawn_exterior_detail';
  root.add(exterior);
  addPawnBox(exterior, 'pawnShopEntranceSignPanel', [14.4, 2.25, 0.48], [0, 6.12, 11.04], materials.sign);
  exterior.add(createPawnShopSignLabel());
  addPawnBox(exterior, 'pawnShopGoldAwning', [9.0, 0.38, 2.28], [0, 4.36, 10.68], materials.accent, {
    rotation: [0.18, 0, 0]
  });
  addPawnBox(exterior, 'pawnShopFrontBand', [21.4, 0.28, 0.22], [0, 7.66, 10.84], materials.trim);
  addPawnBox(exterior, 'pawnShopLowerBand', [21.0, 0.2, 0.24], [0, 4.18, 10.98], materials.accentDark);
  for (const x of [-7.6, -5.25, 5.25, 7.6]) {
    addPawnWindow(exterior, materials, x);
  }

  const medallion = createCylinder(0.76, 0.76, 0.18, 24, materials.gold);
  medallion.name = 'pawnShopGoldMedallion';
  medallion.rotation.x = Math.PI * 0.5;
  medallion.position.set(7.25, 6.15, 11.32);
  exterior.add(medallion);

  addPawnBox(interior, 'pawnShopBackShelfPanel', [15.8, 2.15, 0.16], [0, 2.58, -9.12], materials.facadeAlt);
  for (const [index, y] of [1.86, 2.56, 3.26].entries()) {
    addPawnBox(interior, `pawnShopBackShelf${index + 1}`, [15.2, 0.16, 0.46], [0, y, -8.82], materials.woodDark);
  }
  addPawnBox(interior, 'pawnShopShelfGoldRail', [15.6, 0.12, 0.18], [0, 3.82, -8.72], materials.gold);
  addPawnCounterSegment(interior, materials, 'pawnShopBackCounter', {
    position: [0, 0, -7.2],
    length: 15.8
  });
  addPawnCounterSegment(interior, materials, 'pawnShopLeftCounterReturn', {
    position: [-7.55, 0, -4.1],
    length: 6.4,
    rotationY: Math.PI * 0.5,
    glassSide: -1
  });
  addPawnCounterSegment(interior, materials, 'pawnShopRightCounterReturn', {
    position: [7.55, 0, -4.1],
    length: 6.4,
    rotationY: -Math.PI * 0.5,
    glassSide: -1
  });

  for (const [index, x] of [-6.3, -4.2, -2.1, 0, 2.1, 4.2, 6.3].entries()) {
    addPawnDisplayObject(interior, materials, `pawnShopShelfItem${index + 1}`, [x, 1.56, -8.36], index % 2 === 0 ? 'watch' : 'screen');
  }
  for (const [index, entry] of [
    [-6.4, -6.56, 'watch'],
    [-3.2, -6.56, 'screen'],
    [0, -6.56, 'watch'],
    [3.2, -6.56, 'screen'],
    [6.4, -6.56, 'watch'],
    [-7.55, -4.35, 'guitar'],
    [7.55, -4.35, 'guitar']
  ].entries()) {
    addPawnDisplayObject(interior, materials, `pawnShopCaseItem${index + 1}`, [entry[0], 1.52, entry[1]], entry[2]);
  }

  return root;
}

function addMarthasGrilleBox(group, name, size, position, material, options = {}) {
  group.add(createBox(name, size, position, material, options));
}

function createMarthasGrillePavilionRoof(materials) {
  const roof = new THREE.Group();
  roof.name = 'marthasGrillePavilionRoof';

  const halfWidth = 5.48;
  const halfDepth = 5.44;
  const eaveY = 6.62;
  const apexY = 8.08;
  const roofGeometry = new THREE.BufferGeometry();
  roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -halfWidth, eaveY, halfDepth,
    halfWidth, eaveY, halfDepth,
    0, apexY, 0,

    halfWidth, eaveY, halfDepth,
    halfWidth, eaveY, -halfDepth,
    0, apexY, 0,

    halfWidth, eaveY, -halfDepth,
    -halfWidth, eaveY, -halfDepth,
    0, apexY, 0,

    -halfWidth, eaveY, -halfDepth,
    -halfWidth, eaveY, halfDepth,
    0, apexY, 0
  ], 3));
  roofGeometry.computeVertexNormals();
  const roofMesh = new THREE.Mesh(roofGeometry, materials.roof);
  roofMesh.name = 'marthasGrillePavilionRoofHip';
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  roof.add(roofMesh);

  addMarthasGrilleBox(roof, 'marthasGrillePavilionFrontFascia', [10.98, 0.24, 0.28], [0, eaveY - 0.04, halfDepth], materials.roofTrim);
  addMarthasGrilleBox(roof, 'marthasGrillePavilionBackFascia', [10.98, 0.24, 0.28], [0, eaveY - 0.04, -halfDepth], materials.roofTrim);
  addMarthasGrilleBox(roof, 'marthasGrillePavilionLeftFascia', [0.28, 0.24, 10.88], [-halfWidth, eaveY - 0.04, 0], materials.roofTrim);
  addMarthasGrilleBox(roof, 'marthasGrillePavilionRightFascia', [0.28, 0.24, 10.88], [halfWidth, eaveY - 0.04, 0], materials.roofTrim);
  addMarthasGrilleBox(roof, 'marthasGrillePavilionApexCap', [0.72, 0.18, 0.72], [0, apexY + 0.03, 0], materials.roofTrim, {
    rotation: [0, Math.PI * 0.25, 0]
  });

  for (const [name, x, z] of [
    ['FrontLeft', -4.98, 4.72],
    ['FrontRight', 4.98, 4.72],
    ['BackLeft', -4.98, -4.72],
    ['BackRight', 4.98, -4.72]
  ]) {
    addMarthasGrilleBox(
      roof,
      `marthasGrillePavilionPost${name}`,
      [0.28, 5.62, 0.28],
      [x, 3.62, z],
      materials.post
    );
  }

  return roof;
}

function addMarthasGrilleWindow(group, materials, name, {
  position,
  side = 'front',
  size = [1.44, 1.24]
}) {
  const [width, height] = size;
  if (side === 'left' || side === 'right') {
    const xDepth = 0.08;
    const zWidth = width;
    addMarthasGrilleBox(group, `${name}Frame`, [xDepth, height + 0.24, zWidth + 0.24], position, materials.windowFrame);
    addMarthasGrilleBox(group, name, [xDepth + 0.03, height, zWidth], [position[0] + (side === 'left' ? -0.03 : 0.03), position[1], position[2]], materials.windowGlass);
    addMarthasGrilleBox(group, `${name}CrossbarVertical`, [xDepth + 0.05, height + 0.06, 0.06], [position[0] + (side === 'left' ? -0.05 : 0.05), position[1], position[2]], materials.windowMuntin);
    addMarthasGrilleBox(group, `${name}CrossbarHorizontal`, [xDepth + 0.05, 0.06, zWidth + 0.04], [position[0] + (side === 'left' ? -0.05 : 0.05), position[1], position[2]], materials.windowMuntin);
    return;
  }

  const zDepth = 0.08;
  const z = position[2] + (side === 'back' ? -0.03 : 0.03);
  addMarthasGrilleBox(group, `${name}Frame`, [width + 0.24, height + 0.24, zDepth], position, materials.windowFrame);
  addMarthasGrilleBox(group, name, [width, height, zDepth + 0.03], [position[0], position[1], z], materials.windowGlass);
  addMarthasGrilleBox(group, `${name}CrossbarVertical`, [0.06, height + 0.06, zDepth + 0.05], [position[0], position[1], z], materials.windowMuntin);
  addMarthasGrilleBox(group, `${name}CrossbarHorizontal`, [width + 0.04, 0.06, zDepth + 0.05], [position[0], position[1], z], materials.windowMuntin);
}

function createMarthasGrilleSignLabel() {
  const geometry = new THREE.PlaneGeometry(6.78, 1.28);
  let material;

  if (typeof document === 'undefined') {
    material = new THREE.MeshBasicMaterial({
      color: 0x2a1715,
      side: THREE.DoubleSide
    });
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#2a1715';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.lineWidth = 18;
      context.strokeStyle = '#f8e7bd';
      context.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);
      context.font = '900 104px Arial Black, Impact, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.lineWidth = 12;
      context.strokeStyle = '#180d0b';
      context.fillStyle = '#ffe9a8';
      context.strokeText("MARTHA'S GRILLE", canvas.width * 0.5, canvas.height * 0.55);
      context.fillText("MARTHA'S GRILLE", canvas.width * 0.5, canvas.height * 0.55);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide
    });
  }

  const label = new THREE.Mesh(geometry, material);
  label.name = 'marthasGrilleSignLabel';
  label.castShadow = false;
  label.receiveShadow = false;
  return label;
}

function addMarthasGrillePlateStack(group, materials, x, z, stackIndex) {
  for (let index = 0; index < 4; index += 1) {
    const plate = createCylinder(0.24, 0.24, 0.035, 20, materials.plate);
    plate.name = `marthasGrillePlateStack${stackIndex}_${index + 1}`;
    plate.position.set(x, 2.2 + (index * 0.04), z);
    plate.castShadow = true;
    plate.receiveShadow = true;
    group.add(plate);
  }
}

function addMarthasGrilleKitchenDetails(root, materials) {
  const kitchen = new THREE.Group();
  kitchen.name = 'marthas_grille_kitchen_detail';
  root.add(kitchen);

  addMarthasGrilleBox(kitchen, 'marthasGrilleKitchenBacksplash', [9.55, 1.18, 0.1], [0, 1.62, -4.91], materials.tile);
  for (const [index, x] of [-4.15, -2.85, -1.55, -0.25, 1.05, 2.35, 3.65].entries()) {
    addMarthasGrilleBox(
      kitchen,
      `marthasGrilleBacksplashTileLine${index + 1}`,
      [0.04, 1.14, 0.04],
      [x, 1.64, -4.84],
      materials.grout,
      { castShadow: false, receiveShadow: true }
    );
  }
  for (const [index, y] of [1.23, 1.62, 2.01].entries()) {
    addMarthasGrilleBox(
      kitchen,
      `marthasGrilleBacksplashRowLine${index + 1}`,
      [9.4, 0.035, 0.04],
      [0, y, -4.83],
      materials.grout,
      { castShadow: false, receiveShadow: true }
    );
  }

  addMarthasGrilleBox(kitchen, 'marthasGrillePrepCounter', [2.55, 0.78, 1.02], [-3.85, 1.18, -2.55], materials.counter);
  addMarthasGrilleBox(kitchen, 'marthasGrilleCuttingBoard', [1.32, 0.08, 0.64], [-3.92, 1.62, -2.43], materials.board);
  addMarthasGrilleBox(kitchen, 'marthasGrilleLettuceBin', [0.48, 0.16, 0.36], [-4.55, 1.76, -2.34], materials.green);
  addMarthasGrilleBox(kitchen, 'marthasGrilleTomatoBin', [0.48, 0.16, 0.36], [-3.92, 1.76, -2.34], materials.tomato);
  addMarthasGrilleBox(kitchen, 'marthasGrilleBunTray', [0.54, 0.12, 0.38], [-3.28, 1.72, -2.34], materials.bun);

  for (const [index, x] of [-2.45, -1.85, -1.25, -0.65].entries()) {
    addMarthasGrilleBox(
      kitchen,
      `marthasGrilleFlatTopHeatZone${index + 1}`,
      [0.46, 0.055, 0.86],
      [x, 1.63, -3.92],
      materials.dark,
      { castShadow: false, receiveShadow: true }
    );
  }
  for (const [index, [x, z]] of [[-2.05, -4.18], [-1.5, -3.86], [-0.92, -4.08]].entries()) {
    const patty = createCylinder(0.19, 0.2, 0.08, 18, materials.patty);
    patty.name = `marthasGrilleBurgerPatty${index + 1}`;
    patty.position.set(x, 1.72, z);
    patty.castShadow = true;
    patty.receiveShadow = true;
    kitchen.add(patty);
  }

  addMarthasGrilleBox(kitchen, 'marthasGrilleFryerBody', [1.05, 0.86, 1.12], [2.08, 1.27, -3.88], materials.steel);
  addMarthasGrilleBox(kitchen, 'marthasGrilleFryerBasketLeft', [0.4, 0.12, 0.48], [1.82, 1.78, -3.88], materials.basket);
  addMarthasGrilleBox(kitchen, 'marthasGrilleFryerBasketRight', [0.4, 0.12, 0.48], [2.34, 1.78, -3.88], materials.basket);
  addMarthasGrilleBox(kitchen, 'marthasGrilleFryerOilGlow', [0.82, 0.035, 0.74], [2.08, 1.82, -3.88], materials.oil, {
    castShadow: false,
    receiveShadow: false
  });

  addMarthasGrilleBox(kitchen, 'marthasGrilleUprightCooler', [1.14, 2.32, 0.82], [4.1, 1.98, -4.28], materials.cooler);
  addMarthasGrilleBox(kitchen, 'marthasGrilleCoolerDoorInset', [0.82, 1.64, 0.06], [4.1, 2.04, -3.83], materials.coolerInset);
  addMarthasGrilleBox(kitchen, 'marthasGrilleCoolerHandle', [0.08, 0.82, 0.08], [4.52, 2.04, -3.74], materials.steel);

  addMarthasGrilleBox(kitchen, 'marthasGrilleOverheadShelf', [8.25, 0.16, 0.42], [0, 2.78, -4.55], materials.steel);
  addMarthasGrilleBox(kitchen, 'marthasGrilleHangingUtensilRail', [5.8, 0.07, 0.08], [0, 2.42, -4.38], materials.dark);
  for (const [index, x] of [-2.05, -1.35, -0.65, 0.65, 1.35, 2.05].entries()) {
    addMarthasGrilleBox(
      kitchen,
      `marthasGrilleHangingUtensil${index + 1}`,
      [0.08, 0.52, 0.045],
      [x, 2.13, -4.35],
      index % 2 === 0 ? materials.steel : materials.dark
    );
  }
  addMarthasGrillePlateStack(kitchen, materials, -3.35, -4.5, 1);
  addMarthasGrillePlateStack(kitchen, materials, 3.08, -4.5, 2);

  addMarthasGrilleBox(kitchen, 'marthasGrilleServingShelf', [7.55, 0.16, 0.46], [0, 2.42, 0.22], materials.steel);
  addMarthasGrilleBox(kitchen, 'marthasGrilleTicketRail', [3.2, 0.08, 0.08], [0.4, 2.72, 0.48], materials.dark);
  for (const [index, x] of [-0.78, -0.26, 0.26, 0.78, 1.3].entries()) {
    addMarthasGrilleBox(
      kitchen,
      `marthasGrilleOrderTicket${index + 1}`,
      [0.32, 0.42, 0.035],
      [x, 2.5, 0.53],
      materials.ticket,
      { castShadow: false, receiveShadow: false }
    );
  }
  for (const [index, x] of [-2.7, -2.35, 2.35, 2.7].entries()) {
    addMarthasGrilleBox(
      kitchen,
      `marthasGrilleHeatLamp${index + 1}`,
      [0.16, 0.26, 0.16],
      [x, 2.28, 0.25],
      materials.heatLamp
    );
  }
}

export function createMarthasGrilleBuildingVisual() {
  const root = new THREE.Group();
  root.name = 'marthas_grille_building';
  root.userData.footprint = [...MARTHAS_GRILLE_BUILDING_FOOTPRINT];

  const slab = createMaterial(0x555b5f, 0.9, 0.04);
  const floor = createMaterial(0x6a6255, 0.92, 0.02);
  const wall = createMaterial(0xf2dc9d, 0.86, 0.03);
  const wallTrim = createMaterial(0xffefbf, 0.7, 0.04);
  const roofMat = createMaterial(0x3e474d, 0.86, 0.08);
  const roofTrim = createMaterial(0x2f363a, 0.78, 0.1);
  const trimDark = createMaterial(0x5f3a2a, 0.7, 0.08);
  const sign = createMaterial(0x2a1715, 0.72, 0.08);
  const awning = createMaterial(0xd65142, 0.58, 0.08);
  const counter = createMaterial(0x6f3f2f, 0.72, 0.04);
  const counterTop = createMaterial(0xd0b681, 0.58, 0.08);
  const steel = createMaterial(0xb8bec2, 0.28, 0.58);
  const dark = createMaterial(0x242b30, 0.44, 0.26);
  const screen = createMaterial(0x16343a, 0.3, 0.06);
  const windowFrame = createMaterial(0xffefbf, 0.58, 0.05);
  const windowGlass = createMaterial(0x3f4a41, 0.34, 0.04);
  const windowMuntin = createMaterial(0x5f3a2a, 0.66, 0.08);
  const post = createMaterial(0x6b432f, 0.72, 0.08);
  const kitchenMaterials = {
    tile: createMaterial(0xf3ead7, 0.88, 0.02),
    grout: createMaterial(0x9a8f7e, 0.9, 0.01),
    counter,
    board: createMaterial(0xd7b06d, 0.64, 0.02),
    green: createMaterial(0x4e8d48, 0.86, 0.02),
    tomato: createMaterial(0xb83e32, 0.8, 0.03),
    bun: createMaterial(0xd79a53, 0.76, 0.03),
    dark,
    patty: createMaterial(0x4c2a1e, 0.82, 0.02),
    steel,
    basket: createMaterial(0x8c7862, 0.42, 0.36),
    oil: createMaterial(0x8d5d1f, 0.36, 0.18),
    cooler: createMaterial(0xd4d8d8, 0.4, 0.32),
    coolerInset: createMaterial(0x35434a, 0.34, 0.08),
    plate: createMaterial(0xf8f1df, 0.48, 0.02),
    ticket: createMaterial(0xfff1bf, 0.82, 0.01),
    heatLamp: createMaterial(0xdc6c3a, 0.34, 0.18)
  };

  addMarthasGrilleBox(root, 'mgSlab', [11.32, 0.62, 11.3], [0, 0.31, 0], slab);
  addMarthasGrilleBox(root, 'marthasGrilleDiningFloor', [10.32, 0.14, 10.1], [0, 0.72, -0.12], floor);
  addMarthasGrilleBox(root, 'marthasGrilleCounterBase', [8.7, 1.18, 1.08], [0, 1.28, 1.05], counter);
  addMarthasGrilleBox(root, 'mgCounterTop', [9.05, 0.24, 1.36], [0, 2.0, 1.05], counterTop);
  addMarthasGrilleBox(root, 'mgRegisterBase', [0.72, 0.34, 0.54], [2.9, 2.28, 1.24], dark);
  addMarthasGrilleBox(root, 'marthasGrilleRegisterScreen', [0.56, 0.36, 0.08], [2.9, 2.56, 0.93], screen, { rotation: [-0.18, 0, 0] });
  addMarthasGrilleBox(root, 'marthasGrilleFlatTopGrill', [3.1, 0.74, 1.28], [-1.55, 1.22, -3.92], steel);
  addMarthasGrilleBox(root, 'mgRangeHood', [3.5, 0.42, 1.45], [-1.55, 3.1, -3.92], dark);
  addMarthasGrilleKitchenDetails(root, kitchenMaterials);

  const shell = new THREE.Group();
  shell.name = 'marthas_grille_hull_wall';
  root.add(shell);
  const shellBack = new THREE.Group();
  shellBack.name = 'marthas_grille_hull_wall_back';
  const shellLeft = new THREE.Group();
  shellLeft.name = 'marthas_grille_hull_wall_left';
  const shellRight = new THREE.Group();
  shellRight.name = 'marthas_grille_hull_wall_right';
  const shellFront = new THREE.Group();
  shellFront.name = 'marthas_grille_hull_wall_front';
  shell.add(shellBack, shellLeft, shellRight, shellFront);
  addMarthasGrilleBox(shellBack, 'mgBackWall', [10.65, 6.24, 0.34], [0, 3.8, -5.14], wall);
  addMarthasGrilleBox(shellLeft, 'mgLeftWall', [0.34, 6.24, 10.15], [-5.15, 3.8, -0.1], wall);
  addMarthasGrilleBox(shellRight, 'mgRightWall', [0.34, 6.24, 10.15], [5.15, 3.8, -0.1], wall);
  addMarthasGrilleBox(shellFront, 'mgFrontLeft', [2.38, 4.86, 0.34], [-4.05, 3.09, 5.03], wall);
  addMarthasGrilleBox(shellFront, 'mgFrontRight', [2.38, 4.86, 0.34], [4.05, 3.09, 5.03], wall);
  addMarthasGrilleBox(shellFront, 'mgFrontHeader', [10.58, 1.48, 0.36], [0, 5.52, 5.03], wall);
  addMarthasGrilleBox(shellFront, 'marthasGrilleCreamFacadeBand', [10.42, 0.24, 0.42], [0, 4.68, 5.12], wallTrim);
  addMarthasGrilleBox(shellFront, 'marthasGrilleLeftCreamKickTrim', [2.22, 0.2, 0.42], [-4.05, 1.05, 5.15], wallTrim);
  addMarthasGrilleBox(shellFront, 'marthasGrilleRightCreamKickTrim', [2.22, 0.2, 0.42], [4.05, 1.05, 5.15], wallTrim);
  addMarthasGrilleWindow(shellFront, { windowFrame, windowGlass, windowMuntin }, 'marthasGrilleFrontLeftWindow', {
    position: [-4.05, 3.1, 5.22],
    side: 'front',
    size: [1.18, 1.42]
  });
  addMarthasGrilleWindow(shellFront, { windowFrame, windowGlass, windowMuntin }, 'marthasGrilleFrontRightWindow', {
    position: [4.05, 3.1, 5.22],
    side: 'front',
    size: [1.18, 1.42]
  });
  for (const [index, x] of [-3.2, 0, 3.2].entries()) {
    addMarthasGrilleWindow(shellBack, { windowFrame, windowGlass, windowMuntin }, `marthasGrilleBackWindow${index + 1}`, {
      position: [x, 3.55, -5.34],
      side: 'back',
      size: [1.32, 1.28]
    });
  }
  for (const [index, z] of [-3.2, -0.55, 2.1].entries()) {
    addMarthasGrilleWindow(shellLeft, { windowFrame, windowGlass, windowMuntin }, `marthasGrilleLeftWindow${index + 1}`, {
      position: [-5.34, 3.58, z],
      side: 'left',
      size: [1.22, 1.26]
    });
    addMarthasGrilleWindow(shellRight, { windowFrame, windowGlass, windowMuntin }, `marthasGrilleRightWindow${index + 1}`, {
      position: [5.34, 3.58, z],
      side: 'right',
      size: [1.22, 1.26]
    });
  }

  root.add(createMarthasGrillePavilionRoof({
    roof: roofMat,
    roofTrim,
    post
  }));
  addMarthasGrilleBox(root, 'marthasGrilleSignPanel', [7.34, 1.72, 0.28], [0, 5.28, 5.36], sign);
  const signLabel = createMarthasGrilleSignLabel();
  signLabel.position.set(0, 5.28, 5.53);
  root.add(signLabel);
  addMarthasGrilleBox(root, 'mgAwning', [6.4, 0.28, 1.0], [0, 4.08, 4.86], awning, { rotation: [0.16, 0, 0] });
  addMarthasGrilleBox(root, 'marthasGrilleAwningFaceStripe', [6.22, 0.1, 0.16], [0, 3.89, 5.31], wallTrim);
  addMarthasGrilleBox(root, 'marthasGrilleOpenFrontThreshold', [5.65, 0.12, 0.34], [0, 0.86, 5.1], trimDark);

  return root;
}

function addRealEstateOfficeBox(group, name, size, position, material, options = {}) {
  group.add(createBox(name, size, position, material, options));
}

function createRealEstateOfficeSignLabel() {
  const geometry = new THREE.PlaneGeometry(6.55, 1.18);
  let material;

  if (typeof document === 'undefined') {
    material = new THREE.MeshBasicMaterial({
      color: 0x21463e,
      side: THREE.DoubleSide
    });
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#21463e';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#d6b76c';
      context.fillRect(28, 28, canvas.width - 56, 14);
      context.fillRect(28, canvas.height - 42, canvas.width - 56, 14);
      context.font = '900 84px Arial Black, Impact, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.lineWidth = 10;
      context.strokeStyle = '#132822';
      context.fillStyle = '#f5ead0';
      context.strokeText('REAL ESTATE', canvas.width * 0.5, canvas.height * 0.43);
      context.fillText('REAL ESTATE', canvas.width * 0.5, canvas.height * 0.43);
      context.font = '800 52px Arial, sans-serif';
      context.fillStyle = '#d6b76c';
      context.fillText('OFFICE', canvas.width * 0.5, canvas.height * 0.74);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide
    });
  }

  const label = new THREE.Mesh(geometry, material);
  label.name = 'realEstateOfficeSignLabel';
  label.castShadow = false;
  label.receiveShadow = false;
  return label;
}

function addRealEstateOfficeDesk(group, materials, deskIndex, position, rotationY = 0) {
  const desk = new THREE.Group();
  desk.name = `realEstateOfficeDesk${deskIndex}`;
  desk.position.set(position[0], 0, position[1]);
  desk.rotation.y = rotationY;
  group.add(desk);

  addRealEstateOfficeBox(desk, `${desk.name}Top`, [1.55, 0.16, 0.9], [0, 1.13, 0], materials.deskTop);
  addRealEstateOfficeBox(desk, `${desk.name}FrontPanel`, [1.45, 0.82, 0.12], [0, 0.7, 0.39], materials.deskWood);
  for (const [legIndex, [x, z]] of [[-0.62, -0.34], [0.62, -0.34], [-0.62, 0.34], [0.62, 0.34]].entries()) {
    addRealEstateOfficeBox(
      desk,
      `${desk.name}Leg${legIndex + 1}`,
      [0.12, 0.92, 0.12],
      [x, 0.62, z],
      materials.deskWood
    );
  }

  addRealEstateOfficeBox(desk, `${desk.name}ChairBack`, [0.72, 0.78, 0.12], [0, 0.98, -0.82], materials.chair);
  addRealEstateOfficeBox(desk, `${desk.name}ChairSeat`, [0.78, 0.16, 0.68], [0, 0.62, -0.58], materials.chair);
  addRealEstateOfficeBox(desk, `${desk.name}MonitorBase`, [0.36, 0.08, 0.28], [-0.42, 1.25, -0.04], materials.dark);
  addRealEstateOfficeBox(desk, `${desk.name}MonitorScreen`, [0.52, 0.34, 0.08], [-0.42, 1.5, 0.02], materials.screen, {
    rotation: [-0.1, 0, 0]
  });
  addRealEstateOfficeBox(desk, `${desk.name}PaperStack`, [0.46, 0.045, 0.32], [0.36, 1.25, 0.12], materials.paper, {
    castShadow: false,
    receiveShadow: true
  });
  addRealEstateOfficeBox(desk, `${desk.name}DeskLamp`, [0.12, 0.34, 0.12], [0.62, 1.39, -0.2], materials.brass);
}

function addRealEstateOfficeListingBoard(group, materials) {
  addRealEstateOfficeBox(group, 'realEstateOfficeListingBoard', [0.1, 1.75, 3.15], [-4.88, 2.28, -1.25], materials.board);
  for (const [index, [x, y]] of [
    [-4.9, 2.78],
    [-4.9, 2.22],
    [-4.9, 1.66]
  ].entries()) {
    addRealEstateOfficeBox(
      group,
      `realEstateOfficeListingCard${index + 1}`,
      [0.08, 0.36, 0.68],
      [x, y, -1.25 + ((index - 1) * 0.78)],
      index === 1 ? materials.listingAccent : materials.paper,
      { castShadow: false, receiveShadow: true }
    );
  }
}

function addRealEstateOfficeWindow(group, name, position, material, trimMaterial, size = [0.72, 0.62, 0.08]) {
  addRealEstateOfficeBox(group, name, size, position, material, {
    castShadow: false,
    receiveShadow: true
  });
  addRealEstateOfficeBox(group, `${name}Sill`, [size[0] + 0.18, 0.08, size[2] + 0.04], [position[0], position[1] - (size[1] * 0.5) - 0.08, position[2]], trimMaterial, {
    castShadow: false,
    receiveShadow: true
  });
}

function addRealEstateOfficeWindowGrid(group, materials) {
  const frontRows = [8.6, 11.55, 14.5, 17.45, 20.4, 23.35];
  for (const [rowIndex, y] of frontRows.entries()) {
    const z = rowIndex >= 4 ? 2.12 : rowIndex >= 2 ? 2.72 : 3.32;
    const xValues = rowIndex >= 4 ? [-2.1, -0.7, 0.7, 2.1] : [-3, -1.5, 0, 1.5, 3];
    for (const [columnIndex, x] of xValues.entries()) {
      addRealEstateOfficeWindow(
        group,
        `realEstateOfficeTallWindow${rowIndex + 1}_${columnIndex + 1}`,
        [x, y, z],
        materials.window,
        materials.trim,
        [0.78, 1.12, 0.08]
      );
    }
  }

  for (const [index, y] of [9.15, 12.1, 15.05, 18, 20.95, 23.9].entries()) {
    addRealEstateOfficeWindow(
      group,
      `realEstateOfficeSideWindowLeft${index + 1}`,
      [-4.46, y, -1.3],
      materials.window,
      materials.trim,
      [0.08, 1.02, 0.78]
    );
    addRealEstateOfficeWindow(
      group,
      `realEstateOfficeSideWindowRight${index + 1}`,
      [4.46, y, -1.3],
      materials.window,
      materials.trim,
      [0.08, 1.02, 0.78]
    );
  }
}

export function createRealEstateOfficeBuildingVisual() {
  const root = new THREE.Group();
  root.name = 'real_estate_office_building';
  root.userData.footprint = [...REAL_ESTATE_OFFICE_BUILDING_FOOTPRINT];

  const materials = {
    slab: createMaterial(0x555b5f, 0.9, 0.04),
    floor: createMaterial(0x746e63, 0.88, 0.03),
    facade: createMaterial(0xc9c3ad, 0.84, 0.03),
    facadeAlt: createMaterial(0xa8a28f, 0.86, 0.03),
    trim: createMaterial(0x516158, 0.62, 0.08),
    trimLight: createMaterial(0xdfd4b4, 0.66, 0.04),
    roof: createMaterial(0x333b3c, 0.82, 0.08),
    window: createMaterial(0x262d2c, 0.38, 0.12),
    signPanel: createMaterial(0x21463e, 0.72, 0.08),
    brass: createMaterial(0xd6b76c, 0.42, 0.36),
    deskWood: createMaterial(0x7a5234, 0.66, 0.08),
    deskTop: createMaterial(0xb98b58, 0.58, 0.08),
    chair: createMaterial(0x343a3a, 0.54, 0.12),
    dark: createMaterial(0x232929, 0.44, 0.2),
    screen: createMaterial(0x172725, 0.32, 0.08),
    paper: createMaterial(0xf1ead9, 0.86, 0.01),
    board: createMaterial(0x42534d, 0.74, 0.04),
    listingAccent: createMaterial(0xd6b76c, 0.7, 0.05),
    plant: createMaterial(0x376b45, 0.82, 0.02),
    planter: createMaterial(0x4d3528, 0.76, 0.04)
  };

  const foundation = new THREE.Group();
  foundation.name = 'real_estate_office_foundation';
  root.add(foundation);
  addRealEstateOfficeBox(foundation, 'realEstateOfficeSlab', [11.32, 0.62, 11.3], [0, 0.31, 0], materials.slab);
  addRealEstateOfficeBox(foundation, 'realEstateOfficeLobbyFloor', [10.3, 0.14, 10.05], [0, 0.72, -0.1], materials.floor);
  addRealEstateOfficeBox(foundation, 'realEstateOfficeOpenFrontThreshold', [6.55, 0.12, 0.34], [0, 0.86, 5.1], materials.brass);

  const interior = new THREE.Group();
  interior.name = 'real_estate_office_interior';
  root.add(interior);
  addRealEstateOfficeDesk(interior, materials, 1, [-3.05, -3.25], 0);
  addRealEstateOfficeDesk(interior, materials, 2, [0, -3.35], 0);
  addRealEstateOfficeDesk(interior, materials, 3, [3.05, -3.25], 0);
  addRealEstateOfficeListingBoard(interior, materials);
  addRealEstateOfficeBox(interior, 'realEstateOfficePlanterLeft', [0.56, 0.48, 0.56], [-4.38, 0.98, 3.52], materials.planter);
  const plantLeft = createCylinder(0.32, 0.18, 0.9, 8, materials.plant);
  plantLeft.name = 'realEstateOfficePlantLeft';
  plantLeft.position.set(-4.38, 1.62, 3.52);
  plantLeft.castShadow = true;
  plantLeft.receiveShadow = true;
  interior.add(plantLeft);
  addRealEstateOfficeBox(interior, 'realEstateOfficePlanterRight', [0.56, 0.48, 0.56], [4.38, 0.98, 3.52], materials.planter);
  const plantRight = createCylinder(0.32, 0.18, 0.9, 8, materials.plant);
  plantRight.name = 'realEstateOfficePlantRight';
  plantRight.position.set(4.38, 1.62, 3.52);
  plantRight.castShadow = true;
  plantRight.receiveShadow = true;
  interior.add(plantRight);

  const shell = new THREE.Group();
  shell.name = 'real_estate_office_hull_wall';
  root.add(shell);
  const shellBack = new THREE.Group();
  shellBack.name = 'real_estate_office_hull_wall_back';
  const shellLeft = new THREE.Group();
  shellLeft.name = 'real_estate_office_hull_wall_left';
  const shellRight = new THREE.Group();
  shellRight.name = 'real_estate_office_hull_wall_right';
  const shellFront = new THREE.Group();
  shellFront.name = 'real_estate_office_hull_wall_front';
  shell.add(shellBack, shellLeft, shellRight, shellFront);
  addRealEstateOfficeBox(shellBack, 'realEstateOfficeBackWall', [10.65, 5.3, 0.34], [0, 3.36, -5.14], materials.facade);
  addRealEstateOfficeBox(shellLeft, 'realEstateOfficeLeftWall', [0.34, 5.3, 10.15], [-5.15, 3.36, -0.1], materials.facade);
  addRealEstateOfficeBox(shellRight, 'realEstateOfficeRightWall', [0.34, 5.3, 10.15], [5.15, 3.36, -0.1], materials.facade);
  addRealEstateOfficeBox(shellFront, 'realEstateOfficeFrontLeft', [1.76, 4.1, 0.34], [-4.32, 2.77, 5.03], materials.facade);
  addRealEstateOfficeBox(shellFront, 'realEstateOfficeFrontRight', [1.76, 4.1, 0.34], [4.32, 2.77, 5.03], materials.facade);
  addRealEstateOfficeBox(shellFront, 'realEstateOfficeFrontHeader', [10.58, 1.3, 0.36], [0, 5.31, 5.03], materials.facade);
  addRealEstateOfficeBox(shellFront, 'realEstateOfficeFrontStoneBand', [10.42, 0.22, 0.42], [0, 4.1, 5.14], materials.trimLight);
  addRealEstateOfficeBox(shellFront, 'realEstateOfficeLeftKickTrim', [1.62, 0.2, 0.42], [-4.32, 1.05, 5.15], materials.trim);
  addRealEstateOfficeBox(shellFront, 'realEstateOfficeRightKickTrim', [1.62, 0.2, 0.42], [4.32, 1.05, 5.15], materials.trim);

  const tower = new THREE.Group();
  tower.name = 'real_estate_office_tall_facade';
  root.add(tower);
  addRealEstateOfficeBox(tower, 'realEstateOfficeGroundRoofDeck', [10.8, 0.34, 10.55], [0, 6.18, -0.12], materials.roof);
  addRealEstateOfficeBox(tower, 'realEstateOfficeTowerLowerBlock', [8.8, 6.5, 7.7], [0, 9.65, -0.62], materials.facadeAlt);
  addRealEstateOfficeBox(tower, 'realEstateOfficeTowerMidBlock', [7.4, 6.4, 6.55], [0, 16.15, -0.62], materials.facade);
  addRealEstateOfficeBox(tower, 'realEstateOfficeTowerTopBlock', [6.1, 7.1, 5.35], [0, 23.25, -0.62], materials.facadeAlt);
  addRealEstateOfficeBox(tower, 'realEstateOfficeTowerLowerCornice', [9.2, 0.22, 8.08], [0, 12.95, -0.62], materials.trim);
  addRealEstateOfficeBox(tower, 'realEstateOfficeTowerMidCornice', [7.75, 0.2, 6.9], [0, 19.5, -0.62], materials.trim);
  addRealEstateOfficeBox(tower, 'realEstateOfficeTowerRoofCap', [6.45, 0.38, 5.65], [0, 27.25, -0.62], materials.roof);
  addRealEstateOfficeWindowGrid(tower, materials);

  const exterior = new THREE.Group();
  exterior.name = 'real_estate_office_exterior_detail';
  root.add(exterior);
  addRealEstateOfficeBox(exterior, 'realEstateOfficeSignPanel', [7.1, 1.52, 0.28], [0, 4.5, 5.36], materials.signPanel);
  const signLabel = createRealEstateOfficeSignLabel();
  signLabel.position.set(0, 4.5, 5.53);
  exterior.add(signLabel);
  addRealEstateOfficeBox(exterior, 'realEstateOfficeGoldAwning', [6.85, 0.26, 0.92], [0, 3.52, 4.9], materials.brass, {
    rotation: [0.14, 0, 0]
  });
  addRealEstateOfficeBox(exterior, 'realEstateOfficeAwningFaceTrim', [6.7, 0.1, 0.14], [0, 3.35, 5.31], materials.trimLight);

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

function createOfficeFurnitureMaterials() {
  return {
    chair: createMaterial(0x415565, 0.74, 0.06),
    partition: createMaterial(0xaeb8be, 0.78, 0.04),
    trimDark: createMaterial(0x66727a, 0.72, 0.12),
    metal: createMaterial(0xc4ccd2, 0.5, 0.34),
    metalDark: createMaterial(0x59636b, 0.62, 0.26),
    wood: createMaterial(0xa97948, 0.54, 0.05),
    woodDark: createMaterial(0x68452b, 0.58, 0.08),
    screen: createMaterial(0x253542, 0.42, 0.1),
    green: createMaterial(0x5e8d58, 0.62, 0.02),
    accentDark: createMaterial(0x355a78, 0.66, 0.05),
    gold: createMaterial(0xd2aa44, 0.44, 0.18)
  };
}

export function createOfficeLobbyChairVisual() {
  const root = new THREE.Group();
  root.name = 'OfficeLobbyChair';
  root.userData.footprint = [...OFFICE_LOBBY_CHAIR_FOOTPRINT];
  root.userData.officeLobbyChairProp = true;

  const materials = createOfficeFurnitureMaterials();
  root.add(createBox('officeLobbyChairSeat', [0.78, 0.14, 0.74], [0, 0.55, 0], materials.chair));
  root.add(createBox('officeLobbyChairBack', [0.78, 0.86, 0.12], [0, 1.0, -0.34], materials.chair));
  root.add(createBox('officeLobbyChairBackTrim', [0.86, 0.08, 0.16], [0, 1.44, -0.34], materials.trimDark));

  for (const [legX, legZ] of [[-0.28, -0.22], [0.28, -0.22], [-0.28, 0.24], [0.28, 0.24]]) {
    root.add(createBox('officeLobbyChairLeg', [0.08, 0.5, 0.08], [legX, 0.26, legZ], materials.metal));
  }

  return root;
}

function createOfficeLobbyTableRoot({
  name,
  footprint,
  width,
  depth,
  includePlanter = true
}) {
  const root = new THREE.Group();
  root.name = name;
  root.userData.footprint = [...footprint];
  root.userData.officeLobbyTableProp = true;

  const materials = createOfficeFurnitureMaterials();
  root.add(createBox(`${name}LowerTop`, [width, 0.14, depth], [0, 0.68, 0], materials.woodDark));
  root.add(createBox(`${name}UpperTop`, [width + 0.14, 0.05, depth + 0.14], [0, 0.78, 0], materials.wood));
  for (const [legX, legZ] of [
    [-width * 0.38, -depth * 0.34],
    [width * 0.38, -depth * 0.34],
    [-width * 0.38, depth * 0.34],
    [width * 0.38, depth * 0.34]
  ]) {
    root.add(createBox(`${name}Leg`, [0.1, 0.62, 0.1], [legX, 0.34, legZ], materials.metalDark));
  }

  if (includePlanter) {
    const planter = createCylinder(0.16, 0.2, 0.16, 12, materials.green);
    planter.name = `${name}Planter`;
    planter.position.set(width * 0.22, 0.91, 0);
    planter.castShadow = true;
    planter.receiveShadow = true;
    root.add(planter);
  }

  return root;
}

export function createOfficeLobbyTableVisual() {
  return createOfficeLobbyTableRoot({
    name: 'OfficeLobbyCoffeeTable',
    footprint: OFFICE_LOBBY_TABLE_FOOTPRINT,
    width: 3.0,
    depth: 1.2
  });
}

export function createOfficeLobbySideTableVisual() {
  return createOfficeLobbyTableRoot({
    name: 'OfficeLobbySideTable',
    footprint: OFFICE_LOBBY_SIDE_TABLE_FOOTPRINT,
    width: 1.15,
    depth: 0.95
  });
}

export function createOfficeCubicleWorkstationVisual() {
  const root = new THREE.Group();
  root.name = 'OfficeCubicleWorkstation';
  root.userData.footprint = [...OFFICE_CUBICLE_WORKSTATION_FOOTPRINT];
  root.userData.officeCubicleWorkstationProp = true;

  const materials = createOfficeFurnitureMaterials();
  root.add(createBox('officeCubicleDesktop', [2.6, 0.16, 1.08], [0, 0.92, 0], materials.wood));
  root.add(createBox('officeCubicleBackPartition', [2.82, 1.36, 0.12], [0, 1.2, -0.76], materials.partition));
  root.add(createBox('officeCubicleSidePartition', [0.12, 1.36, 1.64], [-1.46, 1.2, 0], materials.partition));
  root.add(createBox('officeCubicleModestyPanel', [2.46, 0.58, 0.1], [0.04, 0.42, -0.48], materials.woodDark));
  for (const legX of [-1.06, 1.06]) {
    root.add(createBox('officeCubicleDeskLeg', [0.12, 0.86, 0.12], [legX, 0.44, 0.38], materials.metalDark));
  }
  root.add(createBox('officeCubicleScreen', [0.74, 0.46, 0.08], [-0.52, 1.24, 0.58], materials.screen));
  root.add(createBox('officeCubicleScreenStand', [0.18, 0.28, 0.14], [-0.52, 0.92, 0.5], materials.metalDark));
  root.add(createBox('officeCubicleKeyboard', [0.56, 0.05, 0.2], [0.2, 1.03, 0.48], materials.metalDark));
  root.add(createBox('officeCubicleChairSeat', [0.7, 0.1, 0.48], [0.76, 0.54, 0.9], materials.chair));
  root.add(createBox('officeCubicleChairBack', [0.7, 0.8, 0.1], [0.76, 0.98, 1.16], materials.chair));

  return root;
}

export function createOfficeCeoMeetingTableVisual() {
  const root = new THREE.Group();
  root.name = 'OfficeCeoMeetingTable';
  root.userData.footprint = [...OFFICE_CEO_MEETING_TABLE_FOOTPRINT];
  root.userData.officeCeoMeetingTableProp = true;

  const {
    width: tableWidth,
    depth: tableDepth,
    rugWidth,
    rugDepth
  } = OFFICE_INTERIOR_CEO_MEETING_TABLE;
  const materials = createOfficeFurnitureMaterials();
  root.add(createBox('officeCeoMeetingTableRug', [rugWidth, 0.05, rugDepth], [0, 0.04, 0], materials.accentDark, {
    castShadow: false,
    receiveShadow: true
  }));
  root.add(createBox('officeCeoMeetingTableTop', [tableWidth, 0.24, tableDepth], [0, 1.02, 0], materials.wood));
  root.add(createBox('officeCeoMeetingTableInset', [tableWidth - 0.5, 0.08, tableDepth - 0.46], [0, 1.18, 0], materials.woodDark));
  for (const pedestalX of [-tableWidth * 0.27, tableWidth * 0.27]) {
    root.add(createBox('officeCeoMeetingTablePedestal', [0.48, 0.9, tableDepth * 0.48], [pedestalX, 0.52, 0], materials.metalDark));
    root.add(createBox('officeCeoMeetingTableFoot', [1.4, 0.12, tableDepth * 0.72], [pedestalX, 0.12, 0], materials.gold));
  }

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

function addInstrumentClusterPiano(root, materials) {
  root.add(createBox('instrumentClusterPianoKeyboardCase', [2.24, 0.18, 0.62], [0.08, 0.9, -0.58], materials.pianoCase));
  root.add(createBox('instrumentClusterPianoKeyboard', [1.92, 0.045, 0.27], [0.08, 1.015, -0.3], materials.keyWhite, {
    castShadow: false,
    receiveShadow: true
  }));
  root.add(createBox('instrumentClusterPianoBackRail', [2.32, 0.22, 0.1], [0.08, 1.0, -0.88], materials.pianoTrim));
  root.add(createBox('instrumentClusterPianoControlPanel', [0.52, 0.048, 0.18], [0.84, 1.04, -0.55], materials.pianoPanel, {
    castShadow: false,
    receiveShadow: true
  }));
  root.add(createBox('instrumentClusterPianoMusicRest', [1.28, 0.42, 0.065], [0.02, 1.28, -0.9], materials.pianoTrim, {
    rotation: [-0.32, 0, 0]
  }));

  for (let index = 0; index < 16; index += 1) {
    root.add(createBox(
      `instrumentClusterPianoWhiteKey${index + 1}`,
      [0.096, 0.036, 0.24],
      [-0.83 + (index * 0.122), 1.055, -0.23],
      materials.keyWhite,
      { castShadow: false, receiveShadow: true }
    ));
  }

  const blackKeyOffsets = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12, 14];
  blackKeyOffsets.forEach((offset, index) => {
    root.add(createBox(
      `instrumentClusterPianoBlackKey${index + 1}`,
      [0.066, 0.052, 0.16],
      [-0.77 + (offset * 0.122), 1.092, -0.33],
      materials.keyBlack,
      { castShadow: true, receiveShadow: true }
    ));
  });

  root.add(createCylinderBetween('instrumentClusterPianoStandFrontFoot', [-1.0, 0.08, -0.2], [1.16, 0.08, -0.2], 0.035, materials.standMetal));
  root.add(createCylinderBetween('instrumentClusterPianoStandBackFoot', [-1.0, 0.08, -0.92], [1.16, 0.08, -0.92], 0.035, materials.standMetal));
  root.add(createCylinderBetween('instrumentClusterPianoStandLeftFrontLeg', [-0.92, 0.08, -0.22], [-0.52, 0.82, -0.45], 0.032, materials.standMetal));
  root.add(createCylinderBetween('instrumentClusterPianoStandRightFrontLeg', [1.08, 0.08, -0.22], [0.68, 0.82, -0.45], 0.032, materials.standMetal));
  root.add(createCylinderBetween('instrumentClusterPianoStandLeftBackLeg', [-0.92, 0.08, -0.9], [-0.52, 0.82, -0.7], 0.032, materials.standMetal));
  root.add(createCylinderBetween('instrumentClusterPianoStandRightBackLeg', [1.08, 0.08, -0.9], [0.68, 0.82, -0.7], 0.032, materials.standMetal));
}

function addInstrumentClusterGuitar(root, materials) {
  const guitar = new THREE.Group();
  guitar.name = 'instrumentClusterGuitar';
  guitar.position.set(-1.48, 0.08, 0.38);
  guitar.rotation.set(0, 0.16, -0.16);
  root.add(guitar);

  const body = new THREE.Mesh(
    createGuitarBodyGeometry(0.66, 0.82, 0.16),
    materials.guitarBody
  );
  body.name = 'instrumentClusterGuitarBody';
  body.position.set(0, 0.58, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  guitar.add(body);

  const soundHole = new THREE.Mesh(
    new THREE.TorusGeometry(0.105, 0.012, 8, 30),
    materials.guitarSoundHole
  );
  soundHole.name = 'instrumentClusterGuitarSoundHole';
  soundHole.position.set(0, 0.69, -0.09);
  soundHole.castShadow = false;
  soundHole.receiveShadow = true;
  guitar.add(soundHole);

  guitar.add(createBox('instrumentClusterGuitarBridge', [0.32, 0.045, 0.035], [0, 0.38, -0.095], materials.guitarNeck));
  guitar.add(createBox('instrumentClusterGuitarNeck', [0.12, 1.08, 0.075], [0, 1.28, -0.01], materials.guitarNeck));
  guitar.add(createBox('instrumentClusterGuitarHeadstock', [0.32, 0.28, 0.09], [0, 1.97, -0.01], materials.guitarNeck, {
    rotation: [0, 0, 0.1]
  }));

  for (let index = 0; index < 6; index += 1) {
    const x = -0.045 + (index * 0.018);
    guitar.add(createCylinderBetween(
      `instrumentClusterGuitarString${index + 1}`,
      [x, 0.39, -0.115],
      [x * 0.46, 2.08, -0.115],
      0.0045,
      materials.guitarString,
      { radialSegments: 4, castShadow: false, receiveShadow: true }
    ));
  }

  for (const side of [-1, 1]) {
    for (let index = 0; index < 3; index += 1) {
      const peg = createCylinder(0.022, 0.022, 0.15, 10, materials.guitarString);
      peg.name = `instrumentClusterGuitarTuningPeg${side < 0 ? 'Left' : 'Right'}${index + 1}`;
      peg.rotation.z = Math.PI * 0.5;
      peg.position.set(side * 0.19, 1.9 + (index * 0.08), -0.02);
      peg.castShadow = true;
      peg.receiveShadow = true;
      guitar.add(peg);
    }
  }

  root.add(createCylinderBetween('instrumentClusterGuitarFloorStandLeft', [-1.78, 0.06, 0.58], [-1.56, 0.92, 0.4], 0.022, materials.standMetal));
  root.add(createCylinderBetween('instrumentClusterGuitarFloorStandRight', [-1.14, 0.06, 0.56], [-1.4, 0.92, 0.39], 0.022, materials.standMetal));
  root.add(createCylinderBetween('instrumentClusterGuitarFloorStandBase', [-1.82, 0.06, 0.64], [-1.1, 0.06, 0.64], 0.026, materials.standMetal));
}

function addInstrumentClusterMicrophoneStand(root, materials) {
  const baseX = 1.52;
  const baseZ = 0.48;
  const legEnds = [
    [baseX - 0.48, 0.06, baseZ + 0.34],
    [baseX + 0.5, 0.06, baseZ + 0.28],
    [baseX + 0.02, 0.06, baseZ - 0.5]
  ];

  for (const [index, end] of legEnds.entries()) {
    root.add(createCylinderBetween(
      `instrumentClusterMicrophoneStandTripodLeg${index + 1}`,
      [baseX, 0.1, baseZ],
      end,
      0.026,
      materials.standMetal
    ));
  }

  root.add(createCylinderBetween('instrumentClusterMicrophoneStandPole', [baseX, 0.08, baseZ], [baseX, 1.72, baseZ], 0.034, materials.standMetal, {
    radialSegments: 16
  }));
  root.add(createSphere('instrumentClusterMicrophoneStandClamp', 0.075, [baseX, 1.7, baseZ], materials.standMetal, {
    scale: [1.2, 0.85, 1.2],
    widthSegments: 16,
    heightSegments: 10
  }));
  root.add(createCylinderBetween('instrumentClusterMicrophoneStandBoom', [baseX, 1.68, baseZ], [0.78, 1.93, 0.26], 0.024, materials.standMetal, {
    radialSegments: 12
  }));
  root.add(createCylinderBetween('instrumentClusterMicrophoneHandle', [0.79, 1.93, 0.26], [0.54, 2.0, 0.18], 0.038, materials.micHandle, {
    radialSegments: 12
  }));
  root.add(createCylinderBetween('instrumentClusterMicrophone', [0.52, 2.01, 0.18], [0.3, 2.07, 0.12], 0.065, materials.micGrille, {
    radialSegments: 16
  }));
}

export function createInstrumentClusterVisual() {
  const root = new THREE.Group();
  root.name = 'InstrumentCluster';
  root.userData.footprint = [...INSTRUMENT_CLUSTER_FOOTPRINT];

  const materials = {
    rug: createMaterial(0x263042, 0.82, 0.04),
    rugTrim: createMaterial(0xd4a847, 0.5, 0.2),
    pianoCase: createMaterial(0x111820, 0.42, 0.22),
    pianoTrim: createMaterial(0x2d3744, 0.36, 0.34),
    pianoPanel: createMaterial(0x4ec3d8, 0.3, 0.08),
    keyWhite: createMaterial(0xf1eee6, 0.48, 0.02),
    keyBlack: createMaterial(0x08090d, 0.5, 0.12),
    standMetal: createMaterial(0x3d4652, 0.34, 0.52),
    guitarBody: createMaterial(0xba6a2a, 0.38, 0.06),
    guitarNeck: createMaterial(0x55331e, 0.44, 0.06),
    guitarSoundHole: createMaterial(0x0c0b0a, 0.66, 0.02),
    guitarString: createMaterial(0xd4d9dd, 0.24, 0.62),
    micHandle: createMaterial(0x11151b, 0.44, 0.34),
    micGrille: createMaterial(0xb8c3cc, 0.26, 0.64),
    cable: createMaterial(0x080b10, 0.68, 0.12)
  };

  root.add(createBox('instrumentClusterCornerRug', [4.0, 0.045, 2.36], [0, 0.022, -0.04], materials.rug, {
    castShadow: false,
    receiveShadow: true
  }));
  root.add(createBox('instrumentClusterRugFrontTrim', [4.02, 0.02, 0.045], [0, 0.056, 1.14], materials.rugTrim, {
    castShadow: false,
    receiveShadow: true
  }));
  root.add(createBox('instrumentClusterRugLeftTrim', [0.045, 0.02, 2.33], [-1.98, 0.056, -0.04], materials.rugTrim, {
    castShadow: false,
    receiveShadow: true
  }));

  addInstrumentClusterPiano(root, materials);
  addInstrumentClusterGuitar(root, materials);
  addInstrumentClusterMicrophoneStand(root, materials);

  const cablePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.34, 0.07, -0.16),
    new THREE.Vector3(0.92, 0.065, 0.04),
    new THREE.Vector3(1.4, 0.065, 0.36),
    new THREE.Vector3(0.42, 0.065, 0.72),
    new THREE.Vector3(-0.78, 0.065, 0.54)
  ]);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(cablePath, 28, 0.018, 6),
    materials.cable
  );
  cable.name = 'instrumentClusterAudioCable';
  cable.castShadow = false;
  cable.receiveShadow = true;
  root.add(cable);

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

export function createPistolPickupSpawnVisual() {
  const root = new THREE.Group();
  root.name = 'PistolPickupSpawn';

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1.18, 32),
    new THREE.MeshBasicMaterial({
      color: 0xf2c871,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  ring.name = 'pistolPickupSpawnRing';
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.035;
  root.add(ring);

  const baseMaterial = createMaterial(0x242b3d, 0.58, 0.18);
  const accentMaterial = createMaterial(0xf2c871, 0.42, 0.35);
  const base = createCylinder(0.52, 0.66, 0.18, 24, baseMaterial);
  base.name = 'pistolPickupSpawnBase';
  base.position.y = 0.09;
  root.add(base);

  const core = createCylinder(0.18, 0.24, 0.28, 20, accentMaterial);
  core.name = 'pistolPickupSpawnCore';
  core.position.y = 0.32;
  root.add(core);

  const notch = createBox(
    'pistolPickupSpawnNotch',
    [0.82, 0.08, 0.18],
    [0, 0.45, 0],
    accentMaterial,
    { castShadow: true, receiveShadow: false }
  );
  root.add(notch);

  return root;
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
