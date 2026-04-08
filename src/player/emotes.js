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

export const EMOTES_BY_ID = Object.freeze({
  [PUNCH_EMOTE_ID]: {
    label: 'Punching',
    clipName: 'punching',
    loop: false,
    fadeIn: 0.06,
    fadeOut: 0.1,
    playbackRate: 1,
    cancelOnMove: false,
    upperBodyOnly: true,
    aimYawOffset: -1
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
  }
});
