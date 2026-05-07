import { TYPING_EMOTE_ID } from '../player/emotes.js';

export const SNATCH_WORKOUT_EMOTE_ID = 'snatch';
export const SNATCH_WORKOUT_KIND = 'snatch-workout';
export const SNATCH_WORKOUT_DURATION_MS = 5435;
export const SNATCH_APPROACH_STOP_DISTANCE = 0.18;

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
