import * as THREE from 'three';
import { clonePassiveTrafficRoutes } from '../shared/passiveTrafficRoutes.js';
import { quantizeNumber, quantizePosition, quantizeRotation } from '../shared/numberMath.js';
import { BUILDER_TILE_SIZE } from '../shared/worldConstants.js';
import {
  PASSIVE_TRAFFIC_CAR_COLLISION_COOLDOWN_SECONDS,
  PASSIVE_TRAFFIC_CAR_COLLISION_REVERSE_SECONDS,
  PASSIVE_TRAFFIC_CAR_COLLISION_REVERSE_SPEED_FACTOR,
  PASSIVE_TRAFFIC_CAR_COLLISION_STOP_SECONDS,
  PASSIVE_TRAFFIC_CAR_ITEM_IDS,
  PASSIVE_TRAFFIC_DEFAULT_CAR_ITEM_IDS,
  PASSIVE_TRAFFIC_DRIVE_COMMANDS,
  PASSIVE_TRAFFIC_MIN_ROAD_NODES,
  PASSIVE_TRAFFIC_POLICE_CAR_ITEM_ID,
  PASSIVE_TRAFFIC_POLICE_CAR_RESPAWN_SECONDS,
  PASSIVE_TRAFFIC_POLICE_CAR_SINK_DEPTH,
  PASSIVE_TRAFFIC_SPEED,
  buildPassiveTrafficRoadGraph,
  buildPassiveTrafficRouteLookahead,
  clampPassiveTrafficPositionToRoadNodes,
  clampPassiveTrafficTurnYaw,
  findPassiveTrafficPath,
  getPassiveTrafficDriveCommand,
  getPassiveTrafficDriveScript,
  getPassiveTrafficForwardVector,
  getPassiveTrafficLanePosition,
  getPassiveTrafficLanePositionAtNode,
  getPassiveTrafficRouteNodeIndices,
  getPassiveTrafficTurnLaneWaypointsFromPosition,
  getPassiveTrafficTurnYawRange,
  isPassiveTrafficCrosswalkNode,
  isPassiveTrafficJunctionNode,
  isPassiveTrafficPositionInsideRoadNode,
  isPassiveTrafficTSplitNode,
  passiveTrafficHitboxesOverlap
} from './passiveTraffic.js';

const PASSIVE_TRAFFIC_TURN_RESPONSE = 8.5;
const PASSIVE_TRAFFIC_ACCEL_RESPONSE = 5.5;
const PASSIVE_TRAFFIC_BRAKE_RESPONSE = 14;
const PASSIVE_TRAFFIC_TURN_SPEED_FACTOR = 0.58;
const PASSIVE_TRAFFIC_SEDAN_TURN_SPEED_FACTOR = 0.46;
const PASSIVE_TRAFFIC_TURN_APPROACH_DISTANCE = BUILDER_TILE_SIZE * 0.55;
const PASSIVE_TRAFFIC_TURN_STOP_SECONDS = 0.38;
const PASSIVE_TRAFFIC_TURN_STOP_STEP_SECONDS = 0.06;
const PASSIVE_TRAFFIC_SPEED_FACTORS = Object.freeze([0.94, 1, 1.06]);
const PASSIVE_TRAFFIC_DESTINATION_CANDIDATE_COUNT = 14;
const PASSIVE_TRAFFIC_POSITION_EPSILON = 0.08;
const PASSIVE_TRAFFIC_STUCK_SECONDS = 1.15;
const PASSIVE_TRAFFIC_STUCK_DISTANCE = 0.018;
const PASSIVE_TRAFFIC_REVERSE_SPEED_FACTOR = 0.48;
const WANTED_RESPONSE_ROUTE_ID = 'wanted_response';
const WANTED_RESPONSE_CAR_SINK_SECONDS = 2.4;

function normalizeAngleRadians(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function dampAngleRadians(current, target, lambda, deltaSeconds) {
  const lerp = 1 - Math.exp(-Math.max(0, lambda) * Math.max(0, deltaSeconds));
  return normalizeAngleRadians(current + (normalizeAngleRadians(target - current) * lerp));
}

function dampNumber(current, target, lambda, deltaSeconds) {
  const lerp = 1 - Math.exp(-Math.max(0, lambda) * Math.max(0, deltaSeconds));
  return current + ((target - current) * lerp);
}

function passiveTrafficTieBreak(nodeIndex, carIndex) {
  const x = Math.sin(((nodeIndex + 1) * 12.9898) + ((carIndex + 1) * 78.233)) * 43758.5453;
  return x - Math.floor(x);
}

function getPassiveTrafficTurnSpeedFactor(car) {
  return car?.itemId === 'car_sedan'
    ? PASSIVE_TRAFFIC_SEDAN_TURN_SPEED_FACTOR
    : PASSIVE_TRAFFIC_TURN_SPEED_FACTOR;
}

function isPassiveTrafficTurningThroughNode(previousNode, currentNode, nextNode) {
  const command = getPassiveTrafficDriveCommand(previousNode, currentNode, nextNode);
  return command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT
    || command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT;
}

function shouldPassiveTrafficStopForTurn(previousNode, currentNode, nextNode) {
  const command = getPassiveTrafficDriveCommand(previousNode, currentNode, nextNode);
  return isPassiveTrafficJunctionNode(currentNode)
    && !isPassiveTrafficCrosswalkNode(currentNode)
    && (!isPassiveTrafficTSplitNode(currentNode) || command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.STRAIGHT)
    && command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.REVERSE
    && command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.STOP;
}

function createPassiveTrafficCarId(itemId = '', routeId = '', carIndex = 0) {
  const routePart = String(routeId || 'default').replace(/[^a-z0-9_-]+/giu, '-').slice(0, 80);
  return `passive_traffic_${Math.max(0, Math.floor(Number(carIndex) || 0))}_${itemId}_${routePart}`;
}

export function createPassiveTrafficRouteSignature(routes = []) {
  return clonePassiveTrafficRoutes(routes)
    .map((route) => [
      route.id,
      route.itemId,
      route.points.map((point) => `${point.cellX ?? ''}:${point.cellZ ?? ''}:${point.x ?? ''}:${point.z ?? ''}`).join(';')
    ].join('='))
    .sort()
    .join('|');
}

export function createPassiveTrafficCarSpecs(routes = []) {
  const normalizedRoutes = clonePassiveTrafficRoutes(routes);
  const assignedRouteIds = new Set();
  const specs = [];

  for (const itemId of PASSIVE_TRAFFIC_DEFAULT_CAR_ITEM_IDS) {
    const route = normalizedRoutes.find((entry) => entry.itemId === itemId && !assignedRouteIds.has(entry.id)) ?? null;
    if (route) {
      assignedRouteIds.add(route.id);
    }
    specs.push({
      itemId,
      routeId: route?.id ?? '',
      route
    });
  }

  for (const route of normalizedRoutes) {
    if (assignedRouteIds.has(route.id) || !PASSIVE_TRAFFIC_DEFAULT_CAR_ITEM_IDS.includes(route.itemId)) {
      continue;
    }
    assignedRouteIds.add(route.id);
    specs.push({
      itemId: route.itemId,
      routeId: route.id,
      route
    });
  }

  return specs;
}

export class PassiveTrafficSimulation {
  constructor({ getSurfaceHeightAtPosition = null } = {}) {
    this.getSurfaceHeightAtPosition = typeof getSurfaceHeightAtPosition === 'function'
      ? getSurfaceHeightAtPosition
      : (() => 0);
    this.graph = null;
    this.routes = [];
    this.routesById = new Map();
    this.routesByItemId = new Map();
    this.cars = [];
    this.signature = '';
    this.visitCounter = 0;
    this.nodeVisits = new Map();
    this.nodeVisitOrder = new Map();
    this.scratch = new THREE.Vector3();
    this.targetScratch = new THREE.Vector3();
    this.forwardScratch = { x: 0, z: 1 };
    this.activeDestinations = new Set();
    this.destinationCandidates = [];
    this.destinationCandidatePool = [];
    this.destinationCandidateNodeIndices = [];
    this.activeNeighbors = [];
    this.sequence = 0;
    this.elapsedSeconds = 0;
  }

  syncRouteLookups() {
    this.routesById = new Map();
    this.routesByItemId = new Map();
    for (const route of this.routes) {
      this.routesById.set(route.id, route);
      if (!this.routesByItemId.has(route.itemId)) {
        this.routesByItemId.set(route.itemId, route);
      }
    }
  }

  reset(source, routes = []) {
    this.routes = clonePassiveTrafficRoutes(routes);
    this.syncRouteLookups();
    const graph = buildPassiveTrafficRoadGraph(source);
    const hasTrafficRoads = graph.activeNodeIndices.length >= PASSIVE_TRAFFIC_MIN_ROAD_NODES;
    const routeSignature = createPassiveTrafficRouteSignature(this.routes);
    this.signature = hasTrafficRoads ? `${graph.signature}|routes:${routeSignature}` : '';
    this.graph = hasTrafficRoads ? graph : null;
    this.cars = [];
    this.visitCounter = 0;
    this.nodeVisits.clear();
    this.nodeVisitOrder.clear();
    this.sequence += 1;
    this.elapsedSeconds = 0;

    if (!hasTrafficRoads) {
      return this.getSnapshots();
    }

    const carSpecs = createPassiveTrafficCarSpecs(this.routes);
    for (let carIndex = 0; carIndex < carSpecs.length; carIndex += 1) {
      const spec = carSpecs[carIndex];
      const car = this.createCarState(spec.itemId, carIndex, spec.routeId);
      if (car) {
        this.cars.push(car);
      }
    }

    return this.getSnapshots();
  }

  getCustomRouteNodeIndices(itemId, routeId = '', graph = this.graph) {
    const route = routeId
      ? this.routesById.get(routeId)
      : this.routesByItemId.get(itemId);
    if (!route || !graph) {
      return [];
    }

    const nodeIndices = getPassiveTrafficRouteNodeIndices(graph, route);
    if (nodeIndices.length < PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      return [];
    }

    const componentIndex = graph.nodes?.[nodeIndices[0]]?.componentIndex;
    if (componentIndex === undefined) {
      return [];
    }

    return nodeIndices.every((nodeIndex) => graph.nodes?.[nodeIndex]?.componentIndex === componentIndex)
      ? nodeIndices
      : [];
  }

  createCarState(itemId, carIndex, routeId = '') {
    const graph = this.graph;
    const activeNodeIndices = graph?.activeNodeIndices ?? [];
    if (activeNodeIndices.length < PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      return null;
    }

    const customRouteNodeIndices = this.getCustomRouteNodeIndices(itemId, routeId, graph);
    const activeComponents = graph.activeComponents?.length ? graph.activeComponents : [activeNodeIndices];
    const startComponent = activeComponents[carIndex % activeComponents.length] ?? activeNodeIndices;
    const componentCarSlot = Math.floor(carIndex / Math.max(1, activeComponents.length));
    const componentCarCount = Math.max(1, Math.ceil(PASSIVE_TRAFFIC_DEFAULT_CAR_ITEM_IDS.length / Math.max(1, activeComponents.length)));
    const startOffset = (componentCarSlot + 0.18) / componentCarCount;
    const startIndex = customRouteNodeIndices[0]
      ?? startComponent[Math.floor(startOffset * startComponent.length) % startComponent.length];
    const car = {
      id: createPassiveTrafficCarId(itemId, routeId, carIndex),
      itemId,
      routeId,
      carIndex,
      position: new THREE.Vector3(),
      currentNodeIndex: startIndex,
      previousNodeIndex: null,
      targetNodeIndex: null,
      route: [],
      routeCursor: 0,
      targetPosition: new THREE.Vector3(),
      finalTargetPosition: new THREE.Vector3(),
      routeDestinationIndex: null,
      routeAdvanceCount: 1,
      customRouteNodeIndices,
      customRouteCursor: 0,
      turnThroughNodeIndex: null,
      visitedNodeIndices: new Set(),
      speed: PASSIVE_TRAFFIC_SPEED * (PASSIVE_TRAFFIC_SPEED_FACTORS[carIndex % PASSIVE_TRAFFIC_SPEED_FACTORS.length] ?? 1),
      currentSpeed: 0,
      yaw: 0,
      driveCommand: PASSIVE_TRAFFIC_DRIVE_COMMANDS.STRAIGHT,
      turnStopSeconds: 0,
      turnStopWaypointIndex: -1,
      turnStopSatisfied: false,
      turnWaypointActive: false,
      turnWaypointIndex: 0,
      turnWaypointQueue: [],
      turnWaypointCursor: 0,
      turnStartYaw: null,
      turnEndYaw: null,
      stuckSeconds: 0,
      collisionReverseSeconds: 0,
      collisionStopSeconds: 0,
      collisionCooldownSeconds: 0,
      disabledStartedSeconds: 0,
      disabledUntilSeconds: 0,
      disabledStartY: 0,
      lastPosition: new THREE.Vector3()
    };

    this.markNodeVisited(startIndex, car);
    this.assignRoute(car);
    if (car.targetNodeIndex === null) {
      return null;
    }

    const currentNode = graph.nodes[car.currentNodeIndex];
    const targetNode = graph.nodes[car.turnThroughNodeIndex ?? car.targetNodeIndex];
    getPassiveTrafficLanePositionAtNode(currentNode, targetNode, car.position);
    car.position.y = this.getSurfaceHeightAtPosition(car.position.x, car.position.z);
    car.yaw = Math.atan2(
      (targetNode?.x ?? currentNode.x) - currentNode.x,
      (targetNode?.z ?? currentNode.z) - currentNode.z
    );
    car.lastPosition.copy(car.position);
    return car;
  }

  getCarById(carId = '') {
    const normalizedId = String(carId || '');
    if (!normalizedId) {
      return null;
    }

    return this.cars.find((car) => car?.id === normalizedId) ?? null;
  }

  isCarDisabled(carOrId = null) {
    const car = typeof carOrId === 'string'
      ? this.getCarById(carOrId)
      : carOrId;
    return Boolean(car && (car.disabledUntilSeconds ?? 0) > this.elapsedSeconds);
  }

  isCarSinking(carOrId = null) {
    const car = typeof carOrId === 'string'
      ? this.getCarById(carOrId)
      : carOrId;
    return Boolean(car && (car.responseSinkUntilSeconds ?? 0) > this.elapsedSeconds);
  }

  findNearestRoadNodeIndex(position = null, preferredComponentIndex = null) {
    const graph = this.graph;
    const activeNodeIndices = graph?.activeNodeIndices ?? [];
    if (!position || activeNodeIndices.length < PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      return null;
    }

    const sourceX = Number(position.x);
    const sourceZ = Number(position.z);
    if (!Number.isFinite(sourceX) || !Number.isFinite(sourceZ)) {
      return null;
    }

    let nearestIndex = null;
    let nearestDistanceSq = Number.POSITIVE_INFINITY;
    for (const nodeIndex of activeNodeIndices) {
      const node = graph.nodes?.[nodeIndex];
      if (!node || (preferredComponentIndex !== null && node.componentIndex !== preferredComponentIndex)) {
        continue;
      }

      const distanceSq = ((node.x - sourceX) * (node.x - sourceX)) + ((node.z - sourceZ) * (node.z - sourceZ));
      if (distanceSq < nearestDistanceSq) {
        nearestIndex = nodeIndex;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearestIndex;
  }

  createWantedResponseCar({
    id = '',
    itemId = PASSIVE_TRAFFIC_POLICE_CAR_ITEM_ID,
    ownerSessionId = '',
    unitId = '',
    unitKind = 'police-car',
    sourcePosition = null,
    targetPosition = null,
    carIndex = 0,
    speedMultiplier = 1
  } = {}) {
    const graph = this.graph;
    const normalizedId = String(id || '').trim();
    const normalizedItemId = String(itemId || PASSIVE_TRAFFIC_POLICE_CAR_ITEM_ID);
    if (
      !normalizedId
      || !graph
      || !PASSIVE_TRAFFIC_CAR_ITEM_IDS.includes(normalizedItemId)
      || this.getCarById(normalizedId)
    ) {
      return null;
    }

    const startNodeIndex = this.findNearestRoadNodeIndex(sourcePosition);
    if (startNodeIndex === null) {
      return null;
    }
    const startNode = graph.nodes?.[startNodeIndex];
    const targetNodeIndex = this.findNearestRoadNodeIndex(targetPosition, startNode?.componentIndex ?? null)
      ?? this.findNearestRoadNodeIndex(targetPosition);
    if (targetNodeIndex === null) {
      return null;
    }

    let route = findPassiveTrafficPath(graph, startNodeIndex, targetNodeIndex);
    if (route.length < 2) {
      const fallbackNeighbor = graph.nodes?.[startNodeIndex]?.neighbors
        ?.find((nodeIndex) => graph.activeNodeSet.has(nodeIndex))
        ?? null;
      route = fallbackNeighbor === null ? [startNodeIndex] : [startNodeIndex, fallbackNeighbor];
    }

    const car = this.createCarState(normalizedItemId, carIndex, WANTED_RESPONSE_ROUTE_ID);
    if (!car) {
      return null;
    }

    car.id = normalizedId;
    car.itemId = normalizedItemId;
    car.routeId = WANTED_RESPONSE_ROUTE_ID;
    car.carIndex = Math.max(0, Math.floor(Number(carIndex) || 0));
    car.currentNodeIndex = startNodeIndex;
    car.previousNodeIndex = null;
    car.targetNodeIndex = null;
    car.route = route;
    car.routeCursor = 1;
    car.routeDestinationIndex = route[route.length - 1] ?? targetNodeIndex;
    car.customRouteNodeIndices = [];
    car.customRouteCursor = 0;
    car.turnThroughNodeIndex = null;
    car.visitedNodeIndices = new Set();
    car.speed = PASSIVE_TRAFFIC_SPEED * Math.max(0.2, Number(speedMultiplier) || 1);
    car.currentSpeed = 0;
    car.turnStopSeconds = 0;
    car.turnStopWaypointIndex = -1;
    car.turnStopSatisfied = false;
    car.turnWaypointActive = false;
    car.turnWaypointIndex = 0;
    car.turnWaypointQueue.length = 0;
    car.turnWaypointCursor = 0;
    car.turnStartYaw = null;
    car.turnEndYaw = null;
    car.stuckSeconds = 0;
    car.collisionReverseSeconds = 0;
    car.collisionStopSeconds = 0;
    car.collisionCooldownSeconds = 0;
    car.disabledStartedSeconds = 0;
    car.disabledUntilSeconds = 0;
    car.disabledStartY = 0;
    car.responseCar = true;
    car.responseOwnerSessionId = String(ownerSessionId || '');
    car.responseUnitId = String(unitId || normalizedId);
    car.responseUnitKind = String(unitKind || 'police-car');
    car.responseArrived = false;
    car.responseArrivalReported = false;
    car.responseSinkStartedSeconds = 0;
    car.responseSinkUntilSeconds = 0;
    car.responseSinkStartY = 0;
    car.responseRemove = false;

    this.markNodeVisited(startNodeIndex, car);
    if (!this.advanceTarget(car)) {
      return null;
    }

    const currentNode = graph.nodes[startNodeIndex];
    const nextNode = graph.nodes[car.turnThroughNodeIndex ?? car.targetNodeIndex] ?? graph.nodes[route[1]] ?? currentNode;
    getPassiveTrafficLanePositionAtNode(currentNode, nextNode, car.position);
    car.position.y = this.getSurfaceHeightAtPosition(car.position.x, car.position.z);
    car.yaw = Math.atan2(
      (nextNode?.x ?? currentNode.x) - currentNode.x,
      (nextNode?.z ?? currentNode.z) - currentNode.z
    );
    car.lastPosition.copy(car.position);
    this.cars.push(car);
    this.sequence += 1;
    return this.getCarSnapshot(car);
  }

  collectArrivedWantedResponseCars() {
    const arrived = [];
    for (const car of this.cars) {
      if (!car?.responseCar || !car.responseArrived || car.responseArrivalReported || this.isCarSinking(car)) {
        continue;
      }
      car.responseArrivalReported = true;
      arrived.push({
        ...this.getCarSnapshot(car),
        ownerSessionId: car.responseOwnerSessionId || '',
        unitId: car.responseUnitId || car.id,
        unitKind: car.responseUnitKind || 'police-car'
      });
    }
    return arrived;
  }

  sinkWantedResponseCar(carId = '') {
    const car = this.getCarById(carId);
    if (!car?.responseCar || car.responseRemove) {
      return false;
    }

    car.responseSinkStartedSeconds = this.elapsedSeconds;
    car.responseSinkUntilSeconds = this.elapsedSeconds + WANTED_RESPONSE_CAR_SINK_SECONDS;
    car.responseSinkStartY = car.position.y;
    car.currentSpeed = 0;
    car.collisionReverseSeconds = 0;
    car.collisionStopSeconds = 0;
    car.collisionCooldownSeconds = WANTED_RESPONSE_CAR_SINK_SECONDS;
    car.turnStopSeconds = 0;
    this.sequence += 1;
    return true;
  }

  sinkWantedResponseCarsForOwner(ownerSessionId = '') {
    let changed = false;
    const normalizedOwner = String(ownerSessionId || '');
    for (const car of this.cars) {
      if (!car?.responseCar || car.responseOwnerSessionId !== normalizedOwner) {
        continue;
      }
      changed = this.sinkWantedResponseCar(car.id) || changed;
    }
    return changed;
  }

  disablePoliceCar(carId = '') {
    const car = this.getCarById(carId);
    if (!car || car.itemId !== PASSIVE_TRAFFIC_POLICE_CAR_ITEM_ID || this.isCarDisabled(car)) {
      return null;
    }

    car.disabledStartedSeconds = this.elapsedSeconds;
    car.disabledUntilSeconds = this.elapsedSeconds + PASSIVE_TRAFFIC_POLICE_CAR_RESPAWN_SECONDS;
    car.disabledStartY = car.position.y;
    car.currentSpeed = 0;
    car.collisionReverseSeconds = 0;
    car.collisionStopSeconds = 0;
    car.collisionCooldownSeconds = PASSIVE_TRAFFIC_POLICE_CAR_RESPAWN_SECONDS;
    car.turnStopSeconds = 0;
    this.sequence += 1;
    return this.getCarSnapshot(car);
  }

  respawnCar(car) {
    const carIndex = this.cars.indexOf(car);
    if (carIndex < 0) {
      return false;
    }

    const replacement = this.createCarState(car.itemId, car.carIndex, car.routeId);
    if (!replacement) {
      return false;
    }

    replacement.id = car.id;
    this.cars[carIndex] = replacement;
    this.sequence += 1;
    return true;
  }

  updateDisabledCar(car) {
    if (!car || (car.disabledUntilSeconds ?? 0) <= 0) {
      return false;
    }

    if (this.elapsedSeconds >= car.disabledUntilSeconds) {
      this.respawnCar(car);
      return true;
    }

    const duration = Math.max(0.1, PASSIVE_TRAFFIC_POLICE_CAR_RESPAWN_SECONDS);
    const progress = Math.max(0, Math.min(1, (this.elapsedSeconds - car.disabledStartedSeconds) / duration));
    const easedProgress = progress * progress * (3 - (2 * progress));
    car.currentSpeed = 0;
    car.position.y = car.disabledStartY - (PASSIVE_TRAFFIC_POLICE_CAR_SINK_DEPTH * easedProgress);
    car.lastPosition.copy(car.position);
    return true;
  }

  updateWantedResponseCarLifecycle(car) {
    if (!car?.responseCar) {
      return false;
    }

    if ((car.responseSinkUntilSeconds ?? 0) > 0) {
      if (this.elapsedSeconds >= car.responseSinkUntilSeconds) {
        car.responseRemove = true;
        return true;
      }

      const duration = Math.max(0.1, WANTED_RESPONSE_CAR_SINK_SECONDS);
      const progress = Math.max(0, Math.min(1, (this.elapsedSeconds - car.responseSinkStartedSeconds) / duration));
      const easedProgress = progress * progress * (3 - (2 * progress));
      car.currentSpeed = 0;
      car.position.y = car.responseSinkStartY - (PASSIVE_TRAFFIC_POLICE_CAR_SINK_DEPTH * easedProgress);
      car.lastPosition.copy(car.position);
      return true;
    }

    if (car.responseArrived) {
      car.currentSpeed = 0;
      return true;
    }

    return false;
  }

  markNodeVisited(nodeIndex, car = null) {
    this.visitCounter += 1;
    this.nodeVisits.set(
      nodeIndex,
      (this.nodeVisits.get(nodeIndex) ?? 0) + 1
    );
    this.nodeVisitOrder.set(nodeIndex, this.visitCounter);
    car?.visitedNodeIndices?.add(nodeIndex);
  }

  getActiveNeighbors(nodeIndex) {
    const graph = this.graph;
    const node = graph?.nodes?.[nodeIndex];
    const neighbors = this.activeNeighbors;
    neighbors.length = 0;
    if (!node) {
      return neighbors;
    }

    for (const neighborIndex of node.neighbors) {
      if (graph.activeNodeSet.has(neighborIndex)) {
        neighbors.push(neighborIndex);
      }
    }
    return neighbors;
  }

  isTurn(previousNodeIndex, currentNodeIndex, nextNodeIndex) {
    const graph = this.graph;
    if (!graph) {
      return false;
    }

    return isPassiveTrafficTurningThroughNode(
      graph.nodes?.[previousNodeIndex],
      graph.nodes?.[currentNodeIndex],
      graph.nodes?.[nextNodeIndex]
    );
  }

  isApproachingTurn(car) {
    const nextNodeIndex = car.route?.[car.routeCursor + 1] ?? null;
    return this.isTurn(car.currentNodeIndex, car.targetNodeIndex, nextNodeIndex);
  }

  getTurnStopSeconds(car) {
    return PASSIVE_TRAFFIC_TURN_STOP_SECONDS
      + ((car.carIndex % PASSIVE_TRAFFIC_SPEED_FACTORS.length) * PASSIVE_TRAFFIC_TURN_STOP_STEP_SECONDS);
  }

  getDesiredSpeed(car, distanceToTarget) {
    let desiredSpeed = car.speed;

    if (car.turnWaypointActive) {
      desiredSpeed *= getPassiveTrafficTurnSpeedFactor(car);
    } else if (this.isApproachingTurn(car)) {
      const approachRatio = Math.max(0.28, Math.min(1, distanceToTarget / PASSIVE_TRAFFIC_TURN_APPROACH_DISTANCE));
      desiredSpeed *= approachRatio;
    }

    if (car.driveCommand === PASSIVE_TRAFFIC_DRIVE_COMMANDS.REVERSE) {
      desiredSpeed *= PASSIVE_TRAFFIC_REVERSE_SPEED_FACTOR;
    }

    return desiredSpeed;
  }

  getDestinationCandidates(car) {
    const graph = this.graph;
    const currentNode = graph?.nodes?.[car.currentNodeIndex];
    if (!graph || !currentNode) {
      return [];
    }

    const activeDestinations = this.activeDestinations;
    activeDestinations.clear();
    for (const otherCar of this.cars) {
      if (!otherCar || otherCar === car) {
        continue;
      }
      const nodeIndex = otherCar.routeDestinationIndex ?? otherCar.targetNodeIndex;
      if (nodeIndex !== null && nodeIndex !== undefined) {
        activeDestinations.add(nodeIndex);
      }
    }

    const componentIndex = currentNode.componentIndex;
    const candidates = this.destinationCandidates;
    const candidatePool = this.destinationCandidatePool;
    const candidateNodeIndices = this.destinationCandidateNodeIndices;
    let candidateCount = 0;
    candidates.length = 0;
    candidateNodeIndices.length = 0;
    for (const nodeIndex of graph.activeNodeIndices) {
      const node = graph.nodes[nodeIndex];
      if (nodeIndex === car.currentNodeIndex || node?.componentIndex !== componentIndex) {
        continue;
      }

      const visitCount = this.nodeVisits.get(nodeIndex) ?? 0;
      const lastVisitOrder = this.nodeVisitOrder.get(nodeIndex) ?? -100000;
      let candidate = candidatePool[candidateCount];
      if (!candidate) {
        candidate = {
          nodeIndex: -1,
          carVisited: 0,
          visitCount: 0,
          lastVisitOrder: 0,
          distance: 0,
          activeDestination: 0,
          tieBreak: 0
        };
        candidatePool[candidateCount] = candidate;
      }
      candidate.nodeIndex = nodeIndex;
      candidate.carVisited = car.visitedNodeIndices?.has(nodeIndex) ? 1 : 0;
      candidate.visitCount = visitCount;
      candidate.lastVisitOrder = lastVisitOrder;
      candidate.distance = Math.abs(node.cellX - currentNode.cellX) + Math.abs(node.cellZ - currentNode.cellZ);
      candidate.activeDestination = activeDestinations.has(nodeIndex) ? 1 : 0;
      candidate.tieBreak = passiveTrafficTieBreak(nodeIndex, car.carIndex);
      candidates.push(candidate);
      candidateCount += 1;
    }

    if (!candidates.length) {
      return candidateNodeIndices;
    }

    candidates.sort((a, b) => (
      (a.carVisited - b.carVisited)
      || (a.visitCount - b.visitCount)
      || (a.activeDestination - b.activeDestination)
      || (a.lastVisitOrder - b.lastVisitOrder)
      || (b.distance - a.distance)
      || (a.tieBreak - b.tieBreak)
    ));
    candidates.length = Math.min(candidates.length, PASSIVE_TRAFFIC_DESTINATION_CANDIDATE_COUNT);
    candidates.sort((a, b) => (
      (b.distance - a.distance)
      || (a.carVisited - b.carVisited)
      || (a.visitCount - b.visitCount)
      || (a.activeDestination - b.activeDestination)
      || (a.lastVisitOrder - b.lastVisitOrder)
      || (a.tieBreak - b.tieBreak)
    ));
    for (const candidate of candidates) {
      candidateNodeIndices.push(candidate.nodeIndex);
    }
    return candidateNodeIndices;
  }

  isImmediateReverse(car, nextNodeIndex) {
    if (car.previousNodeIndex === null || car.previousNodeIndex === undefined || nextNodeIndex !== car.previousNodeIndex) {
      return false;
    }

    return this.getActiveNeighbors(car.currentNodeIndex)
      .some((neighborIndex) => neighborIndex !== car.previousNodeIndex);
  }

  chooseFallbackNeighbor(car) {
    const graph = this.graph;
    const neighbors = this.getActiveNeighbors(car.currentNodeIndex);
    if (!graph || !neighbors.length) {
      return null;
    }

    return neighbors
      .map((nodeIndex) => ({
        nodeIndex,
        immediateReverse: this.isImmediateReverse(car, nodeIndex) ? 1 : 0,
        carVisited: car.visitedNodeIndices?.has(nodeIndex) ? 1 : 0,
        visitCount: this.nodeVisits.get(nodeIndex) ?? 0,
        tieBreak: passiveTrafficTieBreak(nodeIndex, car.carIndex)
      }))
      .sort((a, b) => (
        (a.immediateReverse - b.immediateReverse)
        || (a.carVisited - b.carVisited)
        || (a.visitCount - b.visitCount)
        || (a.tieBreak - b.tieBreak)
      ))[0]?.nodeIndex ?? null;
  }

  assignCustomRoute(car) {
    const graph = this.graph;
    const routeNodes = car?.customRouteNodeIndices ?? [];
    if (!graph || routeNodes.length < PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      return false;
    }

    const lookahead = buildPassiveTrafficRouteLookahead(
      graph,
      routeNodes,
      car.currentNodeIndex,
      car.customRouteCursor
    );
    if (lookahead.route.length < PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      return false;
    }

    car.route = lookahead.route;
    car.routeCursor = 1;
    car.routeDestinationIndex = car.route[car.route.length - 1] ?? null;
    car.customRouteCursor = lookahead.cursor;
    return this.advanceTarget(car);
  }

  assignRoute(car) {
    const graph = this.graph;
    if (!graph || !car) {
      return false;
    }

    if (car.responseCar && car.routeCursor >= (car.route?.length ?? 0)) {
      car.responseArrived = true;
      car.currentSpeed = 0;
      car.targetNodeIndex = null;
      return false;
    }

    if ((car.customRouteNodeIndices?.length ?? 0) >= PASSIVE_TRAFFIC_MIN_ROAD_NODES) {
      if (this.assignCustomRoute(car)) {
        return true;
      }
    }

    const destinationCandidates = this.getDestinationCandidates(car);
    let reverseRoute = null;
    let reverseDestinationIndex = null;
    for (const destinationIndex of destinationCandidates) {
      const route = findPassiveTrafficPath(graph, car.currentNodeIndex, destinationIndex);
      if (route.length < 2) {
        continue;
      }

      if (this.isImmediateReverse(car, route[1])) {
        reverseRoute ??= route;
        reverseDestinationIndex ??= destinationIndex;
        continue;
      }

      car.route = route;
      car.routeCursor = 1;
      car.routeDestinationIndex = destinationIndex;
      return this.advanceTarget(car);
    }

    if (reverseRoute?.length >= 2) {
      car.route = reverseRoute;
      car.routeCursor = 1;
      car.routeDestinationIndex = reverseDestinationIndex;
      return this.advanceTarget(car);
    }

    const fallback = this.chooseFallbackNeighbor(car);
    if (fallback === null) {
      car.targetNodeIndex = null;
      return false;
    }

    car.route = [car.currentNodeIndex, fallback];
    car.routeCursor = 1;
    car.routeDestinationIndex = fallback;
    return this.advanceTarget(car);
  }

  advanceTarget(car) {
    const graph = this.graph;
    if (!graph || !car) {
      return false;
    }

    while (car.routeCursor < car.route.length && car.route[car.routeCursor] === car.currentNodeIndex) {
      car.routeCursor += 1;
    }

    if (car.routeCursor >= car.route.length) {
      if (car.responseCar) {
        car.responseArrived = true;
        car.currentSpeed = 0;
        car.targetNodeIndex = null;
        return false;
      }
      return this.assignRoute(car);
    }

    const routeNodeIndex = car.route[car.routeCursor];
    if (!graph.activeNodeSet.has(routeNodeIndex)) {
      return this.assignRoute(car);
    }

    const currentNode = graph.nodes[car.currentNodeIndex];
    const routeNode = graph.nodes[routeNodeIndex];
    if (!currentNode || !routeNode) {
      car.targetNodeIndex = null;
      return false;
    }

    const previousNode = graph.nodes?.[car.previousNodeIndex] ?? null;
    const departureScript = previousNode
      ? getPassiveTrafficDriveScript(previousNode, currentNode, routeNode)
      : null;
    const shouldScriptLeavingCurrentNode = Boolean(
      departureScript
      && (
        departureScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT
        || departureScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT
      )
      && departureScript.command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.REVERSE
      && departureScript.command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.STOP
    );
    const nextRouteNodeIndex = car.route?.[car.routeCursor + 1] ?? null;
    const canScriptThroughRouteNode = nextRouteNodeIndex !== null
      && graph.activeNodeSet.has(nextRouteNodeIndex);
    const routeScript = canScriptThroughRouteNode
      ? getPassiveTrafficDriveScript(currentNode, routeNode, graph.nodes[nextRouteNodeIndex])
      : null;
    const shouldScriptThroughRouteNode = Boolean(
      !shouldScriptLeavingCurrentNode
      && routeScript
      && (
        routeScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT
        || routeScript.command === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT
        || routeScript.shouldStopAtEntry
      )
      && routeScript.command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.REVERSE
      && routeScript.command !== PASSIVE_TRAFFIC_DRIVE_COMMANDS.STOP
    );
    const activeDriveScript = shouldScriptLeavingCurrentNode ? departureScript : routeScript;
    const finalNodeIndex = shouldScriptThroughRouteNode ? nextRouteNodeIndex : routeNodeIndex;
    const finalNode = graph.nodes[finalNodeIndex];
    if (!finalNode) {
      car.targetNodeIndex = null;
      return false;
    }

    car.targetNodeIndex = finalNodeIndex;
    car.routeAdvanceCount = shouldScriptThroughRouteNode ? 2 : 1;
    car.turnThroughNodeIndex = shouldScriptThroughRouteNode ? routeNodeIndex : null;
    car.driveCommand = (shouldScriptLeavingCurrentNode || shouldScriptThroughRouteNode)
      ? activeDriveScript.command
      : getPassiveTrafficDriveCommand(
        previousNode,
        currentNode,
        finalNode
      );
    car.turnWaypointActive = false;
    car.turnWaypointIndex = 0;
    car.turnStopWaypointIndex = -1;
    car.turnStopSatisfied = false;
    car.turnWaypointQueue.length = 0;
    car.turnWaypointCursor = 0;
    const turnYawRange = shouldScriptLeavingCurrentNode
      ? getPassiveTrafficTurnYawRange(previousNode, currentNode, finalNode)
      : (shouldScriptThroughRouteNode
        ? getPassiveTrafficTurnYawRange(currentNode, routeNode, finalNode)
        : null);
    car.turnStartYaw = turnYawRange?.startYaw ?? null;
    car.turnEndYaw = turnYawRange?.endYaw ?? null;
    getPassiveTrafficLanePosition(
      shouldScriptThroughRouteNode ? routeNode : currentNode,
      finalNode,
      car.finalTargetPosition
    );
    car.finalTargetPosition.y = this.getSurfaceHeightAtPosition(car.finalTargetPosition.x, car.finalTargetPosition.z);

    if (shouldScriptLeavingCurrentNode || shouldScriptThroughRouteNode) {
      const turnWaypoints = shouldScriptLeavingCurrentNode
        ? getPassiveTrafficTurnLaneWaypointsFromPosition(previousNode, currentNode, finalNode, car.position)
        : activeDriveScript.waypoints;
      for (const waypoint of turnWaypoints) {
        waypoint.y = this.getSurfaceHeightAtPosition(waypoint.x, waypoint.z);
        car.turnWaypointQueue.push(waypoint.clone());
      }
      car.turnStopWaypointIndex = shouldScriptThroughRouteNode ? activeDriveScript.stopWaypointIndex : -1;
      const nextTurnWaypoint = car.turnWaypointCursor < car.turnWaypointQueue.length
        ? car.turnWaypointQueue[car.turnWaypointCursor]
        : null;
      car.turnWaypointCursor += nextTurnWaypoint ? 1 : 0;
      if (nextTurnWaypoint) {
        car.targetPosition.copy(nextTurnWaypoint);
        car.turnWaypointActive = true;
      } else {
        car.targetPosition.copy(car.finalTargetPosition);
        car.targetPosition.y = this.getSurfaceHeightAtPosition(car.targetPosition.x, car.targetPosition.z);
        car.turnWaypointActive = true;
      }
    } else {
      car.targetPosition.copy(car.finalTargetPosition);
    }

    return true;
  }

  getCarRoadNodes(car) {
    const graph = this.graph;
    if (!graph || !car) {
      return [];
    }

    return [
      graph.nodes?.[car.currentNodeIndex],
      graph.nodes?.[car.turnThroughNodeIndex],
      graph.nodes?.[car.targetNodeIndex],
      graph.nodes?.[car.previousNodeIndex]
    ].filter(Boolean);
  }

  keepCarOnRoad(car) {
    const roadNodes = this.getCarRoadNodes(car);
    if (!roadNodes.length) {
      return;
    }

    if (roadNodes.some((node) => isPassiveTrafficPositionInsideRoadNode(node, car.position))) {
      return;
    }

    clampPassiveTrafficPositionToRoadNodes(roadNodes, car.position, car.position);
    car.position.y = this.getSurfaceHeightAtPosition(car.position.x, car.position.z);
  }

  recoverIfStuck(car) {
    const graph = this.graph;
    if (!graph || !car) {
      return false;
    }

    const currentNode = graph.nodes?.[car.currentNodeIndex];
    if (!currentNode) {
      return false;
    }

    const reverseNeighbor = this.getActiveNeighbors(car.currentNodeIndex)
      .find((nodeIndex) => nodeIndex === car.previousNodeIndex)
      ?? this.chooseFallbackNeighbor(car);
    if (reverseNeighbor === null || reverseNeighbor === undefined) {
      car.targetNodeIndex = null;
      return false;
    }

    car.route = [car.currentNodeIndex, reverseNeighbor];
    car.routeCursor = 1;
    car.routeDestinationIndex = reverseNeighbor;
    car.targetNodeIndex = null;
    car.turnThroughNodeIndex = null;
    car.routeAdvanceCount = 1;
    car.turnWaypointActive = false;
    car.turnWaypointQueue.length = 0;
    car.turnStartYaw = null;
    car.turnEndYaw = null;
    car.turnStopSeconds = 0;
    car.turnStopWaypointIndex = -1;
    car.turnStopSatisfied = false;
    car.stuckSeconds = 0;
    return this.advanceTarget(car);
  }

  updateStuckState(car, deltaSeconds, movedDistance) {
    if (!car || car.targetNodeIndex === null || car.turnStopSeconds > 0) {
      return;
    }

    if (movedDistance <= PASSIVE_TRAFFIC_STUCK_DISTANCE && car.currentSpeed > car.speed * 0.2) {
      car.stuckSeconds += deltaSeconds;
    } else {
      car.stuckSeconds = Math.max(0, car.stuckSeconds - (deltaSeconds * 2));
    }

    if (car.stuckSeconds >= PASSIVE_TRAFFIC_STUCK_SECONDS) {
      this.recoverIfStuck(car);
    }
  }

  updateCollisionTimers(car, deltaSeconds) {
    car.collisionCooldownSeconds = Math.max(0, (car.collisionCooldownSeconds ?? 0) - deltaSeconds);
  }

  updateCollisionYield(car, remainingTime) {
    if (!car || remainingTime <= 0) {
      return 0;
    }

    if ((car.collisionReverseSeconds ?? 0) > 0) {
      const reverseSeconds = Math.min(remainingTime, car.collisionReverseSeconds);
      car.collisionReverseSeconds = Math.max(0, car.collisionReverseSeconds - reverseSeconds);
      const reverseDistance = car.speed * PASSIVE_TRAFFIC_CAR_COLLISION_REVERSE_SPEED_FACTOR * reverseSeconds;
      const forward = getPassiveTrafficForwardVector(car.yaw, this.forwardScratch);
      car.position.x -= forward.x * reverseDistance;
      car.position.z -= forward.z * reverseDistance;
      this.keepCarOnRoad(car);
      car.position.y = this.getSurfaceHeightAtPosition(car.position.x, car.position.z);
      car.currentSpeed = dampNumber(car.currentSpeed, 0, PASSIVE_TRAFFIC_BRAKE_RESPONSE, reverseSeconds);
      car.stuckSeconds = 0;
      if (car.collisionReverseSeconds <= 0) {
        car.collisionStopSeconds = Math.max(car.collisionStopSeconds ?? 0, PASSIVE_TRAFFIC_CAR_COLLISION_STOP_SECONDS);
      }
      return reverseSeconds;
    }

    if ((car.collisionStopSeconds ?? 0) > 0) {
      const stopSeconds = Math.min(remainingTime, car.collisionStopSeconds);
      car.collisionStopSeconds = Math.max(0, car.collisionStopSeconds - stopSeconds);
      car.currentSpeed = dampNumber(car.currentSpeed, 0, PASSIVE_TRAFFIC_BRAKE_RESPONSE, stopSeconds);
      car.stuckSeconds = 0;
      return stopSeconds;
    }

    return 0;
  }

  chooseCollisionYieldCar(a, b) {
    const aForward = getPassiveTrafficForwardVector(a.yaw, { x: 0, z: 1 });
    const bForward = getPassiveTrafficForwardVector(b.yaw, { x: 0, z: 1 });
    const dx = b.position.x - a.position.x;
    const dz = b.position.z - a.position.z;
    const bAheadOfA = (dx * aForward.x) + (dz * aForward.z);
    const aAheadOfB = ((-dx) * bForward.x) + ((-dz) * bForward.z);

    if (bAheadOfA > 0.2 && aAheadOfB <= 0.2) {
      return a;
    }
    if (aAheadOfB > 0.2 && bAheadOfA <= 0.2) {
      return b;
    }

    if ((a.currentSpeed ?? 0) < (b.currentSpeed ?? 0) - 0.05) {
      return a;
    }
    if ((b.currentSpeed ?? 0) < (a.currentSpeed ?? 0) - 0.05) {
      return b;
    }

    return (a.carIndex ?? 0) > (b.carIndex ?? 0) ? a : b;
  }

  triggerCollisionYield(car) {
    if (!car) {
      return;
    }

    car.collisionReverseSeconds = Math.max(car.collisionReverseSeconds ?? 0, PASSIVE_TRAFFIC_CAR_COLLISION_REVERSE_SECONDS);
    car.collisionStopSeconds = Math.max(car.collisionStopSeconds ?? 0, PASSIVE_TRAFFIC_CAR_COLLISION_STOP_SECONDS);
    car.collisionCooldownSeconds = Math.max(car.collisionCooldownSeconds ?? 0, PASSIVE_TRAFFIC_CAR_COLLISION_COOLDOWN_SECONDS);
    car.turnStopSeconds = 0;
    car.currentSpeed = 0;
    car.stuckSeconds = 0;
  }

  updateCarCollisions() {
    if (this.cars.length < 2) {
      return;
    }

    for (let aIndex = 0; aIndex < this.cars.length - 1; aIndex += 1) {
      const a = this.cars[aIndex];
      if (!a?.position || this.isCarDisabled(a) || this.isCarSinking(a) || a.responseArrived) {
        continue;
      }

      for (let bIndex = aIndex + 1; bIndex < this.cars.length; bIndex += 1) {
        const b = this.cars[bIndex];
        if (
          !b?.position
          || this.isCarDisabled(b)
          || this.isCarSinking(b)
          || b.responseArrived
          || (a.collisionCooldownSeconds ?? 0) > 0
          || (b.collisionCooldownSeconds ?? 0) > 0
        ) {
          continue;
        }

        if (!passiveTrafficHitboxesOverlap(a.position, a.yaw, b.position, b.yaw, 0.08)) {
          continue;
        }

        const yieldCar = this.chooseCollisionYieldCar(a, b);
        const continueCar = yieldCar === a ? b : a;
        this.triggerCollisionYield(yieldCar);
        continueCar.collisionCooldownSeconds = Math.max(
          continueCar.collisionCooldownSeconds ?? 0,
          PASSIVE_TRAFFIC_CAR_COLLISION_COOLDOWN_SECONDS
        );
      }
    }
  }

  update(deltaSeconds) {
    if (!this.cars.length || !this.graph) {
      return this.getSnapshots();
    }

    const dt = Math.max(0, Math.min(0.08, Number(deltaSeconds) || 0));
    if (dt <= 0) {
      return this.getSnapshots();
    }
    this.elapsedSeconds += dt;

    for (let carIndex = 0; carIndex < this.cars.length; carIndex += 1) {
      const car = this.cars[carIndex];
      if (this.updateWantedResponseCarLifecycle(car)) {
        continue;
      }

      if (this.updateDisabledCar(car)) {
        continue;
      }

      this.updateCollisionTimers(car, dt);
      const startX = car.position.x;
      const startZ = car.position.z;
      let remainingTime = dt;
      let guard = 0;

      while (remainingTime > 0.0001 && guard < 6) {
        guard += 1;
        const collisionYieldSeconds = this.updateCollisionYield(car, remainingTime);
        if (collisionYieldSeconds > 0) {
          remainingTime -= collisionYieldSeconds;
          if ((car.collisionReverseSeconds ?? 0) > 0 || (car.collisionStopSeconds ?? 0) > 0) {
            break;
          }
          continue;
        }

        if (car.turnStopSeconds > 0) {
          car.turnStopSeconds = Math.max(0, car.turnStopSeconds - remainingTime);
          car.currentSpeed = dampNumber(car.currentSpeed, 0, PASSIVE_TRAFFIC_BRAKE_RESPONSE, remainingTime);
          break;
        }

        if (car.targetNodeIndex === null && !this.advanceTarget(car)) {
          break;
        }

        if (car.turnStopSeconds > 0) {
          car.currentSpeed = dampNumber(car.currentSpeed, 0, PASSIVE_TRAFFIC_BRAKE_RESPONSE, remainingTime);
          break;
        }

        const toTarget = this.scratch.subVectors(car.targetPosition, car.position);
        toTarget.y = 0;
        const distance = toTarget.length();
        if (distance <= PASSIVE_TRAFFIC_POSITION_EPSILON) {
          car.position.copy(car.targetPosition);
          this.keepCarOnRoad(car);
          if (car.turnWaypointActive) {
            if (
              car.turnWaypointIndex === car.turnStopWaypointIndex
              && !car.turnStopSatisfied
            ) {
              car.turnStopSatisfied = true;
              car.turnStopSeconds = Math.max(car.turnStopSeconds, this.getTurnStopSeconds(car));
              car.currentSpeed = 0;
              break;
            }

            const nextTurnWaypoint = car.turnWaypointCursor < car.turnWaypointQueue.length
              ? car.turnWaypointQueue[car.turnWaypointCursor]
              : null;
            car.turnWaypointCursor += nextTurnWaypoint ? 1 : 0;
            if (nextTurnWaypoint) {
              car.turnWaypointIndex += 1;
              car.targetPosition.copy(nextTurnWaypoint);
              continue;
            }

            car.turnWaypointActive = false;
            car.turnWaypointCursor = 0;
            car.turnWaypointQueue.length = 0;
            car.targetPosition.copy(car.finalTargetPosition);
            continue;
          }

          const arrivedNodeIndex = car.targetNodeIndex;
          const throughNodeIndex = car.turnThroughNodeIndex;
          const routeAdvanceCount = Math.max(1, car.routeAdvanceCount ?? 1);
          if (throughNodeIndex !== null && throughNodeIndex !== undefined && throughNodeIndex !== car.currentNodeIndex) {
            this.markNodeVisited(throughNodeIndex, car);
          }
          car.previousNodeIndex = throughNodeIndex ?? car.currentNodeIndex;
          car.currentNodeIndex = arrivedNodeIndex;
          car.routeCursor += routeAdvanceCount;
          car.targetNodeIndex = null;
          car.turnThroughNodeIndex = null;
          car.routeAdvanceCount = 1;
          if (car.routeCursor >= car.route.length) {
            car.routeDestinationIndex = null;
          }
          this.markNodeVisited(car.currentNodeIndex, car);
          continue;
        }

        const desiredSpeed = this.getDesiredSpeed(car, distance);
        car.currentSpeed = dampNumber(car.currentSpeed, desiredSpeed, PASSIVE_TRAFFIC_ACCEL_RESPONSE, remainingTime);
        const moveSpeed = Math.max(0, car.currentSpeed);
        if (moveSpeed <= 0.001) {
          break;
        }

        const step = Math.min(moveSpeed * remainingTime, distance);
        toTarget.multiplyScalar(1 / distance);
        this.targetScratch.copy(toTarget).multiplyScalar(step);
        car.position.add(this.targetScratch);
        this.keepCarOnRoad(car);
        car.position.y = this.getSurfaceHeightAtPosition(car.position.x, car.position.z);
        const stepDuration = step / moveSpeed;
        remainingTime -= stepDuration;

        let targetYaw = Math.atan2(toTarget.x, toTarget.z);
        if (
          car.turnWaypointActive
          && (
            car.driveCommand === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_LEFT
            || car.driveCommand === PASSIVE_TRAFFIC_DRIVE_COMMANDS.TURN_RIGHT
          )
          && Number.isFinite(car.turnStartYaw)
          && Number.isFinite(car.turnEndYaw)
        ) {
          targetYaw = clampPassiveTrafficTurnYaw(car.turnStartYaw, car.turnEndYaw, targetYaw);
          car.yaw = clampPassiveTrafficTurnYaw(car.turnStartYaw, car.turnEndYaw, car.yaw);
        }
        car.yaw = dampAngleRadians(car.yaw, targetYaw, PASSIVE_TRAFFIC_TURN_RESPONSE, stepDuration);
        if (
          car.turnWaypointActive
          && Number.isFinite(car.turnStartYaw)
          && Number.isFinite(car.turnEndYaw)
        ) {
          car.yaw = clampPassiveTrafficTurnYaw(car.turnStartYaw, car.turnEndYaw, car.yaw);
        }

        if (step < distance) {
          break;
        }
      }

      const movedDistance = Math.hypot(car.position.x - startX, car.position.z - startZ);
      this.updateStuckState(car, dt, movedDistance);
      car.lastPosition.copy(car.position);
    }

    this.updateCarCollisions();
    if (this.cars.some((car) => car?.responseRemove)) {
      this.cars = this.cars.filter((car) => !car?.responseRemove);
    }
    this.sequence += 1;
    return this.getSnapshots();
  }

  getCarSnapshot(car) {
    return {
      id: car.id,
      itemId: car.itemId,
      routeId: car.routeId,
      carIndex: car.carIndex,
      x: quantizePosition(car.position.x),
      y: quantizePosition(car.position.y),
      z: quantizePosition(car.position.z),
      rotationY: quantizeRotation(car.yaw),
      speed: quantizeNumber(car.currentSpeed, 3),
      active: !this.isCarDisabled(car) && !this.isCarSinking(car),
      currentNodeIndex: Math.max(-1, Math.floor(Number(car.currentNodeIndex) || 0)),
      targetNodeIndex: car.targetNodeIndex === null || car.targetNodeIndex === undefined
        ? -1
        : Math.max(-1, Math.floor(Number(car.targetNodeIndex) || 0)),
      seq: this.sequence
    };
  }

  getSnapshots() {
    return this.cars.map((car) => this.getCarSnapshot(car));
  }
}
