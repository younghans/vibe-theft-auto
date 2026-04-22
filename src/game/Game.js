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
import { preloadMixamoClips } from '../animation/mixamoClips.js';
import { Hud } from '../ui/Hud.js';
import { assets } from '../world/assetManifest.js';
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
import { rotateFootprintOffset } from '../shared/tileFootprint.js';
import { ModelLibrary } from '../world/ModelLibrary.js';
import { buildCity } from '../world/buildCity.js';
import { createInteriorScene } from '../world/InteriorScene.js';
import { createOlympicBarbellVisual } from '../world/proceduralProps.js';
import { WorldBuilder } from '../world/WorldBuilder.js';
import { createPlayer } from '../player/createPlayer.js';
import { EMOTE_SLOTS, PUNCH_ALT_EMOTE_ID, PUNCH_EMOTE_ID } from '../player/emotes.js';
import {
  DEFAULT_PLAYABLE_CHARACTER_ID,
  getPlayableCharacterById,
  listPlayableCharacters
} from '../player/playableCharacterCatalog.js';
import { createNpcService } from '../npc/createNpcService.js';
import { PLAYER_MAX_HEALTH, PLAYER_RADIUS } from '../shared/combatConstants.js';
import {
  getDeliveryQuestTargetName,
  isDeliveryQuestActive,
  isDeliveryQuestGiver
} from '../shared/deliveryQuest.js';
import { RENT_INTRO_LINE } from '../shared/rentIntro.js';

const CAMERA_OFFSET = new THREE.Vector3(0, 26, 18);
const CAMERA_LOOK_OFFSET = new THREE.Vector3(0, 3, 0);
const AIM_CAMERA_OFFSET = new THREE.Vector3(0, 27.1, 18.9);
const CAMERA_ZOOM_LEVELS = [0.67, 0.74, 0.82, 0.92, 1, 1.12, 1.26];
const DEFAULT_CAMERA_ZOOM_INDEX = 4;
const AIM_DIRECTION_MIN_DISTANCE = 3;
const PROJECTILE_VISUAL_SPEED = 48;
const PROJECTILE_MIN_LIFETIME_MS = 120;
const PROJECTILE_MAX_LIFETIME_MS = 260;
const IMPACT_EFFECT_LIFETIME_MS = 140;
const MUZZLE_FLASH_LIFETIME_MS = 95;
const DAMAGE_CAMERA_KICK_MS = 260;
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
const CHARACTER_STORAGE_KEY = 'stickrpg.selectedCharacterId';
const BOOT_PIXEL_RATIO_CAP = 1.25;
const RUNTIME_PIXEL_RATIO_CAP = 2;
const SNATCH_WORKOUT_EMOTE_ID = 'snatch';
const SNATCH_WORKOUT_DURATION_MS = 5435;
const SNATCH_APPROACH_STOP_DISTANCE = 0.18;
const RENT_INTRO_MONEY_ANIMATION_MS = 1250;
const RENT_INTRO_MONEY_FLOATER_MS = 1500;
const RENT_INTRO_LOADING_CLEAR_MS = 900;
const RENT_INTRO_AFTER_LOADING_DELAY_MS = 500;
const RENT_INTRO_TYPE_MS_PER_CHAR = 42;
const RENT_INTRO_MIN_TYPING_MS = 900;
const RENT_INTRO_AFTER_LINE_DELAY_MS = 650;
const RENT_INTRO_SPEECH_HOLD_MS = 1700;

function clampVibeShaderIntensity(value) {
  return THREE.MathUtils.clamp(
    Number.isFinite(value) ? value : DEFAULT_VIBE_SHADER_INTENSITY,
    0,
    1
  );
}

function readStoredCharacterId() {
  try {
    const stored = window.localStorage?.getItem(CHARACTER_STORAGE_KEY) ?? '';
    return getPlayableCharacterById(stored).id;
  } catch {
    return DEFAULT_PLAYABLE_CHARACTER_ID;
  }
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

function easeOutCubic(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return 1 - ((1 - clamped) ** 3);
}

function normalizeMoneyAmount(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function formatMoneyDelta(value) {
  const amount = normalizeMoneyAmount(value);
  const formattedAmount = Math.abs(amount).toLocaleString('en-US');
  return amount < 0 ? `-$${formattedAmount}` : `+$${formattedAmount}`;
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry?.dispose?.());
    return;
  }

  material?.dispose?.();
}

function disposeObjectResources(root) {
  root?.traverse?.((node) => {
    node.geometry?.dispose?.();
    disposeMaterial(node.material);
  });
}

function disposeObjectMaterials(root) {
  root?.traverse?.((node) => {
    disposeMaterial(node.material);
  });
}

function cloneVector3Like(point = { x: 0, y: 0, z: 0 }) {
  return new THREE.Vector3(point.x ?? 0, point.y ?? 0, point.z ?? 0);
}

function cloneOffset(offset = [0, 0]) {
  return [
    Number(offset?.[0]) || 0,
    Number(offset?.[1]) || 0
  ];
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
    this.renderer.setPixelRatio(this.getTargetPixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.postProcessingResolution = new THREE.Vector2();

    this.root.append(this.renderer.domElement);
    this.renderer.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });

    this.hud = new Hud(this.root);
    this.input = new Input();
    this.library = new ModelLibrary();
    this.characterRoster = listPlayableCharacters();
    this.desiredLocalCharacterId = readStoredCharacterId();
    this.pendingCharacterRequestId = '';
    this.characterSelectorVisible = false;
    this.characterPreviewRenderer = null;
    this.characterPreviewRendererPromise = null;
    this.characterSelectorSyncRequestId = 0;
    this.characterSelectorViewportSyncFrame = 0;
    this.localCharacterSwapSequence = 0;
    this.remoteAvatarBuildRequests = new Map();
    this.remotePlayers = new Map();
    this.pendingRemotePlayers = new Set();
    this.pickupVisuals = new Map();
    this.pendingPickupVisuals = new Set();
    this.combatEffects = [];
    this.currentInteractable = null;
    this.currentLayout = null;
    this.cityVisualRoot = null;
    this.currentInterior = null;
    this.interiorScenes = new Map();
    this.activeInlineShell = null;
    this.inlineShellScenes = new Map();
    this.builderInlineShellPreviewPlacementIds = new Set();
    this.inlineInteriorLight = null;
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
      npcDebug: new Map(),
      pickups: new Map()
    };
    this.emoteMenuOpen = false;
    this.projectedSpeechPosition = new THREE.Vector3();
    this.aimRaycaster = new THREE.Raycaster();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.aimTarget = new THREE.Vector3();
    this.currentAimDirection = new THREE.Vector3(0, 0, 1);
    this.muzzleFlashResources = this.createMuzzleFlashResources();
    this.muzzleFlashPrewarmed = false;
    this.currentAimMode = false;
    this.nextPunchEmoteId = PUNCH_EMOTE_ID;
    this.pendingHipFireShot = null;
    this.activeWorkout = null;
    this.pendingWorkoutPlacementId = '';
    this.claimedWorkoutPlacementId = '';
    this.activeWorkoutPlacementId = '';
    this.deliveryQuestRequestInFlight = false;
    this.deliveryQuestReminderSuppressedKey = '';
    this.deliveryQuestReminderSuppressionExpiresAt = 0;
    this.aimPoseDebugVisible = false;
    this.aimPoseDebugShowSkeleton = false;
    this.poseDebugSection = 'unarmed';
    this.shaderDebugMenuVisible = false;
    this.activeVibeShaderPresetId = DEFAULT_VIBE_SHADER_PRESET_ID;
    this.vibeShaderPresetIntensities = new Map(
      VIBE_SHADER_PRESETS.map((preset) => [preset.id, DEFAULT_VIBE_SHADER_INTENSITY])
    );
    this.cameraZoomIndex = DEFAULT_CAMERA_ZOOM_INDEX;
    this.damageCameraKickStartedAt = -Infinity;
    this.damageCameraKickEndsAt = -Infinity;
    this.damageCameraDirection = new THREE.Vector3(0, 0, 1);
    this.localStateInitialized = false;
    this.lastLocalAlive = true;
    this.lastHudHitMarkerVisible = false;
    this.hitMarkerUntil = 0;
    this.bootCriticalReady = false;
    this.loadingProgress = 0;
    this.deferredStartupPromise = null;
    this.detailedRenderingEnabled = false;
    this.firstFrameMarked = false;
    this.lastAimPoseDebugSignature = '';
    this.bootMeasureLabels = [];
    this.worldPatchSyncRequested = false;
    this.worldPatchDrainPromise = null;
    this.remotePlayerSyncRequested = false;
    this.pickupVisualSyncRequested = false;
    this.deferredMuzzleFlashWarmupId = 0;
    this.pistolCockSound = this.createSoundEffect(assets.combat.pistolCock, { volume: 0.35 });
    this.pistolShotSound = this.createSoundEffect(assets.combat.pistolShot, { volume: 0.5 });
    this.rentChaChingSound = this.createSoundEffect(assets.audio?.chaChing, { volume: 0.75 });
    this.handledRentIntroSeq = 0;
    this.rentIntroLoadingClearedAt = 0;
    this.pendingRentIntro = null;
    this.activeRentIntro = null;
    this.moneyDisplayAmount = 0;
    this.moneyAnimation = null;
    this.moneyFloaters = [];
    this.moneyFloaterSequence = 0;
    this.moneyFloaterAnchor = new THREE.Vector3();
    this.workoutLeftHandPosition = new THREE.Vector3();
    this.workoutRightHandPosition = new THREE.Vector3();
    this.workoutBarbellMidpoint = new THREE.Vector3();
    this.workoutBarbellAxis = new THREE.Vector3();
    this.workoutForward = new THREE.Vector3();
    this.workoutBarbellQuaternion = new THREE.Quaternion();

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
      onToggleBones: () => this.toggleAimPoseSkeletonDebug(),
      onSelectSection: (section) => this.setPoseDebugSection(section)
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
    this.hud.bindCharacterSelectorEvents({
      onTogglePanel: (visible) => this.toggleCharacterSelector(visible),
      onCycleCharacter: (step) => this.cycleCharacterSelection(step),
      onSelectCharacter: (characterId) => this.selectCharacter(characterId),
      onViewportChange: () => this.queueCharacterSelectorViewportSync()
    });
    this.refreshZoomHud();
    this.refreshCharacterSelectorHud();
    this.setVibeShaderPreset(DEFAULT_VIBE_SHADER_PRESET_ID, { announce: false });
    this.hud.setLoadingProgress(0);

    window.addEventListener('resize', () => this.onResize());
  }

  getTargetPixelRatio() {
    const cap = this.detailedRenderingEnabled ? RUNTIME_PIXEL_RATIO_CAP : BOOT_PIXEL_RATIO_CAP;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  markBoot(name) {
    try {
      performance.mark(name);
    } catch {
      // Ignore mark errors in unsupported environments.
    }
  }

  measureBoot(label, startMark, endMark) {
    try {
      performance.measure(label, startMark, endMark);
      this.bootMeasureLabels.push(label);
    } catch {
      // Ignore measure errors when a mark is missing.
    }
  }

  reportBootMetrics() {
    if (!this.bootMeasureLabels.length) {
      return;
    }

    const measures = performance.getEntriesByType('measure')
      .filter((entry) => this.bootMeasureLabels.includes(entry.name))
      .map((entry) => ({
        name: entry.name,
        durationMs: Number(entry.duration.toFixed(1))
      }));

    if (measures.length) {
      console.info('[Boot] Performance measures.', measures);
    }
  }

  mapBootLoadingProgress(progress) {
    const clampedProgress = THREE.MathUtils.clamp(Number(progress) || 0, 0, 1);
    if (clampedProgress >= 1) {
      return 1;
    }

    const normalized = THREE.MathUtils.clamp(clampedProgress / 0.72, 0, 1);
    return 1 - Math.pow(1 - normalized, 1.9);
  }

  setBootLoadingProgress(progress, { render = false } = {}) {
    const nextProgress = this.mapBootLoadingProgress(progress);
    const clampedProgress = Math.max(this.loadingProgress, nextProgress);
    if (clampedProgress === this.loadingProgress) {
      if (render) {
        this.renderCurrentView();
      }
      return;
    }

    this.loadingProgress = clampedProgress;
    this.hud.setLoadingProgress(clampedProgress);
    if (render) {
      this.renderCurrentView();
    }
  }

  async warmBootPreviewFrames({ frames = 4, minDurationMs = 180 } = {}) {
    const targetFrames = Math.max(1, Math.floor(frames));
    const targetDuration = Math.max(0, Number(minDurationMs) || 0);
    const startedAt = performance.now();

    await new Promise((resolve) => {
      let completedFrames = 0;

      const step = () => {
        completedFrames += 1;
        const elapsed = performance.now() - startedAt;
        if (completedFrames >= targetFrames && elapsed >= targetDuration) {
          resolve();
          return;
        }

        window.requestAnimationFrame(step);
      };

      window.requestAnimationFrame(step);
    });
  }

  setupPostProcessing() {
    if (this.composer) {
      return;
    }

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.getTargetPixelRatio());
    this.composer.setSize(window.innerWidth, window.innerHeight);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.vibeShaderPass = new ShaderPass(createVibeShaderDefinition());
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.vibeShaderPass);
    this.composer.addPass(this.outputPass);
    this.updatePostProcessingResolution();
    this.setVibeShaderPreset(this.activeVibeShaderPresetId, { announce: false });
  }

  createMuzzleFlashResources() {
    return {
      flashMaterialTemplate: new THREE.MeshBasicMaterial({
        color: 0xfff0c4,
        transparent: true,
        opacity: 0.98,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      flareMaterialTemplate: new THREE.MeshBasicMaterial({
        color: 0xff7a24,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      emberMaterialTemplate: new THREE.MeshBasicMaterial({
        color: 0xff4a24,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      sparkMaterialTemplate: new THREE.MeshBasicMaterial({
        color: 0xffb161,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      }),
      coreGeometry: new THREE.SphereGeometry(0.1, 12, 12),
      plumeGeometry: new THREE.ConeGeometry(0.24, 0.9, 12, 1, true),
      bloomGeometry: new THREE.SphereGeometry(0.19, 12, 12),
      emberShellGeometry: new THREE.SphereGeometry(0.21, 10, 10),
      shockRingGeometry: new THREE.TorusGeometry(0.12, 0.022, 8, 20),
      sideFlareAGeometry: new THREE.BoxGeometry(0.045, 0.46, 0.045),
      sideFlareBGeometry: new THREE.BoxGeometry(0.04, 0.4, 0.04),
      sparkGeometries: [
        new THREE.BoxGeometry(0.035, 0.58, 0.035),
        new THREE.BoxGeometry(0.028, 0.48, 0.028),
        new THREE.BoxGeometry(0.024, 0.38, 0.024)
      ],
      sparkOffsets: [
        Object.freeze({ x: 0.12, y: 0.22, z: 0.04, zRot: 0.42 }),
        Object.freeze({ x: -0.1, y: 0.18, z: -0.05, zRot: -0.55 }),
        Object.freeze({ x: 0.03, y: 0.3, z: -0.1, zRot: 0.18 })
      ]
    };
  }

  prewarmMuzzleFlashEffect() {
    if (this.muzzleFlashPrewarmed || !this.player) {
      return;
    }

    const start = this.player.position.clone().add(new THREE.Vector3(0, 2.1, 0.55));
    const end = start.clone().add(new THREE.Vector3(0, 0, 1));
    this.createMuzzleFlashEffect(null, start, end);
    this.updateCamera();

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    for (const effect of this.combatEffects) {
      if (effect.type === 'muzzleFlash') {
        effect.expiresAt = performance.now() - 1;
      }
    }
    this.updateCombatEffects();
    this.muzzleFlashPrewarmed = true;
  }

  createSoundEffect(url, { volume = 1 } = {}) {
    if (!url) {
      return null;
    }

    return {
      url,
      volume: THREE.MathUtils.clamp(volume, 0, 1),
      template: null
    };
  }

  getSoundEffectTemplate(soundEffect) {
    if (!soundEffect) {
      return null;
    }

    if (!soundEffect.template) {
      const sound = new Audio(soundEffect.url);
      sound.preload = 'auto';
      sound.volume = soundEffect.volume;
      sound.load();
      soundEffect.template = sound;
    }

    return soundEffect.template;
  }

  playSoundEffect(soundEffect) {
    const template = this.getSoundEffectTemplate(soundEffect);
    if (!template) {
      return;
    }

    const sound = template.cloneNode();
    sound.volume = template.volume;
    void sound.play().catch(() => {});
  }

  fireLocalWeapon(aimDirection, origin = null) {
    const didFire = this.npcService?.fireWeapon(
      { x: aimDirection?.x ?? 0, z: aimDirection?.z ?? 0 },
      Date.now(),
      origin
    ) === true;

    if (didFire && this.getLocalPlayerState()?.equippedWeaponId === HELD_ITEM_IDS.pistol) {
      this.playSoundEffect(this.pistolShotSound);
    }

    return didFire;
  }

  punchLocal(aimDirection) {
    const didPunch = this.npcService?.punch?.(
      { x: aimDirection?.x ?? 0, z: aimDirection?.z ?? 0 },
      Date.now()
    ) === true;

    if (didPunch) {
      const emoteId = this.nextPunchEmoteId;
      this.player?.playEmote(emoteId);
      this.nextPunchEmoteId = emoteId === PUNCH_EMOTE_ID ? PUNCH_ALT_EMOTE_ID : PUNCH_EMOTE_ID;
    }

    return didPunch;
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
      this.characterPreviewRenderer?.setVibeShaderState({
        presetId: preset.id,
        intensity: nextIntensity
      });
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
    this.characterPreviewRenderer?.setVibeShaderState({
      presetId: preset.id,
      intensity
    });

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

  storeSelectedCharacterId(characterId) {
    try {
      window.localStorage?.setItem(CHARACTER_STORAGE_KEY, characterId);
    } catch {
      // Ignore storage failures and keep the in-memory selection.
    }
  }

  getCharacterSelectorStatusText() {
    const localPlayerState = this.getLocalPlayerState();
    if (!this.player) {
      return 'Loading fighter';
    }

    if (this.pendingCharacterRequestId && localPlayerState?.characterId !== this.pendingCharacterRequestId) {
      return 'Switching fighter';
    }

    return 'Currently selected';
  }

  async ensureCharacterPreviewRenderer() {
    if (this.characterPreviewRenderer) {
      return this.characterPreviewRenderer;
    }

    if (!this.characterPreviewRendererPromise) {
      this.characterPreviewRendererPromise = import('../ui/CharacterPreviewRenderer.js')
        .then(({ CharacterPreviewRenderer }) => {
          this.characterPreviewRenderer = new CharacterPreviewRenderer({ library: this.library });
          this.hud.setCharacterSelectorPreviewCanvas(this.characterPreviewRenderer.livePreview.renderer.domElement);
          this.characterPreviewRenderer.setVibeShaderState({
            presetId: this.activeVibeShaderPresetId,
            intensity: this.getVibeShaderIntensity(this.activeVibeShaderPresetId)
          });
          return this.characterPreviewRenderer;
        })
        .finally(() => {
          this.characterPreviewRendererPromise = null;
        });
    }

    return this.characterPreviewRendererPromise;
  }

  async syncCharacterSelectorPreview(entries, selectedId) {
    const requestId = ++this.characterSelectorSyncRequestId;
    const renderer = await this.ensureCharacterPreviewRenderer();
    if (requestId !== this.characterSelectorSyncRequestId) {
      return;
    }

    renderer.setActive(this.characterSelectorVisible);
    await renderer.setCharacter(selectedId);
    if (requestId !== this.characterSelectorSyncRequestId || !this.characterSelectorVisible) {
      return;
    }

    this.syncVisibleCharacterSelectorPortraits(entries, renderer, selectedId);
  }

  queueCharacterSelectorViewportSync() {
    if (!this.characterSelectorVisible || this.characterSelectorViewportSyncFrame) {
      return;
    }

    this.characterSelectorViewportSyncFrame = window.requestAnimationFrame(() => {
      this.characterSelectorViewportSyncFrame = 0;
      if (!this.characterSelectorVisible || !this.characterPreviewRenderer) {
        return;
      }

      const selectedId = getPlayableCharacterById(this.desiredLocalCharacterId).id;
      this.syncVisibleCharacterSelectorPortraits(
        this.characterRoster,
        this.characterPreviewRenderer,
        selectedId
      );
    });
  }

  syncVisibleCharacterSelectorPortraits(entries, renderer, selectedId) {
    const visibleIds = new Set(
      this.hud.getVisibleCharacterSelectorCardIds({ overscanPx: 180 })
    );
    visibleIds.add(selectedId);

    for (const entry of entries) {
      if (!visibleIds.has(entry.id)) {
        continue;
      }

      const mount = this.hud.getCharacterSelectorCardPreviewMount(entry.id);
      void renderer.mountPortraitCanvas(entry.id, mount);
    }
  }

  refreshCharacterSelectorHud() {
    const available = this.canUseCharacterSelector();
    const visible = available && this.characterSelectorVisible;
    const selectedId = getPlayableCharacterById(this.desiredLocalCharacterId).id;
    const entries = this.characterRoster.map((entry) => ({ ...entry }));
    this.hud.setCharacterSelectorState({
      available,
      visible,
      selectedId,
      statusText: this.getCharacterSelectorStatusText(),
      entries
    });

    if (!visible) {
      this.characterSelectorSyncRequestId += 1;
      if (this.characterSelectorViewportSyncFrame) {
        window.cancelAnimationFrame(this.characterSelectorViewportSyncFrame);
        this.characterSelectorViewportSyncFrame = 0;
      }
      this.characterPreviewRenderer?.setActive(false);
      return;
    }

    void this.syncCharacterSelectorPreview(entries, selectedId);
  }

  setCharacterSelectorVisible(visible) {
    this.characterSelectorVisible = Boolean(visible) && this.canUseCharacterSelector();
    this.refreshCharacterSelectorHud();
    return this.characterSelectorVisible;
  }

  toggleCharacterSelector(visible = !this.characterSelectorVisible) {
    if (visible && !this.canUseCharacterSelector()) {
      this.hud.showToast('Character selector is admin only.');
      return this.setCharacterSelectorVisible(false);
    }

    return this.setCharacterSelectorVisible(visible);
  }

  cycleCharacterSelection(step = 1) {
    if (!this.canUseCharacterSelector()) {
      this.hud.showToast('Character selector is admin only.');
      return;
    }

    const selectedId = getPlayableCharacterById(this.desiredLocalCharacterId).id;
    const currentIndex = this.characterRoster.findIndex((entry) => entry.id === selectedId);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + step + this.characterRoster.length) % this.characterRoster.length;
    this.selectCharacter(this.characterRoster[nextIndex]?.id ?? selectedId);
  }

  syncPreferredCharacterSelection() {
    const localPlayerState = this.getLocalPlayerState();
    if (!this.canUseCharacterSelector()) {
      this.pendingCharacterRequestId = '';
      const authoritativeCharacterId = getPlayableCharacterById(localPlayerState?.characterId).id;
      if (this.desiredLocalCharacterId !== authoritativeCharacterId) {
        this.desiredLocalCharacterId = authoritativeCharacterId;
        this.storeSelectedCharacterId(authoritativeCharacterId);
      }
      return;
    }

    if (!this.npcService || !this.npcServiceState.sessionId) {
      return;
    }

    const desiredId = getPlayableCharacterById(this.desiredLocalCharacterId).id;
    if (localPlayerState?.characterId === desiredId) {
      this.pendingCharacterRequestId = '';
      return;
    }

    if (this.pendingCharacterRequestId === desiredId) {
      return;
    }

    this.pendingCharacterRequestId = desiredId;
    this.npcService.setCharacter?.(desiredId);
    this.refreshCharacterSelectorHud();
  }

  selectCharacter(characterId) {
    if (!this.canUseCharacterSelector()) {
      this.hud.showToast('Character selector is admin only.');
      return;
    }

    const nextCharacterId = getPlayableCharacterById(characterId).id;
    if (this.desiredLocalCharacterId === nextCharacterId && this.player?.characterId === nextCharacterId) {
      this.refreshCharacterSelectorHud();
      return;
    }

    this.desiredLocalCharacterId = nextCharacterId;
    this.storeSelectedCharacterId(nextCharacterId);
    this.pendingCharacterRequestId = '';
    this.refreshCharacterSelectorHud();
    void this.swapLocalPlayerCharacter(nextCharacterId);
    this.syncPreferredCharacterSelection();
  }

  toggleBuildMode() {
    if (!this.worldBuilder) {
      return;
    }

    if (!this.isLocalAdmin()) {
      this.hud.showToast('World builder is admin only.');
      return;
    }

    const nextEnabled = !this.worldBuilder.enabled;
    if (nextEnabled) {
      this.closeQuickChat();
      this.setCharacterSelectorVisible(false);
      this.setShaderDebugMenuVisible(false);
      this.setAimPoseDebugVisible(false);
      this.worldBuilder.setFocusFromWorldPosition(this.player?.position);
    }
    void this.worldBuilder.setEnabled(nextEnabled);
    if (nextEnabled) {
      this.refreshShaderDebugHud();
    }
    this.refreshZoomHud();
    this.hud.showToast(nextEnabled ? 'World builder enabled.' : 'World builder disabled.');
  }

  isLocalAdmin() {
    return this.getLocalPlayerState()?.isAdmin === true;
  }

  canUseCharacterSelector() {
    return this.isLocalAdmin();
  }

  canUseAimPoseDebug() {
    return this.isLocalAdmin();
  }

  syncAdminAccess() {
    const isAdmin = this.isLocalAdmin();
    void this.worldBuilder?.setCanEdit(isAdmin);

    if (!this.canUseCharacterSelector()) {
      this.characterSelectorVisible = false;
      this.pendingCharacterRequestId = '';
    }

    if (!this.canUseAimPoseDebug()) {
      this.aimPoseDebugVisible = false;
      this.aimPoseDebugShowSkeleton = false;
      this.player?.setAimPoseDebugVisible(false);
    }

    this.refreshAimPoseDebugHud();
    this.refreshAdminPositionHud();
  }

  refreshAdminPositionHud() {
    const isAdmin = this.isLocalAdmin();
    const position = this.player?.position;
    const rotationY = this.player?.object?.rotation?.y ?? 0;

    this.hud.setAdminPositionState({
      visible: Boolean(isAdmin && position),
      x: position?.x ?? 0,
      y: position?.y ?? 0,
      z: position?.z ?? 0,
      heading: THREE.MathUtils.radToDeg(rotationY)
    });
  }

  async drainPendingWorldPatches() {
    if (!this.worldBuilder || !this.worldLayoutReady) {
      return;
    }

    for (const patch of this.pendingWorldPatches.splice(0)) {
      await this.handleWorldPatch(patch);
    }
  }

  requestDeferredSceneSync({ worldPatches = false, pickups = false, remotePlayers = false } = {}) {
    this.worldPatchSyncRequested = this.worldPatchSyncRequested || Boolean(worldPatches);
    this.pickupVisualSyncRequested = this.pickupVisualSyncRequested || Boolean(pickups);
    this.remotePlayerSyncRequested = this.remotePlayerSyncRequested || Boolean(remotePlayers);
  }

  processDeferredWorldPatch() {
    if (
      !this.worldPatchSyncRequested
      || this.worldPatchDrainPromise
      || !this.worldBuilder
      || !this.worldLayoutReady
    ) {
      return;
    }

    const nextPatch = this.pendingWorldPatches.shift();
    if (!nextPatch) {
      this.worldPatchSyncRequested = false;
      return;
    }

    this.worldPatchDrainPromise = this.handleWorldPatch(nextPatch)
      .catch((error) => {
        console.error('[World] Failed to apply deferred world patch.', error);
      })
      .finally(() => {
        this.worldPatchDrainPromise = null;
        this.worldPatchSyncRequested = this.pendingWorldPatches.length > 0;
      });
  }

  processDeferredSceneWork() {
    if (!this.bootCriticalReady) {
      return;
    }

    this.processDeferredWorldPatch();

    if (this.pickupVisualSyncRequested) {
      this.pickupVisualSyncRequested = !this.syncPickupVisuals({ maxCreates: 1 });
    }

    if (this.remotePlayerSyncRequested) {
      this.remotePlayerSyncRequested = !this.syncRemotePlayers({ maxCreates: 1, maxSwaps: 1 });
    }
  }

  scheduleMuzzleFlashWarmup() {
    if (this.muzzleFlashPrewarmed || this.deferredMuzzleFlashWarmupId || !this.player) {
      return;
    }

    const runWarmup = () => {
      this.deferredMuzzleFlashWarmupId = 0;
      if (!this.bootCriticalReady) {
        return;
      }

      this.prewarmMuzzleFlashEffect();
    };

    if (typeof window.requestIdleCallback === 'function') {
      this.deferredMuzzleFlashWarmupId = window.requestIdleCallback(runWarmup, { timeout: 1500 });
      return;
    }

    this.deferredMuzzleFlashWarmupId = window.setTimeout(runWarmup, 900);
  }

  scheduleDeferredStartup() {
    if (this.deferredStartupPromise) {
      return this.deferredStartupPromise;
    }

    this.deferredStartupPromise = (async () => {
      this.markBoot('boot:deferred:start');
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      this.requestDeferredSceneSync({
        worldPatches: true,
        pickups: true,
        remotePlayers: true
      });
      this.scheduleMuzzleFlashWarmup();
      this.markBoot('boot:deferred:end');
      this.measureBoot('deferredStartupQueued', 'boot:deferred:start', 'boot:deferred:end');
      this.reportBootMetrics();
    })();

    return this.deferredStartupPromise;
  }

  syncInitialCameraState(localPlayerState = null) {
    if (!this.player) {
      return;
    }

    const baseRotation = Number.isFinite(localPlayerState?.rotationY)
      ? localPlayerState.rotationY
      : this.player.object.rotation.y;
    const aimRotation = Number.isFinite(localPlayerState?.aimRotationY)
      ? localPlayerState.aimRotationY
      : baseRotation;

    this.player.object.rotation.y = baseRotation;
    this.player.setAimRotation(aimRotation);
    this.currentAimDirection.set(Math.sin(aimRotation), 0, Math.cos(aimRotation));
    if (this.currentAimDirection.lengthSq() <= 0.0001) {
      this.currentAimDirection.set(0, 0, 1);
    } else {
      this.currentAimDirection.normalize();
    }
    this.currentAimMode = false;
    this.player.setAimingState(false);
    this.updateCamera(this.currentAimDirection, false, { snap: true });
  }

  renderCurrentView() {
    if (this.composer) {
      this.composer.render();
      return;
    }

    this.renderer.render(this.scene, this.camera);
  }

  getOrCreateInteriorScene(interiorId = '') {
    if (!interiorId) {
      return null;
    }

    if (!this.interiorScenes.has(interiorId)) {
      const interiorScene = createInteriorScene(interiorId);
      if (!interiorScene) {
        return null;
      }

      interiorScene.setVisible(false);
      this.scene.add(interiorScene.group);
      this.interiorScenes.set(interiorId, interiorScene);
    }

    return this.interiorScenes.get(interiorId) ?? null;
  }

  createInlineShellSignature(entry) {
    const origin = entry?.originPosition ?? { x: 0, y: 0, z: 0 };
    return [
      entry?.placementId ?? '',
      entry?.interior?.id ?? '',
      entry?.rotationQuarterTurns ?? 0,
      Number(origin.x ?? 0).toFixed(2),
      Number(origin.y ?? 0).toFixed(2),
      Number(origin.z ?? 0).toFixed(2)
    ].join(':');
  }

  getInlineInteriorMode(entry) {
    return entry?.interior?.mode ?? 'inline-shell';
  }

  removeInlineShellScene(placementId) {
    const instance = this.inlineShellScenes.get(placementId);
    if (!instance) {
      return;
    }

    if (this.activeInlineShell?.placementId === placementId) {
      if (this.activeInlineShell.mode === 'inline-cutaway') {
        this.worldBuilder?.setPlacementHiddenNodeNames(placementId, []);
        this.worldBuilder?.setPlacementShadowOverrides(placementId, null);
        this.setInlineInteriorLightActive(false);
      } else {
        this.worldBuilder?.setPlacementVisualHidden(placementId, false);
      }
      this.activeInlineShell = null;
    }

    this.builderInlineShellPreviewPlacementIds.delete(placementId);

    if (instance.attached) {
      this.scene.remove(instance.scene.group);
    }
    disposeObjectResources(instance.scene.group);
    this.inlineShellScenes.delete(placementId);
  }

  getOrCreateInlineShellScene(entry) {
    const placementId = entry?.placementId ?? '';
    const signature = this.createInlineShellSignature(entry);
    const existing = this.inlineShellScenes.get(placementId) ?? null;
    if (existing?.signature === signature) {
      return existing.scene;
    }

    if (existing) {
      this.removeInlineShellScene(placementId);
    }

    const shellScene = createInteriorScene(entry?.interior?.id, {
      origin: [
        entry?.originPosition?.x ?? 0,
        entry?.originPosition?.y ?? 0,
        entry?.originPosition?.z ?? 0
      ],
      rotationQuarterTurns: entry?.rotationQuarterTurns ?? 0,
      visible: false,
      includeExitInteractable: false
    });
    if (!shellScene) {
      return null;
    }

    const mode = this.getInlineInteriorMode(entry);
    const attached = mode === 'inline-shell';
    if (attached) {
      this.scene.add(shellScene.group);
    }
    this.inlineShellScenes.set(placementId, {
      signature,
      scene: shellScene,
      attached,
      mode
    });
    return shellScene;
  }

  setInlineInteriorLightActive(active, shellScene = null) {
    if (!this.inlineInteriorLight) {
      return;
    }

    if (!active || !shellScene?.bounds) {
      this.inlineInteriorLight.visible = false;
      return;
    }

    const center = shellScene.bounds.getCenter(new THREE.Vector3());
    const height = Math.max(4.5, shellScene.bounds.max.y - 2.2);
    this.inlineInteriorLight.position.set(center.x, height, center.z);
    this.inlineInteriorLight.visible = true;
  }

  deactivateInlineShell() {
    if (!this.activeInlineShell) {
      return false;
    }

    const { placementId, scene, mode } = this.activeInlineShell;
    scene?.setVisible(false);
    if (mode === 'inline-cutaway') {
      this.worldBuilder?.setPlacementHiddenNodeNames(placementId, []);
      this.worldBuilder?.setPlacementShadowOverrides(placementId, null);
      this.setInlineInteriorLightActive(false);
    } else {
      this.worldBuilder?.setPlacementVisualHidden(placementId, false);
    }
    this.activeInlineShell = null;
    return true;
  }

  suspendInlineShellForBuilder() {
    if (!this.activeInlineShell) {
      return false;
    }

    this.activeInlineShell.scene?.setVisible(false);
    this.activeInlineShell = null;
    this.setInlineInteriorLightActive(false);
    return true;
  }

  clearBuilderInlineShellPreview() {
    if (!this.builderInlineShellPreviewPlacementIds.size) {
      return;
    }

    for (const placementId of [...this.builderInlineShellPreviewPlacementIds]) {
      const instance = this.inlineShellScenes.get(placementId);
      instance?.scene?.setVisible(false);
      if (instance?.mode === 'inline-cutaway') {
        this.worldBuilder?.setPlacementHiddenNodeNames(placementId, []);
        this.worldBuilder?.setPlacementShadowOverrides(placementId, null);
      } else {
        this.worldBuilder?.setPlacementVisualHidden(placementId, false);
      }
    }

    this.builderInlineShellPreviewPlacementIds.clear();
    this.setInlineInteriorLightActive(false);
  }

  syncBuilderInlineShellPreview(entries = []) {
    const nextPlacementIds = new Set(entries.map((entry) => entry.placementId));

    for (const placementId of [...this.builderInlineShellPreviewPlacementIds]) {
      if (nextPlacementIds.has(placementId)) {
        continue;
      }

      const instance = this.inlineShellScenes.get(placementId);
      instance?.scene?.setVisible(false);
      if (instance?.mode === 'inline-cutaway') {
        this.worldBuilder?.setPlacementHiddenNodeNames(placementId, []);
        this.worldBuilder?.setPlacementShadowOverrides(placementId, null);
      } else {
        this.worldBuilder?.setPlacementVisualHidden(placementId, false);
      }
      this.builderInlineShellPreviewPlacementIds.delete(placementId);
    }

    for (const entry of entries) {
      const shellScene = this.getOrCreateInlineShellScene(entry);
      if (!shellScene) {
        continue;
      }

      const mode = this.getInlineInteriorMode(entry);
      shellScene.setVisible(mode !== 'inline-cutaway');
      if (mode === 'inline-cutaway') {
        this.worldBuilder?.setPlacementHiddenNodeNames(
          entry.placementId,
          entry?.interior?.cutawayNodeNames ?? []
        );
        this.worldBuilder?.setPlacementShadowOverrides(entry.placementId, {
          castShadow: false,
          receiveShadow: false
        });
      } else {
        this.worldBuilder?.setPlacementVisualHidden(entry.placementId, true);
      }

      const instance = this.inlineShellScenes.get(entry.placementId);
      if (instance) {
        instance.mode = mode;
      }
      this.builderInlineShellPreviewPlacementIds.add(entry.placementId);
    }

    this.setInlineInteriorLightActive(false);
  }

  activateInlineShell(entry) {
    const shellScene = this.getOrCreateInlineShellScene(entry);
    if (!shellScene) {
      this.deactivateInlineShell();
      return false;
    }

    if (this.activeInlineShell?.placementId !== entry.placementId) {
      this.deactivateInlineShell();
    }

    this.activeInlineShell = {
      placementId: entry.placementId,
      scene: shellScene,
      mode: this.getInlineInteriorMode(entry)
    };
    if (this.activeInlineShell.mode === 'inline-cutaway') {
      shellScene.setVisible(false);
      this.worldBuilder?.setPlacementHiddenNodeNames(
        entry.placementId,
        entry?.interior?.cutawayNodeNames ?? []
      );
      this.worldBuilder?.setPlacementShadowOverrides(entry.placementId, {
        castShadow: false,
        receiveShadow: false
      });
      this.setInlineInteriorLightActive(true, shellScene);
    } else {
      shellScene.setVisible(true);
      this.worldBuilder?.setPlacementVisualHidden(entry.placementId, true);
    }
    return true;
  }

  findInlineShellTarget(entries = []) {
    if (!this.player) {
      return null;
    }

    let nearestTriggerEntry = null;
    let nearestTriggerDistance = Infinity;

    for (const entry of entries) {
      const shellScene = this.getOrCreateInlineShellScene(entry);
      if (!shellScene) {
        continue;
      }

      if (shellScene.bounds.containsPoint(this.player.position)) {
        return entry;
      }

      if (!shellScene.doorwayTriggerBounds?.containsPoint(this.player.position)) {
        continue;
      }

      const triggerDistance = shellScene.doorwayThresholdPosition.distanceToSquared(this.player.position);
      if (triggerDistance < nearestTriggerDistance) {
        nearestTriggerDistance = triggerDistance;
        nearestTriggerEntry = entry;
      }
    }

    return nearestTriggerEntry;
  }

  syncInlineShellState() {
    if (!this.player || !this.worldBuilder || this.currentInterior?.scene) {
      this.deactivateInlineShell();
      this.clearBuilderInlineShellPreview();
      return;
    }

    const entries = this.worldBuilder.getInlineShellEntries();
    const placementIds = new Set(entries.map((entry) => entry.placementId));
    for (const placementId of [...this.inlineShellScenes.keys()]) {
      if (!placementIds.has(placementId)) {
        this.removeInlineShellScene(placementId);
      }
    }

    if (this.worldBuilder.enabled) {
      this.deactivateInlineShell();
      this.syncBuilderInlineShellPreview(entries);
      return;
    }

    this.clearBuilderInlineShellPreview();

    const desiredEntry = this.findInlineShellTarget(entries);
    if (!desiredEntry) {
      this.deactivateInlineShell();
      return;
    }

    this.activateInlineShell(desiredEntry);
  }

  setRemotePlayersVisible(visible) {
    const nextVisible = Boolean(visible);
    for (const avatar of this.remotePlayers.values()) {
      avatar.object.visible = nextVisible;
    }
  }

  setPickupVisualsVisible(visible) {
    const nextVisible = Boolean(visible);
    for (const visual of this.pickupVisuals.values()) {
      visual.object.visible = nextVisible;
    }
  }

  setOutdoorSceneVisible(visible) {
    const nextVisible = Boolean(visible);
    if (this.cityVisualRoot) {
      this.cityVisualRoot.visible = nextVisible;
    }
    this.worldBuilder?.setVisible(nextVisible);
    this.setRemotePlayersVisible(nextVisible);
    this.setPickupVisualsVisible(nextVisible);
  }

  getActiveSceneBounds() {
    return this.currentInterior?.scene?.bounds ?? this.cityBounds;
  }

  getActiveGroundHeightAt(worldPosition) {
    if (this.currentInterior?.scene) {
      return this.currentInterior.scene.getGroundHeightAt(worldPosition);
    }

    return this.worldBuilder?.getGroundHeightAt(worldPosition) ?? 0;
  }

  getActiveColliders() {
    if (this.currentInterior?.scene) {
      return this.currentInterior.scene.colliders ?? [];
    }

    return [
      ...(this.baseColliders ?? []),
      ...(this.worldBuilder?.getColliders() ?? [])
    ];
  }

  getActiveInteractables() {
    if (this.currentInterior?.scene) {
      return [...(this.currentInterior.scene.interactables ?? [])];
    }

    return [
      ...(this.staticInteractables ?? []),
      ...(this.worldBuilder?.getInteractables() ?? []),
      ...[...this.npcServiceState.pickups.values()]
        .filter((pickup) => pickup.active)
        .map((pickup) => ({
          kind: 'pickup',
          pickupId: pickup.id,
          position: new THREE.Vector3(
            pickup.x,
            this.getActiveGroundHeightAt({ x: pickup.x, z: pickup.z }),
            pickup.z
          ),
          radius: 3.2,
          prompt: 'Pick up pistol',
          actionText: 'Pistol secured.'
        }))
    ].filter((interactable) => interactable.kind !== 'npc');
  }

  getNearestNpcInteractable() {
    if (!this.player || this.currentInterior?.scene || !this.worldBuilder) {
      return null;
    }

    let nearest = null;
    let nearestDistance = Infinity;

    for (const interactable of this.worldBuilder.getInteractables()) {
      if (interactable.kind !== 'npc' || !interactable.position) {
        continue;
      }

      const radius = Number(interactable.radius);
      if (!Number.isFinite(radius) || radius <= 0) {
        continue;
      }

      const distance = interactable.position.distanceTo(this.player.position);
      if (distance < radius && distance < nearestDistance) {
        nearest = interactable;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  getNpcInteractableById(npcId = '') {
    if (!npcId || !this.worldBuilder) {
      return null;
    }

    for (const interactable of this.worldBuilder.getInteractables()) {
      if (
        interactable.kind === 'npc'
        && (interactable.npcId === npcId || interactable.placementId === npcId)
      ) {
        return interactable;
      }
    }

    return null;
  }

  getDeliveryQuestReminderKey(questState = null) {
    if (!questState?.giverNpcId && !questState?.deliveryQuestGiverNpcId) {
      return '';
    }

    const giverNpcId = questState.giverNpcId ?? questState.deliveryQuestGiverNpcId ?? '';
    const targetNpcId = questState.targetNpcId ?? questState.deliveryQuestTargetNpcId ?? '';
    const acceptedAt = questState.acceptedAt ?? questState.deliveryQuestAcceptedAt ?? 0;
    return `${giverNpcId}:${targetNpcId}:${acceptedAt}`;
  }

  suppressCurrentDeliveryReminder(questState = null) {
    const key = this.getDeliveryQuestReminderKey(questState);
    if (key) {
      this.deliveryQuestReminderSuppressedKey = key;
      this.deliveryQuestReminderSuppressionExpiresAt = performance.now() + 5000;
    }
  }

  syncDeliveryQuestReminderGate(playerState = this.getLocalPlayerState()) {
    if (!isDeliveryQuestActive(playerState)) {
      if (
        this.deliveryQuestReminderSuppressedKey
        && performance.now() < this.deliveryQuestReminderSuppressionExpiresAt
      ) {
        return false;
      }

      this.deliveryQuestReminderSuppressedKey = '';
      this.deliveryQuestReminderSuppressionExpiresAt = 0;
      return false;
    }

    const key = this.getDeliveryQuestReminderKey(playerState);
    if (!key || this.deliveryQuestReminderSuppressedKey !== key) {
      return false;
    }

    const giver = this.getNpcInteractableById(playerState.deliveryQuestGiverNpcId);
    const radius = Number(giver?.radius);
    const insideGiverRadius = Boolean(
      this.player
      && giver?.position
      && Number.isFinite(radius)
      && this.player.position.distanceTo(giver.position) < radius
    );

    if (!insideGiverRadius) {
      this.deliveryQuestReminderSuppressedKey = '';
      this.deliveryQuestReminderSuppressionExpiresAt = 0;
      return false;
    }

    return true;
  }

  getDeliveryQuestInteractionForNpc(interactable = this.getNearestNpcInteractable()) {
    const npcId = interactable?.kind === 'npc'
      ? (interactable.npcId || interactable.placementId || '')
      : '';
    if (!npcId) {
      return null;
    }

    const playerState = this.getLocalPlayerState();
    const npcState = this.npcServiceState.npcs.get(npcId);
    if (!playerState || playerState.alive === false || !npcState || npcState.alive === false) {
      return null;
    }
    const npcDetails = {
      ...npcState,
      deliveryQuestEnabled: npcState.deliveryQuestEnabled === true || interactable?.npc?.deliveryQuestEnabled === true
    };

    if (isDeliveryQuestActive(playerState)) {
      if (npcId === playerState.deliveryQuestTargetNpcId) {
        return {
          kind: 'completeDelivery',
          action: true,
          npcId,
          label: '',
          overheadText: 'E to deliver',
          variant: 'interaction'
        };
      }

      if (
        npcId === playerState.deliveryQuestGiverNpcId
        && isDeliveryQuestGiver(npcId, npcDetails)
      ) {
        if (this.syncDeliveryQuestReminderGate(playerState)) {
          return null;
        }

        const targetName = getDeliveryQuestTargetName(
          this.npcServiceState.npcs.get(playerState.deliveryQuestTargetNpcId)
        );
        return {
          kind: 'deliveryReminder',
          action: false,
          npcId,
          label: npcState.name,
          overheadText: `Hey, I am still waiting. Did you deliver that package to ${targetName}?`,
          variant: 'npc'
        };
      }

      return null;
    }

    if (!isDeliveryQuestGiver(npcId, npcDetails)) {
      return null;
    }

    return {
      kind: 'acceptDelivery',
      action: true,
      npcId,
      label: npcState.name,
      overheadText: 'Hey, can you help me make a delivery? Press E to accept.',
      variant: 'npc'
    };
  }

  async handleDeliveryQuestInteraction(interaction = null) {
    if (!interaction?.action || this.deliveryQuestRequestInFlight) {
      return;
    }

    this.deliveryQuestRequestInFlight = true;
    try {
      const service = this.npcService;
      const result = interaction.kind === 'completeDelivery'
        ? await service?.completeDeliveryQuest?.(interaction.npcId)
        : await service?.acceptDeliveryQuest?.(interaction.npcId);

      if (!result?.ok) {
        this.hud.showToast(result?.error ?? 'That delivery cannot be handled right now.');
        return;
      }

      if (interaction.kind === 'completeDelivery') {
        this.hud.showToast(`Delivered to ${result.targetName ?? 'the contact'}.`);
        return;
      }

      this.suppressCurrentDeliveryReminder(result);
      this.hud.showToast(`Delivery accepted. Find ${result.targetName ?? interaction.targetName ?? 'the contact'}.`);
    } catch (error) {
      console.warn('[Quest] Delivery interaction failed.', error);
      this.hud.showToast('Delivery request failed.');
    } finally {
      this.deliveryQuestRequestInFlight = false;
    }
  }

  resolveRotatedOffsetPosition(originPosition, rotationQuarterTurns = 0, offset = [0, 0]) {
    const [offsetX, offsetZ] = cloneOffset(offset);
    const rotatedOffset = rotateFootprintOffset(offsetX, offsetZ, rotationQuarterTurns);
    return new THREE.Vector3(
      (originPosition?.x ?? 0) + rotatedOffset.x,
      this.player?.position?.y ?? 0,
      (originPosition?.z ?? 0) + rotatedOffset.z
    );
  }

  enterInterior(interactable) {
    const interiorId = interactable?.interior?.id ?? '';
    const interiorScene = this.getOrCreateInteriorScene(interiorId);
    if (!interiorScene || !this.player) {
      return false;
    }

    this.finishWorkout({ cancelled: true });
    if (this.currentInterior?.scene) {
      this.currentInterior.scene.setVisible(false);
    }

    this.deactivateInlineShell();

    const exteriorReturnPosition = this.resolveRotatedOffsetPosition(
      interactable.originPosition,
      interactable.rotationQuarterTurns,
      interactable.interior?.exteriorSpawnOffset ?? [0, 0]
    );

    this.currentInterior = {
      scene: interiorScene,
      returnPosition: exteriorReturnPosition
    };
    this.currentInterior.scene.setVisible(true);
    this.setOutdoorSceneVisible(false);
    this.player.position.copy(interiorScene.spawnPoint);
    this.player.position.y = this.getActiveGroundHeightAt(this.player.position);
    this.currentInteractable = null;
    this.hud.setPrompt(null);
    this.hud.showToast(`Entered ${interiorScene.label}.`);
    return true;
  }

  exitInterior({ showToast = true } = {}) {
    if (!this.currentInterior?.scene || !this.player) {
      return false;
    }

    this.finishWorkout({ cancelled: true });
    const { scene, returnPosition } = this.currentInterior;
    scene.setVisible(false);
    this.currentInterior = null;
    this.setOutdoorSceneVisible(true);
    if (returnPosition) {
      this.player.position.copy(returnPosition);
      this.player.position.y = this.getActiveGroundHeightAt(this.player.position);
    }
    this.currentInteractable = null;
    this.hud.setPrompt(null);
    if (showToast) {
      this.hud.showToast('Back outside.');
    }
    return true;
  }

  syncWorkoutState() {
    if (!this.worldBuilder) {
      return;
    }

    this.worldBuilder.setPlayerWorkoutState(this.npcServiceState.players ?? new Map(), {
      pendingPlacementId: this.pendingWorkoutPlacementId,
      claimedPlacementId: this.claimedWorkoutPlacementId,
      activePlacementId: this.activeWorkoutPlacementId
    });
  }

  releaseWorkoutPlacement(placementId = '') {
    const normalizedPlacementId = typeof placementId === 'string' ? placementId.trim() : '';
    if (!normalizedPlacementId || !this.npcService?.releaseWorkoutPlacement) {
      return;
    }

    void this.npcService.releaseWorkoutPlacement(normalizedPlacementId).catch(() => {});
  }

  async startWorkout(interactable) {
    if (
      !this.player
      || !interactable
      || this.activeWorkout
      || this.pendingWorkoutPlacementId
      || this.claimedWorkoutPlacementId
    ) {
      return false;
    }

    if (interactable.kind !== 'snatch-workout') {
      return false;
    }

    if (interactable.busy) {
      this.hud.showToast('That barbell is already in use.');
      return false;
    }

    const placementId = typeof interactable.placementId === 'string'
      ? interactable.placementId
      : '';
    if (!placementId || !this.npcService?.claimWorkoutPlacement) {
      return false;
    }

    this.pendingWorkoutPlacementId = placementId;
    this.syncWorkoutState();
    let claimResult = null;
    try {
      claimResult = await this.npcService.claimWorkoutPlacement(placementId);
    } catch (error) {
      this.pendingWorkoutPlacementId = '';
      this.syncWorkoutState();
      this.hud.showToast(error?.message || 'Could not use that barbell right now.');
      return false;
    }
    if (!claimResult?.ok) {
      this.pendingWorkoutPlacementId = '';
      this.syncWorkoutState();
      this.hud.showToast(claimResult?.error ?? 'That barbell is already in use.');
      return false;
    }

    this.pendingWorkoutPlacementId = '';
    this.claimedWorkoutPlacementId = placementId;
    this.syncWorkoutState();

    if (!this.player || this.getLocalPlayerState()?.alive === false) {
      this.claimedWorkoutPlacementId = '';
      this.syncWorkoutState();
      this.releaseWorkoutPlacement(placementId);
      return false;
    }

    void preloadMixamoClips([SNATCH_WORKOUT_EMOTE_ID]);
    this.clearPendingHipFireShot();
    this.currentAimMode = false;
    this.player.setAimingState(false);
    this.player.stopEmote?.();
    this.activeWorkout = {
      kind: interactable.kind,
      phase: 'approach',
      interactable,
      carriedBarbell: null,
      endsAt: 0
    };
    this.currentInteractable = null;
    this.hud.setPrompt(null);
    return true;
  }

  beginWorkoutLift() {
    if (!this.activeWorkout || !this.player) {
      return false;
    }

    const { interactable } = this.activeWorkout;
    const carriedBarbell = createOlympicBarbellVisual({ origin: 'center' });
    this.scene.add(carriedBarbell);
    this.activeWorkout.phase = 'lifting';
    this.activeWorkout.carriedBarbell = carriedBarbell;
    this.activeWorkout.endsAt = performance.now() + SNATCH_WORKOUT_DURATION_MS;
    this.activeWorkoutPlacementId = interactable?.placementId ?? '';
    this.syncWorkoutState();
    this.player.setFacing(interactable?.approachRotationY ?? this.player.object.rotation.y);
    this.player.setAimRotation(interactable?.approachRotationY ?? this.player.object.rotation.y);
    this.player.stopEmote?.();
    this.player.playEmote(SNATCH_WORKOUT_EMOTE_ID);
    this.syncWorkoutBarbell();
    return true;
  }

  syncWorkoutBarbell() {
    if (!this.activeWorkout?.carriedBarbell || !this.player?.sockets) {
      return;
    }

    const leftHand = this.player.sockets.handLeft;
    const rightHand = this.player.sockets.handRight;
    if (!leftHand || !rightHand) {
      return;
    }

    leftHand.getWorldPosition(this.workoutLeftHandPosition);
    rightHand.getWorldPosition(this.workoutRightHandPosition);
    this.workoutBarbellMidpoint
      .copy(this.workoutLeftHandPosition)
      .add(this.workoutRightHandPosition)
      .multiplyScalar(0.5);
    this.workoutBarbellAxis
      .subVectors(this.workoutRightHandPosition, this.workoutLeftHandPosition)
      .setY(0);

    if (this.workoutBarbellAxis.lengthSq() <= 0.0001) {
      const facing = this.player.object.rotation.y;
      this.workoutBarbellAxis.set(Math.cos(facing), 0, -Math.sin(facing));
    } else {
      this.workoutBarbellAxis.normalize();
    }

    this.workoutForward.set(
      Math.sin(this.player.object.rotation.y),
      0,
      Math.cos(this.player.object.rotation.y)
    );
    this.activeWorkout.carriedBarbell.position
      .copy(this.workoutBarbellMidpoint)
      .addScaledVector(this.workoutForward, 0.08);
    this.workoutBarbellQuaternion.setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      this.workoutBarbellAxis
    );
    this.activeWorkout.carriedBarbell.quaternion.copy(this.workoutBarbellQuaternion);
  }

  finishWorkout({ cancelled = false } = {}) {
    if (!this.activeWorkout) {
      return false;
    }

    const workout = this.activeWorkout;
    const placementId = workout.interactable?.placementId
      ?? this.activeWorkoutPlacementId
      ?? this.claimedWorkoutPlacementId
      ?? '';
    this.activeWorkout = null;
    this.activeWorkoutPlacementId = '';
    this.claimedWorkoutPlacementId = '';
    if (this.pendingWorkoutPlacementId === placementId) {
      this.pendingWorkoutPlacementId = '';
    }
    this.syncWorkoutState();
    if (cancelled) {
      this.player?.stopEmote?.();
    }
    if (workout.carriedBarbell) {
      workout.carriedBarbell.parent?.remove(workout.carriedBarbell);
      disposeObjectResources(workout.carriedBarbell);
    }
    if (placementId) {
      this.releaseWorkoutPlacement(placementId);
    }
    if (!cancelled) {
      this.hud.showToast('Snatch complete.');
    }
    return true;
  }

  updateActiveWorkout(deltaSeconds, { localAlive, colliders, sceneBounds, groundHeight } = {}) {
    if (!this.activeWorkout || !this.player) {
      return false;
    }

    if (localAlive === false) {
      this.finishWorkout({ cancelled: true });
      return false;
    }

    this.player.setAimingState(false);

    if (this.activeWorkout.phase === 'approach') {
      const movement = this.player.moveToward(
        this.activeWorkout.interactable.approachPosition,
        deltaSeconds,
        colliders,
        sceneBounds,
        groundHeight,
        {
          speedScale: 0.82,
          stopDistance: SNATCH_APPROACH_STOP_DISTANCE
        }
      );
      if (movement.arrived) {
        this.player.position.copy(this.activeWorkout.interactable.approachPosition);
        this.player.position.y = groundHeight;
        this.player.setFacing(this.activeWorkout.interactable.approachRotationY ?? this.player.object.rotation.y);
        this.player.setAimRotation(this.activeWorkout.interactable.approachRotationY ?? this.player.object.rotation.y);
        this.beginWorkoutLift();
      }
      return true;
    }

    this.player.setFacing(this.activeWorkout.interactable.approachRotationY ?? this.player.object.rotation.y);
    this.player.setAimRotation(this.activeWorkout.interactable.approachRotationY ?? this.player.object.rotation.y);
    this.player.update(
      deltaSeconds,
      ZERO_INPUT,
      this.camera,
      colliders,
      sceneBounds,
      groundHeight
    );
    this.syncWorkoutBarbell();

    if (performance.now() >= this.activeWorkout.endsAt) {
      this.finishWorkout();
    }

    return true;
  }

  async start() {
    try {
      this.markBoot('boot:start');
      this.setBootLoadingProgress(0.05);
      console.info('[Game] Starting game bootstrap.');
      this.setupLights();
      this.setupAtmosphere();
      this.setBootLoadingProgress(0.12);

      const cityState = await buildCity(this.scene);
      this.setBootLoadingProgress(0.24);
      console.info('[Game] City built.', {
        colliderCount: cityState.colliders?.length ?? 0,
        interactableCount: cityState.interactables?.length ?? 0
      });
      this.cityVisualRoot = cityState.root ?? null;
      this.baseColliders = cityState.colliders;
      this.staticInteractables = cityState.interactables;
      this.cityBounds = cityState.cityBounds;
      this.markBoot('boot:npc-service:start');
      this.npcService = await createNpcService();
      this.setBootLoadingProgress(0.36);
      this.markBoot('boot:npc-service:end');
      this.measureBoot('npcServiceReady', 'boot:npc-service:start', 'boot:npc-service:end');
      console.info('[Game] NPC service ready.', {
        transport: this.npcService?.getState?.()?.transport ?? 'unknown'
      });
      this.combatEventUnsubscribe = this.npcService.subscribeCombatEvents((event) => {
        this.handleCombatEvent(event);
      });
      this.worldPatchUnsubscribe = this.npcService.subscribeWorldPatches((patch) => {
        this.pendingWorldPatches.push(patch);
        if (this.bootCriticalReady) {
          this.requestDeferredSceneSync({ worldPatches: true });
        }
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
        this.syncPreferredCharacterSelection();
        this.syncAdminAccess();
        this.registerHeldItemDebugTools();
        this.applyNpcRuntimeState();
        this.worldBuilder?.setRemoteBuilders(state.builders, state.sessionId);
        if (this.bootCriticalReady) {
          this.requestDeferredSceneSync({
            pickups: true,
            remotePlayers: true
          });
        }
        this.refreshCharacterSelectorHud();
      });

      this.markBoot('boot:layout:start');
      const sharedLayout = await this.npcService.getWorldLayout();
      this.setBootLoadingProgress(0.5);
      this.markBoot('boot:layout:end');
      this.measureBoot('worldLayoutReady', 'boot:layout:start', 'boot:layout:end');
      console.info('[Game] Shared world layout loaded.', {
        tiles: sharedLayout.tiles?.length ?? 0,
        props: sharedLayout.props?.length ?? 0,
        npcs: sharedLayout.npcs?.length ?? 0
      });
      this.currentLayout = sharedLayout;
      await this.worldBuilder.loadLayout(sharedLayout);
      this.worldLayoutReady = true;
      this.setBootLoadingProgress(0.72);

      this.markBoot('boot:avatar:start');
      this.player = await this.buildAvatar(this.desiredLocalCharacterId);
      this.setBootLoadingProgress(0.88);
      this.markBoot('boot:avatar:end');
      this.measureBoot('localAvatarReady', 'boot:avatar:start', 'boot:avatar:end');
      console.info('[Game] Local player loaded.');
      const localPlayerState = this.npcServiceState.players.get(this.npcServiceState.sessionId);
      if (localPlayerState) {
        this.player.position.set(localPlayerState.x, 0, localPlayerState.z);
      } else {
        this.player.position.copy(cityState.spawnPoint);
      }
      this.player.position.y = this.getActiveGroundHeightAt(this.player.position) ?? cityState.spawnPoint.y;
      this.scene.add(this.player.object);
      const aimPoseDebugHelper = this.player.getAimPoseDebugHelper?.();
      if (aimPoseDebugHelper) {
        this.scene.add(aimPoseDebugHelper);
      }
      this.syncAdminAccess();
      this.registerHeldItemDebugTools();
      this.player.setAimPoseDebugVisible(this.canUseAimPoseDebug() && this.aimPoseDebugShowSkeleton);
      this.refreshAimPoseDebugHud();
      if (localPlayerState) {
        const localAlive = localPlayerState.alive !== false;
        this.player.setAliveState(localAlive, {
          startedAtMs: Number.isFinite(localPlayerState.lastDamagedAt) && localPlayerState.lastDamagedAt > 0
            ? localPlayerState.lastDamagedAt
            : Date.now()
        });
        await this.player.setWeaponState(
          localAlive ? localPlayerState.equippedWeaponId : '',
          { visible: localAlive && Boolean(localPlayerState.equippedWeaponId) }
        );
        this.player.setReloadState(Boolean(localAlive && localPlayerState.isReloading), {
          weaponId: localAlive ? localPlayerState.equippedWeaponId : '',
          endsAtMs: localPlayerState.reloadEndsAt ?? 0
        });
      }
      this.syncInitialCameraState(localPlayerState);
      this.enableDetailedRendering();
      this.setBootLoadingProgress(0.96, {
        render: true
      });
      this.bootCriticalReady = true;

      if (this.npcServiceState.transport === 'colyseus') {
        this.hud.showToast('Connected to the multiplayer room. Shared building, world chat, NPC replies, and player presence are live.');
      } else {
        this.hud.showToast('Running local mock multiplayer. World chat and NPC replies work locally without Colyseus.');
      }

      console.info('[Game] Entering render loop.');
      this.renderer.setAnimationLoop(() => this.frame());
      void this.scheduleDeferredStartup();
      await this.warmBootPreviewFrames({
        frames: 5,
        minDurationMs: 220
      });
      this.markBoot('boot:loading-hide');
      this.setBootLoadingProgress(1, {
        render: true
      });
      this.hud.hideLoading();
      this.rentIntroLoadingClearedAt = performance.now() + RENT_INTRO_LOADING_CLEAR_MS;
      this.measureBoot('loadingOverlayHidden', 'boot:start', 'boot:loading-hide');
    } catch (error) {
      console.error('[Game] Failed during bootstrap.', error);
      this.hud.showToast('Failed to load part of the city. Check the console for details.');
      throw error;
    }
  }

  setupLights() {
    this.hemiLight = new THREE.HemisphereLight(0xd8efff, 0x35503d, 1.9);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff0cf, 2.6);
    this.sunLight.position.set(45, 70, 30);
    this.sunLight.castShadow = this.detailedRenderingEnabled;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.left = -WORLD_SHADOW_EXTENT;
    this.sunLight.shadow.camera.right = WORLD_SHADOW_EXTENT;
    this.sunLight.shadow.camera.top = WORLD_SHADOW_EXTENT;
    this.sunLight.shadow.camera.bottom = -WORLD_SHADOW_EXTENT;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = WORLD_GROUND_RADIUS + 40;
    this.scene.add(this.sunLight);

    this.inlineInteriorLight = new THREE.PointLight(0xfff6ea, 7.5, 30, 2);
    this.inlineInteriorLight.castShadow = false;
    this.inlineInteriorLight.visible = false;
    this.scene.add(this.inlineInteriorLight);
  }

  setupAtmosphere() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(WORLD_GROUND_RADIUS + 60, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x95bfde, side: THREE.BackSide })
    );
    sky.position.y = 30;
    this.scene.add(sky);
  }

  enableDetailedRendering() {
    if (this.detailedRenderingEnabled) {
      return;
    }

    this.detailedRenderingEnabled = true;
    this.renderer.shadowMap.enabled = true;
    if (this.sunLight) {
      this.sunLight.castShadow = true;
    }
    this.setupPostProcessing();
    this.onResize();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.getTargetPixelRatio());
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer?.setPixelRatio(this.getTargetPixelRatio());
    this.composer?.setSize(window.innerWidth, window.innerHeight);
    this.updatePostProcessingResolution();
  }

  registerHeldItemDebugTools() {
    if (!this.player) {
      return;
    }

    const localDebugHost = isLocalDebugHost();
    const adminAimPoseDebug = this.canUseAimPoseDebug();
    const getActiveItemId = () => this.getLocalPlayerState()?.equippedWeaponId || HELD_ITEM_IDS.pistol;
    const clampVector = (values, fallback = [0, 0, 0]) => [0, 1, 2].map((index) => Number(values?.[index] ?? fallback[index] ?? 0));
    if (localDebugHost) {
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

      const cloneDebugValue = (value) => {
        if (typeof structuredClone === 'function') {
          return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
      };

      const roundDebugValue = (value) => {
        if (Array.isArray(value)) {
          return value.map((entry) => roundDebugValue(entry));
        }

        if (value && typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, roundDebugValue(entry)])
          );
        }

        return Number.isFinite(value) ? Number(value.toFixed(4)) : value;
      };

      const printReload = (itemId = getActiveItemId()) => {
        const profile = this.player.getHeldItemReloadProfile?.(itemId);
        if (!profile) {
          console.info('[ReloadDebug] No reload profile found.', { itemId });
          return null;
        }

        const printable = {
          id: itemId,
          reloadProfile: roundDebugValue(profile)
        };
        console.info('[ReloadDebug] Current reload profile.', printable);
        return printable;
      };

      const updateReloadProfile = (mutator, itemId = getActiveItemId()) => {
        const current = this.player.getHeldItemReloadProfile?.(itemId);
        if (!current) {
          console.info('[ReloadDebug] No reload profile found.', { itemId });
          return null;
        }

        const nextProfile = cloneDebugValue(current);
        mutator(nextProfile);
        const applied = this.player.setHeldItemReloadProfileOverride?.(itemId, nextProfile) ?? null;
        console.info('[ReloadDebug] Updated reload profile.', {
          itemId,
          reloadProfile: roundDebugValue(applied)
        });
        return applied;
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
        printReload,
        previewReload: (itemId = getActiveItemId(), durationMs = 1200) => {
          const previewed = this.player.previewReload?.(itemId, durationMs) === true;
          if (previewed && itemId === HELD_ITEM_IDS.pistol) {
            this.playSoundEffect(this.pistolCockSound);
          }
          return previewed;
        },
        stopReloadPreview: () => this.player.stopReloadPreview?.(),
        setReloadPose: (boneKey = 'leftArm', x = 0, y = 0, z = 0, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.pose ??= {};
            profile.pose[boneKey] = clampVector([x, y, z]);
          }, itemId),
        nudgeReloadPose: (boneKey = 'leftArm', deltaX = 0, deltaY = 0, deltaZ = 0, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.pose ??= {};
            const current = profile.pose[boneKey] ?? [0, 0, 0];
            profile.pose[boneKey] = [0, 1, 2].map((index) => Number(current[index] ?? 0) + Number([deltaX, deltaY, deltaZ][index] ?? 0));
          }, itemId),
        setReloadEnvelope: (start = 0.14, peak = 0.4, end = 0.88, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.envelope = {
              start: Number(start),
              peak: Number(peak),
              end: Number(end)
            };
          }, itemId),
        setReloadSlideTiming: (start = 0.34, peak = 0.48, end = 0.68, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.slide ??= { nodeName: 'slide_Armature', position: [0, 0, 0] };
            profile.slide.start = Number(start);
            profile.slide.peak = Number(peak);
            profile.slide.end = Number(end);
          }, itemId),
        setReloadSlidePosition: (x = 0, y = 0, z = 0, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.slide ??= { nodeName: 'slide_Armature', start: 0.34, peak: 0.48, end: 0.68 };
            profile.slide.position = clampVector([x, y, z]);
          }, itemId),
        setReloadWeaponPosition: (x = 0, y = 0, z = 0, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.weaponMotion ??= { position: [0, 0, 0], rotation: [0, 0, 0] };
            profile.weaponMotion.position = clampVector([x, y, z]);
          }, itemId),
        setReloadWeaponRotation: (x = 0, y = 0, z = 0, itemId = getActiveItemId()) =>
          updateReloadProfile((profile) => {
            profile.weaponMotion ??= { position: [0, 0, 0], rotation: [0, 0, 0] };
            profile.weaponMotion.rotation = clampVector([x, y, z]);
          }, itemId),
        resetReload: (itemId = getActiveItemId()) => {
          this.player.clearHeldItemReloadProfileOverride?.(itemId);
          return printReload(itemId);
        },
        previewCrateLeftHand: () => this.player.attachHeldItem(HELD_ITEM_IDS.crateA, { visible: true }),
        clearLeftHand: () => this.player.detachHeldItem(ATTACHMENT_SLOTS.handLeft)
      };
      globalThis.printGrip = (...args) => globalThis.__stickRpgHeldItemDebug.printGrip(...args);
      globalThis.printReload = (...args) => globalThis.__stickRpgHeldItemDebug.printReload(...args);
      globalThis.previewReload = (...args) => globalThis.__stickRpgHeldItemDebug.previewReload(...args);
      globalThis.stopReloadPreview = (...args) => globalThis.__stickRpgHeldItemDebug.stopReloadPreview(...args);
      globalThis.setReloadPose = (...args) => globalThis.__stickRpgHeldItemDebug.setReloadPose(...args);
      globalThis.nudgeReloadPose = (...args) => globalThis.__stickRpgHeldItemDebug.nudgeReloadPose(...args);
      globalThis.setReloadEnvelope = (...args) => globalThis.__stickRpgHeldItemDebug.setReloadEnvelope(...args);
      globalThis.setReloadSlideTiming = (...args) => globalThis.__stickRpgHeldItemDebug.setReloadSlideTiming(...args);
      globalThis.setReloadSlidePosition = (...args) => globalThis.__stickRpgHeldItemDebug.setReloadSlidePosition(...args);
      globalThis.setReloadWeaponPosition = (...args) => globalThis.__stickRpgHeldItemDebug.setReloadWeaponPosition(...args);
      globalThis.setReloadWeaponRotation = (...args) => globalThis.__stickRpgHeldItemDebug.setReloadWeaponRotation(...args);
      globalThis.resetReload = (...args) => globalThis.__stickRpgHeldItemDebug.resetReload(...args);
      globalThis.nudgePosition = (...args) => globalThis.__stickRpgHeldItemDebug.nudgePosition(...args);
      globalThis.nudgeRotation = (...args) => globalThis.__stickRpgHeldItemDebug.nudgeRotation(...args);
      globalThis.scaleBy = (...args) => globalThis.__stickRpgHeldItemDebug.scaleBy(...args);
      globalThis.resetGrip = (...args) => globalThis.__stickRpgHeldItemDebug.reset(...args);
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

      console.info('[HeldItemDebug] Attached window.__stickRpgHeldItemDebug helpers.', {
        items: listHeldItemDefinitions().map((definition) => definition.id)
      });
      console.info('[ReloadDebug] Attached window.__stickRpgHeldItemDebug reload helpers.', {
        methods: [
          'printReload',
          'previewReload',
          'stopReloadPreview',
          'setReloadPose',
          'nudgeReloadPose',
          'setReloadEnvelope',
          'setReloadSlideTiming',
          'setReloadSlidePosition',
          'setReloadWeaponPosition',
          'setReloadWeaponRotation',
          'resetReload'
        ]
      });
      console.info('[ShaderDebug] Attached window.__stickRpgShaderDebug helpers.', {
        presets: VIBE_SHADER_PRESETS.map(({ id }) => id)
      });
    }

    if (adminAimPoseDebug) {
      globalThis.__stickRpgAimPoseDebug = {
        fields: ['punchAimYawOffset', ...HELD_ITEM_AIM_POSE_FIELDS.map((field) => field.key)],
        setSection: (section = 'unarmed') => this.setPoseDebugSection(section),
        print: (itemId = getActiveItemId()) => this.printAimPoseDebug(itemId),
        setField: (fieldKey, value = 0, itemId = getActiveItemId()) => this.setAimPoseDebugField(fieldKey, value, itemId),
        reset: (itemId = getActiveItemId()) => this.resetAimPoseDebug(itemId),
        togglePanel: (visible = !this.aimPoseDebugVisible) => this.setAimPoseDebugVisible(visible),
        toggleBones: (visible = !this.aimPoseDebugShowSkeleton) => this.setAimPoseSkeletonDebugVisible(visible)
      };
      globalThis.printAimPose = (...args) => globalThis.__stickRpgAimPoseDebug.print(...args);
      globalThis.setAimPoseField = (...args) => globalThis.__stickRpgAimPoseDebug.setField(...args);
      globalThis.resetAimPose = (...args) => globalThis.__stickRpgAimPoseDebug.reset(...args);

      console.info('[PoseDebug] Attached window.__stickRpgAimPoseDebug helpers.', {
        fields: ['punchAimYawOffset', ...HELD_ITEM_AIM_POSE_FIELDS.map((field) => field.key)]
      });
    }
  }

  getActiveAimPoseDebugItemId() {
    return this.getLocalPlayerState()?.equippedWeaponId || HELD_ITEM_IDS.pistol;
  }

  setAimPoseDebugVisible(visible) {
    const nextVisible = Boolean(visible && this.canUseAimPoseDebug());
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
    this.hud.showToast(nextVisible ? 'Pose debug opened.' : 'Pose debug hidden.');
    return nextVisible;
  }

  setPoseDebugSection(section = 'unarmed') {
    const nextSection = section === 'weaponAim' ? 'weaponAim' : 'unarmed';
    if (this.poseDebugSection === nextSection) {
      return this.poseDebugSection;
    }

    this.poseDebugSection = nextSection;
    this.refreshAimPoseDebugHud();
    return this.poseDebugSection;
  }

  setAimPoseSkeletonDebugVisible(visible) {
    this.aimPoseDebugShowSkeleton = Boolean(visible && this.canUseAimPoseDebug());
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
    if (!this.player || !this.canUseAimPoseDebug()) {
      return null;
    }

    if (fieldKey === 'punchAimYawOffset') {
      const nextConfig = this.player.setEmoteDebugConfigField?.(PUNCH_EMOTE_ID, 'aimYawOffset', value) ?? null;
      this.refreshAimPoseDebugHud();
      return nextConfig;
    }

    if (!itemId) {
      return null;
    }

    const nextPose = this.player.setHeldItemAimPoseFieldOverride(itemId, fieldKey, value);
    this.refreshAimPoseDebugHud();
    return nextPose;
  }

  resetAimPoseDebug(itemId = this.getActiveAimPoseDebugItemId()) {
    if (!this.player || !this.canUseAimPoseDebug()) {
      return null;
    }

    if (this.poseDebugSection === 'unarmed') {
      const nextConfig = this.player.clearEmoteDebugConfig?.(PUNCH_EMOTE_ID) ?? null;
      this.refreshAimPoseDebugHud();
      this.hud.showToast('Unarmed pose debug reset.');
      return nextConfig;
    }

    if (!itemId) {
      return null;
    }

    this.player.clearHeldItemAimPoseOverride(itemId);
    const nextPose = this.player.getHeldItemAimPoseProfile(itemId);
    this.refreshAimPoseDebugHud();
    this.hud.showToast('Weapon aim pose debug reset.');
    return nextPose;
  }

  printAimPoseDebug(itemId = this.getActiveAimPoseDebugItemId()) {
    if (!this.player || !itemId || !this.canUseAimPoseDebug()) {
      return null;
    }

    const pose = this.player.getHeldItemAimPoseProfile(itemId);
    const printable = this.poseDebugSection === 'unarmed'
      ? {
        section: 'unarmed',
        punchFacingOffset: Number(this.player.getEmoteDebugConfig?.(PUNCH_EMOTE_ID)?.aimYawOffset ?? 0)
      }
      : {
        section: 'weaponAim',
        id: itemId,
        aimPose: Object.fromEntries(
          HELD_ITEM_AIM_POSE_FIELDS
            .map((field) => [field.key, Number(pose?.[field.key] ?? 0)])
            .filter(([, value]) => Math.abs(value) > 0.000001)
            .map(([key, value]) => [key, Number(value.toFixed(4))])
        )
      };
    console.info('[PoseDebug] Current pose settings.', printable);
    return printable;
  }

  refreshAimPoseDebugHud() {
    const debugAvailable = Boolean(this.player && this.canUseAimPoseDebug());
    const itemId = this.getActiveAimPoseDebugItemId();
    const pose = this.player?.getHeldItemAimPoseProfile(itemId) ?? {};
    const punchFacingOffset = Number(this.player?.getEmoteDebugConfig?.(PUNCH_EMOTE_ID)?.aimYawOffset ?? 0);
    const statusParts = [];
    statusParts.push(`Weapon: ${itemId || 'none'}`);
    statusParts.push(`Punch offset: ${punchFacingOffset.toFixed(2)}`);
    statusParts.push(this.currentAimMode ? 'Previewing right-click aim.' : 'Press O to open pose debug. Left click punch to test facing.');
    const nextState = {
      available: debugAvailable,
      visible: Boolean(this.aimPoseDebugVisible && debugAvailable),
      statusText: statusParts.join(' | '),
      showSkeleton: this.aimPoseDebugShowSkeleton,
      values: pose,
      extraValues: {
        punchAimYawOffset: punchFacingOffset
      },
      selectedSection: this.poseDebugSection
    };
    const valueSignature = [
      punchFacingOffset.toFixed(3),
      ...HELD_ITEM_AIM_POSE_FIELDS.map((field) => Number(nextState.values?.[field.key] ?? 0).toFixed(3))
    ].join('|');
    const signature = [
      Number(nextState.available),
      Number(nextState.visible),
      Number(nextState.showSkeleton),
      nextState.statusText,
      valueSignature
    ].join('::');

    if (signature === this.lastAimPoseDebugSignature) {
      return;
    }

    this.lastAimPoseDebugSignature = signature;
    this.hud.setAimPoseDebugState(nextState);
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
      runtime.set(npcId, {
        x: npc.position?.[0] ?? npc.x,
        z: npc.position?.[1] ?? npc.z,
        rotationY: npc.rotationY ?? (npc.rotationQuarterTurns * (Math.PI / 2)),
        interactRadius: npc.interactRadius,
        busy: npc.busy,
        mode: npc.mode,
        activity: npc.activity,
        targetPlacementId: npc.targetPlacementId || '',
        alive: npc.alive !== false,
        lastDamagedAt: npc.lastDamagedAt ?? 0,
        respawnAt: npc.respawnAt ?? 0
      });
    }
    this.worldBuilder.setNpcRuntimeState(runtime);
    this.syncWorkoutState();
    this.worldBuilder.setNpcDebugState(this.npcServiceState.npcDebug ?? new Map());
  }

  updateNpcFocusTargets() {
    if (!this.worldBuilder) {
      return;
    }

    const focusTargets = new Map();
    for (const [npcId, npc] of this.npcServiceState.npcs.entries()) {
      if (
        !npc
        || npc.alive === false
        || npc.mode !== 'combat'
        || typeof npc.lastAttackerId !== 'string'
        || !npc.lastAttackerId
      ) {
        continue;
      }

      const targetAvatar = this.getAvatarForSessionId(npc.lastAttackerId);
      if (targetAvatar?.position) {
        focusTargets.set(npcId, {
          x: targetAvatar.position.x,
          z: targetAvatar.position.z
        });
        continue;
      }

      const targetPlayerState = this.npcServiceState.players.get(npc.lastAttackerId);
      if (!targetPlayerState || targetPlayerState.alive === false) {
        continue;
      }

      focusTargets.set(npcId, {
        x: Number(targetPlayerState.x ?? 0),
        z: Number(targetPlayerState.z ?? 0)
      });
    }

    this.worldBuilder.setNpcFocusTargets(focusTargets);
  }

  captureAvatarSnapshot(avatar, fallbackState = null, overrides = {}) {
    const fallbackX = Number(fallbackState?.x ?? 0);
    const fallbackZ = Number(fallbackState?.z ?? 0);
    const fallbackRotationY = Number(fallbackState?.rotationY ?? 0);
    const fallbackAimRotationY = Number(fallbackState?.aimRotationY ?? fallbackRotationY);

    return {
      x: Number.isFinite(overrides.x) ? overrides.x : (avatar?.position.x ?? fallbackX),
      z: Number.isFinite(overrides.z) ? overrides.z : (avatar?.position.z ?? fallbackZ),
      y: Number.isFinite(overrides.y) ? overrides.y : (avatar?.position.y ?? 0),
      rotationY: Number.isFinite(overrides.rotationY) ? overrides.rotationY : (avatar?.object.rotation.y ?? fallbackRotationY),
      aimRotationY: Number.isFinite(overrides.aimRotationY) ? overrides.aimRotationY : (avatar?.getAimRotation?.() ?? fallbackAimRotationY),
      aiming: overrides.aiming ?? fallbackState?.aiming ?? false
    };
  }

  applyAvatarSnapshot(avatar, snapshot, playerState = null) {
    const targetPosition = new THREE.Vector3(snapshot.x, snapshot.y, snapshot.z);
    const groundHeight = this.worldBuilder?.getGroundHeightAt(targetPosition) ?? snapshot.y ?? 0;
    const appliedState = playerState
      ? {
        ...playerState,
        x: snapshot.x,
        z: snapshot.z,
        rotationY: snapshot.rotationY,
        aimRotationY: snapshot.aimRotationY,
        aiming: snapshot.aiming
      }
      : null;

    if (appliedState) {
      avatar.applyRemoteState(appliedState, 0, groundHeight);
    }

    avatar.position.set(snapshot.x, groundHeight, snapshot.z);
    avatar.object.rotation.y = snapshot.rotationY;
    avatar.setAimRotation(snapshot.aimRotationY);
    avatar.setAimingState(Boolean(snapshot.aiming));
  }

  async buildAvatar(characterId, options = {}) {
    return createPlayer(this.library, {
      characterId,
      ...options
    });
  }

  removeAvatarFromScene(avatar) {
    if (!avatar) {
      return;
    }

    this.scene.remove(avatar.object);
    disposeObjectResources(avatar.object);
  }

  async swapLocalPlayerCharacter(characterId) {
    if (!this.worldBuilder) {
      return;
    }

    const targetCharacterId = getPlayableCharacterById(characterId).id;
    const requestId = ++this.localCharacterSwapSequence;
    const currentPlayer = this.player ?? null;
    const localPlayerState = this.getLocalPlayerState();
    const snapshot = this.captureAvatarSnapshot(currentPlayer, localPlayerState, {
      aiming: this.currentAimMode && Boolean(localPlayerState?.equippedWeaponId)
    });
    const nextAvatar = await this.buildAvatar(targetCharacterId);

    if (requestId !== this.localCharacterSwapSequence) {
      disposeObjectResources(nextAvatar.object);
      return;
    }

    const previousDebugHelper = currentPlayer?.getAimPoseDebugHelper?.() ?? null;
    if (previousDebugHelper) {
      this.scene.remove(previousDebugHelper);
    }

    if (currentPlayer) {
      this.removeAvatarFromScene(currentPlayer);
    }

    this.player = nextAvatar;
    this.applyAvatarSnapshot(nextAvatar, snapshot, localPlayerState);
    this.scene.add(nextAvatar.object);

    const nextDebugHelper = nextAvatar.getAimPoseDebugHelper?.();
    if (nextDebugHelper) {
      this.scene.add(nextDebugHelper);
    }

    this.registerHeldItemDebugTools();
    this.player.setAimPoseDebugVisible(this.canUseAimPoseDebug() && this.aimPoseDebugShowSkeleton);
    this.refreshAimPoseDebugHud();
    this.refreshCharacterSelectorHud();
  }

  async swapRemotePlayerCharacter(sessionId, state, {
    indicatorColor = 0x68c7ff,
    indicatorOpacity = 0.65
  } = {}) {
    const targetCharacterId = getPlayableCharacterById(state?.characterId).id;
    const requestId = (this.remoteAvatarBuildRequests.get(sessionId) ?? 0) + 1;
    this.remoteAvatarBuildRequests.set(sessionId, requestId);
    this.pendingRemotePlayers.add(sessionId);

    try {
      const previousAvatar = this.remotePlayers.get(sessionId) ?? null;
      const snapshot = this.captureAvatarSnapshot(previousAvatar, state, {
        x: Number(state?.x ?? previousAvatar?.position.x ?? 0),
        z: Number(state?.z ?? previousAvatar?.position.z ?? 0),
        rotationY: Number(state?.rotationY ?? previousAvatar?.object.rotation.y ?? 0),
        aimRotationY: Number(state?.aimRotationY ?? previousAvatar?.getAimRotation?.() ?? 0),
        aiming: Boolean(state?.aiming)
      });
      const nextAvatar = await this.buildAvatar(targetCharacterId, {
        indicatorColor,
        indicatorOpacity
      });

      if (this.remoteAvatarBuildRequests.get(sessionId) !== requestId) {
        disposeObjectResources(nextAvatar.object);
        return;
      }

      if (previousAvatar) {
        this.removeAvatarFromScene(previousAvatar);
      }

      this.applyAvatarSnapshot(nextAvatar, snapshot, state);
      nextAvatar.object.visible = !this.currentInterior?.scene;
      this.scene.add(nextAvatar.object);
      this.remotePlayers.set(sessionId, nextAvatar);
    } finally {
      this.pendingRemotePlayers.delete(sessionId);
      if (this.bootCriticalReady) {
        this.requestDeferredSceneSync({ remotePlayers: true });
      }
    }
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
      const latestState = this.npcServiceState.players.get(sessionId) ?? initialState;
      const stillPresent = this.npcServiceState.players.has(sessionId) && sessionId !== this.npcServiceState.sessionId;
      if (!stillPresent) {
        return;
      }
      await this.swapRemotePlayerCharacter(sessionId, latestState);
    } catch (error) {
      console.error('[Multiplayer] Failed to create remote player avatar.', {
        sessionId,
        error
      });
    } finally {
      this.pendingRemotePlayers.delete(sessionId);
      if (this.bootCriticalReady) {
        this.requestDeferredSceneSync({ remotePlayers: true });
      }
    }
  }

  removeRemotePlayer(sessionId) {
    const avatar = this.remotePlayers.get(sessionId);
    if (!avatar) {
      return;
    }

    this.removeAvatarFromScene(avatar);
    this.remotePlayers.delete(sessionId);
    this.remoteAvatarBuildRequests.delete(sessionId);
  }

  syncRemotePlayers({ maxCreates = Infinity, maxSwaps = Infinity } = {}) {
    if (!this.player) {
      return true;
    }

    let createsStarted = 0;
    let swapsStarted = 0;
    let hasMoreWork = false;
    const desiredSessionIds = new Set();
    for (const [sessionId, playerState] of this.npcServiceState.players.entries()) {
      if (sessionId === this.npcServiceState.sessionId) {
        continue;
      }

      desiredSessionIds.add(sessionId);
      if (!this.remotePlayers.has(sessionId) && !this.pendingRemotePlayers.has(sessionId)) {
        if (createsStarted < maxCreates) {
          createsStarted += 1;
          void this.ensureRemotePlayer(sessionId, playerState);
        } else {
          hasMoreWork = true;
        }
        continue;
      }

      const avatar = this.remotePlayers.get(sessionId);
      if (avatar && avatar.characterId !== getPlayableCharacterById(playerState?.characterId).id && !this.pendingRemotePlayers.has(sessionId)) {
        if (swapsStarted < maxSwaps) {
          swapsStarted += 1;
          void this.swapRemotePlayerCharacter(sessionId, playerState);
        } else {
          hasMoreWork = true;
        }
      }
    }

    for (const sessionId of [...this.remotePlayers.keys()]) {
      if (!desiredSessionIds.has(sessionId)) {
        this.removeRemotePlayer(sessionId);
      }
    }

    return !hasMoreWork;
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

  syncPickupVisuals({ maxCreates = Infinity } = {}) {
    if (!this.library) {
      return true;
    }

    let createsStarted = 0;
    let hasMoreWork = false;
    const desiredIds = new Set();
    for (const [pickupId, pickup] of this.npcServiceState.pickups.entries()) {
      if (!pickup?.active) {
        continue;
      }

      desiredIds.add(pickupId);
      if (!this.pickupVisuals.has(pickupId) && !this.pendingPickupVisuals.has(pickupId)) {
        if (createsStarted < maxCreates) {
          createsStarted += 1;
          void this.ensurePickupVisual(pickupId, pickup);
        } else {
          hasMoreWork = true;
        }
      }
    }

    for (const pickupId of [...this.pickupVisuals.keys()]) {
      if (!desiredIds.has(pickupId)) {
        this.removePickupVisual(pickupId);
      }
    }

    return !hasMoreWork;
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
      group.visible = !this.currentInterior?.scene;
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
      if (this.bootCriticalReady) {
        this.requestDeferredSceneSync({ pickups: true });
      }
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

  startMoneyAnimation(targetAmount, { fromAmount = this.moneyDisplayAmount, durationMs = RENT_INTRO_MONEY_ANIMATION_MS } = {}) {
    const from = normalizeMoneyAmount(fromAmount);
    const to = normalizeMoneyAmount(targetAmount);
    if (from === to) {
      this.moneyAnimation = null;
      this.moneyDisplayAmount = to;
      return;
    }

    this.moneyAnimation = {
      from,
      to,
      startedAt: performance.now(),
      durationMs: Math.max(120, Number(durationMs) || RENT_INTRO_MONEY_ANIMATION_MS)
    };
    this.moneyDisplayAmount = from;
  }

  getAnimatedMoneyAmount(targetAmount) {
    const target = normalizeMoneyAmount(targetAmount);
    if (!this.moneyAnimation) {
      this.moneyDisplayAmount = target;
      return target;
    }

    if (this.moneyAnimation.to !== target) {
      this.startMoneyAnimation(target, {
        fromAmount: this.moneyDisplayAmount,
        durationMs: 420
      });
      if (!this.moneyAnimation) {
        return this.moneyDisplayAmount;
      }
    }

    const now = performance.now();
    const progress = (now - this.moneyAnimation.startedAt) / this.moneyAnimation.durationMs;
    if (progress >= 1) {
      this.moneyDisplayAmount = this.moneyAnimation.to;
      this.moneyAnimation = null;
      return this.moneyDisplayAmount;
    }

    const eased = easeOutCubic(progress);
    this.moneyDisplayAmount = Math.round(
      this.moneyAnimation.from + ((this.moneyAnimation.to - this.moneyAnimation.from) * eased)
    );
    return this.moneyDisplayAmount;
  }

  syncMoneyHud(targetAmount) {
    this.hud.setMoneyState({
      amount: this.getAnimatedMoneyAmount(targetAmount)
    });
  }

  spawnMoneyFloater(amount) {
    this.moneyFloaters.push({
      id: `money:${++this.moneyFloaterSequence}`,
      amount: normalizeMoneyAmount(amount),
      startedAt: performance.now(),
      durationMs: RENT_INTRO_MONEY_FLOATER_MS
    });
  }

  maybeStartRentIntro(localPlayerState) {
    const seq = Number(localPlayerState?.rentIntroSeq ?? 0);
    if (!Number.isFinite(seq) || seq <= 0 || seq === this.handledRentIntroSeq) {
      return;
    }

    this.handledRentIntroSeq = seq;
    const rentAmount = Math.abs(normalizeMoneyAmount(localPlayerState.rentIntroAmount || 100)) || 100;
    const targetAmount = normalizeMoneyAmount(localPlayerState.money ?? -rentAmount);
    this.pendingRentIntro = {
      seq,
      rentAmount,
      targetAmount,
      npcId: String(localPlayerState.rentIntroNpcId ?? ''),
      line: RENT_INTRO_LINE,
      readyAt: 0
    };
    this.activeRentIntro = null;
    this.moneyAnimation = null;
    this.moneyDisplayAmount = 0;
  }

  updateRentIntroPresentation() {
    const now = performance.now();
    if (this.pendingRentIntro) {
      if (this.rentIntroLoadingClearedAt <= 0) {
        return;
      }

      if (!this.pendingRentIntro.readyAt) {
        this.pendingRentIntro.readyAt = this.rentIntroLoadingClearedAt + RENT_INTRO_AFTER_LOADING_DELAY_MS;
      }

      if (now < this.pendingRentIntro.readyAt) {
        return;
      }

      const line = this.pendingRentIntro.line || RENT_INTRO_LINE;
      const typeDurationMs = Math.max(
        RENT_INTRO_MIN_TYPING_MS,
        line.length * RENT_INTRO_TYPE_MS_PER_CHAR
      );
      const chargeAt = now + typeDurationMs + RENT_INTRO_AFTER_LINE_DELAY_MS;
      this.activeRentIntro = {
        ...this.pendingRentIntro,
        line,
        startedAt: now,
        typeDurationMs,
        chargeAt,
        charged: false,
        expiresAt: chargeAt + RENT_INTRO_SPEECH_HOLD_MS
      };
      this.pendingRentIntro = null;
    }

    if (!this.activeRentIntro) {
      return;
    }

    if (!this.activeRentIntro.charged && now >= this.activeRentIntro.chargeAt) {
      this.activeRentIntro.charged = true;
      this.startMoneyAnimation(this.activeRentIntro.targetAmount, {
        fromAmount: this.moneyDisplayAmount,
        durationMs: RENT_INTRO_MONEY_ANIMATION_MS
      });
      this.spawnMoneyFloater(-this.activeRentIntro.rentAmount);
      this.playSoundEffect(this.rentChaChingSound);
    }

    if (this.activeRentIntro.charged && now >= this.activeRentIntro.expiresAt) {
      this.activeRentIntro = null;
    }
  }

  getRentIntroMoneyTargetAmount(authoritativeAmount) {
    if (this.pendingRentIntro || (this.activeRentIntro && !this.activeRentIntro.charged)) {
      return this.moneyDisplayAmount;
    }

    return authoritativeAmount;
  }

  getRentIntroSpeechText() {
    if (!this.activeRentIntro) {
      return '';
    }

    const line = this.activeRentIntro.line || RENT_INTRO_LINE;
    const elapsedMs = Math.max(0, performance.now() - this.activeRentIntro.startedAt);
    const progress = THREE.MathUtils.clamp(elapsedMs / this.activeRentIntro.typeDurationMs, 0, 1);
    const characterCount = Math.max(1, Math.ceil(line.length * progress));
    return line.slice(0, characterCount);
  }

  isRentIntroReservedNpc(npcId) {
    const normalizedNpcId = String(npcId ?? '');
    return Boolean(
      normalizedNpcId
      && (
        this.pendingRentIntro?.npcId === normalizedNpcId
        || this.activeRentIntro?.npcId === normalizedNpcId
      )
    );
  }

  addMoneyFloaterBubbles(bubbles) {
    if (!this.moneyFloaters.length || !this.player) {
      return;
    }

    const now = performance.now();
    const activeFloaters = [];
    this.moneyFloaterAnchor.set(
      this.player.position.x,
      this.player.position.y + 3.3,
      this.player.position.z
    );
    const projected = this.projectSpeechAnchor(this.moneyFloaterAnchor);

    for (const floater of this.moneyFloaters) {
      const progress = (now - floater.startedAt) / floater.durationMs;
      if (progress >= 1) {
        continue;
      }

      activeFloaters.push(floater);
      if (!projected) {
        continue;
      }

      const eased = easeOutCubic(progress);
      const driftX = Math.sin(progress * Math.PI) * 16;
      bubbles.push({
        id: `money-floater:${floater.id}`,
        text: formatMoneyDelta(floater.amount),
        label: '',
        variant: 'money',
        status: 'done',
        visible: true,
        screenX: projected.x + driftX,
        screenY: projected.y - 18 - (eased * 70),
        opacity: Math.max(0, 1 - (progress * 1.12))
      });
    }

    this.moneyFloaters = activeFloaters;
  }

  syncLocalPlayerState(localPlayerState) {
    if (!this.player || !localPlayerState) {
      return;
    }

    const authoritativeCharacterId = getPlayableCharacterById(localPlayerState.characterId).id;
    if (authoritativeCharacterId === this.desiredLocalCharacterId) {
      this.pendingCharacterRequestId = '';
    }

    if (this.player.characterId !== authoritativeCharacterId) {
      if (!this.pendingCharacterRequestId || authoritativeCharacterId === this.desiredLocalCharacterId) {
        this.desiredLocalCharacterId = authoritativeCharacterId;
        this.storeSelectedCharacterId(authoritativeCharacterId);
        this.refreshCharacterSelectorHud();
        void this.swapLocalPlayerCharacter(authoritativeCharacterId);
        return;
      }
    }

    const isAlive = localPlayerState.alive !== false;
    const targetPosition = new THREE.Vector3(localPlayerState.x, this.player.position.y, localPlayerState.z);
    const distance = this.player.position.distanceTo(targetPosition);
    const respawned = this.localStateInitialized && !this.lastLocalAlive && isAlive;
    const died = this.localStateInitialized && this.lastLocalAlive && !isAlive;

    if (this.currentInterior?.scene && (died || respawned || !isAlive)) {
      this.exitInterior({ showToast: false });
    }

    if (this.activeInlineShell && (died || respawned || !isAlive)) {
      this.deactivateInlineShell();
    }

    const groundHeight = this.getActiveGroundHeightAt(targetPosition);
    if ((!this.currentInterior?.scene) && (!this.localStateInitialized || respawned || died || distance > 2.5)) {
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
    this.player.setReloadState(Boolean(isAlive && localPlayerState.isReloading), {
      weaponId: isAlive ? localPlayerState.equippedWeaponId : '',
      endsAtMs: localPlayerState.reloadEndsAt ?? 0
    });

    this.maybeStartRentIntro(localPlayerState);
    this.updateRentIntroPresentation();
    this.syncMoneyHud(this.getRentIntroMoneyTargetAmount(localPlayerState.money ?? 0));

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
      } else if (event.kind === 'npc') {
        const npcAnchor = this.worldBuilder?.getNpcSpeechAnchors?.()?.get(event.targetId);
        if (npcAnchor) {
          end.y = npcAnchor.y - 2;
        }
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
    } else if (event.kind === 'npc' && event.targetId) {
      const npcAnchor = this.worldBuilder?.getNpcSpeechAnchors?.()?.get(event.targetId);
      if (npcAnchor) {
        point.y = npcAnchor.y - 2;
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

    return { origin, point, delayMs };
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
    let object = null;

    if (kind === 'player') {
      const group = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        new THREE.MeshBasicMaterial({
          color: 0xff8f7a,
          transparent: true,
          opacity: 0.92
        })
      );
      const spark = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.23, 0),
        new THREE.MeshBasicMaterial({
          color: 0xffddd5,
          transparent: true,
          opacity: 0.85,
          depthWrite: false
        })
      );
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.12, 0.28, 28),
        new THREE.MeshBasicMaterial({
          color: 0xff6d80,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2;
      group.add(core);
      group.add(spark);
      group.add(ring);
      group.position.copy(position);
      group.visible = delayMs <= 0;
      object = group;
      this.scene.add(group);
      this.combatEffects.push({
        type: 'impact',
        object: group,
        core,
        spark,
        ring,
        startAt: now + delayMs,
        expiresAt: now + delayMs + IMPACT_EFFECT_LIFETIME_MS
      });
      return;
    }

    object = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshBasicMaterial({
        color: 0xf2c871,
        transparent: true,
        opacity: 0.9
      })
    );
    object.position.copy(position);
    object.visible = delayMs <= 0;
    this.scene.add(object);
    this.combatEffects.push({
      type: 'impact',
      object,
      material: object.material,
      startAt: now + delayMs,
      expiresAt: now + delayMs + IMPACT_EFFECT_LIFETIME_MS
    });
  }

  createMuzzleFlashEffect(avatar, start, end) {
    const direction = end.clone().sub(start);
    if (direction.lengthSq() <= 0.0001) {
      direction.set(0, 0, 1);
    } else {
      direction.normalize();
    }

    const flashGroup = new THREE.Group();
    const attachmentNode = avatar?.getAttachmentPointNode?.('muzzle') ?? null;
    if (attachmentNode) {
      const parentWorldQuaternion = attachmentNode.getWorldQuaternion(new THREE.Quaternion());
      const localDirection = direction.clone().applyQuaternion(parentWorldQuaternion.invert()).normalize();
      flashGroup.position.copy(localDirection).multiplyScalar(0.04);
      flashGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), localDirection);
      attachmentNode.add(flashGroup);
    } else {
      flashGroup.position.copy(start).addScaledVector(direction, 0.04);
      flashGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      this.scene.add(flashGroup);
    }

    const resources = this.muzzleFlashResources;
    const flashMaterial = resources.flashMaterialTemplate.clone();
    const flareMaterial = resources.flareMaterialTemplate.clone();
    const emberMaterial = resources.emberMaterialTemplate.clone();

    const core = new THREE.Mesh(resources.coreGeometry, flashMaterial);
    const plume = new THREE.Mesh(resources.plumeGeometry, flareMaterial);
    plume.position.y = 0.3;
    const bloom = new THREE.Mesh(resources.bloomGeometry, flareMaterial.clone());
    bloom.position.y = 0.12;
    bloom.scale.set(0.95, 0.54, 0.95);
    const emberShell = new THREE.Mesh(resources.emberShellGeometry, emberMaterial);
    emberShell.position.y = 0.08;
    emberShell.scale.set(1.08, 0.42, 1.08);
    const shockRing = new THREE.Mesh(
      resources.shockRingGeometry,
      flareMaterial.clone()
    );
    shockRing.position.y = 0.12;
    shockRing.rotation.x = Math.PI / 2;
    const sideFlareA = new THREE.Mesh(
      resources.sideFlareAGeometry,
      flareMaterial.clone()
    );
    sideFlareA.position.set(0.08, 0.2, 0.02);
    sideFlareA.rotation.z = 0.68;
    const sideFlareB = new THREE.Mesh(
      resources.sideFlareBGeometry,
      emberMaterial.clone()
    );
    sideFlareB.position.set(-0.075, 0.18, -0.03);
    sideFlareB.rotation.z = -0.78;

    const sparks = resources.sparkGeometries.map((geometry, index) => {
      const spark = new THREE.Mesh(geometry, resources.sparkMaterialTemplate.clone());
      const offset = resources.sparkOffsets[index];
      spark.position.set(offset.x, offset.y, offset.z);
      spark.rotation.z = offset.zRot;
      return spark;
    });

    const light = new THREE.PointLight(0xff7a24, 2.4, 5.3, 2);
    light.position.y = 0.18;

    flashGroup.add(core);
    flashGroup.add(plume);
    flashGroup.add(bloom);
    flashGroup.add(emberShell);
    flashGroup.add(shockRing);
    flashGroup.add(sideFlareA);
    flashGroup.add(sideFlareB);
    sparks.forEach((spark) => flashGroup.add(spark));
    flashGroup.add(light);
    const now = performance.now();
    this.combatEffects.push({
      type: 'muzzleFlash',
      object: flashGroup,
      sharedGeometry: true,
      core,
      plume,
      bloom,
      emberShell,
      shockRing,
      sideFlareA,
      sideFlareB,
      sparks,
      sparkOffsets: resources.sparkOffsets.map((offset) => cloneVector3Like(offset)),
      light,
      startedAt: now,
      expiresAt: now + MUZZLE_FLASH_LIFETIME_MS
    });
  }

  updateCombatEffects() {
    const now = performance.now();
    const next = [];
    for (const effect of this.combatEffects) {
      if (now >= effect.expiresAt) {
        effect.object.parent?.remove(effect.object);
        if (effect.trail) {
          effect.trail.parent?.remove(effect.trail);
        }
        if (effect.sharedGeometry) {
          disposeObjectMaterials(effect.object);
        } else {
          disposeObjectResources(effect.object);
        }
        effect.trailGeometry?.dispose?.();
        disposeMaterial(effect.material);
        disposeMaterial(effect.secondaryMaterial);
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
        if (effect.core && effect.spark && effect.ring) {
          const burst = 1 + Math.sin(progress * Math.PI) * 0.85;
          effect.object.scale.setScalar(1 + (progress * 0.16));
          effect.core.scale.setScalar(0.92 + (progress * 0.58));
          effect.spark.scale.set(0.78 + (burst * 0.92), 1.18 + (progress * 0.2), 0.78 + (burst * 0.92));
          effect.spark.rotation.x = progress * 1.35;
          effect.spark.rotation.y = progress * 2.6;
          effect.ring.scale.setScalar(0.7 + (progress * 2.35));
          effect.ring.position.y = 0.02 + (progress * 0.06);
          effect.core.material.opacity = Math.max(0, 0.92 - (progress * 1.1));
          effect.spark.material.opacity = Math.max(0, 0.85 - (progress * 1.04));
          effect.ring.material.opacity = Math.max(0, 0.8 - (progress * 1.24));
        } else {
          effect.object.scale.setScalar(1 + (progress * 0.75));
          effect.material.opacity = Math.max(0, 1 - progress);
        }
      } else if (effect.type === 'muzzleFlash') {
        const lifetime = Math.max(1, effect.expiresAt - effect.startedAt);
        const progress = THREE.MathUtils.clamp((now - effect.startedAt) / lifetime, 0, 1);
        const burst = 1 + Math.sin(progress * Math.PI) * 0.92;
        const taper = Math.max(0, 1 - progress);

        effect.core.scale.setScalar(0.56 + burst * 0.62);
        effect.bloom.scale.set(0.86 + burst * 0.62, 0.4 + taper * 0.42, 0.86 + burst * 0.62);
        effect.emberShell.scale.set(0.9 + burst * 0.74, 0.32 + taper * 0.34, 0.9 + burst * 0.74);
        effect.plume.scale.set(1.05 - progress * 0.08, 0.62 + burst * 0.72, 1.05 - progress * 0.08);
        effect.plume.position.y = 0.25 + progress * 0.22;
        effect.bloom.position.y = 0.08 + progress * 0.08;
        effect.emberShell.position.y = 0.04 + progress * 0.05;
        effect.shockRing.scale.setScalar(0.68 + progress * 1.35);
        effect.shockRing.position.y = 0.1 + progress * 0.07;
        effect.shockRing.rotation.z = progress * 0.45;
        effect.sideFlareA.scale.set(1, 0.9 + burst * 0.52, 1);
        effect.sideFlareB.scale.set(1, 0.84 + burst * 0.44, 1);
        effect.sideFlareA.position.y = 0.18 + progress * 0.12;
        effect.sideFlareB.position.y = 0.16 + progress * 0.11;
        effect.object.scale.setScalar(1 + progress * 0.12);

        for (const [index, spark] of effect.sparks.entries()) {
          const offset = effect.sparkOffsets[index];
          const sparkGrowth = 1 + progress * (1.45 + index * 0.34);
          spark.scale.set(1, sparkGrowth, 1);
          spark.position.set(offset.x, offset.y + progress * (0.16 + index * 0.045), offset.z);
        }

        effect.core.material.opacity = 0.98 * taper;
        effect.bloom.material.opacity = 0.72 * taper;
        effect.emberShell.material.opacity = 0.62 * Math.max(0, 1 - progress * 0.9);
        effect.shockRing.material.opacity = 0.66 * Math.max(0, 1 - progress * 1.25);
        effect.sideFlareA.material.opacity = 0.74 * Math.max(0, 1 - progress * 1.15);
        effect.sideFlareB.material.opacity = 0.55 * Math.max(0, 1 - progress);
        effect.plume.material.opacity = 0.88 * Math.max(0, 1 - progress * 1.2);
        effect.sparks.forEach((spark, index) => {
          spark.material.opacity = Math.max(0, 0.95 - progress * (1.2 + index * 0.14));
        });
        effect.light.intensity = 2.4 * Math.max(0, 1 - progress * 1.28);
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
        {
          const shooterAvatar = event.shooterType === 'npc'
            ? null
            : this.getAvatarForSessionId(event.shooterId);
          shooterAvatar?.triggerShotFeedback?.();
          const { start, end } = this.getShotVisualPoints(event);
          if (event.weaponId === HELD_ITEM_IDS.pistol) {
            this.createMuzzleFlashEffect(shooterAvatar, start, end);
          }
          this.createTracerEffect(start, end);
        }
        break;
      case 'impact':
        {
          const { origin, point, delayMs } = this.getImpactEffectSpec(event);
          this.createImpactEffect(point, event.kind, delayMs);
          if (event.kind === 'player' && event.targetId) {
            const runFeedback = () => {
              const targetAvatar = this.getAvatarForSessionId(event.targetId);
              const damageDirection = point.clone().sub(origin);
              damageDirection.y = 0;
              if (damageDirection.lengthSq() <= 0.0001 && targetAvatar?.position) {
                damageDirection.subVectors(targetAvatar.position, origin);
                damageDirection.y = 0;
              }
              if (damageDirection.lengthSq() <= 0.0001) {
                damageDirection.set(0, 0, 1);
              } else {
                damageDirection.normalize();
              }

              targetAvatar?.triggerDamageFeedback?.({ direction: damageDirection });
              if (event.targetId === this.npcServiceState.sessionId) {
                this.triggerDamageCameraFeedback(damageDirection);
              }
            };

            if (delayMs > 0) {
              window.setTimeout(runFeedback, delayMs);
            } else {
              runFeedback();
            }
          } else if (event.kind === 'npc' && event.targetId) {
            const runFeedback = () => {
              const damageDirection = point.clone().sub(origin);
              damageDirection.y = 0;
              if (damageDirection.lengthSq() <= 0.0001) {
                damageDirection.set(0, 0, 1);
              } else {
                damageDirection.normalize();
              }
              this.worldBuilder?.triggerNpcDamageFeedback(event.targetId, { direction: damageDirection });
            };

            if (delayMs > 0) {
              window.setTimeout(runFeedback, delayMs);
            } else {
              runFeedback();
            }
          }
        }
        if ((event.kind === 'player' || event.kind === 'npc') && event.shooterId === this.npcServiceState.sessionId) {
          this.hitMarkerUntil = performance.now() + 120;
        }
        break;
      case 'pickup':
        if (event.playerId === this.npcServiceState.sessionId) {
          this.hud.showToast('Pistol equipped.');
        }
        break;
      case 'reload':
        {
          const avatar = this.getAvatarForSessionId(event.playerId);
          avatar?.setReloadState?.(true, {
            weaponId: event.weaponId,
            startedAtMs: Number(event.startedAt ?? 0),
            endsAtMs: Number(event.endsAt ?? 0)
          });
          if (event.weaponId === HELD_ITEM_IDS.pistol) {
            this.playSoundEffect(this.pistolCockSound);
          }
        }
        break;
      case 'death':
        if (event.victimType === 'npc') {
          this.worldBuilder?.triggerNpcDamageFeedback(event.victimId);
        } else if (event.victimId === this.npcServiceState.sessionId) {
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
    const zoomPercent = Math.round((1 / this.getCameraZoomLevel()) * 100);
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
    if (!this.firstFrameMarked) {
      this.firstFrameMarked = true;
      this.markBoot('boot:first-frame');
      this.measureBoot('timeToFirstFrame', 'boot:start', 'boot:first-frame');
      if (this.deferredStartupPromise) {
        queueMicrotask(() => this.reportBootMetrics());
      }
    }

    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
    const emoteMenuActive = this.updateEmoteMenu();
    const localPlayerState = this.getLocalPlayerState();

    if (this.input.consume('KeyO') && this.canUseAimPoseDebug()) {
      this.toggleAimPoseDebugPanel();
    }

    if (this.input.consume('Escape')) {
      if (this.hud.isQuickChatOpen()) {
        this.closeQuickChat();
      } else if (this.characterSelectorVisible) {
        this.setCharacterSelectorVisible(false);
      } else if (this.shaderDebugMenuVisible) {
        this.setShaderDebugMenuVisible(false);
      }
    }

    this.handleCameraZoomInput();
    this.updateNpcFocusTargets();

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
      this.suspendInlineShellForBuilder();
      this.worldBuilder.syncInteriorPlacementPreview();
      this.clearPendingHipFireShot();
      this.currentAimMode = false;
      this.player?.setAimingState(false);
      this.updateBuilderCamera();
      this.currentInteractable = null;
      this.hud.setPrompt(null);
    } else {
      const localAlive = localPlayerState?.alive !== false;
      const armed = Boolean(localAlive && localPlayerState?.equippedWeaponId);
      const canCursorAim = localAlive && !emoteMenuActive && !this.hud.isQuickChatOpen();
      const activeColliders = this.getActiveColliders();
      const groundHeight = this.getActiveGroundHeightAt(this.player.position);
      const activeSceneBounds = this.getActiveSceneBounds();
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
      const workoutActive = this.updateActiveWorkout(deltaSeconds, {
        localAlive,
        colliders: activeColliders,
        sceneBounds: activeSceneBounds,
        groundHeight
      });
      let aimingMode = false;

      if (workoutActive) {
        this.clearPendingHipFireShot();
        this.currentAimMode = false;
        const facing = this.player.object.rotation.y;
        this.currentAimDirection.set(Math.sin(facing), 0, Math.cos(facing)).normalize();
        this.syncInlineShellState();
        this.updateCamera(this.currentAimDirection, false);
        this.currentInteractable = null;
        this.hud.setPrompt(null);
      } else {
        this.player.update(
          deltaSeconds,
          playerInput,
          this.camera,
          activeColliders,
          activeSceneBounds,
          groundHeight
        );
        this.syncInlineShellState();
        const combatInputEnabled = localAlive && !emoteMenuActive && !this.hud.isQuickChatOpen();
        const primaryFirePressed = combatInputEnabled && this.input.consumePointer(0);
        const primaryFireHeld = combatInputEnabled && this.input.isPointerPressed(0);
        const secondaryAimHeld = combatInputEnabled && this.input.isPointerPressed(2);
        if (armed) {
          aimingMode = secondaryAimHeld;
          this.currentAimMode = aimingMode;
          this.player.setAimingState(aimingMode || hipFirePoseActive);
          if (aimingMode ? primaryFireHeld : primaryFirePressed) {
            if (aimingMode) {
              this.fireLocalWeapon(aimDirection, this.getShotCollisionOrigin(aimDirection));
            } else if (!hipFirePending || performance.now() >= hipFirePending.releaseAt) {
              this.queueHipFireShot(aimDirection);
            }
          }
          if (combatInputEnabled && this.input.consume('KeyR')) {
            this.npcService?.reloadWeapon();
          }
        } else {
          this.clearPendingHipFireShot();
          aimingMode = secondaryAimHeld;
          this.currentAimMode = aimingMode;
          this.player.setAimingState(aimingMode);
          if (primaryFirePressed) {
            this.punchLocal(aimDirection);
          }
        }
        if (!localAlive || emoteMenuActive || this.hud.isQuickChatOpen()) {
          this.clearPendingHipFireShot();
        } else if (this.pendingHipFireShot) {
          const now = performance.now();
          this.player.setAimingState(aimingMode || now < this.pendingHipFireShot.releaseAt);
          this.player.setAimRotation(Math.atan2(this.pendingHipFireShot.direction.x, this.pendingHipFireShot.direction.z));
          if (!this.pendingHipFireShot.fired && now >= this.pendingHipFireShot.fireAt) {
            this.pendingHipFireShot.fired = true;
            this.fireLocalWeapon(this.pendingHipFireShot.direction, this.pendingHipFireShot.origin);
          }
          if (now >= this.pendingHipFireShot.releaseAt) {
            this.clearPendingHipFireShot();
            this.player.setAimingState(aimingMode);
          }
        }
        this.updateCamera(this.currentAimDirection, this.currentAimMode && armed);
      }
      this.npcService?.setPlayerTransform(
        this.player.position,
        this.player.object.rotation.y,
        {
          ...this.player.getAnimationSyncState(),
          aiming: Boolean(this.currentAimMode || hipFirePoseActive)
        }
      );
      this.updateNpcInteractRadiusIndicators();

      if (workoutActive || localAlive === false || emoteMenuActive || this.hud.isQuickChatOpen()) {
        this.currentInteractable = null;
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
    if (this.aimPoseDebugVisible) {
      this.refreshAimPoseDebugHud();
    }
    this.refreshAdminPositionHud();
    this.characterPreviewRenderer?.update(deltaSeconds);
    if (this.vibeShaderPass?.uniforms?.uTime) {
      this.vibeShaderPass.uniforms.uTime.value = performance.now() * 0.001;
    }

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.processDeferredSceneWork();
    this.input.endFrame();
  }

  updateCamera(aimDirection = this.currentAimDirection, isAiming = false, { snap = false } = {}) {
    const zoomLevel = this.getCameraZoomLevel();
    const cameraOffset = (isAiming ? AIM_CAMERA_OFFSET : CAMERA_OFFSET).clone().multiplyScalar(zoomLevel);
    const targetPosition = this.player.position.clone().add(cameraOffset);
    const lookTarget = this.player.position.clone().add(CAMERA_LOOK_OFFSET);
    const now = performance.now();

    if (now < this.damageCameraKickEndsAt) {
      const lifetime = Math.max(1, this.damageCameraKickEndsAt - this.damageCameraKickStartedAt);
      const progress = THREE.MathUtils.clamp((now - this.damageCameraKickStartedAt) / lifetime, 0, 1);
      const envelope = Math.pow(1 - progress, 1.35);
      const wave = Math.sin(progress * Math.PI * 3.2);
      const side = new THREE.Vector3(-this.damageCameraDirection.z, 0, this.damageCameraDirection.x);
      targetPosition.addScaledVector(this.damageCameraDirection, envelope * 0.72);
      targetPosition.addScaledVector(side, wave * envelope * 0.26);
      targetPosition.y += Math.sin(progress * Math.PI) * envelope * 0.38;
      lookTarget.addScaledVector(this.damageCameraDirection, envelope * 0.16);
      lookTarget.addScaledVector(side, wave * envelope * -0.14);
      lookTarget.y += envelope * 0.12;
    }

    if (snap) {
      this.camera.position.copy(targetPosition);
    } else {
      this.camera.position.lerp(targetPosition, isAiming ? 0.14 : 0.08);
    }
    this.camera.lookAt(lookTarget);
  }

  triggerDamageCameraFeedback(direction = null) {
    this.damageCameraKickStartedAt = performance.now();
    this.damageCameraKickEndsAt = this.damageCameraKickStartedAt + DAMAGE_CAMERA_KICK_MS;
    if (direction && Number.isFinite(direction.x) && Number.isFinite(direction.z)) {
      this.damageCameraDirection.set(direction.x, 0, direction.z);
    } else {
      this.damageCameraDirection.set(this.currentAimDirection.x, 0, this.currentAimDirection.z);
    }

    if (this.damageCameraDirection.lengthSq() <= 0.0001) {
      this.damageCameraDirection.set(0, 0, 1);
    } else {
      this.damageCameraDirection.normalize();
    }
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
    this.syncDeliveryQuestReminderGate();

    const interactables = this.getActiveInteractables();
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
    const deliveryInteraction = this.getDeliveryQuestInteractionForNpc();
    this.hud.setPrompt(deliveryInteraction?.action ? null : nearest);

    const interactPressed = this.input.consume('KeyE');
    if (deliveryInteraction?.action && interactPressed) {
      void this.handleDeliveryQuestInteraction(deliveryInteraction);
      return;
    }

    if (!nearest || !interactPressed) {
      return;
    }

    if (nearest.kind === 'pickup') {
      this.npcService?.pickupWeapon(nearest.pickupId);
      return;
    }

    if (nearest.kind === 'interior-exit') {
      this.exitInterior();
      return;
    }

    if (nearest.kind === 'world' && nearest.interior?.id) {
      this.enterInterior(nearest);
      return;
    }

    if (nearest.kind === 'snatch-workout') {
      void this.startWorkout(nearest);
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
    if (this.isRentIntroReservedNpc(npcId)) {
      return;
    }

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

  addRentIntroSpeechBubble(bubbles, npcSpeechAnchors) {
    const intro = this.activeRentIntro;
    if (!intro?.npcId) {
      return;
    }

    const anchor = npcSpeechAnchors.get(intro.npcId);
    if (!anchor) {
      return;
    }

    const projected = this.projectSpeechAnchor(anchor);
    if (!projected) {
      return;
    }

    const text = this.getRentIntroSpeechText();
    if (!text) {
      return;
    }

    const npcState = this.npcServiceState.npcs.get(intro.npcId);
    bubbles.push({
      id: `npc-rent-intro:${intro.seq}`,
      text,
      label: npcState?.name ?? '',
      variant: 'npc',
      status: 'done',
      visible: true,
      screenX: projected.x,
      screenY: projected.y
    });
  }

  addNpcInteractionHintBubble(bubbles, npcSpeechAnchors) {
    const interactable = this.getNearestNpcInteractable();
    const npcId = interactable?.kind === 'npc'
      ? (interactable.npcId || interactable.placementId || '')
      : '';
    if (
      !npcId
      || this.worldBuilder?.enabled
      || this.hud.isQuickChatOpen()
      || this.isRentIntroReservedNpc(npcId)
    ) {
      return;
    }

    const npcState = this.npcServiceState.npcs.get(npcId);
    const deliveryInteraction = this.getDeliveryQuestInteractionForNpc(interactable);
    if (!deliveryInteraction && npcState?.busy) {
      return;
    }

    const hasVisibleNpcSpeech = Boolean(
      npcState
      && (npcState.chatText || npcState.chatStatus === 'thinking')
      && npcState.chatStartedAt
      && (Date.now() - npcState.chatStartedAt) <= getChatBubbleLifetimeMs(npcState.chatText)
    );
    if (
      hasVisibleNpcSpeech
      && deliveryInteraction?.kind !== 'completeDelivery'
      && deliveryInteraction?.kind !== 'deliveryReminder'
    ) {
      return;
    }

    const anchor = npcSpeechAnchors.get(npcId);
    if (!anchor) {
      return;
    }

    const projected = this.projectSpeechAnchor(anchor);
    if (!projected) {
      return;
    }

    if (deliveryInteraction) {
      bubbles.push({
        id: `npc-delivery:${npcId}:${deliveryInteraction.kind}`,
        text: deliveryInteraction.overheadText,
        label: deliveryInteraction.label ?? '',
        variant: deliveryInteraction.variant ?? 'interaction',
        status: 'done',
        visible: true,
        screenX: projected.x,
        screenY: projected.y
      });
      return;
    }

    bubbles.push({
      id: `npc-interaction:${npcId}`,
      text: 'Enter to chat',
      label: '',
      variant: 'interaction',
      status: 'done',
      visible: true,
      screenX: projected.x,
      screenY: projected.y
    });
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
    if (!this.player || !this.worldBuilder || this.currentInterior?.scene) {
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

    this.addRentIntroSpeechBubble(bubbles, npcSpeechAnchors);
    this.addNpcInteractionHintBubble(bubbles, npcSpeechAnchors);
    this.addMoneyFloaterBubbles(bubbles);
    this.hud.setSpeechBubbles(bubbles);
  }
}
