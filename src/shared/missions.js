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
    requirement: 'Complete: Go get a pump in the gym.'
  },
  {
    id: MISSION_IDS.blackjackHand,
    title: '\u{1F0CF} Play a hand of blackjack at the casino.',
    label: 'Blackjack Hand',
    icon: 'playing-card',
    description: 'Sit with the dealer and play one hand.',
    requirement: 'Complete: Buy a stock at the bank.'
  }
].map(Object.freeze));

const MISSION_BY_ID = new Map(MISSION_CATALOG.map((mission) => [mission.id, mission]));

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

export function getMissionStatus(missionId = '', player = null) {
  const id = normalizeMissionId(missionId);
  if (!id || !player) {
    return MISSION_STATUS.locked;
  }

  const progress = getMissionProgressSnapshot(player);
  const completedFirstDelivery = progress.deliveryCompletionCount > 0;
  const gymPumpCompleted = progress.gymPumpCompletedAt > 0;
  const stockBought = progress.stockBoughtAt > 0;
  const blackjackHandPlayed = progress.blackjackHandPlayedAt > 0;

  if (id === MISSION_IDS.makeMoney) {
    return MISSION_STATUS.available;
  }

  if (id === MISSION_IDS.delivery) {
    if (progress.deliveryActive) {
      return MISSION_STATUS.inProgress;
    }
    return completedFirstDelivery ? MISSION_STATUS.completed : MISSION_STATUS.locked;
  }

  if (id === MISSION_IDS.gymPump) {
    if (!completedFirstDelivery) {
      return MISSION_STATUS.locked;
    }
    return gymPumpCompleted ? MISSION_STATUS.completed : MISSION_STATUS.available;
  }

  if (id === MISSION_IDS.stockBuy) {
    if (!completedFirstDelivery || !gymPumpCompleted) {
      return MISSION_STATUS.locked;
    }
    return stockBought ? MISSION_STATUS.completed : MISSION_STATUS.available;
  }

  if (id === MISSION_IDS.blackjackHand) {
    if (!completedFirstDelivery || !gymPumpCompleted || !stockBought) {
      return MISSION_STATUS.locked;
    }
    return blackjackHandPlayed ? MISSION_STATUS.completed : MISSION_STATUS.available;
  }

  return MISSION_STATUS.locked;
}

export function isMissionSelectable(missionId = '', player = null) {
  const definition = getMissionDefinition(missionId);
  if (!definition || !player) {
    return false;
  }

  if (isDeliveryQuestActive(player) && definition.id !== MISSION_IDS.delivery) {
    return false;
  }

  const status = getMissionStatus(definition.id, player);
  return status === MISSION_STATUS.available || status === MISSION_STATUS.inProgress;
}

export function getMissionRequirement(missionId = '', player = null) {
  const definition = getMissionDefinition(missionId);
  if (!definition) {
    return '';
  }

  const progress = getMissionProgressSnapshot(player);
  if (definition.id === MISSION_IDS.delivery && !progress.deliveryActive && progress.deliveryCompletionCount <= 0) {
    return 'Accept work from the Shady Figure.';
  }

  return definition.requirement ?? '';
}

export function resolveSelectedMissionId(player = null, requestedMissionId = player?.selectedMissionId ?? '') {
  if (!player) {
    return '';
  }

  if (isDeliveryQuestActive(player) && isMissionSelectable(MISSION_IDS.delivery, player)) {
    return MISSION_IDS.delivery;
  }

  const requestedId = normalizeMissionId(requestedMissionId);
  if (requestedId && isMissionSelectable(requestedId, player)) {
    return requestedId;
  }

  const fallback = MISSION_CATALOG.find((mission) => (
    mission.id !== MISSION_IDS.makeMoney
    && isMissionSelectable(mission.id, player)
  )) ?? MISSION_CATALOG.find((mission) => isMissionSelectable(mission.id, player));
  return fallback?.id ?? '';
}

export function getMissionSnapshots(player = null, selectedMissionId = player?.selectedMissionId ?? '') {
  const resolvedSelectedMissionId = resolveSelectedMissionId(player, selectedMissionId);
  return MISSION_CATALOG.map((definition) => {
    const status = getMissionStatus(definition.id, player);
    const selectable = isMissionSelectable(definition.id, player);
    return {
      id: definition.id,
      title: definition.title,
      label: definition.label,
      icon: definition.icon,
      description: definition.description,
      requirement: status === MISSION_STATUS.locked ? getMissionRequirement(definition.id, player) : '',
      status,
      selected: definition.id === resolvedSelectedMissionId,
      selectable,
      completed: status === MISSION_STATUS.completed,
      locked: status === MISSION_STATUS.locked
    };
  });
}
