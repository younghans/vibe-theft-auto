import * as THREE from 'three';
import { createInPlaceClip, MIXAMO_BONES, validateMixamoHumanoid } from '../animation/humanoid.js';
import { getMixamoClip, preloadMixamoClips } from '../animation/mixamoClips.js';
import { createClassicBotCharacter } from '../player/classicBotCharacter.js';
import { getPlayableCharacterById } from '../player/playableCharacterCatalog.js';

const LIVE_PREVIEW_SIZE = Object.freeze({ width: 720, height: 520 });
const PORTRAIT_SIZE = Object.freeze({ width: 220, height: 220 });
const PREVIEW_CHARACTER_HEIGHT = 4.8;
const PORTRAIT_SNAPSHOT_TIME_SECONDS = 0.22;
const LIVE_PREVIEW_PROFILE = Object.freeze({
  framedHeightRatio: 0.78,
  distanceMultiplier: 1.1,
  focusYRatio: 0.62,
  cameraHeightRatio: 0.16,
  cameraXRatio: 0.08
});
const PORTRAIT_PREVIEW_PROFILE = Object.freeze({
  framedHeightRatio: 0.52,
  distanceMultiplier: 1.3,
  focusYRatio: 0.68,
  cameraHeightRatio: 0.12,
  cameraXRatio: 0
});

function normalizeCharacter(root, targetHeight = PREVIEW_CHARACTER_HEIGHT) {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = size.y > 0 ? targetHeight / size.y : 1;
  root.scale.multiplyScalar(scale);

  const groundedBounds = new THREE.Box3().setFromObject(root);
  root.position.y -= groundedBounds.min.y;
}

function prepareCharacter(root) {
  root.traverse((node) => {
    if (!node.isMesh) {
      return;
    }

    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function frameCamera(camera, object, profile = LIVE_PREVIEW_PROFILE) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const focus = bounds.getCenter(new THREE.Vector3());
  const framedHeight = Math.max(size.y * profile.framedHeightRatio, 1.2);
  const distance = (framedHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * profile.distanceMultiplier;
  const focusY = bounds.min.y + (size.y * profile.focusYRatio);
  camera.position.set(
    focus.x + (size.x * profile.cameraXRatio),
    focusY + (size.y * profile.cameraHeightRatio),
    focus.z + distance
  );
  camera.lookAt(focus.x, focusY, focus.z);
  camera.updateProjectionMatrix();
}

function detachObject(root) {
  root?.parent?.remove(root);
}

function createPreviewRig({ width, height, mode = 'live' }) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 256);
  const objectRoot = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 56),
    new THREE.MeshPhongMaterial({
      color: 0x111f30,
      transparent: true,
      opacity: 0.8,
      shininess: 18
    })
  );

  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;

  const isPortrait = mode === 'portrait';
  const fill = new THREE.AmbientLight(isPortrait ? 0xfff6e5 : 0xf3f0e8, isPortrait ? 2.8 : 2.1);
  const key = new THREE.DirectionalLight(isPortrait ? 0xfff0c1 : 0xffe8b1, isPortrait ? 2.35 : 1.9);
  const rim = new THREE.DirectionalLight(isPortrait ? 0x8fc6ff : 0x7cbcff, isPortrait ? 1.35 : 1.1);
  const front = new THREE.DirectionalLight(0xffffff, isPortrait ? 1.2 : 0.45);

  key.position.set(5, 8, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  rim.position.set(-4, 5, -6);
  front.position.set(0.8, 4.8, 7.5);

  scene.add(fill, key, rim, front, floor, objectRoot);

  return {
    renderer,
    scene,
    camera,
    objectRoot,
    floor
  };
}

async function instantiatePreviewCharacter(library, characterId, clipName) {
  const definition = getPlayableCharacterById(characterId);
  await preloadMixamoClips([clipName]);
  const source = await library.instantiate(definition.characterRig);
  const character = definition.characterVariant === 'classicBot'
    ? createClassicBotCharacter(source)
    : source;
  const humanoid = validateMixamoHumanoid(character);

  if (!humanoid.isHumanoid) {
    throw new Error(`Character "${definition.id}" is missing Mixamo humanoid bones.`);
  }

  prepareCharacter(character);
  normalizeCharacter(character);
  character.rotation.y = THREE.MathUtils.degToRad(10);

  const mixer = new THREE.AnimationMixer(character);
  const clip = createInPlaceClip(getMixamoClip(clipName), MIXAMO_BONES.hips);
  const action = mixer.clipAction(clip);
  action.enabled = true;
  action.play();

  return {
    characterId: definition.id,
    definition,
    character,
    mixer
  };
}

export class CharacterPreviewRenderer {
  constructor({ library }) {
    this.library = library;
    this.livePreview = createPreviewRig(LIVE_PREVIEW_SIZE);
    this.liveCharacter = null;
    this.liveCharacterPromise = null;
    this.liveCharacterRequestId = 0;
    this.portraitEntries = new Map();

    this.livePreview.renderer.domElement.className = 'hud__character-stage-canvas';
    this.livePreview.renderer.render(this.livePreview.scene, this.livePreview.camera);
  }

  mount(container) {
    if (!container || container.contains(this.livePreview.renderer.domElement)) {
      return;
    }

    container.replaceChildren(this.livePreview.renderer.domElement);
  }

  async setCharacter(characterId) {
    const target = getPlayableCharacterById(characterId);
    if (this.liveCharacter?.characterId === target.id) {
      return this.liveCharacter;
    }

    const requestId = ++this.liveCharacterRequestId;
    const request = instantiatePreviewCharacter(this.library, target.id, target.previewClip)
      .then((previewCharacter) => {
        if (requestId !== this.liveCharacterRequestId) {
          detachObject(previewCharacter.character);
          return this.liveCharacter;
        }

        if (this.liveCharacter) {
          this.livePreview.objectRoot.remove(this.liveCharacter.character);
          detachObject(this.liveCharacter.character);
        }

        this.liveCharacter = previewCharacter;
        this.livePreview.objectRoot.add(previewCharacter.character);

        const bounds = new THREE.Box3().setFromObject(previewCharacter.character);
        const size = bounds.getSize(new THREE.Vector3());
        this.livePreview.floor.scale.setScalar(Math.max(size.x, size.z, 2.5) * 0.88);
        frameCamera(this.livePreview.camera, previewCharacter.character, LIVE_PREVIEW_PROFILE);
        this.livePreview.renderer.render(this.livePreview.scene, this.livePreview.camera);
        return previewCharacter;
      })
      .finally(() => {
        if (this.liveCharacterPromise === request) {
          this.liveCharacterPromise = null;
        }
      });

    this.liveCharacterPromise = request;
    return request;
  }

  update(deltaSeconds) {
    if (!this.liveCharacterPromise && this.liveCharacter) {
      this.liveCharacter.mixer.update(deltaSeconds);
      this.livePreview.renderer.render(this.livePreview.scene, this.livePreview.camera);
    }

    for (const entry of this.portraitEntries.values()) {
      entry.rig.renderer.render(entry.rig.scene, entry.rig.camera);
    }
  }

  async ensurePortraitPreview(characterId) {
    const target = getPlayableCharacterById(characterId);
    if (this.portraitEntries.has(target.id)) {
      return this.portraitEntries.get(target.id);
    }

    const rig = createPreviewRig({ ...PORTRAIT_SIZE, mode: 'portrait' });
    rig.renderer.domElement.className = 'hud__character-card-canvas';
    const previewCharacter = await instantiatePreviewCharacter(
      this.library,
      target.id,
      target.portraitClip ?? target.idleClip
    );
    previewCharacter.character.rotation.y = 0;
    rig.objectRoot.add(previewCharacter.character);

    const bounds = new THREE.Box3().setFromObject(previewCharacter.character);
    const size = bounds.getSize(new THREE.Vector3());
    rig.floor.scale.setScalar(Math.max(size.x, size.z, 2.2) * 0.82);
    frameCamera(rig.camera, previewCharacter.character, PORTRAIT_PREVIEW_PROFILE);
    previewCharacter.mixer.update(PORTRAIT_SNAPSHOT_TIME_SECONDS);
    rig.renderer.render(rig.scene, rig.camera);

    const entry = {
      characterId: target.id,
      rig,
      previewCharacter
    };
    this.portraitEntries.set(target.id, entry);
    return entry;
  }

  async mountPortraitCanvas(characterId, container) {
    if (!container) {
      return;
    }

    const entry = await this.ensurePortraitPreview(characterId);
    const node = entry.rig.renderer.domElement;
    if (!container.contains(node)) {
      container.replaceChildren(node);
    }
  }
}
