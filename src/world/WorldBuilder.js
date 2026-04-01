import * as THREE from 'three';
import { BUILDER_CATEGORIES, BUILDER_TILE_SIZE, getBuilderItem, getBuilderItemById } from './builderCatalog.js';

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

function setShadowFlags(root) {
  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
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

function createCollisionBox(object, padding = 0.2) {
  return new THREE.Box3().setFromObject(object).expandByScalar(padding);
}

function getCellKey(x, z) {
  return `${x},${z}`;
}

function snapToCell(worldPosition) {
  return {
    x: Math.round(worldPosition.x / BUILDER_TILE_SIZE),
    z: Math.round(worldPosition.z / BUILDER_TILE_SIZE)
  };
}

function extractPlacementId(node) {
  let current = node;
  while (current) {
    if (current.userData?.editorPlacementId) {
      return current.userData.editorPlacementId;
    }
    current = current.parent;
  }
  return null;
}

function screenClamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toRotationY(rotationQuarterTurns) {
  return rotationQuarterTurns * (Math.PI / 2);
}

function createDefaultEditorState() {
  return {
    enabled: false,
    focus: new THREE.Vector3(0, 0, 0),
    zoom: 1,
    pointer: new THREE.Vector2(2, 2),
    activeCategoryId: BUILDER_CATEGORIES[0].id,
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
  constructor({ scene, camera, domElement, library, hud, onToggleBuildMode }) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.library = library;
    this.hud = hud;
    this.onToggleBuildMode = onToggleBuildMode ?? (() => {});

    this.state = createDefaultEditorState();
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.previewLoadToken = 0;

    this.tileRoot = new THREE.Group();
    this.propRoot = new THREE.Group();
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
    this.scene.add(this.tileRoot);
    this.scene.add(this.propRoot);
    this.scene.add(this.previewRoot);
    this.scene.add(this.selectionRing);

    this.tilePlacements = new Map();
    this.propPlacements = new Map();
    this.placementsById = new Map();
    this.placementSequence = 0;
    this.builderCollisions = [];

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
      onSelectTile: (index) => this.selectItem(index),
      onCopyLayout: () => this.copyLayoutToClipboard(),
      onRotateSelection: () => this.rotateSelectedPlacement(),
      onDeleteSelection: () => this.deleteSelectedPlacement(),
      onConfirmSelection: () => this.clearSelection()
    });
    this.hud.setBuilderState(this.getHudState());
    this.hud.setBuilderSelection(null);
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

  getHudState() {
    return {
      enabled: this.state.enabled,
      rotationQuarterTurns: this.state.rotationQuarterTurns,
      selectedIndex: this.state.activeItemIndex,
      categories: BUILDER_CATEGORIES,
      activeCategoryId: this.state.activeCategoryId
    };
  }

  getCollisionBoxes() {
    return this.builderCollisions;
  }

  getInteractables() {
    return [...this.placementsById.values()]
      .filter((placement) => placement.interactable)
      .map((placement) => {
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          toRotationY(placement.rotationQuarterTurns)
        );
        const distance = placement.interactable.distance ?? BUILDER_TILE_SIZE * 0.44;
        return {
          position: placement.position.clone().addScaledVector(forward, distance),
          radius: placement.interactable.radius ?? 4,
          prompt: placement.interactable.prompt ?? `Enter ${placement.interactable.label ?? placement.catalogItem.label}`,
          actionText: placement.interactable.actionText ?? `${placement.catalogItem.label} is not hooked up yet.`
        };
      });
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

    this.hud.setBuilderState(this.getHudState());

    if (enabled) {
      this.resolveHoverState();
      await this.syncPreviewToState(true);
      this.updatePreviewTransform();
    } else {
      this.hud.setBuilderSelection(null);
    }
  }

  selectCategory(categoryId) {
    this.state.activeCategoryId = categoryId;
    this.state.activeItemIndex = 0;
    this.hud.setBuilderState(this.getHudState());
    void this.syncPreviewToState(true);
  }

  selectItem(index) {
    const maxIndex = this.activeCategory.items.length - 1;
    this.state.activeItemIndex = THREE.MathUtils.clamp(index, 0, maxIndex);
    this.hud.setBuilderState(this.getHudState());
    void this.syncPreviewToState(true);
  }

  rotate(delta) {
    this.state.rotationQuarterTurns = (this.state.rotationQuarterTurns + delta + 4) % 4;
    this.hud.setBuilderState(this.getHudState());
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
      this.selectItem((this.state.activeItemIndex + 1) % this.activeCategory.items.length);
    }
    if (input.consume('BracketLeft')) {
      this.selectItem((this.state.activeItemIndex - 1 + this.activeCategory.items.length) % this.activeCategory.items.length);
    }
    if (input.consume('Tab')) {
      const currentIndex = BUILDER_CATEGORIES.findIndex((entry) => entry.id === this.state.activeCategoryId);
      const nextCategory = BUILDER_CATEGORIES[(currentIndex + 1) % BUILDER_CATEGORIES.length];
      this.selectCategory(nextCategory.id);
    }

    for (let i = 0; i < Math.min(9, this.activeCategory.items.length); i += 1) {
      if (input.consume(`Digit${i + 1}`)) {
        this.selectItem(i);
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
    const hoveredPropId = this.pickPlacementId(this.propRoot.children);
    const hoveredTile = this.tilePlacements.get(getCellKey(hoverCell.x, hoverCell.z)) ?? null;

    this.state.hover.point = hit;
    this.state.hover.cell = hoverCell;
    this.state.hover.placementId = hoveredPropId ?? hoveredTile?.id ?? null;
  }

  getHoveredPlacement() {
    return this.state.hover.placementId
      ? this.placementsById.get(this.state.hover.placementId) ?? null
      : null;
  }

  getSelectedPlacement() {
    return this.state.selection.placementId
      ? this.placementsById.get(this.state.selection.placementId) ?? null
      : null;
  }

  getPreviewTarget() {
    const hoveredPlacement = this.getHoveredPlacement();
    if (hoveredPlacement) {
      return {
        item: hoveredPlacement.catalogItem,
        opacity: 0.5,
        key: `placement:${hoveredPlacement.catalogItem.id}:0.5`
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
        this.previewRoot.position.set(hoveredPlacement.position.x, 0, hoveredPlacement.position.z);
      }
      this.previewFootprint.scale.set(
        hoveredPlacement.catalogItem.size[0] + (hoveredPlacement.layer === 'tile' ? -0.6 : 0.35),
        hoveredPlacement.catalogItem.size[1] + (hoveredPlacement.layer === 'tile' ? -0.6 : 0.35),
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

  pickPlacementId(roots) {
    if (!roots.length) {
      return null;
    }

    this.raycaster.setFromCamera(this.state.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects([...roots], true);
    return intersections.length ? extractPlacementId(intersections[0].object) : null;
  }

  async placeCurrentItem() {
    if (!this.activeItem || !this.state.hover.point) {
      return;
    }

    if (this.activeItem.layer === 'tile') {
      await this.placeTile(this.activeItem);
      return;
    }

    await this.placeProp(this.activeItem);
  }

  async placeTile(item) {
    const { cell } = this.state.hover;
    if (!cell) {
      return;
    }

    const existing = this.tilePlacements.get(getCellKey(cell.x, cell.z));
    if (existing) {
      this.unregisterPlacement(existing);
    }

    await this.createPlacement({
      item,
      position: new THREE.Vector3(cell.x * BUILDER_TILE_SIZE, 0, cell.z * BUILDER_TILE_SIZE),
      rotationQuarterTurns: this.state.rotationQuarterTurns,
      cellX: cell.x,
      cellZ: cell.z
    });
    this.rebuildCollisionBoxes();
    this.hud.showToast(`Placed ${item.label}`);
  }

  async placeProp(item) {
    await this.createPlacement({
      item,
      position: new THREE.Vector3(this.state.hover.point.x, 0, this.state.hover.point.z),
      rotationQuarterTurns: this.state.rotationQuarterTurns
    });
    this.rebuildCollisionBoxes();
    this.hud.showToast(`Placed ${item.label}`);
  }

  async createPlacement({ item, position, rotationQuarterTurns, cellX = null, cellZ = null, interactable = null }) {
    const object = await this.library.instantiate(item.asset);
    setShadowFlags(object);
    fitToFootprint(object, item.size[0], item.size[1]);
    snapToGround(object);
    object.position.set(position.x, 0, position.z);
    object.rotation.y = toRotationY(rotationQuarterTurns);

    const placement = {
      id: `placement_${++this.placementSequence}`,
      catalogItem: item,
      layer: item.layer,
      object,
      position: object.position.clone(),
      rotationQuarterTurns,
      cellX,
      cellZ,
      interactable,
      collisionBox: item.collision ? createCollisionBox(object, item.padding ?? 0.2) : null
    };

    object.userData.editorPlacementId = placement.id;
    this.registerPlacement(placement);
    return placement;
  }

  registerPlacement(placement) {
    this.placementsById.set(placement.id, placement);

    if (placement.layer === 'tile') {
      this.tilePlacements.set(getCellKey(placement.cellX, placement.cellZ), placement);
      this.tileRoot.add(placement.object);
      return;
    }

    this.propPlacements.set(placement.id, placement);
    this.propRoot.add(placement.object);
  }

  unregisterPlacement(placement) {
    placement.object.parent?.remove(placement.object);
    this.placementsById.delete(placement.id);

    if (placement.layer === 'tile') {
      this.tilePlacements.delete(getCellKey(placement.cellX, placement.cellZ));
    } else {
      this.propPlacements.delete(placement.id);
    }

    if (this.state.selection.placementId === placement.id) {
      this.clearSelection();
    }
  }

  async loadLayout(layout = { tiles: [], props: [] }) {
    this.clearSelection();
    this.clearPlacements();

    for (const entry of layout.tiles ?? []) {
      const item = getBuilderItemById(entry.itemId);
      if (!item) {
        continue;
      }

      await this.createPlacement({
        item,
        position: new THREE.Vector3(entry.cell[0] * BUILDER_TILE_SIZE, 0, entry.cell[1] * BUILDER_TILE_SIZE),
        rotationQuarterTurns: entry.rotationQuarterTurns ?? 0,
        cellX: entry.cell[0],
        cellZ: entry.cell[1],
        interactable: entry.interactable ?? null
      });
    }

    for (const entry of layout.props ?? []) {
      const item = getBuilderItemById(entry.itemId);
      if (!item) {
        continue;
      }

      await this.createPlacement({
        item,
        position: new THREE.Vector3(entry.position[0], 0, entry.position[1]),
        rotationQuarterTurns: entry.rotationQuarterTurns ?? 0,
        interactable: entry.interactable ?? null
      });
    }

    this.rebuildCollisionBoxes();
    this.resolveHoverState();
    await this.syncPreviewToState(true);
  }

  clearPlacements() {
    this.tilePlacements.clear();
    this.propPlacements.clear();
    this.placementsById.clear();
    this.placementSequence = 0;
    this.tileRoot.clear();
    this.propRoot.clear();
    this.builderCollisions = [];
  }

  selectPlacement(placementId) {
    this.state.selection.placementId = placementId;
    this.updateSelectionVisual();
  }

  clearSelection() {
    this.state.selection.placementId = null;
    this.selectionRing.visible = false;
    this.hud.setBuilderSelection(null);
  }

  rotateSelectedPlacement() {
    const placement = this.getSelectedPlacement();
    if (!placement) {
      return;
    }

    placement.rotationQuarterTurns = (placement.rotationQuarterTurns + 1) % 4;
    placement.object.rotation.y = toRotationY(placement.rotationQuarterTurns);
    if (placement.collisionBox) {
      placement.collisionBox = createCollisionBox(placement.object, placement.catalogItem.padding ?? 0.2);
      this.rebuildCollisionBoxes();
    }
    this.updateSelectionVisual();
    this.resolveHoverState();
    void this.syncPreviewToState(true);
    this.hud.showToast(`Rotated ${placement.catalogItem.label}`);
  }

  deleteSelectedPlacement() {
    const placement = this.getSelectedPlacement();
    if (!placement) {
      return;
    }

    this.unregisterPlacement(placement);
    this.rebuildCollisionBoxes();
    this.resolveHoverState();
    void this.syncPreviewToState(true);
    this.hud.showToast(`Deleted ${placement.catalogItem.label}`);
  }

  rebuildCollisionBoxes() {
    this.builderCollisions = [...this.placementsById.values()]
      .map((placement) => placement.collisionBox)
      .filter(Boolean);
  }

  updateSelectionVisual() {
    const placement = this.getSelectedPlacement();
    if (!placement) {
      this.selectionRing.visible = false;
      this.hud.setBuilderSelection(null);
      return;
    }

    const bounds = new THREE.Box3().setFromObject(placement.object);
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

  async copyLayoutToClipboard() {
    const tiles = [...this.tilePlacements.values()]
      .sort((a, b) => (a.cellZ - b.cellZ) || (a.cellX - b.cellX))
      .map((placement) => ({
        itemId: placement.catalogItem.id,
        cell: [placement.cellX, placement.cellZ],
        rotationQuarterTurns: placement.rotationQuarterTurns,
        ...(placement.interactable ? { interactable: placement.interactable } : {})
      }));

    const props = [...this.propPlacements.values()]
      .sort((a, b) => (a.position.z - b.position.z) || (a.position.x - b.position.x))
      .map((placement) => ({
        itemId: placement.catalogItem.id,
        position: [
          Number(placement.position.x.toFixed(2)),
          Number(placement.position.z.toFixed(2))
        ],
        rotationQuarterTurns: placement.rotationQuarterTurns,
        ...(placement.interactable ? { interactable: placement.interactable } : {})
      }));

    const text = JSON.stringify({ tiles, props }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      this.hud.showToast('Copied world editor layout JSON to clipboard.');
    } catch (error) {
      console.error(error);
      this.hud.showToast('Could not copy layout. Clipboard access was denied.');
    }
  }
}
