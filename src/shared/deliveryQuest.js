export const DELIVERY_QUEST_ID = 'shady_delivery';

export const DELIVERY_QUEST_STATUS = Object.freeze({
  inactive: 'inactive',
  active: 'active',
  completed: 'completed'
});

export function normalizeDeliveryQuestStatus(value = '') {
  return Object.values(DELIVERY_QUEST_STATUS).includes(value)
    ? value
    : DELIVERY_QUEST_STATUS.inactive;
}

export function normalizeDeliveryQuestEnabled(value = false) {
  return value === true;
}

export function getNpcEntries(npcs = null) {
  if (!npcs) {
    return [];
  }

  if (typeof npcs.entries === 'function') {
    return [...npcs.entries()];
  }

  if (typeof npcs.forEach === 'function') {
    const entries = [];
    npcs.forEach((npc, id) => {
      entries.push([id, npc]);
    });
    return entries;
  }

  return Object.entries(npcs);
}

export function isDeliveryQuestGiver(_npcId = '', npc = null) {
  return Boolean(
    npc?.deliveryQuestEnabled === true
    || npc?.quests?.delivery?.enabled === true
  );
}

export function isNpcAvailableForDelivery(npc = null) {
  return Boolean(
    npc
    && npc.active !== false
    && npc.alive !== false
    && npc.mode !== 'hidden'
    && npc.mode !== 'dead'
  );
}

export function getDeliveryQuestGiverCandidate(npcs = null) {
  return getNpcEntries(npcs)
    .map(([id, npc]) => ({ id: String(id), npc }))
    .find(({ id, npc }) => isNpcAvailableForDelivery(npc) && isDeliveryQuestGiver(id, npc))
    ?? null;
}

export function getDeliveryQuestTargetCandidate(npcs = null, giverNpcId = '') {
  const entries = getNpcEntries(npcs)
    .map(([id, npc]) => ({ id: String(id), npc }))
    .filter(({ id, npc }) => (
      id !== giverNpcId
      && isNpcAvailableForDelivery(npc)
    ));

  if (!entries.length) {
    return null;
  }

  return entries[Math.floor(Math.random() * entries.length)] ?? entries[0];
}

export function getDeliveryQuestTargetName(targetNpc = null) {
  return String(targetNpc?.name ?? 'the contact').trim() || 'the contact';
}

export function isDeliveryQuestActive(player = null) {
  return Boolean(
    player
    && player.deliveryQuestId === DELIVERY_QUEST_ID
    && normalizeDeliveryQuestStatus(player.deliveryQuestStatus) === DELIVERY_QUEST_STATUS.active
    && player.deliveryQuestTargetNpcId
  );
}

export function isDeliveryQuestCompleted(player = null) {
  return Boolean(
    player
    && player.deliveryQuestId === DELIVERY_QUEST_ID
    && normalizeDeliveryQuestStatus(player.deliveryQuestStatus) === DELIVERY_QUEST_STATUS.completed
  );
}
