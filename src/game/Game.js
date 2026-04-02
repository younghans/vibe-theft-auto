import * as THREE from 'three';
import { Input } from './Input.js';
import { Hud } from '../ui/Hud.js';
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

const CAMERA_OFFSET = new THREE.Vector3(0, 26, 18);
const CAMERA_LOOK_OFFSET = new THREE.Vector3(0, 3, 0);
const EMOTE_MENU_DEADZONE = 54;
const CHAT_BUBBLE_LIFETIME_MS = 5000;
const ZERO_INPUT = { getMovementVector: () => ({ x: 0, z: 0 }) };

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

    this.root.append(this.renderer.domElement);

    this.hud = new Hud(this.root);
    this.input = new Input();
    this.library = new ModelLibrary();
    this.remotePlayers = new Map();
    this.pendingRemotePlayers = new Set();
    this.currentInteractable = null;
    this.currentLayout = null;
    this.lastNpcTransportSignature = '';
    this.pendingWorldPatches = [];
    this.worldLayoutReady = false;
    this.worldPatchUnsubscribe = null;
    this.npcService = null;
    this.npcServiceState = {
      transport: 'mock',
      connected: true,
      sessionId: 'local-player',
      players: new Map(),
      builders: new Map(),
      npcs: new Map()
    };
    this.emoteMenuOpen = false;
    this.projectedSpeechPosition = new THREE.Vector3();

    this.hud.bindInteractionEvents({
      onAction: () => {},
      onCloseInteraction: () => this.hud.hideInteractionMenu()
    });
    this.hud.bindQuickChatEvents({
      onSubmit: (message) => void this.handleQuickChatSubmit(message),
      onCancel: () => this.closeQuickChat()
    });

    window.addEventListener('resize', () => this.onResize());
  }

  toggleBuildMode() {
    if (!this.worldBuilder) {
      return;
    }

    const nextEnabled = !this.worldBuilder.enabled;
    if (nextEnabled) {
      this.closeQuickChat();
    }
    void this.worldBuilder.setEnabled(nextEnabled);
    this.hud.showToast(nextEnabled ? 'World builder enabled.' : 'World builder disabled.');
  }

  async start() {
    try {
      this.setupLights();
      this.setupAtmosphere();

      const cityState = await buildCity(this.scene);
      this.baseCollisionBoxes = cityState.collisionBoxes;
      this.staticInteractables = cityState.interactables;
      this.cityBounds = cityState.cityBounds;
      this.npcService = await createNpcService();
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

      this.npcService.subscribe((state) => {
        this.npcServiceState = state;
        this.reportNpcTransportState();
        this.applyNpcRuntimeState();
        this.worldBuilder?.setRemoteBuilders(state.builders, state.sessionId);
        void this.syncRemotePlayers();
      });

      const sharedLayout = await this.npcService.getWorldLayout();
      this.currentLayout = sharedLayout;
      await this.worldBuilder.loadLayout(sharedLayout);
      this.worldLayoutReady = true;
      for (const patch of this.pendingWorldPatches.splice(0)) {
        await this.handleWorldPatch(patch);
      }

      this.player = await createPlayer(this.library);
      this.player.position.copy(cityState.spawnPoint);
      this.scene.add(this.player.object);

      if (this.npcServiceState.transport === 'colyseus') {
        this.hud.showToast('Connected to the multiplayer room. Shared building, world chat, NPC replies, and player presence are live.');
      } else {
        this.hud.showToast('Running local mock multiplayer. World chat and NPC replies work locally without Colyseus.');
      }

      this.hud.hideLoading();
      this.renderer.setAnimationLoop(() => this.frame());
    } catch (error) {
      console.error(error);
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
    this.renderer.setSize(window.innerWidth, window.innerHeight);
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

  frame() {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
    const emoteMenuActive = this.updateEmoteMenu();

    if (this.input.consume('Escape') && this.hud.isQuickChatOpen()) {
      this.closeQuickChat();
    }

    if (this.input.consume('Enter') && !this.worldBuilder.enabled && !emoteMenuActive && !this.hud.isQuickChatOpen()) {
      this.openQuickChat();
    }

    this.worldBuilder.update(deltaSeconds, this.input);

    if (this.worldBuilder.enabled) {
      this.updateBuilderCamera();
      this.hud.setPrompt(null);
    } else {
      const activeCollisionBoxes = [
        ...this.baseCollisionBoxes,
        ...this.worldBuilder.getCollisionBoxes()
      ];
      const groundHeight = this.worldBuilder.getGroundHeightAt(this.player.position);
      const playerInput = (emoteMenuActive || this.hud.isQuickChatOpen()) ? ZERO_INPUT : this.input;
      this.player.update(deltaSeconds, playerInput, this.camera, activeCollisionBoxes, this.cityBounds, groundHeight);
      this.updateCamera();
      this.npcService?.setPlayerTransform(
        this.player.position,
        this.player.object.rotation.y,
        this.player.getAnimationSyncState()
      );
      this.updateNpcInteractRadiusIndicators();

      if (emoteMenuActive || this.hud.isQuickChatOpen()) {
        this.hud.setPrompt(null);
      } else {
        this.updateInteraction();
      }
    }

    this.updateRemotePlayers(deltaSeconds);
    this.updateSpeechBubbles();
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  updateCamera() {
    const targetPosition = this.player.position.clone().add(CAMERA_OFFSET);
    this.camera.position.lerp(targetPosition, 0.08);
    this.camera.lookAt(this.player.position.clone().add(CAMERA_LOOK_OFFSET));
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
      ...this.worldBuilder.getInteractables()
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

    if (!isBusy && (Date.now() - startedAt) > CHAT_BUBBLE_LIFETIME_MS) {
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
