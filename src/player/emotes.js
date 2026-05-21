export const EMOTE_SLOTS = Object.freeze([
  { id: 'waving', label: 'Waving' },
  { id: 'waveHipHopDance', label: 'Wave Dance' },
  { id: 'snakeHipHopDance', label: 'Snake Dance' },
  { id: 'standUp', label: 'Stand Up' },
  { id: 'smoking', label: 'Smoking' },
  { id: 'texting', label: 'Texting' },
  null,
  null
]);

export const PUNCH_EMOTE_ID = 'punching';
export const STAND_UP_EMOTE_ID = 'standUp';
export const PUNCH_HOOK_EMOTE_ID = 'punchHook';
export const TYPING_EMOTE_ID = 'typing';
export const TEXTING_EMOTE_ID = 'texting';
export const DRINKING_EMOTE_ID = 'drinking';
export const SMOKING_EMOTE_ID = 'smoking';

export const EMOTES_BY_ID = Object.freeze({
  [PUNCH_EMOTE_ID]: {
    label: 'Lead Jab',
    clipName: 'leadJab',
    loop: false,
    fadeIn: 0.015,
    fadeOut: 0.05,
    playbackRate: 4.2,
    cancelOnMove: false,
    upperBodyOnly: true
  },
  [PUNCH_HOOK_EMOTE_ID]: {
    label: 'Right Hook',
    clipName: 'rightHook',
    loop: false,
    fadeIn: 0.015,
    fadeOut: 0.06,
    playbackRate: 3.6,
    cancelOnMove: false,
    upperBodyOnly: true
  },
  waving: {
    label: 'Waving',
    clipName: 'waving',
    loop: false,
    fadeIn: 0.12,
    fadeOut: 0.18,
    playbackRate: 1
  },
  waveHipHopDance: {
    label: 'Wave Dance',
    clipName: 'waveHipHopDance',
    loop: true,
    fadeIn: 0.18,
    fadeOut: 0.22,
    playbackRate: 1
  },
  snakeHipHopDance: {
    label: 'Snake Dance',
    clipName: 'snakeHipHopDance',
    loop: true,
    fadeIn: 0.18,
    fadeOut: 0.22,
    playbackRate: 1
  },
  [STAND_UP_EMOTE_ID]: {
    label: 'Stand Up',
    clipName: 'standUp',
    loop: false,
    fadeIn: 0.08,
    fadeOut: 0.16,
    playbackRate: 1,
    groundFeet: true
  },
  [SMOKING_EMOTE_ID]: {
    label: 'Smoking',
    clipName: 'smoking',
    loop: true,
    fadeIn: 0.12,
    fadeOut: 0.18,
    playbackRate: 1,
    upperBodyOnly: true
  },
  [TEXTING_EMOTE_ID]: {
    label: 'Texting',
    clipName: 'texting',
    loop: true,
    fadeIn: 0.12,
    fadeOut: 0.18,
    playbackRate: 1,
    upperBodyOnly: true
  },
  snatch: {
    label: 'Snatch',
    clipName: 'snatch',
    loop: false,
    fadeIn: 0.08,
    fadeOut: 0.16,
    playbackRate: 1,
    cancelOnMove: false,
    groundFeet: true
  },
  [DRINKING_EMOTE_ID]: {
    label: 'Drinking',
    clipName: 'drinking',
    loop: false,
    fadeIn: 0.08,
    fadeOut: 0.16,
    playbackRate: 1,
    cancelOnMove: false,
    upperBodyOnly: true
  },
  [TYPING_EMOTE_ID]: {
    label: 'Typing',
    clipName: 'typing',
    loop: true,
    fadeIn: 0.12,
    fadeOut: 0.16,
    playbackRate: 1,
    cancelOnMove: false,
    upperBodyOnly: true
  }
});
