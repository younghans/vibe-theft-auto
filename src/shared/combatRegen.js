import {
  COMBAT_HEALTH_REGEN_DELAY_MS,
  COMBAT_HEALTH_REGEN_INTERVAL_MS
} from './combatConstants.js';

export function tickHealthRegen({
  health = 0,
  maxHealth = 100,
  alive = true,
  deltaMs = 0,
  now = Date.now(),
  lastDamagedAt = 0,
  lastCombatAt = 0,
  carryMs = 0
} = {}) {
  const safeMaxHealth = Math.max(1, Math.floor(Number(maxHealth) || 1));
  const currentHealth = Math.max(0, Math.min(safeMaxHealth, Math.floor(Number(health) || 0)));
  const currentCarryMs = Math.max(0, Math.floor(Number(carryMs) || 0));

  if (!alive || currentHealth >= safeMaxHealth) {
    return {
      health: currentHealth,
      carryMs: 0,
      healed: 0
    };
  }

  const lastRelevantCombatAt = Math.max(
    Math.max(0, Math.floor(Number(lastDamagedAt) || 0)),
    Math.max(0, Math.floor(Number(lastCombatAt) || 0))
  );

  if (lastRelevantCombatAt > 0 && (now - lastRelevantCombatAt) < COMBAT_HEALTH_REGEN_DELAY_MS) {
    return {
      health: currentHealth,
      carryMs: 0,
      healed: 0
    };
  }

  const accumulatedMs = currentCarryMs + Math.max(0, Math.floor(Number(deltaMs) || 0));
  const maxHealable = safeMaxHealth - currentHealth;
  const healed = Math.min(
    maxHealable,
    Math.floor(accumulatedMs / COMBAT_HEALTH_REGEN_INTERVAL_MS)
  );

  return {
    health: currentHealth + healed,
    carryMs: healed >= maxHealable
      ? 0
      : Math.max(0, accumulatedMs - (healed * COMBAT_HEALTH_REGEN_INTERVAL_MS)),
    healed
  };
}
