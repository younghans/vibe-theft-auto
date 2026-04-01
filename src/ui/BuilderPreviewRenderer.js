import * as THREE from 'three';

const PREVIEW_WIDTH = 208;
const PREVIEW_HEIGHT = 132;

function getPreviewProfile(item) {
  if (item.layer === 'tile' && (item.groupId === 'streets' || item.groupId === 'parks')) {
    return {
      rotationY: 0,
      fitZoom: item.groupId === 'parks' ? 1.42 : 1.34,
      floorScale: 0.54,
      view: 'top'
    };
  }

  if (item.layer === 'tile' && item.assetName === 'base') {
    return {
      rotationY: 0,
      fitZoom: 1.2,
      floorScale: 0.56,
      view: 'top'
    };
  }

  return {
    rotationY: item.layer === 'tile' ? Math.PI / 4 : Math.PI / 5,
    fitZoom: 1,
    floorScale: 0.66,
    view: 'isometric'
  };
}

function fitObjectToPreview(object, item, profile) {
  if (!item?.size) {
    return;
  }

  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const scaleX = size.x > 0 ? item.size[0] / size.x : 1;
  const scaleZ = size.z > 0 ? item.size[1] / size.z : 1;
  object.scale.multiplyScalar(Math.min(scaleX, scaleZ) * (profile?.fitZoom ?? 1));
}

function groundObject(object) {
  const bounds = new THREE.Box3().setFromObject(object);
  const center = bounds.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= bounds.min.y;
}

function frameCamera(camera, object, profile) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const focus = bounds.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y * 0.9, size.z, 1);
  const distance = (maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * 1.5;

  if (profile?.view === 'top') {
    camera.position.set(0, Math.max(distance * 1.06, size.y + 9), 0.01);
    camera.lookAt(focus.x, Math.max(size.y * 0.1, 0.18), focus.z);
    camera.updateProjectionMatrix();
    return;
  }

  camera.position.set(distance * 0.88, size.y * 0.72 + distance * 0.28, distance * 0.94);
  camera.lookAt(focus.x, Math.max(size.y * 0.28, 0.8), focus.z);
  camera.updateProjectionMatrix();
}

export class BuilderPreviewRenderer {
  constructor({ library }) {
    this.library = library;
    this.cache = new Map();
    this.pending = new Map();
    this.renderQueue = Promise.resolve();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(PREVIEW_WIDTH, PREVIEW_HEIGHT, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, PREVIEW_WIDTH / PREVIEW_HEIGHT, 0.1, 256);
    this.objectRoot = new THREE.Group();
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshPhongMaterial({
        color: 0x102034,
        transparent: true,
        opacity: 0.72,
        shininess: 10
      })
    );

    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.01;

    const ambient = new THREE.AmbientLight(0xf6f1e5, 2.2);
    const key = new THREE.DirectionalLight(0xffffff, 1.85);
    const rim = new THREE.DirectionalLight(0x8cc8ff, 1.1);

    key.position.set(5, 8, 6);
    rim.position.set(-4, 5, -7);

    this.scene.add(ambient, key, rim, this.floor, this.objectRoot);
  }

  async render(item) {
    if (this.cache.has(item.id)) {
      return this.cache.get(item.id);
    }

    if (this.pending.has(item.id)) {
      return this.pending.get(item.id);
    }

    const request = this.renderQueue
      .catch(() => {})
      .then(() => this.renderInternal(item))
      .then((preview) => {
        this.cache.set(item.id, preview);
        this.pending.delete(item.id);
        return preview;
      })
      .catch((error) => {
        this.pending.delete(item.id);
        throw error;
      });

    this.renderQueue = request.catch(() => {});
    this.pending.set(item.id, request);
    return request;
  }

  async renderInternal(item) {
    this.objectRoot.clear();
    const profile = getPreviewProfile(item);

    const object = await this.library.instantiate(item.asset);
    object.rotation.y = profile.rotationY;

    fitObjectToPreview(object, item, profile);
    groundObject(object);
    this.objectRoot.add(object);

    const bounds = new THREE.Box3().setFromObject(object);
    const size = bounds.getSize(new THREE.Vector3());
    this.floor.scale.setScalar(Math.max(size.x, size.z, 2.6) * profile.floorScale);

    frameCamera(this.camera, object, profile);
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
