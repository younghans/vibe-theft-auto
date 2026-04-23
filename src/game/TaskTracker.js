import * as THREE from 'three';
import {
  getDeliveryQuestGiverCandidate,
  getDeliveryQuestTargetName,
  isDeliveryQuestActive,
  isDeliveryQuestGiver
} from '../shared/deliveryQuest.js';
import { getTileCenterWorldPosition } from '../shared/tileFootprint.js';
import { getBuilderItemById } from '../world/builderCatalog.js';

export const TASK_IDS = Object.freeze({
  delivery: 'delivery',
  gymPump: 'gym-pump',
  makeMoney: 'make-money'
});

const MAKE_MONEY_TASK_TITLE = 'Make some money. Maybe the Shady Figure can help';
const GYM_PUMP_TASK_TITLE = 'Go get a pump in the gym';

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

function isGymTaskBuildingPlacement(placement = null, item = null) {
  const itemId = String(item?.id ?? placement?.itemId ?? '').toLowerCase();
  const interiorId = String(item?.interior?.id ?? placement?.interactable?.interior?.id ?? '').toLowerCase();
  const label = String(item?.interior?.label ?? placement?.interactable?.label ?? item?.label ?? '').toLowerCase();
  return itemId.includes('gym') || interiorId.includes('gym') || label.includes('gym');
}

function getGymBuildingTaskTarget(context = {}) {
  const doorTarget = context.gymDoorBlockers?.[0] ?? null;
  if (doorTarget) {
    return getTaskPositionFromValue(doorTarget, context);
  }

  for (const placement of context.worldBuilder?.getLayout?.()?.tiles ?? []) {
    const item = getBuilderItemById(placement?.itemId);
    if (!item || !isGymTaskBuildingPlacement(placement, item)) {
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

export function getDeliveryCompletionCount(localPlayerState = null) {
  const count = Number(localPlayerState?.deliveryQuestCompletionCount ?? 0);
  if (Number.isFinite(count) && count > 0) {
    return Math.floor(count);
  }

  return Number(localPlayerState?.deliveryQuestCompletedAt ?? 0) > 0 ? 1 : 0;
}

export function getTaskProgressSnapshot(localPlayerState = null) {
  const gymPumpCompletedAt = Number(localPlayerState?.gymPumpCompletedAt ?? 0);
  return {
    deliveryCompletionCount: getDeliveryCompletionCount(localPlayerState),
    gymPumpCompletedAt: Number.isFinite(gymPumpCompletedAt) ? Math.max(0, gymPumpCompletedAt) : 0
  };
}

export function resolvePlayerTask(context = {}) {
  const { localPlayerState } = context;
  if (!localPlayerState || !isTaskIntroReady(localPlayerState, context.rentIntroState)) {
    return { id: '', visible: false, title: '', target: null };
  }

  if (isDeliveryQuestActive(localPlayerState)) {
    const targetNpcId = localPlayerState.deliveryQuestTargetNpcId;
    const targetName = getDeliveryQuestTargetName(context.npcStates?.get?.(targetNpcId));
    return {
      id: TASK_IDS.delivery,
      visible: true,
      title: `Deliver the package to ${targetName}`,
      target: getNpcTaskTarget(targetNpcId, context)
    };
  }

  const completedFirstDelivery = getDeliveryCompletionCount(localPlayerState) > 0;
  const gymPumpCompleted = Number(localPlayerState.gymPumpCompletedAt ?? 0) > 0;
  if (completedFirstDelivery && !gymPumpCompleted) {
    return {
      id: TASK_IDS.gymPump,
      visible: true,
      title: GYM_PUMP_TASK_TITLE,
      target: getGymTaskTarget(context)
    };
  }

  return {
    id: TASK_IDS.makeMoney,
    visible: true,
    title: MAKE_MONEY_TASK_TITLE,
    target: getDeliveryQuestGiverTaskTarget(context)
  };
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

  return false;
}

export class TaskTracker {
  constructor() {
    this.initialized = false;
    this.currentTaskId = '';
    this.progress = getTaskProgressSnapshot(null);
  }

  update(context = {}) {
    const task = resolvePlayerTask(context);
    const progress = getTaskProgressSnapshot(context.localPlayerState);
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
      task,
      progress,
      completedTask
    };
  }
}
