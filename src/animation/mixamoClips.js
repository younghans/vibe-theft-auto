import * as THREE from 'three';
import walkingClipData from '../../assets/mixamo/animations/Walking.json' with { type: 'json' };
import snakeHipHopDanceClipData from '../../assets/mixamo/animations/Snake Hip Hop Dance.json' with { type: 'json' };
import waveHipHopDanceClipData from '../../assets/mixamo/animations/Wave Hip Hop Dance.json' with { type: 'json' };
import wavingClipData from '../../assets/mixamo/animations/Waving.json' with { type: 'json' };

const clipRegistry = Object.freeze({
  walking: THREE.AnimationClip.parse(walkingClipData),
  snakeHipHopDance: THREE.AnimationClip.parse(snakeHipHopDanceClipData),
  waveHipHopDance: THREE.AnimationClip.parse(waveHipHopDanceClipData),
  waving: THREE.AnimationClip.parse(wavingClipData)
});

export function getMixamoClip(name) {
  const clip = clipRegistry[name];

  if (!clip) {
    throw new Error(`Unknown Mixamo clip: ${name}`);
  }

  return clip;
}
