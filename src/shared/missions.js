import { isDeliveryQuestActive } from './deliveryQuest.js';

export const MISSION_IDS = Object.freeze({
  delivery: 'delivery',
  gymPump: 'gym-pump',
  stockBuy: 'stock-buy',
  blackjackHand: 'blackjack-hand',
  makeMoney: 'make-money'
});

export const MISSION_STATUS = Object.freeze({
  available: 'available',
  completed: 'completed',
  inProgress: 'inProgress',
  locked: 'locked'
});

export const MISSION_CATALOG = Object.freeze([
  {
    id: MISSION_IDS.makeMoney,
    title: '\u{1F4B5} Make some money. Maybe the Shady Figure can help?',
    label: 'Make Money',
    icon: 'money',
    description: 'Find the Shady Figure and take a quick cash job.',
    requirement: '',
    repeatable: true
  },
  {
    id: MISSION_IDS.delivery,
    title: '\u{1F4E6} Deliver the package.',
    label: 'Delivery',
    icon: 'package',
    description: 'Get the package to the contact without losing time.',
    requirement: 'Accept work from the Shady Figure.'
  },
  {
    id: MISSION_IDS.gymPump,
    title: '\u{1F4AA} Go get a pump in the gym.',
    label: 'Gym Pump',
    icon: 'muscle',
    description: 'Use the snatch station and finish a workout.',
    requirement: 'Help the Shady Figure first.'
  },
  {
    id: MISSION_IDS.stockBuy,
    title: '\u{1F4C8} Buy a stock at the bank.',
    label: 'First Stock',
    icon: 'chart',
    description: 'Visit the bank and buy any stock from the street exchange.',
    requirement: 'Help the Shady Figure first.'
  },
  {
    id: MISSION_IDS.blackjackHand,
    title: '\u{1F0CF} Play a hand of blackjack at the casino.',
    label: 'Blackjack Hand',
    icon: 'playing-card',
    description: 'Sit with the dealer and play one hand.',
    requirement: 'Help the Shady Figure first.'
  }
].map(Object.freeze));

const MISSION_BY_ID = new Map(MISSION_CATALOG.map((mission) => [mission.id, mission]));

function cloneMissionSequenceEntry(entry) {
  return {
    missionId: entry.missionId,
    makeAvailableAfterMission: entry.makeAvailableAfterMission === true,
    availableAfterMissionNumber: Math.max(0, Math.floor(Number(entry.availableAfterMissionNumber) || 0))
  };
}

function getRawMissionSequenceEntryMissionId(entry = {}) {
  return normalizeMissionId(entry?.missionId ?? entry?.id);
}

function getRawMissionSequenceEntryGateNumber(entry = {}, fallback = 0) {
  const raw = entry?.availableAfterMissionNumber ?? entry?.unlockAfterMissionNumber ?? entry?.afterMissionNumber;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

export function createDefaultMissionSequence() {
  return MISSION_CATALOG.map((mission, index) => Object.freeze({
    missionId: mission.id,
    makeAvailableAfterMission: index > 0,
    availableAfterMissionNumber: index
  }));
}

export function normalizeMissionSequenceConfig(sequence = null) {
  const rawEntries = Array.isArray(sequence) ? sequence : [];
  const rawEntryByMissionId = new Map();
  const orderedMissionIds = [];

  for (const entry of rawEntries) {
    const missionId = getRawMissionSequenceEntryMissionId(entry);
    if (!missionId || rawEntryByMissionId.has(missionId)) {
      continue;
    }

    rawEntryByMissionId.set(missionId, entry);
    orderedMissionIds.push(missionId);
  }

  for (const mission of MISSION_CATALOG) {
    if (!rawEntryByMissionId.has(mission.id)) {
      orderedMissionIds.push(mission.id);
    }
  }

  return orderedMissionIds.map((missionId, index) => {
    const rawEntry = rawEntryByMissionId.get(missionId) ?? {};
    const defaultGateNumber = index > 0 ? index : 0;
    const rawGateEnabled = Object.hasOwn(rawEntry, 'makeAvailableAfterMission')
      ? rawEntry.makeAvailableAfterMission
      : rawEntry.unlockAfterMissionNumber ?? rawEntry.afterMissionNumber;
    const makeAvailableAfterMission = index > 0 && Boolean(rawGateEnabled ?? true);
    const maxGateNumber = index;
    const availableAfterMissionNumber = index > 0
      ? Math.min(Math.max(1, getRawMissionSequenceEntryGateNumber(rawEntry, defaultGateNumber)), maxGateNumber)
      : 0;

    return Object.freeze({
      missionId,
      makeAvailableAfterMission,
      availableAfterMissionNumber
    });
  });
}

export function cloneMissionSequence(sequence = null) {
  return normalizeMissionSequenceConfig(sequence).map(cloneMissionSequenceEntry);
}

export function moveMissionSequenceEntry(sequence = null, fromIndex = 0, toIndex = 0) {
  const entries = cloneMissionSequence(sequence);
  const from = Math.floor(Number(fromIndex));
  const to = Math.floor(Number(toIndex));
  if (
    !Number.isFinite(from)
    || !Number.isFinite(to)
    || from < 0
    || to < 0
    || from >= entries.length
    || to >= entries.length
    || from === to
  ) {
    return normalizeMissionSequenceConfig(entries);
  }

  const [entry] = entries.splice(from, 1);
  entries.splice(to, 0, entry);
  return normalizeMissionSequenceConfig(entries);
}

export function updateMissionSequenceEntry(sequence = null, missionId = '', updates = {}) {
  const normalizedMissionId = normalizeMissionId(missionId);
  if (!normalizedMissionId) {
    return normalizeMissionSequenceConfig(sequence);
  }

  const entries = cloneMissionSequence(sequence).map((entry) => {
    if (entry.missionId !== normalizedMissionId) {
      return entry;
    }

    return {
      ...entry,
      ...(Object.hasOwn(updates, 'makeAvailableAfterMission')
        ? { makeAvailableAfterMission: updates.makeAvailableAfterMission === true }
        : {}),
      ...(Object.hasOwn(updates, 'availableAfterMissionNumber')
        ? { availableAfterMissionNumber: Math.floor(Number(updates.availableAfterMissionNumber) || 0) }
        : {})
    };
  });

  return normalizeMissionSequenceConfig(entries);
}

export function getMissionSequenceViewModel(sequence = null) {
  const normalizedSequence = normalizeMissionSequenceConfig(sequence);
  return normalizedSequence.map((entry, index) => {
    const definition = getMissionDefinition(entry.missionId);
    const missionNumber = index + 1;
    return Object.freeze({
      ...cloneMissionSequenceEntry(entry),
      missionNumber,
      canRequireMission: index > 0,
      maxAvailableAfterMissionNumber: index,
      label: definition?.label ?? entry.missionId,
      title: definition?.title ?? definition?.label ?? entry.missionId,
      description: definition?.description ?? ''
    });
  });
}

export function getMissionDefinition(missionId = '') {
  return MISSION_BY_ID.get(String(missionId ?? '')) ?? null;
}

export function normalizeMissionId(missionId = '') {
  const normalized = String(missionId ?? '').trim();
  return MISSION_BY_ID.has(normalized) ? normalized : '';
}

export function getDeliveryCompletionCount(player = null) {
  const count = Number(player?.deliveryQuestCompletionCount ?? 0);
  if (Number.isFinite(count) && count > 0) {
    return Math.floor(count);
  }

  return Number(player?.deliveryQuestCompletedAt ?? 0) > 0 ? 1 : 0;
}

export function getMissionProgressSnapshot(player = null) {
  const gymPumpCompletedAt = Number(player?.gymPumpCompletedAt ?? 0);
  const stockBoughtAt = Number(player?.stockBoughtAt ?? 0);
  const blackjackHandPlayedAt = Number(player?.blackjackHandPlayedAt ?? 0);
  return {
    deliveryCompletionCount: getDeliveryCompletionCount(player),
    deliveryActive: isDeliveryQuestActive(player),
    gymPumpCompletedAt: Number.isFinite(gymPumpCompletedAt) ? Math.max(0, gymPumpCompletedAt) : 0,
    stockBoughtAt: Number.isFinite(stockBoughtAt) ? Math.max(0, stockBoughtAt) : 0,
    blackjackHandPlayedAt: Number.isFinite(blackjackHandPlayedAt) ? Math.max(0, blackjackHandPlayedAt) : 0
  };
}

export function isMissionCompleteForSequence(missionId = '', player = null) {
  const id = normalizeMissionId(missionId);
  if (!id || !player) {
    return false;
  }

  const progress = getMissionProgressSnapshot(player);

  if (id === MISSION_IDS.makeMoney) {
    return progress.deliveryActive || progress.deliveryCompletionCount > 0;
  }

  if (id === MISSION_IDS.delivery) {
    return progress.deliveryCompletionCount > 0;
  }

  if (id === MISSION_IDS.gymPump) {
    return progress.gymPumpCompletedAt > 0;
  }

  if (id === MISSION_IDS.stockBuy) {
    return progress.stockBoughtAt > 0;
  }

  if (id === MISSION_IDS.blackjackHand) {
    return progress.blackjackHandPlayedAt > 0;
  }

  return false;
}

export function getMissionSequenceGate(missionId = '', player = null, sequence = null) {
  const id = normalizeMissionId(missionId);
  if (!id || !player) {
    return null;
  }

  const normalizedSequence = normalizeMissionSequenceConfig(sequence);
  const entryIndex = normalizedSequence.findIndex((entry) => entry.missionId === id);
  const entry = normalizedSequence[entryIndex] ?? null;
  if (!entry?.makeAvailableAfterMission || entry.availableAfterMissionNumber <= 0) {
    return null;
  }

  const requiredIndex = entry.availableAfterMissionNumber - 1;
  const requiredEntry = normalizedSequence[requiredIndex] ?? null;
  if (!requiredEntry) {
    return null;
  }

  return {
    missionNumber: entryIndex + 1,
    requiredMissionNumber: entry.availableAfterMissionNumber,
    requiredMissionId: requiredEntry.missionId,
    satisfied: isMissionCompleteForSequence(requiredEntry.missionId, player)
  };
}

function isMissionSequenceGateSatisfied(missionId = '', player = null, sequence = null) {
  const gate = getMissionSequenceGate(missionId, player, sequence);
  return !gate || gate.satisfied === true;
}

export function getMissionStatus(missionId = '', player = null, sequence = null) {
  const id = normalizeMissionId(missionId);
  if (!id || !player) {
    return MISSION_STATUS.locked;
  }

  if (!isMissionSequenceGateSatisfied(id, player, sequence)) {
    return MISSION_STATUS.locked;
  }

  const progress = getMissionProgressSnapshot(player);
  if (id === MISSION_IDS.makeMoney) {
    return MISSION_STATUS.available;
  }

  if (id === MISSION_IDS.delivery) {
    if (progress.deliveryActive) {
      return MISSION_STATUS.inProgress;
    }
    return progress.deliveryCompletionCount > 0 ? MISSION_STATUS.completed : MISSION_STATUS.locked;
  }

  if (id === MISSION_IDS.gymPump) {
    return progress.gymPumpCompletedAt > 0 ? MISSION_STATUS.completed : MISSION_STATUS.available;
  }

  if (id === MISSION_IDS.stockBuy) {
    return progress.stockBoughtAt > 0 ? MISSION_STATUS.completed : MISSION_STATUS.available;
  }

  if (id === MISSION_IDS.blackjackHand) {
    return progress.blackjackHandPlayedAt > 0 ? MISSION_STATUS.completed : MISSION_STATUS.available;
  }

  return MISSION_STATUS.locked;
}

export function isMissionSelectable(missionId = '', player = null, sequence = null) {
  const definition = getMissionDefinition(missionId);
  if (!definition || !player) {
    return false;
  }

  if (isDeliveryQuestActive(player) && definition.id !== MISSION_IDS.delivery) {
    return false;
  }

  const status = getMissionStatus(definition.id, player, sequence);
  return status === MISSION_STATUS.available || status === MISSION_STATUS.inProgress;
}

export function getMissionRequirement(missionId = '', player = null, sequence = null) {
  const definition = getMissionDefinition(missionId);
  if (!definition) {
    return '';
  }

  const gate = getMissionSequenceGate(definition.id, player, sequence);
  if (gate && !gate.satisfied) {
    return `Complete mission ${gate.requiredMissionNumber} first.`;
  }

  const progress = getMissionProgressSnapshot(player);
  if (definition.id === MISSION_IDS.delivery && !progress.deliveryActive && progress.deliveryCompletionCount <= 0) {
    return 'Accept work from the Shady Figure.';
  }

  return definition.requirement ?? '';
}

export function resolveSelectedMissionId(player = null, requestedMissionId = player?.selectedMissionId ?? '', sequence = null) {
  if (!player) {
    return '';
  }

  if (isDeliveryQuestActive(player) && isMissionSelectable(MISSION_IDS.delivery, player, sequence)) {
    return MISSION_IDS.delivery;
  }

  const requestedId = normalizeMissionId(requestedMissionId);
  if (requestedId && isMissionSelectable(requestedId, player, sequence)) {
    return requestedId;
  }

  const selectableFallbacks = normalizeMissionSequenceConfig(sequence)
    .map((entry) => entry.missionId)
    .filter((missionId) => isMissionSelectable(missionId, player, sequence));
  return selectableFallbacks.find((missionId) => {
    const definition = getMissionDefinition(missionId);
    return definition?.repeatable !== true || !isMissionCompleteForSequence(missionId, player);
  }) ?? selectableFallbacks[0] ?? '';
}

export function getMissionSnapshots(player = null, selectedMissionId = player?.selectedMissionId ?? '', sequence = null) {
  const normalizedSequence = normalizeMissionSequenceConfig(sequence);
  const resolvedSelectedMissionId = resolveSelectedMissionId(player, selectedMissionId, normalizedSequence);
  return normalizedSequence.map((entry, index) => {
    const definition = getMissionDefinition(entry.missionId);
    const status = getMissionStatus(entry.missionId, player, normalizedSequence);
    const selectable = isMissionSelectable(entry.missionId, player, normalizedSequence);
    return {
      id: definition.id,
      missionNumber: index + 1,
      title: definition.title,
      label: definition.label,
      icon: definition.icon,
      description: definition.description,
      requirement: status === MISSION_STATUS.locked ? getMissionRequirement(definition.id, player, normalizedSequence) : '',
      makeAvailableAfterMission: entry.makeAvailableAfterMission,
      availableAfterMissionNumber: entry.availableAfterMissionNumber,
      status,
      selected: definition.id === resolvedSelectedMissionId,
      selectable,
      completed: status === MISSION_STATUS.completed,
      locked: status === MISSION_STATUS.locked
    };
  });
}
