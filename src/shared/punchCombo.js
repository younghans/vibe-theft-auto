import {
  PUNCH_COMBO_WINDOW_MS,
  PUNCH_DAMAGE,
  PUNCH_HIT_DELAY_MS,
  PUNCH_HOOK_DAMAGE,
  PUNCH_HOOK_HIT_DELAY_MS,
  PUNCH_HOOK_IMPACT_STRENGTH,
  PUNCH_JAB_IMPACT_STRENGTH
} from './combatConstants.js';

export const PUNCH_COMBO_JAB_STEP = 1;
export const PUNCH_COMBO_HOOK_STEP = 2;

export function normalizePunchComboStep(value) {
  const numeric = Math.floor(Number(value));
  return numeric === PUNCH_COMBO_HOOK_STEP ? PUNCH_COMBO_HOOK_STEP : PUNCH_COMBO_JAB_STEP;
}

export function resolvePunchComboStep({
  requestedStep = PUNCH_COMBO_JAB_STEP,
  lastStep = 0,
  elapsedMs = Infinity
} = {}) {
  const normalizedRequest = normalizePunchComboStep(requestedStep);
  const elapsed = Number(elapsedMs);
  const canChainHook = normalizedRequest === PUNCH_COMBO_HOOK_STEP
    && Math.floor(Number(lastStep)) === PUNCH_COMBO_JAB_STEP
    && Number.isFinite(elapsed)
    && elapsed >= 0
    && elapsed <= PUNCH_COMBO_WINDOW_MS;

  return canChainHook ? PUNCH_COMBO_HOOK_STEP : PUNCH_COMBO_JAB_STEP;
}

export function getPunchComboDamage(comboStep) {
  return isPunchHookComboStep(comboStep)
    ? PUNCH_HOOK_DAMAGE
    : PUNCH_DAMAGE;
}

export function getPunchComboHitDelayMs(comboStep) {
  return isPunchHookComboStep(comboStep)
    ? PUNCH_HOOK_HIT_DELAY_MS
    : PUNCH_HIT_DELAY_MS;
}

export function getPunchComboImpactStrength(comboStep) {
  return isPunchHookComboStep(comboStep)
    ? PUNCH_HOOK_IMPACT_STRENGTH
    : PUNCH_JAB_IMPACT_STRENGTH;
}

export function isPunchHookComboStep(comboStep) {
  return normalizePunchComboStep(comboStep) === PUNCH_COMBO_HOOK_STEP;
}
