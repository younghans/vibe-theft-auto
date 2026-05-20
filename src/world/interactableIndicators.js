import * as THREE from 'three';

const INDICATOR_TEXTURE_HEIGHT = 256;
const TEXT_TEXTURE_MAX_WIDTH = 1024;
const TEXT_TEXTURE_MIN_WIDTH = 360;
const INDICATOR_TEXT_Y = 76;
const INDICATOR_CIRCLE_CENTER_Y = 176;
const INDICATOR_CIRCLE_RADIUS = 38;
const INDICATOR_CIRCLE_LINE_WIDTH = 6;
const INDICATOR_SCREEN_HEIGHT = 0.07;
const INDICATOR_RENDER_ORDER = 42;
export const INTERACTABLE_INDICATOR_LAYER = 7;

const indicatorTextureCache = new Map();
const WORLD_SCALE_SCRATCH = new THREE.Vector3();

function hasFiniteBox(box) {
  return Boolean(
    box
    && Number.isFinite(box.min?.x)
    && Number.isFinite(box.min?.y)
    && Number.isFinite(box.min?.z)
    && Number.isFinite(box.max?.x)
    && Number.isFinite(box.max?.y)
    && Number.isFinite(box.max?.z)
  );
}

export function formatInteractableIndicatorText(value = '') {
  return String(value ?? '').trim().toLowerCase();
}

function getIndicatorTexture(text) {
  const normalizedText = formatInteractableIndicatorText(text);
  if (!normalizedText) {
    return null;
  }
  if (indicatorTextureCache.has(normalizedText)) {
    return indicatorTextureCache.get(normalizedText);
  }
  if (typeof document === 'undefined') {
    return null;
  }

  const measureCanvas = document.createElement('canvas');
  const measureContext = measureCanvas.getContext('2d');
  if (!measureContext) {
    return null;
  }

  let fontSize = 50;
  const fontFamily = '"Inter", "Segoe UI", Arial, sans-serif';
  measureContext.font = `800 ${fontSize}px ${fontFamily}`;
  while (
    fontSize > 34
    && measureContext.measureText(normalizedText).width > TEXT_TEXTURE_MAX_WIDTH - 128
  ) {
    fontSize -= 2;
    measureContext.font = `800 ${fontSize}px ${fontFamily}`;
  }

  const textWidth = measureContext.measureText(normalizedText).width;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(Math.min(
    TEXT_TEXTURE_MAX_WIDTH,
    Math.max(TEXT_TEXTURE_MIN_WIDTH, textWidth + 96)
  ));
  canvas.height = INDICATOR_TEXTURE_HEIGHT;

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  const labelCenterX = canvas.width * 0.5;

  context.font = `800 ${fontSize}px ${fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = 'rgba(0, 234, 255, 1)';
  context.shadowBlur = 18;
  context.fillStyle = '#ffffff';
  context.fillText(normalizedText, labelCenterX, INDICATOR_TEXT_Y);
  context.shadowBlur = 0;

  context.beginPath();
  context.arc(
    labelCenterX,
    INDICATOR_CIRCLE_CENTER_Y,
    INDICATOR_CIRCLE_RADIUS,
    0,
    Math.PI * 2
  );
  context.shadowColor = 'rgba(0, 234, 255, 1)';
  context.shadowBlur = 24;
  context.strokeStyle = '#ffffff';
  context.lineWidth = INDICATOR_CIRCLE_LINE_WIDTH;
  context.stroke();
  context.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.aspect = canvas.width / canvas.height;
  texture.userData.anchorY = (canvas.height - INDICATOR_CIRCLE_CENTER_Y) / canvas.height;
  texture.needsUpdate = true;
  indicatorTextureCache.set(normalizedText, texture);
  return texture;
}

function getObjectMeshBounds(object) {
  const bounds = new THREE.Box3().makeEmpty();
  const nodeBounds = new THREE.Box3();
  object?.updateWorldMatrix?.(true, true);
  object?.traverse?.((node) => {
    if (!node.isMesh || !node.geometry) {
      return;
    }
    if (!node.geometry.boundingBox) {
      node.geometry.computeBoundingBox();
    }
    nodeBounds.copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);
    if (hasFiniteBox(nodeBounds)) {
      bounds.union(nodeBounds);
    }
  });
  return hasFiniteBox(bounds) ? bounds : null;
}

function getIndicatorAnchorPosition(object, options = {}) {
  if (Array.isArray(options.localPosition) && options.localPosition.length >= 3) {
    return new THREE.Vector3(
      Number(options.localPosition[0]) || 0,
      Number(options.localPosition[1]) || 0,
      Number(options.localPosition[2]) || 0
    );
  }

  const bounds = getObjectMeshBounds(object);
  if (!bounds) {
    return new THREE.Vector3(0, Number(options.fallbackY ?? 1.2) || 1.2, 0);
  }

  const localCenter = object.worldToLocal(bounds.getCenter(new THREE.Vector3()));
  localCenter.y += Number(options.verticalOffset ?? 0) || 0;
  if (Number.isFinite(Number(options.minLocalY))) {
    localCenter.y = Math.max(localCenter.y, Number(options.minLocalY));
  }
  return localCenter;
}

function preserveWorldScale(indicator, object) {
  const worldScale = object.getWorldScale(WORLD_SCALE_SCRATCH);
  indicator.scale.set(
    worldScale.x ? 1 / worldScale.x : 1,
    worldScale.y ? 1 / worldScale.y : 1,
    worldScale.z ? 1 / worldScale.z : 1
  );
}

function setIndicatorLayer(object) {
  object?.traverse?.((node) => {
    node.layers.set(INTERACTABLE_INDICATOR_LAYER);
  });
}

export function createInteractableIndicator(text, options = {}) {
  const normalizedText = formatInteractableIndicatorText(text);
  const root = new THREE.Group();
  root.name = 'custom_interactable_indicator';
  root.userData.customInteractableIndicatorRoot = true;
  root.userData.customInteractableIndicatorFloorVisible = true;
  root.userData.customInteractableIndicatorInteriorVisible = true;
  root.userData.indicatorText = normalizedText;

  const indicatorTexture = getIndicatorTexture(normalizedText);
  if (indicatorTexture) {
    const indicator = new THREE.Sprite(new THREE.SpriteMaterial({
      map: indicatorTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
      sizeAttenuation: false,
      toneMapped: false
    }));
    const indicatorHeight = Number(options.indicatorHeight ?? INDICATOR_SCREEN_HEIGHT) || INDICATOR_SCREEN_HEIGHT;
    indicator.name = 'custom_interactable_indicator_sprite';
    indicator.userData.customInteractableIndicatorPart = true;
    indicator.center.set(0.5, indicatorTexture.userData.anchorY ?? 0.5);
    indicator.scale.set(indicatorHeight * (indicatorTexture.userData.aspect ?? 2), indicatorHeight, 1);
    indicator.renderOrder = INDICATOR_RENDER_ORDER;
    indicator.raycast = () => {};
    root.add(indicator);
  }

  setIndicatorLayer(root);
  return root;
}

export function addInteractableIndicatorToObject(object, text, options = {}) {
  if (!object) {
    return null;
  }

  const normalizedText = formatInteractableIndicatorText(text);
  if (!normalizedText) {
    return null;
  }

  const indicator = createInteractableIndicator(normalizedText, options);
  indicator.position.copy(getIndicatorAnchorPosition(object, options));
  if (options.preserveWorldScale !== false) {
    preserveWorldScale(indicator, object);
  }
  object.add(indicator);
  return indicator;
}
