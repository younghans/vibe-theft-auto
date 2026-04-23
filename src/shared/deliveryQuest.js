export const DELIVERY_QUEST_ID = 'shady_delivery';
export const DELIVERY_QUEST_REWARD_AMOUNT = 50;
export const DELIVERY_QUEST_RECENT_TARGET_LIMIT = 2;

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

function normalizeDeliveryQuestRecentTargetId(value = '') {
  return String(value ?? '').trim();
}

export function parseDeliveryQuestRecentTargetIds(value = '') {
  const rawIds = Array.isArray(value)
    ? value
    : String(value ?? '').split('|');
  const ids = [];
  const seen = new Set();

  for (const rawId of rawIds) {
    const id = normalizeDeliveryQuestRecentTargetId(rawId);
    if (!id || seen.has(id)) {
      continue;
    }

    ids.push(id);
    seen.add(id);
    if (ids.length >= DELIVERY_QUEST_RECENT_TARGET_LIMIT) {
      break;
    }
  }

  return ids;
}

export function serializeDeliveryQuestRecentTargetIds(value = []) {
  return parseDeliveryQuestRecentTargetIds(value).join('|');
}

export function addDeliveryQuestRecentTargetId(value = '', npcId = '') {
  const id = normalizeDeliveryQuestRecentTargetId(npcId);
  const recentIds = parseDeliveryQuestRecentTargetIds(value)
    .filter((recentId) => recentId !== id);

  return serializeDeliveryQuestRecentTargetIds(id ? [id, ...recentIds] : recentIds);
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

export function getDeliveryQuestTargetCandidate(npcs = null, giverNpcId = '', options = {}) {
  const recentTargetValue = (
    options
    && typeof options === 'object'
    && !Array.isArray(options)
  )
    ? (options.recentTargetNpcIds ?? options.recentTargetIds ?? '')
    : options;
  const recentTargetIds = new Set(parseDeliveryQuestRecentTargetIds(recentTargetValue));
  const entries = getNpcEntries(npcs)
    .map(([id, npc]) => ({ id: String(id), npc }))
    .filter(({ id, npc }) => (
      id !== giverNpcId
      && isNpcAvailableForDelivery(npc)
    ));

  if (!entries.length) {
    return null;
  }

  const candidates = entries.filter(({ id }) => !recentTargetIds.has(id));
  const preferredEntries = candidates.length ? candidates : entries;
  return preferredEntries[Math.floor(Math.random() * preferredEntries.length)] ?? preferredEntries[0];
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
