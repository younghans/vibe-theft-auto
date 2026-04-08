import { EMOTES_BY_ID } from '../player/emotes.js';
import { MIXAMO_CHARACTER_DEFINITIONS } from '../shared/mixamoCharacterCatalog.js';

const assetBaseUrl = (() => {
  if (typeof window === 'undefined') {
    return new URL('../../assets/', import.meta.url).href;
  }

  return new URL('/assets/', window.location.origin).href;
})();

export const assetUrl = (...parts) => new URL(parts.join('/'), assetBaseUrl).href;
export const cityAsset = (modelName) =>
  assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', `${modelName}.gltf`);

const PLAYER_EMOTES = Object.freeze(
  Object.fromEntries(
    Object.entries(EMOTES_BY_ID).map(([emoteId, emote]) => [emoteId, emote.clipName])
  )
);

export const assets = {
  playerAnimationSet: {
    idle: 'idle',
    fightingIdle: 'fightingIdle',
    walking: 'walking',
    emotes: PLAYER_EMOTES
  },
  mixamo: {
    characters: Object.fromEntries(
      MIXAMO_CHARACTER_DEFINITIONS.map((entry) => [
        entry.id,
        assetUrl('mixamo', 'characters', entry.fileName)
      ])
    ),
    animations: {
      idle: assetUrl('mixamo', 'animations', 'idle.json'),
      fightingIdle: assetUrl('mixamo', 'animations', 'fighting-idle.json'),
      walking: assetUrl('mixamo', 'animations', 'walking.json'),
      snakeHipHopDance: assetUrl('mixamo', 'animations', 'snake-hip-hop-dance.json'),
      waveHipHopDance: assetUrl('mixamo', 'animations', 'wave-hip-hop-dance.json'),
      waving: assetUrl('mixamo', 'animations', 'waving.json')
    }
  },
  combat: {
    pistol: assetUrl('objects', 'low-poly_g17_pistol.glb'),
    pistolCock: assetUrl('audio', 'combat', 'pistol_cock.wav'),
    pistolShot: assetUrl('audio', 'combat', 'pistol_gun_shot.wav')
  },
  city: {
    base: cityAsset('base'),
    bench: cityAsset('bench'),
    boxA: cityAsset('box_A'),
    boxB: cityAsset('box_B'),
    bush: cityAsset('bush'),
    buildingA: cityAsset('building_A'),
    buildingB: cityAsset('building_B'),
    buildingC: cityAsset('building_C'),
    buildingD: cityAsset('building_D'),
    buildingE: cityAsset('building_E'),
    buildingF: cityAsset('building_F'),
    buildingG: cityAsset('building_G'),
    buildingH: cityAsset('building_H'),
    carSedan: cityAsset('car_sedan'),
    carTaxi: cityAsset('car_taxi'),
    dumpster: cityAsset('dumpster'),
    firehydrant: cityAsset('firehydrant'),
    roadCorner: cityAsset('road_corner'),
    roadCrossing: cityAsset('road_straight_crossing'),
    roadJunction: cityAsset('road_junction'),
    roadStraight: cityAsset('road_straight'),
    roadTSplit: cityAsset('road_tsplit'),
    streetlight: cityAsset('streetlight'),
    trafficLight: cityAsset('trafficlight_A'),
    watertower: cityAsset('watertower')
  }
};
