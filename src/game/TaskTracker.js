import * as THREE from 'three';
import {
  getDeliveryQuestGiverCandidate,
  getDeliveryQuestTargetName,
  isDeliveryQuestActive,
  isDeliveryQuestGiver
} from '../shared/deliveryQuest.js';
import { isBlackjackDealerNpc } from '../shared/blackjack.js';
import {
  MISSION_CATALOG,
  MISSION_IDS,
  MISSION_STATUS,
  getDeliveryCompletionCount,
  getMissionProgressSnapshot,
  getMissionSnapshots,
  resolveSelectedMissionId
} from '../shared/missions.js';
import { isStockMarketNpc } from '../shared/stockMarket.js';
import { getTileCenterWorldPosition } from '../shared/tileFootprint.js';
import { getBuilderItemById } from '../world/builderCatalog.js';

export const TASK_IDS = MISSION_IDS;
export { getDeliveryCompletionCount, getMissionProgressSnapshot as getTaskProgressSnapshot };

function getGroundHeight(context, value) {
  return typeof context.getGroundHeightAt === 'function'
    ? context.getGroundHeightAt(value)
    : 0;
}

function getTaskPositionFromValue(value = null, context = {}) {
  let x = NaN;
  let z = NaN;

  if (value?.isVector3) {
    x = value.x;
    z = value.z;
  } else if (Array.isArray(value)) {
    x = Number(value[0]);
    z = Number(value[1]);
  } else if (value) {
    x = Number(value.x);
    z = Number(value.z);
  }

  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return null;
  }

  return new THREE.Vector3(x, getGroundHeight(context, { x, z }), z);
}

function getTaskPositionForInteractable(interactable = null, context = {}) {
  return getTaskPositionFromValue(
    interactable?.approachPosition
    ?? interactable?.position
    ?? interactable?.originPosition
    ?? null,
    context
  );
}

function getNpcInteractableById(npcId = '', context = {}) {
  if (!npcId) {
    return null;
  }

  for (const interactable of context.worldBuilder?.getInteractables?.() ?? []) {
    if (
      interactable.kind === 'npc'
      && (interactable.npcId === npcId || interactable.placementId === npcId)
    ) {
      return interactable;
    }
  }

  return null;
}

function getNpcTaskTarget(npcId = '', context = {}) {
  const normalizedNpcId = String(npcId ?? '').trim();
  if (!normalizedNpcId) {
    return null;
  }

  const npcState = context.npcStates?.get?.(normalizedNpcId);
  const npcPosition = getTaskPositionFromValue(npcState, context);
  if (npcPosition) {
    return npcPosition;
  }

  return getTaskPositionForInteractable(getNpcInteractableById(normalizedNpcId, context), context);
}

function getDeliveryQuestGiverTaskTarget(context = {}) {
  const candidate = getDeliveryQuestGiverCandidate(context.npcStates);
  const candidateTarget = candidate?.id ? getNpcTaskTarget(candidate.id, context) : null;
  if (candidateTarget) {
    return candidateTarget;
  }

  for (const interactable of context.worldBuilder?.getInteractables?.() ?? []) {
    if (interactable.kind !== 'npc') {
      continue;
    }

    const npcId = interactable.npcId || interactable.placementId || '';
    const npcDetails = {
      ...(interactable.npc ?? {}),
      ...(npcId ? (context.npcStates?.get?.(npcId) ?? {}) : {})
    };
    if (isDeliveryQuestGiver(npcId, npcDetails)) {
      return getNpcTaskTarget(npcId, context) ?? getTaskPositionForInteractable(interactable, context);
    }
  }

  return null;
}

function getNpcTaskTargetByPredicate(predicate, context = {}) {
  for (const npcState of context.npcStates?.values?.() ?? []) {
    if (predicate(npcState)) {
      return getNpcTaskTarget(npcState.id, context);
    }
  }

  for (const interactable of context.worldBuilder?.getInteractables?.() ?? []) {
    if (interactable.kind !== 'npc') {
      continue;
    }

    const npcId = interactable.npcId || interactable.placementId || '';
    const npcDetails = {
      ...(interactable.npc ?? {}),
      ...(npcId ? (context.npcStates?.get?.(npcId) ?? {}) : {})
    };
    if (predicate(npcDetails)) {
      return getNpcTaskTarget(npcId, context) ?? getTaskPositionForInteractable(interactable, context);
    }
  }

  return null;
}

function isGymTaskBuildingPlacement(placement = null, item = null) {
  const itemId = String(item?.id ?? placement?.itemId ?? '').toLowerCase();
  const interiorId = String(item?.interior?.id ?? placement?.interactable?.interior?.id ?? '').toLowerCase();
  const label = String(item?.interior?.label ?? placement?.interactable?.label ?? item?.label ?? '').toLowerCase();
  return itemId.includes('gym') || interiorId.includes('gym') || label.includes('gym');
}

function isNamedTaskBuildingPlacement(placement = null, item = null, keyword = '') {
  const normalizedKeyword = String(keyword ?? '').toLowerCase();
  if (!normalizedKeyword) {
    return false;
  }

  const itemId = String(item?.id ?? placement?.itemId ?? '').toLowerCase();
  const interiorId = String(item?.interior?.id ?? placement?.interactable?.interior?.id ?? '').toLowerCase();
  const label = String(item?.interior?.label ?? placement?.interactable?.label ?? item?.label ?? '').toLowerCase();
  return itemId.includes(normalizedKeyword)
    || interiorId.includes(normalizedKeyword)
    || label.includes(normalizedKeyword);
}

function getBuildingTaskTarget(context = {}, predicate = () => false) {
  for (const placement of context.worldBuilder?.getLayout?.()?.tiles ?? []) {
    const item = getBuilderItemById(placement?.itemId);
    if (!item || !predicate(placement, item)) {
      continue;
    }

    const cellX = Number(placement.cell?.[0] ?? placement.cellX);
    const cellZ = Number(placement.cell?.[1] ?? placement.cellZ);
    if (!Number.isFinite(cellX) || !Number.isFinite(cellZ)) {
      continue;
    }

    const center = getTileCenterWorldPosition(
      item,
      cellX,
      cellZ,
      placement.rotationQuarterTurns ?? 0
    );
    return getTaskPositionFromValue(center, context);
  }

  return null;
}

function getGymBuildingTaskTarget(context = {}) {
  const doorTarget = context.gymDoorBlockers?.[0] ?? null;
  if (doorTarget) {
    return getTaskPositionFromValue(doorTarget, context);
  }

  return getBuildingTaskTarget(context, isGymTaskBuildingPlacement);
}

function getGymTaskTarget(context = {}) {
  const activeSnatch = (context.activeInteractables ?? [])
    .find((interactable) => interactable.kind === 'snatch-workout');
  const activeSnatchTarget = getTaskPositionForInteractable(activeSnatch, context);
  if (activeSnatchTarget) {
    return activeSnatchTarget;
  }

  const worldSnatch = (context.worldBuilder?.getInteractables?.() ?? [])
    .find((interactable) => interactable.kind === 'snatch-workout' || interactable.itemId === 'olympic_barbell');
  const worldSnatchTarget = getTaskPositionForInteractable(worldSnatch, context);
  if (worldSnatchTarget) {
    return worldSnatchTarget;
  }

  return getGymBuildingTaskTarget(context);
}

function getStockBuyTaskTarget(context = {}) {
  return getNpcTaskTargetByPredicate(isStockMarketNpc, context)
    ?? getBuildingTaskTarget(context, (placement, item) => isNamedTaskBuildingPlacement(placement, item, 'bank'));
}

function getBlackjackTaskTarget(context = {}) {
  return getNpcTaskTargetByPredicate(isBlackjackDealerNpc, context)
    ?? getBuildingTaskTarget(context, (placement, item) => isNamedTaskBuildingPlacement(placement, item, 'casino'));
}

function getMissionTarget(missionId = '', context = {}) {
  if (missionId === TASK_IDS.delivery) {
    return getNpcTaskTarget(context.localPlayerState?.deliveryQuestTargetNpcId, context);
  }

  if (missionId === TASK_IDS.gymPump) {
    return getGymTaskTarget(context);
  }

  if (missionId === TASK_IDS.stockBuy) {
    return getStockBuyTaskTarget(context);
  }

  if (missionId === TASK_IDS.blackjackHand) {
    return getBlackjackTaskTarget(context);
  }

  return getDeliveryQuestGiverTaskTarget(context);
}

function getMissionTitle(mission = null, context = {}) {
  if (mission?.id === TASK_IDS.delivery && isDeliveryQuestActive(context.localPlayerState)) {
    const targetNpcId = context.localPlayerState.deliveryQuestTargetNpcId;
    const targetName = getDeliveryQuestTargetName(context.npcStates?.get?.(targetNpcId));
    return `\u{1F4E6} Deliver the package to ${targetName}`;
  }

  return mission?.title ?? '';
}

function getMissionDescription(mission = null, context = {}) {
  if (mission?.id === TASK_IDS.delivery && isDeliveryQuestActive(context.localPlayerState)) {
    const targetNpcId = context.localPlayerState.deliveryQuestTargetNpcId;
    const targetName = getDeliveryQuestTargetName(context.npcStates?.get?.(targetNpcId));
    return `Find ${targetName} and complete the delivery.`;
  }

  return mission?.description ?? '';
}

function isTaskIntroReady(localPlayerState = null, rentIntroState = {}) {
  const seq = Number(localPlayerState?.rentIntroSeq ?? 0);
  if (!Number.isFinite(seq) || seq <= 0) {
    return true;
  }

  if (rentIntroState.pendingSeq === seq) {
    return false;
  }

  if (rentIntroState.activeSeq === seq) {
    return rentIntroState.activeCharged === true;
  }

  return rentIntroState.handledSeq === seq;
}

function getMissionDefinitionById(missionId = '') {
  return MISSION_CATALOG.find((mission) => mission.id === missionId) ?? null;
}

export function resolvePlayerMissions(context = {}) {
  const { localPlayerState } = context;
  const missionSequence = context.worldBuilder?.getMissionSequence?.() ?? context.missionSequence ?? null;
  const progress = getMissionProgressSnapshot(localPlayerState);
  const selectedMissionId = resolveSelectedMissionId(localPlayerState, localPlayerState?.selectedMissionId, missionSequence);
  const missions = getMissionSnapshots(localPlayerState, selectedMissionId, missionSequence)
    .map((mission) => ({
      ...mission,
      title: getMissionTitle(mission, context),
      description: getMissionDescription(mission, context),
      target: getMissionTarget(mission.id, context)
    }));
  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) ?? null;
  const visible = Boolean(
    localPlayerState
    && selectedMission
    && selectedMission.status !== MISSION_STATUS.locked
    && selectedMission.status !== MISSION_STATUS.completed
    && isTaskIntroReady(localPlayerState, context.rentIntroState)
  );
  const fallbackDefinition = getMissionDefinitionById(TASK_IDS.makeMoney);

  return {
    missions,
    selectedMission,
    progress,
    task: {
      id: visible ? selectedMission.id : '',
      visible,
      title: visible ? selectedMission.title : '',
      target: visible ? selectedMission.target : null
    },
    fallbackTask: {
      id: TASK_IDS.makeMoney,
      visible: Boolean(localPlayerState && isTaskIntroReady(localPlayerState, context.rentIntroState)),
      title: fallbackDefinition?.title ?? '',
      target: getDeliveryQuestGiverTaskTarget(context)
    }
  };
}

export function resolvePlayerTask(context = {}) {
  return resolvePlayerMissions(context).task;
}

function didTaskComplete(previousTaskId = '', progress = {}, previousProgress = {}) {
  if (previousTaskId === TASK_IDS.delivery) {
    return progress.deliveryCompletionCount > previousProgress.deliveryCompletionCount;
  }

  if (previousTaskId === TASK_IDS.gymPump) {
    return (
      progress.gymPumpCompletedAt > 0
      && progress.gymPumpCompletedAt !== previousProgress.gymPumpCompletedAt
    );
  }

  if (previousTaskId === TASK_IDS.stockBuy) {
    return (
      progress.stockBoughtAt > 0
      && progress.stockBoughtAt !== previousProgress.stockBoughtAt
    );
  }

  if (previousTaskId === TASK_IDS.blackjackHand) {
    return (
      progress.blackjackHandPlayedAt > 0
      && progress.blackjackHandPlayedAt !== previousProgress.blackjackHandPlayedAt
    );
  }

  if (previousTaskId === TASK_IDS.makeMoney) {
    return (
      (progress.deliveryActive && !previousProgress.deliveryActive)
      || progress.deliveryCompletionCount > previousProgress.deliveryCompletionCount
    );
  }

  return false;
}

export class TaskTracker {
  constructor() {
    this.initialized = false;
    this.currentTaskId = '';
    this.progress = getMissionProgressSnapshot(null);
  }

  update(context = {}) {
    const missionState = resolvePlayerMissions(context);
    const { task, progress } = missionState;
    const completedTask = Boolean(
      this.initialized
      && context.localPlayerState
      && task.visible
      && didTaskComplete(this.currentTaskId, progress, this.progress)
    );

    this.initialized = Boolean(context.localPlayerState);
    this.currentTaskId = task.visible ? task.id : '';
    this.progress = progress;

    return {
      ...missionState,
      completedTask
    };
  }
}
