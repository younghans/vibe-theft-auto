import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { assets } from '../src/world/assetManifest.js';
import { getBuilderItemById } from '../src/world/builderCatalog.js';
import { defaultWorldLayout } from '../src/world/defaultWorldLayout.js';
import { createInteriorScene } from '../src/world/InteriorScene.js';
import {
  STANDING_DESK_COMPUTER_FOOTPRINT,
  createStandingDeskComputerVisual
} from '../src/world/proceduralProps.js';
import { EMOTES_BY_ID, TYPING_EMOTE_ID } from '../src/player/emotes.js';
import {
  SNATCH_WORKOUT_KIND,
  TYPING_WORKOUT_DURATION_MS,
  TYPING_WORKOUT_KIND,
  getWorkoutActivityConfig
} from '../src/game/workoutActivities.js';
import {
  OFFICE_JOB_GAME_IDS,
  OFFICE_JOB_IDS,
  OFFICE_JOB_TERMINAL_ITEM_ID,
  getOfficeJobDefinition,
  getOfficeJobDefinitionByGameId,
  listOfficeJobDefinitions
} from '../src/shared/officeJobs.js';
import {
  OFFICE_BUILDING_ITEM_ID,
  OFFICE_INTERIOR_CEO_MEETING_TABLE,
  OFFICE_INTERIOR_ELEVATOR_SIZE,
  OFFICE_INTERIOR_FLOOR_IDS,
  OFFICE_INTERIOR_ID,
  OFFICE_INTERIOR_JANITOR_CLOSET_SIZE,
  OFFICE_INTERIOR_STATION_TYPES,
  OFFICE_INTERIOR_WALL_THICKNESS,
  getOfficeInteriorElevatorCenter,
  getOfficeInteriorElevatorDoorPosition,
  getOfficeInteriorFloorLayout,
  getOfficeInteriorFloorHeight,
  listOfficeInteriorStations,
  parseOfficeInteriorStationPlacementId
} from '../src/shared/officeInteriorLayout.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getAssetPath(assetUrl) {
  return fileURLToPath(assetUrl);
}

function getBoundsForObject(root, name) {
  const object = root.getObjectByName(name);
  assert(object, `Missing required model node "${name}".`);
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

function validateBuilderDefinition() {
  const item = getBuilderItemById(OFFICE_JOB_TERMINAL_ITEM_ID);
  assert(item, 'Standing desk computer builder item is missing.');
  assert(item.layer === 'prop', 'Standing desk computer should be a prop.');
  assert(item.groupId === 'office', 'Standing desk computer should live in the office prop group.');
  assert(typeof item.createVisual === 'function', 'Standing desk computer should use a procedural visual.');
  assert(item.interactable?.prompt === 'Open job board', 'Standing desk computer should open the office job board.');
  assert(item.interactable?.workoutType === TYPING_EMOTE_ID, 'Standing desk computer should start the typing workout.');
  assert(item.interactable?.hideDuringWorkout === false, 'Standing desk computer should remain visible while in use.');
  assert(Array.isArray(item.interactable?.approachLocalOffset), 'Standing desk computer needs an approach offset.');
  assert(Number.isFinite(item.interactable?.approachRotationY), 'Standing desk computer needs an approach facing.');
}

async function validateOfficeJobTerminalFlow() {
  const jobs = listOfficeJobDefinitions();
  assert(jobs.length === 3, 'Office computer should expose exactly three job tiers.');

  const janitor = getOfficeJobDefinition(OFFICE_JOB_IDS.janitor);
  const manager = getOfficeJobDefinition(OFFICE_JOB_IDS.officeManager);
  const ceo = getOfficeJobDefinition(OFFICE_JOB_IDS.ceo);
  assert(janitor?.rewardMoney === 25 && janitor?.intelligenceRequired === 5, 'Janitor job should pay $25 and require 5 Intelligence.');
  assert(manager?.rewardMoney === 100 && manager?.intelligenceRequired === 50, 'Office Manager job should pay $100 and require 50 Intelligence.');
  assert(ceo?.rewardMoney === 500 && ceo?.intelligenceRequired === 200, 'CEO job should pay $500 and require 200 Intelligence.');

  const gameSource = await readFile(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const hudSource = await readFile(new URL('../src/ui/Hud.js', import.meta.url), 'utf8');
  const serverSource = await readFile(new URL('../server/src/WorldRoom.js', import.meta.url), 'utf8');
  const colyseusSource = await readFile(new URL('../src/npc/NpcServiceColyseus.js', import.meta.url), 'utf8');
  const mockSource = await readFile(new URL('../src/npc/NpcServiceMock.js', import.meta.url), 'utf8');

  assert(gameSource.includes('openOfficeJobMenu'), 'Game should route the office computer to the office job menu.');
  assert(gameSource.includes("office:throw"), 'Game should implement the janitor paper toss task.');
  assert(gameSource.includes('janitorMopHero'), 'Game should implement the janitor Mop Hero task.');
  assert(gameSource.includes('handleOfficeJobHoldEnd'), 'Game should implement the office manager hold-to-brew task.');
  assert(gameSource.includes("office:stamp"), 'Game should implement the CEO memo stamping task.');
  assert(hudSource.includes('office:select:'), 'HUD should render selectable office job tiers.');
  assert(serverSource.includes("officeJob:complete"), 'Server should expose an office job completion RPC.');
  assert(colyseusSource.includes('completeOfficeJob'), 'Colyseus service should call the office job completion RPC.');
  assert(mockSource.includes('completeOfficeJob'), 'Mock service should support office job completion.');
}

async function validateOfficeBuildingInteriorFlow() {
  const officeBuilding = getBuilderItemById(OFFICE_BUILDING_ITEM_ID);
  assert(officeBuilding, 'Office building catalog item is missing.');
  assert(officeBuilding.interior?.id === OFFICE_INTERIOR_ID, 'Office building should use the office interior.');
  assert(officeBuilding.interior?.mode === 'inline-cutaway', 'Office building should use the inline cutaway interior.');

  const stations = listOfficeInteriorStations();
  assert(stations.length >= 7, 'Office interior should define lobby, cubicle, and CEO stations.');
  assert(stations.some((station) => station.jobId === OFFICE_JOB_IDS.janitor), 'Office lobby should expose the janitor station.');
  assert(stations.some((station) => station.jobId === OFFICE_JOB_IDS.officeManager), 'Office second floor should expose the office manager station.');
  assert(stations.some((station) => station.jobId === OFFICE_JOB_IDS.ceo), 'Office top floor should expose the CEO station.');
  assert(stations.some((station) => station.type === OFFICE_INTERIOR_STATION_TYPES.transport && station.targetFloorId === OFFICE_INTERIOR_FLOOR_IDS.ceo), 'Office break room should include the CEO elevator.');
  const stairsToCubicles = stations.find((station) => station.id === 'stairs-to-cubicles');
  const stairsToLobby = stations.find((station) => station.id === 'stairs-to-lobby');
  const elevatorToCeo = stations.find((station) => station.id === 'elevator-to-ceo');
  const elevatorToCubicles = stations.find((station) => station.id === 'elevator-to-cubicles');
  const janitorCloset = stations.find((station) => station.id === 'janitor-closet');
  const ceoMeetingTableStation = stations.find((station) => station.id === 'ceo-meeting-table');
  const cubicleElevatorDoor = getOfficeInteriorElevatorDoorPosition(OFFICE_INTERIOR_FLOOR_IDS.cubicles);
  const ceoElevatorDoor = getOfficeInteriorElevatorDoorPosition(OFFICE_INTERIOR_FLOOR_IDS.ceo);
  assert(janitorCloset?.jobId === OFFICE_JOB_IDS.janitor, 'Janitor closet prop should start the janitor office job.');
  assert((janitorCloset?.localPosition?.[1] ?? -99) > -6.2, 'Janitor station prompt should sit at the prop door, not inside a room.');
  assert(Math.abs((ceoMeetingTableStation?.localPosition?.[0] ?? 99) - OFFICE_INTERIOR_CEO_MEETING_TABLE.centerX) < 0.001, 'CEO station prompt should align with the meeting table center.');
  assert(Math.abs((ceoMeetingTableStation?.localPosition?.[1] ?? 99) - OFFICE_INTERIOR_CEO_MEETING_TABLE.centerZ) < 0.001, 'CEO station prompt should move down with the meeting table.');
  assert(stairsToCubicles?.targetFloorId === OFFICE_INTERIOR_FLOOR_IDS.cubicles, 'Lobby stairs should target the second floor.');
  assert(stairsToLobby?.targetFloorId === OFFICE_INTERIOR_FLOOR_IDS.lobby, 'Second-floor stairs should target the lobby.');
  assert((stairsToCubicles?.targetLocalPosition?.[1] ?? -99) > -2, 'Lobby stairs should land past the second-floor stair opening.');
  assert(Math.abs((stairsToLobby?.localPosition?.[1] ?? 0) - (stairsToCubicles?.targetLocalPosition?.[1] ?? 99)) < 0.001, 'Second-floor stair prompt should share the clear upper landing.');
  assert(Math.abs((elevatorToCeo?.localPosition?.[0] ?? 99) - cubicleElevatorDoor[0]) < 0.001, 'Second-floor elevator prompt should sit in front of the centered elevator.');
  assert(Math.abs((elevatorToCeo?.localPosition?.[1] ?? 99) - cubicleElevatorDoor[1]) < 0.001, 'Second-floor elevator prompt should sit on the door side of the elevator.');
  assert(Math.abs((elevatorToCubicles?.localPosition?.[0] ?? 99) - ceoElevatorDoor[0]) < 0.001, 'CEO elevator prompt should sit in front of the centered elevator.');
  assert(Math.abs((elevatorToCubicles?.localPosition?.[1] ?? 99) - ceoElevatorDoor[1]) < 0.001, 'CEO elevator prompt should sit on the door side of the elevator.');
  assert(Math.abs((elevatorToCeo?.targetLocalPosition?.[0] ?? 99) - ceoElevatorDoor[0]) < 0.001, 'Second-floor elevator should deliver players outside the CEO elevator.');
  assert(Math.abs((elevatorToCubicles?.targetLocalPosition?.[0] ?? 99) - cubicleElevatorDoor[0]) < 0.001, 'CEO elevator should deliver players outside the second-floor elevator.');

  const scene = createInteriorScene(OFFICE_INTERIOR_ID, {
    placementId: 'office_test',
    includeExitInteractable: false
  });
  assert(scene, 'Office interior scene should be creatable.');
  const jobStations = scene.interactables.filter((interactable) => interactable.kind === 'office-job-station');
  const floorTransitions = scene.interactables.filter((interactable) => interactable.kind === 'office-floor-transition');
  assert(jobStations.length === 3, 'Office interior should expose exactly three job station prompts.');
  assert(floorTransitions.length >= 4, 'Office interior should expose stairs and elevator prompts.');
  assert(jobStations.every((station) => parseOfficeInteriorStationPlacementId(station.placementId)), 'Office job stations should use parseable virtual placement IDs.');
  const janitorStation = jobStations.find((station) => station.officeJobId === OFFICE_JOB_IDS.janitor);
  const managerStation = jobStations.find((station) => station.officeJobId === OFFICE_JOB_IDS.officeManager);
  const ceoStation = jobStations.find((station) => station.officeJobId === OFFICE_JOB_IDS.ceo);
  assert(janitorStation && managerStation && ceoStation, 'Office scene should include all three room-specific job stations.');
  assert(Math.abs(janitorStation.position.y - getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.lobby)) < 0.001, 'Janitor station should be on the lobby floor.');
  assert(Math.abs(managerStation.position.y - getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.cubicles)) < 0.001, 'Manager station should be on the second floor.');
  assert(Math.abs(ceoStation.position.y - getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.ceo)) < 0.001, 'CEO station should be on the top floor.');
  assert(typeof scene.setActiveFloorId === 'function', 'Office scene should expose active-floor visual controls.');
  assert(typeof scene.setActiveFloorForWorldPosition === 'function', 'Office scene should update active floor from player position.');

  const floorGroupsById = new Map();
  let stairsGroup = null;
  let floorWallGroupCount = 0;
  let elevatorBoxCount = 0;
  const elevatorBoxesByFloorId = new Map();
  let janitorClosetProp = null;
  let janitorClosetPropCount = 0;
  let janitorClosetDoorCount = 0;
  let janitorClosetMopCount = 0;
  let janitorClosetBucketCount = 0;
  let lobbyChairCount = 0;
  let lobbyTableCount = 0;
  let ceoMeetingChairCount = 0;
  let ceoMeetingTableVisual = null;
  const cubicleWorkstations = [];
  scene.group.traverse((node) => {
    if (node.userData?.officeFloorVisual && node.userData.officeFloorId) {
      floorGroupsById.set(node.userData.officeFloorId, node);
    }
    if (node.userData?.officeStairsAlwaysOpaque) {
      stairsGroup = node;
    }
    if (node.userData?.officeFloorWalls) {
      floorWallGroupCount += 1;
    }
    if (node.userData?.officeElevatorBox) {
      elevatorBoxCount += 1;
      elevatorBoxesByFloorId.set(node.userData.officeFloorId, node);
    }
    if (node.userData?.officeJanitorClosetProp) {
      janitorClosetPropCount += 1;
      janitorClosetProp = node;
    }
    if (node.userData?.officeJanitorClosetDoor) {
      janitorClosetDoorCount += 1;
    }
    if (node.userData?.officeJanitorClosetMop) {
      janitorClosetMopCount += 1;
    }
    if (node.userData?.officeJanitorClosetBucket) {
      janitorClosetBucketCount += 1;
    }
    if (node.userData?.officeLobbyChair) {
      lobbyChairCount += 1;
    }
    if (node.userData?.officeLobbyTable) {
      lobbyTableCount += 1;
    }
    if (node.userData?.officeCubicleWorkstation) {
      cubicleWorkstations.push(node);
    }
    if (node.userData?.officeCeoMeetingChair) {
      ceoMeetingChairCount += 1;
    }
    if (node.userData?.officeCeoMeetingTable) {
      ceoMeetingTableVisual = node;
    }
  });
  assert(floorGroupsById.size === 3, 'Office scene should split lobby, second floor, and CEO floor visuals.');
  assert(stairsGroup, 'Office scene should keep stairs in an always-opaque visual group.');
  assert(floorWallGroupCount === 3, 'Office scene should draw bold north/east/west walls for each floor.');
  assert(elevatorBoxCount === 2, 'Office scene should draw one freestanding elevator box on each elevator floor.');
  assert(janitorClosetPropCount === 1, 'Lobby should render the janitor closet as one larger prop.');
  assert(janitorClosetDoorCount === 1, 'Janitor closet prop should include a visible door.');
  assert(janitorClosetMopCount === 1, 'Janitor closet prop should include a side mop.');
  assert(janitorClosetBucketCount === 1, 'Janitor closet prop should include a side bucket.');
  assert((janitorClosetProp?.userData?.officeJanitorClosetSize?.width ?? 0) >= OFFICE_INTERIOR_JANITOR_CLOSET_SIZE.width, 'Janitor closet prop should use the larger closet width.');
  assert((janitorClosetProp?.userData?.officeJanitorClosetSize?.depth ?? 0) >= OFFICE_INTERIOR_JANITOR_CLOSET_SIZE.depth, 'Janitor closet prop should use the larger closet depth.');
  assert(lobbyChairCount >= 10, 'Office lobby should include expanded waiting chairs.');
  assert(lobbyTableCount >= 3, 'Office lobby should include multiple waiting-area tables.');
  assert(cubicleWorkstations.length >= 9, 'Second floor should keep a full cubicle layout.');
  assert(ceoMeetingChairCount === 8, 'CEO meeting area should keep chair seating after the table resize.');
  assert(ceoMeetingTableVisual, 'CEO floor should render a tagged meeting table visual.');

  const [cubicleElevatorVisualX, cubicleElevatorVisualZ] = getOfficeInteriorElevatorCenter(OFFICE_INTERIOR_FLOOR_IDS.cubicles);
  const cubicleElevatorApproachClearZ = cubicleElevatorVisualZ + OFFICE_INTERIOR_ELEVATOR_SIZE.depth + 1.2;
  assert(cubicleWorkstations.every((cubicle) => (
    Math.abs(cubicle.position.x - cubicleElevatorVisualX) > 3.0
    || cubicle.position.z > cubicleElevatorApproachClearZ
  )), 'Second-floor cubicles should leave a clear elevator approach aisle.');
  assert((ceoMeetingTableVisual?.userData?.officeCeoMeetingTableSize?.width ?? 99) <= OFFICE_INTERIOR_CEO_MEETING_TABLE.width + 0.001, 'CEO meeting table should use the smaller table width.');
  assert((ceoMeetingTableVisual?.userData?.officeCeoMeetingTableSize?.depth ?? 99) <= OFFICE_INTERIOR_CEO_MEETING_TABLE.depth + 0.001, 'CEO meeting table should use the smaller table depth.');
  assert(Math.abs((ceoMeetingTableVisual?.position?.x ?? 99) - OFFICE_INTERIOR_CEO_MEETING_TABLE.centerX) < 0.001, 'CEO meeting table visual should use the shared X position.');
  assert(Math.abs((ceoMeetingTableVisual?.position?.z ?? 99) - OFFICE_INTERIOR_CEO_MEETING_TABLE.centerZ) < 0.001, 'CEO meeting table visual should move down from the elevator.');
  assert((ceoMeetingTableVisual?.position?.z ?? -99) - ceoElevatorDoor[1] > 3.4, 'CEO meeting table should leave movement space outside the elevator.');

  for (const floorId of [OFFICE_INTERIOR_FLOOR_IDS.cubicles, OFFICE_INTERIOR_FLOOR_IDS.ceo]) {
    const elevatorBox = elevatorBoxesByFloorId.get(floorId);
    const [expectedX, expectedZ] = getOfficeInteriorElevatorCenter(floorId);
    assert(elevatorBox, `Office scene should render an elevator box on ${floorId}.`);
    assert(Math.abs(elevatorBox.position.x - expectedX) < 0.001, `Elevator on ${floorId} should be centered on the floor.`);
    assert(Math.abs(elevatorBox.position.z - expectedZ) < 0.001, `Elevator on ${floorId} should sit at the top middle of the floor.`);
    assert(Math.abs(elevatorBox.rotation.y) < 0.001, `Elevator on ${floorId} should face into the room.`);
    assert((elevatorBox.userData?.officeElevatorSize?.width ?? 0) >= OFFICE_INTERIOR_ELEVATOR_SIZE.width, `Elevator on ${floorId} should use the larger elevator width.`);
    assert((elevatorBox.userData?.officeElevatorSize?.depth ?? 0) >= OFFICE_INTERIOR_ELEVATOR_SIZE.depth, `Elevator on ${floorId} should use the larger elevator depth.`);
  }

  function getFirstMeshOpacity(root) {
    let opacity = null;
    root?.traverse?.((node) => {
      if (opacity !== null || !node.isMesh || !node.material) {
        return;
      }
      const material = Array.isArray(node.material) ? node.material[0] : node.material;
      opacity = material?.opacity ?? 1;
    });
    return opacity ?? 1;
  }

  scene.setActiveFloorId(OFFICE_INTERIOR_FLOOR_IDS.cubicles);
  assert(getFirstMeshOpacity(floorGroupsById.get(OFFICE_INTERIOR_FLOOR_IDS.cubicles)) > 0.99, 'Active office floor should stay opaque.');
  assert(getFirstMeshOpacity(floorGroupsById.get(OFFICE_INTERIOR_FLOOR_IDS.lobby)) < 0.12, 'Inactive lower office floor should become very transparent.');
  assert(getFirstMeshOpacity(floorGroupsById.get(OFFICE_INTERIOR_FLOOR_IDS.ceo)) < 0.12, 'Inactive upper office floor should become very transparent.');
  assert(getFirstMeshOpacity(stairsGroup) > 0.99, 'Office stairs should remain opaque while other floors fade.');

  assert(typeof scene.getOfficeFloorIdAtWorldPosition === 'function', 'Office scene should expose the active floor at a world position.');
  assert(typeof scene.getConditionalDoorColliders === 'function', 'Office scene should expose upper-floor doorway blockers.');
  assert(typeof scene.getActiveOfficeColliders === 'function', 'Office scene should expose active-floor wall and prop blockers.');
  assert(typeof scene.getCollidersAt === 'function', 'Office scene should expose floor-aware colliders.');
  const lobbyDoorBlockers = scene.getConditionalDoorColliders(new THREE.Vector3(1000, getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.lobby), 1010.55));
  const cubicleDoorBlockers = scene.getConditionalDoorColliders(new THREE.Vector3(1000, getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.cubicles), 1010.55));
  assert(lobbyDoorBlockers.length === 0, 'Office front door should remain walkable on the first floor.');
  assert(cubicleDoorBlockers.length > 0, 'Office front door should be blocked while on upper floors.');

  function collidersContainLocalPoint(colliders, floorId, localX, localZ) {
    const point = new THREE.Vector3(
      1000 + localX,
      getOfficeInteriorFloorHeight(floorId) + 1,
      1000 + localZ
    );
    return colliders.some((collider) => (collider.box ?? collider).containsPoint?.(point));
  }

  const lobbyColliders = scene.getActiveOfficeColliders(new THREE.Vector3(1000, getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.lobby), 1000));
  const cubicleColliders = scene.getActiveOfficeColliders(new THREE.Vector3(1000, getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.cubicles), 1000));
  const ceoColliders = scene.getActiveOfficeColliders(new THREE.Vector3(1000, getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.ceo), 1000));
  const [janitorDoorX, janitorDoorZ] = janitorCloset.localPosition;
  const [cubicleElevatorX, cubicleElevatorZ] = getOfficeInteriorElevatorCenter(OFFICE_INTERIOR_FLOOR_IDS.cubicles);
  const [ceoElevatorX, ceoElevatorZ] = getOfficeInteriorElevatorCenter(OFFICE_INTERIOR_FLOOR_IDS.ceo);
  const ceoLayout = getOfficeInteriorFloorLayout(OFFICE_INTERIOR_FLOOR_IDS.ceo);
  const ceoHalfWidth = ceoLayout.width * 0.5;
  const ceoHalfDepth = ceoLayout.depth * 0.5;
  const ceoNorthWallZ = ceoLayout.centerZ - ceoHalfDepth + (OFFICE_INTERIOR_WALL_THICKNESS * 0.5);
  const ceoWestWallX = -ceoHalfWidth + (OFFICE_INTERIOR_WALL_THICKNESS * 0.5);
  const ceoEastWallX = ceoHalfWidth - (OFFICE_INTERIOR_WALL_THICKNESS * 0.5);
  assert(collidersContainLocalPoint(
    lobbyColliders,
    OFFICE_INTERIOR_FLOOR_IDS.lobby,
    janitorDoorX,
    janitorDoorZ - (OFFICE_INTERIOR_JANITOR_CLOSET_SIZE.depth * 0.5)
  ), 'Janitor closet should have an active first-floor movement blocker.');
  assert(collidersContainLocalPoint(cubicleColliders, OFFICE_INTERIOR_FLOOR_IDS.cubicles, cubicleElevatorX, cubicleElevatorZ), 'Second-floor elevator should have an active movement blocker.');
  assert(collidersContainLocalPoint(ceoColliders, OFFICE_INTERIOR_FLOOR_IDS.ceo, ceoElevatorX, ceoElevatorZ), 'CEO elevator should have an active movement blocker.');
  assert(collidersContainLocalPoint(ceoColliders, OFFICE_INTERIOR_FLOOR_IDS.ceo, 0, ceoNorthWallZ), 'CEO meeting room north wall should block movement at the visual wall.');
  assert(collidersContainLocalPoint(ceoColliders, OFFICE_INTERIOR_FLOOR_IDS.ceo, ceoWestWallX, ceoLayout.centerZ), 'CEO meeting room west wall should block movement at the visual wall.');
  assert(collidersContainLocalPoint(ceoColliders, OFFICE_INTERIOR_FLOOR_IDS.ceo, ceoEastWallX, ceoLayout.centerZ), 'CEO meeting room east wall should block movement at the visual wall.');
  assert(scene.getCollidersAt(new THREE.Vector3(1000, getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.ceo), 1000)).length > scene.colliders.length, 'Office colliders should include active-floor blockers in addition to shell walls.');

  const stairBottomHeight = scene.getGroundHeightAt(new THREE.Vector3(1007.35, 0, 992.65));
  const stairMiddleHeight = scene.getGroundHeightAt(new THREE.Vector3(1007.2, 0, 995.45));
  const stairTopHeight = scene.getGroundHeightAt(new THREE.Vector3(1007.05, getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.cubicles), 998.55));
  const ceoHeightOverStairs = scene.getGroundHeightAt(new THREE.Vector3(1007.2, getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.ceo), 995.45));
  assert(Math.abs(stairBottomHeight - getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.lobby)) < 0.001, 'Office stairs should start at lobby floor height.');
  assert(stairMiddleHeight > stairBottomHeight + 1 && stairMiddleHeight < stairTopHeight - 1, 'Office stair ground height should ramp between floor 1 and floor 2.');
  assert(Math.abs(stairTopHeight - getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.cubicles)) < 0.001, 'Office stairs should reach the second-floor landing.');
  assert(Math.abs(ceoHeightOverStairs - getOfficeInteriorFloorHeight(OFFICE_INTERIOR_FLOOR_IDS.ceo)) < 0.001, 'Office stair ramp should not pull the CEO floor down.');

  const gameSource = await readFile(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const serverSource = await readFile(new URL('../server/src/WorldRoom.js', import.meta.url), 'utf8');
  const mockSource = await readFile(new URL('../src/npc/NpcServiceMock.js', import.meta.url), 'utf8');
  assert(gameSource.includes('openOfficeInteriorJobStation'), 'Game should start room-specific office jobs.');
  assert(gameSource.includes('useOfficeInteriorTransport'), 'Game should route office stairs and elevators.');
  assert(gameSource.includes('getInlineOfficeDoorBlockers'), 'Game should block the office front door from upper floors.');
  assert(gameSource.includes('getActiveInlineInteriorScene'), 'Game should use inline office floors for active ground height.');
  assert(gameSource.includes('setActiveFloorForWorldPosition'), 'Game should update active office floor transparency from the player position.');
  assert(serverSource.includes('parseOfficeInteriorStationPlacementId'), 'Server payroll should accept virtual office stations.');
  assert(mockSource.includes('parseOfficeInteriorStationPlacementId'), 'Mock payroll should accept virtual office stations.');
}

function validateDeskModel() {
  const visual = createStandingDeskComputerVisual();
  visual.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(visual);
  const size = bounds.getSize(new THREE.Vector3());

  assert(size.x >= 3.8 && size.x <= STANDING_DESK_COMPUTER_FOOTPRINT[0] + 0.05, 'Standing desk width is outside the footprint.');
  assert(size.z >= 2.1 && size.z <= STANDING_DESK_COMPUTER_FOOTPRINT[1] + 0.05, 'Standing desk depth is outside the footprint.');
  assert(size.y >= 3.9 && size.y <= 4.5, 'Standing desk computer height should fit the player scale.');

  const desktopBounds = getBoundsForObject(visual, 'standingDeskDesktop');
  const monitorBounds = getBoundsForObject(visual, 'standingDeskMonitor');
  const screenBounds = getBoundsForObject(visual, 'standingDeskScreen');
  const keyboardBounds = getBoundsForObject(visual, 'standingDeskKeyboard');
  const mouseBounds = getBoundsForObject(visual, 'standingDeskMouse');

  assert(monitorBounds.min.y > desktopBounds.max.y, 'Monitor should sit above the desktop.');
  assert(screenBounds.min.y > desktopBounds.max.y, 'Screen should sit above the desktop.');
  assert(keyboardBounds.min.y >= desktopBounds.max.y - 0.02, 'Keyboard should sit on top of the desktop.');
  assert(mouseBounds.min.y >= desktopBounds.max.y - 0.04, 'Mouse should sit on top of the desktop.');
  assert(keyboardBounds.max.z > screenBounds.max.z, 'Keyboard should be in front of the monitor for the player-facing side.');

  const screen = visual.getObjectByName('standingDeskScreen');
  assert(screen?.material?.emissiveIntensity > 0, 'Screen should use an emissive material.');
}

async function validateAssets() {
  const typingClipPath = getAssetPath(assets.mixamo.animations.typing);
  const typingClipRaw = await readFile(typingClipPath, 'utf8');
  const typingClip = THREE.AnimationClip.parse(JSON.parse(typingClipRaw));
  assert(typingClip.name === 'typing', 'Typing clip should be named "typing".');
  assert(typingClip.duration >= 3 && typingClip.duration <= 30, 'Typing clip duration is outside the expected range.');
  assert(typingClip.tracks.length >= 13, 'Typing clip should include the core upper-body tracks.');
  const trackNames = typingClip.tracks.map((track) => track.name);
  for (const requiredTrack of ['mixamorigSpine.quaternion', 'mixamorigRightHand.quaternion', 'mixamorigLeftHand.quaternion']) {
    assert(trackNames.includes(requiredTrack), `Typing clip missing required track "${requiredTrack}".`);
  }

  const typingAudioPath = getAssetPath(assets.audio.typingOnKeyboard);
  const typingAudio = await readFile(typingAudioPath);
  const hasId3Header = typingAudio.subarray(0, 3).toString('ascii') === 'ID3';
  const hasFrameSync = typingAudio[0] === 0xff && (typingAudio[1] & 0xe0) === 0xe0;
  assert(hasId3Header || hasFrameSync, 'Typing audio should be an MP3 file.');
}

function validateEmoteConfig() {
  const emote = EMOTES_BY_ID[TYPING_EMOTE_ID];
  assert(emote, 'Typing emote config is missing.');
  assert(emote.clipName === 'typing', 'Typing emote should use the typing clip.');
  assert(emote.loop === true, 'Typing emote should loop during the activity.');
  assert(emote.upperBodyOnly === true, 'Typing emote should be upper-body only.');
  assert(assets.playerAnimationSet.emotes[TYPING_EMOTE_ID] === 'typing', 'Typing emote should be included in the player animation set.');
}

function validateActivityConfig() {
  const typingActivity = getWorkoutActivityConfig(TYPING_WORKOUT_KIND);
  assert(typingActivity, 'Typing workout activity config is missing.');
  assert(typingActivity.kind === TYPING_WORKOUT_KIND, 'Typing activity should use the typing workout kind.');
  assert(typingActivity.emoteId === TYPING_EMOTE_ID, 'Typing activity should play the typing emote.');
  assert(typingActivity.durationMs === TYPING_WORKOUT_DURATION_MS, 'Typing activity duration should match the configured typing duration.');
  assert(typingActivity.durationMs >= 3000 && typingActivity.durationMs <= 7000, 'Typing activity should complete after a few seconds.');
  assert(typingActivity.playTypingSound === true, 'Typing activity should play the keyboard sound at start.');
  assert(typingActivity.stopEmoteOnFinish === true, 'Typing activity should stop its looping emote when complete.');
  assert(typingActivity.attachBarbell !== true, 'Typing activity should not create a carried barbell.');

  const snatchActivity = getWorkoutActivityConfig(SNATCH_WORKOUT_KIND);
  assert(snatchActivity?.attachBarbell === true, 'Snatch activity should preserve the carried barbell flow.');
}

function validateOfficeJobs() {
  const janitor = getOfficeJobDefinition(OFFICE_JOB_IDS.janitor);
  const manager = getOfficeJobDefinition(OFFICE_JOB_IDS.officeManager);
  const ceo = getOfficeJobDefinition(OFFICE_JOB_IDS.ceo);

  assert(Array.isArray(janitor.gameIds) && janitor.gameIds.includes(OFFICE_JOB_GAME_IDS.janitorTrashToss), 'Janitor should keep the paper toss game alongside other janitor work.');
  assert(Array.isArray(janitor.gameIds) && janitor.gameIds.includes(OFFICE_JOB_GAME_IDS.janitorMopHero), 'Janitor should expose the Mop Hero game.');
  assert(getOfficeJobDefinitionByGameId(OFFICE_JOB_GAME_IDS.janitorMopHero)?.id === OFFICE_JOB_IDS.janitor, 'Mop Hero should resolve to the Janitor office job for payroll.');
  assert(/alternate|cycle/i.test(`${janitor.subtitle} ${janitor.description}`), 'Starting Janitor should cycle between Janitor games.');
  assert(!/random/i.test(`${janitor.subtitle} ${janitor.description}`), 'Janitor job copy should not describe random game selection.');
  assert(/paper toss/i.test(`${janitor.subtitle} ${janitor.description}`), 'Janitor task should keep paper toss in the cycle.');
  assert(/mop hero/i.test(`${janitor.subtitle} ${janitor.description} ${janitor.instructions}`), 'Janitor task should include Mop Hero in the cycle.');
  assert(/spacebar/i.test(janitor.instructions) && /throw/i.test(janitor.instructions), 'Janitor menu should still explain Paper Toss controls.');
  assert(/mouse/i.test(janitor.instructions) && /mop/i.test(janitor.instructions) && /dirt/i.test(janitor.instructions), 'Janitor menu should explain mouse mopping controls.');
  assert(Number(janitor.durationMs ?? 0) >= 16000, 'Janitor game cycle should allow enough time for Mop Hero.');
  assert(/coffee maker/i.test(manager.description), 'Office Manager task should mention the coffee maker.');
  assert(/mug/i.test(manager.description), 'Office Manager task should use a coffee mug.');
  assert(/hold spacebar/i.test(manager.instructions) && /release/i.test(manager.instructions), 'Office Manager start menu should explain hold/release coffee controls.');
  assert(/stamp/i.test(`${ceo.description} ${ceo.prompt}`), 'CEO task should be the new memo stamping minigame.');
  assert(/spacebar/i.test(ceo.instructions) && /stamp/i.test(ceo.instructions), 'CEO start menu should explain Spacebar/click stamping controls.');
  assert(!/sleep|nap|watcher/i.test(`${ceo.description} ${ceo.prompt}`), 'CEO task should no longer be the sleep/watcher minigame.');
}

async function validateOfficeJobHudSurfaces() {
  const hudSource = await readFile(new URL('../src/ui/Hud.js', import.meta.url), 'utf8');
  const cssSource = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const gameSource = await readFile(new URL('../src/game/Game.js', import.meta.url), 'utf8');
  const officeCountdownMatch = gameSource.match(/const\s+OFFICE_JOB_COUNTDOWN_MS\s*=\s*(\d+)/);
  const officeCountdownMs = Number(officeCountdownMatch?.[1] ?? 0);
  const mopHeroDurationMatch = gameSource.match(/const\s+OFFICE_JANITOR_MOP_HERO_DURATION_MS\s*=\s*(\d+)/);
  const mopHeroDurationMs = Number(mopHeroDurationMatch?.[1] ?? 0);

  assert(gameSource.includes('startOfficeJobCountdown'), 'Office jobs should run a quick countdown before play starts.');
  assert(officeCountdownMs > 0 && officeCountdownMs < 2000, 'Office job countdown should finish in less than 2 seconds.');
  assert(mopHeroDurationMs === 8000, 'Mop Hero should give the player exactly 8 seconds.');
  assert(gameSource.includes('officeJanitorGameCycleIndex'), 'Janitor should track the next game in a deterministic cycle.');
  assert(gameSource.includes('getNextOfficeJanitorGameId'), 'Janitor should use the cycle helper when preparing the next game.');
  assert(gameSource.includes('advanceOfficeJanitorGameCycle'), 'Janitor should advance the cycle once a janitor game starts.');
  assert(!gameSource.includes('chooseOfficeJanitorGameId'), 'Janitor should no longer use the old random game chooser.');
  assert(gameSource.includes('OFFICE_JOB_GAME_IDS.janitorMopHero'), 'Game logic should branch for the Mop Hero janitor game.');
  assert(gameSource.includes('OFFICE_JANITOR_REQUIRED_THROWS'), 'Janitor paper toss should require multiple successful throws.');
  assert(gameSource.includes('OFFICE_JANITOR_BASE_TARGET_WIDTH'), 'Janitor paper toss should use explicit easier target timing constants.');
  assert(gameSource.includes('OFFICE_JANITOR_MOP_BRUSH_RADIUS'), 'Mop Hero should use an explicit mouse brush radius.');
  assert(gameSource.includes('updateJanitorMopHeroState'), 'Mop Hero should update cleaning progress from pointer movement.');
  assert(/for\s*\(\s*const\s+patch\s+of\s+patches\s*\)\s*{\s*patch\.clean\s*=\s*1;\s*}/.test(gameSource), 'Mop Hero completion should mark every dirt patch completely clean.');
  assert(gameSource.includes('game.data.cleanProgress = 1'), 'Mop Hero completion should snap progress to 100%.');
  assert(gameSource.includes('OFFICE_CEO_TARGET_WIDTH_VARIANCE'), 'CEO approval windows should have wider timing variance.');
  assert(gameSource.includes('OFFICE_CEO_STAMP_RIGHT_EXIT'), 'CEO stamp should travel off the right edge before returning.');
  assert(gameSource.includes('memoDirection'), 'CEO stamp should track a return-pass direction for two chances.');
  assert(hudSource.includes('hud__office-paper-ball'), 'Janitor HUD should render a crumpled paper toss ball.');
  assert(hudSource.includes('createOfficeMopHeroMarkup'), 'Janitor HUD should render the Mop Hero game.');
  assert(hudSource.includes('data-office-mop-stage'), 'Mop Hero HUD should expose a mouse tracking stage.');
  assert(hudSource.includes('getOfficeMopHeroPointerPosition'), 'HUD should translate mouse position into Mop Hero room coordinates.');
  assert(hudSource.includes('hud__office-mop-janitor'), 'Mop Hero should show a janitor character following the mouse.');
  assert(hudSource.includes('hud__office-mop-dirt'), 'Mop Hero should render dirt patches to clean.');
  assert(hudSource.includes('hud__school-instructions'), 'Selected office job start screens should show how-to-play instructions.');
  assert(hudSource.includes('hud__office-job-instruction'), 'Office job menu cards should show how-to-play instructions.');
  assert(hudSource.includes('hud__office-thrower'), 'Janitor HUD should render a person throwing the paper.');
  assert(!hudSource.includes('hud__office-fan'), 'Janitor HUD should no longer render the old desk fan.');
  assert(hudSource.includes('Janitor toss progress'), 'Janitor HUD should show multi-round toss progress.');
  assert(hudSource.includes('hud__office-janitor-closet'), 'Janitor ready screen should render a janitor closet background.');
  assert(hudSource.includes('hud__office-mop-room'), 'Mop Hero should render a dirty office room background.');
  assert(
    /function\s+createOfficeTrashTossMarkup[\s\S]*createJanitorClosetBackdropMarkup\(\)/.test(hudSource),
    'Janitor gameplay HUD should render the janitor closet background, not only the start screen.'
  );
  assert(hudSource.includes('--office-aim-offset'), 'Janitor trajectory should be aligned from timing-window error.');
  assert(hudSource.includes('updateOfficeTrashTossLiveMarkup'), 'Janitor trajectory should update in place instead of rebuilding every marker tick.');
  assert(hudSource.includes('3..2..1.. GO!'), 'Office jobs should display the 3..2..1.. GO countdown.');
  assert(hudSource.includes('hud__office-breakroom-backdrop'), 'Office Manager ready screen should render a break room background.');
  assert(hudSource.includes('hud__office-breakroom-fridge'), 'Office Manager HUD should render a break room background.');
  assert(hudSource.includes('hud__office-coffee-maker'), 'Office Manager HUD should render a coffee maker.');
  assert(hudSource.includes('hud__office-cup'), 'Office Manager HUD should render a coffee mug.');
  assert(hudSource.includes('hud__office-boardroom-backdrop'), 'CEO ready screen should render a boardroom background.');
  assert(hudSource.includes('hud__office-ceo-stamp'), 'CEO HUD should render the new stamp minigame.');
  assert(hudSource.includes('--stamp-left'), 'CEO stamp should expose a dynamic horizontal marker position.');
  assert(hudSource.includes('is-returning'), 'CEO HUD should show the returning stamp pass.');
  assert(hudSource.includes('hud__office-board-face is-center'), 'CEO boardroom should include animated board members.');
  assert(hudSource.includes("office:stamp"), 'CEO HUD should expose the stamp action.');

  assert(cssSource.includes('@keyframes hud-office-paper-score'), 'Janitor paper toss should land made shots in the basket.');
  assert(cssSource.includes('@keyframes hud-office-trajectory-bob'), 'Janitor trajectory line should move up and down.');
  assert(cssSource.includes('hud__office-mop-room-dirt'), 'Mop Hero office room should be visibly covered in brown dirt.');
  assert(cssSource.includes('cursor: none'), 'Mop Hero should make the mouse act like the mop brush in the room.');
  assert(cssSource.includes('@keyframes hud-office-mop-head-scrub'), 'Mop Hero mop head should animate while cleaning.');
  assert(cssSource.includes('@keyframes hud-office-mop-sparkle'), 'Mop Hero should sparkle once the dirt is cleaned.');
  assert(cssSource.includes('translate3d(var(--office-aim-offset'), 'Janitor trajectory should use composited transform updates for smooth motion.');
  assert(cssSource.includes('transition: transform 150ms'), 'Janitor trajectory should damp transform updates instead of snapping.');
  assert(cssSource.includes('right: calc(16% + 47px)'), 'Janitor trajectory line should terminate at the trash can center.');
  assert(cssSource.includes('hud__office-janitor-closet-bucket'), 'Janitor start screen should include janitor closet props.');
  assert(cssSource.includes('.hud__office-trash-scene .hud__office-janitor-closet'), 'Janitor gameplay should style the closet as the trash toss scene background.');
  assert(cssSource.includes('@keyframes hud-office-coffee-stream'), 'Office Manager coffee maker should have a brewing stream animation.');
  assert(cssSource.includes('@keyframes hud-office-mug-bob'), 'Office Manager coffee mug should animate while brewing.');
  assert(cssSource.includes('hud__office-breakroom-wall'), 'Office Manager coffee station should include a break room background.');
  assert(cssSource.includes('hud__office-breakroom-backdrop'), 'Office Manager start screen should include the break room backdrop.');
  assert(cssSource.includes('@keyframes hud-office-stamp-slam'), 'CEO stamp should have a slam animation.');
  assert(cssSource.includes('@keyframes hud-office-stamp-mark'), 'CEO stamp should leave an approved mark animation.');
  assert(cssSource.includes('hud__office-ceo-stamp-handle'), 'CEO stamp should have a symmetrical handle.');
  assert(cssSource.includes('hud__office-ceo-stamp-pad'), 'CEO stamp should have a polished stamp pad.');
  assert(cssSource.includes('@keyframes hud-office-board-member-bob'), 'CEO board members should animate.');
  assert(cssSource.includes('hud__office-boardroom-backdrop'), 'CEO start screen should include the boardroom backdrop.');
  assert(cssSource.includes('left: var(--stamp-left'), 'CEO stamp visual should move with the timing marker.');
}

async function validateCheckedInPlacements() {
  assert(
    defaultWorldLayout.props.some((placement) => placement.itemId === 'standing_desk_computer'),
    'Default world should include a standing desk computer placement.'
  );

  const savedLayout = JSON.parse(await readFile(new URL('../server/data/world-layout.json', import.meta.url), 'utf8'));
  assert(
    savedLayout.props?.some((placement) => placement.itemId === 'standing_desk_computer'),
    'Fallback saved world layout should include a standing desk computer placement.'
  );
  assert(
    defaultWorldLayout.tiles.some((placement) => placement.itemId === OFFICE_BUILDING_ITEM_ID),
    'Default world should include the multi-story office building.'
  );
  assert(
    savedLayout.tiles?.some((placement) => placement.itemId === OFFICE_BUILDING_ITEM_ID),
    'Fallback saved world layout should include the multi-story office building.'
  );
}

async function main() {
  validateBuilderDefinition();
  await validateOfficeJobTerminalFlow();
  await validateOfficeBuildingInteriorFlow();
  validateDeskModel();
  validateEmoteConfig();
  validateActivityConfig();
  validateOfficeJobs();
  await validateOfficeJobHudSurfaces();
  await validateCheckedInPlacements();
  await validateAssets();
  console.log('Computer activity validation passed.');
}

await main();
