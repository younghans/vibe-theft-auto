import * as THREE from 'three';
import { getTileLocalCellOffsets, getTileLocalCenterOffset } from '../shared/tileFootprint.js';
import { fitObjectToFootprint, snapObjectToGround } from '../shared/threeModelBounds.js';
import { getBuilderItemById } from './builderCatalog.js';
import {
  createBasketballHalfCourtTileVisual,
  createBasketballHoopVisual,
  createBlackjackTableVisual,
  createCarDealershipBuildingVisual,
  createCasinoSlotMachineVisual,
  createDirtPathPropVisual,
  createInstrumentClusterVisual,
  createMarthasGrilleBuildingVisual,
  createOlympicBarbellVisual,
  createOfficeCeoMeetingTableVisual,
  createOfficeCubicleWorkstationVisual,
  createOfficeJanitorShiftClosetVisual,
  createOfficeLobbyChairVisual,
  createOfficeLobbySideTableVisual,
  createOfficeLobbyTableVisual,
  createOfficeManagerShiftCoffeeStationVisual,
  createPawnShopBuildingVisual,
  createPistolPickupSpawnVisual,
  createRealEstateOfficeBuildingVisual,
  createSidewalkPropVisual,
  createStandingDeskComputerVisual,
  createStonePathPropVisual
} from './proceduralProps.js';
import { COMBAT_PICKUP_PROP_ITEM_IDS } from '../shared/combatPickupDefinitions.js';

export { fitObjectToFootprint, snapObjectToGround };

function getUnderlayItem(item) {
  if (item?.layer !== 'tile' || !item.underlayTileId) {
    return null;
  }

  const underlayItem = getBuilderItemById(item.underlayTileId);
  return underlayItem?.layer === 'tile' ? underlayItem : null;
}

export async function instantiateItemVisual(library, item) {
  const underlayItem = getUnderlayItem(item);
  let primaryObject = null;

  if (typeof item?.createVisual === 'function') {
    primaryObject = item.createVisual();
  } else if (item?.id === 'basketball_court_half' || item?.assetName === 'basketball_court_half') {
    // Procedural tiles can lose function fields when copied through plain-object workflows.
    primaryObject = createBasketballHalfCourtTileVisual();
  } else if (item?.id === 'basketball_hoop' || item?.assetName === 'basketball_hoop') {
    // Procedural props can lose function fields when copied through plain-object workflows.
    primaryObject = createBasketballHoopVisual();
  } else if (item?.id === 'sidewalk' || item?.assetName === 'sidewalk') {
    primaryObject = createSidewalkPropVisual();
  } else if (item?.id === 'stone_path' || item?.assetName === 'stone_path') {
    primaryObject = createStonePathPropVisual();
  } else if (item?.id === 'dirt_path' || item?.assetName === 'dirt_path') {
    primaryObject = createDirtPathPropVisual();
  } else if (item?.id === 'olympic_barbell' || item?.assetName === 'olympic_barbell') {
    // Procedural props can lose function fields when copied through plain-object workflows.
    primaryObject = createOlympicBarbellVisual();
  } else if (item?.id === 'standing_desk_computer' || item?.assetName === 'standing_desk_computer') {
    // Procedural props can lose function fields when copied through plain-object workflows.
    primaryObject = createStandingDeskComputerVisual();
  } else if (item?.id === 'office_janitor_shift_closet' || item?.assetName === 'office_janitor_shift_closet') {
    // Procedural props can lose function fields when copied through plain-object workflows.
    primaryObject = createOfficeJanitorShiftClosetVisual();
  } else if (item?.id === 'office_manager_shift_coffee_station' || item?.assetName === 'office_manager_shift_coffee_station') {
    // Procedural props can lose function fields when copied through plain-object workflows.
    primaryObject = createOfficeManagerShiftCoffeeStationVisual();
  } else if (item?.id === 'office_lobby_chair' || item?.assetName === 'office_lobby_chair') {
    primaryObject = createOfficeLobbyChairVisual();
  } else if (item?.id === 'office_lobby_table' || item?.assetName === 'office_lobby_table') {
    primaryObject = createOfficeLobbyTableVisual();
  } else if (item?.id === 'office_lobby_side_table' || item?.assetName === 'office_lobby_side_table') {
    primaryObject = createOfficeLobbySideTableVisual();
  } else if (item?.id === 'office_cubicle_workstation' || item?.assetName === 'office_cubicle_workstation') {
    primaryObject = createOfficeCubicleWorkstationVisual();
  } else if (item?.id === 'office_ceo_meeting_table' || item?.assetName === 'office_ceo_meeting_table') {
    primaryObject = createOfficeCeoMeetingTableVisual();
  } else if (item?.id === 'instrument_cluster' || item?.assetName === 'instrument_cluster') {
    // Procedural props can lose function fields when copied through plain-object workflows.
    primaryObject = createInstrumentClusterVisual();
  } else if (item?.id === 'blackjack_table' || item?.assetName === 'blackjack_table') {
    // Procedural props can lose function fields when copied through plain-object workflows.
    primaryObject = createBlackjackTableVisual();
  } else if (item?.id === 'slot_machine' || item?.assetName === 'slot_machine') {
    // Procedural props can lose function fields when copied through plain-object workflows.
    primaryObject = createCasinoSlotMachineVisual();
  } else if (item?.id === 'pawn_building' || item?.assetName === 'pawn_building') {
    // Procedural tiles can lose function fields when copied through plain-object workflows.
    primaryObject = createPawnShopBuildingVisual();
  } else if (item?.id === 'marthas_grille_building' || item?.assetName === 'marthas_grille_building') {
    // Procedural tiles can lose function fields when copied through plain-object workflows.
    primaryObject = createMarthasGrilleBuildingVisual();
  } else if (item?.id === 'real_estate_office_building' || item?.assetName === 'real_estate_office_building') {
    // Procedural tiles can lose function fields when copied through plain-object workflows.
    primaryObject = createRealEstateOfficeBuildingVisual();
  } else if (item?.id === 'car_dealership_building' || item?.assetName === 'car_dealership_building') {
    // Procedural tiles can lose function fields when copied through plain-object workflows.
    primaryObject = createCarDealershipBuildingVisual();
  } else if (item?.id === COMBAT_PICKUP_PROP_ITEM_IDS.pistol || item?.assetName === COMBAT_PICKUP_PROP_ITEM_IDS.pistol) {
    // Procedural props can lose function fields when copied through plain-object workflows.
    primaryObject = createPistolPickupSpawnVisual();
  } else if (typeof item?.asset === 'string' && item.asset) {
    primaryObject = await library.instantiate(item.asset);
  } else {
    throw new Error(`Item "${item?.id ?? item?.assetName ?? 'unknown'}" does not define a usable visual source.`);
  }
  const needsTileRoot = item?.layer === 'tile';
  const needsModelTransformRoot = !needsTileRoot
    && (item?.modelTransformRoot === true || Number.isFinite(Number(item?.modelRotationY)));
  const root = needsTileRoot || needsModelTransformRoot ? new THREE.Group() : primaryObject;
  const tileCenterOffset = needsTileRoot ? getTileLocalCenterOffset(item) : { x: 0, z: 0 };

  if (needsTileRoot || needsModelTransformRoot) {
    root.add(primaryObject);
  }

  if (!underlayItem) {
    return {
      root,
      colliderObject: primaryObject,
      parts: [{ object: primaryObject, item, role: 'primary' }]
    };
  }

  const underlayOffsets = item?.layer === 'tile'
    ? getTileLocalCellOffsets(item)
    : [{ x: 0, z: 0 }];
  const underlayObjects = await Promise.all(
    underlayOffsets.map(async (offset) => {
      const underlayObject = await library.instantiate(underlayItem.asset);
      underlayObject.position.set(
        offset.x - tileCenterOffset.x,
        0,
        offset.z - tileCenterOffset.z
      );
      root.add(underlayObject);
      return underlayObject;
    })
  );

  return {
    root,
    colliderObject: primaryObject,
    parts: [
      ...underlayObjects.map((object) => ({ object, item: underlayItem, role: 'underlay' })),
      { object: primaryObject, item, role: 'primary' }
    ]
  };
}

export function prepareItemVisual(visual, applyObjectSetup = null) {
  for (const part of visual.parts) {
    applyObjectSetup?.(part.object, part);
    const modelRotationY = Number(part.item?.modelRotationY);
    if (Number.isFinite(modelRotationY) && modelRotationY !== 0) {
      part.object.rotation.y += modelRotationY;
      part.object.updateWorldMatrix(true, true);
    }
    fitObjectToFootprint(part.object, part.item.size[0], part.item.size[1]);
    snapObjectToGround(part.object, {
      clearance: part.item.groundClearance,
      groundNodeNameParts: part.item.groundSnapNodeNameParts
    });
  }

  return visual.root;
}
