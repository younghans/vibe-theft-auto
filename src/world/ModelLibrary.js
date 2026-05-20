import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

export class ModelLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.cache = new Map();
  }

  async load(url) {
    if (typeof url !== 'string' || !url) {
      throw new Error(`ModelLibrary expected a non-empty asset URL, received ${String(url)}.`);
    }
    if (url.toLowerCase().endsWith('.fbx')) {
      throw new Error('Runtime model loading only supports glTF/GLB assets. Convert FBX assets before bundling.');
    }

    if (!this.cache.has(url)) {
      console.info('[Assets] Loading model.', {
        url
      });
      this.cache.set(url, this.loader.loadAsync(url)
        .then((asset) => {
          const normalized = asset.scene ? asset : { scene: asset, animations: asset.animations ?? [] };
          const hasSkinnedMeshes = this.hasSkinnedMeshes(normalized.scene);

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

          console.info('[Assets] Model loaded.', {
            url,
            animationCount: normalized.animations?.length ?? 0,
            hasSkinnedMeshes
          });
          return {
            ...normalized,
            hasSkinnedMeshes
          };
        })
        .catch((error) => {
          console.error('[Assets] Model load failed.', {
            url,
            message: error?.message ?? String(error)
          });
          this.cache.delete(url);
          throw error;
        }));
    }

    return this.cache.get(url);
  }

  async preload(urls = [], { concurrency = 8 } = {}) {
    const seen = new Set();
    const queue = [];
    for (const url of urls ?? []) {
      if (typeof url !== 'string' || !url || seen.has(url)) {
        continue;
      }
      seen.add(url);
      queue.push(url);
    }
    if (!queue.length) {
      return;
    }

    let index = 0;
    const workerCount = Math.max(1, Math.min(Math.floor(concurrency) || 1, queue.length));
    const workers = [];
    for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
      workers.push((async () => {
      while (index < queue.length) {
        const url = queue[index];
        index += 1;
        await this.load(url);
      }
      })());
    }
    await Promise.all(workers);
  }

  async instantiate(url) {
    const asset = await this.load(url);
    return asset.hasSkinnedMeshes ? cloneSkeleton(asset.scene) : asset.scene.clone(true);
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
