import { isDeliveryQuestActive } from './deliveryQuest.js';

export const MISSION_IDS = Object.freeze({
  delivery: 'delivery',
  schoolTeacherTasks: 'custom-mission-go-to-school-complete-3-tasks-for-th-fqyqp8',
  janitorTasks: 'custom-mission-get-a-job-complete-3-janitor-tasks-106oriq',
  gymPump: 'gym-pump',
  stockBuy: 'stock-buy',
  blackjackHand: 'blackjack-hand',
  transportationUpgrade: 'custom-mission-transportation-upgrade-buy-a-skatebo-1mk4jok',
  officeManagerPromotion: 'custom-mission-your-first-promotion-get-a-job-as-th-kehj25',
  makeMoney: 'make-money'
});

export const MISSION_STATUS = Object.freeze({
  available: 'available',
  completed: 'completed',
  inProgress: 'inProgress',
  locked: 'locked'
});

export const SCHOOL_TEACHER_TASKS_REQUIRED = 3;
export const JANITOR_TASKS_REQUIRED = 3;

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
    id: MISSION_IDS.schoolTeacherTasks,
    title: 'Go to school: Complete 3 tasks for the teacher',
    label: 'Go to School',
    icon: 'school',
    description: 'Find a teacher and complete three school challenges.',
    requirement: 'Complete the delivery first.'
  },
  {
    id: MISSION_IDS.janitorTasks,
    title: 'Get a job: Complete 3 janitor tasks',
    label: 'Janitor Shift',
    icon: 'janitor',
    description: 'Work three janitor tasks from the office job board.',
    requirement: 'Finish school first.'
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
  },
  {
    id: MISSION_IDS.transportationUpgrade,
    title: 'Transportation upgrade: Buy a skateboard',
    label: 'Transportation Upgrade',
    icon: 'skateboard',
    description: 'Buy a skateboard from the pawn shop.',
    requirement: 'Complete the janitor work first.'
  },
  {
    id: MISSION_IDS.officeManagerPromotion,
    title: 'Your first promotion: Get a job as the office manager',
    label: 'First Promotion',
    icon: 'office',
    description: 'Complete an office manager shift after proving yourself.',
    requirement: 'Finish the earlier city missions first.'
  }
].map(Object.freeze));

const MISSION_BY_ID = new Map(MISSION_CATALOG.map((mission) => [mission.id, mission]));
const DEFAULT_MISSION_SEQUENCE = Object.freeze([
  Object.freeze({
    missionId: MISSION_IDS.makeMoney,
    makeAvailableAfterMission: false,
    availableAfterMissionNumber: 0
  }),
  Object.freeze({
    missionId: MISSION_IDS.delivery,
    makeAvailableAfterMission: true,
    availableAfterMissionNumber: 1
  }),
  Object.freeze({
    missionId: MISSION_IDS.schoolTeacherTasks,
    custom: true,
    title: 'Go to school : Complete 3 tasks for the teacher',
    label: 'Go to school : Complete 3 tasks for the teacher',
    description: 'Go to school : Complete 3 tasks for the teacher',
    prompt: 'Go to school : Complete 3 tasks for the teacher',
    icon: 'custom',
    makeAvailableAfterMission: true,
    availableAfterMissionNumber: 2
  }),
  Object.freeze({
    missionId: MISSION_IDS.janitorTasks,
    custom: true,
    title: 'Get a job : Complete 3 janitor tasks',
    label: 'Get a job : Complete 3 janitor tasks',
    description: 'Get a job : Complete 3 janitor tasks',
    prompt: 'Get a job : Complete 3 janitor tasks',
    icon: 'custom',
    makeAvailableAfterMission: true,
    availableAfterMissionNumber: 3
  }),
  Object.freeze({
    missionId: MISSION_IDS.gymPump,
    makeAvailableAfterMission: true,
    availableAfterMissionNumber: 4
  }),
  Object.freeze({
    missionId: MISSION_IDS.stockBuy,
    makeAvailableAfterMission: true,
    availableAfterMissionNumber: 4
  }),
  Object.freeze({
    missionId: MISSION_IDS.blackjackHand,
    makeAvailableAfterMission: true,
    availableAfterMissionNumber: 4
  }),
  Object.freeze({
    missionId: MISSION_IDS.transportationUpgrade,
    custom: true,
    title: 'Transportation upgrade : Buy a skateboard,',
    label: 'Transportation upgrade : Buy a skateboard,',
    description: 'Transportation upgrade : Buy a skateboard,',
    prompt: 'Transportation upgrade : Buy a skateboard,',
    icon: 'custom',
    makeAvailableAfterMission: true,
    availableAfterMissionNumber: 4
  }),
  Object.freeze({
    missionId: MISSION_IDS.officeManagerPromotion,
    custom: true,
    title: 'Your first promotion : Get a job as the office manager.',
    label: 'Your first promotion : Get a job as the office...',
    description: 'Your first promotion : Get a job as the office manager.',
    prompt: 'Your first promotion : Get a job as the office manager.',
    icon: 'custom',
    makeAvailableAfterMission: true,
    availableAfterMissionNumber: 7
  })
]);
const CUSTOM_MISSION_ID_PREFIX = 'custom-mission-';
const CUSTOM_MISSION_ID_MAX_LENGTH = 96;
const CUSTOM_MISSION_LABEL_MAX_LENGTH = 54;
const CUSTOM_MISSION_PROMPT_MAX_LENGTH = 220;
const CUSTOM_MISSION_DESCRIPTION_MAX_LENGTH = 180;

function normalizeMissionText(value = '', maxLength = CUSTOM_MISSION_PROMPT_MAX_LENGTH) {
  return String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
}

function truncateMissionText(value = '', maxLength = CUSTOM_MISSION_LABEL_MAX_LENGTH) {
  const normalized = normalizeMissionText(value, maxLength + 1);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const clipped = normalized.slice(0, Math.max(0, maxLength - 3)).trim();
  const wordBoundary = clipped.lastIndexOf(' ');
  const safeClip = wordBoundary > 20 ? clipped.slice(0, wordBoundary).trim() : clipped;
  return `${safeClip}...`;
}

function slugifyMissionPrompt(value = '') {
  return normalizeMissionText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 36)
    || 'mission';
}

function hashMissionPrompt(value = '') {
  let hash = 2166136261;
  const text = normalizeMissionText(value, CUSTOM_MISSION_PROMPT_MAX_LENGTH);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 7);
}

function normalizeCustomMissionId(missionId = '') {
  const normalized = String(missionId ?? '').trim();
  if (
    normalized.startsWith(CUSTOM_MISSION_ID_PREFIX)
    && normalized.length <= CUSTOM_MISSION_ID_MAX_LENGTH
    && /^[a-z0-9-]+$/u.test(normalized)
  ) {
    return normalized;
  }

  return '';
}

function createCustomMissionId(prompt = '', sequence = null) {
  const base = `${CUSTOM_MISSION_ID_PREFIX}${slugifyMissionPrompt(prompt)}-${hashMissionPrompt(prompt)}`;
  const existingIds = new Set(normalizeMissionSequenceConfig(sequence).map((entry) => entry.missionId));
  if (!existingIds.has(base)) {
    return base;
  }

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36).slice(-5)}`;
}

function getCustomMissionPrompt(entry = {}) {
  return normalizeMissionText(
    entry.prompt
    ?? entry.description
    ?? entry.title
    ?? entry.label
    ?? '',
    CUSTOM_MISSION_PROMPT_MAX_LENGTH
  );
}

function getCustomMissionDefinition(entry = {}) {
  const missionId = normalizeCustomMissionId(entry.missionId ?? entry.id);
  if (!missionId) {
    return null;
  }

  const prompt = getCustomMissionPrompt(entry);
  const label = normalizeMissionText(entry.label, CUSTOM_MISSION_LABEL_MAX_LENGTH)
    || truncateMissionText(prompt || missionId.replace(CUSTOM_MISSION_ID_PREFIX, '').replace(/-/gu, ' '));
  const title = normalizeMissionText(entry.title, CUSTOM_MISSION_PROMPT_MAX_LENGTH) || prompt || label;
  const description = normalizeMissionText(entry.description, CUSTOM_MISSION_DESCRIPTION_MAX_LENGTH)
    || (prompt && prompt !== title ? prompt : 'Admin-authored mission.');

  return Object.freeze({
    id: missionId,
    title,
    label,
    icon: 'custom',
    description,
    requirement: '',
    repeatable: false,
    custom: true,
    prompt: prompt || title || label
  });
}

function cloneMissionSequenceEntry(entry) {
  const base = {
    missionId: entry.missionId,
    makeAvailableAfterMission: entry.makeAvailableAfterMission === true,
    availableAfterMissionNumber: Math.max(0, Math.floor(Number(entry.availableAfterMissionNumber) || 0))
  };

  const customDefinition = getCustomMissionDefinition(entry);
  if (!customDefinition) {
    return base;
  }

  return {
    ...base,
    custom: true,
    title: customDefinition.title,
    label: customDefinition.label,
    description: customDefinition.description,
    prompt: customDefinition.prompt,
    icon: customDefinition.icon
  };
}

function getRawMissionSequenceEntryMissionId(entry = {}) {
  const rawMissionId = String(entry?.missionId ?? entry?.id ?? '').trim();
  const catalogMissionId = MISSION_BY_ID.has(rawMissionId) ? rawMissionId : '';
  if (catalogMissionId) {
    return catalogMissionId;
  }

  const customMissionId = normalizeCustomMissionId(rawMissionId);
  if (customMissionId) {
    return customMissionId;
  }

  const prompt = getCustomMissionPrompt(entry);
  return prompt ? createCustomMissionId(prompt) : '';
}

function getRawMissionSequenceEntryGateNumber(entry = {}, fallback = 0) {
  const raw = entry?.availableAfterMissionNumber ?? entry?.unlockAfterMissionNumber ?? entry?.afterMissionNumber;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

export function createDefaultMissionSequence() {
  return DEFAULT_MISSION_SEQUENCE.map((entry) => Object.freeze({ ...entry }));
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

    const baseEntry = {
      missionId,
      makeAvailableAfterMission,
      availableAfterMissionNumber
    };
    const customDefinition = getCustomMissionDefinition({
      ...rawEntry,
      missionId
    });

    if (!customDefinition) {
      return Object.freeze(baseEntry);
    }

    return Object.freeze({
      ...baseEntry,
      custom: true,
      title: customDefinition.title,
      label: customDefinition.label,
      description: customDefinition.description,
      prompt: customDefinition.prompt,
      icon: customDefinition.icon
    });
  });
}

export function cloneMissionSequence(sequence = null) {
  return normalizeMissionSequenceConfig(sequence).map(cloneMissionSequenceEntry);
}

export function appendMissionSequencePromptEntry(sequence = null, prompt = '') {
  const missionPrompt = normalizeMissionText(prompt, CUSTOM_MISSION_PROMPT_MAX_LENGTH);
  if (!missionPrompt) {
    return normalizeMissionSequenceConfig(sequence);
  }

  const entries = cloneMissionSequence(sequence);
  entries.push({
    missionId: createCustomMissionId(missionPrompt, entries),
    custom: true,
    title: missionPrompt,
    label: truncateMissionText(missionPrompt, CUSTOM_MISSION_LABEL_MAX_LENGTH),
    description: missionPrompt,
    prompt: missionPrompt,
    icon: 'custom',
    makeAvailableAfterMission: entries.length > 0,
    availableAfterMissionNumber: entries.length
  });

  return normalizeMissionSequenceConfig(entries);
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
    const definition = getMissionDefinition(entry.missionId, normalizedSequence);
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

function getMissionDefinitionFromSequence(missionId = '', sequence = null) {
  const normalizedMissionId = normalizeMissionId(missionId);
  if (!normalizedMissionId || !normalizeCustomMissionId(normalizedMissionId)) {
    return null;
  }

  const entry = normalizeMissionSequenceConfig(sequence)
    .find((sequenceEntry) => sequenceEntry.missionId === normalizedMissionId);
  return entry ? getCustomMissionDefinition(entry) : null;
}

export function getMissionDefinition(missionId = '', sequence = null) {
  const normalized = String(missionId ?? '').trim();
  return MISSION_BY_ID.get(normalized)
    ?? getMissionDefinitionFromSequence(normalized, sequence)
    ?? getCustomMissionDefinition({ missionId: normalized });
}

export function isCustomMissionId(missionId = '') {
  return Boolean(normalizeCustomMissionId(missionId));
}

export function normalizeMissionId(missionId = '') {
  const normalized = String(missionId ?? '').trim();
  return MISSION_BY_ID.has(normalized) || normalizeCustomMissionId(normalized) ? normalized : '';
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
  const schoolTasksCompletedCount = Number(player?.schoolTasksCompletedCount ?? 0);
  const janitorTasksCompletedCount = Number(player?.janitorTasksCompletedCount ?? 0);
  const officeManagerCompletedAt = Number(player?.officeManagerCompletedAt ?? 0);
  return {
    deliveryCompletionCount: getDeliveryCompletionCount(player),
    deliveryActive: isDeliveryQuestActive(player),
    gymPumpCompletedAt: Number.isFinite(gymPumpCompletedAt) ? Math.max(0, gymPumpCompletedAt) : 0,
    stockBoughtAt: Number.isFinite(stockBoughtAt) ? Math.max(0, stockBoughtAt) : 0,
    blackjackHandPlayedAt: Number.isFinite(blackjackHandPlayedAt) ? Math.max(0, blackjackHandPlayedAt) : 0,
    schoolTasksCompletedCount: Number.isFinite(schoolTasksCompletedCount)
      ? Math.max(0, Math.floor(schoolTasksCompletedCount))
      : 0,
    janitorTasksCompletedCount: Number.isFinite(janitorTasksCompletedCount)
      ? Math.max(0, Math.floor(janitorTasksCompletedCount))
      : 0,
    skateboardOwned: player?.skateboardOwned === true,
    officeManagerCompletedAt: Number.isFinite(officeManagerCompletedAt) ? Math.max(0, officeManagerCompletedAt) : 0
  };
}

export function isMissionCompleteForSequence(missionId = '', player = null, sequence = null) {
  const id = normalizeMissionId(missionId);
  if (!id || !player) {
    return false;
  }

  const progress = getMissionProgressSnapshot(player);

  if (id === MISSION_IDS.schoolTeacherTasks) {
    return progress.schoolTasksCompletedCount >= SCHOOL_TEACHER_TASKS_REQUIRED;
  }

  if (id === MISSION_IDS.janitorTasks) {
    return progress.janitorTasksCompletedCount >= JANITOR_TASKS_REQUIRED;
  }

  if (id === MISSION_IDS.transportationUpgrade) {
    return progress.skateboardOwned === true;
  }

  if (id === MISSION_IDS.officeManagerPromotion) {
    return progress.officeManagerCompletedAt > 0;
  }

  if (isCustomMissionId(id)) {
    const normalizedSequence = normalizeMissionSequenceConfig(sequence);
    const entry = normalizedSequence.find((sequenceEntry) => sequenceEntry.missionId === id);
    if (!entry) {
      return false;
    }

    if (!entry.makeAvailableAfterMission || entry.availableAfterMissionNumber <= 0) {
      return true;
    }

    const requiredEntry = normalizedSequence[entry.availableAfterMissionNumber - 1] ?? null;
    return requiredEntry
      ? isMissionCompleteForSequence(requiredEntry.missionId, player, normalizedSequence)
      : true;
  }

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
    satisfied: isMissionCompleteForSequence(requiredEntry.missionId, player, normalizedSequence)
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

  if (isCustomMissionId(id) && !normalizeMissionSequenceConfig(sequence).some((entry) => entry.missionId === id)) {
    return MISSION_STATUS.locked;
  }

  if (!isMissionSequenceGateSatisfied(id, player, sequence)) {
    return MISSION_STATUS.locked;
  }

  const progress = getMissionProgressSnapshot(player);
  if (id === MISSION_IDS.makeMoney) {
    return MISSION_STATUS.available;
  }

  if (id === MISSION_IDS.schoolTeacherTasks) {
    return progress.schoolTasksCompletedCount >= SCHOOL_TEACHER_TASKS_REQUIRED
      ? MISSION_STATUS.completed
      : MISSION_STATUS.available;
  }

  if (id === MISSION_IDS.janitorTasks) {
    return progress.janitorTasksCompletedCount >= JANITOR_TASKS_REQUIRED
      ? MISSION_STATUS.completed
      : MISSION_STATUS.available;
  }

  if (id === MISSION_IDS.transportationUpgrade) {
    return progress.skateboardOwned ? MISSION_STATUS.completed : MISSION_STATUS.available;
  }

  if (id === MISSION_IDS.officeManagerPromotion) {
    return progress.officeManagerCompletedAt > 0 ? MISSION_STATUS.completed : MISSION_STATUS.available;
  }

  if (isCustomMissionId(id)) {
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
  const definition = getMissionDefinition(missionId, sequence);
  if (!definition || !player) {
    return false;
  }

  if (definition.custom && !normalizeMissionSequenceConfig(sequence).some((entry) => entry.missionId === definition.id)) {
    return false;
  }

  if (isDeliveryQuestActive(player) && definition.id !== MISSION_IDS.delivery) {
    return false;
  }

  const status = getMissionStatus(definition.id, player, sequence);
  return status === MISSION_STATUS.available || status === MISSION_STATUS.inProgress;
}

export function getMissionRequirement(missionId = '', player = null, sequence = null) {
  const definition = getMissionDefinition(missionId, sequence);
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

  if (definition.id === MISSION_IDS.schoolTeacherTasks) {
    const remaining = Math.max(0, SCHOOL_TEACHER_TASKS_REQUIRED - progress.schoolTasksCompletedCount);
    return remaining > 0 ? `Complete ${remaining} more teacher task${remaining === 1 ? '' : 's'}.` : '';
  }

  if (definition.id === MISSION_IDS.janitorTasks) {
    const remaining = Math.max(0, JANITOR_TASKS_REQUIRED - progress.janitorTasksCompletedCount);
    return remaining > 0 ? `Complete ${remaining} more janitor task${remaining === 1 ? '' : 's'}.` : '';
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
    const definition = getMissionDefinition(missionId, sequence);
    return definition?.repeatable !== true || !isMissionCompleteForSequence(missionId, player, sequence);
  }) ?? selectableFallbacks[0] ?? '';
}

export function getMissionSnapshots(player = null, selectedMissionId = player?.selectedMissionId ?? '', sequence = null) {
  const normalizedSequence = normalizeMissionSequenceConfig(sequence);
  const resolvedSelectedMissionId = resolveSelectedMissionId(player, selectedMissionId, normalizedSequence);
  return normalizedSequence.map((entry, index) => {
    const definition = getMissionDefinition(entry.missionId, normalizedSequence);
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
