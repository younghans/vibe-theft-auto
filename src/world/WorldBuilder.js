import * as THREE from 'three';
import { getNpcModelById, getNpcModelByItemId, NPC_MODEL_CATALOG } from '../npc/npcCatalog.js';
import { prepareNpcRenderObject } from '../npc/npcRenderUtils.js';
import {
  createDefaultNpcCombat,
  createDefaultNpcRoutine,
  createDefaultNpcRoutineStep,
  NPC_DEFAULT_INTERACT_RADIUS,
  listNpcCombatArchetypes,
  listNpcStepTypes
} from '../npc/npcBehavior.js';
import { collectNpcTargetOptions, resolveNpcTargetOption } from '../npc/npcTargeting.js';
import { getTileCenterWorldPosition, getTileFootprintWorldSize } from '../shared/tileFootprint.js';
import { WEAPON_IDS } from '../shared/combatConstants.js';
import {
  WORLD_GRID_DIVISIONS,
  WORLD_GRID_SIZE
} from '../shared/worldConstants.js';
import { BuilderPreviewRenderer } from '../ui/BuilderPreviewRenderer.js';
import { BUILDER_CATEGORIES, BUILDER_TILE_SIZE, getBuilderItem, getBuilderItemById } from './builderCatalog.js';
import { createWorldEditAdapter } from './createWorldEditAdapter.js';
import { instantiateItemVisual, prepareItemVisual } from './itemVisuals.js';
import { RemoteBuilderRenderer } from './RemoteBuilderRenderer.js';
import { WorldRenderer } from './WorldRenderer.js';
import { WorldState } from './WorldState.js';

const EDITOR_CAMERA_OFFSET = new THREE.Vector3(0, 88, 44);
const EDITOR_PAN_SPEED = 28;
const EDITOR_ZOOM_MIN = 0.6;
const EDITOR_ZOOM_MAX = 1.5;
const PREVIEW_COLOR = new THREE.Color(0xf2c871);
const PREVIEW_RENDER_ORDER = 10;
const NPC_TARGET_PICK_VALID_COLOR = 0x6cff95;
const NPC_TARGET_PICK_INVALID_COLOR = 0xff6b6b;
const NPC_TARGET_PICK_UNSUPPORTED_COLOR = 0xffd166;

function clonePreviewMaterial(material, opacity = 0.86) {
  const next = material.clone();
  next.transparent = true;
  next.opacity = opacity;
  next.depthWrite = false;
  next.depthTest = false;

  if ('emissive' in next) {
    next.emissive = next.emissive.clone().lerp(PREVIEW_COLOR, 0.75);
    next.emissiveIntensity = 1;
  } else if ('color' in next) {
    next.color = next.color.clone().lerp(PREVIEW_COLOR, 0.38);
  }

  return next;
}

function applyPreviewMaterial(root, opacity) {
  root.traverse((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const clonedMaterials = materials.map((material) => clonePreviewMaterial(material, opacity));
    node.material = Array.isArray(node.material) ? clonedMaterials : clonedMaterials[0];
    node.renderOrder = PREVIEW_RENDER_ORDER;
  });
}

async function createPreviewObject(library, item) {
  const npcModel = item.layer === 'npc'
    ? getNpcModelByItemId(item.id)
    : null;

  if (npcModel) {
    const root = await library.instantiate(item.asset);
    prepareNpcRenderObject(root, npcModel, { enableShadows: false });
    return root;
  }

  const visual = await instantiateItemVisual(library, item);
  prepareItemVisual(visual);
  return visual.root;
}

function snapToCell(worldPosition) {
  return {
    x: Math.round(worldPosition.x / BUILDER_TILE_SIZE),
    z: Math.round(worldPosition.z / BUILDER_TILE_SIZE)
  };
}

function screenClamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return (min + max) * 0.5;
  }
  return Math.min(max, Math.max(min, value));
}

function toRotationY(rotationQuarterTurns) {
  return rotationQuarterTurns * (Math.PI / 2);
}

function toGroundProbe(x, z) {
  return new THREE.Vector3(x, 0, z);
}

function titleCaseLabel(value = '') {
  return String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function mergeNestedDraft(current, updates) {
  return {
    ...(current ?? {}),
    ...(updates ?? {})
  };
}

function collectBuilderGroups(items) {
  const groups = [];
  const groupMap = new Map();

  for (const item of items) {
    const id = item.groupId ?? 'misc';
    if (!groupMap.has(id)) {
      const group = {
        id,
        label: item.groupLabel ?? 'Misc',
        count: 0
      };
      groupMap.set(id, group);
      groups.push(group);
    }

    groupMap.get(id).count += 1;
  }

  return groups;
}

function groupVisibleEntries(entries) {
  const sections = [];
  const sectionMap = new Map();

  for (const entry of entries) {
    const id = entry.item.groupId ?? 'misc';
    if (!sectionMap.has(id)) {
      const section = {
        id,
        label: entry.item.groupLabel ?? 'Misc',
        cards: []
      };
      sectionMap.set(id, section);
      sections.push(section);
    }

    sectionMap.get(id).cards.push({
      id: entry.item.id,
      label: entry.item.label,
      previewId: entry.item.id,
      previewMode: entry.item.previewMode ?? 'render',
      previewImageSrc: entry.item.previewImageSrc ?? '',
      sourceIndex: entry.index,
      selected: false,
      shortcut: entry.visibleIndex < 9 ? entry.visibleIndex + 1 : null
    });
  }

  return sections.map((section) => ({
    ...section,
    count: section.cards.length
  }));
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function createDefaultEditorState() {
  return {
    enabled: false,
    focus: new THREE.Vector3(0, 0, 0),
    zoom: 1,
    pointer: new THREE.Vector2(2, 2),
    activeCategoryId: BUILDER_CATEGORIES[0].id,
    activeGroupIdByCategory: Object.fromEntries(BUILDER_CATEGORIES.map((category) => [category.id, 'all'])),
    activeItemIndex: 0,
    rotationQuarterTurns: 0,
    hover: {
      point: null,
      cell: null,
      placementId: null
    },
    selection: {
      placementId: null
    },
    preview: {
      key: null,
      loadingKey: null,
      object: null
    }
  };
}

export class WorldBuilder {
  constructor({ scene, camera, domElement, library, hud, onToggleBuildMode, onLayoutChanged, worldTransport }) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.library = library;
    this.hud = hud;
    this.onToggleBuildMode = onToggleBuildMode ?? (() => {});
    this.onLayoutChanged = onLayoutChanged ?? (() => {});
    this.worldTransport = worldTransport ?? null;
    this.canEdit = false;
    this.visible = true;

    this.state = createDefaultEditorState();
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.previewLoadToken = 0;
    this.builderPreviewCategoryId = null;
    this.builderPreviewGroupId = null;
    this.builderPreviewGeneration = 0;
    this.pendingNpcUpdateByPlacementId = new Map();
    this.pendingNpcUpdateTimeouts = new Map();
    this.pendingBuildingUpdateByPlacementId = new Map();
    this.pendingBuildingUpdateTimeouts = new Map();
    this.npcTargetPickState = null;
    this.activeMovePlacementId = null;
    this.awaitingMovedPlacementIds = new Set();
    this.builderInteriorPreviewPlacementIds = new Set();
    this.activeNpcEditorPlacementId = null;
    this.activeBuildingEditorPlacementId = null;
    this.worldState = new WorldState();
    this.npcDebugState = new Map();
    this.worldRenderer = new WorldRenderer({ scene, camera, library });
    this.worldEditAdapter = createWorldEditAdapter({
      transport: this.worldTransport,
      worldState: this.worldState,
      worldRenderer: this.worldRenderer
    });
    this.remoteBuilderRenderer = new RemoteBuilderRenderer({ scene, library, worldRenderer: this.worldRenderer });
    this.builderPreviewRenderer = null;
    this.builderPreviewRendererPromise = null;

    this.previewRoot = new THREE.Group();
    this.previewRoot.visible = false;
    this.gridHelper = new THREE.GridHelper(WORLD_GRID_SIZE, WORLD_GRID_DIVISIONS, 0xf2c871, 0x406070);
    this.gridHelper.position.y = 0.06;
    this.gridHelper.visible = false;

    this.previewFootprint = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xf2c871,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false
      })
    );
    this.previewFootprint.rotation.x = -Math.PI / 2;
    this.previewFootprint.position.y = 0.04;
    this.previewFootprint.renderOrder = PREVIEW_RENDER_ORDER - 1;
    this.previewRoot.add(this.previewFootprint);

    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.9, 36),
      new THREE.MeshBasicMaterial({
        color: 0xf2c871,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      })
    );
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.08;
    this.selectionRing.visible = false;

    this.npcTargetPickMarkerRingMaterial = new THREE.MeshBasicMaterial({
      color: NPC_TARGET_PICK_VALID_COLOR,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false
    });
    this.npcTargetPickMarkerCoreMaterial = new THREE.MeshBasicMaterial({
      color: NPC_TARGET_PICK_VALID_COLOR,
      transparent: true,
      opacity: 0.98,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false
    });
    this.npcTargetPickMarker = new THREE.Group();
    this.npcTargetPickMarker.visible = false;

    const npcTargetPickRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.18, 36),
      this.npcTargetPickMarkerRingMaterial
    );
    npcTargetPickRing.rotation.x = -Math.PI / 2;
    npcTargetPickRing.position.y = 0.045;
    npcTargetPickRing.renderOrder = PREVIEW_RENDER_ORDER + 5;
    this.npcTargetPickMarker.add(npcTargetPickRing);

    const npcTargetPickDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 20),
      this.npcTargetPickMarkerCoreMaterial
    );
    npcTargetPickDot.rotation.x = -Math.PI / 2;
    npcTargetPickDot.position.y = 0.05;
    npcTargetPickDot.renderOrder = PREVIEW_RENDER_ORDER + 6;
    this.npcTargetPickMarker.add(npcTargetPickDot);

    const npcTargetPickCrossVertical = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.84),
      this.npcTargetPickMarkerRingMaterial
    );
    npcTargetPickCrossVertical.rotation.x = -Math.PI / 2;
    npcTargetPickCrossVertical.position.y = 0.048;
    npcTargetPickCrossVertical.renderOrder = PREVIEW_RENDER_ORDER + 6;
    this.npcTargetPickMarker.add(npcTargetPickCrossVertical);

    const npcTargetPickCrossHorizontal = new THREE.Mesh(
      new THREE.PlaneGeometry(0.84, 0.12),
      this.npcTargetPickMarkerRingMaterial
    );
    npcTargetPickCrossHorizontal.rotation.x = -Math.PI / 2;
    npcTargetPickCrossHorizontal.position.y = 0.048;
    npcTargetPickCrossHorizontal.renderOrder = PREVIEW_RENDER_ORDER + 6;
    this.npcTargetPickMarker.add(npcTargetPickCrossHorizontal);

    this.scene.add(this.gridHelper);
    this.scene.add(this.previewRoot);
    this.scene.add(this.selectionRing);
    this.scene.add(this.npcTargetPickMarker);

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.onWheel = this.onWheel.bind(this);

    this.domElement.addEventListener('pointermove', this.onPointerMove);
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });

    this.hud.bindBuilderEvents({
      onToggleBuildMode: () => this.onToggleBuildMode(),
      onSelectCategory: (categoryId) => this.selectCategory(categoryId),
      onSelectGroup: (groupId) => this.selectGroup(groupId),
      onSelectTile: (index) => this.selectItem(index),
      onRotateSelection: () => this.rotateSelectedPlacement(),
      onMoveSelection: () => this.startMovingSelectedPlacement(),
      onDeleteSelection: () => this.deleteSelectedPlacement(),
      onConfirmSelection: () => this.clearSelection(),
      onNpcNameChange: (value) => void this.updateSelectedNpc({ name: value }),
      onNpcPromptChange: (value) => void this.updateSelectedNpc({ prompt: value }),
      onNpcRadiusChange: (value) => void this.updateSelectedNpc({
        interactRadius: Number.isFinite(value) ? THREE.MathUtils.clamp(value, 1.5, 12) : undefined
      }),
      onNpcSpeedChange: (value) => void this.updateSelectedNpc({ speed: value }),
      onNpcRespawnDelayChange: (value) => void this.updateSelectedNpc({
        respawnDelayMs: Number.isFinite(value) ? THREE.MathUtils.clamp(Math.round(value), 0, 600000) : undefined
      }),
      onNpcDeliveryQuestChange: (enabled) => void this.updateSelectedNpc({
        deliveryQuestEnabled: enabled === true
      }),
      onNpcModelChange: (modelId) => void this.changeSelectedNpcModel(modelId),
      onNpcRoutineAddStep: (stepType) => void this.addSelectedNpcRoutineStep(stepType),
      onNpcRoutineRemoveStep: (stepIndex) => void this.removeSelectedNpcRoutineStep(stepIndex),
      onNpcRoutineStepChange: (stepIndex, field, value) => void this.updateSelectedNpcRoutineStep(stepIndex, field, value),
      onNpcRoutinePickTarget: (stepIndex, mode) => this.setNpcRoutineTargetPickMode(stepIndex, mode),
      onNpcCombatChange: (field, value) => void this.updateSelectedNpcCombat(field, value),
      onCloseNpcEditor: () => this.closeNpcInstanceEditor(),
      onCloseBuildingEditor: () => this.closeBuildingInstanceEditor(),
      onBuildingLabelChange: (value) => void this.updateSelectedBuildingInstance({ label: value }),
      onBuildingPromptChange: (value) => void this.updateSelectedBuildingInstance({ prompt: value }),
      onBuildingActionTextChange: (value) => void this.updateSelectedBuildingInstance({ actionText: value }),
      onBuildingRadiusChange: (value) => void this.updateSelectedBuildingInstance({
        radius: Number.isFinite(value) ? THREE.MathUtils.clamp(value, 1.5, 12) : undefined
      }),
      onBuildingDistanceChange: (value) => void this.updateSelectedBuildingInstance({
        distance: Number.isFinite(value) ? THREE.MathUtils.clamp(value, 1, BUILDER_TILE_SIZE * 2) : undefined
      })
    });
    this.updateBuilderHud();
    this.hud.setBuilderSelection(null);
    this.hud.setBuilderNpcEditor(null);
    this.hud.setBuilderBuildingEditor(null);
  }

  get enabled() {
    return this.state.enabled;
  }

  get activeCategory() {
    return BUILDER_CATEGORIES.find((entry) => entry.id === this.state.activeCategoryId) ?? BUILDER_CATEGORIES[0];
  }

  get activeItem() {
    return getBuilderItem(this.state.activeCategoryId, this.state.activeItemIndex);
  }

  get canEditHoveredTiles() {
    return this.state.activeCategoryId === 'tiles';
  }

  get activeGroupId() {
    return this.state.activeGroupIdByCategory[this.state.activeCategoryId] ?? 'all';
  }

  getVisibleCategoryEntries(categoryId = this.state.activeCategoryId) {
    const category = BUILDER_CATEGORIES.find((entry) => entry.id === categoryId) ?? BUILDER_CATEGORIES[0];
    const activeGroupId = this.state.activeGroupIdByCategory[category.id] ?? 'all';
    const entries = category.items.map((item, index) => ({ item, index }));

    if (activeGroupId === 'all') {
      return entries;
    }

    return entries.filter(({ item }) => item.groupId === activeGroupId);
  }

  getBuilderViewModel() {
    const activeCategory = this.activeCategory;
    const visibleEntries = this.getVisibleCategoryEntries()
      .map((entry, visibleIndex) => ({ ...entry, visibleIndex }));
    const tabs = BUILDER_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      count: category.items.length,
      active: category.id === this.state.activeCategoryId
    }));
    const groupTabs = [
      {
        id: 'all',
        label: 'All',
        count: activeCategory.items.length,
        active: this.activeGroupId === 'all'
      },
      ...collectBuilderGroups(activeCategory.items).map((group) => ({
        ...group,
        active: group.id === this.activeGroupId
      }))
    ];
    const sections = groupVisibleEntries(visibleEntries).map((section) => ({
      ...section,
      cards: section.cards.map((card) => ({
        ...card,
        selected: card.sourceIndex === this.state.activeItemIndex
      }))
    }));

    return {
      available: this.canEdit,
      enabled: this.state.enabled,
      tabs,
      groupTabs,
      sections
    };
  }

  updateBuilderHud({ syncPreviews = false } = {}) {
    this.hud.setBuilderState(this.getBuilderViewModel());
    if (
      this.state.enabled
      && (
        syncPreviews
        || this.builderPreviewCategoryId !== this.state.activeCategoryId
        || this.builderPreviewGroupId !== this.activeGroupId
      )
    ) {
      this.builderPreviewCategoryId = this.state.activeCategoryId;
      this.builderPreviewGroupId = this.activeGroupId;
      void this.syncBuilderCatalogPreviews();
    }
  }

  async syncBuilderCatalogPreviews() {
    const categoryId = this.state.activeCategoryId;
    const groupId = this.activeGroupId;
    const items = this.getVisibleCategoryEntries(categoryId)
      .map(({ item }) => item)
      .filter((item) => (item.previewMode ?? 'render') === 'render');
    const generation = ++this.builderPreviewGeneration;

    if (!items.length) {
      return;
    }

    const previewRenderer = await this.ensureBuilderPreviewRenderer();

    for (const item of items) {
      try {
        const preview = await previewRenderer.render(item);
        if (
          generation !== this.builderPreviewGeneration
          || categoryId !== this.state.activeCategoryId
          || groupId !== this.activeGroupId
        ) {
          return;
        }
        this.hud.setBuilderPreviewImage(item.id, preview);
      } catch (error) {
        console.warn(`Could not render builder preview for ${item.id}.`, error);
      }
    }
  }

  async ensureBuilderPreviewRenderer() {
    if (this.builderPreviewRenderer) {
      return this.builderPreviewRenderer;
    }

    if (!this.builderPreviewRendererPromise) {
      this.builderPreviewRendererPromise = Promise.resolve()
        .then(() => {
          this.builderPreviewRenderer = new BuilderPreviewRenderer({ library: this.library });
          return this.builderPreviewRenderer;
        })
        .finally(() => {
          this.builderPreviewRendererPromise = null;
        });
    }

    return this.builderPreviewRendererPromise;
  }

  getColliders() {
    return this.worldRenderer.getColliders();
  }

  getGroundHeightAt(worldPosition) {
    return this.worldRenderer.getGroundHeightAt(worldPosition, this.worldState);
  }

  getInteractables() {
    return this.worldRenderer.getInteractables(this.worldState);
  }

  getInlineShellEntries() {
    return this.worldRenderer.getInlineShellEntries(this.worldState);
  }

  getLayout() {
    return this.worldState.serializeLayout();
  }

  setFocusFromWorldPosition(position) {
    if (!position) {
      return;
    }

    this.state.focus.set(position.x ?? 0, 0, position.z ?? 0);
  }

  getNpcSpeechAnchors() {
    return this.worldRenderer.getNpcSpeechAnchors();
  }

  setNpcRuntimeState(npcStateMap) {
    this.worldRenderer.applyNpcRuntimeState(npcStateMap);
  }

  setPlayerWorkoutState(
    playerStateMap = new Map(),
    workoutState = {}
  ) {
    this.worldRenderer.applyPlayerWorkoutState(playerStateMap, workoutState);
  }

  setNpcFocusTargets(npcFocusTargets = new Map()) {
    this.worldRenderer.applyNpcFocusTargets(npcFocusTargets);
  }

  setNpcDebugState(npcDebugMap = new Map()) {
    this.npcDebugState = new Map(npcDebugMap);
    this.worldRenderer.applyNpcDebugState(this.npcDebugState);
    this.syncNpcDebugTools();
    this.updateBuilderNpcEditor();
  }

  triggerNpcDamageFeedback(npcId, options = {}) {
    this.worldRenderer.triggerNpcDamageFeedback(npcId, options);
  }

  setVisible(visible) {
    const nextVisible = Boolean(visible);
    this.visible = nextVisible;
    this.worldRenderer.setVisible(nextVisible);
    this.remoteBuilderRenderer.clear();
    this.previewRoot.visible = nextVisible && this.state.enabled;
    this.gridHelper.visible = nextVisible && this.state.enabled;
    this.selectionRing.visible = nextVisible && this.state.enabled && Boolean(this.state.selection.placementId);
    this.updateNpcTargetPickVisual();
    this.syncNpcDebugTools();
  }

  setPlacementHidden(id, hidden) {
    this.worldRenderer.setPlacementHidden(id, hidden);
  }

  setPlacementVisualHidden(id, hidden) {
    this.worldRenderer.setPlacementVisualHidden(id, hidden);
  }

  setPlacementHiddenNodeNames(id, nodeNames = []) {
    this.worldRenderer.setPlacementHiddenNodeNames(id, nodeNames);
  }

  setPlacementShadowOverrides(id, overrides = null) {
    this.worldRenderer.setPlacementShadowOverrides(id, overrides);
  }

  clearInteriorPlacementPreview() {
    if (!this.builderInteriorPreviewPlacementIds.size) {
      return;
    }

    for (const placementId of [...this.builderInteriorPreviewPlacementIds]) {
      this.worldRenderer.setPlacementHiddenNodeNames(placementId, []);
      this.worldRenderer.setPlacementShadowOverrides(placementId, null);
      this.worldRenderer.setPlacementVisualHidden(placementId, false);
    }

    this.builderInteriorPreviewPlacementIds.clear();
  }

  syncInteriorPlacementPreview() {
    if (!this.state.enabled) {
      this.clearInteriorPlacementPreview();
      return;
    }

    const entries = this.getInlineShellEntries();
    const nextPlacementIds = new Set(entries.map((entry) => entry.placementId));

    for (const placementId of [...this.builderInteriorPreviewPlacementIds]) {
      if (nextPlacementIds.has(placementId)) {
        continue;
      }

      this.worldRenderer.setPlacementHiddenNodeNames(placementId, []);
      this.worldRenderer.setPlacementShadowOverrides(placementId, null);
      this.worldRenderer.setPlacementVisualHidden(placementId, false);
      this.builderInteriorPreviewPlacementIds.delete(placementId);
    }

    for (const entry of entries) {
      this.worldRenderer.setPlacementVisualHidden(entry.placementId, false);
      this.worldRenderer.setPlacementHiddenNodeNames(entry.placementId, []);
      this.worldRenderer.setPlacementShadowOverrides(entry.placementId, null);

      if (entry?.interior?.mode === 'inline-cutaway') {
        this.worldRenderer.setPlacementHiddenNodeNames(
          entry.placementId,
          entry?.interior?.cutawayNodeNames ?? []
        );
        this.worldRenderer.setPlacementShadowOverrides(entry.placementId, {
          castShadow: false,
          receiveShadow: false
        });
      } else if (entry?.interior?.mode === 'inline-shell') {
        this.worldRenderer.setPlacementVisualHidden(entry.placementId, true);
      }

      this.builderInteriorPreviewPlacementIds.add(entry.placementId);
    }
  }

  syncNpcInteractRadiusIndicators(playerPosition = null) {
    this.worldRenderer.syncNpcInteractRadiusIndicators(this.worldState, playerPosition);
  }

  syncNpcDebugTools() {
    const placement = this.getSelectedPlacement();
    const debugPlacementId = placement?.layer === 'npc' ? placement.id : '';
    this.worldRenderer.setNpcDebugSelection(debugPlacementId, {
      visible: this.visible && this.state.enabled && Boolean(debugPlacementId)
    });
    this.worldRenderer.setNpcRoutinePreview(
      this.buildNpcRoutineMarkerState(placement),
      {
        visible: this.visible && this.state.enabled && Boolean(debugPlacementId)
      }
    );
  }

  buildNpcRoutineMarkerState(placement) {
    if (!placement?.npc) {
      return [];
    }

    const routine = this.getNpcRoutineDraft(placement);
    const targetOptions = collectNpcTargetOptions(this.worldState);
    const targetOptionMap = new Map(targetOptions.map((option) => [option.placementId, option]));
    const activePickStepIndex = this.npcTargetPickState?.placementId === placement.id
      ? this.npcTargetPickState.stepIndex
      : -1;

    return (routine.steps ?? []).map((step, index) => {
      const target = step.targetPlacementId
        ? targetOptionMap.get(step.targetPlacementId)
        : null;
      if (!target?.approachPosition) {
        return null;
      }

      return {
        stepIndex: index,
        stepType: step.type,
        placementId: target.placementId,
        point: { ...target.approachPosition },
        originPoint: target.originPosition ? { ...target.originPosition } : null,
        label: target.label,
        activePick: index === activePickStepIndex
      };
    }).filter(Boolean);
  }

  setRemoteBuilders(builders = new Map(), localSessionId = '') {
    if (!this.visible) {
      this.remoteBuilderRenderer.clear();
      return;
    }

    const remoteBuilders = new Map();
    for (const [sessionId, presence] of builders.entries()) {
      if (!presence?.active || sessionId === localSessionId) {
        continue;
      }
      remoteBuilders.set(sessionId, presence);
    }
    this.remoteBuilderRenderer.sync(remoteBuilders);
  }

  onPointerMove(event) {
    const bounds = this.domElement.getBoundingClientRect();
    this.state.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.state.pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
  }

  onPointerDown(event) {
    if (!this.state.enabled) {
      return;
    }

    if (event.target.closest('.hud__builder') || event.target.closest('.hud__selection') || event.target.closest('.hud__builder-instance')) {
      return;
    }

    const bounds = this.domElement.getBoundingClientRect();
    this.state.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.state.pointer.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);
    this.resolveHoverState();

    const hoveredPlacement = this.getHoveredPlacement();

    if (this.npcTargetPickState) {
      if (event.button === 2) {
        event.preventDefault();
        this.cancelNpcRoutineTargetPickMode();
        return;
      }

      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      if (!hoveredPlacement) {
        this.hud.showToast('Click a valid building or prop destination.');
        return;
      }
      void this.tryAssignNpcRoutineTargetFromWorld(hoveredPlacement);
      return;
    }

    if (event.button === 2) {
      event.preventDefault();
      if (this.isMovingSelection()) {
        this.cancelMoveSelection();
        return;
      }
      if (hoveredPlacement) {
        this.selectPlacement(hoveredPlacement.id);
      } else {
        this.clearSelection();
      }
      return;
    }

    if (event.button !== 0) {
      return;
    }

    if (this.isMovingSelection()) {
      void this.commitSelectedPlacementMove();
      return;
    }

    if (hoveredPlacement) {
      this.selectPlacement(hoveredPlacement.id);
      return;
    }

    if (this.isNpcInstanceEditorOpen() || this.isBuildingInstanceEditorOpen()) {
      this.clearSelection();
      return;
    }

    this.clearSelection();
    void this.placeCurrentItem();
  }

  onContextMenu(event) {
    if (this.state.enabled) {
      event.preventDefault();
    }
  }

  onWheel(event) {
    if (!this.state.enabled) {
      return;
    }

    event.preventDefault();
    this.state.zoom = THREE.MathUtils.clamp(
      this.state.zoom + Math.sign(event.deltaY) * 0.08,
      EDITOR_ZOOM_MIN,
      EDITOR_ZOOM_MAX
    );
  }

  async setCanEdit(canEdit) {
    const nextCanEdit = Boolean(canEdit);
    if (nextCanEdit === this.canEdit) {
      return;
    }

    this.canEdit = nextCanEdit;
    if (!this.canEdit && this.state.enabled) {
      await this.setEnabled(false);
      return;
    }

    this.updateBuilderHud({ syncPreviews: this.canEdit && this.state.enabled });
    this.reportBuilderPresence(true);
  }

  async setEnabled(enabled) {
    const nextEnabled = Boolean(enabled && this.canEdit);

    if (enabled && !nextEnabled) {
      this.updateBuilderHud();
      this.reportBuilderPresence(true);
      return false;
    }

    this.state.enabled = nextEnabled;
    this.gridHelper.visible = nextEnabled;
    this.previewRoot.visible = nextEnabled;
    this.worldRenderer.setNpcInteractRadiusVisible(nextEnabled);
    this.worldRenderer.syncNpcInteractRadiusIndicators(this.worldState);
    this.syncNpcDebugTools();

    if (!nextEnabled) {
      this.cancelMoveSelection();
      this.closeNpcInstanceEditor();
      this.closeBuildingInstanceEditor();
      this.clearSelection();
    } else if (Math.abs(this.state.pointer.x) > 1.2 || Math.abs(this.state.pointer.y) > 1.2) {
      this.state.pointer.set(0, 0);
    }

    this.updateBuilderHud({ syncPreviews: nextEnabled });

    if (nextEnabled) {
      this.resolveHoverState();
      await this.syncPreviewToState(true);
      this.updatePreviewTransform();
      this.syncInteriorPlacementPreview();
    } else {
      this.builderPreviewCategoryId = null;
      this.builderPreviewGroupId = null;
      this.hud.setBuilderSelection(null);
      this.clearInteriorPlacementPreview();
    }

    this.updateNpcTargetPickVisual();
    this.reportBuilderPresence(true);
    return this.state.enabled;
  }

  selectCategory(categoryId) {
    this.state.activeCategoryId = categoryId;
    this.state.activeItemIndex = this.getVisibleCategoryEntries(categoryId)[0]?.index ?? 0;
    this.updateBuilderHud({ syncPreviews: true });
    void this.syncPreviewToState(true);
  }

  selectGroup(groupId) {
    this.state.activeGroupIdByCategory[this.state.activeCategoryId] = groupId;
    this.ensureActiveItemVisible();
    this.updateBuilderHud({ syncPreviews: true });
    void this.syncPreviewToState(true);
  }

  selectItem(index) {
    const maxIndex = this.activeCategory.items.length - 1;
    this.state.activeItemIndex = THREE.MathUtils.clamp(index, 0, maxIndex);
    this.updateBuilderHud();
    void this.syncPreviewToState(true);
  }

  ensureActiveItemVisible() {
    const visibleEntries = this.getVisibleCategoryEntries();

    if (visibleEntries.length === 0) {
      this.state.activeItemIndex = 0;
      return;
    }

    if (!visibleEntries.some(({ index }) => index === this.state.activeItemIndex)) {
      this.state.activeItemIndex = visibleEntries[0].index;
    }
  }

  selectVisibleItem(visibleIndex) {
    const visibleEntries = this.getVisibleCategoryEntries();
    const entry = visibleEntries[visibleIndex];
    if (!entry) {
      return;
    }

    this.selectItem(entry.index);
  }

  rotate(delta) {
    this.state.rotationQuarterTurns = (this.state.rotationQuarterTurns + delta + 4) % 4;
    this.updateBuilderHud();
  }

  update(deltaSeconds, input) {
    this.worldRenderer.update(deltaSeconds);

    if (!this.state.enabled) {
      this.syncNpcDebugTools();
      return;
    }

    if (this.isNpcInstanceEditorOpen()) {
      if (input.consume('Escape') && this.npcTargetPickState) {
        this.cancelNpcRoutineTargetPickMode();
      }
      if (input.consume('Escape')) {
        this.closeNpcInstanceEditor();
      }
    }

    if (this.isBuildingInstanceEditorOpen()) {
      if (input.consume('Escape')) {
        this.closeBuildingInstanceEditor();
      }
    }

    const instanceEditorOpen = this.isNpcInstanceEditorOpen() || this.isBuildingInstanceEditorOpen();
    const movingSelection = this.isMovingSelection();

    if (!instanceEditorOpen && !movingSelection) {
      if (input.consume('KeyR') || input.consume('KeyE')) {
        this.rotate(1);
      }
      if (input.consume('KeyQ')) {
        this.rotate(-1);
      }
      if (input.consume('Delete') || input.consume('Backspace')) {
        this.deleteSelectedPlacement();
      }
      if (input.consume('BracketRight')) {
        const visibleEntries = this.getVisibleCategoryEntries();
        const currentVisibleIndex = Math.max(visibleEntries.findIndex(({ index }) => index === this.state.activeItemIndex), 0);
        this.selectVisibleItem((currentVisibleIndex + 1) % visibleEntries.length);
      }
      if (input.consume('BracketLeft')) {
        const visibleEntries = this.getVisibleCategoryEntries();
        const currentVisibleIndex = Math.max(visibleEntries.findIndex(({ index }) => index === this.state.activeItemIndex), 0);
        this.selectVisibleItem((currentVisibleIndex - 1 + visibleEntries.length) % visibleEntries.length);
      }
      if (input.consume('Tab')) {
        const currentIndex = BUILDER_CATEGORIES.findIndex((entry) => entry.id === this.state.activeCategoryId);
        const nextCategory = BUILDER_CATEGORIES[(currentIndex + 1) % BUILDER_CATEGORIES.length];
        this.selectCategory(nextCategory.id);
      }

      const visibleEntries = this.getVisibleCategoryEntries();
      for (let i = 0; i < Math.min(9, visibleEntries.length); i += 1) {
        if (input.consume(`Digit${i + 1}`)) {
          this.selectVisibleItem(i);
        }
      }
    }

    const pan = input.getMovementVector();
    this.state.focus.x += pan.x * deltaSeconds * EDITOR_PAN_SPEED;
    this.state.focus.z += pan.z * deltaSeconds * EDITOR_PAN_SPEED;

    this.resolveHoverState();
    void this.syncPreviewToState();
    this.updatePreviewTransform();
    this.updateSelectionVisual();
    this.syncNpcDebugTools();
    this.reportBuilderPresence();

    if (instanceEditorOpen && !movingSelection) {
      return;
    }
  }

  resolveHoverState() {
    this.raycaster.setFromCamera(this.state.pointer, this.camera);
    const hit = new THREE.Vector3();
    const intersects = this.raycaster.ray.intersectPlane(this.groundPlane, hit);

    if (!intersects) {
      this.state.hover.point = null;
      this.state.hover.cell = null;
      this.state.hover.placementId = null;
      return;
    }

    const hoverCell = snapToCell(hit);
    const hoveredPropId = this.worldRenderer.pickPlacementId(this.state.pointer, this.camera);
    const hoveredProp = hoveredPropId ? this.worldState.getPlacement(hoveredPropId) : null;
    const hoveredTile = (this.canEditHoveredTiles || this.npcTargetPickState)
      ? this.worldState.getPlacementAtCell(hoverCell.x, hoverCell.z)
      : null;
    const hoveredTargetableProp = hoveredProp && resolveNpcTargetOption(hoveredProp)
      ? hoveredProp
      : null;
    const hoveredTargetableTile = hoveredTile && resolveNpcTargetOption(hoveredTile)
      ? hoveredTile
      : null;
    const hoveredPlacementId = this.npcTargetPickState
      ? (
          hoveredTargetableProp?.id
          ?? hoveredTargetableTile?.id
          ?? hoveredProp?.id
          ?? hoveredTile?.id
          ?? null
        )
      : (hoveredPropId ?? hoveredTile?.id ?? null);

    this.state.hover.point = hit;
    this.state.hover.cell = hoverCell;
    this.state.hover.placementId = hoveredPlacementId;
  }

  getHoveredPlacement() {
    return this.worldState.getPlacement(this.state.hover.placementId);
  }

  getSelectedPlacement() {
    return this.worldState.getPlacement(this.state.selection.placementId);
  }

  getPreviewTarget() {
    if (this.npcTargetPickState) {
      return null;
    }

    const movingPlacement = this.getMovingPlacement();
    if (movingPlacement) {
      const item = getBuilderItemById(movingPlacement.itemId);
      if (!item) {
        return null;
      }

      return {
        item,
        opacity: 0.92,
        key: `move:${movingPlacement.id}:${movingPlacement.itemId}`
      };
    }

    const hoveredPlacement = this.getHoveredPlacement();
    if (hoveredPlacement) {
      const item = getBuilderItemById(hoveredPlacement.itemId);
      if (!item) {
        return null;
      }

      return {
        item,
        opacity: 0.5,
        key: `placement:${hoveredPlacement.itemId}:0.5`
      };
    }

    if (!this.activeItem) {
      return null;
    }

    return {
      item: this.activeItem,
      opacity: 0.86,
      key: `catalog:${this.activeItem.id}:0.86`
    };
  }

  async syncPreviewToState(force = false) {
    const previewTarget = this.getPreviewTarget();
    if (!previewTarget) {
      this.previewRoot.clear();
      this.previewRoot.add(this.previewFootprint);
      this.state.preview.key = null;
      this.state.preview.loadingKey = null;
      this.state.preview.object = null;
      this.previewRoot.visible = false;
      return;
    }

    if (!force && (this.state.preview.key === previewTarget.key || this.state.preview.loadingKey === previewTarget.key)) {
      return;
    }

    this.state.preview.loadingKey = previewTarget.key;
    const token = ++this.previewLoadToken;
    const preview = await createPreviewObject(this.library, previewTarget.item);
    if (token !== this.previewLoadToken || this.state.preview.loadingKey !== previewTarget.key) {
      return;
    }

    applyPreviewMaterial(preview, previewTarget.opacity);
    preview.position.y = 0.08;

    this.previewRoot.clear();
    this.previewRoot.add(this.previewFootprint);
    this.previewRoot.add(preview);
    this.state.preview.key = previewTarget.key;
    this.state.preview.loadingKey = null;
    this.state.preview.object = preview;
    this.previewRoot.visible = this.state.enabled;
    this.updatePreviewTransform();
  }

  updatePreviewTransform() {
    const movingPlacement = this.getMovingPlacement();
    const movingItem = movingPlacement ? getBuilderItemById(movingPlacement.itemId) : null;
    if (!this.state.enabled || !this.state.preview.object || !this.state.hover.point || (!this.activeItem && !movingPlacement)) {
      this.previewRoot.visible = false;
      return;
    }

    if (movingPlacement && movingItem) {
      if (movingPlacement.layer === 'tile') {
        if (!this.state.hover.cell) {
          this.previewRoot.visible = false;
          return;
        }
        const center = getTileCenterWorldPosition(
          movingItem,
          this.state.hover.cell.x,
          this.state.hover.cell.z,
          movingPlacement.rotationQuarterTurns
        );
        const [footprintWidth, footprintDepth] = getTileFootprintWorldSize(movingItem, movingPlacement.rotationQuarterTurns);
        this.previewRoot.position.set(center.x, 0, center.z);
        this.previewFootprint.scale.set(
          Math.max(0.4, footprintWidth - 0.6),
          Math.max(0.4, footprintDepth - 0.6),
          1
        );
      } else {
        this.previewRoot.position.set(
          this.state.hover.point.x,
          this.getGroundHeightAt(toGroundProbe(this.state.hover.point.x, this.state.hover.point.z)),
          this.state.hover.point.z
        );
        this.previewFootprint.scale.set(movingItem.size[0] + 0.35, movingItem.size[1] + 0.35, 1);
      }

      this.previewRoot.rotation.y = toRotationY(movingPlacement.rotationQuarterTurns);
      this.previewRoot.visible = true;
      return;
    }

    const hoveredPlacement = this.getHoveredPlacement();

    if (hoveredPlacement) {
      if (hoveredPlacement.layer === 'tile') {
        const item = getBuilderItemById(hoveredPlacement.itemId);
        if (!item) {
          this.previewRoot.visible = false;
          return;
        }
        const [footprintWidth, footprintDepth] = getTileFootprintWorldSize(item, hoveredPlacement.rotationQuarterTurns);
        const center = getTileCenterWorldPosition(
          item,
          hoveredPlacement.cellX,
          hoveredPlacement.cellZ,
          hoveredPlacement.rotationQuarterTurns
        );
        this.previewRoot.position.set(
          center.x,
          0,
          center.z
        );
        this.previewFootprint.scale.set(
          Math.max(0.4, footprintWidth - 0.6),
          Math.max(0.4, footprintDepth - 0.6),
          1
        );
      } else {
        this.previewRoot.position.set(
          hoveredPlacement.position[0],
          this.getGroundHeightAt(toGroundProbe(hoveredPlacement.position[0], hoveredPlacement.position[1])),
          hoveredPlacement.position[1]
        );
        const item = getBuilderItemById(hoveredPlacement.itemId);
        if (!item) {
          this.previewRoot.visible = false;
          return;
        }
        this.previewFootprint.scale.set(item.size[0] + 0.35, item.size[1] + 0.35, 1);
      }
      this.previewRoot.rotation.y = toRotationY(hoveredPlacement.rotationQuarterTurns);
      this.previewRoot.visible = true;
      return;
    }

    if (this.activeItem.layer === 'tile') {
      const center = getTileCenterWorldPosition(
        this.activeItem,
        this.state.hover.cell.x,
        this.state.hover.cell.z,
        this.state.rotationQuarterTurns
      );
      const [footprintWidth, footprintDepth] = getTileFootprintWorldSize(this.activeItem, this.state.rotationQuarterTurns);
      this.previewRoot.position.set(
        center.x,
        0,
        center.z
      );
      this.previewFootprint.scale.set(
        Math.max(0.4, footprintWidth - 0.6),
        Math.max(0.4, footprintDepth - 0.6),
        1
      );
    } else {
      this.previewRoot.position.set(
        this.state.hover.point.x,
        this.getGroundHeightAt(toGroundProbe(this.state.hover.point.x, this.state.hover.point.z)),
        this.state.hover.point.z
      );
      this.previewFootprint.scale.set(this.activeItem.size[0] + 0.35, this.activeItem.size[1] + 0.35, 1);
    }

    this.previewRoot.rotation.y = toRotationY(this.state.rotationQuarterTurns);
    this.previewRoot.visible = true;
  }

  updateCamera(camera) {
    const offset = EDITOR_CAMERA_OFFSET.clone().multiplyScalar(this.state.zoom);
    const targetPosition = this.state.focus.clone().add(offset);
    camera.position.lerp(targetPosition, 0.12);
    camera.lookAt(this.state.focus);
  }

  reportBuilderPresence(force = false) {
    if (!this.worldTransport?.setBuilderPresence) {
      return;
    }

    if (!this.canEdit || !this.state.enabled || !this.activeItem) {
      this.worldTransport.setBuilderPresence({ active: false, force });
      return;
    }

    const hoverPoint = this.state.hover.point;
    const hoverCell = this.state.hover.cell;
    const selectedPlacement = this.getSelectedPlacement();
    const fallbackPosition = selectedPlacement?.position
      ? { x: selectedPlacement.position[0], z: selectedPlacement.position[1] }
      : { x: this.state.focus.x, z: this.state.focus.z };

    this.worldTransport.setBuilderPresence({
      active: true,
      itemId: this.activeItem.id,
      layer: this.activeItem.layer,
      rotationQuarterTurns: this.state.rotationQuarterTurns,
      cellX: hoverCell?.x ?? selectedPlacement?.cellX ?? 0,
      cellZ: hoverCell?.z ?? selectedPlacement?.cellZ ?? 0,
      x: hoverPoint?.x ?? fallbackPosition.x,
      z: hoverPoint?.z ?? fallbackPosition.z,
      selectionPlacementId: this.state.selection.placementId ?? '',
      force
    });
  }

  async placeCurrentItem() {
    if (!this.activeItem || !this.state.hover.point) {
      return;
    }

    if (this.activeItem.layer === 'tile') {
      await this.placeTile(this.activeItem);
      return;
    }

    if (this.activeItem.layer === 'npc') {
      await this.placeNpc(this.activeItem);
      return;
    }

    await this.placeProp(this.activeItem);
  }

  async placeTile(item) {
    const { cell } = this.state.hover;
    if (!cell) {
      return;
    }

    const result = await this.worldEditAdapter.edit({
      op: 'placeTile',
      item,
      cellX: cell.x,
      cellZ: cell.z,
      rotationQuarterTurns: this.state.rotationQuarterTurns
    });
    if (!result?.ok) {
      this.hud.showToast(result?.error ?? 'Could not place tile.');
      return;
    }

    if (result.appliedImmediately) {
      this.resolveHoverState();
      this.syncInteriorPlacementPreview();
      await this.syncPreviewToState(true);
      this.updateSelectionVisual();
      this.notifyLayoutChanged();
    }

    this.hud.showToast(`Placed ${item.label}`);
  }

  async placeProp(item) {
    const result = await this.worldEditAdapter.edit({
      op: 'placeProp',
      item,
      x: this.state.hover.point.x,
      z: this.state.hover.point.z,
      rotationQuarterTurns: this.state.rotationQuarterTurns
    });
    if (!result?.ok) {
      this.hud.showToast(result?.error ?? 'Could not place prop.');
      return;
    }

    if (result.appliedImmediately) {
      this.resolveHoverState();
      this.syncInteriorPlacementPreview();
      await this.syncPreviewToState(true);
      this.updateSelectionVisual();
      this.notifyLayoutChanged();
    }

    this.hud.showToast(`Placed ${item.label}`);
  }

  async placeNpc(item) {
    const result = await this.worldEditAdapter.edit({
      op: 'placeNpc',
      item,
      x: this.state.hover.point.x,
      z: this.state.hover.point.z,
      rotationQuarterTurns: this.state.rotationQuarterTurns,
      npc: {
        modelId: item.modelId,
        name: item.label,
        prompt: `You are ${item.label}, an NPC in Vibe Theft Auto. Stay in character, keep answers grounded in the city, and respond in short, flavorful lines.`,
        interactRadius: NPC_DEFAULT_INTERACT_RADIUS
      }
    });
    if (!result?.ok) {
      this.hud.showToast(result?.error ?? 'Could not place NPC.');
      return;
    }

    if (result.placementId) {
      this.selectPlacement(result.placementId);
    }
    if (result.appliedImmediately) {
      this.resolveHoverState();
      this.syncInteriorPlacementPreview();
      await this.syncPreviewToState(true);
      this.updateSelectionVisual();
      this.updateBuilderNpcEditor();
      this.notifyLayoutChanged();
    }

    this.hud.showToast(`Placed ${item.label}.`);
  }

  async loadLayout(layout = { tiles: [], props: [], npcs: [] }) {
    this.clearSelection();
    this.worldState.loadLayout(layout);
    await this.worldRenderer.syncFromState(this.worldState);
    this.syncInteriorPlacementPreview();
    this.resolveHoverState();
    await this.syncPreviewToState(true);
  }

  async applyWorldPatch(patch) {
    if (!patch || typeof patch.type !== 'string') {
      return;
    }

    if (patch.type === 'upsertPlacement') {
      await this.applyUpsertPlacementPatch(patch);
    } else if (patch.type === 'deletePlacement') {
      this.applyDeletePlacementPatch(patch);
    } else {
      return;
    }

    this.resolveHoverState();
    this.syncInteriorPlacementPreview();
    await this.syncPreviewToState(true);
    this.updateSelectionVisual();
    this.updateBuilderNpcEditor();
    this.updateBuildingInstanceEditor();
    this.notifyLayoutChanged();
  }

  async applyUpsertPlacementPatch(patch) {
    const placementId = patch.placement?.id;
    if (!placementId) {
      return;
    }

    const previousPlacement = this.worldState.getPlacement(placementId);
    const previousSignature = previousPlacement
      ? { layer: previousPlacement.layer, itemId: previousPlacement.itemId }
      : null;

    if (patch.replacedPlacementId && patch.replacedPlacementId !== placementId) {
      this.worldState.deletePlacement(patch.replacedPlacementId);
      this.worldRenderer.removePlacement(patch.replacedPlacementId);
      if (this.state.selection.placementId === patch.replacedPlacementId) {
        this.clearSelection();
      }
    }

    for (const replacedPlacementId of patch.replacedPlacementIds ?? []) {
      if (!replacedPlacementId || replacedPlacementId === placementId || replacedPlacementId === patch.replacedPlacementId) {
        continue;
      }
      this.worldState.deletePlacement(replacedPlacementId);
      this.worldRenderer.removePlacement(replacedPlacementId);
      if (this.state.selection.placementId === replacedPlacementId) {
        this.clearSelection();
      }
    }

    const result = this.worldState.upsertSerializedPlacement(patch.placement);
    if (!result) {
      return;
    }

    const nextPlacement = result.placement;
    if (!previousSignature) {
      await this.worldRenderer.addPlacement(nextPlacement);
    } else if (
      previousSignature.layer !== nextPlacement.layer
      || previousSignature.itemId !== nextPlacement.itemId
    ) {
      this.worldRenderer.removePlacement(nextPlacement.id);
      await this.worldRenderer.addPlacement(nextPlacement);
    } else {
      this.worldRenderer.updatePlacement(nextPlacement);
    }

    if (this.awaitingMovedPlacementIds.has(nextPlacement.id)) {
      this.awaitingMovedPlacementIds.delete(nextPlacement.id);
      this.worldRenderer.setPlacementHidden(nextPlacement.id, false);
    }

    if (this.state.selection.placementId === nextPlacement.id) {
      this.selectPlacement(nextPlacement.id);
    }
  }

  applyDeletePlacementPatch(patch) {
    const placementId = patch.placementId;
    if (!placementId) {
      return;
    }

    if (this.activeMovePlacementId === placementId) {
      this.activeMovePlacementId = null;
    }
    this.awaitingMovedPlacementIds.delete(placementId);
    this.clearPendingNpcUpdate(placementId);
    this.clearPendingBuildingUpdate(placementId);
    this.worldState.deletePlacement(placementId);
    this.worldRenderer.removePlacement(placementId);
    if (this.state.selection.placementId === placementId) {
      this.clearSelection();
    }
  }

  clearPlacements() {
    this.clearInteriorPlacementPreview();
    this.worldState.clear();
    this.worldRenderer.clear();
    this.remoteBuilderRenderer.clear();
  }

  selectPlacement(placementId) {
    if (this.isMovingSelection() && this.activeMovePlacementId !== placementId) {
      this.cancelMoveSelection();
    }

    this.state.selection.placementId = placementId;
    const placement = this.getSelectedPlacement();

    if (placement?.layer === 'npc') {
      const npcCategory = BUILDER_CATEGORIES.find((entry) => entry.id === 'npcs');
      const npcItemIndex = npcCategory?.items.findIndex((item) => item.id === placement.itemId) ?? -1;
      const switchedCategory = this.state.activeCategoryId !== 'npcs';

      this.state.activeCategoryId = 'npcs';
      if (npcItemIndex >= 0) {
        this.state.activeItemIndex = npcItemIndex;
      }
      this.updateBuilderHud({ syncPreviews: switchedCategory });
    }

    if (placement?.layer === 'npc') {
      if (this.isBuildingInstanceEditorOpen()) {
        this.closeBuildingInstanceEditor();
      }
      this.openNpcInstanceEditor();
    } else if (this.isNpcInstanceEditorOpen()) {
      this.closeNpcInstanceEditor();
    }

    if (this.isBuildingPlacement(placement)) {
      if (this.isNpcInstanceEditorOpen()) {
        this.closeNpcInstanceEditor();
      }
      this.openBuildingInstanceEditor();
    } else if (this.isBuildingInstanceEditorOpen()) {
      this.closeBuildingInstanceEditor();
    }

    this.updateSelectionVisual();
    this.updateBuilderNpcEditor();
    this.updateBuildingInstanceEditor();
    this.syncNpcDebugTools();
    this.reportBuilderPresence(true);
  }

  clearSelection() {
    this.cancelNpcRoutineTargetPickMode();
    if (this.activeMovePlacementId) {
      this.cancelMoveSelection();
    }
    if (this.activeNpcEditorPlacementId) {
      this.closeNpcInstanceEditor();
    }
    if (this.activeBuildingEditorPlacementId) {
      this.closeBuildingInstanceEditor();
    }
    this.state.selection.placementId = null;
    this.selectionRing.visible = false;
    this.hud.setBuilderSelection(null);
    this.hud.setBuilderNpcEditor(null);
    this.hud.setBuilderBuildingEditor(null);
    this.syncNpcDebugTools();
    this.reportBuilderPresence(true);
  }

  async rotateSelectedPlacement() {
    const placement = this.getSelectedPlacement();
    if (!placement) {
      return;
    }

    const result = await this.worldEditAdapter.edit({
      op: 'rotatePlacement',
      placementId: placement.id
    });
    if (!result?.ok) {
      this.hud.showToast(result?.error ?? 'Could not rotate that piece.');
      return;
    }

    if (result.appliedImmediately) {
      this.updateSelectionVisual();
      this.resolveHoverState();
      this.syncInteriorPlacementPreview();
      await this.syncPreviewToState(true);
      this.notifyLayoutChanged();
    }

    const item = getBuilderItemById(placement.itemId);
    this.hud.showToast(`Rotated ${item?.label ?? 'piece'}`);
  }

  async deleteSelectedPlacement() {
    const placement = this.getSelectedPlacement();
    if (!placement) {
      return;
    }

    const result = await this.worldEditAdapter.edit({
      op: 'deletePlacement',
      placementId: placement.id
    });
    if (!result?.ok) {
      this.hud.showToast(result?.error ?? 'Could not delete that piece.');
      return;
    }

    if (result.appliedImmediately) {
      this.clearSelection();
      this.resolveHoverState();
      this.syncInteriorPlacementPreview();
      await this.syncPreviewToState(true);
      this.notifyLayoutChanged();
    }

    const item = getBuilderItemById(placement.itemId);
    this.hud.showToast(`Deleted ${item?.label ?? 'piece'}`);
  }

  isMovingSelection() {
    return Boolean(this.activeMovePlacementId);
  }

  getMovingPlacement() {
    return this.worldState.getPlacement(this.activeMovePlacementId);
  }

  startMovingSelectedPlacement() {
    const placement = this.getSelectedPlacement();
    if (!placement) {
      return;
    }

    if (this.activeMovePlacementId && this.activeMovePlacementId !== placement.id) {
      this.cancelMoveSelection();
    }
    if (this.activeMovePlacementId === placement.id) {
      return;
    }

    this.activeMovePlacementId = placement.id;
    this.worldRenderer.setPlacementHidden(placement.id, true);
    this.resolveHoverState();
    void this.syncPreviewToState(true);
    this.updatePreviewTransform();
    this.updateSelectionVisual();
    this.reportBuilderPresence(true);
  }

  cancelMoveSelection() {
    const placementId = this.activeMovePlacementId;
    this.activeMovePlacementId = null;
    if (placementId && !this.awaitingMovedPlacementIds.has(placementId)) {
      this.worldRenderer.setPlacementHidden(placementId, false);
    }
    this.resolveHoverState();
    void this.syncPreviewToState(true);
    this.updatePreviewTransform();
    this.updateSelectionVisual();
    this.reportBuilderPresence(true);
  }

  finishMoveSelection({ restoreVisibility = true } = {}) {
    const placementId = this.activeMovePlacementId;
    this.activeMovePlacementId = null;
    if (!placementId) {
      return;
    }

    if (restoreVisibility && !this.awaitingMovedPlacementIds.has(placementId)) {
      this.worldRenderer.setPlacementHidden(placementId, false);
    }

    this.resolveHoverState();
    void this.syncPreviewToState(true);
    this.updatePreviewTransform();
    this.updateSelectionVisual();
    this.reportBuilderPresence(true);
  }

  async commitSelectedPlacementMove() {
    const placement = this.getSelectedPlacement();
    if (!placement || this.activeMovePlacementId !== placement.id) {
      return;
    }

    const edit = placement.layer === 'tile'
      ? (this.state.hover.cell
        ? {
            op: 'movePlacement',
            placementId: placement.id,
            cellX: this.state.hover.cell.x,
            cellZ: this.state.hover.cell.z
          }
        : null)
      : (this.state.hover.point
        ? {
            op: 'movePlacement',
            placementId: placement.id,
            x: this.state.hover.point.x,
            z: this.state.hover.point.z
          }
        : null);

    if (!edit) {
      return;
    }

    const movesViaPatch = Boolean(this.worldTransport?.editWorld);
    if (movesViaPatch) {
      this.awaitingMovedPlacementIds.add(placement.id);
    }

    const result = await this.worldEditAdapter.edit(edit);
    if (!result?.ok) {
      this.awaitingMovedPlacementIds.delete(placement.id);
      this.worldRenderer.setPlacementHidden(placement.id, false);
      this.hud.showToast(result?.error ?? 'Could not move that piece.');
      return;
    }

    this.finishMoveSelection({
      restoreVisibility: Boolean(result.appliedImmediately) || !movesViaPatch
    });

    if (result.appliedImmediately) {
      this.resolveHoverState();
      this.syncInteriorPlacementPreview();
      await this.syncPreviewToState(true);
      this.updateSelectionVisual();
      this.updateBuilderNpcEditor();
      this.updateBuildingInstanceEditor();
      this.notifyLayoutChanged();
    }

    const item = getBuilderItemById(placement.itemId);
    this.hud.showToast(`Moved ${item?.label ?? 'piece'}`);
  }

  updateSelectionVisual() {
    if (this.npcTargetPickState) {
      this.selectionRing.visible = false;
      this.hud.setBuilderSelection(null);
      this.updateNpcTargetPickVisual();
      return;
    }

    this.updateNpcTargetPickVisual();

    if (this.isMovingSelection()) {
      if (!this.previewRoot.visible) {
        this.selectionRing.visible = false;
        this.hud.setBuilderSelection(null);
        return;
      }

      const bounds = new THREE.Box3().setFromObject(this.previewRoot);
      if (bounds.isEmpty()) {
        this.selectionRing.visible = false;
        this.hud.setBuilderSelection(null);
        return;
      }

      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const ringScale = Math.max(1, Math.max(size.x, size.z) / 4.5);
      this.selectionRing.visible = true;
      this.selectionRing.position.set(center.x, bounds.min.y + 0.08, center.z);
      this.selectionRing.scale.setScalar(ringScale);

      const anchor = new THREE.Vector3(center.x, bounds.max.y + 2.2, center.z);
      const projected = anchor.project(this.camera);
      const screenX = screenClamp(((projected.x + 1) * 0.5) * window.innerWidth, 100, window.innerWidth - 100);
      const screenY = screenClamp(((-projected.y + 1) * 0.5) * window.innerHeight, 80, window.innerHeight - 100);
      this.hud.setBuilderSelection({ screenX, screenY, moving: true });
      return;
    }

    const placement = this.getSelectedPlacement();
    if (!placement) {
      this.selectionRing.visible = false;
      this.hud.setBuilderSelection(null);
      return;
    }

    const bounds = this.worldRenderer.getPlacementBounds(placement.id);
    if (!bounds) {
      this.selectionRing.visible = false;
      this.hud.setBuilderSelection(null);
      return;
    }
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const ringScale = Math.max(1, Math.max(size.x, size.z) / 4.5);
    this.selectionRing.visible = true;
    this.selectionRing.position.set(center.x, bounds.min.y + 0.08, center.z);
    this.selectionRing.scale.setScalar(ringScale);

    const anchor = new THREE.Vector3(center.x, bounds.max.y + 2.2, center.z);
    const projected = anchor.project(this.camera);
    const screenX = screenClamp(((projected.x + 1) * 0.5) * window.innerWidth, 100, window.innerWidth - 100);
    const screenY = screenClamp(((-projected.y + 1) * 0.5) * window.innerHeight, 80, window.innerHeight - 100);

    this.hud.setBuilderSelection({ screenX, screenY, moving: false });
  }

  updateNpcTargetPickVisual() {
    if (!this.npcTargetPickState || !this.visible || !this.state.enabled || !this.state.hover.point) {
      this.npcTargetPickMarker.visible = false;
      return;
    }

    const hoveredPlacement = this.getHoveredPlacement();
    const target = hoveredPlacement ? resolveNpcTargetOption(hoveredPlacement) : null;
    const supportsStep = Boolean(target?.supportedStepTypes?.includes(this.npcTargetPickState.stepType));
    const markerColor = supportsStep
      ? NPC_TARGET_PICK_VALID_COLOR
      : target
        ? NPC_TARGET_PICK_UNSUPPORTED_COLOR
        : NPC_TARGET_PICK_INVALID_COLOR;

    this.npcTargetPickMarkerRingMaterial.color.setHex(markerColor);
    this.npcTargetPickMarkerRingMaterial.opacity = supportsStep ? 0.9 : 0.72;
    this.npcTargetPickMarkerCoreMaterial.color.setHex(markerColor);
    this.npcTargetPickMarkerCoreMaterial.opacity = supportsStep ? 0.98 : 0.84;

    const hoverPoint = this.state.hover.point;
    const groundHeight = this.getGroundHeightAt(toGroundProbe(hoverPoint.x, hoverPoint.z));
    this.npcTargetPickMarker.position.set(hoverPoint.x, groundHeight + 0.06, hoverPoint.z);

    let markerScale = 1;
    const bounds = hoveredPlacement ? this.worldRenderer.getPlacementBounds(hoveredPlacement.id) : null;
    if (bounds && !bounds.isEmpty()) {
      const size = bounds.getSize(new THREE.Vector3());
      markerScale = THREE.MathUtils.clamp(Math.max(size.x, size.z) / 4, 0.9, 1.8);
    }
    this.npcTargetPickMarker.scale.setScalar(markerScale);
    this.npcTargetPickMarker.visible = true;
  }

  getNpcTargetOptions() {
    return collectNpcTargetOptions(this.worldState).map((option) => ({
      ...option,
      id: option.placementId,
      label: `${option.label} (${option.placementId})`,
      supportedStepTypes: [...(option.supportedStepTypes ?? [])]
    }));
  }

  getNpcTargetOptionMap() {
    return new Map(this.getNpcTargetOptions().map((option) => [option.id, option]));
  }

  cancelNpcRoutineTargetPickMode() {
    if (!this.npcTargetPickState) {
      return;
    }

    this.npcTargetPickState = null;
    if (this.state.enabled) {
      this.resolveHoverState();
      void this.syncPreviewToState(true);
      this.updatePreviewTransform();
    }
    this.updateBuilderNpcEditor();
    this.updateSelectionVisual();
    this.syncNpcDebugTools();
  }

  setNpcRoutineTargetPickMode(stepIndex, mode = 'start') {
    const placement = this.getSelectedPlacement();
    if (!placement?.npc || !Number.isInteger(stepIndex)) {
      this.cancelNpcRoutineTargetPickMode();
      return;
    }

    if (mode === 'cancel') {
      this.cancelNpcRoutineTargetPickMode();
      return;
    }

    const routine = this.getNpcRoutineDraft(placement);
    const step = routine.steps?.[stepIndex];
    if (!step) {
      return;
    }

    this.npcTargetPickState = {
      placementId: placement.id,
      stepIndex,
      stepType: step.type
    };
    if (this.state.enabled) {
      this.resolveHoverState();
      void this.syncPreviewToState(true);
      this.updatePreviewTransform();
    }
    this.updateBuilderNpcEditor();
    this.updateSelectionVisual();
    this.syncNpcDebugTools();
    this.hud.showToast(`Click a destination in the world for step ${stepIndex + 1}.`);
  }

  async tryAssignNpcRoutineTargetFromWorld(placement) {
    const pickState = this.npcTargetPickState;
    if (!pickState || !placement) {
      return false;
    }

    const selectedNpc = this.getSelectedPlacement();
    if (!selectedNpc?.npc || selectedNpc.id !== pickState.placementId) {
      this.cancelNpcRoutineTargetPickMode();
      return false;
    }

    const target = resolveNpcTargetOption(placement);
    if (!target) {
      this.hud.showToast('That placement cannot be used as an NPC destination.');
      return true;
    }

    if (!target.supportedStepTypes.includes(pickState.stepType)) {
      this.hud.showToast(`${target.label} does not support ${titleCaseLabel(pickState.stepType)}.`);
      return true;
    }

    this.cancelNpcRoutineTargetPickMode();
    await this.updateSelectedNpcRoutineStep(pickState.stepIndex, 'targetPlacementId', placement.id);
    return true;
  }

  getNpcDraft(placement) {
    if (!placement?.npc) {
      return null;
    }

    const pending = this.pendingNpcUpdateByPlacementId.get(placement.id) ?? {};
    return {
      ...placement.npc,
      ...pending,
      routine: pending.routine
        ? {
            ...placement.npc.routine,
            ...pending.routine
          }
        : placement.npc.routine,
      combat: pending.combat
        ? {
            ...placement.npc.combat,
            ...pending.combat
          }
        : placement.npc.combat
    };
  }

  getNpcRoutineDraft(placement) {
    return this.getNpcDraft(placement)?.routine ?? createDefaultNpcRoutine();
  }

  getNpcCombatDraft(placement) {
    return this.getNpcDraft(placement)?.combat ?? createDefaultNpcCombat();
  }

  buildNpcRoutineEditorState(placement) {
    const routine = this.getNpcRoutineDraft(placement);
    const targetOptions = this.getNpcTargetOptions();
    const targetOptionMap = new Map(targetOptions.map((option) => [option.id, option]));
    const warnings = [];
    const steps = (routine.steps ?? []).map((step, index) => {
      const supportedTargetOptions = targetOptions.filter((option) =>
        option.supportedStepTypes.includes(step.type)
      );
      let warning = '';

      if (step.targetPlacementId) {
        const target = targetOptionMap.get(step.targetPlacementId);
        if (!target) {
          warning = `Step ${index + 1} points at a missing placement and will be skipped at runtime.`;
        } else if (!target.supportedStepTypes.includes(step.type)) {
          warning = `Step ${index + 1} targets ${target.label}, but that destination does not support ${titleCaseLabel(step.type)}.`;
        }
      }

      if (warning) {
        warnings.push(warning);
      }

      return {
        ...step,
        targetOptions: supportedTargetOptions,
        pickModeActive: this.npcTargetPickState?.placementId === placement.id
          && this.npcTargetPickState?.stepIndex === index,
        warning
      };
    });

    return {
      mode: routine.mode,
      resumePolicy: routine.resumePolicy,
      steps,
      warnings
    };
  }

  buildNpcDebugEditorState(placement) {
    const debug = this.npcDebugState.get(placement?.id);
    if (!placement?.npc || !debug) {
      return null;
    }

    const targetPlacement = debug.targetPlacementId
      ? this.worldState.getPlacement(debug.targetPlacementId)
      : null;
    const targetItem = getBuilderItemById(targetPlacement?.itemId);
    const targetLabel = targetPlacement
      ? `${targetItem?.label ?? targetPlacement.itemId} (${targetPlacement.id})`
      : (debug.targetPlacementId || 'None');

    return {
      mode: debug.mode || 'routine',
      activity: debug.activity || 'idle',
      currentStep: debug.currentStepType
        ? `${titleCaseLabel(debug.currentStepType)} (${(debug.currentStepIndex ?? 0) + 1}/${Math.max(1, debug.stepCount ?? 1)})`
        : 'No active step',
      targetLabel,
      pathLabel: `${Math.min((debug.pathIndex ?? 0) + 1, Math.max(1, debug.pathNodeCount ?? 0))}/${Math.max(0, debug.pathNodeCount ?? 0)}`,
      pathNodeCount: debug.pathNodeCount ?? 0,
      idleRemainingMs: debug.idleRemainingMs ?? 0,
      calmRemainingMs: debug.calmRemainingMs ?? 0,
      hiddenRemainingMs: debug.hiddenRemainingMs ?? 0,
      lastRepathAgeMs: debug.lastRepathAt ? Math.max(0, Date.now() - debug.lastRepathAt) : 0,
      nextPathPoint: debug.nextPathPoint ?? null,
      steeringTarget: debug.steeringTarget ?? null,
      finalTarget: debug.finalTarget ?? null
    };
  }

  updateBuilderNpcEditor() {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc' || !placement.npc) {
      this.activeNpcEditorPlacementId = null;
      this.hud.setBuilderNpcEditor(null);
      return;
    }

    if (!this.activeNpcEditorPlacementId) {
      return;
    }

    const npcDraft = this.getNpcDraft(placement);
    const model = getNpcModelById(npcDraft?.modelId ?? placement.npc.modelId);
    const routine = this.buildNpcRoutineEditorState(placement);
    const combat = this.getNpcCombatDraft(placement);
    const debug = this.buildNpcDebugEditorState(placement);
    this.hud.setBuilderNpcEditor({
      id: placement.id,
      title: npcDraft?.name || model?.label || 'NPC',
      subtitle: `${model?.label ?? 'NPC'} at ${placement.position[0].toFixed(1)}, ${placement.position[1].toFixed(1)}`,
      modelId: npcDraft?.modelId ?? placement.npc.modelId,
      name: npcDraft?.name ?? placement.npc.name,
      prompt: npcDraft?.prompt ?? placement.npc.prompt,
      interactRadius: npcDraft?.interactRadius ?? placement.npc.interactRadius,
      speed: npcDraft?.speed ?? placement.npc.speed ?? 'slow',
      respawnDelayMs: npcDraft?.respawnDelayMs ?? placement.npc.respawnDelayMs ?? 0,
      deliveryQuestEnabled: (npcDraft?.deliveryQuestEnabled ?? placement.npc.deliveryQuestEnabled) === true,
      selectionActions: {
        moving: this.activeMovePlacementId === placement.id
      },
      models: NPC_MODEL_CATALOG.map((entry) => ({
        id: entry.id,
        label: entry.label,
        portraitSrc: entry.portraitFileName
          ? `/assets/mixamo/portraits/${entry.portraitFileName}`
          : ''
      })),
      routine,
      warnings: routine.warnings,
      stepTypes: listNpcStepTypes().map((stepType) => ({
        id: stepType,
        label: titleCaseLabel(stepType)
      })),
      newStepType: listNpcStepTypes()[0],
      combat: {
        archetype: combat.archetype,
        aggroRadius: Number(combat.aggroRadius?.toFixed?.(2) ?? combat.aggroRadius ?? 0),
        leashRadius: Number(combat.leashRadius?.toFixed?.(2) ?? combat.leashRadius ?? 0),
        weaponId: combat.weaponId || ''
      },
      combatArchetypes: listNpcCombatArchetypes().map((archetype) => ({
        id: archetype,
        label: titleCaseLabel(archetype)
      })),
      weaponOptions: [
        { id: '', label: 'Unarmed' },
        { id: WEAPON_IDS.pistol, label: 'Pistol' }
      ],
      debug,
      pickingTarget: this.npcTargetPickState?.placementId === placement.id
        ? {
            stepIndex: this.npcTargetPickState.stepIndex,
            stepNumber: this.npcTargetPickState.stepIndex + 1,
            stepType: this.npcTargetPickState.stepType
          }
        : null
    });
  }

  isNpcInstanceEditorOpen() {
    return Boolean(this.activeNpcEditorPlacementId);
  }

  isBuildingPlacement(placement) {
    if (!placement || placement.layer !== 'tile') {
      return false;
    }

    const item = getBuilderItemById(placement.itemId);
    return Boolean(item?.groupId === 'lots' && item.underlayTileId);
  }

  isBuildingInstanceEditorOpen() {
    return Boolean(this.activeBuildingEditorPlacementId);
  }

  getBuildingInteractableDraft(placement) {
    const item = getBuilderItemById(placement?.itemId);
    return {
      label: placement?.interactable?.label ?? item?.label ?? 'Building',
      prompt: placement?.interactable?.prompt ?? '',
      actionText: placement?.interactable?.actionText ?? '',
      radius: placement?.interactable?.radius ?? 4,
      distance: placement?.interactable?.distance ?? BUILDER_TILE_SIZE * 0.44
    };
  }

  buildPlacementInteractable(placement, overrides = {}) {
    const draft = {
      ...this.getBuildingInteractableDraft(placement),
      ...overrides
    };
    const label = String(draft.label ?? '').trim();
    const prompt = String(draft.prompt ?? '').trim();
    const actionText = String(draft.actionText ?? '').trim();

    return {
      ...(label ? { label } : {}),
      ...(prompt ? { prompt } : {}),
      ...(actionText ? { actionText } : {}),
      radius: isFiniteNumber(draft.radius) ? THREE.MathUtils.clamp(draft.radius, 1.5, 12) : 4,
      distance: isFiniteNumber(draft.distance) ? THREE.MathUtils.clamp(draft.distance, 1, BUILDER_TILE_SIZE * 2) : BUILDER_TILE_SIZE * 0.44
    };
  }

  updateBuildingInstanceEditor() {
    const placement = this.getSelectedPlacement();
    if (!placement || !this.isBuildingPlacement(placement)) {
      this.activeBuildingEditorPlacementId = null;
      this.hud.setBuilderBuildingEditor(null);
      return;
    }

    if (!this.activeBuildingEditorPlacementId) {
      return;
    }

    const item = getBuilderItemById(placement.itemId);
    const draft = this.getBuildingInteractableDraft(placement);
    this.hud.setBuilderBuildingEditor({
      id: placement.id,
      title: draft.label || item?.label || 'Building',
      subtitle: `${item?.label ?? 'Building'} at cell ${placement.cellX}, ${placement.cellZ}`,
      label: draft.label,
      prompt: draft.prompt,
      actionText: draft.actionText,
      radius: Number(draft.radius.toFixed(2)),
      distance: Number(draft.distance.toFixed(2))
    });
  }

  openBuildingInstanceEditor() {
    const placement = this.getSelectedPlacement();
    if (!placement || !this.isBuildingPlacement(placement)) {
      this.closeBuildingInstanceEditor();
      return;
    }

    const previousPlacementId = this.activeBuildingEditorPlacementId;
    this.activeBuildingEditorPlacementId = placement.id;
    if (previousPlacementId && previousPlacementId !== placement.id) {
      void this.flushBuildingUpdate(previousPlacementId);
    }
    this.previewRoot.visible = false;
    this.updateBuildingInstanceEditor();
    this.updateSelectionVisual();
    this.reportBuilderPresence(true);
  }

  closeBuildingInstanceEditor() {
    const placementId = this.activeBuildingEditorPlacementId;
    this.activeBuildingEditorPlacementId = null;
    this.hud.setBuilderBuildingEditor(null);
    if (placementId) {
      void this.flushBuildingUpdate(placementId);
    }
    if (this.state.enabled) {
      this.resolveHoverState();
      void this.syncPreviewToState(true);
      this.updatePreviewTransform();
    }
    this.updateSelectionVisual();
    this.reportBuilderPresence(true);
  }

  openNpcInstanceEditor() {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc' || !placement.npc) {
      this.closeNpcInstanceEditor();
      return;
    }

    const previousPlacementId = this.activeNpcEditorPlacementId;
    this.activeNpcEditorPlacementId = placement.id;
    if (previousPlacementId && previousPlacementId !== placement.id) {
      void this.flushNpcUpdate(previousPlacementId);
    }
    this.previewRoot.visible = false;
    this.updateBuilderNpcEditor();
    this.updateSelectionVisual();
    this.reportBuilderPresence(true);
  }

  closeNpcInstanceEditor() {
    this.cancelNpcRoutineTargetPickMode();
    const placementId = this.activeNpcEditorPlacementId;
    this.activeNpcEditorPlacementId = null;
    this.hud.setBuilderNpcEditor(null);
    if (placementId) {
      void this.flushNpcUpdate(placementId);
    }
    if (this.state.enabled) {
      this.resolveHoverState();
      void this.syncPreviewToState(true);
      this.updatePreviewTransform();
    }
    this.updateSelectionVisual();
    this.reportBuilderPresence(true);
  }

  queueBuildingUpdate(placementId, changes = {}) {
    const current = this.pendingBuildingUpdateByPlacementId.get(placementId) ?? {};
    this.pendingBuildingUpdateByPlacementId.set(placementId, {
      ...current,
      ...changes
    });

    window.clearTimeout(this.pendingBuildingUpdateTimeouts.get(placementId));
    const timeoutId = window.setTimeout(() => {
      void this.flushBuildingUpdate(placementId);
    }, 150);
    this.pendingBuildingUpdateTimeouts.set(placementId, timeoutId);
  }

  clearPendingBuildingUpdate(placementId) {
    this.pendingBuildingUpdateByPlacementId.delete(placementId);
    window.clearTimeout(this.pendingBuildingUpdateTimeouts.get(placementId));
    this.pendingBuildingUpdateTimeouts.delete(placementId);
  }

  async flushBuildingUpdate(placementId) {
    const changes = this.pendingBuildingUpdateByPlacementId.get(placementId);
    this.pendingBuildingUpdateByPlacementId.delete(placementId);
    window.clearTimeout(this.pendingBuildingUpdateTimeouts.get(placementId));
    this.pendingBuildingUpdateTimeouts.delete(placementId);

    if (!changes) {
      return;
    }

    const placement = this.worldState.getPlacement(placementId);
    if (!placement || !this.isBuildingPlacement(placement)) {
      return;
    }

    const interactable = this.buildPlacementInteractable(placement, changes);
    const result = await this.worldEditAdapter.edit({
      op: 'updatePlacementInteractable',
      placementId,
      interactable
    });
    if (!result?.ok) {
      this.hud.showToast(result?.error ?? 'Could not update building data.');
      return;
    }

    if (result.appliedImmediately) {
      this.updateSelectionVisual();
      this.updateBuildingInstanceEditor();
      this.notifyLayoutChanged();
    }
  }

  queueNpcUpdate(placementId, changes = {}) {
    const current = this.pendingNpcUpdateByPlacementId.get(placementId) ?? {};
    this.pendingNpcUpdateByPlacementId.set(placementId, {
      ...current,
      ...changes
    });

    window.clearTimeout(this.pendingNpcUpdateTimeouts.get(placementId));
    const timeoutId = window.setTimeout(() => {
      void this.flushNpcUpdate(placementId);
    }, 150);
    this.pendingNpcUpdateTimeouts.set(placementId, timeoutId);
    this.updateBuilderNpcEditor();
    this.syncNpcDebugTools();
  }

  async flushNpcUpdate(placementId) {
    const changes = this.pendingNpcUpdateByPlacementId.get(placementId);
    this.pendingNpcUpdateByPlacementId.delete(placementId);
    window.clearTimeout(this.pendingNpcUpdateTimeouts.get(placementId));
    this.pendingNpcUpdateTimeouts.delete(placementId);

    if (!changes) {
      return;
    }

    const result = await this.worldEditAdapter.edit({
      op: 'updateNpc',
      placementId,
      changes
    });
    if (!result?.ok) {
      this.hud.showToast(result?.error ?? 'Could not update NPC.');
      return;
    }

    if (result.appliedImmediately) {
      this.updateSelectionVisual();
      this.updateBuilderNpcEditor();
      this.notifyLayoutChanged();
    }
  }

  clearPendingNpcUpdate(placementId) {
    this.pendingNpcUpdateByPlacementId.delete(placementId);
    window.clearTimeout(this.pendingNpcUpdateTimeouts.get(placementId));
    this.pendingNpcUpdateTimeouts.delete(placementId);
  }

  async updateSelectedBuildingInstance(changes = {}) {
    const placement = this.getSelectedPlacement();
    if (!placement || !this.isBuildingPlacement(placement)) {
      return;
    }

    const nextChanges = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined)
    );
    if (!Object.keys(nextChanges).length) {
      return;
    }

    this.queueBuildingUpdate(placement.id, nextChanges);
  }

  async updateSelectedNpc(changes = {}) {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc') {
      return;
    }

    const nextChanges = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined)
    );
    if (!Object.keys(nextChanges).length) {
      return;
    }

    this.queueNpcUpdate(placement.id, nextChanges);
  }

  async addSelectedNpcRoutineStep(stepType) {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc' || !placement.npc) {
      return;
    }

    const routine = this.getNpcRoutineDraft(placement);
    const nextStep = createDefaultNpcRoutineStep(stepType);
    await this.updateSelectedNpc({
      routine: {
        ...routine,
        steps: [...(routine.steps ?? []), nextStep]
      }
    });
  }

  async removeSelectedNpcRoutineStep(stepIndex) {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc' || !placement.npc) {
      return;
    }

    const routine = this.getNpcRoutineDraft(placement);
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= (routine.steps?.length ?? 0)) {
      return;
    }

    await this.updateSelectedNpc({
      routine: {
        ...routine,
        steps: routine.steps.filter((_, index) => index !== stepIndex)
      }
    });
  }

  async updateSelectedNpcRoutineStep(stepIndex, field, value) {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc' || !placement.npc) {
      return;
    }

    const routine = this.getNpcRoutineDraft(placement);
    const steps = [...(routine.steps ?? [])];
    const currentStep = steps[stepIndex];
    if (!currentStep || !field) {
      return;
    }

    let nextStep = { ...currentStep };
    if (field === 'type') {
      nextStep = {
        ...createDefaultNpcRoutineStep(String(value || currentStep.type)),
        targetPlacementId: currentStep.targetPlacementId || ''
      };
    } else if (field === 'targetPlacementId') {
      nextStep.targetPlacementId = String(value ?? '').trim();
    } else if (field === 'durationMs' || field === 'hiddenDurationMs') {
      nextStep[field] = Number.isFinite(value) ? Number(value) : currentStep[field];
    } else if (field === 'radius') {
      nextStep.radius = Number.isFinite(value) ? Number(value) : currentStep.radius;
    } else {
      return;
    }

    steps[stepIndex] = nextStep;
    await this.updateSelectedNpc({
      routine: {
        ...routine,
        steps
      }
    });
  }

  async updateSelectedNpcCombat(field, value) {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc' || !placement.npc || !field) {
      return;
    }

    const combat = this.getNpcCombatDraft(placement);
    const nextCombat = mergeNestedDraft(combat, {
      [field]: value
    });
    await this.updateSelectedNpc({ combat: nextCombat });
  }

  async changeSelectedNpcModel(modelId) {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc') {
      return;
    }

    if (!getNpcModelById(modelId)) {
      return;
    }

    await this.flushNpcUpdate(placement.id);
    const result = await this.worldEditAdapter.edit({
      op: 'updateNpc',
      placementId: placement.id,
      changes: { modelId }
    });
    if (!result?.ok) {
      this.hud.showToast(result?.error ?? 'Could not change NPC model.');
      return;
    }

    if (result.appliedImmediately) {
      this.updateSelectionVisual();
      this.updateBuilderNpcEditor();
      this.notifyLayoutChanged();
    }
  }

  notifyLayoutChanged() {
    this.onLayoutChanged(this.worldState.serializeLayout());
  }
}
