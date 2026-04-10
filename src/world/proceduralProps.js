import * as THREE from 'three';

export const OLYMPIC_BARBELL_LENGTH = 5.6;
export const OLYMPIC_BARBELL_PLATE_RADIUS = 0.78;
export const OLYMPIC_BARBELL_FOOTPRINT = Object.freeze([5.6, 1.7]);

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
    { radius: OLYMPIC_BARBELL_PLATE_RADIUS, thickness: 0.15, x: sleeveOffset + 0.02 },
    { radius: 0.64, thickness: 0.11, x: sleeveOffset - 0.17 },
    { radius: 0.52, thickness: 0.08, x: sleeveOffset - 0.31 }
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

export function createOlympicBarbellVisual() {
  const root = new THREE.Group();
  root.name = 'OlympicBarbell';

  const steelMaterial = createMaterial(0xc2c8d0, 0.28, 0.7);
  const sleeveMaterial = createMaterial(0x949ca8, 0.34, 0.58);
  const plateMaterial = createMaterial(0x15171b, 0.9, 0.08);
  const collarMaterial = createMaterial(0xd48e26, 0.42, 0.52);

  const shaft = createCylinder(0.06, 0.06, OLYMPIC_BARBELL_LENGTH, 24, steelMaterial);
  shaft.rotation.z = Math.PI * 0.5;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  root.add(shaft);

  for (const side of [-1, 1]) {
    const sleeve = createCylinder(0.09, 0.09, 0.62, 18, sleeveMaterial);
    sleeve.rotation.z = Math.PI * 0.5;
    sleeve.position.x = side * 2.18;
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    root.add(sleeve);

    const collar = createCylinder(0.11, 0.11, 0.08, 18, collarMaterial);
    collar.rotation.z = Math.PI * 0.5;
    collar.position.x = side * 1.78;
    collar.castShadow = true;
    collar.receiveShadow = true;
    root.add(collar);

    root.add(buildPlateStack(side, plateMaterial));
  }

  return root;
}
