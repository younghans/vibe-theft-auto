import * as THREE from 'three';
import {
  createInPlaceClip,
  createTargetFilteredClip,
  MIXAMO_BONES,
  validateMixamoHumanoid
} from '../animation/humanoid.js';
import { getMixamoClip, preloadMixamoClips } from '../animation/mixamoClips.js';
import { assets } from '../world/assetManifest.js';
import { getNpcModelById } from '../npc/npcCatalog.js';
import { prepareNpcRenderObject } from '../npc/npcRenderUtils.js';

const DEFAULT_TEACHER_MODEL_ID = 'martha';
const AWAY_YAW = Math.PI;
const WARNING_YAW = Math.PI * 0.38;
const LOOKING_YAW = 0;
const DEFAULT_TURN_LERP_SPEED = 5.4;
const RED_TURN_MS = 240;
const BOARD_TEXTURE_WIDTH = 1024;
const BOARD_TEXTURE_HEIGHT = 512;

function smoothStep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - (2 * t));
}

function getModeTheme(mode = 'away') {
  if (mode === 'looking') {
    return {
      status: 'RED LIGHT',
      action: 'FREEZE',
      color: '#ff607f',
      glow: 0xff607f
    };
  }
  if (mode === 'turning') {
    return {
      status: 'YELLOW LIGHT',
      action: 'STOP',
      color: '#ffd166',
      glow: 0xffd166
    };
  }
  return {
    status: 'GREEN LIGHT',
    action: 'WRITE',
    color: '#78f0b5',
    glow: 0x78f0b5
  };
}

function fitCanvasText(context, text, maxWidth, startSize, minSize = 28) {
  let size = startSize;
  do {
    context.font = `900 ${size}px Arial, sans-serif`;
    if (context.measureText(text).width <= maxWidth || size <= minSize) {
      return size;
    }
    size -= 2;
  } while (size > 0);
  return minSize;
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
  context.fill();
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

function detachObject(root) {
  root?.parent?.remove(root);
}

export class SchoolTeacherPreviewRenderer {
  constructor({ library }) {
    this.library = library;
    this.mountNode = null;
    this.active = false;
    this.teacherModelId = '';
    this.teacherObject = null;
    this.teacherMixer = null;
    this.teacherLoadRequestId = 0;
    this.teacherLoadPromise = null;
    this.state = {
      phase: 'ready',
      teacherMode: 'away',
      sentence: '',
      typedText: '',
      progress: 0,
      turnStartedAt: 0,
      turnEndsAt: 0,
      lookStartedAt: 0
    };
    this.previousMode = 'away';
    this.teacherYaw = AWAY_YAW;
    this.lastBoardSignature = '';
    this.size = new THREE.Vector2(0, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
    this.camera.position.set(0, 2.55, 7.8);
    this.camera.lookAt(0, 1.85, -0.55);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = 'hud__school-teacher-canvas';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');

    this.teacherPivot = new THREE.Group();
    this.teacherPivot.position.set(2.04, 0, -0.88);
    this.teacherPivot.rotation.y = AWAY_YAW;

    this.boardCanvas = document.createElement('canvas');
    this.boardCanvas.width = BOARD_TEXTURE_WIDTH;
    this.boardCanvas.height = BOARD_TEXTURE_HEIGHT;
    this.boardTexture = new THREE.CanvasTexture(this.boardCanvas);
    this.boardTexture.colorSpace = THREE.SRGBColorSpace;

    this.buildScene();
    this.render();
  }

  buildScene() {
    this.scene.add(new THREE.HemisphereLight(0xdff6ff, 0x4a2e24, 1.5));

    const keyLight = new THREE.DirectionalLight(0xfff1cf, 2.2);
    keyLight.position.set(4.5, 6.8, 4.4);
    this.scene.add(keyLight);

    const boardGlow = new THREE.PointLight(0x78f0b5, 0.5, 7);
    boardGlow.position.set(-1.2, 2.7, -1.2);
    this.boardGlow = boardGlow;
    this.scene.add(boardGlow);

    const room = new THREE.Group();
    this.scene.add(room);

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a4050,
      roughness: 0.82,
      metalness: 0.02
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 5.5), wallMaterial);
    wall.position.set(0, 2.55, -2.62);
    room.add(wall);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(9.5, 6.4),
      new THREE.MeshStandardMaterial({
        color: 0x5b4133,
        roughness: 0.72
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0.82);
    room.add(floor);

    const boardFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x7b4b2b,
      roughness: 0.68
    });
    const boardBack = new THREE.Mesh(
      new THREE.BoxGeometry(5.86, 2.38, 0.16),
      boardFrameMaterial
    );
    boardBack.position.set(-0.92, 2.72, -2.48);
    room.add(boardBack);

    this.boardMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.35, 1.9),
      new THREE.MeshStandardMaterial({
        map: this.boardTexture,
        roughness: 0.92,
        metalness: 0,
        emissive: 0x08221d,
        emissiveIntensity: 0.32
      })
    );
    this.boardMesh.position.set(-0.92, 2.72, -2.39);
    room.add(this.boardMesh);

    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(5.7, 0.08, 0.2),
      boardFrameMaterial
    );
    tray.position.set(-0.92, 1.58, -2.28);
    room.add(tray);

    const chalkMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f3df,
      roughness: 0.55
    });
    const chalk = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.48, 4, 10), chalkMaterial);
    chalk.rotation.z = Math.PI / 2;
    chalk.position.set(0.84, 1.69, -2.04);
    room.add(chalk);

    const deskMaterial = new THREE.MeshStandardMaterial({
      color: 0x6c4a35,
      roughness: 0.7
    });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.42, 1.08), deskMaterial);
    desk.position.set(-0.64, 0.54, 2.44);
    room.add(desk);

    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(1.18, 0.72),
      new THREE.MeshStandardMaterial({
        color: 0xf0ead0,
        roughness: 0.8,
        side: THREE.DoubleSide
      })
    );
    paper.rotation.x = -Math.PI / 2;
    paper.rotation.z = -0.08;
    paper.position.set(-0.8, 0.77, 2.32);
    room.add(paper);

    const pencil = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.025, 0.68, 4, 10),
      new THREE.MeshStandardMaterial({
        color: 0xffcf5b,
        roughness: 0.48
      })
    );
    pencil.rotation.x = Math.PI / 2;
    pencil.rotation.z = -0.75;
    pencil.position.set(-0.15, 0.83, 2.18);
    room.add(pencil);

    this.lookCone = new THREE.Mesh(
      new THREE.ConeGeometry(1.3, 4.1, 48, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff607f,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    this.lookCone.rotation.x = Math.PI / 2;
    this.lookCone.position.set(2.04, 0.06, 1.08);
    this.lookCone.scale.set(1.05, 1, 0.7);
    room.add(this.lookCone);

    this.statusLights = {
      away: this.createStatusLight(0x78f0b5, -1.48),
      turning: this.createStatusLight(0xffd166, -0.92),
      looking: this.createStatusLight(0xff607f, -0.36)
    };
    for (const light of Object.values(this.statusLights)) {
      room.add(light);
    }

    this.scene.add(this.teacherPivot);
  }

  createStatusLight(color, x) {
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 24, 16),
      new THREE.MeshStandardMaterial({
        color: 0x2a3036,
        emissive: color,
        emissiveIntensity: 0.05,
        roughness: 0.38
      })
    );
    light.position.set(x, 3.86, -2.27);
    light.userData.activeColor = color;
    return light;
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
    }
    if (this.active) {
      this.render();
    }
  }

  async setTeacherModel(modelId = DEFAULT_TEACHER_MODEL_ID) {
    const model = getNpcModelById(modelId) ?? getNpcModelById(DEFAULT_TEACHER_MODEL_ID);
    if (!model || model.id === this.teacherModelId || this.teacherLoadPromise) {
      return this.teacherLoadPromise;
    }

    const requestId = ++this.teacherLoadRequestId;
    const loadPromise = Promise.all([
      preloadMixamoClips([assets.playerAnimationSet.idle]),
      this.library.instantiate(model.asset)
    ])
      .then(([, object]) => {
        if (requestId !== this.teacherLoadRequestId) {
          detachObject(object);
          return null;
        }

        prepareNpcRenderObject(object, model, { enableShadows: false });
        object.traverse((node) => {
          if (!node.isMesh) {
            return;
          }
          node.frustumCulled = false;
        });

        const humanoid = validateMixamoHumanoid(object);
        const mixer = humanoid.isHumanoid ? new THREE.AnimationMixer(object) : null;
        if (mixer) {
          const idleClip = createInPlaceClip(
            createTargetFilteredClip(getMixamoClip(assets.playerAnimationSet.idle), object, `${assets.playerAnimationSet.idle}_TeacherPreviewRigSafe`),
            MIXAMO_BONES.hips
          );
          const idleAction = mixer.clipAction(idleClip);
          idleAction.enabled = true;
          idleAction.setLoop(THREE.LoopRepeat, Infinity);
          idleAction.play();
        }

        if (this.teacherObject) {
          detachObject(this.teacherObject);
        }

        this.teacherObject = object;
        this.teacherMixer = mixer;
        this.teacherModelId = model.id;
        this.teacherPivot.add(object);
        this.teacherYaw = this.resolveTeacherYaw(performance.now());
        this.teacherPivot.rotation.y = this.teacherYaw;
        this.render();
        return object;
      })
      .catch((error) => {
        console.warn('[SchoolMicrogame] Teacher preview model failed to load.', error);
        return null;
      })
      .finally(() => {
        if (this.teacherLoadPromise === loadPromise) {
          this.teacherLoadPromise = null;
        }
      });

    this.teacherLoadPromise = loadPromise;
    return loadPromise;
  }

  setState(state = {}) {
    this.state = {
      ...this.state,
      ...state
    };
    this.updateBoardTexture();
  }

  resolveTeacherYaw(now = performance.now()) {
    const mode = String(this.state.teacherMode ?? 'away');
    if (mode === 'looking') {
      const startedAt = Number(this.state.lookStartedAt ?? 0);
      const progress = startedAt > 0 ? smoothStep((now - startedAt) / RED_TURN_MS) : 1;
      return THREE.MathUtils.lerp(WARNING_YAW, LOOKING_YAW, progress);
    }
    if (mode === 'turning') {
      const startedAt = Number(this.state.turnStartedAt ?? 0);
      const endsAt = Number(this.state.turnEndsAt ?? 0);
      const duration = Math.max(1, endsAt - startedAt);
      const progress = startedAt > 0 ? smoothStep((now - startedAt) / duration) : 0.35;
      return THREE.MathUtils.lerp(AWAY_YAW, WARNING_YAW, progress);
    }
    return AWAY_YAW;
  }

  updateBoardTexture() {
    const mode = String(this.state.teacherMode ?? 'away');
    const sentence = String(this.state.sentence ?? '');
    const typedText = String(this.state.typedText ?? '');
    const progress = Math.round(Number(this.state.progress ?? 0) || 0);
    const signature = `${mode}|${sentence}|${typedText}|${progress}`;
    if (signature === this.lastBoardSignature) {
      return;
    }
    this.lastBoardSignature = signature;

    const theme = getModeTheme(mode);
    const context = this.boardCanvas.getContext('2d');
    context.clearRect(0, 0, BOARD_TEXTURE_WIDTH, BOARD_TEXTURE_HEIGHT);
    context.fillStyle = '#123a31';
    context.fillRect(0, 0, BOARD_TEXTURE_WIDTH, BOARD_TEXTURE_HEIGHT);

    context.globalAlpha = 0.16;
    context.strokeStyle = '#e9f5db';
    for (let y = 36; y < BOARD_TEXTURE_HEIGHT; y += 52) {
      context.beginPath();
      context.moveTo(32, y + Math.sin(y) * 3);
      context.lineTo(BOARD_TEXTURE_WIDTH - 32, y + Math.cos(y) * 3);
      context.stroke();
    }
    context.globalAlpha = 1;

    context.fillStyle = 'rgba(0, 0, 0, 0.25)';
    drawRoundedRect(context, 34, 30, 322, 72, 18);
    context.fillStyle = theme.color;
    context.font = '900 33px Arial, sans-serif';
    context.fillText(theme.status, 58, 77);

    context.fillStyle = '#f6ffe9';
    context.font = '900 82px Arial, sans-serif';
    context.fillText(theme.action, 56, 196);

    const displayText = sentence || 'MEET ME AFTER CLASS';
    const fontSize = fitCanvasText(context, displayText, BOARD_TEXTURE_WIDTH - 116, 58, 30);
    context.font = `900 ${fontSize}px "Courier New", monospace`;
    context.fillStyle = 'rgba(246, 255, 233, 0.42)';
    context.fillText(displayText, 58, 314);

    const typedSize = fitCanvasText(context, typedText || ' ', BOARD_TEXTURE_WIDTH - 116, 58, 30);
    context.font = `900 ${typedSize}px "Courier New", monospace`;
    context.fillStyle = '#f6ffe9';
    context.fillText(typedText || ' ', 58, 314);

    context.fillStyle = 'rgba(255, 255, 255, 0.16)';
    drawRoundedRect(context, 58, 378, BOARD_TEXTURE_WIDTH - 116, 24, 12);
    context.fillStyle = theme.color;
    drawRoundedRect(context, 58, 378, (BOARD_TEXTURE_WIDTH - 116) * THREE.MathUtils.clamp(progress / 100, 0, 1), 24, 12);

    context.fillStyle = 'rgba(246, 255, 233, 0.72)';
    context.font = '800 28px Arial, sans-serif';
    context.fillText(`${progress}% COPIED`, 58, 452);

    this.boardTexture.needsUpdate = true;
  }

  updateModeVisuals(deltaSeconds) {
    const mode = String(this.state.teacherMode ?? 'away');
    const theme = getModeTheme(mode);
    this.boardGlow.color.setHex(theme.glow);
    this.boardGlow.intensity = mode === 'away' ? 0.44 : mode === 'turning' ? 0.78 : 1.12;
    this.boardMesh.material.emissive.setHex(mode === 'away' ? 0x08221d : mode === 'turning' ? 0x322600 : 0x320814);
    this.boardMesh.material.emissiveIntensity = mode === 'away' ? 0.28 : 0.48;

    for (const [key, light] of Object.entries(this.statusLights)) {
      const active = key === mode || (key === 'away' && mode === 'away');
      light.material.color.setHex(active ? light.userData.activeColor : 0x2a3036);
      light.material.emissiveIntensity = active ? 1.8 : 0.05;
    }

    const targetYaw = this.resolveTeacherYaw();
    if (mode === 'turning' || mode === 'looking') {
      this.teacherYaw = targetYaw;
    } else {
      const deltaYaw = Math.atan2(
        Math.sin(targetYaw - this.teacherYaw),
        Math.cos(targetYaw - this.teacherYaw)
      );
      const lerp = 1 - Math.exp(-Math.max(0, deltaSeconds) * DEFAULT_TURN_LERP_SPEED);
      this.teacherYaw += deltaYaw * lerp;
    }
    this.teacherPivot.rotation.y = this.teacherYaw;
    this.previousMode = mode;

    const coneTarget = mode === 'looking' ? 0.28 : mode === 'turning' ? 0.12 : 0;
    this.lookCone.material.opacity = THREE.MathUtils.lerp(this.lookCone.material.opacity, coneTarget, 0.2);
    this.lookCone.visible = this.lookCone.material.opacity > 0.01;
    this.lookCone.material.color.setHex(mode === 'turning' ? 0xffd166 : 0xff607f);
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

    this.resizeToMount();
    this.teacherMixer?.update(deltaSeconds);
    this.updateModeVisuals(deltaSeconds);
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.teacherObject) {
      detachObject(this.teacherObject);
      this.teacherObject = null;
    }
    this.boardTexture.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
