import * as THREE from 'three';
import { assets } from '../world/assetManifest.js';

const clipSourceUrls = Object.freeze({
  idle: assets.mixamo.animations.idle,
  fightingIdle: assets.mixamo.animations.fightingIdle,
  slowRun: assets.mixamo.animations.slowRun,
  fastRun: assets.mixamo.animations.fastRun,
  punching: assets.mixamo.animations.punching,
  snatch: assets.mixamo.animations.snatch,
  carrying: assets.mixamo.animations.carrying,
  typing: assets.mixamo.animations.typing,
  walking: assets.mixamo.animations.walking,
  drunkIdle: assets.mixamo.animations.drunkIdle,
  drinking: assets.mixamo.animations.drinking,
  drunkWalk: assets.mixamo.animations.drunkWalk,
  standUp: assets.mixamo.animations.standUp,
  smoking: assets.mixamo.animations.smoking,
  texting: assets.mixamo.animations.texting,
  snakeHipHopDance: assets.mixamo.animations.snakeHipHopDance,
  waveHipHopDance: assets.mixamo.animations.waveHipHopDance,
  waving: assets.mixamo.animations.waving
});

const clipRegistry = new Map();
const clipLoadPromises = new Map();

async function loadMixamoClip(name) {
  const clipUrl = clipSourceUrls[name];
  if (!clipUrl) {
    throw new Error(`Unknown Mixamo clip: ${name}`);
  }

  console.info('[Mixamo] Loading clip.', {
    name,
    clipUrl
  });

  const response = await fetch(clipUrl, {
    credentials: 'same-origin'
  });
  if (!response.ok) {
    throw new Error(`Could not load Mixamo clip "${name}" from ${clipUrl}. HTTP ${response.status}`);
  }

  const clipData = await response.json();
  const clip = THREE.AnimationClip.parse(clipData);
  clipRegistry.set(name, clip);

  console.info('[Mixamo] Clip loaded.', {
    name,
    duration: clip.duration,
    trackCount: clip.tracks.length
  });

  return clip;
}

export async function preloadMixamoClips(names = Object.keys(clipSourceUrls)) {
  const normalizedNames = [...new Set((names ?? []).filter((name) => typeof name === 'string' && name.trim()))];

  await Promise.all(normalizedNames.map((name) => {
    if (clipRegistry.has(name)) {
      return Promise.resolve(clipRegistry.get(name));
    }

    if (!clipLoadPromises.has(name)) {
      clipLoadPromises.set(
        name,
        loadMixamoClip(name).catch((error) => {
          clipLoadPromises.delete(name);
          throw error;
        })
      );
    }

    return clipLoadPromises.get(name);
  }));
}

export function getMixamoClip(name) {
  const clip = clipRegistry.get(name);

  if (!clip) {
    throw new Error(`Mixamo clip not loaded yet: ${name}`);
  }

  return clip;
}
