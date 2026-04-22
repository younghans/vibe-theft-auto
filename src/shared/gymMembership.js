export const GYM_MEMBERSHIP_COST = 50;
export const GYM_DOOR_BLOCKER_RADIUS = 2.8;
export const GYM_CHECK_IN_LINE = "Hey, you're gonna need a gym membership to get in here, 50 bucks.";
export const GYM_CHECK_IN_PURCHASED_LINE = "You're good. Welcome to the gym.";

export function normalizeGymCheckInEnabled(value = false) {
  return value === true;
}

export function normalizeGymMembershipActive(value = false) {
  return value === true;
}

export function isGymCheckInNpc(npc = null) {
  return normalizeGymCheckInEnabled(npc?.gymCheckInEnabled);
}

export function getGymCheckInInnerRadius(npc = null, fallback = 4.2) {
  const numeric = Number(npc?.interactRadius ?? fallback);
  return Math.max(1.5, Number.isFinite(numeric) ? numeric : fallback);
}

export function getGymCheckInPromptRadius(npc = null, fallback = 4.2) {
  return getGymCheckInInnerRadius(npc, fallback);
}
