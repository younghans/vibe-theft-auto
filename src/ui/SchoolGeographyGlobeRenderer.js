import * as THREE from 'three';
import {
  SCHOOL_GEOGRAPHY_COUNTRY_BOUNDARY_PATH,
  SCHOOL_GEOGRAPHY_COUNTRY_COUNT
} from './geographyGlobeData.js';

const TEXTURE_WIDTH = 2048;
const TEXTURE_HEIGHT = 1024;
const GLOBE_RADIUS = 1.72;
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
    this.elapsed = 0;
    this.size = new THREE.Vector2(0, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    this.camera.position.set(0, 0.18, 6.3);
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
    if (this.mountNode) {
      this.mountNode.classList.toggle('is-3d-ready', this.active);
      this.mountNode.dataset.countryCount = String(SCHOOL_GEOGRAPHY_COUNTRY_COUNT);
    }
    if (this.active) {
      this.render();
    }
  }

  setTargetCountry(country = DEFAULT_TARGET) {
    const nextId = String(country?.id ?? DEFAULT_TARGET.id);
    if (nextId === this.targetCountryId) {
      return;
    }
    this.targetCountryId = nextId;
    this.targetCountry = country;

    const surface = getCountryVector(country, GLOBE_RADIUS);
    const normal = surface.clone().normalize();
    this.targetYaw = Math.atan2(-surface.x, surface.z);

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

    const wobble = Math.sin(this.elapsed * 0.82) * 0.07;
    const targetRotationY = this.targetYaw + wobble;
    const turnAmount = 1 - Math.exp(-dt * 4.8);
    this.globePivot.rotation.y = lerpAngle(this.globePivot.rotation.y, targetRotationY, turnAmount);
    this.globePivot.rotation.x = Math.sin(this.elapsed * 0.54) * 0.045;
    this.atmosphere.rotation.y -= dt * 0.08;
    const pulse = 1 + (Math.sin(this.elapsed * 6.6) * 0.065);
    this.pinGroup.scale.setScalar(pulse);
    this.pinRing.material.opacity = 0.54 + (Math.sin(this.elapsed * 5.2) * 0.22);

    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.globeTexture.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
