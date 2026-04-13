import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createInPlaceClip, MIXAMO_BONES, validateMixamoHumanoid } from '../animation/humanoid.js';
import { getMixamoClip, preloadMixamoClips } from '../animation/mixamoClips.js';
import {
  DEFAULT_VIBE_SHADER_PRESET_ID,
  NO_VIBE_SHADER_PRESET_ID,
  createVibeShaderDefinition,
  getVibeShaderPreset
} from '../game/vibeShaderPresets.js';
import { createClassicBotCharacter } from '../player/classicBotCharacter.js';
import { getPlayableCharacterById } from '../player/playableCharacterCatalog.js';

const LIVE_PREVIEW_SIZE = Object.freeze({ width: 720, height: 520 });
const PORTRAIT_SIZE = Object.freeze({ width: 220, height: 220 });
const PREVIEW_CHARACTER_HEIGHT = 4.8;
const PORTRAIT_SNAPSHOT_TIME_SECONDS = 0.22;
const LIVE_PREVIEW_SHADER_INTENSITY_SCALE = 1;
const PORTRAIT_PREVIEW_SHADER_INTENSITY_SCALE = 0.88;
const PREVIEW_BACKGROUND_COLORS = Object.freeze({
  live: 0x000000,
  portrait: 0x000000
});
const LIVE_PREVIEW_PROFILE = Object.freeze({
  fitHeightFraction: 0.88,
  fitWidthFraction: 0.72,
  topPaddingRatio: 0.08,
  bottomPaddingRatio: 0.05,
  distanceMultiplier: 1.03,
  cameraLiftRatio: 0.02,
  cameraXRatio: 0.04
});
const PORTRAIT_PREVIEW_PROFILE = Object.freeze({
  fitHeightFraction: 0.82,
  fitWidthFraction: 0.72,
  topPaddingRatio: 0.08,
  bottomPaddingRatio: 0.08,
  distanceMultiplier: 1.18,
  cameraLiftRatio: 0.02,
  cameraXRatio: 0
});
export const MUGSHOT_EXPORT_SIZE = Object.freeze({ width: 512, height: 512 });
export const MUGSHOT_EXPORT_PROFILE = Object.freeze({
  fitHeightFraction: 0.58,
  fitWidthFraction: 0.56,
  topPaddingRatio: 0.05,
  bottomPaddingRatio: 0.29,
  distanceMultiplier: 1.02,
  cameraLiftRatio: 0.12,
  cameraXRatio: 0
});
export const DEFAULT_MUGSHOT_CAMERA_PRESET = Object.freeze({
  yawDegrees: 0,
  zoom: 1,
  focusXRatio: 0,
  focusYRatio: 0
});

function clampVibeIntensity(value) {
  return THREE.MathUtils.clamp(Number.isFinite(value) ? value : 1, 0, 1);
}

function normalizePortraitCameraPreset(preset = {}) {
  return {
    yawDegrees: Number.isFinite(preset?.yawDegrees) ? preset.yawDegrees : DEFAULT_MUGSHOT_CAMERA_PRESET.yawDegrees,
    zoom: THREE.MathUtils.clamp(
      Number.isFinite(preset?.zoom) ? preset.zoom : DEFAULT_MUGSHOT_CAMERA_PRESET.zoom,
      0.7,
      3
    ),
    focusXRatio: THREE.MathUtils.clamp(
      Number.isFinite(preset?.focusXRatio) ? preset.focusXRatio : DEFAULT_MUGSHOT_CAMERA_PRESET.focusXRatio,
      -0.45,
      0.45
    ),
    focusYRatio: THREE.MathUtils.clamp(
      Number.isFinite(preset?.focusYRatio) ? preset.focusYRatio : DEFAULT_MUGSHOT_CAMERA_PRESET.focusYRatio,
      -0.45,
      1
    )
  };
}

function applyPortraitCameraPreset(profile, preset = DEFAULT_MUGSHOT_CAMERA_PRESET) {
  const normalizedPreset = normalizePortraitCameraPreset(preset);
  const baseFitHeightFraction = profile?.fitHeightFraction ?? PORTRAIT_PREVIEW_PROFILE.fitHeightFraction;
  const baseFitWidthFraction = profile?.fitWidthFraction ?? PORTRAIT_PREVIEW_PROFILE.fitWidthFraction;
  const baseDistanceMultiplier = profile?.distanceMultiplier ?? PORTRAIT_PREVIEW_PROFILE.distanceMultiplier;

  return {
    ...(profile ?? {}),
    fitHeightFraction: THREE.MathUtils.clamp(baseFitHeightFraction, 0.1, 0.98),
    fitWidthFraction: THREE.MathUtils.clamp(baseFitWidthFraction, 0.1, 0.98),
    distanceMultiplier: Math.max(0.16, baseDistanceMultiplier / normalizedPreset.zoom),
    focusXRatio: (profile?.focusXRatio ?? 0) + normalizedPreset.focusXRatio,
    focusYRatio: (profile?.focusYRatio ?? 0) + normalizedPreset.focusYRatio
  };
}

function createPreviewVibeShaderDefinition() {
  const definition = createVibeShaderDefinition();
  definition.fragmentShader = definition.fragmentShader
    .replace(
      'vec3 baseColor = texture2D(tDiffuse, uv).rgb;',
      'vec4 baseSample = texture2D(tDiffuse, uv);\n        vec3 baseColor = baseSample.rgb;\n        float baseAlpha = baseSample.a;'
    )
    .replace(
      'gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);',
      'gl_FragColor = vec4(clamp(color, 0.0, 1.0), baseAlpha);'
    );
  return definition;
}

function waitForAnimationFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

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
  const fitHeightFraction = THREE.MathUtils.clamp(profile.fitHeightFraction ?? 0.88, 0.1, 0.98);
  const fitWidthFraction = THREE.MathUtils.clamp(profile.fitWidthFraction ?? 0.72, 0.1, 0.98);
  const visibleHeightFromHeight = size.y / fitHeightFraction;
  const visibleHeightFromWidth = size.x / Math.max(fitWidthFraction * camera.aspect, 0.01);
  const visibleHeight = Math.max(visibleHeightFromHeight, visibleHeightFromWidth, 1.2);
  const distance = (visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * (profile.distanceMultiplier ?? 1);
  const bottomPaddingRatio = THREE.MathUtils.clamp(profile.bottomPaddingRatio ?? 0.05, 0, 0.45);
  const focusX = focus.x + (size.x * (profile.focusXRatio ?? 0));
  const focusY = bounds.min.y + (visibleHeight * (0.5 - bottomPaddingRatio + (profile.focusYRatio ?? 0)));
  const cameraLift = visibleHeight * (profile.cameraLiftRatio ?? 0);
  camera.position.set(
    focusX + (size.x * profile.cameraXRatio),
    focusY + cameraLift,
    focus.z + distance
  );
  camera.lookAt(focusX, focusY, focus.z);
  camera.updateProjectionMatrix();
}

function detachObject(root) {
  root?.parent?.remove(root);
}

function syncRigPostProcessingResolution(rig) {
  if (!rig.vibeShaderPass?.uniforms?.uResolution) {
    return;
  }

  rig.renderer.getDrawingBufferSize(rig.postProcessingResolution);
  rig.vibeShaderPass.uniforms.uResolution.value.copy(rig.postProcessingResolution);
}

function applyVibeStateToRig(rig, { presetId, intensity }) {
  if (!rig.vibeShaderPass?.uniforms) {
    return;
  }

  const preset = getVibeShaderPreset(presetId);
  rig.vibeShaderPass.uniforms.uPreset.value = preset.index;
  rig.vibeShaderPass.uniforms.uIntensity.value = clampVibeIntensity(intensity * (rig.vibeIntensityScale ?? 1));
  syncRigPostProcessingResolution(rig);
}

function resizeRig(rig, width, height) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  if (rig.size.width === safeWidth && rig.size.height === safeHeight) {
    return;
  }

  rig.size.width = safeWidth;
  rig.size.height = safeHeight;
  rig.camera.aspect = safeWidth / safeHeight;
  rig.camera.updateProjectionMatrix();
  rig.renderer.setSize(safeWidth, safeHeight, false);
  rig.composer?.setSize(safeWidth, safeHeight);
  syncRigPostProcessingResolution(rig);
}

function syncRigToContainer(rig, container) {
  if (!container) {
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width > 0 && height > 0) {
    resizeRig(rig, width, height);
  }
}

function renderRig(rig, vibeShaderState) {
  const shouldUseShader = (
    rig.shaderPostProcessAvailable
    && vibeShaderState.presetId !== NO_VIBE_SHADER_PRESET_ID
  );

  if (shouldUseShader && rig.composer && rig.vibeShaderPass?.uniforms) {
    applyVibeStateToRig(rig, vibeShaderState);
    rig.vibeShaderPass.uniforms.uTime.value = performance.now() * 0.001;
    try {
      rig.composer.render();
      return;
    } catch (error) {
      if (!rig.shaderPostProcessFailed) {
        rig.shaderPostProcessFailed = true;
        console.error('[CharacterSelector] Preview shader failed. Falling back to plain renderer.', {
          mode: rig.mode,
          error
        });
      }
    }
  }

  rig.renderer.render(rig.scene, rig.camera);
}

function createPreviewRig({ width, height, mode = 'live' }) {
  const isPortrait = mode === 'portrait';
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: isPortrait
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.setClearColor(PREVIEW_BACKGROUND_COLORS[mode] ?? PREVIEW_BACKGROUND_COLORS.live, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(28, width / height, 0.1, 256);
  const objectRoot = new THREE.Group();

  const hemi = new THREE.HemisphereLight(0xf0f6ff, 0x222222, isPortrait ? 2.8 : 2.5);
  const sun = new THREE.DirectionalLight(0xfff1d4, isPortrait ? 3.35 : 3);
  const fill = new THREE.DirectionalLight(0xffffff, isPortrait ? 1.95 : 1.55);
  const rim = new THREE.DirectionalLight(0xa6d5ff, isPortrait ? 1.25 : 1.05);
  const bounce = new THREE.DirectionalLight(0xffd7a6, isPortrait ? 0.35 : 0.32);

  sun.position.set(18, 28, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 50;
  fill.position.set(-8, 11, 13);
  rim.position.set(-9, 8, -10);
  bounce.position.set(0, 2, 7);

  scene.add(hemi, sun, fill, rim, bounce, objectRoot);

  let composer = null;
  let renderPass = null;
  let vibeShaderPass = null;
  let outputPass = null;
  let shaderPostProcessAvailable = false;
  try {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    composer.setSize(width, height);

    renderPass = new RenderPass(scene, camera);
    renderPass.clearAlpha = 0;
    vibeShaderPass = new ShaderPass(createPreviewVibeShaderDefinition());
    outputPass = new OutputPass();

    composer.addPass(renderPass);
    composer.addPass(vibeShaderPass);
    composer.addPass(outputPass);
    shaderPostProcessAvailable = true;
  } catch (error) {
    console.error('[CharacterSelector] Failed to create preview shader pipeline. Falling back to plain renderer.', {
      mode,
      error
    });
  }

  const rig = {
    mode,
    renderer,
    scene,
    camera,
    composer,
    renderPass,
    vibeShaderPass,
    outputPass,
    objectRoot,
    size: { width, height },
    vibeIntensityScale: isPortrait ? PORTRAIT_PREVIEW_SHADER_INTENSITY_SCALE : LIVE_PREVIEW_SHADER_INTENSITY_SCALE,
    shaderPostProcessAvailable,
    shaderPostProcessFailed: false,
    postProcessingResolution: new THREE.Vector2()
  };

  syncRigPostProcessingResolution(rig);
  return rig;
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
  constructor({
    library,
    portraitSnapshotSize = PORTRAIT_SIZE,
    portraitSnapshotProfile = PORTRAIT_PREVIEW_PROFILE
  }) {
    this.library = library;
    this.active = false;
    this.liveMount = null;
    this.portraitSnapshotProfile = portraitSnapshotProfile;
    this.vibeShaderState = {
      presetId: DEFAULT_VIBE_SHADER_PRESET_ID,
      intensity: 1
    };
    this.livePreview = createPreviewRig({ ...LIVE_PREVIEW_SIZE, mode: 'live' });
    this.portraitSnapshotRig = createPreviewRig({ ...portraitSnapshotSize, mode: 'portrait' });
    this.liveCharacter = null;
    this.liveCharacterPromise = null;
    this.liveCharacterRequestId = 0;
    this.portraitEntries = new Map();
    this.portraitDirtyIds = new Set();
    this.pendingPortraitIds = new Set();
    this.portraitVersion = 0;
    this.portraitGenerationPromise = null;

    this.livePreview.renderer.domElement.className = 'hud__character-stage-canvas';
    renderRig(this.livePreview, this.vibeShaderState);
  }

  mount(container) {
    if (!container || container.contains(this.livePreview.renderer.domElement)) {
      this.liveMount = container ?? this.liveMount;
      syncRigToContainer(this.livePreview, this.liveMount);
      return;
    }

    this.liveMount = container;
    syncRigToContainer(this.livePreview, this.liveMount);
    container.replaceChildren(this.livePreview.renderer.domElement);
  }

  setActive(isActive) {
    const nextActive = Boolean(isActive);
    if (this.active === nextActive) {
      if (nextActive) {
        this.renderLivePreview();
      }
      return this.active;
    }

    this.active = nextActive;
    if (this.active) {
      this.renderLivePreview();
      void this.refreshPortraits();
    }
    return this.active;
  }

  setVibeShaderState({ presetId = this.vibeShaderState.presetId, intensity = this.vibeShaderState.intensity } = {}) {
    const preset = getVibeShaderPreset(presetId);
    const nextState = {
      presetId: preset.id,
      intensity: clampVibeIntensity(intensity)
    };
    const changed = (
      nextState.presetId !== this.vibeShaderState.presetId
      || nextState.intensity !== this.vibeShaderState.intensity
    );

    this.vibeShaderState = nextState;
    applyVibeStateToRig(this.livePreview, this.vibeShaderState);
    applyVibeStateToRig(this.portraitSnapshotRig, this.vibeShaderState);

    if (changed) {
      this.invalidatePortraits();
      if (this.active) {
        this.renderLivePreview();
        void this.refreshPortraits();
      }
    }

    return this.vibeShaderState;
  }

  invalidatePortraits(characterIds = null) {
    const ids = Array.isArray(characterIds) && characterIds.length > 0
      ? characterIds.map((characterId) => getPlayableCharacterById(characterId).id)
      : [...this.portraitEntries.keys()];

    this.portraitVersion += 1;
    for (const characterId of ids) {
      this.portraitDirtyIds.add(characterId);
      this.pendingPortraitIds.add(characterId);
    }
  }

  getOrCreatePortraitEntry(characterId) {
    const target = getPlayableCharacterById(characterId);
    if (this.portraitEntries.has(target.id)) {
      return this.portraitEntries.get(target.id);
    }

    const imageNode = document.createElement('img');
    imageNode.className = 'hud__character-card-art';
    imageNode.alt = `${target.label} portrait`;
    imageNode.loading = 'lazy';
    imageNode.decoding = 'async';

    const entry = {
      characterId: target.id,
      node: imageNode,
      renderedVersion: -1,
      staticSrc: target.portraitStaticSrc ?? '',
      staticLoaded: false,
      staticLoadFailed: false,
      staticLoadPromise: null
    };

    this.portraitEntries.set(target.id, entry);
    this.portraitDirtyIds.add(target.id);
    return entry;
  }

  renderLivePreview() {
    syncRigToContainer(this.livePreview, this.liveMount);
    renderRig(this.livePreview, this.vibeShaderState);
  }

  async setCharacter(characterId) {
    const target = getPlayableCharacterById(characterId);
    if (this.liveCharacter?.characterId === target.id) {
      if (this.active) {
        this.renderLivePreview();
      }
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

        frameCamera(this.livePreview.camera, previewCharacter.character, LIVE_PREVIEW_PROFILE);
        if (this.active) {
          this.renderLivePreview();
        }
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
    if (!this.active) {
      return;
    }

    if (!this.liveCharacterPromise && this.liveCharacter) {
      this.liveCharacter.mixer.update(deltaSeconds);
      this.renderLivePreview();
    } else if (!this.liveCharacter) {
      this.renderLivePreview();
    }
  }

  async ensurePortraitPreview(characterId) {
    const entry = this.getOrCreatePortraitEntry(characterId);
    const staticLoaded = await this.ensureStaticPortrait(entry);
    if (staticLoaded) {
      return entry;
    }

    if (entry.node.src) {
      return entry;
    }

    await this.refreshPortraits([characterId]);
    return this.getOrCreatePortraitEntry(characterId);
  }

  async ensureStaticPortrait(entry) {
    if (!entry?.staticSrc || entry.staticLoadFailed) {
      return false;
    }

    if (entry.staticLoaded) {
      return true;
    }

    if (entry.staticLoadPromise) {
      return entry.staticLoadPromise;
    }

    entry.staticLoadPromise = new Promise((resolve) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        entry.staticLoaded = true;
        entry.staticLoadPromise = null;
        entry.node.src = entry.staticSrc;
        resolve(true);
      };
      image.onerror = () => {
        entry.staticLoadFailed = true;
        entry.staticLoadPromise = null;
        resolve(false);
      };
      image.src = entry.staticSrc;
    });

    return entry.staticLoadPromise;
  }

  async renderPortraitSnapshot(characterId, expectedVersion = this.portraitVersion, options = {}) {
    const target = getPlayableCharacterById(characterId);
    const entry = this.getOrCreatePortraitEntry(target.id);
    const rig = this.portraitSnapshotRig;
    const portraitPreset = normalizePortraitCameraPreset(options?.portraitPreset ?? DEFAULT_MUGSHOT_CAMERA_PRESET);
    const snapshotProfile = applyPortraitCameraPreset(
      options?.profile ?? this.portraitSnapshotProfile,
      portraitPreset
    );
    const previewCharacter = await instantiatePreviewCharacter(
      this.library,
      target.id,
      target.portraitClip ?? target.idleClip
    );

    try {
      rig.objectRoot.clear();
      previewCharacter.character.rotation.y = THREE.MathUtils.degToRad(portraitPreset.yawDegrees);
      rig.objectRoot.add(previewCharacter.character);

      frameCamera(rig.camera, previewCharacter.character, snapshotProfile);

      previewCharacter.mixer.update(0);
      renderRig(rig, this.vibeShaderState);
      await waitForAnimationFrame();

      previewCharacter.mixer.update(PORTRAIT_SNAPSHOT_TIME_SECONDS);
      renderRig(rig, this.vibeShaderState);
      await waitForAnimationFrame();

      renderRig(rig, this.vibeShaderState);
      const imageSrc = rig.renderer.domElement.toDataURL('image/png');

      if (expectedVersion === this.portraitVersion || !entry.node.src) {
        entry.node.src = imageSrc;
        entry.renderedVersion = expectedVersion;
      }

      if (expectedVersion === this.portraitVersion) {
        this.portraitDirtyIds.delete(target.id);
      }
    } finally {
      rig.objectRoot.remove(previewCharacter.character);
      detachObject(previewCharacter.character);
    }

    return entry;
  }

  async renderPortraitDataUrl(characterId, options = {}) {
    const entry = await this.renderPortraitSnapshot(characterId, this.portraitVersion, options);
    return entry.node.src || '';
  }

  async refreshPortraits(characterIds = null) {
    const ids = Array.isArray(characterIds) && characterIds.length > 0
      ? characterIds.map((characterId) => this.getOrCreatePortraitEntry(characterId).characterId)
      : [...this.portraitEntries.keys()];

    const dynamicIds = [];

    for (const characterId of ids) {
      const entry = this.getOrCreatePortraitEntry(characterId);
      const staticLoaded = await this.ensureStaticPortrait(entry);
      if (staticLoaded) {
        continue;
      }

      this.portraitDirtyIds.add(characterId);
      this.pendingPortraitIds.add(characterId);
      dynamicIds.push(characterId);
    }

    if (!this.active || dynamicIds.length === 0 || this.pendingPortraitIds.size === 0) {
      return;
    }

    if (this.portraitGenerationPromise) {
      return this.portraitGenerationPromise;
    }

    const task = (async () => {
      while (this.active) {
        const queuedIds = [...this.pendingPortraitIds].filter((characterId) => this.portraitDirtyIds.has(characterId));
        if (queuedIds.length === 0) {
          break;
        }

        this.pendingPortraitIds.clear();
        const versionAtStart = this.portraitVersion;
        for (const characterId of queuedIds) {
          if (!this.active || !this.portraitDirtyIds.has(characterId)) {
            continue;
          }

          try {
            await this.renderPortraitSnapshot(characterId, versionAtStart);
          } catch (error) {
            console.error('[CharacterSelector] Failed to render portrait snapshot.', {
              characterId,
              error
            });
          }
        }
      }
    })()
      .finally(() => {
        if (this.portraitGenerationPromise === task) {
          this.portraitGenerationPromise = null;
        }

        if (this.active) {
          const remainingDirtyIds = [...this.portraitDirtyIds].filter((characterId) => this.pendingPortraitIds.has(characterId));
          if (remainingDirtyIds.length > 0) {
            void this.refreshPortraits(remainingDirtyIds);
          }
        }
      });

    this.portraitGenerationPromise = task;
    return task;
  }

  async mountPortraitCanvas(characterId, container) {
    if (!container) {
      return;
    }

    const entry = await this.ensurePortraitPreview(characterId);
    if (entry.node.src && !container.contains(entry.node)) {
      container.replaceChildren(entry.node);
    }

    if (!this.active || entry.staticLoaded) {
      return;
    }

    await this.refreshPortraits([entry.characterId]);
    if (entry.node.src && !container.contains(entry.node)) {
      container.replaceChildren(entry.node);
    }
  }
}
