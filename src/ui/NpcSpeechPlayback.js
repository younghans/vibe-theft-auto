import {
  DEFAULT_NPC_VOICE,
  normalizeNpcVoice
} from '../shared/npcVoice.js';

const LETTER_PATTERN = /[\p{L}\p{N}]/u;
const VOWEL_PATTERN = /[aeiouy]/iu;
const CONSONANT_PATTERN = /[bcdfghjklmnpqrstvwxyz]/iu;
const MAX_REVEAL_STEPS_PER_FRAME = 10;
const VOICE_GRAIN_MIN_INTERVAL_MS = 18;
const VOWEL_GRAIN_DURATION_SECONDS = 0.072;
const CONSONANT_GRAIN_DURATION_SECONDS = 0.052;
const PITCH_STEPS = Object.freeze([-7, -5, -2, 0, 2, 4, 7, 9]);
const WAVEFORM_GAIN = Object.freeze({
  sine: 1.15,
  triangle: 1.08,
  square: 0.95,
  sawtooth: 0.86
});
const BODY_WAVEFORM_BY_TYPE = Object.freeze({
  sine: 'sine',
  triangle: 'triangle',
  square: 'triangle',
  sawtooth: 'triangle'
});
const EDGE_WAVEFORM_GAIN = Object.freeze({
  sine: 0.08,
  triangle: 0.1,
  square: 0.18,
  sawtooth: 0.2
});
const VOWEL_FORMANT_SHAPES = Object.freeze({
  a: Object.freeze({
    formants: Object.freeze([
      Object.freeze({ ratio: 2.05, gain: 0.52, q: 4.2 }),
      Object.freeze({ ratio: 4.15, gain: 0.25, q: 5.6 })
    ]),
    brightness: 1.04
  }),
  e: Object.freeze({
    formants: Object.freeze([
      Object.freeze({ ratio: 2.35, gain: 0.46, q: 4.8 }),
      Object.freeze({ ratio: 5.1, gain: 0.3, q: 6 })
    ]),
    brightness: 1.1
  }),
  i: Object.freeze({
    formants: Object.freeze([
      Object.freeze({ ratio: 2.85, gain: 0.42, q: 5.2 }),
      Object.freeze({ ratio: 6.25, gain: 0.31, q: 6.4 })
    ]),
    brightness: 1.16
  }),
  o: Object.freeze({
    formants: Object.freeze([
      Object.freeze({ ratio: 1.72, gain: 0.56, q: 4.4 }),
      Object.freeze({ ratio: 3.45, gain: 0.23, q: 5.4 })
    ]),
    brightness: 0.96
  }),
  u: Object.freeze({
    formants: Object.freeze([
      Object.freeze({ ratio: 1.45, gain: 0.58, q: 4.6 }),
      Object.freeze({ ratio: 2.9, gain: 0.22, q: 5.2 })
    ]),
    brightness: 0.9
  }),
  y: Object.freeze({
    formants: Object.freeze([
      Object.freeze({ ratio: 2.55, gain: 0.43, q: 5 }),
      Object.freeze({ ratio: 5.65, gain: 0.29, q: 6.2 })
    ]),
    brightness: 1.12
  }),
  neutral: Object.freeze({
    formants: Object.freeze([
      Object.freeze({ ratio: 2.12, gain: 0.42, q: 4.4 }),
      Object.freeze({ ratio: 4.35, gain: 0.22, q: 5.6 })
    ]),
    brightness: 1
  })
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getNowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function getHashUnit(value, salt = 0) {
  const text = `${String(value ?? '')}:${salt}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function normalizeCharacter(character = '') {
  return String(character ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function getVoiceShapeForCharacter(character = '') {
  const normalizedCharacter = normalizeCharacter(character)[0] ?? '';
  if (normalizedCharacter === 'o') {
    return VOWEL_FORMANT_SHAPES.o;
  }
  if (normalizedCharacter === 'u' || normalizedCharacter === 'w') {
    return VOWEL_FORMANT_SHAPES.u;
  }
  if (normalizedCharacter === 'e') {
    return VOWEL_FORMANT_SHAPES.e;
  }
  if (normalizedCharacter === 'i') {
    return VOWEL_FORMANT_SHAPES.i;
  }
  if (normalizedCharacter === 'y') {
    return VOWEL_FORMANT_SHAPES.y;
  }
  if (normalizedCharacter === 'a') {
    return VOWEL_FORMANT_SHAPES.a;
  }
  return VOWEL_FORMANT_SHAPES.neutral;
}

function isVowelLike(character = '') {
  return VOWEL_PATTERN.test(normalizeCharacter(character));
}

function isConsonantLike(character = '') {
  return CONSONANT_PATTERN.test(normalizeCharacter(character));
}

function getDelayForCharacter(character, voice) {
  const baseDelay = 1000 / Math.max(1, voice.charactersPerSecond);
  if (!character || /\s/u.test(character)) {
    return baseDelay * 0.45;
  }
  if (character === ',' || character === ';' || character === ':') {
    return baseDelay * 4.2;
  }
  if (character === '.' || character === '!' || character === '?') {
    return baseDelay * 6.4;
  }
  if (character === '-' || character === String.fromCharCode(8211)) {
    return baseDelay * 2.2;
  }
  return baseDelay;
}

function createPlaybackState(targetText = '', now = getNowMs()) {
  return {
    targetText,
    visibleCount: 0,
    nextCharacterAt: now,
    lastVoiceAt: -Infinity,
    speakerKey: '',
    status: ''
  };
}

function isCompatibleTextUpdate(state, nextText) {
  const visibleText = state.targetText.slice(0, state.visibleCount);
  return nextText.startsWith(visibleText) || state.targetText.startsWith(nextText);
}

export class NpcSpeechPlayback {
  constructor({ masterVolume = 1 } = {}) {
    this.states = new Map();
    this.audioContext = null;
    this.masterGain = null;
    this.outputFilter = null;
    this.outputCompressor = null;
    this.noiseBuffer = null;
    this.masterVolume = clamp(Number(masterVolume) || 0, 0, 1);
  }

  setMasterVolume(value = 1) {
    this.masterVolume = clamp(Number(value) || 0, 0, 1);
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  prime() {
    const audioContext = this.getAudioContext();
    if (audioContext?.state === 'suspended') {
      void audioContext.resume?.().catch(() => {});
    }
  }

  disposeMissing(activeIds = new Set()) {
    for (const id of this.states.keys()) {
      if (!activeIds.has(id)) {
        this.states.delete(id);
      }
    }
  }

  getAudioContext() {
    if (this.masterVolume <= 0) {
      return null;
    }
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    this.audioContext = new AudioContextCtor();
    this.masterGain = this.audioContext.createGain();
    this.outputFilter = this.audioContext.createBiquadFilter();
    this.outputCompressor = this.audioContext.createDynamicsCompressor();
    this.masterGain.gain.value = this.masterVolume;
    this.outputFilter.type = 'lowpass';
    this.outputFilter.frequency.value = 7600;
    this.outputFilter.Q.value = 0.28;
    this.outputCompressor.threshold.value = -20;
    this.outputCompressor.knee.value = 18;
    this.outputCompressor.ratio.value = 3.4;
    this.outputCompressor.attack.value = 0.004;
    this.outputCompressor.release.value = 0.16;
    this.masterGain.connect(this.outputFilter);
    this.outputFilter.connect(this.outputCompressor);
    this.outputCompressor.connect(this.audioContext.destination);
    return this.audioContext;
  }

  getNoiseBuffer(audioContext) {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === audioContext.sampleRate) {
      return this.noiseBuffer;
    }

    const duration = 0.08;
    const sampleCount = Math.max(1, Math.ceil(audioContext.sampleRate * duration));
    const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      const envelope = 1 - (index / sampleCount);
      data[index] = (Math.random() * 2 - 1) * envelope;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  getPitchForCharacter({ voice, speakerKey, characterIndex, character }) {
    const noteUnit = getHashUnit(`${speakerKey}:${character}:${characterIndex}`, 1);
    const stepIndex = Math.floor(noteUnit * PITCH_STEPS.length) % PITCH_STEPS.length;
    const varianceSemitones = Math.max(1, Math.round(voice.pitchVariance * 18));
    const signedStep = clamp(PITCH_STEPS[stepIndex], -varianceSemitones, varianceSemitones);
    const microJitter = (getHashUnit(`${speakerKey}:${characterIndex}`, 7) - 0.5) * 0.7;
    return voice.basePitchHz * (2 ** ((signedStep + microJitter) / 12));
  }

  scheduleGainEnvelope(gainParam, now, {
    peak = 1,
    attack = 0.009,
    releaseStart = 0.034,
    end = 0.07
  } = {}) {
    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(0.0001, now);
    gainParam.linearRampToValueAtTime(Math.max(0.0001, peak), now + attack);
    gainParam.setTargetAtTime(Math.max(0.0001, peak * 0.7), now + releaseStart, 0.022);
    gainParam.exponentialRampToValueAtTime(0.0001, now + end);
  }

  playVoiceGrain({
    voice,
    speakerKey,
    characterIndex,
    character,
    state,
    nowMs,
    volumeScale = 1
  }) {
    const grainVolumeScale = clamp(
      Number.isFinite(Number(volumeScale)) ? Number(volumeScale) : 1,
      0,
      1
    );
    if (
      this.masterVolume <= 0
      || voice.volume <= 0
      || grainVolumeScale <= 0
      || !LETTER_PATTERN.test(character)
      || nowMs - state.lastVoiceAt < VOICE_GRAIN_MIN_INTERVAL_MS
      || globalThis.document?.hidden
    ) {
      return;
    }

    const audioContext = this.getAudioContext();
    if (!audioContext || !this.masterGain) {
      return;
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume?.().catch(() => {});
    }

    const now = audioContext.currentTime;
    const vowelLike = isVowelLike(character);
    const consonantLike = isConsonantLike(character);
    const voiceShape = getVoiceShapeForCharacter(character);
    const formantScale = clamp(voice.formantRatio / DEFAULT_NPC_VOICE.formantRatio, 0.72, 1.32);
    const grainRandomness = getHashUnit(`${speakerKey}:${character}:${characterIndex}`, 8);
    const duration = (vowelLike ? VOWEL_GRAIN_DURATION_SECONDS : CONSONANT_GRAIN_DURATION_SECONDS)
      + grainRandomness * 0.012;
    const pitch = clamp(
      this.getPitchForCharacter({ voice, speakerKey, characterIndex, character }),
      90,
      1200
    );
    const bodyOscillator = audioContext.createOscillator();
    const edgeOscillator = audioContext.createOscillator();
    const bodyGain = audioContext.createGain();
    const edgeGain = audioContext.createGain();
    const grainGain = audioContext.createGain();
    const waveformGain = WAVEFORM_GAIN[voice.waveform] ?? 1.4;
    const edgeWaveformGain = EDGE_WAVEFORM_GAIN[voice.waveform] ?? 0.1;
    const peakGain = clamp(
      0.048 * voice.volume * grainVolumeScale * waveformGain * voiceShape.brightness * (consonantLike ? 0.88 : 1),
      0.0001,
      0.13
    );
    const bodyFrequencyStart = pitch * (1.025 + grainRandomness * 0.01);
    const bodyFrequencyEnd = pitch * (vowelLike ? 0.97 : 0.94);

    bodyOscillator.type = BODY_WAVEFORM_BY_TYPE[voice.waveform] ?? 'triangle';
    bodyOscillator.frequency.setValueAtTime(bodyFrequencyStart, now);
    bodyOscillator.frequency.exponentialRampToValueAtTime(bodyFrequencyEnd, now + duration);

    edgeOscillator.type = voice.waveform === 'sine' ? 'triangle' : voice.waveform;
    edgeOscillator.frequency.setValueAtTime(pitch * 2.01, now);
    edgeOscillator.frequency.exponentialRampToValueAtTime(pitch * 1.94, now + duration);

    bodyGain.gain.setValueAtTime(peakGain * (vowelLike ? 0.74 : 0.58), now);
    edgeGain.gain.setValueAtTime(peakGain * edgeWaveformGain, now);
    this.scheduleGainEnvelope(grainGain.gain, now, {
      peak: 1,
      attack: vowelLike ? 0.011 : 0.006,
      releaseStart: duration * (vowelLike ? 0.42 : 0.26),
      end: duration
    });

    bodyOscillator.connect(bodyGain);
    bodyGain.connect(grainGain);
    edgeOscillator.connect(edgeGain);
    edgeGain.connect(grainGain);

    for (const formant of voiceShape.formants) {
      const filter = audioContext.createBiquadFilter();
      const formantGain = audioContext.createGain();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(
        clamp(pitch * formant.ratio * formantScale, 260, 6800),
        now
      );
      filter.frequency.exponentialRampToValueAtTime(
        clamp(pitch * formant.ratio * formantScale * 0.985, 250, 6800),
        now + duration
      );
      filter.Q.setValueAtTime(formant.q, now);
      formantGain.gain.setValueAtTime(peakGain * formant.gain, now);
      bodyOscillator.connect(filter);
      filter.connect(formantGain);
      formantGain.connect(grainGain);
    }

    if (consonantLike) {
      const noiseSource = audioContext.createBufferSource();
      const noiseFilter = audioContext.createBiquadFilter();
      const noiseGain = audioContext.createGain();
      noiseSource.buffer = this.getNoiseBuffer(audioContext);
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(
        clamp(2100 + voice.formantRatio * 520 + grainRandomness * 900, 1200, 6200),
        now
      );
      noiseFilter.Q.setValueAtTime(0.82, now);
      this.scheduleGainEnvelope(noiseGain.gain, now, {
        peak: peakGain * 0.36,
        attack: 0.003,
        releaseStart: 0.012,
        end: Math.min(duration, 0.042)
      });
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(grainGain);
      noiseSource.start(now);
      noiseSource.stop(now + Math.min(duration, 0.052));
    }

    grainGain.connect(this.masterGain);
    bodyOscillator.start(now);
    edgeOscillator.start(now);
    bodyOscillator.stop(now + duration + 0.012);
    edgeOscillator.stop(now + duration + 0.012);
    state.lastVoiceAt = nowMs;
  }

  updateBubble({
    id,
    text = '',
    status = 'done',
    voice = null,
    speakerKey = '',
    volumeScale = 1
  } = {}) {
    const normalizedId = String(id ?? '');
    const targetText = String(text ?? '');
    const normalizedVoice = normalizeNpcVoice(voice, DEFAULT_NPC_VOICE);
    const normalizedVolumeScale = clamp(
      Number.isFinite(Number(volumeScale)) ? Number(volumeScale) : 1,
      0,
      1
    );
    const now = getNowMs();

    if (!normalizedId || status === 'thinking' || !targetText) {
      this.states.delete(normalizedId);
      return '';
    }

    let state = this.states.get(normalizedId);
    const normalizedSpeakerKey = String(speakerKey || normalizedId);
    if (!state || state.speakerKey !== normalizedSpeakerKey || !isCompatibleTextUpdate(state, targetText)) {
      state = createPlaybackState(targetText, now);
      state.speakerKey = normalizedSpeakerKey;
      this.states.set(normalizedId, state);
    }

    state.status = status;
    state.targetText = targetText;
    state.visibleCount = clamp(state.visibleCount, 0, targetText.length);
    if (!Number.isFinite(state.nextCharacterAt)) {
      state.nextCharacterAt = now;
    }

    let steps = 0;
    while (
      state.visibleCount < targetText.length
      && now >= state.nextCharacterAt
      && steps < MAX_REVEAL_STEPS_PER_FRAME
    ) {
      const character = targetText[state.visibleCount];
      state.visibleCount += 1;
      this.playVoiceGrain({
        voice: normalizedVoice,
        speakerKey: normalizedSpeakerKey,
        characterIndex: state.visibleCount,
        character,
        state,
        nowMs: now,
        volumeScale: normalizedVolumeScale
      });
      state.nextCharacterAt += getDelayForCharacter(character, normalizedVoice);
      steps += 1;
    }

    return targetText.slice(0, state.visibleCount);
  }
}
