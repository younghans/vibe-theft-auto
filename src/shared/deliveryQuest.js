export const DELIVERY_QUEST_ID = 'shady_delivery';
export const DELIVERY_QUEST_REWARD_AMOUNT = 50;
export const DELIVERY_QUEST_RECENT_TARGET_LIMIT = 2;

export const DELIVERY_QUEST_STATUS = Object.freeze({
  inactive: 'inactive',
  active: 'active',
  completed: 'completed'
});

const DELIVERY_QUEST_STATUS_VALUES = new Set();
for (const key in DELIVERY_QUEST_STATUS) {
  if (Object.hasOwn(DELIVERY_QUEST_STATUS, key)) {
    DELIVERY_QUEST_STATUS_VALUES.add(DELIVERY_QUEST_STATUS[key]);
  }
}

export function normalizeDeliveryQuestStatus(value = '') {
  return DELIVERY_QUEST_STATUS_VALUES.has(value)
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

  if (typeof npcs.keys === 'function' && typeof npcs.get === 'function') {
    const entries = [];
    for (const id of npcs.keys()) {
      entries.push([id, npcs.get(id)]);
    }
    return entries;
  }

  const forEachEntry = npcs.forEach;
  if (typeof forEachEntry === 'function') {
    const entries = [];
    forEachEntry.call(npcs, (npc, id) => {
      entries.push([id, npc]);
    });
    return entries;
  }

  const entries = [];
  for (const id in npcs) {
    if (Object.hasOwn(npcs, id)) {
      entries.push([id, npcs[id]]);
    }
  }
  return entries;
}

function forEachNpcEntry(npcs = null, callback) {
  if (!npcs) {
    return;
  }

  if (typeof npcs.keys === 'function' && typeof npcs.get === 'function') {
    for (const id of npcs.keys()) {
      callback(String(id), npcs.get(id));
    }
    return;
  }

  const forEachEntry = npcs.forEach;
  if (typeof forEachEntry === 'function') {
    forEachEntry.call(npcs, (npc, id) => {
      callback(String(id), npc);
    });
    return;
  }

  for (const id in npcs) {
    if (Object.hasOwn(npcs, id)) {
      callback(String(id), npcs[id]);
    }
  }
}

function normalizeDeliveryQuestRecentTargetId(value = '') {
  return String(value ?? '').trim();
}

export function parseDeliveryQuestRecentTargetIds(value = '') {
  const rawIds = Array.isArray(value)
    ? value
    : String(value ?? '').split('|');
  const ids = [];

  for (const rawId of rawIds) {
    const id = normalizeDeliveryQuestRecentTargetId(rawId);
    let alreadyAdded = false;
    for (const existingId of ids) {
      if (existingId === id) {
        alreadyAdded = true;
        break;
      }
    }
    if (!id || alreadyAdded) {
      continue;
    }

    ids.push(id);
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
  const parsedIds = parseDeliveryQuestRecentTargetIds(value);
  const recentIds = [];
  if (id) {
    recentIds.push(id);
  }

  for (const recentId of parsedIds) {
    if (recentId !== id && recentIds.length < DELIVERY_QUEST_RECENT_TARGET_LIMIT) {
      recentIds.push(recentId);
    }
  }

  return recentIds.join('|');
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
  let candidate = null;
  forEachNpcEntry(npcs, (id, npc) => {
    if (!candidate && isNpcAvailableForDelivery(npc) && isDeliveryQuestGiver(id, npc)) {
      candidate = { id, npc };
    }
  });
  return candidate;
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
  const entries = [];
  const candidates = [];
  forEachNpcEntry(npcs, (id, npc) => {
    if (id === giverNpcId || !isNpcAvailableForDelivery(npc)) {
      return;
    }

    const entry = { id, npc };
    entries.push(entry);
    if (!recentTargetIds.has(id)) {
      candidates.push(entry);
    }
  });

  const preferredEntries = candidates.length ? candidates : entries;
  if (!preferredEntries.length) {
    return null;
  }

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
