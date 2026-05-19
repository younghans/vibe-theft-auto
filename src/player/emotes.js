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
export const PUNCH_ALT_EMOTE_ID = 'punchingMirrored';
export const TYPING_EMOTE_ID = 'typing';
export const DRINKING_EMOTE_ID = 'drinking';

export const EMOTES_BY_ID = Object.freeze({
  [PUNCH_EMOTE_ID]: {
    label: 'Punching',
    clipName: 'punching',
    loop: false,
    fadeIn: 0.025,
    fadeOut: 0.055,
    playbackRate: 1.28,
    cancelOnMove: false,
    upperBodyOnly: true,
    aimYawOffset: -1
  },
  [PUNCH_ALT_EMOTE_ID]: {
    label: 'Punching Mirrored',
    clipName: 'punching',
    loop: false,
    fadeIn: 0.025,
    fadeOut: 0.055,
    playbackRate: 1.28,
    cancelOnMove: false,
    upperBodyOnly: true,
    aimYawOffset: 1,
    mirrorOf: PUNCH_EMOTE_ID
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
  standUp: {
    label: 'Stand Up',
    clipName: 'standUp',
    loop: false,
    fadeIn: 0.08,
    fadeOut: 0.16,
    playbackRate: 1,
    groundFeet: true
  },
  smoking: {
    label: 'Smoking',
    clipName: 'smoking',
    loop: true,
    fadeIn: 0.12,
    fadeOut: 0.18,
    playbackRate: 1,
    upperBodyOnly: true
  },
  texting: {
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
