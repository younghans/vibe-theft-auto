export const assetUrl = (...parts) => new URL(`../../assets/${parts.join('/')}`, import.meta.url).href;

export const assets = {
  mixamo: {
    characters: {
      xBot: assetUrl('mixamo', 'characters', 'X Bot.fbx')
    },
    animations: {
      walking: assetUrl('mixamo', 'animations', 'Walking.json')
    }
  },
  player: {
    character: assetUrl('mixamo', 'characters', 'X Bot.fbx'),
    walkClip: 'walking'
  },
  city: {
    base: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'base.gltf'),
    bench: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'bench.gltf'),
    boxA: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'box_A.gltf'),
    boxB: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'box_B.gltf'),
    bush: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'bush.gltf'),
    buildingA: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'building_A.gltf'),
    buildingB: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'building_B.gltf'),
    buildingC: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'building_C.gltf'),
    buildingD: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'building_D.gltf'),
    buildingE: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'building_E.gltf'),
    buildingF: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'building_F.gltf'),
    buildingG: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'building_G.gltf'),
    buildingH: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'building_H.gltf'),
    carSedan: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'car_sedan.gltf'),
    carTaxi: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'car_taxi.gltf'),
    dumpster: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'dumpster.gltf'),
    firehydrant: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'firehydrant.gltf'),
    roadCorner: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'road_corner.gltf'),
    roadCrossing: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'road_straight_crossing.gltf'),
    roadJunction: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'road_junction.gltf'),
    roadStraight: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'road_straight.gltf'),
    roadTSplit: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'road_tsplit.gltf'),
    streetlight: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'streetlight.gltf'),
    trafficLight: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'trafficlight_A.gltf'),
    watertower: assetUrl('KayKit_City_Builder_Bits_1.0_FREE', 'Assets', 'gltf', 'watertower.gltf')
  }
};
