import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Input } from './Input.js';
import {
  DEFAULT_VIBE_SHADER_PRESET_ID,
  NO_VIBE_SHADER_PRESET_ID,
  VIBE_SHADER_PRESETS,
  createVibeShaderDefinition,
  getVibeShaderPreset
} from './vibeShaderPresets.js';
import { Hud } from '../ui/Hud.js';
import {
  ATTACHMENT_SLOTS,
  HELD_ITEM_AIM_POSE_FIELDS,
  HELD_ITEM_IDS,
  getHeldItemAssetUrl,
  listHeldItemDefinitions,
  prepareHeldItemModel
} from '../shared/heldItemDefinitions.js';
import {
  WORLD_FOG_FAR,
  WORLD_FOG_NEAR,
  WORLD_GROUND_RADIUS,
  WORLD_SHADOW_EXTENT
} from '../shared/worldConstants.js';
import { ModelLibrary } from '../world/ModelLibrary.js';
import { buildCity } from '../world/buildCity.js';
import { WorldBuilder } from '../world/WorldBuilder.js';
import { createPlayer } from '../player/createPlayer.js';
import { EMOTE_SLOTS } from '../player/emotes.js';
import { createNpcService } from '../npc/createNpcService.js';
import { PLAYER_MAX_HEALTH, PLAYER_RADIUS } from '../shared/combatConstants.js';

const CAMERA_OFFSET = new THREE.Vector3(0, 26, 18);
const CAMERA_LOOK_OFFSET = new THREE.Vector3(0, 3, 0);
const AIM_CAMERA_OFFSET = new THREE.Vector3(0, 27.1, 18.9);
const CAMERA_ZOOM_LEVELS = [0.82, 0.92, 1, 1.12, 1.26];
const DEFAULT_CAMERA_ZOOM_INDEX = 2;
const AIM_DIRECTION_MIN_DISTANCE = 3;
const PROJECTILE_VISUAL_SPEED = 48;
const PROJECTILE_MIN_LIFETIME_MS = 120;
const PROJECTILE_MAX_LIFETIME_MS = 260;
const IMPACT_EFFECT_LIFETIME_MS = 140;
const PROJECTILE_TRAIL_LENGTH = 1.9;
const HIP_FIRE_AIM_LEAD_MS = 90;
const HIP_FIRE_AIM_HOLD_MS = 120;
const SHOT_COLLISION_ORIGIN_FORWARD_OFFSET = PLAYER_RADIUS * 1.15;
const EMOTE_MENU_DEADZONE = 54;
const CHAT_BUBBLE_MIN_LIFETIME_MS = 2600;
const CHAT_BUBBLE_MAX_LIFETIME_MS = 12000;
const CHAT_BUBBLE_BASE_LIFETIME_MS = 1800;
const CHAT_BUBBLE_MS_PER_WORD = 360;
const ZERO_INPUT = { getMovementVector: () => ({ x: 0, z: 0 }) };
const DEFAULT_VIBE_SHADER_INTENSITY = 1;

function clampVibeShaderIntensity(value) {
  return THREE.MathUtils.clamp(
    Number.isFinite(value) ? value : DEFAULT_VIBE_SHADER_INTENSITY,
    0,
    1
  );
}

function isLocalDebugHost() {
  const hostname = globalThis.location?.hostname ?? '';
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function getChatBubbleLifetimeMs(text) {
  const normalized = String(text ?? '').trim();
  if (!normalized) {
    return CHAT_BUBBLE_MIN_LIFETIME_MS;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  const estimatedWordCount = Math.max(wordCount, Math.ceil(normalized.length / 6));
  const lifetime = CHAT_BUBBLE_BASE_LIFETIME_MS + estimatedWordCount * CHAT_BUBBLE_MS_PER_WORD;
  return THREE.MathUtils.clamp(
    lifetime,
    CHAT_BUBBLE_MIN_LIFETIME_MS,
    CHAT_BUBBLE_MAX_LIFETIME_MS
  );
}

export class Game {
  constructor(root) {
    this.root = root;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7da6c8);
    this.scene.fog = new THREE.Fog(0x7da6c8, WORLD_FOG_NEAR, WORLD_FOG_FAR);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camera.position.copy(CAMERA_OFFSET);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.postProcessingResolution = new THREE.Vector2();
    this.setupPostProcessing();

    this.root.append(this.renderer.domElement);
    this.renderer.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });

    this.hud = new Hud(this.root);
    this.input = new Input();
    this.library = new ModelLibrary();
    this.remotePlayers = new Map();
    this.pendingRemotePlayers = new Set();
    this.pickupVisuals = new Map();
    this.pendingPickupVisuals = new Set();
    this.combatEffects = [];
    this.currentInteractable = null;
    this.currentLayout = null;
    this.lastNpcTransportSignature = '';
    this.pendingWorldPatches = [];
    this.worldLayoutReady = false;
    this.worldPatchUnsubscribe = null;
    this.combatEventUnsubscribe = null;
    this.npcService = null;
    this.npcServiceState = {
      transport: 'mock',
      connected: true,
      sessionId: 'local-player',
      players: new Map(),
      builders: new Map(),
      npcs: new Map(),
      pickups: new Map()
    };
    this.emoteMenuOpen = false;
    this.projectedSpeechPosition = new THREE.Vector3();
    this.aimRaycaster = new THREE.Raycaster();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.aimTarget = new THREE.Vector3();
    this.currentAimDirection = new THREE.Vector3(0, 0, 1);
    this.currentAimMode = false;
    this.pendingHipFireShot = null;
    this.aimPoseDebugVisible = false;
    this.aimPoseDebugShowSkeleton = false;
    this.shaderDebugMenuVisible = false;
    this.activeVibeShaderPresetId = DEFAULT_VIBE_SHADER_PRESET_ID;
    this.vibeShaderPresetIntensities = new Map(
      VIBE_SHADER_PRESETS.map((preset) => [preset.id, DEFAULT_VIBE_SHADER_INTENSITY])
    );
    this.cameraZoomIndex = DEFAULT_CAMERA_ZOOM_INDEX;
    this.localStateInitialized = false;
    this.lastLocalAlive = true;
    this.lastHudHitMarkerVisible = false;
    this.hitMarkerUntil = 0;

    this.hud.bindInteractionEvents({
      onAction: () => {},
      onCloseInteraction: () => this.hud.hideInteractionMenu()
    });
    this.hud.bindQuickChatEvents({
      onSubmit: (message) => void this.handleQuickChatSubmit(message),
      onCancel: () => this.closeQuickChat()
    });
    this.hud.bindAimPoseDebugEvents({
      onTogglePanel: () => this.toggleAimPoseDebugPanel(),
      onFieldChange: (fieldKey, value) => this.setAimPoseDebugField(fieldKey, value),
      onReset: () => this.resetAimPoseDebug(),
      onPrint: () => this.printAimPoseDebug(),
      onToggleBones: () => this.toggleAimPoseSkeletonDebug()
    });
    this.hud.bindShaderDebugEvents({
      onToggleMenu: () => this.toggleShaderDebugMenu(),
      onCloseMenu: () => this.setShaderDebugMenuVisible(false),
      onSelectPreset: (presetId) => this.setVibeShaderPreset(presetId),
      onSetIntensity: (intensity) => this.setVibeShaderIntensity(intensity),
      onResetIntensity: () => this.resetVibeShaderIntensity()
    });
    this.hud.bindZoomEvents({
      onZoomIn: () => this.stepCameraZoom(-1),
      onZoomOut: () => this.stepCameraZoom(1)
    });
    this.refreshZoomHud();
    this.setVibeShaderPreset(DEFAULT_VIBE_SHADER_PRESET_ID, { announce: false });

    window.addEventListener('resize', () => this.onResize());
  }

  setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.composer.setSize(window.innerWidth, window.innerHeight);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.vibeShaderPass = new ShaderPass(createVibeShaderDefinition());
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.vibeShaderPass);
    this.composer.addPass(this.outputPass);
    this.updatePostProcessingResolution();
  }

  updatePostProcessingResolution() {
    if (!this.vibeShaderPass?.uniforms?.uResolution) {
      return;
    }

    this.renderer.getDrawingBufferSize(this.postProcessingResolution);
    this.vibeShaderPass.uniforms.uResolution.value.copy(this.postProcessingResolution);
  }

  getActiveVibeShaderPreset() {
    return getVibeShaderPreset(this.activeVibeShaderPresetId);
  }

  getVibeShaderIntensity(presetId = this.activeVibeShaderPresetId) {
    return clampVibeShaderIntensity(
      this.vibeShaderPresetIntensities.get(getVibeShaderPreset(presetId).id)
    );
  }

  setVibeShaderIntensity(intensity, { presetId = this.activeVibeShaderPresetId, announce = false } = {}) {
    const preset = getVibeShaderPreset(presetId);
    const nextIntensity = clampVibeShaderIntensity(intensity);
    this.vibeShaderPresetIntensities.set(preset.id, nextIntensity);

    if (preset.id === this.activeVibeShaderPresetId && this.vibeShaderPass?.uniforms?.uIntensity) {
      this.vibeShaderPass.uniforms.uIntensity.value = nextIntensity;
    }

    this.refreshShaderDebugHud();

    if (announce && preset.id !== NO_VIBE_SHADER_PRESET_ID) {
      this.hud.showToast(`${preset.label} intensity set to ${Math.round(nextIntensity * 100)}%.`);
    }

    return nextIntensity;
  }

  resetVibeShaderIntensity(options = {}) {
    return this.setVibeShaderIntensity(DEFAULT_VIBE_SHADER_INTENSITY, options);
  }

  setShaderDebugMenuVisible(visible) {
    const nextVisible = Boolean(visible);
    if (nextVisible) {
      this.setAimPoseDebugVisible(false);
      if (this.worldBuilder?.enabled) {
        void this.worldBuilder.setEnabled(false);
      }
    }

    this.shaderDebugMenuVisible = nextVisible;
    this.refreshShaderDebugHud();
    return this.shaderDebugMenuVisible;
  }

  toggleShaderDebugMenu() {
    const nextVisible = this.setShaderDebugMenuVisible(!this.shaderDebugMenuVisible);
    this.hud.showToast(nextVisible ? 'Shader vibe menu opened.' : 'Shader vibe menu hidden.');
    return nextVisible;
  }

  setVibeShaderPreset(presetId, { announce = true } = {}) {
    const preset = getVibeShaderPreset(presetId);
    this.activeVibeShaderPresetId = preset.id;
    const intensity = this.getVibeShaderIntensity(preset.id);

    if (this.vibeShaderPass?.uniforms?.uPreset) {
      this.vibeShaderPass.uniforms.uPreset.value = preset.index;
    }
    if (this.vibeShaderPass?.uniforms?.uIntensity) {
      this.vibeShaderPass.uniforms.uIntensity.value = intensity;
    }

    this.refreshShaderDebugHud();

    if (announce) {
      if (preset.id === NO_VIBE_SHADER_PRESET_ID) {
        this.hud.showToast('Default render pipeline restored.');
      } else {
        this.hud.showToast(`${preset.label} vibe enabled.`);
      }
    }

    return preset;
  }

  refreshShaderDebugHud() {
    const activePreset = this.getActiveVibeShaderPreset();
    const intensity = this.getVibeShaderIntensity(activePreset.id);
    const statusText = activePreset.id === NO_VIBE_SHADER_PRESET_ID
      ? 'Default render pipeline active. Pick a preset to remix the whole scene.'
      : `${activePreset.label} is live at ${Math.round(intensity * 100)}%. Switch presets anytime to totally restyle the city.`;

    this.hud.setShaderDebugState({
      visible: this.shaderDebugMenuVisible,
      activePresetId: activePreset.id,
      statusText,
      presets: VIBE_SHADER_PRESETS,
      intensity,
      intensityEnabled: activePreset.id !== NO_VIBE_SHADER_PRESET_ID
    });
  }

  toggleBuildMode() {
    if (!this.worldBuilder) {
      return;
    }

    const nextEnabled = !this.worldBuilder.enabled;
    if (nextEnabled) {
      this.closeQuickChat();
      this.setShaderDebugMenuVisible(false);
      this.setAimPoseDebugVisible(false);
    }
    void this.worldBuilder.setEnabled(nextEnabled);
    if (nextEnabled) {
      this.refreshShaderDebugHud();
    }
    this.refreshZoomHud();
    this.hud.showToast(nextEnabled ? 'World builder enabled.' : 'World builder disabled.');
  }

  async start() {
    try {
      console.info('[Game] Starting game bootstrap.');
      this.setupLights();
      this.setupAtmosphere();

      const cityState = await buildCity(this.scene);
      console.info('[Game] City built.', {
        colliderCount: cityState.colliders?.length ?? 0,
        interactableCount: cityState.interactables?.length ?? 0
      });
      this.baseColliders = cityState.colliders;
      this.staticInteractables = cityState.interactables;
      this.cityBounds = cityState.cityBounds;
      this.npcService = await createNpcService();
      console.info('[Game] NPC service ready.', {
        transport: this.npcService?.getState?.()?.transport ?? 'unknown'
      });
      this.combatEventUnsubscribe = this.npcService.subscribeCombatEvents((event) => {
        this.handleCombatEvent(event);
      });
      this.worldPatchUnsubscribe = this.npcService.subscribeWorldPatches((patch) => {
        if (!this.worldBuilder || !this.worldLayoutReady) {
          this.pendingWorldPatches.push(patch);
          return;
        }

        void this.handleWorldPatch(patch);
      });

      this.worldBuilder = new WorldBuilder({
        scene: this.scene,
        camera: this.camera,
        domElement: this.renderer.domElement,
        library: this.library,
        hud: this.hud,
        worldTransport: this.npcService,
        onToggleBuildMode: () => this.toggleBuildMode(),
        onLayoutChanged: (layout) => {
          this.currentLayout = layout;
        }
      });
      this.refreshZoomHud();

      this.npcService.subscribe((state) => {
        this.npcServiceState = state;
        this.reportNpcTransportState();
        this.applyNpcRuntimeState();
        this.worldBuilder?.setRemoteBuilders(state.builders, state.sessionId);
        void this.syncPickupVisuals();
        void this.syncRemotePlayers();
      });

      const sharedLayout = await this.npcService.getWorldLayout();
      console.info('[Game] Shared world layout loaded.', {
        tiles: sharedLayout.tiles?.length ?? 0,
        props: sharedLayout.props?.length ?? 0,
        npcs: sharedLayout.npcs?.length ?? 0
      });
      this.currentLayout = sharedLayout;
      await this.worldBuilder.loadLayout(sharedLayout);
      this.worldLayoutReady = true;
      for (const patch of this.pendingWorldPatches.splice(0)) {
        await this.handleWorldPatch(patch);
      }

      this.player = await createPlayer(this.library);
      console.info('[Game] Local player loaded.');
      const localPlayerState = this.npcServiceState.players.get(this.npcServiceState.sessionId);
      if (localPlayerState) {
        this.player.position.set(localPlayerState.x, 0, localPlayerState.z);
      } else {
        this.player.position.copy(cityState.spawnPoint);
      }
      this.player.position.y = this.worldBuilder?.getGroundHeightAt(this.player.position) ?? cityState.spawnPoint.y;
      this.scene.add(this.player.object);
      const aimPoseDebugHelper = this.player.getAimPoseDebugHelper?.();
      if (aimPoseDebugHelper) {
        this.scene.add(aimPoseDebugHelper);
      }
      this.registerHeldItemDebugTools();
      this.player.setAimPoseDebugVisible(this.aimPoseDebugShowSkeleton);
      this.refreshAimPoseDebugHud();
      void this.syncPickupVisuals();

      if (this.npcServiceState.transport === 'colyseus') {
        this.hud.showToast('Connected to the multiplayer room. Shared building, world chat, NPC replies, and player presence are live.');
      } else {
        this.hud.showToast('Running local mock multiplayer. World chat and NPC replies work locally without Colyseus.');
      }

      this.hud.hideLoading();
      console.info('[Game] Entering render loop.');
      this.renderer.setAnimationLoop(() => this.frame());
    } catch (error) {
      console.error('[Game] Failed during bootstrap.', error);
      this.hud.showToast('Failed to load part of the city. Check the console for details.');
      throw error;
    }
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0xd8efff, 0x35503d, 1.9);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0cf, 2.6);
    sun.position.set(45, 70, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -WORLD_SHADOW_EXTENT;
    sun.shadow.camera.right = WORLD_SHADOW_EXTENT;
    sun.shadow.camera.top = WORLD_SHADOW_EXTENT;
    sun.shadow.camera.bottom = -WORLD_SHADOW_EXTENT;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = WORLD_GROUND_RADIUS + 40;
    this.scene.add(sun);
  }

  setupAtmosphere() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(WORLD_GROUND_RADIUS + 60, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x95bfde, side: THREE.BackSide })
    );
    sky.position.y = 30;
    this.scene.add(sky);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer?.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.composer?.setSize(window.innerWidth, window.innerHeight);
    this.updatePostProcessingResolution();
  }

  registerHeldItemDebugTools() {
    if (!this.player || !isLocalDebugHost()) {
      return;
    }

    const getActiveItemId = () => this.getLocalPlayerState()?.equippedWeaponId || HELD_ITEM_IDS.pistol;
    const clampVector = (values, fallback = [0, 0, 0]) => [0, 1, 2].map((index) => Number(values?.[index] ?? fallback[index] ?? 0));
    const printGrip = (itemId = getActiveItemId()) => {
      const profile = this.player.getHeldItemGripProfile(itemId);
      if (!profile) {
        console.info('[HeldItemDebug] No grip profile found.', { itemId });
        return null;
      }

      const printable = {
        id: itemId,
        gripOffset: {
          position: profile.position.map((value) => Number(value.toFixed(4))),
          rotation: profile.rotation.map((value) => Number(value.toFixed(4))),
          scale: profile.scale.map((value) => Number(value.toFixed(4)))
        }
      };
      console.info('[HeldItemDebug] Current grip profile.', printable);
      return printable;
    };

    globalThis.__stickRpgHeldItemDebug = {
      items: listHeldItemDefinitions().map((definition) => definition.id),
      printGrip,
      nudgePosition: (deltaX = 0, deltaY = 0, deltaZ = 0, itemId = getActiveItemId()) => {
        const next = this.player.nudgeHeldItemGripOverride(itemId, {
          position: clampVector([deltaX, deltaY, deltaZ]),
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        });
        console.info('[HeldItemDebug] Nudged grip position.', { itemId, gripOffset: next });
        return next;
      },
      nudgeRotation: (deltaX = 0, deltaY = 0, deltaZ = 0, itemId = getActiveItemId()) => {
        const next = this.player.nudgeHeldItemGripOverride(itemId, {
          position: [0, 0, 0],
          rotation: clampVector([deltaX, deltaY, deltaZ]),
          scale: [1, 1, 1]
        });
        console.info('[HeldItemDebug] Nudged grip rotation.', { itemId, gripOffset: next });
        return next;
      },
      scaleBy: (scaleX = 1, scaleY = scaleX, scaleZ = scaleX, itemId = getActiveItemId()) => {
        const next = this.player.nudgeHeldItemGripOverride(itemId, {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: clampVector([scaleX, scaleY, scaleZ], [1, 1, 1])
        });
        console.info('[HeldItemDebug] Adjusted grip scale.', { itemId, gripOffset: next });
        return next;
      },
      reset: (itemId = getActiveItemId()) => {
        this.player.clearHeldItemGripOverride(itemId);
        return printGrip(itemId);
      },
      previewCrateLeftHand: () => this.player.attachHeldItem(HELD_ITEM_IDS.crateA, { visible: true }),
      clearLeftHand: () => this.player.detachHeldItem(ATTACHMENT_SLOTS.handLeft)
    };
    globalThis.printGrip = (...args) => globalThis.__stickRpgHeldItemDebug.printGrip(...args);
    globalThis.nudgePosition = (...args) => globalThis.__stickRpgHeldItemDebug.nudgePosition(...args);
    globalThis.nudgeRotation = (...args) => globalThis.__stickRpgHeldItemDebug.nudgeRotation(...args);
    globalThis.scaleBy = (...args) => globalThis.__stickRpgHeldItemDebug.scaleBy(...args);
    globalThis.resetGrip = (...args) => globalThis.__stickRpgHeldItemDebug.reset(...args);
    globalThis.__stickRpgAimPoseDebug = {
      fields: HELD_ITEM_AIM_POSE_FIELDS.map((field) => field.key),
      print: (itemId = getActiveItemId()) => this.printAimPoseDebug(itemId),
      setField: (fieldKey, value = 0, itemId = getActiveItemId()) => this.setAimPoseDebugField(fieldKey, value, itemId),
      reset: (itemId = getActiveItemId()) => this.resetAimPoseDebug(itemId),
      togglePanel: (visible = !this.aimPoseDebugVisible) => this.setAimPoseDebugVisible(visible),
      toggleBones: (visible = !this.aimPoseDebugShowSkeleton) => this.setAimPoseSkeletonDebugVisible(visible)
    };
    globalThis.__stickRpgShaderDebug = {
      presets: VIBE_SHADER_PRESETS.map(({ id, label }) => ({ id, label })),
      getActivePreset: () => this.getActiveVibeShaderPreset().id,
      setPreset: (presetId = DEFAULT_VIBE_SHADER_PRESET_ID) => this.setVibeShaderPreset(presetId, { announce: false }),
      getIntensity: (presetId = this.activeVibeShaderPresetId) => this.getVibeShaderIntensity(presetId),
      setIntensity: (intensity = DEFAULT_VIBE_SHADER_INTENSITY, presetId = this.activeVibeShaderPresetId) =>
        this.setVibeShaderIntensity(intensity, { presetId }),
      resetIntensity: (presetId = this.activeVibeShaderPresetId) =>
        this.resetVibeShaderIntensity({ presetId }),
      toggleMenu: (visible = !this.shaderDebugMenuVisible) => this.setShaderDebugMenuVisible(visible)
    };

    globalThis.printAimPose = (...args) => globalThis.__stickRpgAimPoseDebug.print(...args);
    globalThis.setAimPoseField = (...args) => globalThis.__stickRpgAimPoseDebug.setField(...args);
    globalThis.resetAimPose = (...args) => globalThis.__stickRpgAimPoseDebug.reset(...args);

    console.info('[HeldItemDebug] Attached window.__stickRpgHeldItemDebug helpers.', {
      items: listHeldItemDefinitions().map((definition) => definition.id)
    });
    console.info('[AimPoseDebug] Attached window.__stickRpgAimPoseDebug helpers.', {
      fields: HELD_ITEM_AIM_POSE_FIELDS.map((field) => field.key)
    });
    console.info('[ShaderDebug] Attached window.__stickRpgShaderDebug helpers.', {
      presets: VIBE_SHADER_PRESETS.map(({ id }) => id)
    });
  }

  getActiveAimPoseDebugItemId() {
    return this.getLocalPlayerState()?.equippedWeaponId || HELD_ITEM_IDS.pistol;
  }

  setAimPoseDebugVisible(visible) {
    const nextVisible = Boolean(visible && isLocalDebugHost());
    if (nextVisible) {
      this.setShaderDebugMenuVisible(false);
      if (this.worldBuilder?.enabled) {
        void this.worldBuilder.setEnabled(false);
      }
    }

    this.aimPoseDebugVisible = nextVisible;
    this.refreshAimPoseDebugHud();
    return this.aimPoseDebugVisible;
  }

  toggleAimPoseDebugPanel() {
    const nextVisible = this.setAimPoseDebugVisible(!this.aimPoseDebugVisible);
    this.hud.showToast(nextVisible ? 'Aim pose debug opened.' : 'Aim pose debug hidden.');
    return nextVisible;
  }

  setAimPoseSkeletonDebugVisible(visible) {
    this.aimPoseDebugShowSkeleton = Boolean(visible && isLocalDebugHost());
    this.player?.setAimPoseDebugVisible(this.aimPoseDebugShowSkeleton);
    this.refreshAimPoseDebugHud();
    return this.aimPoseDebugShowSkeleton;
  }

  toggleAimPoseSkeletonDebug() {
    const nextVisible = !this.aimPoseDebugShowSkeleton;
    this.setAimPoseSkeletonDebugVisible(nextVisible);
    this.hud.showToast(nextVisible ? 'Aim skeleton helper enabled.' : 'Aim skeleton helper hidden.');
  }

  setAimPoseDebugField(fieldKey, value, itemId = this.getActiveAimPoseDebugItemId()) {
    if (!this.player || !itemId) {
      return null;
    }

    const nextPose = this.player.setHeldItemAimPoseFieldOverride(itemId, fieldKey, value);
    this.refreshAimPoseDebugHud();
    return nextPose;
  }

  resetAimPoseDebug(itemId = this.getActiveAimPoseDebugItemId()) {
    if (!this.player || !itemId) {
      return null;
    }

    this.player.clearHeldItemAimPoseOverride(itemId);
    const nextPose = this.player.getHeldItemAimPoseProfile(itemId);
    this.refreshAimPoseDebugHud();
    this.hud.showToast('Aim pose overrides reset.');
    return nextPose;
  }

  printAimPoseDebug(itemId = this.getActiveAimPoseDebugItemId()) {
    if (!this.player || !itemId) {
      return null;
    }

    const pose = this.player.getHeldItemAimPoseProfile(itemId);
    const printable = {
      id: itemId,
      aimPose: Object.fromEntries(
        HELD_ITEM_AIM_POSE_FIELDS
          .map((field) => [field.key, Number(pose?.[field.key] ?? 0)])
          .filter(([, value]) => Math.abs(value) > 0.000001)
          .map(([key, value]) => [key, Number(value.toFixed(4))])
      )
    };
    console.info('[AimPoseDebug] Current aim pose.', printable);
    return printable;
  }

  refreshAimPoseDebugHud() {
    const debugAvailable = Boolean(this.player && isLocalDebugHost());
    const itemId = this.getActiveAimPoseDebugItemId();
    const pose = this.player?.getHeldItemAimPoseProfile(itemId) ?? {};
    const statusParts = [];
    statusParts.push(`Weapon: ${itemId || 'none'}`);
    statusParts.push(this.currentAimMode ? 'Previewing right-click aim' : 'Use the Aim Pose button or press O. Hold right click to preview.');
    this.hud.setAimPoseDebugState({
      available: debugAvailable,
      visible: Boolean(this.aimPoseDebugVisible && debugAvailable),
      statusText: statusParts.join(' | '),
      showSkeleton: this.aimPoseDebugShowSkeleton,
      values: pose
    });
  }

  queueHipFireShot(aimDirection) {
    if (!aimDirection) {
      return;
    }

    const now = performance.now();
    this.pendingHipFireShot = {
      direction: { x: aimDirection.x, z: aimDirection.z },
      origin: this.getShotCollisionOrigin(aimDirection),
      fireAt: now + HIP_FIRE_AIM_LEAD_MS,
      releaseAt: now + HIP_FIRE_AIM_LEAD_MS + HIP_FIRE_AIM_HOLD_MS,
      fired: false
    };
  }

  clearPendingHipFireShot() {
    this.pendingHipFireShot = null;
  }

  getShotCollisionOrigin(aimDirection) {
    if (!this.player || !aimDirection) {
      return null;
    }

    return {
      x: this.player.position.x + (aimDirection.x * SHOT_COLLISION_ORIGIN_FORWARD_OFFSET),
      z: this.player.position.z + (aimDirection.z * SHOT_COLLISION_ORIGIN_FORWARD_OFFSET)
    };
  }

  applyNpcRuntimeState() {
    if (!this.worldBuilder) {
      return;
    }

    const runtime = new Map();
    for (const [npcId, npc] of this.npcServiceState.npcs.entries()) {
      runtime.set(npcId, { busy: npc.busy });
    }
    this.worldBuilder.setNpcRuntimeState(runtime);
  }

  async handleWorldPatch(patch) {
    if (!this.worldBuilder) {
      return;
    }

    await this.worldBuilder.applyWorldPatch(patch);
    this.currentLayout = this.worldBuilder.getLayout();
  }

  async ensureRemotePlayer(sessionId, initialState) {
    if (this.remotePlayers.has(sessionId) || this.pendingRemotePlayers.has(sessionId)) {
      return;
    }

    this.pendingRemotePlayers.add(sessionId);
    try {
      const avatar = await createPlayer(this.library, {
        indicatorColor: 0x68c7ff,
        indicatorOpacity: 0.65
      });
      const latestState = this.npcServiceState.players.get(sessionId) ?? initialState;
      const stillPresent = this.npcServiceState.players.has(sessionId) && sessionId !== this.npcServiceState.sessionId;
      if (!stillPresent) {
        return;
      }

      avatar.position.set(
        Number(latestState?.x ?? 0),
        0,
        Number(latestState?.z ?? 0)
      );
      avatar.object.rotation.y = Number(latestState?.rotationY ?? 0) || 0;
      avatar.position.y = this.worldBuilder?.getGroundHeightAt(avatar.position) ?? 0;
      avatar.applyRemoteState(latestState, 0, avatar.position.y);
      this.scene.add(avatar.object);
      this.remotePlayers.set(sessionId, avatar);
    } catch (error) {
      console.error('[Multiplayer] Failed to create remote player avatar.', {
        sessionId,
        error
      });
    } finally {
      this.pendingRemotePlayers.delete(sessionId);
    }
  }

  removeRemotePlayer(sessionId) {
    const avatar = this.remotePlayers.get(sessionId);
    if (!avatar) {
      return;
    }

    this.scene.remove(avatar.object);
    this.remotePlayers.delete(sessionId);
  }

  async syncRemotePlayers() {
    if (!this.player) {
      return;
    }

    const desiredSessionIds = new Set();
    for (const [sessionId, playerState] of this.npcServiceState.players.entries()) {
      if (sessionId === this.npcServiceState.sessionId) {
        continue;
      }

      desiredSessionIds.add(sessionId);
      if (!this.remotePlayers.has(sessionId) && !this.pendingRemotePlayers.has(sessionId)) {
        void this.ensureRemotePlayer(sessionId, playerState);
      }
    }

    for (const sessionId of [...this.remotePlayers.keys()]) {
      if (!desiredSessionIds.has(sessionId)) {
        this.removeRemotePlayer(sessionId);
      }
    }
  }

  updateRemotePlayers(deltaSeconds) {
    for (const [sessionId, avatar] of this.remotePlayers.entries()) {
      const state = this.npcServiceState.players.get(sessionId);
      if (!state) {
        continue;
      }

      const groundProbe = new THREE.Vector3(state.x, avatar.position.y, state.z);
      const groundHeight = this.worldBuilder?.getGroundHeightAt(groundProbe) ?? 0;
      avatar.applyRemoteState(state, deltaSeconds, groundHeight);
    }
  }

  getLocalPlayerState() {
    return this.npcServiceState.players.get(this.npcServiceState.sessionId) ?? null;
  }

  getAvatarForSessionId(sessionId) {
    if (!sessionId) {
      return null;
    }

    if (sessionId === this.npcServiceState.sessionId) {
      return this.player ?? null;
    }

    return this.remotePlayers.get(sessionId) ?? null;
  }

  async syncPickupVisuals() {
    if (!this.library) {
      return;
    }

    const desiredIds = new Set();
    for (const [pickupId, pickup] of this.npcServiceState.pickups.entries()) {
      if (!pickup?.active) {
        continue;
      }

      desiredIds.add(pickupId);
      if (!this.pickupVisuals.has(pickupId) && !this.pendingPickupVisuals.has(pickupId)) {
        void this.ensurePickupVisual(pickupId, pickup);
      }
    }

    for (const pickupId of [...this.pickupVisuals.keys()]) {
      if (!desiredIds.has(pickupId)) {
        this.removePickupVisual(pickupId);
      }
    }
  }

  async ensurePickupVisual(pickupId, pickup) {
    const assetUrl = getHeldItemAssetUrl(pickup.weaponId);
    if (!assetUrl) {
      return;
    }

    this.pendingPickupVisuals.add(pickupId);
    try {
      const weapon = await this.library.instantiate(assetUrl);
      const latestPickup = this.npcServiceState.pickups.get(pickupId);
      if (!latestPickup?.active) {
        return;
      }

      prepareHeldItemModel(weapon, pickup.weaponId, 'pickup');
      const group = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.05, 1.45, 28),
        new THREE.MeshBasicMaterial({
          color: 0xf2c871,
          transparent: true,
          opacity: 0.78,
          side: THREE.DoubleSide
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      group.add(ring);
      group.add(weapon);
      const groundHeight = this.worldBuilder?.getGroundHeightAt(new THREE.Vector3(latestPickup.x, 0, latestPickup.z)) ?? 0;
      group.position.set(latestPickup.x, groundHeight, latestPickup.z);
      this.scene.add(group);
      this.pickupVisuals.set(pickupId, {
        object: group,
        ring,
        weapon,
        phase: Math.random() * Math.PI * 2,
        spin: Math.random() * Math.PI * 2
      });
    } catch (error) {
      console.warn(`[Combat] Failed to create pickup visual for ${pickupId}.`, error);
    } finally {
      this.pendingPickupVisuals.delete(pickupId);
    }
  }

  removePickupVisual(pickupId) {
    const visual = this.pickupVisuals.get(pickupId);
    if (!visual) {
      return;
    }

    this.scene.remove(visual.object);
    this.pickupVisuals.delete(pickupId);
  }

  updatePickupVisuals(deltaSeconds) {
    for (const [pickupId, visual] of this.pickupVisuals.entries()) {
      const pickup = this.npcServiceState.pickups.get(pickupId);
      if (!pickup?.active) {
        this.removePickupVisual(pickupId);
        continue;
      }

      const groundHeight = this.worldBuilder?.getGroundHeightAt(new THREE.Vector3(pickup.x, 0, pickup.z)) ?? 0;
      visual.phase += deltaSeconds * 2.4;
      visual.spin += deltaSeconds * 1.8;
      visual.object.position.set(pickup.x, groundHeight, pickup.z);
      visual.object.rotation.y = visual.spin;
      visual.weapon.position.y = 0.9 + Math.sin(visual.phase) * 0.12;
      visual.ring.material.opacity = 0.56 + ((Math.sin(visual.phase * 1.6) + 1) * 0.12);
    }
  }

  syncLocalPlayerState(localPlayerState) {
    if (!this.player || !localPlayerState) {
      return;
    }

    const isAlive = localPlayerState.alive !== false;
    const targetPosition = new THREE.Vector3(localPlayerState.x, this.player.position.y, localPlayerState.z);
    const groundHeight = this.worldBuilder?.getGroundHeightAt(targetPosition) ?? 0;
    const distance = this.player.position.distanceTo(targetPosition);
    const respawned = this.localStateInitialized && !this.lastLocalAlive && isAlive;
    const died = this.localStateInitialized && this.lastLocalAlive && !isAlive;

    if (!this.localStateInitialized || respawned || died || distance > 2.5) {
      this.player.position.set(localPlayerState.x, groundHeight, localPlayerState.z);
    }

    this.player.setAliveState(isAlive, {
      startedAtMs: Number.isFinite(localPlayerState.lastDamagedAt) && localPlayerState.lastDamagedAt > 0
        ? localPlayerState.lastDamagedAt
        : Date.now()
    });
    this.player.setWeaponState(
      isAlive ? localPlayerState.equippedWeaponId : '',
      { visible: isAlive && Boolean(localPlayerState.equippedWeaponId) }
    );

    this.hud.setCombatState({
      visible: true,
      health: localPlayerState.health ?? PLAYER_MAX_HEALTH,
      maxHealth: localPlayerState.maxHealth ?? PLAYER_MAX_HEALTH,
      ammoInClip: localPlayerState.ammoInClip ?? 0,
      reserveAmmo: localPlayerState.reserveAmmo ?? 0,
      isReloading: Boolean(localPlayerState.isReloading),
      reloadEndsAt: localPlayerState.reloadEndsAt ?? 0,
      alive: isAlive,
      respawnAt: localPlayerState.respawnAt ?? 0,
      kills: localPlayerState.kills ?? 0,
      deaths: localPlayerState.deaths ?? 0,
      armed: Boolean(localPlayerState.equippedWeaponId)
    });

    if (respawned) {
      this.closeQuickChat();
    }

    this.lastLocalAlive = isAlive;
    this.localStateInitialized = true;
  }

  getAimDirection() {
    const pointer = this.input.getPointerPosition();
    const ndc = new THREE.Vector2(
      (pointer.x / window.innerWidth) * 2 - 1,
      -((pointer.y / window.innerHeight) * 2 - 1)
    );
    this.aimRaycaster.setFromCamera(ndc, this.camera);
    const groundHeight = this.player?.position.y ?? 0;
    this.aimPlane.constant = -groundHeight;
    if (this.aimRaycaster.ray.intersectPlane(this.aimPlane, this.aimTarget)) {
      const direction = new THREE.Vector3(
        this.aimTarget.x - this.player.position.x,
        0,
        this.aimTarget.z - this.player.position.z
      );
      if (direction.lengthSq() > AIM_DIRECTION_MIN_DISTANCE * AIM_DIRECTION_MIN_DISTANCE) {
        direction.normalize();
        return direction;
      }
    }

    return this.currentAimDirection.clone();
  }

  getShotVisualPoints(event = {}) {
    const shooterAvatar = this.getAvatarForSessionId(event.shooterId);
    const start = shooterAvatar?.getWeaponMuzzleWorldPosition(new THREE.Vector3())
      ?? new THREE.Vector3(Number(event.fromX) || 0, 2.2, Number(event.fromZ) || 0);
    const end = new THREE.Vector3(Number(event.toX) || start.x, start.y, Number(event.toZ) || start.z);

    if (event.targetId) {
      const targetAvatar = this.getAvatarForSessionId(event.targetId);
      if (targetAvatar) {
        end.y = targetAvatar.position.y + 2.4;
      }
    }

    return { start, end };
  }

  getImpactEffectSpec(event = {}) {
    const shooterAvatar = this.getAvatarForSessionId(event.shooterId);
    const origin = shooterAvatar?.getWeaponMuzzleWorldPosition(new THREE.Vector3())
      ?? new THREE.Vector3(Number(event.x) || 0, 2.2, Number(event.z) || 0);
    const point = new THREE.Vector3(Number(event.x) || origin.x, origin.y, Number(event.z) || origin.z);

    if (event.kind === 'player' && event.targetId) {
      const targetAvatar = this.getAvatarForSessionId(event.targetId);
      if (targetAvatar) {
        point.y = targetAvatar.position.y + 2.4;
      }
    } else {
      const groundHeight = this.worldBuilder?.getGroundHeightAt(point) ?? 0;
      point.y = groundHeight + 1.05;
    }

    const travelDistance = origin.distanceTo(point);
    const delayMs = THREE.MathUtils.clamp(
      (travelDistance / PROJECTILE_VISUAL_SPEED) * 1000,
      0,
      PROJECTILE_MAX_LIFETIME_MS
    );

    return { point, delayMs };
  }

  createTracerEffect(start, end) {
    const travel = end.clone().sub(start);
    const distance = travel.length();
    if (distance <= 0.001) {
      return;
    }

    const direction = travel.clone().normalize();
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xf6d87f,
      transparent: true,
      opacity: 0.92
    });
    const trailGeometry = new THREE.BufferGeometry().setFromPoints([start, start]);
    const trail = new THREE.Line(
      trailGeometry,
      trailMaterial
    );
    this.scene.add(trail);
    const durationMs = THREE.MathUtils.clamp(
      (distance / PROJECTILE_VISUAL_SPEED) * 1000,
      PROJECTILE_MIN_LIFETIME_MS,
      PROJECTILE_MAX_LIFETIME_MS
    );
    this.combatEffects.push({
      type: 'projectile',
      object: trail,
      trail,
      trailGeometry,
      material: trailMaterial,
      start: start.clone(),
      end: end.clone(),
      direction,
      distance,
      startedAt: performance.now(),
      expiresAt: performance.now() + durationMs
    });
  }

  createImpactEffect(position, kind = 'world', delayMs = 0) {
    const now = performance.now();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshBasicMaterial({
        color: kind === 'player' ? 0xff8f7a : 0xf2c871,
        transparent: true,
        opacity: 0.9
      })
    );
    mesh.position.copy(position);
    mesh.visible = delayMs <= 0;
    this.scene.add(mesh);
    this.combatEffects.push({
      type: 'impact',
      object: mesh,
      material: mesh.material,
      startAt: now + delayMs,
      expiresAt: now + delayMs + IMPACT_EFFECT_LIFETIME_MS
    });
  }

  updateCombatEffects() {
    const now = performance.now();
    const next = [];
    for (const effect of this.combatEffects) {
      if (now >= effect.expiresAt) {
        this.scene.remove(effect.object);
        if (effect.trail) {
          this.scene.remove(effect.trail);
        }
        effect.object.traverse?.((node) => {
          node.geometry?.dispose?.();
        });
        effect.trailGeometry?.dispose?.();
        effect.material?.dispose?.();
        effect.secondaryMaterial?.dispose?.();
        continue;
      }

      if (effect.type === 'projectile') {
        const lifetime = Math.max(1, effect.expiresAt - effect.startedAt);
        const progress = THREE.MathUtils.clamp((now - effect.startedAt) / lifetime, 0, 1);
        if (effect.trail && effect.trailGeometry) {
          const travelledDistance = effect.distance * progress;
          const tailDistance = Math.max(0, travelledDistance - PROJECTILE_TRAIL_LENGTH);
          const tail = effect.start.clone().addScaledVector(effect.direction, tailDistance);
          const head = effect.start.clone().addScaledVector(effect.direction, travelledDistance);
          effect.trailGeometry.setFromPoints([tail, head]);
        }
        effect.material.opacity = THREE.MathUtils.lerp(0.92, 0.18, progress);
      } else if (effect.type === 'impact') {
        if (now < effect.startAt) {
          next.push(effect);
          continue;
        }

        if (!effect.object.visible) {
          effect.object.visible = true;
        }

        const lifetime = Math.max(1, effect.expiresAt - effect.startAt);
        const progress = THREE.MathUtils.clamp((now - effect.startAt) / lifetime, 0, 1);
        effect.object.scale.setScalar(1 + (progress * 0.75));
        effect.material.opacity = Math.max(0, 1 - progress);
      }
      next.push(effect);
    }
    this.combatEffects = next;
  }

  handleCombatEvent(event = {}) {
    if (!event?.type) {
      return;
    }

    switch (event.type) {
      case 'shot':
        this.getAvatarForSessionId(event.shooterId)?.triggerShotFeedback?.();
        {
          const { start, end } = this.getShotVisualPoints(event);
          this.createTracerEffect(start, end);
        }
        break;
      case 'impact':
        {
          const { point, delayMs } = this.getImpactEffectSpec(event);
          this.createImpactEffect(point, event.kind, delayMs);
        }
        if (event.kind === 'player' && event.shooterId === this.npcServiceState.sessionId) {
          this.hitMarkerUntil = performance.now() + 120;
        }
        break;
      case 'pickup':
        if (event.playerId === this.npcServiceState.sessionId) {
          this.hud.showToast('Pistol equipped.');
        }
        break;
      case 'death':
        if (event.victimId === this.npcServiceState.sessionId) {
          this.hud.showToast('You are down.');
        }
        break;
      case 'respawn':
        if (event.playerId === this.npcServiceState.sessionId) {
          this.hud.showToast('Respawned.');
        }
        break;
      default:
        break;
    }
  }

  reportNpcTransportState() {
    const signature = `${this.npcServiceState.transport}:${this.npcServiceState.connected}:${this.npcServiceState.sessionId ?? ''}`;
    if (signature === this.lastNpcTransportSignature) {
      return;
    }

    this.lastNpcTransportSignature = signature;
    console.info('[NPC] Active transport state changed.', {
      transport: this.npcServiceState.transport,
      connected: this.npcServiceState.connected,
      sessionId: this.npcServiceState.sessionId ?? null,
      npcCount: this.npcServiceState.npcs.size
    });
  }

  getActiveEmoteSelection() {
    const pointer = this.input.getPointerPosition();
    const centerX = window.innerWidth * 0.5;
    const centerY = window.innerHeight * 0.5;
    const offsetX = pointer.x - centerX;
    const offsetY = pointer.y - centerY;
    const distance = Math.hypot(offsetX, offsetY);

    if (distance < EMOTE_MENU_DEADZONE) {
      return { index: -1, entry: null, hasSelection: false };
    }

    const angle = Math.atan2(offsetY, offsetX);
    const normalizedAngle = (angle + Math.PI * 2 + Math.PI / 8) % (Math.PI * 2);
    const index = Math.floor(normalizedAngle / (Math.PI / 4));
    const entry = EMOTE_SLOTS[index] ?? null;
    const hasSelection = Boolean(entry?.id);
    return { index, entry, hasSelection };
  }

  updateEmoteMenu() {
    const holdingEmoteKey = this.input.isPressed('KeyB');

    if (holdingEmoteKey && !this.worldBuilder.enabled && !this.hud.isQuickChatOpen()) {
      const selection = this.getActiveEmoteSelection();
      this.emoteMenuOpen = true;
      this.hud.setEmoteMenuState({
        open: true,
        activeIndex: selection.index,
        selectedLabel: selection.entry?.label ?? '',
        hasSelection: selection.hasSelection
      });
      return true;
    }

    if (this.emoteMenuOpen) {
      const selection = this.getActiveEmoteSelection();
      if (selection.hasSelection) {
        const played = this.player.playEmote(selection.entry.id);
        this.hud.showToast(played ? `${selection.entry.label} emote` : `${selection.entry.label} is unavailable right now.`);
      }
    }

    this.emoteMenuOpen = false;
    this.hud.setEmoteMenuState({ open: false });
    return false;
  }

  getCameraZoomLevel() {
    return CAMERA_ZOOM_LEVELS[this.cameraZoomIndex] ?? CAMERA_ZOOM_LEVELS[DEFAULT_CAMERA_ZOOM_INDEX];
  }

  setCameraZoomIndex(nextIndex) {
    const clampedIndex = THREE.MathUtils.clamp(nextIndex, 0, CAMERA_ZOOM_LEVELS.length - 1);
    if (clampedIndex === this.cameraZoomIndex) {
      this.refreshZoomHud();
      return false;
    }

    this.cameraZoomIndex = clampedIndex;
    this.refreshZoomHud();
    return true;
  }

  stepCameraZoom(step) {
    return this.setCameraZoomIndex(this.cameraZoomIndex + step);
  }

  refreshZoomHud() {
    const zoomPercent = Math.round(this.getCameraZoomLevel() * 100);
    const builderEnabled = Boolean(this.worldBuilder?.enabled);
    this.hud.setZoomState({
      label: `${zoomPercent}%`,
      hint: builderEnabled ? 'Builder wheel' : 'Wheel / +/-',
      disabled: builderEnabled,
      canZoomIn: this.cameraZoomIndex > 0,
      canZoomOut: this.cameraZoomIndex < CAMERA_ZOOM_LEVELS.length - 1
    });
  }

  handleCameraZoomInput() {
    if (this.worldBuilder?.enabled) {
      this.input.consumeWheelDirection();
      return;
    }

    if (this.input.consume('Equal') || this.input.consume('NumpadAdd')) {
      this.stepCameraZoom(-1);
    }

    if (this.input.consume('Minus') || this.input.consume('NumpadSubtract')) {
      this.stepCameraZoom(1);
    }

    const wheelDirection = this.input.consumeWheelDirection();
    if (wheelDirection !== 0) {
      this.stepCameraZoom(Math.sign(wheelDirection));
    }
  }

  frame() {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
    const emoteMenuActive = this.updateEmoteMenu();
    const localPlayerState = this.getLocalPlayerState();

    if (this.input.consume('KeyO') && isLocalDebugHost()) {
      this.toggleAimPoseDebugPanel();
    }

    if (this.input.consume('Escape')) {
      if (this.hud.isQuickChatOpen()) {
        this.closeQuickChat();
      } else if (this.shaderDebugMenuVisible) {
        this.setShaderDebugMenuVisible(false);
      }
    }

    this.handleCameraZoomInput();

    if (
      this.input.consume('Enter')
      && localPlayerState?.alive !== false
      && !this.worldBuilder.enabled
      && !emoteMenuActive
      && !this.hud.isQuickChatOpen()
    ) {
      this.openQuickChat();
    }

    if (localPlayerState) {
      this.syncLocalPlayerState(localPlayerState);
    }

    this.worldBuilder.update(deltaSeconds, this.input);

    if (this.worldBuilder.enabled) {
      this.clearPendingHipFireShot();
      this.currentAimMode = false;
      this.player?.setAimingState(false);
      this.updateBuilderCamera();
      this.hud.setPrompt(null);
    } else {
      const localAlive = localPlayerState?.alive !== false;
      const armed = Boolean(localAlive && localPlayerState?.equippedWeaponId);
      const canCursorAim = localAlive && !emoteMenuActive && !this.hud.isQuickChatOpen();
      const activeColliders = [
        ...this.baseColliders,
        ...this.worldBuilder.getColliders()
      ];
      const groundHeight = this.worldBuilder.getGroundHeightAt(this.player.position);
      const hipFirePending = this.pendingHipFireShot;
      const hipFirePoseActive = Boolean(hipFirePending && performance.now() < hipFirePending.releaseAt);
      const aimDirection = canCursorAim ? this.getAimDirection() : this.currentAimDirection.clone();
      this.currentAimDirection.copy(aimDirection);
      this.player.setAimRotation(Math.atan2(aimDirection.x, aimDirection.z));
      if (localAlive && !emoteMenuActive && !this.hud.isQuickChatOpen() && this.input.consume('KeyP')) {
        const isLimp = this.player.toggleLimp();
        this.hud.showToast(isLimp ? 'Limbo mode engaged.' : 'Back on your feet.');
      }
      const playerInput = (!localAlive || emoteMenuActive || this.hud.isQuickChatOpen()) ? ZERO_INPUT : this.input;
      this.player.update(deltaSeconds, playerInput, this.camera, activeColliders, this.cityBounds, groundHeight);
      let aimingMode = false;
      if (armed) {
        aimingMode = !emoteMenuActive && !this.hud.isQuickChatOpen() && this.input.isPointerPressed(2);
        this.currentAimMode = aimingMode;
        this.player.setAimingState(aimingMode || hipFirePoseActive);
        if (!emoteMenuActive && !this.hud.isQuickChatOpen() && this.input.consumePointer(0)) {
          if (aimingMode) {
            this.npcService?.fireWeapon(
              { x: aimDirection.x, z: aimDirection.z },
              Date.now(),
              this.getShotCollisionOrigin(aimDirection)
            );
          } else if (!hipFirePending || performance.now() >= hipFirePending.releaseAt) {
            this.queueHipFireShot(aimDirection);
          }
        }
        if (!emoteMenuActive && !this.hud.isQuickChatOpen() && this.input.consume('KeyR')) {
          this.npcService?.reloadWeapon();
        }
      } else {
        this.clearPendingHipFireShot();
        this.currentAimMode = false;
        this.player.setAimingState(false);
      }
      if (!localAlive || emoteMenuActive || this.hud.isQuickChatOpen()) {
        this.clearPendingHipFireShot();
      } else if (this.pendingHipFireShot) {
        const now = performance.now();
        this.player.setAimingState(aimingMode || now < this.pendingHipFireShot.releaseAt);
        this.player.setAimRotation(Math.atan2(this.pendingHipFireShot.direction.x, this.pendingHipFireShot.direction.z));
        if (!this.pendingHipFireShot.fired && now >= this.pendingHipFireShot.fireAt) {
          this.pendingHipFireShot.fired = true;
          this.npcService?.fireWeapon(this.pendingHipFireShot.direction, Date.now(), this.pendingHipFireShot.origin);
        }
        if (now >= this.pendingHipFireShot.releaseAt) {
          this.clearPendingHipFireShot();
          this.player.setAimingState(aimingMode);
        }
      }
      this.updateCamera(this.currentAimDirection, this.currentAimMode && armed);
      this.npcService?.setPlayerTransform(
        this.player.position,
        this.player.object.rotation.y,
        {
          ...this.player.getAnimationSyncState(),
          aiming: Boolean(this.currentAimMode && armed)
        }
      );
      this.updateNpcInteractRadiusIndicators();

      if (localAlive === false || emoteMenuActive || this.hud.isQuickChatOpen()) {
        this.hud.setPrompt(null);
      } else {
        this.updateInteraction();
      }
    }

    this.updateRemotePlayers(deltaSeconds);
    this.updatePickupVisuals(deltaSeconds);
    this.updateCombatEffects();
    const hitMarkerVisible = performance.now() < this.hitMarkerUntil;
    if (hitMarkerVisible !== this.lastHudHitMarkerVisible) {
      this.hud.setHitMarkerVisible(hitMarkerVisible);
      this.lastHudHitMarkerVisible = hitMarkerVisible;
    }
    this.updateSpeechBubbles();
    this.refreshAimPoseDebugHud();
    if (this.vibeShaderPass?.uniforms?.uTime) {
      this.vibeShaderPass.uniforms.uTime.value = performance.now() * 0.001;
    }

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.input.endFrame();
  }

  updateCamera(aimDirection = this.currentAimDirection, isAiming = false) {
    const zoomLevel = this.getCameraZoomLevel();
    const cameraOffset = (isAiming ? AIM_CAMERA_OFFSET : CAMERA_OFFSET).clone().multiplyScalar(zoomLevel);
    const targetPosition = this.player.position.clone().add(cameraOffset);
    const lookTarget = this.player.position.clone().add(CAMERA_LOOK_OFFSET);

    this.camera.position.lerp(targetPosition, isAiming ? 0.14 : 0.08);
    this.camera.lookAt(lookTarget);
  }

  updateBuilderCamera() {
    this.worldBuilder.updateCamera(this.camera);
  }

  updateNpcInteractRadiusIndicators() {
    if (!this.player || !this.worldBuilder) {
      return;
    }

    this.worldBuilder.syncNpcInteractRadiusIndicators(this.player.position);
  }

  updateInteraction() {
    const interactables = [
      ...(this.staticInteractables ?? []),
      ...this.worldBuilder.getInteractables(),
      ...[...this.npcServiceState.pickups.values()]
        .filter((pickup) => pickup.active)
        .map((pickup) => ({
          kind: 'pickup',
          pickupId: pickup.id,
          position: new THREE.Vector3(pickup.x, this.worldBuilder.getGroundHeightAt({ x: pickup.x, z: pickup.z }), pickup.z),
          radius: 3.2,
          prompt: 'Pick up pistol',
          actionText: 'Pistol secured.'
        }))
    ].filter((interactable) => interactable.kind !== 'npc');
    let nearest = null;
    let nearestDistance = Infinity;

    for (const interactable of interactables) {
      const distance = interactable.position.distanceTo(this.player.position);
      if (distance < interactable.radius && distance < nearestDistance) {
        nearest = interactable;
        nearestDistance = distance;
      }
    }

    this.currentInteractable = nearest;
    this.hud.setPrompt(nearest);

    if (!nearest || !this.input.consume('KeyE')) {
      return;
    }

    if (nearest.kind === 'pickup') {
      this.npcService?.pickupWeapon(nearest.pickupId);
      return;
    }

    this.hud.showToast(nearest.actionText);
  }

  openQuickChat() {
    this.hud.setQuickChatState({ visible: true });
    this.hud.focusQuickChatInput();
  }

  closeQuickChat() {
    this.hud.setQuickChatState({ visible: false });
    this.hud.clearQuickChatInput();
    this.hud.blurQuickChatInput();
  }

  async handleQuickChatSubmit(message) {
    const trimmed = message.trim();
    if (!trimmed) {
      this.closeQuickChat();
      return;
    }

    const result = await this.npcService.say(trimmed);
    if (!result.ok) {
      this.hud.showToast(result.error);
      return;
    }

    this.closeQuickChat();
  }

  collectSpeechBubble(id, text, startedAt, anchor, variant, label = '', options = {}) {
    const isThinking = options.status === 'thinking';
    const isBusy = Boolean(options.busy);
    const hasVisibleText = Boolean(text) || isThinking;
    if (!hasVisibleText || !startedAt) {
      return null;
    }

    if (!isBusy && (Date.now() - startedAt) > getChatBubbleLifetimeMs(text)) {
      return null;
    }

    const projected = this.projectSpeechAnchor(anchor);
    if (!projected) {
      return null;
    }

    return {
      id,
      text,
      label,
      variant,
      status: options.status ?? 'done',
      visible: true,
      screenX: projected.x,
      screenY: projected.y
    };
  }

  pushSpeechBubble(bubbles, bubble) {
    if (bubble) {
      bubbles.push(bubble);
    }
  }

  addPlayerSpeechBubble(bubbles, sessionId, playerState, anchor, variant) {
    this.pushSpeechBubble(
      bubbles,
      this.collectSpeechBubble(
        `player:${sessionId}`,
        playerState.chatText,
        playerState.chatStartedAt,
        anchor,
        variant
      )
    );
  }

  addNpcSpeechBubble(bubbles, npcId, npcState, anchor) {
    this.pushSpeechBubble(
      bubbles,
      this.collectSpeechBubble(
        `npc:${npcId}`,
        npcState.chatText,
        npcState.chatStartedAt,
        anchor,
        'npc',
        npcState.name,
        {
          status: npcState.chatStatus,
          busy: npcState.busy
        }
      )
    );
  }

  projectSpeechAnchor(worldPosition) {
    const projected = this.projectedSpeechPosition.copy(worldPosition).project(this.camera);
    if (projected.z < -1 || projected.z > 1) {
      return null;
    }

    const x = ((projected.x + 1) * 0.5) * window.innerWidth;
    const y = ((-projected.y + 1) * 0.5) * window.innerHeight;
    if (x < -160 || x > window.innerWidth + 160 || y < -160 || y > window.innerHeight + 160) {
      return null;
    }

    return { x, y };
  }

  updateSpeechBubbles() {
    if (!this.player || !this.worldBuilder) {
      this.hud.setSpeechBubbles([]);
      return;
    }

    const bubbles = [];
    const localPlayerState = this.npcServiceState.players.get(this.npcServiceState.sessionId);
    if (localPlayerState) {
      this.addPlayerSpeechBubble(
        bubbles,
        this.npcServiceState.sessionId,
        localPlayerState,
        this.player.getSpeechAnchorWorldPosition(),
        'self'
      );
    }

    for (const [sessionId, avatar] of this.remotePlayers.entries()) {
      const playerState = this.npcServiceState.players.get(sessionId);
      if (!playerState) {
        continue;
      }

      this.addPlayerSpeechBubble(
        bubbles,
        sessionId,
        playerState,
        avatar.getSpeechAnchorWorldPosition(),
        'player'
      );
    }

    const npcSpeechAnchors = this.worldBuilder.getNpcSpeechAnchors();
    for (const [npcId, npcState] of this.npcServiceState.npcs.entries()) {
      const anchor = npcSpeechAnchors.get(npcId);
      if (!anchor) {
        continue;
      }

      this.addNpcSpeechBubble(bubbles, npcId, npcState, anchor);
    }

    this.hud.setSpeechBubbles(bubbles);
  }
}
