import * as THREE from 'three';

export const SKATEBOARD_MODEL_DIMENSIONS = Object.freeze({
  deckWidth: 0.72,
  deckLength: 2.42,
  deckThickness: 0.085,
  truckOffset: 0.76,
  truckWidth: 0.88,
  wheelTrackWidth: 1.02,
  wheelRadius: 0.135,
  wheelThickness: 0.16
});

const DECK_COLOR = 0x2f9f88;
const DECK_STRIPE_COLOR = 0xf2c65c;
const GRIP_COLOR = 0x11161c;
const TRUCK_COLOR = 0xb9c3c8;
const WHEEL_COLOR = 0xeee3ca;
const WHEEL_HUB_COLOR = 0x8aa1ad;
const BOLT_COLOR = 0xd7dce0;

function createSkateboardPlanShape(width, length, noseDepth = 0.34) {
  const halfWidth = width * 0.5;
  const halfLength = length * 0.5;
  const shoulderWidth = halfWidth * 0.96;
  const endShoulderWidth = halfWidth * 0.64;

  const shape = new THREE.Shape();
  shape.moveTo(0, halfLength);
  shape.bezierCurveTo(
    endShoulderWidth,
    halfLength,
    shoulderWidth,
    halfLength - noseDepth * 0.42,
    shoulderWidth,
    halfLength - noseDepth
  );
  shape.lineTo(halfWidth, -halfLength + noseDepth);
  shape.bezierCurveTo(
    shoulderWidth,
    -halfLength + noseDepth * 0.42,
    endShoulderWidth,
    -halfLength,
    0,
    -halfLength
  );
  shape.bezierCurveTo(
    -endShoulderWidth,
    -halfLength,
    -shoulderWidth,
    -halfLength + noseDepth * 0.42,
    -halfWidth,
    -halfLength + noseDepth
  );
  shape.lineTo(-shoulderWidth, halfLength - noseDepth);
  shape.bezierCurveTo(
    -shoulderWidth,
    halfLength - noseDepth * 0.42,
    -endShoulderWidth,
    halfLength,
    0,
    halfLength
  );
  shape.closePath();
  return shape;
}

function createDeckGeometry(width, length, thickness) {
  const geometry = new THREE.ExtrudeGeometry(createSkateboardPlanShape(width, length), {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.018,
    bevelThickness: 0.012,
    bevelSegments: 2,
    curveSegments: 18
  });
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, thickness * 0.5, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function createTopShapeGeometry(width, length) {
  const geometry = new THREE.ShapeGeometry(createSkateboardPlanShape(width, length, 0.28), 18);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createNamedMesh(name, geometry, material, { position = null, rotation = null, castShadow = true, receiveShadow = true } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  if (position) {
    mesh.position.set(position[0], position[1], position[2]);
  }
  if (rotation) {
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  }
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

function addSkateboardBolts(group, namePrefix, boltMaterial, topY) {
  const boltGeometry = new THREE.CylinderGeometry(0.026, 0.026, 0.011, 10);
  const boltPositions = [];
  for (const z of [-0.76, 0.76]) {
    for (const x of [-0.14, 0.14]) {
      boltPositions.push([x, topY + 0.009, z - 0.055], [x, topY + 0.009, z + 0.055]);
    }
  }

  boltPositions.forEach((position, index) => {
    const bolt = createNamedMesh(
      `${namePrefix}SkateboardBolt_${index + 1}`,
      boltGeometry,
      boltMaterial,
      { position, castShadow: false, receiveShadow: true }
    );
    group.add(bolt);
  });
}

function addSkateboardTrucksAndWheels(group, namePrefix, materials) {
  const axleGeometry = new THREE.CylinderGeometry(0.035, 0.035, SKATEBOARD_MODEL_DIMENSIONS.truckWidth, 12);
  const wheelGeometry = new THREE.CylinderGeometry(
    SKATEBOARD_MODEL_DIMENSIONS.wheelRadius,
    SKATEBOARD_MODEL_DIMENSIONS.wheelRadius,
    SKATEBOARD_MODEL_DIMENSIONS.wheelThickness,
    20
  );
  const hubGeometry = new THREE.CylinderGeometry(0.056, 0.056, 0.02, 14);

  for (const z of [-SKATEBOARD_MODEL_DIMENSIONS.truckOffset, SKATEBOARD_MODEL_DIMENSIONS.truckOffset]) {
    const suffix = z < 0 ? 'Back' : 'Front';
    const basePlate = createNamedMesh(
      `${namePrefix}SkateboardTruckPlate${suffix}`,
      new THREE.BoxGeometry(0.34, 0.045, 0.18),
      materials.truck,
      { position: [0, 0.035, z] }
    );
    group.add(basePlate);

    const axle = createNamedMesh(
      `${namePrefix}SkateboardTruck${suffix}`,
      axleGeometry,
      materials.truck,
      { position: [0, -0.01, z], rotation: [0, 0, Math.PI / 2] }
    );
    group.add(axle);

    for (const x of [-SKATEBOARD_MODEL_DIMENSIONS.wheelTrackWidth * 0.5, SKATEBOARD_MODEL_DIMENSIONS.wheelTrackWidth * 0.5]) {
      const side = x < 0 ? 'L' : 'R';
      const wheel = createNamedMesh(
        `${namePrefix}SkateboardWheel_${side}_${z < 0 ? 'B' : 'F'}`,
        wheelGeometry,
        materials.wheel,
        { position: [x, -0.05, z], rotation: [0, 0, Math.PI / 2] }
      );
      group.add(wheel);

      const hub = createNamedMesh(
        `${namePrefix}SkateboardWheelHub_${side}_${z < 0 ? 'B' : 'F'}`,
        hubGeometry,
        materials.hub,
        { position: [x + (x < 0 ? -0.091 : 0.091), -0.05, z], rotation: [0, 0, Math.PI / 2], castShadow: false }
      );
      group.add(hub);
    }
  }
}

export function createSkateboardModel({ namePrefix = 'Player', visible = true, scale = 1 } = {}) {
  const group = new THREE.Group();
  group.name = `${namePrefix}Skateboard`;
  group.visible = visible;

  const deckMaterial = new THREE.MeshStandardMaterial({
    color: DECK_COLOR,
    roughness: 0.58,
    metalness: 0.03
  });
  const stripeMaterial = new THREE.MeshStandardMaterial({
    color: DECK_STRIPE_COLOR,
    roughness: 0.5,
    metalness: 0.02
  });
  const gripMaterial = new THREE.MeshStandardMaterial({
    color: GRIP_COLOR,
    roughness: 0.92,
    metalness: 0.01
  });
  const truckMaterial = new THREE.MeshStandardMaterial({
    color: TRUCK_COLOR,
    roughness: 0.38,
    metalness: 0.58
  });
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: WHEEL_COLOR,
    roughness: 0.72,
    metalness: 0.02
  });
  const hubMaterial = new THREE.MeshStandardMaterial({
    color: WHEEL_HUB_COLOR,
    roughness: 0.36,
    metalness: 0.45
  });
  const boltMaterial = new THREE.MeshStandardMaterial({
    color: BOLT_COLOR,
    roughness: 0.32,
    metalness: 0.66
  });

  const deckTopY = 0.12 + SKATEBOARD_MODEL_DIMENSIONS.deckThickness * 0.5;
  const deck = createNamedMesh(
    `${namePrefix}SkateboardDeck`,
    createDeckGeometry(
      SKATEBOARD_MODEL_DIMENSIONS.deckWidth,
      SKATEBOARD_MODEL_DIMENSIONS.deckLength,
      SKATEBOARD_MODEL_DIMENSIONS.deckThickness
    ),
    deckMaterial,
    { position: [0, 0.12, 0] }
  );
  group.add(deck);

  const grip = createNamedMesh(
    `${namePrefix}SkateboardGrip`,
    createTopShapeGeometry(0.54, 1.82),
    gripMaterial,
    { position: [0, deckTopY + 0.008, 0.02], castShadow: false, receiveShadow: true }
  );
  group.add(grip);

  for (const z of [-0.98, 0.98]) {
    const stripe = createNamedMesh(
      `${namePrefix}Skateboard${z < 0 ? 'Tail' : 'Nose'}Stripe`,
      new THREE.BoxGeometry(0.48, 0.012, 0.036),
      stripeMaterial,
      { position: [0, deckTopY + 0.013, z], castShadow: false, receiveShadow: true }
    );
    group.add(stripe);
  }

  addSkateboardBolts(group, namePrefix, boltMaterial, deckTopY);
  addSkateboardTrucksAndWheels(group, namePrefix, {
    truck: truckMaterial,
    wheel: wheelMaterial,
    hub: hubMaterial
  });

  group.scale.setScalar(scale);
  return group;
}
