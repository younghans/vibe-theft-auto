import * as THREE from 'three';
import {
  CAR_DEALER_ITEM_IDS,
  getCarDealerMenuItem,
  getVehicleModelGroundNodeNameParts,
  normalizePlayerVehicleItemId
} from '../shared/carDealer.js';
import { SKATEBOARD_ITEM_ID } from '../shared/skateboard.js';
import { centerObjectOnXZAndSnapToGround, fitObjectToFootprint } from '../shared/threeModelBounds.js';
import { assets } from '../world/assetManifest.js';

const LIVE_PREVIEW_SIZE = Object.freeze({ width: 640, height: 360 });
const SNAPSHOT_SIZE = Object.freeze({ width: 260, height: 180 });
const CAR_PREVIEW_MODEL_SCALE = 0.75;
const CAR_PREVIEW_MODEL_FOOTPRINT = Object.freeze([6.5, 12]);
const VEHICLE_ASSET_URLS = Object.freeze({
  [CAR_DEALER_ITEM_IDS.fiatDuna]: assets.vehicles.fiatDuna,
  [CAR_DEALER_ITEM_IDS.toyotaAe86]: assets.vehicles.toyotaAe86
});
const BASE_VEHICLE_YAW = Math.PI * 0.23;
const SNAPSHOT_VEHICLE_YAW = Math.PI * 0.23;
const LIVE_VEHICLE_ROTATION_SPEED = 1.65;

function normalizeVehiclePreviewItemId(itemId = '') {
  const rawItemId = String(itemId ?? '').trim();
  if (rawItemId === SKATEBOARD_ITEM_ID) {
    return SKATEBOARD_ITEM_ID;
  }

  return normalizePlayerVehicleItemId(rawItemId);
}

function getVehicleDefinition(itemId = '') {
  const normalizedItemId = normalizeVehiclePreviewItemId(itemId);
  if (normalizedItemId === SKATEBOARD_ITEM_ID) {
    return {
      id: SKATEBOARD_ITEM_ID,
      label: 'Skateboard',
      kind: 'skateboard',
      accent: '#3aa686',
      assetUrl: ''
    };
  }

  const item = getCarDealerMenuItem(normalizedItemId);
  const assetUrl = VEHICLE_ASSET_URLS[normalizedItemId];
  if (!item || !assetUrl) {
    return null;
  }

  return {
    ...item,
    kind: 'car',
    assetUrl
  };
}

function detachObject(root) {
  root?.parent?.remove(root);
}

function prepareVehicleModel(root) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) {
        continue;
      }
      material.side = THREE.FrontSide;
      material.needsUpdate = true;
    }
  });
}

function fitVehiclePreviewModelToFootprint(root) {
  fitObjectToFootprint(root, CAR_PREVIEW_MODEL_FOOTPRINT[0], CAR_PREVIEW_MODEL_FOOTPRINT[1]);
  root.scale.multiplyScalar(CAR_PREVIEW_MODEL_SCALE);
}

function centerAndGroundVehicle(root, itemId = '') {
  centerObjectOnXZAndSnapToGround(root, {
    groundNodeNameParts: getVehicleModelGroundNodeNameParts(itemId)
  });
}

function createSkateboardPreviewModel() {
  const group = new THREE.Group();
  group.name = 'VehiclePreviewSkateboard';

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.12, 2.28),
    new THREE.MeshStandardMaterial({
      color: 0x3aa686,
      roughness: 0.62,
      metalness: 0.05
    })
  );
  deck.name = 'VehiclePreviewSkateboardDeck';
  deck.position.y = 0.12;
  group.add(deck);

  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.028, 1.86),
    new THREE.MeshStandardMaterial({
      color: 0x14191f,
      roughness: 0.84,
      metalness: 0.02
    })
  );
  grip.name = 'VehiclePreviewSkateboardGrip';
  grip.position.y = 0.198;
  group.add(grip);

  const truckMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9c3c8,
    roughness: 0.4,
    metalness: 0.55
  });
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x171b20,
    roughness: 0.68,
    metalness: 0.06
  });
  for (const z of [-0.76, 0.76]) {
    const truck = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.12), truckMaterial);
    truck.name = z < 0 ? 'VehiclePreviewSkateboardTruckBack' : 'VehiclePreviewSkateboardTruckFront';
    truck.position.set(0, 0.035, z);
    group.add(truck);

    for (const x of [-0.58, 0.58]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.24, 14), wheelMaterial);
      wheel.name = `VehiclePreviewSkateboardWheel_${x < 0 ? 'L' : 'R'}_${z < 0 ? 'B' : 'F'}`;
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, -0.04, z);
      group.add(wheel);
    }
  }

  group.scale.setScalar(1.22);
  return group;
}

async function instantiateVehicle(library, itemId = '', yaw = BASE_VEHICLE_YAW) {
  const definition = getVehicleDefinition(itemId);
  if (!definition) {
    throw new Error(`Unknown vehicle preview item "${String(itemId)}".`);
  }

  const object = definition.kind === 'skateboard'
    ? createSkateboardPreviewModel()
    : await library.instantiate(definition.assetUrl);
  object.name = `VehiclePreview:${definition.id}`;
  if (definition.kind !== 'skateboard') {
    fitVehiclePreviewModelToFootprint(object);
  }
  prepareVehicleModel(object);
  centerAndGroundVehicle(object, definition.id);
  object.rotation.y = yaw;

  return {
    itemId: definition.id,
    definition,
    object,
    yaw
  };
}

function createPreviewRig({ width, height, className = '', preserveDrawingBuffer = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (className) {
    renderer.domElement.className = className;
  }
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 256);
  const objectRoot = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshStandardMaterial({
      color: 0x172336,
      roughness: 0.82,
      metalness: 0.02,
      transparent: true,
      opacity: 0.64
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;

  const hemi = new THREE.HemisphereLight(0xf0f7ff, 0x33241d, 2.2);
  const key = new THREE.DirectionalLight(0xfff2d6, 2.9);
  const fill = new THREE.DirectionalLight(0xaedaff, 1.3);
  const rim = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(5.8, 8.2, 7.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  fill.position.set(-5.2, 4.2, 5.5);
  rim.position.set(-5.4, 5.6, -6.4);

  scene.add(hemi, key, fill, rim, floor, objectRoot);

  return {
    renderer,
    scene,
    camera,
    objectRoot,
    floor,
    size: { width, height }
  };
}

function resizeRig(rig, width, height) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  if (rig.size.width === safeWidth && rig.size.height === safeHeight) {
    return false;
  }

  rig.size.width = safeWidth;
  rig.size.height = safeHeight;
  rig.camera.aspect = safeWidth / safeHeight;
  rig.camera.updateProjectionMatrix();
  rig.renderer.setSize(safeWidth, safeHeight, false);
  return true;
}

function syncRigToContainer(rig, container) {
  if (!container) {
    return false;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width > 0 && height > 0) {
    return resizeRig(rig, width, height);
  }

  return false;
}

function frameCamera(camera, object, { distanceMultiplier = 1.32 } = {}) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const focus = bounds.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.z, size.y * 2.2, 2.4);
  const distance = (maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * distanceMultiplier;
  const focusY = bounds.min.y + Math.max(size.y * 0.42, 0.5);

  camera.position.set(
    focus.x + distance * 0.74,
    focusY + Math.max(size.y * 0.52, 1.05),
    focus.z + distance * 0.86
  );
  camera.lookAt(focus.x, focusY, focus.z);
  camera.updateProjectionMatrix();
}

function syncFloorToObject(rig, object) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  rig.floor.scale.setScalar(Math.max(size.x, size.z, 2.8) * 0.64);
}

function renderRig(rig) {
  rig.renderer.render(rig.scene, rig.camera);
}

function createPlaceholderNode() {
  const node = document.createElement('span');
  node.className = 'hud__car-model-placeholder';
  node.setAttribute('aria-hidden', 'true');
  return node;
}

function createSnapshotImage(definition, src) {
  const imageNode = document.createElement('img');
  imageNode.className = 'hud__car-model-art';
  imageNode.alt = `${definition.label} 3D model`;
  imageNode.loading = 'lazy';
  imageNode.decoding = 'async';
  imageNode.draggable = false;
  imageNode.src = src;
  return imageNode;
}

export class VehiclePreviewRenderer {
  constructor({ library }) {
    this.library = library;
    this.active = false;
    this.liveMount = null;
    this.liveVehicle = null;
    this.liveVehiclePromise = null;
    this.liveVehicleRequestId = 0;
    this.snapshotEntries = new Map();
    this.snapshotRenderQueue = Promise.resolve();
    this.livePreview = createPreviewRig({
      ...LIVE_PREVIEW_SIZE,
      className: 'hud__vehicle-stage-canvas'
    });
    this.snapshotRig = createPreviewRig({
      ...SNAPSHOT_SIZE,
      className: 'hud__vehicle-snapshot-canvas',
      preserveDrawingBuffer: true
    });
    renderRig(this.livePreview);
  }

  mount(container) {
    if (!container) {
      return;
    }

    this.liveMount = container;
    if (!container.contains(this.livePreview.renderer.domElement)) {
      container.replaceChildren(this.livePreview.renderer.domElement);
    }
    const resized = syncRigToContainer(this.livePreview, this.liveMount);
    if (resized && this.liveVehicle) {
      this.frameLivePreview();
    }
    this.renderLivePreview();
  }

  setActive(active) {
    this.active = Boolean(active);
    if (this.liveMount) {
      this.liveMount.classList.toggle('is-3d-ready', this.active);
    }
    if (this.active) {
      this.renderLivePreview();
    }
  }

  frameLivePreview() {
    if (!this.liveVehicle) {
      return;
    }

    syncFloorToObject(this.livePreview, this.liveVehicle.object);
    frameCamera(this.livePreview.camera, this.liveVehicle.object);
  }

  renderLivePreview() {
    syncRigToContainer(this.livePreview, this.liveMount);
    renderRig(this.livePreview);
  }

  async setVehicle(itemId = '') {
    const definition = getVehicleDefinition(itemId);
    if (!definition) {
      this.liveVehicleRequestId += 1;
      if (this.liveVehicle) {
        detachObject(this.liveVehicle.object);
        this.liveVehicle = null;
      }
      this.livePreview.objectRoot.clear();
      this.renderLivePreview();
      return null;
    }

    if (this.liveVehicle?.itemId === definition.id) {
      if (this.active) {
        this.renderLivePreview();
      }
      return this.liveVehicle;
    }

    const requestId = ++this.liveVehicleRequestId;
    const request = instantiateVehicle(this.library, definition.id, BASE_VEHICLE_YAW)
      .then((vehicle) => {
        if (requestId !== this.liveVehicleRequestId) {
          detachObject(vehicle.object);
          return this.liveVehicle;
        }

        if (this.liveVehicle) {
          detachObject(this.liveVehicle.object);
        }
        this.livePreview.objectRoot.clear();
        this.liveVehicle = vehicle;
        this.livePreview.objectRoot.add(vehicle.object);
        this.frameLivePreview();
        this.renderLivePreview();
        return vehicle;
      })
      .catch((error) => {
        console.warn('[VehiclePreview] Failed to load live vehicle preview.', {
          itemId: definition.id,
          error
        });
        return null;
      })
      .finally(() => {
        if (this.liveVehiclePromise === request) {
          this.liveVehiclePromise = null;
        }
      });

    this.liveVehiclePromise = request;
    return request;
  }

  getOrCreateSnapshotEntry(itemId = '') {
    const definition = getVehicleDefinition(itemId);
    if (!definition) {
      return null;
    }

    if (this.snapshotEntries.has(definition.id)) {
      return this.snapshotEntries.get(definition.id);
    }

    const entry = {
      itemId: definition.id,
      definition,
      src: '',
      promise: null,
      failed: false
    };
    this.snapshotEntries.set(definition.id, entry);
    return entry;
  }

  async getSnapshotSrc(itemId = '') {
    const entry = this.getOrCreateSnapshotEntry(itemId);
    if (!entry || entry.failed) {
      return '';
    }

    if (entry.src) {
      return entry.src;
    }

    if (!entry.promise) {
      const task = this.snapshotRenderQueue
        .catch(() => {})
        .then(() => this.renderSnapshot(entry.definition))
        .then((src) => {
          entry.src = src;
          return src;
        })
        .catch((error) => {
          entry.failed = true;
          console.warn('[VehiclePreview] Failed to render vehicle snapshot.', {
            itemId: entry.itemId,
            error
          });
          return '';
        })
        .finally(() => {
          if (entry.promise === task) {
            entry.promise = null;
          }
        });

      entry.promise = task;
      this.snapshotRenderQueue = task.catch(() => {});
    }

    return entry.promise;
  }

  async renderSnapshot(definition) {
    this.snapshotRig.objectRoot.clear();
    const vehicle = await instantiateVehicle(this.library, definition.id, SNAPSHOT_VEHICLE_YAW);
    try {
      this.snapshotRig.objectRoot.add(vehicle.object);
      syncFloorToObject(this.snapshotRig, vehicle.object);
      frameCamera(this.snapshotRig.camera, vehicle.object, { distanceMultiplier: 1.42 });
      renderRig(this.snapshotRig);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      renderRig(this.snapshotRig);
      return this.snapshotRig.renderer.domElement.toDataURL('image/png');
    } finally {
      detachObject(vehicle.object);
      this.snapshotRig.objectRoot.clear();
    }
  }

  async mountSnapshot(itemId = '', container = null) {
    const entry = this.getOrCreateSnapshotEntry(itemId);
    if (!entry || !container) {
      return;
    }

    container.dataset.vehiclePreviewItemId = entry.itemId;
    if (!entry.src) {
      container.replaceChildren(createPlaceholderNode());
    }

    const src = await this.getSnapshotSrc(entry.itemId);
    if (!src || container.dataset.vehiclePreviewItemId !== entry.itemId) {
      return;
    }

    container.replaceChildren(createSnapshotImage(entry.definition, src));
  }

  update(deltaSeconds = 0) {
    if (!this.active || !this.liveVehicle || this.liveVehiclePromise) {
      return;
    }

    this.liveVehicle.object.rotation.y += Math.max(0, Number(deltaSeconds) || 0) * LIVE_VEHICLE_ROTATION_SPEED;
    this.frameLivePreview();
    this.renderLivePreview();
  }
}
