import * as THREE from 'three';
import { getNpcModelById, getNpcModelByItemId, NPC_MODEL_CATALOG } from '../npc/npcCatalog.js';
import { prepareNpcRenderObject } from '../npc/npcRenderUtils.js';
import {
  createDefaultNpcCombat,
  createDefaultNpcRoutine,
  createDefaultNpcRoutineStep,
  NPC_COMBAT_ARCHETYPES,
  NPC_DEFAULT_INTERACT_RADIUS,
  NPC_DEFAULT_LAW_RADIUS,
  getNpcLawRadius,
  isPoliceOfficerNpc,
  listNpcCombatArchetypes,
  listNpcStepTypes
} from '../npc/npcBehavior.js';
import { collectNpcTargetOptions, resolveNpcTargetOption } from '../npc/npcTargeting.js';
import { getTileCenterWorldPosition, getTileFootprintWorldSize } from '../shared/tileFootprint.js';
import {
  normalizeRotationEighthTurns,
  quantizeNumber,
  quantizeRotation,
  rotationEighthTurnsToRadians as toPropRotationY,
  rotationQuarterTurnsToRadians as toRotationY,
  rotationRadiansToQuarterTurns as toQuarterTurns
} from '../shared/numberMath.js';
import {
  PROP_PLACEMENT_SCALE_MAX,
  PROP_PLACEMENT_SCALE_MIN,
  PROP_PLACEMENT_SCALE_STEP,
  getDefaultPropPlacementScale,
  getPlacementScale,
  normalizePropPlacementScale
} from '../shared/placementScale.js';
import { createPassiveTrafficRouteId } from '../shared/passiveTrafficRoutes.js';
import { WEAPON_IDS } from '../shared/combatConstants.js';
import {
  MISSION_SEQUENCE_SECTIONS,
  appendMissionSequencePromptEntry,
  getMissionSequenceViewModel,
  moveMissionSequenceEntry,
  updateMissionSequenceEntry
} from '../shared/missions.js';
import { normalizeNpcVoice } from '../shared/npcVoice.js';
import {
  WORLD_GRID_DIVISIONS,
  WORLD_GRID_SIZE
} from '../shared/worldConstants.js';
import { BuilderPreviewRenderer } from '../ui/BuilderPreviewRenderer.js';
import { BUILDER_CATEGORIES, BUILDER_TILE_SIZE, getBuilderItemById } from './builderCatalog.js';
import { findNearestAdjacentPropSnapPoint } from './builderPropSnap.js';
import { createWorldEditAdapter } from './createWorldEditAdapter.js';
import { instantiateItemVisual, prepareItemVisual } from './itemVisuals.js';
import {
  PASSIVE_TRAFFIC_CAR_ITEM_IDS,
  buildPassiveTrafficRoadGraph,
  findPassiveTrafficPath
} from './passiveTraffic.js';
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
const BUILDER_MISSION_SEQUENCER_CATEGORY = Object.freeze({
  id: 'mission-sequencer',
  label: 'Mission Sequencer',
  items: []
});
const BUILDER_TRAFFIC_ROUTES_CATEGORY = Object.freeze({
  id: 'traffic-routes',
  label: 'Traffic Routes',
  items: []
});
const POLICE_DEFAULT_MODEL_IDS = new Set(['policeOfficer', 'swat']);
const BUILDER_TAB_CATEGORIES = Object.freeze([
  ...BUILDER_CATEGORIES,
  BUILDER_TRAFFIC_ROUTES_CATEGORY,
  BUILDER_MISSION_SEQUENCER_CATEGORY
]);
const TRAFFIC_ROUTE_MAP_WIDTH = 560;
const TRAFFIC_ROUTE_MAP_HEIGHT = 560;
const TRAFFIC_ROUTE_COLORS = Object.freeze([
  '#f2c871',
  '#62e0ae',
  '#68d9ff',
  '#ff8e72',
  '#c99cff',
  '#f06aa6'
]);
const EMPTY_MAP = new Map();

function clonePreviewMaterial(material, opacity = 0.86) {
  const next = material.clone();
  next.transparent = true;
  next.opacity = opacity;
  next.depthWrite = false;
  next.depthTest = false;

  if ('emissive' in next) {
    next.emissive.lerp(PREVIEW_COLOR, 0.75);
    next.emissiveIntensity = 1;
  } else if ('color' in next) {
    next.color.lerp(PREVIEW_COLOR, 0.38);
  }

  return next;
}

function applyPreviewMaterial(root, opacity) {
  root.traverse((node) => {
    if (!node.isMesh || !node.material) {
      return;
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const clonedMaterials = [];
    for (const material of materials) {
      clonedMaterials.push(clonePreviewMaterial(material, opacity));
    }
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

function applyPreviewObjectScale(object, scale = 1) {
  if (!object) {
    return;
  }

  const baseScale = object.userData.builderBaseScale ?? object.scale;
  object.scale.copy(baseScale).multiplyScalar(scale);
}

function snapToCell(worldPosition, target = { x: 0, z: 0 }) {
  target.x = Math.round(worldPosition.x / BUILDER_TILE_SIZE);
  target.z = Math.round(worldPosition.z / BUILDER_TILE_SIZE);
  return target;
}

function screenClamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return (min + max) * 0.5;
  }
  return Math.min(max, Math.max(min, value));
}

function toGroundProbe(x, z) {
  return new THREE.Vector3(x, 0, z);
}

function titleCaseLabel(value = '') {
  const normalized = String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ');
  const parts = normalized.split(/\s+/);
  let label = '';
  for (const part of parts) {
    if (!part) {
      continue;
    }
    label += label ? ` ${part.charAt(0).toUpperCase()}${part.slice(1)}` : `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
  }
  return label;
}

function mergeNestedDraft(current, updates) {
  return {
    ...(current ?? {}),
    ...(updates ?? {})
  };
}

function collectDefinedChanges(changes = {}) {
  const output = {};
  let hasChanges = false;
  for (const key in changes) {
    if (!Object.hasOwn(changes, key) || changes[key] === undefined) {
      continue;
    }
    output[key] = changes[key];
    hasChanges = true;
  }
  return hasChanges ? output : null;
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

  const output = [];
  for (const section of sections) {
    output.push({
      ...section,
      count: section.cards.length
    });
  }
  return output;
}

function getBuilderTabCategoryById(categoryId) {
  for (const entry of BUILDER_TAB_CATEGORIES) {
    if (entry.id === categoryId) {
      return entry;
    }
  }
  return null;
}

function isTrafficRoutesCategoryId(categoryId = '') {
  return categoryId === BUILDER_TRAFFIC_ROUTES_CATEGORY.id;
}

function getTrafficRouteCarColor(itemId = '', index = 0) {
  const carIndex = PASSIVE_TRAFFIC_CAR_ITEM_IDS.indexOf(itemId);
  const colorIndex = carIndex >= 0 ? carIndex : index;
  return TRAFFIC_ROUTE_COLORS[((colorIndex % TRAFFIC_ROUTE_COLORS.length) + TRAFFIC_ROUTE_COLORS.length) % TRAFFIC_ROUTE_COLORS.length];
}

function getTrafficRouteMapDimensions(image = null) {
  const imageWidth = Number(image?.width);
  const imageHeight = Number(image?.height);
  if (Number.isFinite(imageWidth) && imageWidth > 0 && Number.isFinite(imageHeight) && imageHeight > 0) {
    const ratio = imageWidth / imageHeight;
    if (ratio >= 1) {
      return {
        width: TRAFFIC_ROUTE_MAP_WIDTH,
        height: Math.max(1, Math.round(TRAFFIC_ROUTE_MAP_WIDTH / ratio))
      };
    }

    return {
      width: Math.max(1, Math.round(TRAFFIC_ROUTE_MAP_HEIGHT * ratio)),
      height: TRAFFIC_ROUTE_MAP_HEIGHT
    };
  }

  return {
    width: TRAFFIC_ROUTE_MAP_WIDTH,
    height: TRAFFIC_ROUTE_MAP_HEIGHT
  };
}

function createTrafficRoutePointFromNode(node) {
  return node
    ? {
        cellX: node.cellX,
        cellZ: node.cellZ,
        x: quantizeNumber(node.x),
        z: quantizeNumber(node.z)
      }
    : null;
}

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

function getPlacementRotationY(placement) {
  const rotationY = Number(placement?.rotationY);
  return Number.isFinite(rotationY)
    ? rotationY
    : toRotationY(placement?.rotationQuarterTurns ?? 0);
}

function createDefaultActiveGroupIds() {
  const groupIds = {};
  for (const category of BUILDER_CATEGORIES) {
    groupIds[category.id] = 'all';
  }
  return groupIds;
}

function createDefaultEditorState() {
  return {
    enabled: false,
    focus: new THREE.Vector3(0, 0, 0),
    zoom: 1,
    pointer: new THREE.Vector2(2, 2),
    activeCategoryId: BUILDER_CATEGORIES[0].id,
    activeGroupIdByCategory: createDefaultActiveGroupIds(),
    activeItemIndex: 0,
    missionSequencerActiveTab: MISSION_SEQUENCE_SECTIONS.main,
    missionSequencerPrompt: '',
    activeTrafficRouteCarItemId: PASSIVE_TRAFFIC_CAR_ITEM_IDS[0] ?? '',
    activeTrafficRouteId: '',
    trafficRouteDraft: null,
    trafficRoutePreview: null,
    trafficRouteDrawing: false,
    trafficRoutePendingRemoveNodeIndex: null,
    rotationQuarterTurns: 0,
    propRotationEighthTurns: 0,
    propScale: 1,
    hover: {
      point: null,
      cell: null,
      placementId: null
    },
    modifiers: {
      snap: false,
      identify: false
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
  constructor({
    scene,
    camera,
    domElement,
    library,
    hud,
    onToggleBuildMode,
    onLayoutChanged,
    worldTransport,
    getWorldMapImage,
    isWorldMapImageFresh,
    requestWorldMapImage,
    getPassiveTrafficPlayerCollisionTarget,
    onPassiveTrafficPlayerCollision
  }) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.library = library;
    this.hud = hud;
    this.onToggleBuildMode = onToggleBuildMode ?? (() => {});
    this.onLayoutChanged = onLayoutChanged ?? (() => {});
    this.worldTransport = worldTransport ?? null;
    this.getWorldMapImage = getWorldMapImage ?? (() => null);
    this.isWorldMapImageFresh = isWorldMapImageFresh ?? (() => true);
    this.requestWorldMapImage = requestWorldMapImage ?? null;
    this.canEdit = false;
    this.visible = true;

    this.state = createDefaultEditorState();
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hoverHit = new THREE.Vector3();
    this.snapHoverHit = new THREE.Vector3();
    this.cameraOffsetScratch = new THREE.Vector3();
    this.cameraTargetScratch = new THREE.Vector3();
    this.selectionCenterScratch = new THREE.Vector3();
    this.selectionSizeScratch = new THREE.Vector3();
    this.selectionAnchorScratch = new THREE.Vector3();
    this.hoverCell = { x: 0, z: 0 };
    this.previewLoadToken = 0;
    this.builderPreviewCategoryId = null;
    this.builderPreviewGroupId = null;
    this.builderPreviewGeneration = 0;
    this.pendingNpcUpdateByPlacementId = new Map();
    this.pendingNpcUpdateTimeouts = new Map();
    this.pendingBuildingUpdateByPlacementId = new Map();
    this.pendingBuildingUpdateTimeouts = new Map();
    this.pendingPropScaleByPlacementId = new Map();
    this.pendingPropScaleTimeouts = new Map();
    this.npcTargetPickState = null;
    this.npcTargetOptionsRevision = null;
    this.npcTargetOptionsCache = [];
    this.npcTargetOptionMapRevision = null;
    this.npcTargetOptionMapCache = new Map();
    this.activeMovePlacementId = null;
    this.awaitingMovedPlacementIds = new Set();
    this.builderInteriorPreviewPlacementIds = new Set();
    this.builderInteriorPreviewNextPlacementIds = new Set();
    this.builderInteriorPreviewIdsToClear = [];
    this.inlineShellEntries = [];
    this.activeNpcEditorPlacementId = null;
    this.activeBuildingEditorPlacementId = null;
    this.worldState = new WorldState();
    this.npcDebugState = new Map();
    this.worldRenderer = new WorldRenderer({
      scene,
      camera,
      library,
      getPassiveTrafficPlayerCollisionTarget,
      onPassiveTrafficPlayerCollision
    });
    this.worldEditAdapter = createWorldEditAdapter({
      transport: this.worldTransport,
      worldState: this.worldState,
      worldRenderer: this.worldRenderer
    });
    this.remoteBuilderRenderer = new RemoteBuilderRenderer({ scene, library, worldRenderer: this.worldRenderer });
    this.builderPreviewRenderer = null;
    this.builderPreviewRendererPromise = null;
    this.trafficRouteMapRequest = null;
    this.trafficRouteMapLastRefreshAt = 0;

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
      onPropSizeChange: (value) => void this.updatePropSize(value),
      onRotateSelection: () => this.rotateSelectedPlacement(),
      onMoveSelection: () => this.startMovingSelectedPlacement(),
      onDeleteSelection: () => this.deleteSelectedPlacement(),
      onConfirmSelection: () => this.clearSelection(),
      onNpcNameChange: (value) => void this.updateSelectedNpc({ name: value }),
      onNpcPromptChange: (value) => void this.updateSelectedNpc({ prompt: value }),
      onNpcRadiusChange: (value) => void this.updateSelectedNpc({
        interactRadius: Number.isFinite(value) ? THREE.MathUtils.clamp(value, 1.5, 12) : undefined
      }),
      onNpcPoliceOfficerChange: (enabled) => void this.updateSelectedNpcPoliceOfficer(enabled),
      onNpcLawRadiusChange: (value) => void this.updateSelectedNpc({
        lawRadius: Number.isFinite(value) ? THREE.MathUtils.clamp(value, 4, 120) : undefined
      }),
      onNpcSpeedChange: (value) => void this.updateSelectedNpc({ speed: value }),
      onNpcRespawnDelayChange: (value) => void this.updateSelectedNpc({
        respawnDelayMs: Number.isFinite(value) ? THREE.MathUtils.clamp(Math.round(value), 0, 600000) : undefined
      }),
      onNpcDeliveryQuestChange: (enabled) => void this.updateSelectedNpc({
        deliveryQuestEnabled: enabled === true
      }),
      onNpcGymCheckInChange: (enabled) => void this.updateSelectedNpc({
        gymCheckInEnabled: enabled === true
      }),
      onNpcRentCollectorChange: (enabled) => void this.updateSelectedNpc({
        rentCollectorEnabled: enabled === true
      }),
      onNpcStockMarketChange: (enabled) => void this.updateSelectedNpc({
        stockMarketEnabled: enabled === true
      }),
      onNpcBartenderChange: (enabled) => void this.updateSelectedNpc({
        bartenderEnabled: enabled === true
      }),
      onNpcPawnShopOwnerChange: (enabled) => void this.updateSelectedNpc({
        pawnShopOwnerEnabled: enabled === true
      }),
      onNpcCarDealerChange: (enabled) => void this.updateSelectedNpc({
        carDealerEnabled: enabled === true
      }),
      onNpcMarthaChange: (enabled) => void this.updateSelectedNpc({
        marthaEnabled: enabled === true
      }),
      onNpcBlackjackDealerChange: (enabled) => void this.updateSelectedNpc({
        blackjackDealerEnabled: enabled === true
      }),
      onNpcSchoolMicrogameChange: (enabled) => void this.updateSelectedNpc({
        schoolMicrogameEnabled: enabled === true
      }),
      onNpcModelChange: (modelId) => void this.changeSelectedNpcModel(modelId),
      onNpcModelVoiceChange: (voice) => void this.updateSelectedNpcModelVoice(voice),
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
      }),
      onMissionSequenceReorder: (fromIndex, toIndex) => void this.reorderMissionSequence(fromIndex, toIndex),
      onMissionSequenceRuleChange: (missionId, updates) => void this.updateMissionSequenceRule(missionId, updates),
      onMissionSequenceTextChange: (missionId, text) => void this.updateMissionSequenceText(missionId, text),
      onMissionSequencerTabChange: (tab) => this.setMissionSequencerActiveTab(tab),
      onMissionSequencePromptInput: (value) => this.setMissionSequencerPrompt(value),
      onMissionSequencePromptSubmit: (value) => void this.addMissionSequencePrompt(value),
      onTrafficRouteCarDrop: (itemId, point) => this.beginTrafficRouteFromCar(itemId, point),
      onTrafficRouteDrawStart: (point) => this.beginTrafficRouteDrawing(point),
      onTrafficRouteDrawMove: (point) => this.continueTrafficRouteDrawing(point),
      onTrafficRouteDrawEnd: (point) => void this.finishTrafficRouteDrawing(point),
      onTrafficRouteClearDraft: () => this.clearTrafficRouteDraft(),
      onTrafficRouteDelete: (routeId) => void this.deletePassiveTrafficRoute(routeId),
      onTrafficRouteSelectCar: (itemId) => this.selectTrafficRouteCar(itemId),
      onTrafficRouteAddCar: (itemId) => this.addTrafficRouteCar(itemId),
      onTrafficRouteSelectRoute: (routeId) => this.selectTrafficRoute(routeId)
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
    return getBuilderTabCategoryById(this.state.activeCategoryId) ?? BUILDER_CATEGORIES[0];
  }

  get activeItem() {
    return this.activeCategory.items[this.state.activeItemIndex] ?? null;
  }

  get canEditHoveredTiles() {
    return this.state.activeCategoryId === 'tiles';
  }

  get activeGroupId() {
    return this.state.activeGroupIdByCategory[this.state.activeCategoryId] ?? 'all';
  }

  getPropScaleDraft(placement = null) {
    if (!placement || placement.layer !== 'prop') {
      return this.state.propScale;
    }

    return this.pendingPropScaleByPlacementId.get(placement.id)
      ?? getPlacementScale(placement);
  }

  isIdentifyModifierActive() {
    return this.state.modifiers.identify === true;
  }

  isSnapModifierActive() {
    return this.state.modifiers.snap === true && !this.isIdentifyModifierActive();
  }

  syncModifierState(input) {
    this.state.modifiers.snap = Boolean(input?.isPressed?.('ShiftLeft') || input?.isPressed?.('ShiftRight'));
    this.state.modifiers.identify = Boolean(input?.isPressed?.('CapsLock'));
  }

  syncPointerModifierState(event) {
    this.state.modifiers.snap = Boolean(event?.shiftKey);
  }

  shouldPlaceActiveItemOverHoveredPlacement(hoveredPlacement = null) {
    return Boolean(hoveredPlacement && this.activeItem?.layer === 'prop' && !this.isIdentifyModifierActive());
  }

  shouldPreviewHoveredPlacement(hoveredPlacement = null) {
    return Boolean(hoveredPlacement && !this.shouldPlaceActiveItemOverHoveredPlacement(hoveredPlacement));
  }

  getVisibleCategoryEntries(categoryId = this.state.activeCategoryId) {
    const category = getBuilderTabCategoryById(categoryId) ?? BUILDER_CATEGORIES[0];
    const activeGroupId = this.state.activeGroupIdByCategory[category.id] ?? 'all';
    const entries = [];
    for (let index = 0; index < category.items.length; index += 1) {
      const item = category.items[index];
      if (activeGroupId === 'all' || item.groupId === activeGroupId) {
        entries.push({ item, index });
      }
    }
    return entries;
  }

  getTrafficRouteGraph() {
    return buildPassiveTrafficRoadGraph(this.worldState.getPlacements());
  }

  getTrafficRouteMapBounds(graph = this.getTrafficRouteGraph(), image = this.getWorldMapImage?.()) {
    const imageBounds = image?.bounds ?? null;
    if (
      Number.isFinite(Number(imageBounds?.minX))
      && Number.isFinite(Number(imageBounds?.maxX))
      && Number.isFinite(Number(imageBounds?.minZ))
      && Number.isFinite(Number(imageBounds?.maxZ))
      && Number(imageBounds.maxX) > Number(imageBounds.minX)
      && Number(imageBounds.maxZ) > Number(imageBounds.minZ)
    ) {
      return {
        minX: Number(imageBounds.minX),
        maxX: Number(imageBounds.maxX),
        minZ: Number(imageBounds.minZ),
        maxZ: Number(imageBounds.maxZ)
      };
    }

    const nodes = graph?.activeNodes?.length ? graph.activeNodes : graph?.nodes ?? [];
    if (!nodes.length) {
      return {
        minX: -BUILDER_TILE_SIZE * 6,
        maxX: BUILDER_TILE_SIZE * 6,
        minZ: -BUILDER_TILE_SIZE * 6,
        maxZ: BUILDER_TILE_SIZE * 6
      };
    }

    const padding = BUILDER_TILE_SIZE * 1.25;
    return {
      minX: Math.min(...nodes.map((node) => node.x)) - padding,
      maxX: Math.max(...nodes.map((node) => node.x)) + padding,
      minZ: Math.min(...nodes.map((node) => node.z)) - padding,
      maxZ: Math.max(...nodes.map((node) => node.z)) + padding
    };
  }

  getTrafficRoutesViewModel() {
    const graph = this.getTrafficRouteGraph();
    const currentImage = this.getWorldMapImage?.() ?? null;
    const image = currentImage && this.isWorldMapImageFresh(currentImage) ? currentImage : null;
    const dimensions = getTrafficRouteMapDimensions(image);
    const routes = this.worldState.getPassiveTrafficRoutes();
    const routeById = new Map(routes.map((route) => [route.id, route]));
    const draftItemId = PASSIVE_TRAFFIC_CAR_ITEM_IDS.includes(this.state.trafficRouteDraft?.itemId)
      ? this.state.trafficRouteDraft.itemId
      : '';
    const draftRouteId = String(this.state.trafficRouteDraft?.id ?? '');
    const currentActiveRouteId = String(this.state.activeTrafficRouteId ?? '');
    let selectedRoute = routeById.get(currentActiveRouteId) ?? null;
    if (!draftRouteId && !currentActiveRouteId && routes.length) {
      selectedRoute = routes.find((route) => route.itemId === this.state.activeTrafficRouteCarItemId) ?? routes[0] ?? null;
    }
    const activeRouteId = draftRouteId || selectedRoute?.id || currentActiveRouteId;
    const activeItemId = draftItemId || selectedRoute?.itemId || (PASSIVE_TRAFFIC_CAR_ITEM_IDS.includes(this.state.activeTrafficRouteCarItemId)
      ? this.state.activeTrafficRouteCarItemId
      : (PASSIVE_TRAFFIC_CAR_ITEM_IDS[0] ?? ''));
    this.state.activeTrafficRouteCarItemId = activeItemId;
    this.state.activeTrafficRouteId = activeRouteId;

    const routeTypeCounts = new Map();
    const routeTypeSeen = new Map();
    for (const route of routes) {
      routeTypeCounts.set(route.itemId, (routeTypeCounts.get(route.itemId) ?? 0) + 1);
    }

    return {
      width: dimensions.width,
      height: dimensions.height,
      bounds: this.getTrafficRouteMapBounds(graph, image),
      image,
      roads: graph.activeNodes.map((node) => ({
        id: node.key,
        x: node.x,
        z: node.z,
        cellX: node.cellX,
        cellZ: node.cellZ
      })),
      cars: PASSIVE_TRAFFIC_CAR_ITEM_IDS.map((itemId, index) => {
        const item = getBuilderItemById(itemId);
        const routeCount = routeTypeCounts.get(itemId) ?? 0;
        return {
          itemId,
          label: item?.label ?? titleCaseLabel(itemId),
          previewId: itemId,
          color: getTrafficRouteCarColor(itemId, index),
          active: itemId === activeItemId && !routeById.has(activeRouteId),
          routeCount
        };
      }),
      routes: routes.map((route, index) => {
        const item = getBuilderItemById(route.itemId);
        const baseLabel = route.label || item?.label || titleCaseLabel(route.itemId);
        const instanceNumber = (routeTypeSeen.get(route.itemId) ?? 0) + 1;
        routeTypeSeen.set(route.itemId, instanceNumber);
        return {
          ...route,
          routeId: route.id,
          label: routeTypeCounts.get(route.itemId) > 1 ? `${baseLabel} ${instanceNumber}` : baseLabel,
          baseLabel,
          previewId: route.itemId,
          color: getTrafficRouteCarColor(route.itemId, index),
          active: route.id === activeRouteId,
          pointCount: route.points?.length ?? 0
        };
      }),
      draft: this.state.trafficRouteDraft
        ? {
            ...this.state.trafficRouteDraft,
            waypoints: this.getTrafficRouteDraftWaypointPoints(this.state.trafficRouteDraft, graph),
            color: getTrafficRouteCarColor(this.state.trafficRouteDraft.itemId),
            drawing: this.state.trafficRouteDrawing
          }
        : null,
      preview: this.state.trafficRoutePreview
        ? {
            ...this.state.trafficRoutePreview,
            color: getTrafficRouteCarColor(this.state.trafficRouteDraft?.itemId ?? activeItemId),
            drawing: this.state.trafficRouteDrawing
          }
        : null,
      activeItemId,
      activeRouteId,
      roadCount: graph.activeNodeIndices.length
    };
  }

  getBuilderViewModel() {
    const activeCategory = this.activeCategory;
    const visibleEntries = [];
    const categoryEntries = this.getVisibleCategoryEntries();
    for (let visibleIndex = 0; visibleIndex < categoryEntries.length; visibleIndex += 1) {
      visibleEntries.push({
        ...categoryEntries[visibleIndex],
        visibleIndex
      });
    }
    const missionSequenceRows = getMissionSequenceViewModel(this.worldState.getMissionSequence());
    const tabs = [];
    for (const category of BUILDER_TAB_CATEGORIES) {
      tabs.push({
        id: category.id,
        label: category.label,
        count: category.id === BUILDER_MISSION_SEQUENCER_CATEGORY.id
          ? missionSequenceRows.length
          : category.id === BUILDER_TRAFFIC_ROUTES_CATEGORY.id
            ? PASSIVE_TRAFFIC_CAR_ITEM_IDS.length
            : category.items.length,
        active: category.id === this.state.activeCategoryId
      });
    }
    const groupTabs = [];
    if (activeCategory.items.length) {
      groupTabs.push({
        id: 'all',
        label: 'All',
        count: activeCategory.items.length,
        active: this.activeGroupId === 'all'
      });
      for (const group of collectBuilderGroups(activeCategory.items)) {
        groupTabs.push({
          ...group,
          active: group.id === this.activeGroupId
        });
      }
    }
    const sections = [];
    for (const section of groupVisibleEntries(visibleEntries)) {
      const cards = [];
      for (const card of section.cards) {
        cards.push({
          ...card,
          selected: card.sourceIndex === this.state.activeItemIndex
        });
      }
      sections.push({
        ...section,
        cards
      });
    }
    const selectedPlacement = this.getSelectedPlacement();
    const selectedPropItem = selectedPlacement?.layer === 'prop'
      ? getBuilderItemById(selectedPlacement.itemId)
      : null;
    const activePropItem = this.activeItem?.layer === 'prop'
      ? this.activeItem
      : null;
    const propSizeItem = selectedPropItem ?? activePropItem;
    const propSizeValue = selectedPropItem
      ? this.getPropScaleDraft(selectedPlacement)
      : this.state.propScale;
    const utilityCategoryActive = isTrafficRoutesCategoryId(this.state.activeCategoryId)
      || this.state.activeCategoryId === BUILDER_MISSION_SEQUENCER_CATEGORY.id;

    return {
      available: this.canEdit,
      enabled: this.state.enabled,
      tabs,
      groupTabs,
      sections,
      propSizeControl: propSizeItem && !utilityCategoryActive
        ? {
            value: propSizeValue,
            min: PROP_PLACEMENT_SCALE_MIN,
            max: PROP_PLACEMENT_SCALE_MAX,
            step: PROP_PLACEMENT_SCALE_STEP,
            targetLabel: propSizeItem.label,
            targetMode: selectedPropItem ? 'Selection' : 'Next Prop'
          }
        : null,
      missionSequencer: this.state.activeCategoryId === BUILDER_MISSION_SEQUENCER_CATEGORY.id
        ? {
            activeTab: this.state.missionSequencerActiveTab,
            prompt: this.state.missionSequencerPrompt,
            rows: missionSequenceRows
          }
        : null,
      trafficRoutes: isTrafficRoutesCategoryId(this.state.activeCategoryId)
        ? this.getTrafficRoutesViewModel()
        : null
    };
  }

  updateBuilderHud({ syncPreviews = false } = {}) {
    this.hud.setBuilderState(this.getBuilderViewModel());
    if (this.state.enabled && isTrafficRoutesCategoryId(this.state.activeCategoryId)) {
      this.requestTrafficRouteMapImage();
      void this.syncTrafficRouteCarPreviews();
    }
    if (
      this.state.enabled
      && !isTrafficRoutesCategoryId(this.state.activeCategoryId)
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

  requestTrafficRouteMapImage({ force = false } = {}) {
    const shouldForce = force === true;
    if (!this.requestWorldMapImage || this.trafficRouteMapRequest) {
      return;
    }
    const image = this.getWorldMapImage?.() ?? null;
    const imageFresh = image ? this.isWorldMapImageFresh(image) : false;
    if (!shouldForce && imageFresh) {
      return;
    }

    const now = Date.now();
    if (shouldForce && imageFresh && now - this.trafficRouteMapLastRefreshAt < 4000) {
      return;
    }
    this.trafficRouteMapLastRefreshAt = now;

    this.trafficRouteMapRequest = Promise.resolve()
      .then(() => this.requestWorldMapImage({ force: shouldForce || !imageFresh }))
      .finally(() => {
        this.trafficRouteMapRequest = null;
        if (this.state.enabled && isTrafficRoutesCategoryId(this.state.activeCategoryId)) {
          this.updateBuilderHud();
        }
      });
  }

  async syncTrafficRouteCarPreviews() {
    if (!PASSIVE_TRAFFIC_CAR_ITEM_IDS.length) {
      return;
    }

    const previewRenderer = await this.ensureBuilderPreviewRenderer();
    const generation = ++this.builderPreviewGeneration;
    for (const itemId of PASSIVE_TRAFFIC_CAR_ITEM_IDS) {
      if (this.hud.builderPreviewImages?.has?.(itemId)) {
        continue;
      }
      const item = getBuilderItemById(itemId);
      if (!item) {
        continue;
      }
      try {
        const preview = await previewRenderer.render(item);
        if (
          generation !== this.builderPreviewGeneration
          || !isTrafficRoutesCategoryId(this.state.activeCategoryId)
        ) {
          return;
        }
        this.hud.setBuilderPreviewImage(item.id, preview);
      } catch (error) {
        console.warn(`Could not render traffic route car preview for ${itemId}.`, error);
      }
    }
  }

  async syncBuilderCatalogPreviews() {
    const categoryId = this.state.activeCategoryId;
    const groupId = this.activeGroupId;
    const items = [];
    for (const entry of this.getVisibleCategoryEntries(categoryId)) {
      if ((entry.item.previewMode ?? 'render') === 'render') {
        items.push(entry.item);
      }
    }
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

  getColliders(target = []) {
    return this.worldRenderer.getColliders(target);
  }

  getGroundHeightAt(worldPosition) {
    return this.worldRenderer.getGroundHeightAt(worldPosition, this.worldState);
  }

  getInteractables(target = []) {
    return this.worldRenderer.getInteractables(this.worldState, target);
  }

  forEachPlacement(callback) {
    this.worldState.forEachPlacement(callback);
  }

  getInlineShellEntries(target = []) {
    return this.worldRenderer.getInlineShellEntries(this.worldState, target);
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

  getNpcSpeechAnchor(placementId, target = null) {
    return this.worldRenderer.getNpcSpeechAnchor(placementId, target);
  }

  setNpcRuntimeState(npcStateMap) {
    this.worldRenderer.applyNpcRuntimeState(npcStateMap);
  }

  setPlayerWorkoutState(
    playerStateMap = EMPTY_MAP,
    workoutState = {}
  ) {
    this.worldRenderer.applyPlayerWorkoutState(playerStateMap, workoutState);
  }

  setNpcFocusTargets(npcFocusTargets = EMPTY_MAP) {
    this.worldRenderer.applyNpcFocusTargets(npcFocusTargets);
  }

  setNpcDebugState(npcDebugMap = EMPTY_MAP) {
    this.npcDebugState = npcDebugMap instanceof Map ? npcDebugMap : new Map(npcDebugMap);
    this.worldRenderer.applyNpcDebugState(this.npcDebugState);
    this.syncNpcDebugTools();
    this.updateBuilderNpcEditor();
  }

  setPassiveTrafficServerState(passiveTrafficState = EMPTY_MAP) {
    this.worldRenderer.setPassiveTrafficServerState(passiveTrafficState);
  }

  triggerNpcDamageFeedback(npcId, options = {}) {
    this.worldRenderer.triggerNpcDamageFeedback(npcId, options);
  }

  updateCameraOcclusion(camera, playerPosition, options = {}) {
    return this.worldRenderer.updateCameraOcclusion(camera, playerPosition, options);
  }

  clearCameraOcclusion() {
    return this.worldRenderer.clearCameraOcclusion();
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

  setPlacementFadedNodeNames(id, nodeNames = [], opacity = 1) {
    this.worldRenderer.setPlacementFadedNodeNames(id, nodeNames, opacity);
  }

  setPlacementShadowOverrides(id, overrides = null) {
    this.worldRenderer.setPlacementShadowOverrides(id, overrides);
  }

  setPlacementCutawayState(id, state = {}) {
    this.worldRenderer.setPlacementCutawayState(id, state);
  }

  clearInteriorPlacementPreview() {
    if (!this.builderInteriorPreviewPlacementIds.size) {
      return;
    }

    for (const placementId of this.builderInteriorPreviewPlacementIds) {
      this.worldRenderer.setPlacementCutawayState(placementId);
      this.worldRenderer.setPlacementVisualHidden(placementId, false);
    }

    this.builderInteriorPreviewPlacementIds.clear();
  }

  syncInteriorPlacementPreview() {
    if (!this.state.enabled) {
      this.clearInteriorPlacementPreview();
      return;
    }

    const entries = this.getInlineShellEntries(this.inlineShellEntries);
    const nextPlacementIds = this.builderInteriorPreviewNextPlacementIds;
    nextPlacementIds.clear();
    for (const entry of entries) {
      nextPlacementIds.add(entry.placementId);
    }

    const idsToClear = this.builderInteriorPreviewIdsToClear;
    idsToClear.length = 0;
    for (const placementId of this.builderInteriorPreviewPlacementIds) {
      if (nextPlacementIds.has(placementId)) {
        continue;
      }
      idsToClear.push(placementId);
    }

    for (const placementId of idsToClear) {
      this.worldRenderer.setPlacementCutawayState(placementId);
      this.worldRenderer.setPlacementVisualHidden(placementId, false);
      this.builderInteriorPreviewPlacementIds.delete(placementId);
    }

    for (const entry of entries) {
      this.worldRenderer.setPlacementVisualHidden(entry.placementId, false);

      if (entry?.interior?.mode === 'inline-cutaway') {
        this.worldRenderer.setPlacementCutawayState(entry.placementId, {
          hiddenNodeNames: entry?.interior?.cutawayNodeNames ?? [],
          fadedNodeNames: entry?.interior?.cutawayFadeNodeNames ?? [],
          fadedNodeOpacity: entry?.interior?.cutawayFadeOpacity ?? 0.1,
          visibleNodeNames: entry?.interior?.cutawayVisibleNodeNames ?? [],
          shadowOverrides: {
            castShadow: false,
            receiveShadow: false
          }
        });
      } else {
        this.worldRenderer.setPlacementCutawayState(entry.placementId);
      }

      if (entry?.interior?.mode === 'inline-shell') {
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
    const targetOptionMap = this.getNpcTargetOptionMap();
    const activePickStepIndex = this.npcTargetPickState?.placementId === placement.id
      ? this.npcTargetPickState.stepIndex
      : -1;

    const markers = [];
    const steps = routine.steps ?? [];
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      const target = step.targetPlacementId
        ? targetOptionMap.get(step.targetPlacementId)
        : null;
      if (!target?.approachPosition) {
        continue;
      }

      markers.push({
        stepIndex: index,
        stepType: step.type,
        placementId: target.placementId ?? target.id,
        point: { ...target.approachPosition },
        originPoint: target.originPosition ? { ...target.originPosition } : null,
        label: target.displayLabel ?? target.label,
        activePick: index === activePickStepIndex
      });
    }

    return markers;
  }

  setRemoteBuilders(builders = EMPTY_MAP, localSessionId = '') {
    if (!this.visible) {
      this.remoteBuilderRenderer.clear();
      return;
    }

    const remoteBuilders = new Map();
    for (const sessionId of builders.keys()) {
      const presence = builders.get(sessionId);
      if (!presence?.active || sessionId === localSessionId) {
        continue;
      }
      remoteBuilders.set(sessionId, presence);
    }
    this.remoteBuilderRenderer.sync(remoteBuilders);
  }

  onPointerMove(event) {
    this.syncPointerModifierState(event);
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

    this.syncPointerModifierState(event);
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

    if (this.isIdentifyModifierActive()) {
      event.preventDefault();
      if (hoveredPlacement) {
        this.selectPlacement(hoveredPlacement.id);
      } else {
        this.clearSelection();
      }
      return;
    }

    if (this.shouldPlaceActiveItemOverHoveredPlacement(hoveredPlacement)) {
      this.clearSelection();
      void this.placeCurrentItem();
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

    if (!nextCanEdit && this.canEdit && this.state.enabled) {
      await this.setEnabled(false);
    }

    this.canEdit = nextCanEdit;

    this.updateBuilderHud({ syncPreviews: this.canEdit && this.state.enabled });
    if (this.canEdit) {
      this.reportBuilderPresence(true);
    }
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
    if (nextEnabled && isTrafficRoutesCategoryId(this.state.activeCategoryId)) {
      this.requestTrafficRouteMapImage({ force: true });
    }

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
    if (!getBuilderTabCategoryById(categoryId)) {
      return;
    }

    const previousCategoryId = this.state.activeCategoryId;
    this.state.activeCategoryId = categoryId;
    this.state.activeItemIndex = this.getVisibleCategoryEntries(categoryId)[0]?.index ?? 0;
    this.syncActivePropScaleDefault();
    this.updateBuilderHud({ syncPreviews: true });
    if (isTrafficRoutesCategoryId(categoryId)) {
      this.requestTrafficRouteMapImage({ force: previousCategoryId !== categoryId });
    }
    void this.syncPreviewToState(true);
  }

  selectGroup(groupId) {
    if (!this.activeCategory.items.length) {
      return;
    }

    this.state.activeGroupIdByCategory[this.state.activeCategoryId] = groupId;
    this.ensureActiveItemVisible();
    this.syncActivePropScaleDefault();
    this.updateBuilderHud({ syncPreviews: true });
    void this.syncPreviewToState(true);
  }

  selectItem(index) {
    if (!this.activeCategory.items.length) {
      return;
    }

    const maxIndex = this.activeCategory.items.length - 1;
    this.state.activeItemIndex = THREE.MathUtils.clamp(index, 0, maxIndex);
    this.syncActivePropScaleDefault();
    this.updateBuilderHud();
    void this.syncPreviewToState(true);
  }

  syncActivePropScaleDefault() {
    if (this.getSelectedPlacement()?.layer === 'prop') {
      return;
    }

    if (this.activeItem?.layer === 'prop') {
      this.state.propScale = getDefaultPropPlacementScale(this.activeItem);
    }
  }

  async reorderMissionSequence(fromIndex, toIndex) {
    const nextMissionSequence = moveMissionSequenceEntry(this.worldState.getMissionSequence(), fromIndex, toIndex);
    await this.updateMissionSequence(nextMissionSequence, 'Mission sequence updated.');
  }

  async updateMissionSequenceRule(missionId, updates = {}) {
    const nextMissionSequence = updateMissionSequenceEntry(this.worldState.getMissionSequence(), missionId, updates);
    await this.updateMissionSequence(
      nextMissionSequence,
      Object.hasOwn(updates, 'hiddenForPlayers')
        ? 'Mission visibility updated.'
        : 'Mission availability updated.'
    );
  }

  async updateMissionSequenceText(missionId, text = '') {
    const missionText = String(text ?? '').trim();
    if (!missionText) {
      this.hud.showToast('Enter mission text first.');
      return;
    }

    const nextMissionSequence = updateMissionSequenceEntry(this.worldState.getMissionSequence(), missionId, {
      text: missionText
    });
    await this.updateMissionSequence(nextMissionSequence, 'Mission text updated.');
  }

  setMissionSequencerActiveTab(tab = MISSION_SEQUENCE_SECTIONS.main) {
    const nextTab = tab === MISSION_SEQUENCE_SECTIONS.bonus
      ? MISSION_SEQUENCE_SECTIONS.bonus
      : MISSION_SEQUENCE_SECTIONS.main;
    if (this.state.missionSequencerActiveTab === nextTab) {
      return;
    }

    this.state.missionSequencerActiveTab = nextTab;
    this.updateBuilderHud();
  }

  setMissionSequencerPrompt(value = '') {
    this.state.missionSequencerPrompt = String(value ?? '').slice(0, 220);
  }

  async addMissionSequencePrompt(prompt = '') {
    const missionPrompt = String(prompt ?? this.state.missionSequencerPrompt ?? '').trim();
    if (!missionPrompt) {
      this.hud.showToast('Enter a mission prompt first.');
      return;
    }

    const nextMissionSequence = appendMissionSequencePromptEntry(
      this.worldState.getMissionSequence(),
      missionPrompt,
      {
        bonusQuest: this.state.missionSequencerActiveTab === MISSION_SEQUENCE_SECTIONS.bonus
      }
    );
    const updated = await this.updateMissionSequence(
      nextMissionSequence,
      this.state.missionSequencerActiveTab === MISSION_SEQUENCE_SECTIONS.bonus
        ? 'Bonus quest added.'
        : 'Mission added to sequencer.'
    );
    if (updated) {
      this.state.missionSequencerPrompt = '';
      this.updateBuilderHud();
    }
  }

  async updateMissionSequence(missionSequence, successMessage = 'Mission sequence updated.') {
    const result = await this.worldEditAdapter.edit({
      op: 'updateMissionSequence',
      missionSequence
    });
    if (!result?.ok) {
      this.hud.showToast(result?.error ?? 'Could not update mission sequence.');
      return false;
    }

    if (result.appliedImmediately) {
      this.worldState.updateMissionSequence(missionSequence);
      this.updateBuilderHud();
      this.notifyLayoutChanged();
    }

    this.hud.showToast(successMessage);
    return true;
  }

  selectTrafficRouteCar(itemId = '') {
    if (!PASSIVE_TRAFFIC_CAR_ITEM_IDS.includes(itemId)) {
      return;
    }

    const route = this.worldState.getPassiveTrafficRoutes().find((entry) => entry.itemId === itemId) ?? null;
    this.state.activeTrafficRouteCarItemId = itemId;
    this.state.activeTrafficRouteId = route?.id ?? '';
    if (
      this.state.trafficRouteDraft?.itemId
      && (
        this.state.trafficRouteDraft.itemId !== itemId
        || (route?.id && this.state.trafficRouteDraft.id !== route.id)
      )
    ) {
      this.state.trafficRouteDraft = null;
      this.state.trafficRoutePreview = null;
      this.state.trafficRouteDrawing = false;
      this.state.trafficRoutePendingRemoveNodeIndex = null;
    }
    this.updateBuilderHud();
  }

  addTrafficRouteCar(itemId = '') {
    if (!PASSIVE_TRAFFIC_CAR_ITEM_IDS.includes(itemId)) {
      return;
    }

    this.state.activeTrafficRouteCarItemId = itemId;
    this.state.activeTrafficRouteId = createPassiveTrafficRouteId(itemId, this.worldState.getPassiveTrafficRoutes());
    if (
      this.state.trafficRouteDraft
      && (
        this.state.trafficRouteDraft.itemId !== itemId
        || this.state.trafficRouteDraft.id !== this.state.activeTrafficRouteId
      )
    ) {
      this.state.trafficRouteDraft = null;
      this.state.trafficRoutePreview = null;
      this.state.trafficRouteDrawing = false;
      this.state.trafficRoutePendingRemoveNodeIndex = null;
    }
    this.updateBuilderHud();
  }

  selectTrafficRoute(routeId = '') {
    const route = this.worldState.getPassiveTrafficRoutes().find((entry) => entry.id === routeId);
    if (!route || !PASSIVE_TRAFFIC_CAR_ITEM_IDS.includes(route.itemId)) {
      return;
    }

    this.state.activeTrafficRouteCarItemId = route.itemId;
    this.state.activeTrafficRouteId = route.id;
    if (this.state.trafficRouteDraft?.id && this.state.trafficRouteDraft.id !== route.id) {
      this.state.trafficRouteDraft = null;
      this.state.trafficRoutePreview = null;
      this.state.trafficRouteDrawing = false;
      this.state.trafficRoutePendingRemoveNodeIndex = null;
    }
    this.updateBuilderHud();
  }

  getNearestTrafficRouteNode(point = null, graph = this.getTrafficRouteGraph(), { fromNodeIndex = null } = {}) {
    if (!point || !graph?.activeNodes?.length) {
      return null;
    }

    const x = Number(point.x);
    const z = Number(point.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return null;
    }

    const halfTile = BUILDER_TILE_SIZE * 0.5;
    let containingNode = null;
    let containingDistanceSq = Infinity;
    for (const node of graph.activeNodes) {
      if (
        Math.abs(node.x - x) <= halfTile + 0.001
        && Math.abs(node.z - z) <= halfTile + 0.001
      ) {
        const distanceSq = ((node.x - x) * (node.x - x)) + ((node.z - z) * (node.z - z));
        if (distanceSq < containingDistanceSq) {
          containingNode = node;
          containingDistanceSq = distanceSq;
        }
      }
    }
    if (containingNode) {
      return containingNode;
    }

    const fromNode = graph.activeNodeSet.has(fromNodeIndex)
      ? graph.nodes?.[fromNodeIndex]
      : null;
    const preferredComponentIndex = fromNode?.componentIndex;

    for (let pass = 0; pass < 2; pass += 1) {
      const requirePreferredComponent = pass === 0 && preferredComponentIndex !== undefined;
      if (pass === 1 && preferredComponentIndex === undefined) {
        break;
      }

      let bestNode = null;
      let bestDistanceSq = Infinity;
      for (const node of graph.activeNodes) {
        if (requirePreferredComponent && node.componentIndex !== preferredComponentIndex) {
          continue;
        }

        const distanceSq = ((node.x - x) * (node.x - x)) + ((node.z - z) * (node.z - z));
        if (distanceSq < bestDistanceSq) {
          bestNode = node;
          bestDistanceSq = distanceSq;
        }
      }

      if (bestNode) {
        return bestNode;
      }
    }

    return null;
  }

  getTrafficRouteDraftWaypointNodeIndices(draft = this.state.trafficRouteDraft) {
    const source = Array.isArray(draft?.waypointNodeIndices)
      ? draft.waypointNodeIndices
      : (Array.isArray(draft?.nodeIndices) ? draft.nodeIndices : []);
    const output = [];
    for (const nodeIndex of source) {
      const normalizedIndex = Number(nodeIndex);
      if (!Number.isInteger(normalizedIndex)) {
        continue;
      }
      if (output[output.length - 1] !== normalizedIndex) {
        output.push(normalizedIndex);
      }
    }
    return output;
  }

  getTrafficRouteDraftWaypointPoints(draft = this.state.trafficRouteDraft, graph = this.getTrafficRouteGraph()) {
    const points = [];
    const waypointNodeIndices = this.getTrafficRouteDraftWaypointNodeIndices(draft);
    const markerCount = draft?.closed && waypointNodeIndices.length > 1 && waypointNodeIndices[0] === waypointNodeIndices[waypointNodeIndices.length - 1]
      ? waypointNodeIndices.length - 1
      : waypointNodeIndices.length;
    for (let index = 0; index < markerCount; index += 1) {
      const node = graph?.nodes?.[waypointNodeIndices[index]];
      const point = createTrafficRoutePointFromNode(node);
      if (point) {
        points.push(point);
      }
    }
    return points;
  }

  rebuildTrafficRouteDraftFromWaypoints(graph = this.getTrafficRouteGraph()) {
    const draft = this.state.trafficRouteDraft;
    const waypointNodeIndices = this.getTrafficRouteDraftWaypointNodeIndices(draft);
    if (!draft || !graph?.activeNodeSet || !waypointNodeIndices.length) {
      return false;
    }

    const firstNodeIndex = waypointNodeIndices[0];
    const firstNode = graph.nodes?.[firstNodeIndex];
    if (!firstNode || !graph.activeNodeSet.has(firstNodeIndex)) {
      return false;
    }

    const points = [createTrafficRoutePointFromNode(firstNode)];
    const nodeIndices = [firstNodeIndex];
    let currentNodeIndex = firstNodeIndex;
    for (const waypointNodeIndex of waypointNodeIndices.slice(1)) {
      if (!graph.activeNodeSet.has(waypointNodeIndex)) {
        return false;
      }
      if (waypointNodeIndex === currentNodeIndex) {
        continue;
      }

      const path = findPassiveTrafficPath(graph, currentNodeIndex, waypointNodeIndex);
      if (path.length < 2) {
        return false;
      }

      for (const pathNodeIndex of path.slice(1)) {
        const pathNode = graph.nodes?.[pathNodeIndex];
        const point = createTrafficRoutePointFromNode(pathNode);
        if (!point) {
          return false;
        }
        if (nodeIndices[nodeIndices.length - 1] !== pathNodeIndex) {
          nodeIndices.push(pathNodeIndex);
          points.push(point);
        }
      }
      currentNodeIndex = waypointNodeIndex;
    }

    draft.waypointNodeIndices = waypointNodeIndices;
    draft.nodeIndices = nodeIndices;
    draft.points = points;
    draft.closed = waypointNodeIndices.length >= 4 && waypointNodeIndices[0] === waypointNodeIndices[waypointNodeIndices.length - 1];
    return true;
  }

  removeTrafficRouteDraftWaypoint(nodeIndex, graph = this.getTrafficRouteGraph()) {
    const draft = this.state.trafficRouteDraft;
    if (!draft || draft.closed) {
      return false;
    }

    const waypointNodeIndices = this.getTrafficRouteDraftWaypointNodeIndices(draft);
    if (!waypointNodeIndices.length) {
      return false;
    }

    const firstNodeIndex = waypointNodeIndices[0];
    if (nodeIndex === firstNodeIndex && waypointNodeIndices.length >= 3) {
      return false;
    }

    const removeIndex = waypointNodeIndices.indexOf(nodeIndex);
    if (removeIndex < 0) {
      return false;
    }

    const previousWaypoints = waypointNodeIndices.slice();
    const nextWaypoints = waypointNodeIndices.filter((_, index) => index !== removeIndex);
    if (!nextWaypoints.length) {
      this.state.trafficRouteDraft = null;
      this.state.trafficRoutePreview = null;
      this.state.trafficRouteDrawing = false;
      return true;
    }

    draft.waypointNodeIndices = nextWaypoints;
    if (nextWaypoints.length === 1) {
      const node = graph?.nodes?.[nextWaypoints[0]];
      const point = createTrafficRoutePointFromNode(node);
      if (!point) {
        draft.waypointNodeIndices = previousWaypoints;
        return false;
      }
      draft.nodeIndices = [nextWaypoints[0]];
      draft.points = [point];
      draft.closed = false;
      this.state.trafficRoutePreview = null;
      return true;
    }

    if (!this.rebuildTrafficRouteDraftFromWaypoints(graph)) {
      draft.waypointNodeIndices = previousWaypoints;
      this.rebuildTrafficRouteDraftFromWaypoints(graph);
      return false;
    }

    this.state.trafficRoutePreview = null;
    return true;
  }

  isTrafficRouteDraftWaypointRemovalCandidate(nodeIndex) {
    const draft = this.state.trafficRouteDraft;
    if (!draft || draft.closed) {
      return false;
    }

    const waypointNodeIndices = this.getTrafficRouteDraftWaypointNodeIndices(draft);
    if (!waypointNodeIndices.length) {
      return false;
    }

    const removeIndex = waypointNodeIndices.indexOf(nodeIndex);
    if (removeIndex < 0) {
      return false;
    }

    return nodeIndex !== waypointNodeIndices[0] || waypointNodeIndices.length < 3;
  }

  createTrafficRouteDraftPreview(nodeIndex, graph = this.getTrafficRouteGraph()) {
    const draft = this.state.trafficRouteDraft;
    const node = graph?.nodes?.[nodeIndex];
    const nodeIndices = draft?.nodeIndices ?? [];
    if (!draft || !node || !graph.activeNodeSet.has(nodeIndex) || !nodeIndices.length || draft.closed) {
      return null;
    }

    const firstNodeIndex = nodeIndices[0];
    const lastNodeIndex = nodeIndices[nodeIndices.length - 1];
    if (nodeIndex === lastNodeIndex) {
      return null;
    }

    const waypointNodeIndices = this.getTrafficRouteDraftWaypointNodeIndices(draft);
    if (nodeIndex === firstNodeIndex && waypointNodeIndices.length < 3) {
      return null;
    }

    const path = findPassiveTrafficPath(graph, lastNodeIndex, nodeIndex);
    if (path.length < 2) {
      return null;
    }

    const points = [];
    for (const pathNodeIndex of path) {
      const pathNode = graph.nodes[pathNodeIndex];
      const point = createTrafficRoutePointFromNode(pathNode);
      if (point) {
        points.push(point);
      }
    }

    return {
      points,
      nodeIndices: path,
      closed: nodeIndex === firstNodeIndex
    };
  }

  setTrafficRouteDraftPreview(nodeIndex, graph = this.getTrafficRouteGraph()) {
    const preview = this.createTrafficRouteDraftPreview(nodeIndex, graph);
    const previousKey = (this.state.trafficRoutePreview?.nodeIndices ?? []).join(',');
    const nextKey = (preview?.nodeIndices ?? []).join(',');
    const previousClosed = this.state.trafficRoutePreview?.closed === true;
    const nextClosed = preview?.closed === true;
    if (previousKey === nextKey && previousClosed === nextClosed) {
      return false;
    }

    this.state.trafficRoutePreview = preview;
    return true;
  }

  appendTrafficRouteDraftNode(nodeIndex, graph = this.getTrafficRouteGraph()) {
    const draft = this.state.trafficRouteDraft;
    const node = graph?.nodes?.[nodeIndex];
    if (!draft || !node || !graph.activeNodeSet.has(nodeIndex)) {
      return false;
    }

    draft.points = Array.isArray(draft.points) ? draft.points : [];
    draft.nodeIndices = Array.isArray(draft.nodeIndices) ? draft.nodeIndices : [];
    draft.waypointNodeIndices = Array.isArray(draft.waypointNodeIndices)
      ? draft.waypointNodeIndices
      : this.getTrafficRouteDraftWaypointNodeIndices(draft);
    const nodeIndices = draft.nodeIndices;
    const waypointNodeIndices = draft.waypointNodeIndices;
    if (!waypointNodeIndices.length) {
      draft.points = [createTrafficRoutePointFromNode(node)];
      draft.nodeIndices = [nodeIndex];
      draft.waypointNodeIndices = [nodeIndex];
      draft.closed = false;
      this.state.trafficRoutePreview = null;
      return true;
    }

    const firstNodeIndex = waypointNodeIndices[0];
    const lastNodeIndex = nodeIndices[nodeIndices.length - 1] ?? waypointNodeIndices[waypointNodeIndices.length - 1];
    if (nodeIndex === lastNodeIndex) {
      return false;
    }

    if (nodeIndex === firstNodeIndex && waypointNodeIndices.length < 3) {
      return false;
    }

    const closingRoute = nodeIndex === firstNodeIndex;
    const path = findPassiveTrafficPath(graph, lastNodeIndex, nodeIndex);
    if (path.length < 2) {
      return false;
    }

    if (!closingRoute && waypointNodeIndices.includes(nodeIndex)) {
      return false;
    }

    const previousWaypoints = waypointNodeIndices.slice();
    draft.waypointNodeIndices = [...waypointNodeIndices, nodeIndex];
    if (!this.rebuildTrafficRouteDraftFromWaypoints(graph)) {
      draft.waypointNodeIndices = previousWaypoints;
      this.rebuildTrafficRouteDraftFromWaypoints(graph);
      return false;
    }
    this.state.trafficRoutePreview = null;
    return true;
  }

  beginTrafficRouteFromCar(itemId = '', point = null, routeId = this.state.activeTrafficRouteId) {
    if (!PASSIVE_TRAFFIC_CAR_ITEM_IDS.includes(itemId)) {
      return;
    }

    const graph = this.getTrafficRouteGraph();
    if (!graph.activeNodeIndices.length) {
      this.hud.showToast('Add road tiles first.');
      return;
    }

    const node = this.getNearestTrafficRouteNode(point, graph);
    if (!node) {
      this.hud.showToast('Drop on a mapped road.');
      return;
    }

    this.state.activeTrafficRouteCarItemId = itemId;
    const routes = this.worldState.getPassiveTrafficRoutes();
    const requestedRouteId = String(routeId ?? '');
    const routeIdTakenByOtherType = routes.some((route) => route.id === requestedRouteId && route.itemId !== itemId);
    const resolvedRouteId = requestedRouteId && !routeIdTakenByOtherType
      ? requestedRouteId
      : createPassiveTrafficRouteId(itemId, routes);
    this.state.activeTrafficRouteId = resolvedRouteId;
    this.state.trafficRoutePendingRemoveNodeIndex = null;
    this.state.trafficRouteDraft = {
      id: resolvedRouteId,
      itemId,
      label: getBuilderItemById(itemId)?.label ?? titleCaseLabel(itemId),
      points: [],
      nodeIndices: [],
      waypointNodeIndices: [],
      closed: false
    };
    this.state.trafficRoutePreview = null;
    this.appendTrafficRouteDraftNode(node.index, graph);
    this.updateBuilderHud();
  }

  beginTrafficRouteDrawing(point = null) {
    const itemId = this.state.trafficRouteDraft?.itemId
      ?? this.state.activeTrafficRouteCarItemId
      ?? PASSIVE_TRAFFIC_CAR_ITEM_IDS[0];
    const hadOpenDraft = Boolean(this.state.trafficRouteDraft && !this.state.trafficRouteDraft.closed);
    this.state.trafficRoutePendingRemoveNodeIndex = null;
    if (!this.state.trafficRouteDraft) {
      this.beginTrafficRouteFromCar(itemId, point);
    } else if (PASSIVE_TRAFFIC_CAR_ITEM_IDS.includes(this.state.trafficRouteDraft.itemId)) {
      this.state.activeTrafficRouteCarItemId = this.state.trafficRouteDraft.itemId;
    }

    if (hadOpenDraft) {
      const graph = this.getTrafficRouteGraph();
      const lastNodeIndex = this.state.trafficRouteDraft?.nodeIndices?.[this.state.trafficRouteDraft.nodeIndices.length - 1] ?? null;
      const node = this.getNearestTrafficRouteNode(point, graph, { fromNodeIndex: lastNodeIndex });
      if (node && this.isTrafficRouteDraftWaypointRemovalCandidate(node.index)) {
        this.state.trafficRoutePendingRemoveNodeIndex = node.index;
        this.state.trafficRoutePreview = null;
      }
    }

    this.state.trafficRouteDrawing = Boolean(this.state.trafficRouteDraft && !this.state.trafficRouteDraft.closed);
    this.continueTrafficRouteDrawing(point);
  }

  continueTrafficRouteDrawing(point = null) {
    if (!this.state.trafficRouteDrawing || !this.state.trafficRouteDraft || this.state.trafficRouteDraft.closed) {
      return;
    }

    const graph = this.getTrafficRouteGraph();
    const lastNodeIndex = this.state.trafficRouteDraft.nodeIndices?.[this.state.trafficRouteDraft.nodeIndices.length - 1] ?? null;
    const node = this.getNearestTrafficRouteNode(point, graph, { fromNodeIndex: lastNodeIndex });
    if (!node) {
      return;
    }

    const pendingRemoveNodeIndex = this.state.trafficRoutePendingRemoveNodeIndex;
    if (pendingRemoveNodeIndex !== null && pendingRemoveNodeIndex !== undefined) {
      if (node.index === pendingRemoveNodeIndex) {
        if (this.state.trafficRoutePreview) {
          this.state.trafficRoutePreview = null;
          this.updateBuilderHud();
        }
        return;
      }
      this.state.trafficRoutePendingRemoveNodeIndex = null;
    }

    if (this.setTrafficRouteDraftPreview(node.index, graph)) {
      this.updateBuilderHud();
    }
  }

  async finishTrafficRouteDrawing(point = null) {
    if (!this.state.trafficRouteDrawing) {
      return;
    }

    const graph = this.getTrafficRouteGraph();
    const lastNodeIndex = this.state.trafficRouteDraft?.nodeIndices?.[this.state.trafficRouteDraft.nodeIndices.length - 1] ?? null;
    const node = this.getNearestTrafficRouteNode(point, graph, { fromNodeIndex: lastNodeIndex });
    const pendingRemoveNodeIndex = this.state.trafficRoutePendingRemoveNodeIndex;
    const shouldRemoveWaypoint = node
      && pendingRemoveNodeIndex !== null
      && pendingRemoveNodeIndex !== undefined
      && node.index === pendingRemoveNodeIndex
      && this.isTrafficRouteDraftWaypointRemovalCandidate(node.index);
    const changed = shouldRemoveWaypoint
      ? this.removeTrafficRouteDraftWaypoint(node.index, graph)
      : (node ? this.appendTrafficRouteDraftNode(node.index, graph) : false);
    this.state.trafficRouteDrawing = false;
    this.state.trafficRoutePreview = null;
    this.state.trafficRoutePendingRemoveNodeIndex = null;
    if (this.state.trafficRouteDraft?.closed) {
      await this.saveTrafficRouteDraft();
      return;
    }
    if (changed || this.state.trafficRouteDraft) {
      this.updateBuilderHud();
    }
  }

  clearTrafficRouteDraft({ preserveActiveRouteId = false } = {}) {
    const draftRouteId = this.state.trafficRouteDraft?.id ?? '';
    this.state.trafficRouteDraft = null;
    this.state.trafficRoutePreview = null;
    this.state.trafficRouteDrawing = false;
    this.state.trafficRoutePendingRemoveNodeIndex = null;
    if (
      !preserveActiveRouteId
      && draftRouteId
      && !this.worldState.getPassiveTrafficRoutes().some((route) => route.id === draftRouteId)
    ) {
      this.state.activeTrafficRouteId = '';
    }
    this.updateBuilderHud();
  }

  async saveTrafficRouteDraft() {
    const draft = this.state.trafficRouteDraft;
    if (!draft?.closed || (draft.points?.length ?? 0) < 4) {
      return false;
    }

    const item = getBuilderItemById(draft.itemId);
    const route = {
      id: draft.id || createPassiveTrafficRouteId(draft.itemId, this.worldState.getPassiveTrafficRoutes()),
      itemId: draft.itemId,
      label: item?.label ?? draft.label ?? titleCaseLabel(draft.itemId),
      closed: true,
      points: draft.points.map((point) => ({
        cellX: point.cellX,
        cellZ: point.cellZ,
        x: point.x,
        z: point.z
      }))
    };
    const nextRoutes = [
      ...this.worldState.getPassiveTrafficRoutes().filter((entry) => entry.id !== route.id),
      route
    ];
    const updated = await this.updatePassiveTrafficRoutes(nextRoutes, `${item?.label ?? 'Car'} route saved.`);
    if (updated) {
      this.state.activeTrafficRouteCarItemId = route.itemId;
      this.state.activeTrafficRouteId = route.id;
      this.clearTrafficRouteDraft({ preserveActiveRouteId: true });
    }
    return updated;
  }

  async deletePassiveTrafficRoute(routeId = '') {
    const normalizedRouteId = String(routeId ?? '');
    const route = this.worldState.getPassiveTrafficRoutes().find((entry) => entry.id === normalizedRouteId)
      ?? this.worldState.getPassiveTrafficRoutes().find((entry) => entry.itemId === normalizedRouteId);
    if (!route || !PASSIVE_TRAFFIC_CAR_ITEM_IDS.includes(route.itemId)) {
      return false;
    }

    const nextRoutes = this.worldState.getPassiveTrafficRoutes().filter((entry) => entry.id !== route.id);
    const updated = await this.updatePassiveTrafficRoutes(nextRoutes, 'Traffic route cleared.');
    if (updated && (this.state.trafficRouteDraft?.id === route.id || this.state.activeTrafficRouteId === route.id)) {
      this.state.trafficRouteDraft = null;
      this.state.trafficRoutePreview = null;
      this.state.trafficRouteDrawing = false;
      this.state.trafficRoutePendingRemoveNodeIndex = null;
      this.state.activeTrafficRouteId = '';
      this.state.activeTrafficRouteCarItemId = route.itemId;
      this.updateBuilderHud();
    }
    return updated;
  }

  async updatePassiveTrafficRoutes(passiveTrafficRoutes, successMessage = 'Traffic routes updated.') {
    const result = await this.worldEditAdapter.edit({
      op: 'updatePassiveTrafficRoutes',
      passiveTrafficRoutes
    });
    if (!result?.ok) {
      this.hud.showToast(result?.error ?? 'Could not update traffic routes.');
      return false;
    }

    if (result.appliedImmediately) {
      this.worldState.updatePassiveTrafficRoutes(passiveTrafficRoutes);
      this.worldRenderer.setPassiveTrafficRoutes(this.worldState.getPassiveTrafficRoutes());
      this.updateBuilderHud();
      this.notifyLayoutChanged();
    }

    this.hud.showToast(successMessage);
    return true;
  }

  ensureActiveItemVisible() {
    const visibleEntries = this.getVisibleCategoryEntries();

    if (visibleEntries.length === 0) {
      this.state.activeItemIndex = 0;
      return;
    }

    let activeItemVisible = false;
    for (let index = 0; index < visibleEntries.length; index += 1) {
      if (visibleEntries[index].index === this.state.activeItemIndex) {
        activeItemVisible = true;
        break;
      }
    }

    if (!activeItemVisible) {
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

  getActivePropRotationY() {
    return toPropRotationY(this.state.propRotationEighthTurns);
  }

  getActiveItemRotationQuarterTurns() {
    if (this.activeItem?.layer === 'prop') {
      return toQuarterTurns(this.getActivePropRotationY());
    }

    return this.state.rotationQuarterTurns;
  }

  getActiveItemRotationY() {
    if (this.activeItem?.layer === 'prop') {
      return this.getActivePropRotationY();
    }

    return toRotationY(this.state.rotationQuarterTurns);
  }

  rotate(delta) {
    if (this.activeItem?.layer === 'prop') {
      this.state.propRotationEighthTurns = normalizeRotationEighthTurns(
        this.state.propRotationEighthTurns + delta
      );
    } else {
      this.state.rotationQuarterTurns = (this.state.rotationQuarterTurns + delta + 4) % 4;
    }
    this.updateBuilderHud();
  }

  update(deltaSeconds, input, now = performance.now()) {
    this.worldRenderer.update(deltaSeconds, now);
    this.syncModifierState(input);

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
        if (visibleEntries.length) {
          let currentVisibleIndex = 0;
          for (let index = 0; index < visibleEntries.length; index += 1) {
            if (visibleEntries[index].index === this.state.activeItemIndex) {
              currentVisibleIndex = index;
              break;
            }
          }
          this.selectVisibleItem((currentVisibleIndex + 1) % visibleEntries.length);
        }
      }
      if (input.consume('BracketLeft')) {
        const visibleEntries = this.getVisibleCategoryEntries();
        if (visibleEntries.length) {
          let currentVisibleIndex = 0;
          for (let index = 0; index < visibleEntries.length; index += 1) {
            if (visibleEntries[index].index === this.state.activeItemIndex) {
              currentVisibleIndex = index;
              break;
            }
          }
          this.selectVisibleItem((currentVisibleIndex - 1 + visibleEntries.length) % visibleEntries.length);
        }
      }
      if (input.consume('Tab')) {
        let currentIndex = -1;
        for (let index = 0; index < BUILDER_TAB_CATEGORIES.length; index += 1) {
          if (BUILDER_TAB_CATEGORIES[index].id === this.state.activeCategoryId) {
            currentIndex = index;
            break;
          }
        }
        const nextCategory = BUILDER_TAB_CATEGORIES[(currentIndex + 1) % BUILDER_TAB_CATEGORIES.length];
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

  getActivePropSnapTarget() {
    const movingPlacement = this.getMovingPlacement();
    if (movingPlacement?.layer === 'prop') {
      const item = getBuilderItemById(movingPlacement.itemId);
      if (!item) {
        return null;
      }
      return {
        item,
        scale: this.getPropScaleDraft(movingPlacement),
        rotationY: getPlacementRotationY(movingPlacement),
        ignorePlacementId: movingPlacement.id
      };
    }

    if (this.activeItem?.layer !== 'prop') {
      return null;
    }

    return {
      item: this.activeItem,
      scale: this.state.propScale,
      rotationY: this.getActivePropRotationY(),
      ignorePlacementId: null
    };
  }

  getSnappedPropHoverPoint(point) {
    if (!this.isSnapModifierActive()) {
      return null;
    }

    const target = this.getActivePropSnapTarget();
    if (!target) {
      return null;
    }

    const snapped = findNearestAdjacentPropSnapPoint({
      point,
      placements: this.worldState,
      activeItem: target.item,
      activeScale: target.scale,
      activeRotationY: target.rotationY,
      ignorePlacementId: target.ignorePlacementId,
      getItemById: getBuilderItemById
    });

    if (!snapped) {
      return null;
    }

    this.snapHoverHit.set(snapped.x, point.y, snapped.z);
    return this.snapHoverHit;
  }

  resolveHoverState() {
    this.raycaster.setFromCamera(this.state.pointer, this.camera);
    const hit = this.hoverHit;
    const intersects = this.raycaster.ray.intersectPlane(this.groundPlane, hit);

    if (!intersects) {
      this.state.hover.point = null;
      this.state.hover.cell = null;
      this.state.hover.placementId = null;
      return;
    }

    const hoverCell = snapToCell(hit, this.hoverCell);
    const hoveredPropId = this.worldRenderer.pickPlacementId(this.state.pointer, this.camera);
    const hoveredProp = hoveredPropId ? this.worldState.getPlacement(hoveredPropId) : null;
    const hoveredTile = (this.canEditHoveredTiles || this.npcTargetPickState || this.isIdentifyModifierActive())
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

    this.state.hover.point = this.getSnappedPropHoverPoint(hit) ?? hit;
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
    if (this.shouldPreviewHoveredPlacement(hoveredPlacement)) {
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

    if (this.isIdentifyModifierActive()) {
      return null;
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
    preview.userData.builderBaseScale = preview.scale.clone();

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
      const movingScale = movingPlacement.layer === 'prop' ? this.getPropScaleDraft(movingPlacement) : 1;
      applyPreviewObjectScale(this.state.preview.object, movingScale);
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
        this.previewFootprint.scale.set((movingItem.size[0] * movingScale) + 0.35, (movingItem.size[1] * movingScale) + 0.35, 1);
      }

      this.previewRoot.rotation.y = getPlacementRotationY(movingPlacement);
      this.previewRoot.visible = true;
      return;
    }

    const hoveredPlacement = this.getHoveredPlacement();

    if (this.shouldPreviewHoveredPlacement(hoveredPlacement)) {
      const hoveredScale = hoveredPlacement.layer === 'prop' ? this.getPropScaleDraft(hoveredPlacement) : 1;
      applyPreviewObjectScale(this.state.preview.object, hoveredScale);
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
        this.previewFootprint.scale.set((item.size[0] * hoveredScale) + 0.35, (item.size[1] * hoveredScale) + 0.35, 1);
      }
      this.previewRoot.rotation.y = getPlacementRotationY(hoveredPlacement);
      this.previewRoot.visible = true;
      return;
    }

    const activeScale = this.activeItem.layer === 'prop' ? this.state.propScale : 1;
    applyPreviewObjectScale(this.state.preview.object, activeScale);

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
      this.previewFootprint.scale.set((this.activeItem.size[0] * activeScale) + 0.35, (this.activeItem.size[1] * activeScale) + 0.35, 1);
    }

    this.previewRoot.rotation.y = this.getActiveItemRotationY();
    this.previewRoot.visible = true;
  }

  updateCamera(camera) {
    this.cameraOffsetScratch.copy(EDITOR_CAMERA_OFFSET).multiplyScalar(this.state.zoom);
    this.cameraTargetScratch.copy(this.state.focus).add(this.cameraOffsetScratch);
    camera.position.lerp(this.cameraTargetScratch, 0.12);
    camera.lookAt(this.state.focus);
  }

  reportBuilderPresence(force = false) {
    if (!this.worldTransport?.setBuilderPresence) {
      return;
    }

    if (!this.canEdit) {
      return;
    }

    if (!this.state.enabled || !this.activeItem) {
      this.worldTransport.setBuilderPresence({ active: false, force });
      return;
    }

    const hoverPoint = this.state.hover.point;
    const hoverCell = this.state.hover.cell;
    const selectedPlacement = this.getSelectedPlacement();
    const fallbackPosition = selectedPlacement?.position
      ? { x: selectedPlacement.position[0], z: selectedPlacement.position[1] }
      : { x: this.state.focus.x, z: this.state.focus.z };

    const rotationY = this.getActiveItemRotationY();
    this.worldTransport.setBuilderPresence({
      active: true,
      itemId: this.activeItem.id,
      layer: this.activeItem.layer,
      rotationQuarterTurns: this.getActiveItemRotationQuarterTurns(),
      rotationY: quantizeRotation(rotationY),
      scale: this.activeItem.layer === 'prop' ? this.state.propScale : 1,
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
    const rotationY = this.getActivePropRotationY();
    const result = await this.worldEditAdapter.edit({
      op: 'placeProp',
      item,
      x: this.state.hover.point.x,
      z: this.state.hover.point.z,
      rotationQuarterTurns: toQuarterTurns(rotationY),
      rotationY: quantizeRotation(rotationY),
      scale: this.state.propScale
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
    const policeOfficerEnabled = POLICE_DEFAULT_MODEL_IDS.has(item.modelId);
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
        interactRadius: NPC_DEFAULT_INTERACT_RADIUS,
        policeOfficerEnabled,
        lawRadius: NPC_DEFAULT_LAW_RADIUS,
        combat: policeOfficerEnabled
          ? {
              archetype: NPC_COMBAT_ARCHETYPES.police,
              aggroRadius: 28,
              leashRadius: 44,
              weaponId: WEAPON_IDS.pistol
            }
          : undefined,
        gymCheckInEnabled: item.modelId === 'remy',
        rentCollectorEnabled: false,
        stockMarketEnabled: false,
        bartenderEnabled: false,
        pawnShopOwnerEnabled: false,
        carDealerEnabled: false,
        marthaEnabled: false,
        blackjackDealerEnabled: false,
        schoolMicrogameEnabled: false,
        schoolMicrogameId: 'all'
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
    this.updateBuilderHud({ syncPreviews: this.state.enabled });
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
    } else if (patch.type === 'updateMissionSequence') {
      this.worldState.updateMissionSequence(patch.missionSequence);
      this.updateBuilderHud();
    } else if (patch.type === 'updatePassiveTrafficRoutes') {
      this.worldState.updatePassiveTrafficRoutes(patch.passiveTrafficRoutes);
      this.worldRenderer.setPassiveTrafficRoutes(this.worldState.getPassiveTrafficRoutes());
      this.updateBuilderHud();
    } else if (patch.type === 'updateNpcModelVoice') {
      this.worldState.updateNpcModelVoice(patch.modelId, patch.voice);
      this.updateBuilderHud();
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

  getMissionSequence() {
    return this.worldState.getMissionSequence();
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
      if (nextPlacement.layer === 'prop') {
        this.state.propScale = getPlacementScale(nextPlacement);
      }
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
    this.clearPendingPropScaleUpdate(placementId);
    this.worldState.deletePlacement(placementId);
    this.worldRenderer.removePlacement(placementId);
    if (this.state.selection.placementId === placementId) {
      this.clearSelection();
    }
  }

  clearPlacements() {
    this.clearInteriorPlacementPreview();
    for (const placementId of this.pendingPropScaleByPlacementId.keys()) {
      this.clearPendingPropScaleUpdate(placementId);
    }
    this.worldState.clear();
    this.worldRenderer.clear();
    this.worldRenderer.setPassiveTrafficRoutes(this.worldState.getPassiveTrafficRoutes());
    this.remoteBuilderRenderer.clear();
  }

  selectPlacement(placementId) {
    if (this.isMovingSelection() && this.activeMovePlacementId !== placementId) {
      this.cancelMoveSelection();
    }

    this.state.selection.placementId = placementId;
    const placement = this.getSelectedPlacement();

    if (placement?.layer === 'prop') {
      this.state.propScale = getPlacementScale(placement);
      this.updateBuilderHud();
    }

    if (placement?.layer === 'npc') {
      let npcCategory = null;
      for (const entry of BUILDER_CATEGORIES) {
        if (entry.id === 'npcs') {
          npcCategory = entry;
          break;
        }
      }
      let npcItemIndex = -1;
      const npcItems = npcCategory?.items ?? [];
      for (let index = 0; index < npcItems.length; index += 1) {
        if (npcItems[index].id === placement.itemId) {
          npcItemIndex = index;
          break;
        }
      }
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

    this.updateBuilderHud();
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
    this.syncActivePropScaleDefault();
    this.hud.setBuilderSelection(null);
    this.hud.setBuilderNpcEditor(null);
    this.hud.setBuilderBuildingEditor(null);
    this.updateBuilderHud();
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

      const center = bounds.getCenter(this.selectionCenterScratch);
      const size = bounds.getSize(this.selectionSizeScratch);
      const ringScale = Math.max(1, Math.max(size.x, size.z) / 4.5);
      this.selectionRing.visible = true;
      this.selectionRing.position.set(center.x, bounds.min.y + 0.08, center.z);
      this.selectionRing.scale.setScalar(ringScale);

      const anchor = this.selectionAnchorScratch.set(center.x, bounds.max.y + 2.2, center.z);
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
    const center = bounds.getCenter(this.selectionCenterScratch);
    const size = bounds.getSize(this.selectionSizeScratch);
    const ringScale = Math.max(1, Math.max(size.x, size.z) / 4.5);
    this.selectionRing.visible = true;
    this.selectionRing.position.set(center.x, bounds.min.y + 0.08, center.z);
    this.selectionRing.scale.setScalar(ringScale);

    const anchor = this.selectionAnchorScratch.set(center.x, bounds.max.y + 2.2, center.z);
    const projected = anchor.project(this.camera);
    const screenX = screenClamp(((projected.x + 1) * 0.5) * window.innerWidth, 100, window.innerWidth - 100);
    const screenY = screenClamp(((-projected.y + 1) * 0.5) * window.innerHeight, 80, window.innerHeight - 100);

    this.hud.setBuilderSelection({ screenX, screenY, moving: false });
  }

  npcTargetSupportsStep(target = null, stepType = '') {
    for (const supportedStepType of target?.supportedStepTypes ?? []) {
      if (supportedStepType === stepType) {
        return true;
      }
    }
    return false;
  }

  updateNpcTargetPickVisual() {
    if (!this.npcTargetPickState || !this.visible || !this.state.enabled || !this.state.hover.point) {
      this.npcTargetPickMarker.visible = false;
      return;
    }

    const hoveredPlacement = this.getHoveredPlacement();
    const target = hoveredPlacement ? resolveNpcTargetOption(hoveredPlacement) : null;
    const supportsStep = Boolean(target && this.npcTargetSupportsStep(target, this.npcTargetPickState.stepType));
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
      const size = bounds.getSize(this.selectionSizeScratch);
      markerScale = THREE.MathUtils.clamp(Math.max(size.x, size.z) / 4, 0.9, 1.8);
    }
    this.npcTargetPickMarker.scale.setScalar(markerScale);
    this.npcTargetPickMarker.visible = true;
  }

  getNpcTargetOptions() {
    const revision = this.worldState.getPlacementRevision();
    if (this.npcTargetOptionsRevision === revision) {
      return this.npcTargetOptionsCache;
    }

    this.npcTargetOptionsRevision = revision;
    this.npcTargetOptionMapRevision = null;
    this.npcTargetOptionMapCache = new Map();
    const targetOptions = collectNpcTargetOptions(this.worldState);
    this.npcTargetOptionsCache = [];
    for (const option of targetOptions) {
      const supportedStepTypes = [];
      for (const stepType of option.supportedStepTypes ?? []) {
        supportedStepTypes.push(stepType);
      }
      this.npcTargetOptionsCache.push({
        ...option,
        id: option.placementId,
        displayLabel: option.label,
        label: `${option.label} (${option.placementId})`,
        supportedStepTypes
      });
    }
    return this.npcTargetOptionsCache;
  }

  getNpcTargetOptionMap() {
    const revision = this.worldState.getPlacementRevision();
    if (this.npcTargetOptionMapRevision === revision) {
      return this.npcTargetOptionMapCache;
    }

    const optionMap = new Map();
    for (const option of this.getNpcTargetOptions()) {
      optionMap.set(option.id, option);
    }
    this.npcTargetOptionMapRevision = revision;
    this.npcTargetOptionMapCache = optionMap;
    return optionMap;
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

    if (!this.npcTargetSupportsStep(target, pickState.stepType)) {
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
    const targetOptionMap = this.getNpcTargetOptionMap();
    const warnings = [];
    const steps = [];
    const routineSteps = routine.steps ?? [];
    for (let index = 0; index < routineSteps.length; index += 1) {
      const step = routineSteps[index];
      const supportedTargetOptions = [];
      for (const option of targetOptions) {
        if (this.npcTargetSupportsStep(option, step.type)) {
          supportedTargetOptions.push(option);
        }
      }
      let warning = '';

      if (step.targetPlacementId) {
        const target = targetOptionMap.get(step.targetPlacementId);
        if (!target) {
          warning = `Step ${index + 1} points at a missing placement and will be skipped at runtime.`;
        } else if (!this.npcTargetSupportsStep(target, step.type)) {
          warning = `Step ${index + 1} targets ${target.label}, but that destination does not support ${titleCaseLabel(step.type)}.`;
        }
      }

      if (warning) {
        warnings.push(warning);
      }

      steps.push({
        ...step,
        targetOptions: supportedTargetOptions,
        pickModeActive: this.npcTargetPickState?.placementId === placement.id
          && this.npcTargetPickState?.stepIndex === index,
        warning
      });
    }

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
    const models = [];
    for (const entry of NPC_MODEL_CATALOG) {
      models.push({
        id: entry.id,
        label: entry.label,
        portraitSrc: entry.portraitFileName
          ? `/assets/mixamo/portraits/${entry.portraitFileName}`
          : ''
      });
    }
    const npcStepTypes = listNpcStepTypes();
    const stepTypes = [];
    for (const stepType of npcStepTypes) {
      stepTypes.push({
        id: stepType,
        label: titleCaseLabel(stepType)
      });
    }
    const combatArchetypes = [];
    for (const archetype of listNpcCombatArchetypes()) {
      combatArchetypes.push({
        id: archetype,
        label: titleCaseLabel(archetype)
      });
    }
    this.hud.setBuilderNpcEditor({
      id: placement.id,
      title: npcDraft?.name || model?.label || 'NPC',
      subtitle: `${model?.label ?? 'NPC'} at ${placement.position[0].toFixed(1)}, ${placement.position[1].toFixed(1)}`,
      modelId: npcDraft?.modelId ?? placement.npc.modelId,
      name: npcDraft?.name ?? placement.npc.name,
      prompt: npcDraft?.prompt ?? placement.npc.prompt,
      interactRadius: npcDraft?.interactRadius ?? placement.npc.interactRadius,
      policeOfficerEnabled: isPoliceOfficerNpc(npcDraft),
      lawRadius: getNpcLawRadius(npcDraft ?? placement.npc),
      speed: npcDraft?.speed ?? placement.npc.speed ?? 'slow',
      respawnDelayMs: npcDraft?.respawnDelayMs ?? placement.npc.respawnDelayMs ?? 0,
      deliveryQuestEnabled: (npcDraft?.deliveryQuestEnabled ?? placement.npc.deliveryQuestEnabled) === true,
      gymCheckInEnabled: (npcDraft?.gymCheckInEnabled ?? placement.npc.gymCheckInEnabled) === true,
      rentCollectorEnabled: (npcDraft?.rentCollectorEnabled ?? placement.npc.rentCollectorEnabled) === true,
      stockMarketEnabled: (npcDraft?.stockMarketEnabled ?? placement.npc.stockMarketEnabled) === true,
      bartenderEnabled: (npcDraft?.bartenderEnabled ?? placement.npc.bartenderEnabled) === true,
      pawnShopOwnerEnabled: (npcDraft?.pawnShopOwnerEnabled ?? placement.npc.pawnShopOwnerEnabled) === true,
      carDealerEnabled: (npcDraft?.carDealerEnabled ?? placement.npc.carDealerEnabled) === true,
      marthaEnabled: (npcDraft?.marthaEnabled ?? placement.npc.marthaEnabled) === true,
      blackjackDealerEnabled: (npcDraft?.blackjackDealerEnabled ?? placement.npc.blackjackDealerEnabled) === true,
      schoolMicrogameEnabled: (npcDraft?.schoolMicrogameEnabled ?? placement.npc.schoolMicrogameEnabled) === true,
      schoolMicrogameId: npcDraft?.schoolMicrogameId ?? placement.npc.schoolMicrogameId ?? 'all',
      modelVoice: this.worldState.getNpcModelVoice(npcDraft?.modelId ?? placement.npc.modelId),
      selectionActions: {
        moving: this.activeMovePlacementId === placement.id
      },
      models,
      routine,
      warnings: routine.warnings,
      stepTypes,
      newStepType: npcStepTypes[0],
      combat: {
        archetype: combat.archetype,
        aggroRadius: Number(combat.aggroRadius?.toFixed?.(2) ?? combat.aggroRadius ?? 0),
        leashRadius: Number(combat.leashRadius?.toFixed?.(2) ?? combat.leashRadius ?? 0),
        weaponId: combat.weaponId || ''
      },
      combatArchetypes,
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
      radius: quantizeNumber(draft.radius, 2),
      distance: quantizeNumber(draft.distance, 2)
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

  async updatePropSize(value) {
    const scale = normalizePropPlacementScale(value);
    this.state.propScale = scale;
    const placement = this.getSelectedPlacement();

    if (placement?.layer === 'prop') {
      this.queuePropScaleUpdate(placement.id, scale);
    }

    this.updateBuilderHud();
    this.updatePreviewTransform();
    this.updateSelectionVisual();
    this.reportBuilderPresence(true);
  }

  queuePropScaleUpdate(placementId, scale) {
    this.pendingPropScaleByPlacementId.set(placementId, normalizePropPlacementScale(scale));
    window.clearTimeout(this.pendingPropScaleTimeouts.get(placementId));
    const timeoutId = window.setTimeout(() => {
      void this.flushPropScaleUpdate(placementId);
    }, 150);
    this.pendingPropScaleTimeouts.set(placementId, timeoutId);
  }

  clearPendingPropScaleUpdate(placementId) {
    this.pendingPropScaleByPlacementId.delete(placementId);
    window.clearTimeout(this.pendingPropScaleTimeouts.get(placementId));
    this.pendingPropScaleTimeouts.delete(placementId);
  }

  async flushPropScaleUpdate(placementId) {
    const scale = this.pendingPropScaleByPlacementId.get(placementId);
    this.pendingPropScaleByPlacementId.delete(placementId);
    window.clearTimeout(this.pendingPropScaleTimeouts.get(placementId));
    this.pendingPropScaleTimeouts.delete(placementId);

    if (!Number.isFinite(scale)) {
      return;
    }

    const placement = this.worldState.getPlacement(placementId);
    if (!placement || placement.layer !== 'prop') {
      return;
    }

    const result = await this.worldEditAdapter.edit({
      op: 'updatePlacementScale',
      placementId,
      scale
    });
    if (!result?.ok) {
      this.hud.showToast(result?.error ?? 'Could not resize prop.');
      return;
    }

    if (result.appliedImmediately) {
      this.updateSelectionVisual();
      this.updateBuilderHud();
      this.notifyLayoutChanged();
    }
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

    const nextChanges = collectDefinedChanges(changes);
    if (!nextChanges) {
      return;
    }

    this.queueBuildingUpdate(placement.id, nextChanges);
  }

  async updateSelectedNpc(changes = {}) {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc') {
      return;
    }

    const nextChanges = collectDefinedChanges(changes);
    if (!nextChanges) {
      return;
    }

    this.queueNpcUpdate(placement.id, nextChanges);
  }

  async updateSelectedNpcPoliceOfficer(enabled) {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc' || !placement.npc) {
      return;
    }

    const combat = this.getNpcCombatDraft(placement);
    const nextEnabled = enabled === true;
    await this.updateSelectedNpc({
      policeOfficerEnabled: nextEnabled,
      lawRadius: getNpcLawRadius(this.getNpcDraft(placement)),
      combat: {
        ...combat,
        archetype: nextEnabled ? NPC_COMBAT_ARCHETYPES.police : NPC_COMBAT_ARCHETYPES.passive,
        weaponId: nextEnabled ? (combat.weaponId || WEAPON_IDS.pistol) : ''
      }
    });
  }

  async addSelectedNpcRoutineStep(stepType) {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc' || !placement.npc) {
      return;
    }

    const routine = this.getNpcRoutineDraft(placement);
    const nextStep = createDefaultNpcRoutineStep(stepType);
    const steps = [];
    for (const step of routine.steps ?? []) {
      steps.push(step);
    }
    steps.push(nextStep);
    await this.updateSelectedNpc({
      routine: {
        ...routine,
        steps
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

    const steps = [];
    for (let index = 0; index < routine.steps.length; index += 1) {
      if (index !== stepIndex) {
        steps.push(routine.steps[index]);
      }
    }
    await this.updateSelectedNpc({
      routine: {
        ...routine,
        steps
      }
    });
  }

  async updateSelectedNpcRoutineStep(stepIndex, field, value) {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc' || !placement.npc) {
      return;
    }

    const routine = this.getNpcRoutineDraft(placement);
    const steps = [];
    for (const step of routine.steps ?? []) {
      steps.push(step);
    }
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
    if (field === 'archetype') {
      const policeOfficerEnabled = value === NPC_COMBAT_ARCHETYPES.police;
      await this.updateSelectedNpc({
        combat: {
          ...nextCombat,
          weaponId: policeOfficerEnabled ? (nextCombat.weaponId || WEAPON_IDS.pistol) : nextCombat.weaponId
        },
        policeOfficerEnabled,
        lawRadius: getNpcLawRadius(this.getNpcDraft(placement))
      });
      return;
    }

    await this.updateSelectedNpc({ combat: nextCombat });
  }

  async updateSelectedNpcModelVoice(voice = {}) {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc' || !placement.npc) {
      return;
    }

    const modelId = this.getNpcDraft(placement)?.modelId ?? placement.npc.modelId;
    const model = getNpcModelById(modelId);
    if (!model) {
      return;
    }

    const nextVoice = normalizeNpcVoice(voice, this.worldState.getNpcModelVoice(model.id));
    const result = await this.worldEditAdapter.edit({
      op: 'updateNpcModelVoice',
      modelId: model.id,
      voice: nextVoice
    });
    if (!result?.ok) {
      this.hud.showToast(result?.error ?? 'Could not update NPC model voice.');
      return;
    }

    if (result.appliedImmediately) {
      this.worldState.updateNpcModelVoice(model.id, nextVoice);
      this.updateBuilderNpcEditor();
      this.notifyLayoutChanged();
    }
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
