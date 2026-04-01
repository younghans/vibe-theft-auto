import * as THREE from 'three';
import { Input } from './Input.js';
import { Hud } from '../ui/Hud.js';
import { ModelLibrary } from '../world/ModelLibrary.js';
import { buildCity } from '../world/buildCity.js';
import { WorldBuilder } from '../world/WorldBuilder.js';
import { createPlayer } from '../player/createPlayer.js';
import { EMOTE_SLOTS } from '../player/emotes.js';
import { createNpcService } from '../npc/createNpcService.js';

const CAMERA_OFFSET = new THREE.Vector3(0, 26, 18);
const CAMERA_LOOK_OFFSET = new THREE.Vector3(0, 3, 0);
const EMOTE_MENU_DEADZONE = 54;
const ZERO_INPUT = { getMovementVector: () => ({ x: 0, z: 0 }) };

export class Game {
  constructor(root) {
    this.root = root;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7da6c8);
    this.scene.fog = new THREE.Fog(0x7da6c8, 70, 170);

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
    this.currentInteractable = null;
    this.currentLayout = null;
    this.currentNpcInteraction = null;
    this.activeChatNpcId = null;
    this.npcSyncTimeout = 0;
    this.lastNpcTransportSignature = '';
    this.npcService = null;
    this.npcServiceState = {
      transport: 'mock',
      connected: true,
      sessionId: 'local-player',
      npcs: new Map(),
      transcripts: new Map()
    };
    this.emoteMenuOpen = false;

    this.hud.bindInteractionEvents({
      onAction: (actionId) => void this.handleInteractionAction(actionId),
      onCloseInteraction: () => this.closeNpcInteraction(),
      onSendChat: (message) => void this.handleChatSubmit(message),
      onCloseChat: () => void this.closeNpcChat()
    });

    window.addEventListener('resize', () => this.onResize());
  }

  toggleBuildMode() {
    if (!this.worldBuilder) {
      return;
    }

    const nextEnabled = !this.worldBuilder.enabled;
    if (nextEnabled) {
      void this.closeNpcChat();
      this.closeNpcInteraction();
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
      this.currentLayout = cityState.layout;

      this.worldBuilder = new WorldBuilder({
        scene: this.scene,
        camera: this.camera,
        domElement: this.renderer.domElement,
        library: this.library,
        hud: this.hud,
        onToggleBuildMode: () => this.toggleBuildMode(),
        onLayoutChanged: (layout) => {
          this.currentLayout = layout;
          this.scheduleNpcDefinitionSync(layout);
        }
      });
      await this.worldBuilder.loadLayout(cityState.layout);

      this.player = await createPlayer(this.library);
      this.player.position.copy(cityState.spawnPoint);
      this.scene.add(this.player.object);

      this.npcService = await createNpcService();
      this.npcService.subscribe((state) => {
        this.npcServiceState = state;
        this.reportNpcTransportState();
        this.applyNpcRuntimeState();
        this.refreshNpcUi();
      });
      await this.syncNpcDefinitions(cityState.layout);

      if (this.npcServiceState.transport === 'colyseus') {
        this.hud.showToast('Connected to local NPC room. Public NPC chat is live.');
      } else {
        this.hud.showToast('Running NPC chat locally. Start Colyseus to test shared public conversations.');
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
    sun.shadow.camera.left = -90;
    sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90;
    sun.shadow.camera.bottom = -90;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 180;
    this.scene.add(sun);
  }

  setupAtmosphere() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(220, 32, 32),
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

  async syncNpcDefinitions(layout = this.currentLayout) {
    if (!this.npcService || !layout?.npcs) {
      return;
    }

    try {
      await this.npcService.syncDefinitions(layout.npcs);
    } catch (error) {
      console.error(error);
      this.hud.showToast('Could not sync NPC definitions to the local room.');
    }
  }

  scheduleNpcDefinitionSync(layout = this.currentLayout) {
    window.clearTimeout(this.npcSyncTimeout);
    this.npcSyncTimeout = window.setTimeout(() => {
      void this.syncNpcDefinitions(layout);
    }, 180);
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

    if (holdingEmoteKey && !this.worldBuilder.enabled && !this.isNpcUiOpen()) {
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

    if (this.input.consume('Escape')) {
      if (this.activeChatNpcId) {
        void this.closeNpcChat();
      } else if (this.currentNpcInteraction) {
        this.closeNpcInteraction();
      }
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
      const playerInput = (emoteMenuActive || this.isNpcUiOpen()) ? ZERO_INPUT : this.input;
      this.player.update(deltaSeconds, playerInput, this.camera, activeCollisionBoxes, this.cityBounds, groundHeight);
      this.updateCamera();
      this.npcService?.setPlayerTransform(this.player.position);

      if (emoteMenuActive || this.isNpcUiOpen()) {
        this.hud.setPrompt(null);
      } else {
        this.updateInteraction();
      }
    }

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

  isNpcUiOpen() {
    return Boolean(this.currentNpcInteraction || this.activeChatNpcId);
  }

  updateInteraction() {
    const interactables = [
      ...(this.staticInteractables ?? []),
      ...this.worldBuilder.getInteractables()
    ];
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

    if (nearest.kind === 'npc') {
      this.openNpcInteraction(nearest);
      return;
    }

    this.hud.showToast(nearest.actionText);
  }

  openNpcInteraction(interactable) {
    this.currentNpcInteraction = interactable;
    this.refreshNpcUi();
  }

  closeNpcInteraction() {
    this.currentNpcInteraction = null;
    this.hud.hideInteractionMenu();
  }

  async handleInteractionAction(actionId) {
    if (actionId === 'close') {
      this.closeNpcInteraction();
      return;
    }

    if (actionId !== 'chat' || !this.currentNpcInteraction) {
      return;
    }

    const result = await this.npcService.beginInteract(this.currentNpcInteraction.npcId);
    if (!result.ok) {
      this.hud.showToast(result.error);
      return;
    }

    this.activeChatNpcId = this.currentNpcInteraction.npcId;
    this.closeNpcInteraction();
    this.refreshNpcUi();
    this.hud.focusChatInput();
  }

  async handleChatSubmit(message) {
    const trimmed = message.trim();
    if (!trimmed || !this.activeChatNpcId) {
      return;
    }

    const result = await this.npcService.sendChat(this.activeChatNpcId, trimmed);
    if (!result.ok) {
      this.hud.showToast(result.error);
      this.refreshNpcUi(result.error);
      return;
    }

    this.hud.clearChatInput();
    this.refreshNpcUi();
  }

  async closeNpcChat() {
    if (!this.activeChatNpcId) {
      this.hud.setChatState({ visible: false });
      return;
    }

    const npcId = this.activeChatNpcId;
    this.activeChatNpcId = null;
    this.hud.setChatState({ visible: false });
    await this.npcService.endInteract(npcId);
  }

  refreshNpcUi(error = '') {
    if (this.currentNpcInteraction) {
      const npcState = this.npcServiceState.npcs.get(this.currentNpcInteraction.npcId) ?? this.currentNpcInteraction.npc;
      const occupiedByOther = npcState.currentSpeakerSessionId && npcState.currentSpeakerSessionId !== this.npcServiceState.sessionId;
      this.hud.showInteractionMenu({
        title: npcState.name,
        subtitle: occupiedByOther
          ? `${npcState.name} is already in a public conversation.`
          : `Public ${this.npcServiceState.transport === 'colyseus' ? 'room' : 'local'} chat. Everyone in the room sees the transcript.`,
        actions: [
          {
            id: 'chat',
            label: occupiedByOther ? 'Occupied' : 'Chat',
            primary: true,
            disabled: Boolean(occupiedByOther)
          },
          {
            id: 'close',
            label: 'Close',
            primary: false,
            disabled: false
          }
        ]
      });
    } else {
      this.hud.hideInteractionMenu();
    }

    if (!this.activeChatNpcId) {
      this.hud.setChatState({ visible: false });
      return;
    }

    const npc = this.npcServiceState.npcs.get(this.activeChatNpcId);
    if (!npc) {
      this.activeChatNpcId = null;
      this.hud.setChatState({ visible: false });
      return;
    }

    const transcript = this.npcServiceState.transcripts.get(this.activeChatNpcId) ?? [];
    const occupiedByOther = npc.currentSpeakerSessionId && npc.currentSpeakerSessionId !== this.npcServiceState.sessionId;
    this.hud.setChatState({
      visible: true,
      title: npc.name,
      subtitle: `Model: ${npc.modelId} | ${this.npcServiceState.transport === 'colyseus' ? 'Shared room' : 'Local mock'} conversation`,
      entries: transcript,
      busy: npc.busy,
      error,
      canSend: !occupiedByOther
    });
  }
}
