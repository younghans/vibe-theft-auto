export const EMOTE_SLOTS = Object.freeze([
  { id: 'waving', label: 'Waving' },
  { id: 'waveHipHopDance', label: 'Wave Dance' },
  { id: 'snakeHipHopDance', label: 'Snake Dance' },
  null,
  null,
  null,
  null,
  null
]);

export const PUNCH_EMOTE_ID = 'punching';
export const PUNCH_ALT_EMOTE_ID = 'punchingMirrored';

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
  snatch: {
    label: 'Snatch',
    clipName: 'snatch',
    loop: false,
    fadeIn: 0.08,
    fadeOut: 0.16,
    playbackRate: 1,
    cancelOnMove: false,
    groundFeet: true
  }
});
