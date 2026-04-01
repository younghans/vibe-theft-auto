import * as THREE from 'three';
import { Input } from './Input.js';
import { Hud } from '../ui/Hud.js';
import { ModelLibrary } from '../world/ModelLibrary.js';
import { buildCity } from '../world/buildCity.js';
import { WorldBuilder } from '../world/WorldBuilder.js';
import { createPlayer } from '../player/createPlayer.js';

const CAMERA_OFFSET = new THREE.Vector3(0, 26, 18);
const CAMERA_LOOK_OFFSET = new THREE.Vector3(0, 3, 0);

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

    window.addEventListener('resize', () => this.onResize());
  }

  toggleBuildMode() {
    if (!this.worldBuilder) {
      return;
    }

    const nextEnabled = !this.worldBuilder.enabled;
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

      this.worldBuilder = new WorldBuilder({
        scene: this.scene,
        camera: this.camera,
        domElement: this.renderer.domElement,
        library: this.library,
        hud: this.hud,
        onToggleBuildMode: () => this.toggleBuildMode()
      });
      await this.worldBuilder.loadLayout(cityState.layout);

      this.player = await createPlayer(this.library);
      this.player.position.copy(cityState.spawnPoint);
      this.scene.add(this.player.object);

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

  frame() {
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);

    if (this.input.consume('KeyB')) {
      this.toggleBuildMode();
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
      this.player.update(deltaSeconds, this.input, this.camera, activeCollisionBoxes, this.cityBounds);
      this.updateCamera();
      this.updateInteraction();
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

    if (nearest && this.input.consume('KeyE')) {
      this.hud.showToast(nearest.actionText);
    }
  }
}
