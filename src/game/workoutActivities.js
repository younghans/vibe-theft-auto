import { TYPING_EMOTE_ID } from '../player/emotes.js';

export const SNATCH_WORKOUT_EMOTE_ID = 'snatch';
export const SNATCH_WORKOUT_KIND = 'snatch-workout';
export const SNATCH_WORKOUT_DURATION_MS = 5435;
export const SNATCH_APPROACH_STOP_DISTANCE = 0.18;

export const BASKETBALL_SHOT_WORKOUT_TYPE = 'basketball-shot';
export const BASKETBALL_SHOT_WORKOUT_KIND = 'basketball-shot-workout';
export const BASKETBALL_SHOT_DURATION_MS = 5200;
export const BASKETBALL_SHOT_APPROACH_STOP_DISTANCE = 0.2;

export const TREADMILL_WORKOUT_TYPE = 'treadmill';
export const TREADMILL_WORKOUT_KIND = 'treadmill-workout';
export const TREADMILL_DURATION_MS = 3000;
export const TREADMILL_APPROACH_STOP_DISTANCE = 0.14;

export const TYPING_WORKOUT_KIND = 'typing-workout';
export const TYPING_WORKOUT_DURATION_MS = 5200;
export const TYPING_APPROACH_STOP_DISTANCE = 0.14;

export const WORKOUT_ACTIVITY_CONFIGS = Object.freeze({
  [SNATCH_WORKOUT_KIND]: Object.freeze({
    kind: SNATCH_WORKOUT_KIND,
    emoteId: SNATCH_WORKOUT_EMOTE_ID,
    durationMs: SNATCH_WORKOUT_DURATION_MS,
    stopDistance: SNATCH_APPROACH_STOP_DISTANCE,
    activePhase: 'lifting',
    busyToast: 'That barbell is already in use.',
    unavailableToast: 'Could not use that barbell right now.',
    completeToast: 'Snatch complete.',
    attachBarbell: true,
    stopEmoteOnFinish: false
  }),
  [BASKETBALL_SHOT_WORKOUT_KIND]: Object.freeze({
    id: BASKETBALL_SHOT_WORKOUT_TYPE,
    label: 'Basketball Shot',
    kind: BASKETBALL_SHOT_WORKOUT_KIND,
    emoteId: '',
    durationMs: BASKETBALL_SHOT_DURATION_MS,
    stopDistance: BASKETBALL_SHOT_APPROACH_STOP_DISTANCE,
    activePhase: 'basketball-shot',
    busyToast: 'That hoop is already in use.',
    unavailableToast: 'Could not use that hoop right now.',
    completeToast: 'Clean release.',
    basketballShot: true,
    playEmoteOnBegin: false,
    stopEmoteOnFinish: true
  }),
  [TREADMILL_WORKOUT_KIND]: Object.freeze({
    id: TREADMILL_WORKOUT_TYPE,
    label: 'Treadmill Run',
    kind: TREADMILL_WORKOUT_KIND,
    emoteId: '',
    durationMs: TREADMILL_DURATION_MS,
    stopDistance: TREADMILL_APPROACH_STOP_DISTANCE,
    activePhase: 'treadmill-run',
    busyToast: 'That treadmill is already in use.',
    unavailableToast: 'Could not use that treadmill right now.',
    completeToast: 'Treadmill run complete.',
    treadmillRun: true,
    playEmoteOnBegin: false,
    stopEmoteOnFinish: true
  }),
  [TYPING_WORKOUT_KIND]: Object.freeze({
    kind: TYPING_WORKOUT_KIND,
    emoteId: TYPING_EMOTE_ID,
    durationMs: TYPING_WORKOUT_DURATION_MS,
    stopDistance: TYPING_APPROACH_STOP_DISTANCE,
    activePhase: 'typing',
    busyToast: 'That computer is already in use.',
    unavailableToast: 'Could not use that computer right now.',
    completeToast: 'Work session complete.',
    playTypingSound: true,
    stopEmoteOnFinish: true
  })
});

export function getWorkoutActivityConfig(interactableOrKind = null) {
  const kind = typeof interactableOrKind === 'string'
    ? interactableOrKind
    : interactableOrKind?.kind;
  return WORKOUT_ACTIVITY_CONFIGS[kind] ?? null;
}
