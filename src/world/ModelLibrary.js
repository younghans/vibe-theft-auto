import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  async load(url) {
    if (!this.cache.has(url)) {
      this.cache.set(url, this.loader.loadAsync(url).then((gltf) => {
        gltf.scene.traverse((node) => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            node.frustumCulled = true;
            if (node.material) {
              const materials = Array.isArray(node.material) ? node.material : [node.material];
              for (const material of materials) {
                material.side = THREE.FrontSide;
              }
            }
          }
        });
        return gltf;
      }));
    }

    return this.cache.get(url);
  }

  async instantiate(url) {
    const gltf = await this.load(url);
    return gltf.scene.clone(true);
  }
}
