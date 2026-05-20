import * as THREE from 'three';
import {
  getDeliveryQuestGiverCandidate,
  getDeliveryQuestTargetName,
  isDeliveryQuestActive,
  isDeliveryQuestGiver
} from '../shared/deliveryQuest.js';
import { isBlackjackDealerNpc } from '../shared/blackjack.js';
import {
  JANITOR_TASKS_REQUIRED,
  CHARISMA_LEVEL_MISSION_TARGET_LEVEL,
  BECOME_CEO_CHARISMA_LEVEL_REQUIRED,
  BECOME_CEO_INTELLIGENCE_REQUIRED,
  BECOME_CEO_STRENGTH_LEVEL_REQUIRED,
  MISSION_CATALOG,
  MISSION_IDS,
  MISSION_STATUS,
  SCHOOL_TEACHER_TASKS_REQUIRED,
  getDeliveryCompletionCount,
  getMissionProgressSnapshot,
  getMissionSnapshots,
  resolveSelectedMissionId
} from '../shared/missions.js';
import { OFFICE_JOB_IDS } from '../shared/officeJobs.js';
import { isPawnShopOwnerNpc } from '../shared/pawnShop.js';
import { isSchoolMicrogameNpc } from '../shared/schoolMicrogames.js';
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

function getWorldBuilderInteractables(context = {}) {
  return context.worldBuilderInteractables
    ?? context.worldBuilder?.getInteractables?.()
    ?? [];
}

function forEachWorldPlacement(context = {}, callback = () => {}) {
  if (typeof context.worldBuilder?.forEachPlacement === 'function') {
    context.worldBuilder.forEachPlacement(callback);
    return;
  }

  for (const placement of context.worldBuilder?.getLayout?.()?.tiles ?? []) {
    callback(placement);
  }
}

function getNpcInteractableById(npcId = '', context = {}) {
  if (!npcId) {
    return null;
  }

  for (const interactable of getWorldBuilderInteractables(context)) {
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

  for (const interactable of getWorldBuilderInteractables(context)) {
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

  for (const interactable of getWorldBuilderInteractables(context)) {
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
  let target = null;

  forEachWorldPlacement(context, (placement) => {
    if (target || (placement?.layer && placement.layer !== 'tile')) {
      return;
    }

    const item = getBuilderItemById(placement?.itemId);
    if (!item || !predicate(placement, item)) {
      return;
    }

    const cellX = Number(placement.cell?.[0] ?? placement.cellX);
    const cellZ = Number(placement.cell?.[1] ?? placement.cellZ);
    if (!Number.isFinite(cellX) || !Number.isFinite(cellZ)) {
      return;
    }

    const center = getTileCenterWorldPosition(
      item,
      cellX,
      cellZ,
      placement.rotationQuarterTurns ?? 0
    );
    target = getTaskPositionFromValue(center, context);
  });

  return target;
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

  const activeBasketballHoop = (context.activeInteractables ?? [])
    .find((interactable) => interactable.kind === 'basketball-shot-workout');
  const activeBasketballHoopTarget = getTaskPositionForInteractable(activeBasketballHoop, context);
  if (activeBasketballHoopTarget) {
    return activeBasketballHoopTarget;
  }

  const activeTreadmill = (context.activeInteractables ?? [])
    .find((interactable) => interactable.kind === 'treadmill-workout');
  const activeTreadmillTarget = getTaskPositionForInteractable(activeTreadmill, context);
  if (activeTreadmillTarget) {
    return activeTreadmillTarget;
  }

  const worldSnatch = getWorldBuilderInteractables(context)
    .find((interactable) => interactable.kind === 'snatch-workout' || interactable.itemId === 'olympic_barbell');
  const worldSnatchTarget = getTaskPositionForInteractable(worldSnatch, context);
  if (worldSnatchTarget) {
    return worldSnatchTarget;
  }

  const worldBasketballHoop = getWorldBuilderInteractables(context)
    .find((interactable) => interactable.kind === 'basketball-shot-workout' || interactable.itemId === 'basketball_hoop');
  const worldBasketballHoopTarget = getTaskPositionForInteractable(worldBasketballHoop, context);
  if (worldBasketballHoopTarget) {
    return worldBasketballHoopTarget;
  }

  const worldTreadmill = getWorldBuilderInteractables(context)
    .find((interactable) => interactable.kind === 'treadmill-workout' || interactable.itemId === 'treadmill');
  const worldTreadmillTarget = getTaskPositionForInteractable(worldTreadmill, context);
  if (worldTreadmillTarget) {
    return worldTreadmillTarget;
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

function getSchoolTaskTarget(context = {}) {
  return getNpcTaskTargetByPredicate(isSchoolMicrogameNpc, context)
    ?? getBuildingTaskTarget(context, (placement, item) => isNamedTaskBuildingPlacement(placement, item, 'school'));
}

function getOfficeJobTaskTarget(context = {}, jobId = '') {
  const activeStation = (context.activeInteractables ?? [])
    .find((interactable) =>
      interactable.kind === 'office-job-station'
      && (!jobId || interactable.officeJobId === jobId)
    );
  const activeStationTarget = getTaskPositionForInteractable(activeStation, context);
  if (activeStationTarget) {
    return activeStationTarget;
  }

  const worldStation = (context.worldBuilder?.getInteractables?.() ?? [])
    .find((interactable) =>
      interactable.kind === 'office-job-station'
      && (!jobId || interactable.officeJobId === jobId)
    );
  const worldStationTarget = getTaskPositionForInteractable(worldStation, context);
  if (worldStationTarget) {
    return worldStationTarget;
  }

  return getBuildingTaskTarget(context, (placement, item) => isNamedTaskBuildingPlacement(placement, item, 'offices'));
}

function getPawnShopTaskTarget(context = {}) {
  return getNpcTaskTargetByPredicate(isPawnShopOwnerNpc, context)
    ?? getBuildingTaskTarget(context, (placement, item) => isNamedTaskBuildingPlacement(placement, item, 'pawn'));
}

function getMissionTarget(missionId = '', context = {}) {
  if (missionId === TASK_IDS.delivery) {
    return getNpcTaskTarget(context.localPlayerState?.deliveryQuestTargetNpcId, context);
  }

  if (missionId === TASK_IDS.schoolTeacherTasks) {
    return getSchoolTaskTarget(context);
  }

  if (missionId === TASK_IDS.janitorTasks) {
    return getOfficeJobTaskTarget(context, OFFICE_JOB_IDS.janitor);
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

  if (missionId === TASK_IDS.transportationUpgrade) {
    return getPawnShopTaskTarget(context);
  }

  if (missionId === TASK_IDS.officeManagerPromotion) {
    return getOfficeJobTaskTarget(context, OFFICE_JOB_IDS.officeManager);
  }

  if (missionId === TASK_IDS.becomeCeo) {
    return getOfficeJobTaskTarget(context, OFFICE_JOB_IDS.ceo);
  }

  if (missionId === TASK_IDS.makeMoney) {
    return getDeliveryQuestGiverTaskTarget(context);
  }

  return null;
}

function getMissionTitle(mission = null, context = {}) {
  if (mission?.hiddenForPlayers === true) {
    return 'Hidden';
  }

  if (mission?.id === TASK_IDS.delivery && isDeliveryQuestActive(context.localPlayerState)) {
    const targetNpcId = context.localPlayerState.deliveryQuestTargetNpcId;
    const targetName = getDeliveryQuestTargetName(context.npcStates?.get?.(targetNpcId));
    return `\u{1F4E6} Deliver the package to ${targetName}`;
  }

  return mission?.title ?? '';
}

function getMissionDescription(mission = null, context = {}) {
  if (mission?.hiddenForPlayers === true) {
    return 'Hidden';
  }

  if (mission?.id === TASK_IDS.delivery && isDeliveryQuestActive(context.localPlayerState)) {
    const targetNpcId = context.localPlayerState.deliveryQuestTargetNpcId;
    const targetName = getDeliveryQuestTargetName(context.npcStates?.get?.(targetNpcId));
    return `Find ${targetName} and complete the delivery.`;
  }

  const progress = getMissionProgressSnapshot(context.localPlayerState);
  if (mission?.id === TASK_IDS.schoolTeacherTasks) {
    const completed = Math.min(SCHOOL_TEACHER_TASKS_REQUIRED, progress.schoolTasksCompletedCount);
    return completed >= SCHOOL_TEACHER_TASKS_REQUIRED
      ? 'Teacher tasks complete.'
      : `Complete ${completed}/${SCHOOL_TEACHER_TASKS_REQUIRED} teacher tasks.`;
  }

  if (mission?.id === TASK_IDS.janitorTasks) {
    const completed = Math.min(JANITOR_TASKS_REQUIRED, progress.janitorTasksCompletedCount);
    return completed >= JANITOR_TASKS_REQUIRED
      ? 'Janitor tasks complete.'
      : `Complete ${completed}/${JANITOR_TASKS_REQUIRED} janitor tasks.`;
  }

  if (mission?.id === TASK_IDS.transportationUpgrade && progress.skateboardOwned) {
    return 'Skateboard owned.';
  }

  if (mission?.id === TASK_IDS.officeManagerPromotion && progress.officeManagerCompletedAt > 0) {
    return 'Office manager shift complete.';
  }

  if (mission?.id === TASK_IDS.charismaLevel5) {
    const currentLevel = Math.min(CHARISMA_LEVEL_MISSION_TARGET_LEVEL, progress.charismaLevel);
    return currentLevel >= CHARISMA_LEVEL_MISSION_TARGET_LEVEL
      ? `Charisma level ${CHARISMA_LEVEL_MISSION_TARGET_LEVEL} reached.`
      : `Reach Charisma level ${CHARISMA_LEVEL_MISSION_TARGET_LEVEL}. Current: ${currentLevel}/${CHARISMA_LEVEL_MISSION_TARGET_LEVEL}.`;
  }

  if (mission?.id === TASK_IDS.becomeCeo) {
    if (progress.ceoCompletedAt > 0) {
      return 'CEO shift complete.';
    }

    const intelligenceLevel = Math.max(1, Math.floor(Number(progress.intelligenceLevel ?? 1) || 1));
    const charismaLevel = Math.max(1, Math.floor(Number(progress.charismaLevel ?? 1) || 1));
    const strengthLevel = Math.max(1, Math.floor(Number(progress.strengthLevel ?? 1) || 1));
    const requirementsMet = intelligenceLevel >= BECOME_CEO_INTELLIGENCE_REQUIRED
      && charismaLevel >= BECOME_CEO_CHARISMA_LEVEL_REQUIRED
      && strengthLevel >= BECOME_CEO_STRENGTH_LEVEL_REQUIRED;
    if (requirementsMet) {
      return 'Complete a CEO shift at the meeting table.';
    }

    return [
      `Intelligence Lv ${Math.min(intelligenceLevel, BECOME_CEO_INTELLIGENCE_REQUIRED)}/${BECOME_CEO_INTELLIGENCE_REQUIRED}`,
      `Charisma Lv ${Math.min(charismaLevel, BECOME_CEO_CHARISMA_LEVEL_REQUIRED)}/${BECOME_CEO_CHARISMA_LEVEL_REQUIRED}`,
      `Strength Lv ${Math.min(strengthLevel, BECOME_CEO_STRENGTH_LEVEL_REQUIRED)}/${BECOME_CEO_STRENGTH_LEVEL_REQUIRED}`
    ].join('. ');
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

  if (previousTaskId === TASK_IDS.schoolTeacherTasks) {
    return (
      previousProgress.schoolTasksCompletedCount < SCHOOL_TEACHER_TASKS_REQUIRED
      && progress.schoolTasksCompletedCount >= SCHOOL_TEACHER_TASKS_REQUIRED
    );
  }

  if (previousTaskId === TASK_IDS.janitorTasks) {
    return (
      previousProgress.janitorTasksCompletedCount < JANITOR_TASKS_REQUIRED
      && progress.janitorTasksCompletedCount >= JANITOR_TASKS_REQUIRED
    );
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

  if (previousTaskId === TASK_IDS.transportationUpgrade) {
    return progress.skateboardOwned === true && previousProgress.skateboardOwned !== true;
  }

  if (previousTaskId === TASK_IDS.officeManagerPromotion) {
    return (
      progress.officeManagerCompletedAt > 0
      && progress.officeManagerCompletedAt !== previousProgress.officeManagerCompletedAt
    );
  }

  if (previousTaskId === TASK_IDS.charismaLevel5) {
    return (
      previousProgress.charismaLevel < CHARISMA_LEVEL_MISSION_TARGET_LEVEL
      && progress.charismaLevel >= CHARISMA_LEVEL_MISSION_TARGET_LEVEL
    );
  }

  if (previousTaskId === TASK_IDS.becomeCeo) {
    return (
      progress.ceoCompletedAt > 0
      && progress.ceoCompletedAt !== previousProgress.ceoCompletedAt
    );
  }

  if (previousTaskId === TASK_IDS.makeMoney) {
    return progress.deliveryCompletionCount > previousProgress.deliveryCompletionCount;
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
      && this.currentTaskId
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
