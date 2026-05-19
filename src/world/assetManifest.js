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
    slowRun: 'slowRun',
    fastRun: 'fastRun',
    punching: 'punching',
    snatch: 'snatch',
    drunkIdle: 'drunkIdle',
    drunkWalk: 'drunkWalk',
    emotes: PLAYER_EMOTES
  },
  mixamo: {
    characters: Object.fromEntries(
      MIXAMO_CHARACTER_DEFINITIONS.map((entry) => [
        entry.id,
        assetUrl('runtime', 'mixamo', 'characters', `${entry.id}.glb`)
      ])
    ),
    animations: {
      idle: assetUrl('mixamo', 'animations', 'idle.json'),
      fightingIdle: assetUrl('mixamo', 'animations', 'fighting-idle.json'),
      slowRun: assetUrl('mixamo', 'animations', 'slow-run.json'),
      fastRun: assetUrl('mixamo', 'animations', 'fast-run.json'),
      punching: assetUrl('mixamo', 'animations', 'punching.json'),
      snatch: assetUrl('mixamo', 'animations', 'snatch.json'),
      carrying: assetUrl('mixamo', 'animations', 'carrying-upper-body.json'),
      typing: assetUrl('mixamo', 'animations', 'typing.json'),
      walking: assetUrl('mixamo', 'animations', 'walking.json'),
      drunkIdle: assetUrl('mixamo', 'animations', 'drunk-idle.json'),
      drinking: assetUrl('mixamo', 'animations', 'drinking.json'),
      drunkWalk: assetUrl('mixamo', 'animations', 'drunk-walk.json'),
      standUp: assetUrl('mixamo', 'animations', 'stand-up.json'),
      smoking: assetUrl('mixamo', 'animations', 'smoking.json'),
      texting: assetUrl('mixamo', 'animations', 'texting.json'),
      snakeHipHopDance: assetUrl('mixamo', 'animations', 'snake-hip-hop-dance.json'),
      waveHipHopDance: assetUrl('mixamo', 'animations', 'wave-hip-hop-dance.json'),
      waving: assetUrl('mixamo', 'animations', 'waving.json')
    }
  },
  combat: {
    pistol: assetUrl('objects', 'low-poly_g17_pistol.glb'),
    pistolCock: assetUrl('audio', 'combat', 'pistol_cock.mp3'),
    pistolShot: assetUrl('audio', 'combat', 'pistol_gun_shot.mp3')
  },
  ui: {
    hotbarPistol: assetUrl('generated', 'hotbar-pistol.png')
  },
  audio: {
    chaChing: assetUrl('audio', 'cha-ching.mp3'),
    skillXpGain: assetUrl('audio', 'gain_experience_point_ding.mp3'),
    levelUp: assetUrl('audio', 'level_up_ding.mp3'),
    levelUpCelebration: assetUrl('audio', 'level_up_celebration.mp3'),
    clockTick: assetUrl('audio', 'clock-tick.mp3'),
    phoneUnlock: assetUrl('audio', 'phone_unlock.mp3'),
    phoneVibrate: assetUrl('audio', 'phone_vibrate.mp3'),
    playingCard: assetUrl('audio', 'playing_card.mp3'),
    typingOnKeyboard: assetUrl('audio', 'typing_on_keyboard.mp3'),
    vibeHero: {
      debussyArabesqueNo1: assetUrl('audio', 'vibe-hero', 'debussy-arabesque-no-1.mp3'),
      vivaldiWinterMvt1: assetUrl('audio', 'vibe-hero', 'vivaldi-winter.mp3')
    },
    vibeRadio: {
      brightLightAndSpacious: assetUrl('audio', 'vibe-radio', 'bright-light-and-spacious.mp3'),
      kissOfLife: assetUrl('audio', 'vibe-radio', 'kiss-of-life.mp3')
    }
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
  },
  vehicles: {
    fiatDuna: assetUrl('vibe_theft_auto_custom', 'models', 'fiat-duna-low-poly.glb'),
    toyotaAe86: assetUrl('vibe_theft_auto_custom', 'models', 'toyota-ae86-low-poly.glb')
  }
};
