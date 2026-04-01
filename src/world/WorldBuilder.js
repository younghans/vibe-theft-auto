import * as THREE from 'three';
import { getNpcModelById, NPC_MODEL_CATALOG } from '../npc/npcCatalog.js';
import { BuilderPreviewRenderer } from '../ui/BuilderPreviewRenderer.js';
import { BUILDER_CATEGORIES, BUILDER_TILE_SIZE, getBuilderItem, getBuilderItemById } from './builderCatalog.js';
import { WorldRenderer } from './WorldRenderer.js';
import { WorldState } from './WorldState.js';

const EDITOR_CAMERA_OFFSET = new THREE.Vector3(0, 88, 44);
const EDITOR_GRID_SIZE = BUILDER_TILE_SIZE * 18;
const EDITOR_PAN_SPEED = 28;
const EDITOR_ZOOM_MIN = 0.6;
const EDITOR_ZOOM_MAX = 1.5;
const PREVIEW_COLOR = new THREE.Color(0xf2c871);
const PREVIEW_RENDER_ORDER = 10;

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

function fitToFootprint(root, targetWidth, targetDepth) {
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const scaleX = size.x > 0 ? targetWidth / size.x : 1;
  const scaleZ = size.z > 0 ? targetDepth / size.z : 1;
  root.scale.multiplyScalar(Math.min(scaleX, scaleZ));
}

function snapToGround(root) {
  const bounds = new THREE.Box3().setFromObject(root);
  root.position.y -= bounds.min.y;
}

function snapToCell(worldPosition) {
  return {
    x: Math.round(worldPosition.x / BUILDER_TILE_SIZE),
    z: Math.round(worldPosition.z / BUILDER_TILE_SIZE)
  };
}

function screenClamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toRotationY(rotationQuarterTurns) {
  return rotationQuarterTurns * (Math.PI / 2);
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
  constructor({ scene, camera, domElement, library, hud, onToggleBuildMode, onLayoutChanged }) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.library = library;
    this.hud = hud;
    this.onToggleBuildMode = onToggleBuildMode ?? (() => {});
    this.onLayoutChanged = onLayoutChanged ?? (() => {});

    this.state = createDefaultEditorState();
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.previewLoadToken = 0;
    this.builderPreviewCategoryId = null;
    this.builderPreviewGroupId = null;
    this.builderPreviewGeneration = 0;
    this.worldState = new WorldState();
    this.worldRenderer = new WorldRenderer({ scene, camera, library });
    this.builderPreviewRenderer = new BuilderPreviewRenderer({ library });

    this.previewRoot = new THREE.Group();
    this.previewRoot.visible = false;
    this.gridHelper = new THREE.GridHelper(EDITOR_GRID_SIZE, 18, 0xf2c871, 0x406070);
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

    this.scene.add(this.gridHelper);
    this.scene.add(this.previewRoot);
    this.scene.add(this.selectionRing);

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
      onCopyLayout: () => this.copyLayoutToClipboard(),
      onRotateSelection: () => this.rotateSelectedPlacement(),
      onDeleteSelection: () => this.deleteSelectedPlacement(),
      onConfirmSelection: () => this.clearSelection(),
      onNpcNameChange: (value) => void this.updateSelectedNpc({ name: value }),
      onNpcPromptChange: (value) => void this.updateSelectedNpc({ prompt: value }),
      onNpcRadiusChange: (value) => void this.updateSelectedNpc({
        interactRadius: Number.isFinite(value) ? THREE.MathUtils.clamp(value, 1.5, 12) : undefined
      }),
      onNpcModelChange: (modelId) => void this.changeSelectedNpcModel(modelId)
    });
    this.updateBuilderHud();
    this.hud.setBuilderSelection(null);
    this.hud.setBuilderNpcEditor(null);
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
    const selectedEntry = visibleEntries.find((entry) => entry.index === this.state.activeItemIndex) ?? visibleEntries[0] ?? null;
    const selectedItem = selectedEntry?.item ?? this.activeItem ?? null;
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
      enabled: this.state.enabled,
      statusText: this.state.enabled
        ? 'Builder active. Left click places the selected piece. Click any existing tile, prop, or NPC to edit it.'
        : 'Use the hammer button to enter builder mode.',
      metaText: this.state.enabled
        ? `${activeCategory.description} Selected: ${selectedItem?.label ?? 'None'} | ${visibleEntries.length} items | Rotation ${this.state.rotationQuarterTurns * 90}deg`
        : 'When active, use tabs to switch layers and 1-9 to choose a piece.',
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
    const items = this.getVisibleCategoryEntries(categoryId).map(({ item }) => item);
    const generation = ++this.builderPreviewGeneration;

    for (const item of items) {
      try {
        const preview = await this.builderPreviewRenderer.render(item);
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

  getCollisionBoxes() {
    return this.worldRenderer.getCollisionBoxes();
  }

  getGroundHeightAt(worldPosition) {
    return this.worldRenderer.getGroundHeightAt(worldPosition, this.worldState);
  }

  getInteractables() {
    return this.worldRenderer.getInteractables(this.worldState);
  }

  getLayout() {
    return this.worldState.serializeLayout();
  }

  setNpcRuntimeState(npcStateMap) {
    this.worldRenderer.applyNpcRuntimeState(npcStateMap);
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

    if (event.target.closest('.hud__builder') || event.target.closest('.hud__selection')) {
      return;
    }

    const hoveredPlacement = this.getHoveredPlacement();

    if (event.button === 2) {
      event.preventDefault();
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

    if (hoveredPlacement) {
      this.selectPlacement(hoveredPlacement.id);
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

  async setEnabled(enabled) {
    this.state.enabled = enabled;
    this.gridHelper.visible = enabled;
    this.previewRoot.visible = enabled;

    if (!enabled) {
      this.clearSelection();
    } else if (Math.abs(this.state.pointer.x) > 1.2 || Math.abs(this.state.pointer.y) > 1.2) {
      this.state.pointer.set(0, 0);
    }

    this.updateBuilderHud({ syncPreviews: enabled });

    if (enabled) {
      this.resolveHoverState();
      await this.syncPreviewToState(true);
      this.updatePreviewTransform();
    } else {
      this.builderPreviewCategoryId = null;
      this.builderPreviewGroupId = null;
      this.hud.setBuilderSelection(null);
    }
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
    if (!this.state.enabled) {
      return;
    }

    if (input.consume('KeyR') || input.consume('KeyE')) {
      this.rotate(1);
    }
    if (input.consume('KeyQ')) {
      this.rotate(-1);
    }
    if (input.consume('KeyC')) {
      void this.copyLayoutToClipboard();
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

    const pan = input.getMovementVector();
    this.state.focus.x += pan.x * deltaSeconds * EDITOR_PAN_SPEED;
    this.state.focus.z += pan.z * deltaSeconds * EDITOR_PAN_SPEED;

    this.resolveHoverState();
    void this.syncPreviewToState();
    this.updatePreviewTransform();
    this.updateSelectionVisual();
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
    const hoveredTile = this.canEditHoveredTiles
      ? this.worldState.getPlacementAtCell(hoverCell.x, hoverCell.z)
      : null;

    this.state.hover.point = hit;
    this.state.hover.cell = hoverCell;
    this.state.hover.placementId = hoveredPropId ?? hoveredTile?.id ?? null;
  }

  getHoveredPlacement() {
    return this.worldState.getPlacement(this.state.hover.placementId);
  }

  getSelectedPlacement() {
    return this.worldState.getPlacement(this.state.selection.placementId);
  }

  getPreviewTarget() {
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
    const preview = await this.library.instantiate(previewTarget.item.asset);
    if (token !== this.previewLoadToken || this.state.preview.loadingKey !== previewTarget.key) {
      return;
    }

    applyPreviewMaterial(preview, previewTarget.opacity);
    fitToFootprint(preview, previewTarget.item.size[0], previewTarget.item.size[1]);
    snapToGround(preview);
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
    if (!this.state.enabled || !this.state.preview.object || !this.state.hover.point || !this.activeItem) {
      this.previewRoot.visible = false;
      return;
    }

    const hoveredPlacement = this.getHoveredPlacement();

    if (hoveredPlacement) {
      if (hoveredPlacement.layer === 'tile') {
        this.previewRoot.position.set(
          hoveredPlacement.cellX * BUILDER_TILE_SIZE,
          0,
          hoveredPlacement.cellZ * BUILDER_TILE_SIZE
        );
      } else {
        this.previewRoot.position.set(hoveredPlacement.position[0], 0, hoveredPlacement.position[1]);
      }
      const item = getBuilderItemById(hoveredPlacement.itemId);
      if (!item) {
        this.previewRoot.visible = false;
        return;
      }
      this.previewFootprint.scale.set(
        item.size[0] + (hoveredPlacement.layer === 'tile' ? -0.6 : 0.35),
        item.size[1] + (hoveredPlacement.layer === 'tile' ? -0.6 : 0.35),
        1
      );
      this.previewRoot.rotation.y = toRotationY(hoveredPlacement.rotationQuarterTurns);
      this.previewRoot.visible = true;
      return;
    }

    if (this.activeItem.layer === 'tile') {
      this.previewRoot.position.set(
        this.state.hover.cell.x * BUILDER_TILE_SIZE,
        0,
        this.state.hover.cell.z * BUILDER_TILE_SIZE
      );
      this.previewFootprint.scale.set(BUILDER_TILE_SIZE - 0.6, BUILDER_TILE_SIZE - 0.6, 1);
    } else {
      this.previewRoot.position.set(this.state.hover.point.x, 0, this.state.hover.point.z);
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

    const result = this.worldState.placeTile(item, cell.x, cell.z, this.state.rotationQuarterTurns);
    if (result.replacedPlacementId) {
      this.worldRenderer.removePlacement(result.replacedPlacementId);
    }
    await this.worldRenderer.addPlacement(result.placement);
    this.hud.showToast(`Placed ${item.label}`);
    this.notifyLayoutChanged();
  }

  async placeProp(item) {
    const placement = this.worldState.placeProp(
      item,
      this.state.hover.point.x,
      this.state.hover.point.z,
      this.state.rotationQuarterTurns
    );
    await this.worldRenderer.addPlacement(placement);
    this.hud.showToast(`Placed ${item.label}`);
    this.notifyLayoutChanged();
  }

  async placeNpc(item) {
    const placement = this.worldState.placeNpc(
      item,
      this.state.hover.point.x,
      this.state.hover.point.z,
      this.state.rotationQuarterTurns,
      {
        modelId: item.modelId,
        name: item.label,
        prompt: `You are ${item.label}, an NPC in Stick RPG 3D. Stay in character, keep answers grounded in the city, and respond in short, flavorful lines.`,
        interactRadius: item.interactionRadius ?? 4.2
      }
    );
    await this.worldRenderer.addPlacement(placement);
    this.selectPlacement(placement.id);
    this.hud.showToast(`Placed ${item.label}`);
    this.notifyLayoutChanged();
  }

  async loadLayout(layout = { tiles: [], props: [], npcs: [] }) {
    this.clearSelection();
    this.worldState.loadLayout(layout);
    await this.worldRenderer.syncFromState(this.worldState);
    this.resolveHoverState();
    await this.syncPreviewToState(true);
  }

  clearPlacements() {
    this.worldState.clear();
    this.worldRenderer.clear();
  }

  selectPlacement(placementId) {
    this.state.selection.placementId = placementId;
    this.updateSelectionVisual();
    this.updateBuilderNpcEditor();
  }

  clearSelection() {
    this.state.selection.placementId = null;
    this.selectionRing.visible = false;
    this.hud.setBuilderSelection(null);
    this.hud.setBuilderNpcEditor(null);
  }

  rotateSelectedPlacement() {
    const placement = this.getSelectedPlacement();
    if (!placement) {
      return;
    }

    const rotatedPlacement = this.worldState.rotatePlacement(placement.id);
    this.worldRenderer.updatePlacement(rotatedPlacement);
    this.updateSelectionVisual();
    this.resolveHoverState();
    void this.syncPreviewToState(true);
    const item = getBuilderItemById(placement.itemId);
    this.hud.showToast(`Rotated ${item?.label ?? 'piece'}`);
    this.notifyLayoutChanged();
  }

  deleteSelectedPlacement() {
    const placement = this.getSelectedPlacement();
    if (!placement) {
      return;
    }

    this.worldState.deletePlacement(placement.id);
    this.worldRenderer.removePlacement(placement.id);
    this.clearSelection();
    this.resolveHoverState();
    void this.syncPreviewToState(true);
    const item = getBuilderItemById(placement.itemId);
    this.hud.showToast(`Deleted ${item?.label ?? 'piece'}`);
    this.notifyLayoutChanged();
  }

  updateSelectionVisual() {
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
    this.selectionRing.position.set(center.x, 0.08, center.z);
    this.selectionRing.scale.setScalar(ringScale);

    const anchor = new THREE.Vector3(center.x, bounds.max.y + 2.2, center.z);
    const projected = anchor.project(this.camera);
    const screenX = screenClamp(((projected.x + 1) * 0.5) * window.innerWidth, 100, window.innerWidth - 100);
    const screenY = screenClamp(((-projected.y + 1) * 0.5) * window.innerHeight, 80, window.innerHeight - 100);

    this.hud.setBuilderSelection({ screenX, screenY });
  }

  updateBuilderNpcEditor() {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc' || !placement.npc) {
      this.hud.setBuilderNpcEditor(null);
      return;
    }

    this.hud.setBuilderNpcEditor({
      id: placement.id,
      modelId: placement.npc.modelId,
      name: placement.npc.name,
      prompt: placement.npc.prompt,
      interactRadius: placement.npc.interactRadius,
      models: NPC_MODEL_CATALOG.map((entry) => ({
        id: entry.id,
        label: entry.label
      }))
    });
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

    const updatedPlacement = this.worldState.updateNpc(placement.id, nextChanges);
    if (!updatedPlacement) {
      return;
    }

    this.worldRenderer.updatePlacement(updatedPlacement);
    this.updateSelectionVisual();
    this.updateBuilderNpcEditor();
    this.notifyLayoutChanged();
  }

  async changeSelectedNpcModel(modelId) {
    const placement = this.getSelectedPlacement();
    if (!placement || placement.layer !== 'npc') {
      return;
    }

    const model = getNpcModelById(modelId);
    if (!model) {
      return;
    }

    const updatedPlacement = this.worldState.updateNpc(placement.id, {
      modelId,
      itemId: model.itemId
    });
    if (!updatedPlacement) {
      return;
    }

    updatedPlacement.itemId = model.itemId;
    updatedPlacement.npc.modelId = modelId;
    this.worldRenderer.removePlacement(placement.id);
    await this.worldRenderer.addPlacement(updatedPlacement);
    this.updateSelectionVisual();
    this.updateBuilderNpcEditor();
    this.notifyLayoutChanged();
  }

  notifyLayoutChanged() {
    this.onLayoutChanged(this.worldState.serializeLayout());
  }

  async copyLayoutToClipboard() {
    const text = JSON.stringify(this.worldState.serializeLayout(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      this.hud.showToast('Copied world editor layout JSON to clipboard.');
    } catch (error) {
      console.error(error);
      this.hud.showToast('Could not copy layout. Clipboard access was denied.');
    }
  }
}
