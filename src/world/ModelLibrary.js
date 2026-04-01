import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

export class ModelLibrary {
  constructor() {
    this.fbxLoader = new FBXLoader();
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  async load(url) {
    if (!this.cache.has(url)) {
      this.cache.set(url, this.getLoader(url).loadAsync(url).then((asset) => {
        const normalized = asset.scene ? asset : { scene: asset, animations: asset.animations ?? [] };

        normalized.scene.traverse((node) => {
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
        return normalized;
      }));
    }

    return this.cache.get(url);
  }

  async instantiate(url) {
    const asset = await this.load(url);
    return this.hasSkinnedMeshes(asset.scene) ? cloneSkeleton(asset.scene) : asset.scene.clone(true);
  }

  getLoader(url) {
    return url.toLowerCase().endsWith('.fbx') ? this.fbxLoader : this.loader;
  }

  hasSkinnedMeshes(root) {
    let skinned = false;
    root.traverse((node) => {
      if (node.isSkinnedMesh) {
        skinned = true;
      }
    });
    return skinned;
  }
}
