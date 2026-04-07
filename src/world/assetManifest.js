import { EMOTES_BY_ID } from '../player/emotes.js';

export const assetUrl = (...parts) => new URL(`../../assets/${parts.join('/')}`, import.meta.url).href;
export const cityAsset = (modelName) =>
  assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', `${modelName}.gltf`);

const PLAYER_EMOTES = Object.freeze(
  Object.fromEntries(
    Object.entries(EMOTES_BY_ID).map(([emoteId, emote]) => [emoteId, emote.clipName])
  )
);

const PLAYER_PRESETS = Object.freeze({
  defaultMixamo: Object.freeze({
    characterRig: assetUrl('mixamo', 'characters', 'x-bot.fbx'),
    characterVariant: 'mixamo',
    idleClip: 'idle',
    walkClip: 'walking',
    emotes: PLAYER_EMOTES
  }),
  osrsBob: Object.freeze({
    characterRig: assetUrl('bob-from-runescape', 'source', 'Bob.fbx'),
    characterVariant: 'mixamo',
    idleClip: 'idle',
    walkClip: 'walking',
    emotes: PLAYER_EMOTES
  })
});

const ACTIVE_PLAYER_PRESET_ID = 'defaultMixamo';

export const assets = {
  mixamo: {
    characters: {
      xBot: assetUrl('mixamo', 'characters', 'x-bot.fbx'),
      brute: assetUrl('mixamo', 'characters', 'brute.fbx'),
      ch18NonPbr: assetUrl('mixamo', 'characters', 'ch18-non-pbr.fbx')
    },
    animations: {
      idle: assetUrl('mixamo', 'animations', 'idle.json'),
      walking: assetUrl('mixamo', 'animations', 'walking.json'),
      snakeHipHopDance: assetUrl('mixamo', 'animations', 'snake-hip-hop-dance.json'),
      waveHipHopDance: assetUrl('mixamo', 'animations', 'wave-hip-hop-dance.json'),
      waving: assetUrl('mixamo', 'animations', 'waving.json')
    }
  },
  playerPresetId: ACTIVE_PLAYER_PRESET_ID,
  playerPresets: PLAYER_PRESETS,
  player: PLAYER_PRESETS[ACTIVE_PLAYER_PRESET_ID],
  combat: {
    pistol: assetUrl('objects', 'low-poly_g17_pistol.glb')
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
