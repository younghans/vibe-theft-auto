import * as THREE from 'three';
import {
  SCHOOL_GEOGRAPHY_COUNTRY_BOUNDARY_PATH,
  SCHOOL_GEOGRAPHY_COUNTRY_COUNT
} from './geographyGlobeData.js';

const TEXTURE_WIDTH = 2048;
const TEXTURE_HEIGHT = 1024;
const GLOBE_RADIUS = 1.72;
const CAMERA_DEFAULT_DISTANCE = 6.3;
const CAMERA_MIN_DISTANCE = 3.05;
const CAMERA_MAX_DISTANCE = 8.4;
const CAMERA_REVEAL_DISTANCE = 3.18;
const GLOBE_DRAG_YAW_PER_PIXEL = 0.008;
const GLOBE_DRAG_PITCH_PER_PIXEL = 0.006;
const GLOBE_WHEEL_ZOOM_PER_DELTA = 0.0048;
const GLOBE_PINCH_ZOOM_PER_PIXEL = 0.014;
const GLOBE_SPIN_FRICTION = 3.8;
const GLOBE_PITCH_MIN = THREE.MathUtils.degToRad(-74);
const GLOBE_PITCH_MAX = THREE.MathUtils.degToRad(74);
const PIN_COLOR = 0xff3f5f;
const PIN_EMISSIVE = 0x8f1028;
const DEFAULT_TARGET = Object.freeze({
  id: 'usa',
  name: 'United States',
  lat: 39.5385,
  lon: -97.4826
});

const UP_VECTOR = new THREE.Vector3(0, 1, 0);
const FORWARD_VECTOR = new THREE.Vector3(0, 0, 1);

function createCountryPath() {
  if (typeof Path2D === 'undefined') {
    return null;
  }

  try {
    return new Path2D(SCHOOL_GEOGRAPHY_COUNTRY_BOUNDARY_PATH);
  } catch (error) {
    console.warn('[SchoolGeography] Country boundary path failed to parse.', error);
    return null;
  }
}

function getCountryVector(country = DEFAULT_TARGET, radius = GLOBE_RADIUS) {
  const lat = THREE.MathUtils.degToRad(Number(country.lat ?? DEFAULT_TARGET.lat) || 0);
  const lon = THREE.MathUtils.degToRad((Number(country.lon ?? DEFAULT_TARGET.lon) || 0) + 180);
  const cosLat = Math.cos(lat);
  return new THREE.Vector3(
    -radius * Math.cos(lon) * cosLat,
    radius * Math.sin(lat),
    radius * Math.sin(lon) * cosLat
  );
}

function lerpAngle(current, target, amount) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * amount;
}

function getCountryFocusAngles(country = DEFAULT_TARGET) {
  const surface = getCountryVector(country, GLOBE_RADIUS);
  const flatRadius = Math.max(0.0001, Math.hypot(surface.x, surface.z));
  return {
    yaw: Math.atan2(-surface.x, surface.z),
    pitch: THREE.MathUtils.clamp(Math.atan2(surface.y, flatRadius), GLOBE_PITCH_MIN, GLOBE_PITCH_MAX)
  };
}

function drawTextureGraticule(context) {
  context.save();
  context.strokeStyle = 'rgba(198, 234, 246, 0.24)';
  context.lineWidth = 1.1;
  for (let lon = 0; lon <= 360; lon += 15) {
    const x = (lon / 360) * TEXTURE_WIDTH;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, TEXTURE_HEIGHT);
    context.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * TEXTURE_HEIGHT;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(TEXTURE_WIDTH, y);
    context.stroke();
  }
  context.restore();
}

function drawGlobeTexture(canvas, countryPath) {
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  const oceanGradient = context.createLinearGradient(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  oceanGradient.addColorStop(0, '#123c64');
  oceanGradient.addColorStop(0.48, '#0a6a83');
  oceanGradient.addColorStop(1, '#082740');
  context.fillStyle = oceanGradient;
  context.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);

  drawTextureGraticule(context);

  if (countryPath) {
    context.save();
    context.scale(TEXTURE_WIDTH / 360, TEXTURE_HEIGHT / 180);
    context.fillStyle = '#8ab36f';
    context.fill(countryPath, 'evenodd');
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.lineWidth = 0.42;
    context.strokeStyle = 'rgba(8, 27, 28, 0.72)';
    context.stroke(countryPath);
    context.lineWidth = 0.15;
    context.strokeStyle = 'rgba(242, 255, 225, 0.74)';
    context.stroke(countryPath);
    context.restore();
  }

  const lightGradient = context.createRadialGradient(
    TEXTURE_WIDTH * 0.4,
    TEXTURE_HEIGHT * 0.28,
    TEXTURE_WIDTH * 0.08,
    TEXTURE_WIDTH * 0.5,
    TEXTURE_HEIGHT * 0.5,
    TEXTURE_WIDTH * 0.72
  );
  lightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.17)');
  lightGradient.addColorStop(0.52, 'rgba(255, 255, 255, 0.03)');
  lightGradient.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
  context.fillStyle = lightGradient;
  context.fillRect(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
}

function disposeObject(root) {
  root?.traverse?.((node) => {
    if (node.geometry?.dispose) {
      node.geometry.dispose();
    }
    if (Array.isArray(node.material)) {
      for (const material of node.material) {
        material?.dispose?.();
      }
    } else {
      node.material?.dispose?.();
    }
  });
}

export class SchoolGeographyGlobeRenderer {
  constructor() {
    this.mountNode = null;
    this.active = false;
    this.targetCountryId = '';
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.viewYaw = 0;
    this.viewPitch = 0;
    this.spinVelocityYaw = 0;
    this.spinVelocityPitch = 0;
    this.cameraDistance = CAMERA_DEFAULT_DISTANCE;
    this.targetCameraDistance = CAMERA_DEFAULT_DISTANCE;
    this.revealActive = false;
    this.resetViewOnNextTarget = false;
    this.activePointers = new Map();
    this.primaryPointerId = null;
    this.lastPinchDistance = 0;
    this.elapsed = 0;
    this.size = new THREE.Vector2(0, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    this.camera.position.set(0, 0.18, this.cameraDistance);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = 'hud__school-geo-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.bindInteractionEvents();

    this.textureCanvas = document.createElement('canvas');
    this.textureCanvas.width = TEXTURE_WIDTH;
    this.textureCanvas.height = TEXTURE_HEIGHT;
    drawGlobeTexture(this.textureCanvas, createCountryPath());
    this.globeTexture = new THREE.CanvasTexture(this.textureCanvas);
    this.globeTexture.colorSpace = THREE.SRGBColorSpace;
    this.globeTexture.anisotropy = 4;

    this.buildScene();
    this.setTargetCountry(DEFAULT_TARGET);
    this.render();
  }

  bindInteractionEvents() {
    this.onPointerDown = (event) => {
      if (!this.active || this.revealActive || (event.pointerType === 'mouse' && event.button !== 0)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        lastAt: now
      });
      if (this.primaryPointerId === null) {
        this.primaryPointerId = event.pointerId;
      }
      try {
        this.renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture can fail if the browser cancels the contact mid-frame.
      }
      this.updateInteractionClass();
      this.lastPinchDistance = this.getActivePointerDistance();
      this.spinVelocityYaw = 0;
      this.spinVelocityPitch = 0;
    };

    this.onPointerMove = (event) => {
      const pointer = this.activePointers.get(event.pointerId);
      if (!pointer) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      const elapsedSeconds = Math.max(0.008, (now - pointer.lastAt) / 1000);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.lastAt = now;

      if (!this.active || this.revealActive) {
        return;
      }

      if (this.activePointers.size >= 2) {
        const pinchDistance = this.getActivePointerDistance();
        if (this.lastPinchDistance > 0 && pinchDistance > 0) {
          this.targetCameraDistance = THREE.MathUtils.clamp(
            this.targetCameraDistance - ((pinchDistance - this.lastPinchDistance) * GLOBE_PINCH_ZOOM_PER_PIXEL),
            CAMERA_MIN_DISTANCE,
            CAMERA_MAX_DISTANCE
          );
        }
        this.lastPinchDistance = pinchDistance;
        return;
      }

      if (event.pointerId !== this.primaryPointerId) {
        return;
      }

      const yawDelta = dx * GLOBE_DRAG_YAW_PER_PIXEL;
      const pitchDelta = dy * GLOBE_DRAG_PITCH_PER_PIXEL;
      this.viewYaw += yawDelta;
      this.viewPitch = THREE.MathUtils.clamp(this.viewPitch + pitchDelta, GLOBE_PITCH_MIN, GLOBE_PITCH_MAX);
      this.spinVelocityYaw = (yawDelta / elapsedSeconds) * 0.32;
      this.spinVelocityPitch = (pitchDelta / elapsedSeconds) * 0.24;
    };

    this.onPointerUp = (event) => {
      if (!this.activePointers.has(event.pointerId)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.activePointers.delete(event.pointerId);
      try {
        this.renderer.domElement.releasePointerCapture?.(event.pointerId);
      } catch {
        // Capture may already be released after pointercancel/lostpointercapture.
      }
      this.primaryPointerId = this.activePointers.keys().next().value ?? null;
      this.lastPinchDistance = this.getActivePointerDistance();
      this.updateInteractionClass();
    };

    this.onWheel = (event) => {
      if (!this.active || this.revealActive) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.targetCameraDistance = THREE.MathUtils.clamp(
        this.targetCameraDistance + (Number(event.deltaY) || 0) * GLOBE_WHEEL_ZOOM_PER_DELTA,
        CAMERA_MIN_DISTANCE,
        CAMERA_MAX_DISTANCE
      );
    };

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', this.onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', this.onPointerUp, { passive: false });
    canvas.addEventListener('pointercancel', this.onPointerUp, { passive: false });
    canvas.addEventListener('lostpointercapture', this.onPointerUp, { passive: false });
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  getActivePointerDistance() {
    if (this.activePointers.size < 2) {
      return 0;
    }

    const [first, second] = [...this.activePointers.values()];
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

  updateInteractionClass() {
    this.mountNode?.classList.toggle('is-interacting', this.activePointers.size > 0 && !this.revealActive);
  }

  buildScene() {
    this.scene.add(new THREE.HemisphereLight(0xdff9ff, 0x11343e, 1.85));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(3.8, 3.6, 4.8);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x72e6ff, 1.16);
    rimLight.position.set(-4.6, 1.8, -2.2);
    this.scene.add(rimLight);

    this.globePivot = new THREE.Group();
    this.scene.add(this.globePivot);

    this.globeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 112, 72),
      new THREE.MeshStandardMaterial({
        map: this.globeTexture,
        roughness: 0.66,
        metalness: 0.02,
        emissive: 0x071b22,
        emissiveIntensity: 0.18
      })
    );
    this.globePivot.add(this.globeMesh);

    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.035, 96, 56),
      new THREE.MeshBasicMaterial({
        color: 0x8ae6ff,
        transparent: true,
        opacity: 0.16,
        side: THREE.BackSide,
        depthWrite: false
      })
    );
    this.scene.add(this.atmosphere);

    this.pinGroup = new THREE.Group();
    this.globePivot.add(this.pinGroup);

    const pinMaterial = new THREE.MeshStandardMaterial({
      color: PIN_COLOR,
      emissive: PIN_EMISSIVE,
      emissiveIntensity: 0.62,
      roughness: 0.34,
      metalness: 0.02
    });
    this.pinTip = new THREE.Mesh(new THREE.ConeGeometry(0.082, 0.34, 32), pinMaterial);
    this.pinHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 20), pinMaterial);
    this.pinRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.185, 0.014, 10, 54),
      new THREE.MeshBasicMaterial({
        color: PIN_COLOR,
        transparent: true,
        opacity: 0.82,
        depthWrite: false
      })
    );
    this.pinGroup.add(this.pinTip, this.pinHead, this.pinRing);

    this.pinLight = new THREE.PointLight(PIN_COLOR, 1.45, 3.8);
    this.pinGroup.add(this.pinLight);
  }

  mount(container) {
    if (!container) {
      return;
    }

    this.mountNode = container;
    if (!container.contains(this.renderer.domElement)) {
      container.replaceChildren(this.renderer.domElement);
    }
    this.resizeToMount();
    this.render();
  }

  setActive(active) {
    this.active = Boolean(active);
    if (!this.active) {
      this.activePointers.clear();
      this.primaryPointerId = null;
      this.lastPinchDistance = 0;
      this.revealActive = false;
      this.resetViewOnNextTarget = true;
    }
    if (this.mountNode) {
      this.mountNode.classList.toggle('is-3d-ready', this.active);
      this.mountNode.classList.toggle('is-revealing', this.active && this.revealActive);
      this.mountNode.dataset.countryCount = String(SCHOOL_GEOGRAPHY_COUNTRY_COUNT);
    }
    this.updateInteractionClass();
    if (this.active) {
      this.render();
    }
  }

  setRevealActive(active) {
    const revealActive = Boolean(active);
    if (this.revealActive === revealActive) {
      return;
    }

    this.revealActive = revealActive;
    if (revealActive) {
      this.activePointers.clear();
      this.primaryPointerId = null;
      this.lastPinchDistance = 0;
      this.spinVelocityYaw = 0;
      this.spinVelocityPitch = 0;
    } else {
      this.targetCameraDistance = THREE.MathUtils.clamp(this.cameraDistance, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE);
    }
    this.mountNode?.classList.toggle('is-revealing', this.active && this.revealActive);
    this.updateInteractionClass();
  }

  setTargetCountry(country = DEFAULT_TARGET) {
    const nextId = String(country?.id ?? DEFAULT_TARGET.id);
    const countryChanged = nextId !== this.targetCountryId;
    const resetView = countryChanged || this.resetViewOnNextTarget;
    if (!countryChanged && !resetView) {
      this.targetCountry = country;
      return;
    }
    this.targetCountryId = nextId;
    this.targetCountry = country;
    this.resetViewOnNextTarget = false;

    const surface = getCountryVector(country, GLOBE_RADIUS);
    const normal = surface.clone().normalize();
    const focus = getCountryFocusAngles(country);
    this.targetYaw = focus.yaw;
    this.targetPitch = focus.pitch;
    if (resetView) {
      this.viewYaw = focus.yaw;
      this.viewPitch = focus.pitch;
      this.spinVelocityYaw = 0;
      this.spinVelocityPitch = 0;
      this.cameraDistance = CAMERA_DEFAULT_DISTANCE;
      this.targetCameraDistance = CAMERA_DEFAULT_DISTANCE;
    }

    this.pinTip.position.copy(normal).multiplyScalar(GLOBE_RADIUS + 0.13);
    this.pinTip.quaternion.setFromUnitVectors(UP_VECTOR, normal);
    this.pinHead.position.copy(normal).multiplyScalar(GLOBE_RADIUS + 0.33);
    this.pinRing.position.copy(normal).multiplyScalar(GLOBE_RADIUS + 0.028);
    this.pinRing.quaternion.setFromUnitVectors(FORWARD_VECTOR, normal);
    this.pinLight.position.copy(normal).multiplyScalar(0.44);
  }

  resizeToMount() {
    if (!this.mountNode) {
      return false;
    }

    const rect = this.mountNode.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    if (width === this.size.x && height === this.size.y && this.renderer.getPixelRatio() === pixelRatio) {
      return false;
    }

    this.size.set(width, height);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    return true;
  }

  update(deltaSeconds = 0) {
    if (!this.active) {
      return;
    }

    const dt = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
    this.elapsed += dt;
    this.resizeToMount();

    if (this.revealActive) {
      const revealTurnAmount = 1 - Math.exp(-dt * 7.6);
      this.viewYaw = lerpAngle(this.viewYaw, this.targetYaw, revealTurnAmount);
      this.viewPitch = THREE.MathUtils.lerp(this.viewPitch, this.targetPitch, revealTurnAmount);
    } else if (this.activePointers.size === 0) {
      this.viewYaw += this.spinVelocityYaw * dt;
      this.viewPitch = THREE.MathUtils.clamp(
        this.viewPitch + (this.spinVelocityPitch * dt),
        GLOBE_PITCH_MIN,
        GLOBE_PITCH_MAX
      );
      const friction = Math.exp(-dt * GLOBE_SPIN_FRICTION);
      this.spinVelocityYaw *= friction;
      this.spinVelocityPitch *= friction;
    }

    const cameraTargetDistance = this.revealActive ? CAMERA_REVEAL_DISTANCE : this.targetCameraDistance;
    this.cameraDistance = THREE.MathUtils.lerp(
      this.cameraDistance,
      cameraTargetDistance,
      1 - Math.exp(-dt * (this.revealActive ? 7.2 : 8.4))
    );
    this.camera.position.set(0, 0.18, this.cameraDistance);
    this.camera.lookAt(0, 0, 0);

    this.globePivot.rotation.set(this.viewPitch, this.viewYaw, 0);
    this.atmosphere.rotation.y -= dt * 0.08;
    const pulse = (this.revealActive ? 1.13 : 1) + (Math.sin(this.elapsed * 6.6) * (this.revealActive ? 0.085 : 0.065));
    this.pinGroup.scale.setScalar(pulse);
    this.pinRing.material.opacity = (this.revealActive ? 0.68 : 0.54) + (Math.sin(this.elapsed * 5.2) * 0.22);

    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerUp);
    canvas.removeEventListener('lostpointercapture', this.onPointerUp);
    canvas.removeEventListener('wheel', this.onWheel);
    this.globeTexture.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
