import * as THREE from 'three';
import walkingClipData from '../../assets/mixamo/animations/Walking.json' with { type: 'json' };

const clipRegistry = Object.freeze({
  walking: THREE.AnimationClip.parse(walkingClipData)
});

export function getMixamoClip(name) {
  const clip = clipRegistry[name];

  if (!clip) {
    throw new Error(`Unknown Mixamo clip: ${name}`);
  }

  return clip;
}
