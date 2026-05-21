export const WANTED_MAX_STARS = 5;
export const WANTED_EVASION_MS = 20000;
export const WANTED_EVASION_BAR_VISIBLE_MS = 10000;
export const WANTED_POLICE_KILLS_FOR_FOUR_STARS = 10;
export const WANTED_POLICE_KILLS_FOR_FIVE_STARS = 25;
export const WANTED_RESPONSE_POLICE_CAR_SPEED_MULTIPLIER = 2.04;
export const WANTED_RESPONSE_TANK_SPEED_MULTIPLIER = 1.2;

export const WANTED_CRIME_REASONS = Object.freeze({
  hostileAction: 'hostile-action',
  shotFired: 'shot-fired',
  punch: 'punch',
  playerKill: 'player-kill',
  npcKill: 'npc-kill',
  policeKill: 'police-kill'
});

const WANTED_REASON_STAR_FLOORS = Object.freeze({
  [WANTED_CRIME_REASONS.hostileAction]: 1,
  [WANTED_CRIME_REASONS.shotFired]: 1,
  [WANTED_CRIME_REASONS.punch]: 1,
  [WANTED_CRIME_REASONS.playerKill]: 2,
  [WANTED_CRIME_REASONS.npcKill]: 2,
  [WANTED_CRIME_REASONS.policeKill]: 3
});

export function normalizeWantedStars(value = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.max(0, Math.min(WANTED_MAX_STARS, Math.floor(numeric)))
    : 0;
}

export function getWantedStarsForCrimeReason(reason = '') {
  return WANTED_REASON_STAR_FLOORS[String(reason || '')] ?? 1;
}

export function getWantedStarsForPoliceKills(currentStars = 0, policeKillsAfterThreeStars = 0) {
  const kills = Math.max(0, Math.floor(Number(policeKillsAfterThreeStars) || 0));
  if (kills >= WANTED_POLICE_KILLS_FOR_FIVE_STARS) {
    return WANTED_MAX_STARS;
  }
  if (kills >= WANTED_POLICE_KILLS_FOR_FOUR_STARS) {
    return Math.max(normalizeWantedStars(currentStars), 4);
  }
  return normalizeWantedStars(currentStars);
}

export function getWantedResponseUnitCounts(stars = 0) {
  const wantedStars = normalizeWantedStars(stars);
  if (wantedStars >= 5) {
    return {
      policeCars: 3,
      tanks: 1
    };
  }
  if (wantedStars >= 4) {
    return {
      policeCars: 3,
      tanks: 0
    };
  }
  if (wantedStars >= 3) {
    return {
      policeCars: 2,
      tanks: 0
    };
  }
  return {
    policeCars: 0,
    tanks: 0
  };
}
