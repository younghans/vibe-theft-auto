import {
  PUNCH_COMBO_HOOK_RELEASE_MS,
  PUNCH_COMBO_UPPERCUT_RELEASE_MS,
  PUNCH_COMBO_WINDOW_MS,
  PUNCH_DAMAGE,
  PUNCH_HIT_DELAY_MS,
  PUNCH_HOOK_DAMAGE,
  PUNCH_HOOK_HIT_DELAY_MS,
  PUNCH_HOOK_IMPACT_STRENGTH,
  PUNCH_JAB_IMPACT_STRENGTH,
  PUNCH_UPPERCUT_DAMAGE,
  PUNCH_UPPERCUT_HIT_DELAY_MS,
  PUNCH_UPPERCUT_IMPACT_STRENGTH
} from './combatConstants.js';

export const PUNCH_COMBO_JAB_STEP = 1;
export const PUNCH_COMBO_HOOK_STEP = 2;
export const PUNCH_COMBO_UPPERCUT_STEP = 3;

export function normalizePunchComboStep(value) {
  const numeric = Math.floor(Number(value));
  if (numeric === PUNCH_COMBO_HOOK_STEP) {
    return PUNCH_COMBO_HOOK_STEP;
  }
  if (numeric === PUNCH_COMBO_UPPERCUT_STEP) {
    return PUNCH_COMBO_UPPERCUT_STEP;
  }
  return PUNCH_COMBO_JAB_STEP;
}

export function resolvePunchComboStep({
  requestedStep = PUNCH_COMBO_JAB_STEP,
  lastStep = 0,
  elapsedMs = Infinity
} = {}) {
  const normalizedRequest = normalizePunchComboStep(requestedStep);
  const normalizedLastStep = normalizePunchComboStep(lastStep);
  const elapsed = Number(elapsedMs);
  const canChain = Number.isFinite(elapsed)
    && elapsed >= 0
    && elapsed <= PUNCH_COMBO_WINDOW_MS;

  if (canChain && normalizedRequest === PUNCH_COMBO_HOOK_STEP && normalizedLastStep === PUNCH_COMBO_JAB_STEP) {
    return PUNCH_COMBO_HOOK_STEP;
  }

  if (canChain && normalizedRequest === PUNCH_COMBO_UPPERCUT_STEP && normalizedLastStep === PUNCH_COMBO_HOOK_STEP) {
    return PUNCH_COMBO_UPPERCUT_STEP;
  }

  return PUNCH_COMBO_JAB_STEP;
}

export function getNextPunchComboStep(lastStep = 0, elapsedMs = Infinity) {
  const normalizedLastStep = normalizePunchComboStep(lastStep);
  const elapsed = Number(elapsedMs);
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > PUNCH_COMBO_WINDOW_MS) {
    return PUNCH_COMBO_JAB_STEP;
  }

  if (normalizedLastStep === PUNCH_COMBO_JAB_STEP) {
    return PUNCH_COMBO_HOOK_STEP;
  }
  if (normalizedLastStep === PUNCH_COMBO_HOOK_STEP) {
    return PUNCH_COMBO_UPPERCUT_STEP;
  }
  return PUNCH_COMBO_JAB_STEP;
}

export function getPunchComboDamage(comboStep) {
  if (isPunchUppercutComboStep(comboStep)) {
    return PUNCH_UPPERCUT_DAMAGE;
  }
  return isPunchHookComboStep(comboStep)
    ? PUNCH_HOOK_DAMAGE
    : PUNCH_DAMAGE;
}

export function getPunchComboHitDelayMs(comboStep) {
  if (isPunchUppercutComboStep(comboStep)) {
    return PUNCH_UPPERCUT_HIT_DELAY_MS;
  }
  return isPunchHookComboStep(comboStep)
    ? PUNCH_HOOK_HIT_DELAY_MS
    : PUNCH_HIT_DELAY_MS;
}

export function getPunchComboImpactStrength(comboStep) {
  if (isPunchUppercutComboStep(comboStep)) {
    return PUNCH_UPPERCUT_IMPACT_STRENGTH;
  }
  return isPunchHookComboStep(comboStep)
    ? PUNCH_HOOK_IMPACT_STRENGTH
    : PUNCH_JAB_IMPACT_STRENGTH;
}

export function getPunchComboReleaseDelayMs(comboStep) {
  if (isPunchUppercutComboStep(comboStep)) {
    return PUNCH_COMBO_UPPERCUT_RELEASE_MS;
  }
  if (isPunchHookComboStep(comboStep)) {
    return PUNCH_COMBO_HOOK_RELEASE_MS;
  }
  return 0;
}

export function isPunchHookComboStep(comboStep) {
  return normalizePunchComboStep(comboStep) === PUNCH_COMBO_HOOK_STEP;
}

export function isPunchUppercutComboStep(comboStep) {
  return normalizePunchComboStep(comboStep) === PUNCH_COMBO_UPPERCUT_STEP;
}
