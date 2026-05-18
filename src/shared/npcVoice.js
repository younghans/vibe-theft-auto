export const NPC_VOICE_WAVEFORMS = Object.freeze([
  'sine',
  'triangle',
  'square',
  'sawtooth'
]);

export const NPC_VOICE_LIMITS = Object.freeze({
  basePitchHz: Object.freeze({ min: 120, max: 620 }),
  pitchVariance: Object.freeze({ min: 0, max: 0.45 }),
  charactersPerSecond: Object.freeze({ min: 12, max: 52 }),
  formantRatio: Object.freeze({ min: 1.2, max: 4.4 }),
  volume: Object.freeze({ min: 0, max: 1 })
});

export const DEFAULT_NPC_VOICE = Object.freeze({
  basePitchHz: 285,
  pitchVariance: 0.16,
  charactersPerSecond: 28,
  formantRatio: 2.45,
  waveform: 'triangle',
  volume: 0.6
});

const NPC_MODEL_VOICE_DEFAULTS = Object.freeze({
  xBot: Object.freeze({
    basePitchHz: 430,
    pitchVariance: 0.08,
    charactersPerSecond: 36,
    formantRatio: 3.2,
    waveform: 'square',
    volume: 0.52
  }),
  yBot: Object.freeze({
    basePitchHz: 465,
    pitchVariance: 0.07,
    charactersPerSecond: 37,
    formantRatio: 3.35,
    waveform: 'square',
    volume: 0.5
  }),
  brute: Object.freeze({
    basePitchHz: 150,
    pitchVariance: 0.13,
    charactersPerSecond: 22,
    formantRatio: 1.7,
    waveform: 'sawtooth',
    volume: 0.66
  }),
  ch18NonPbr: Object.freeze({
    basePitchHz: 335,
    pitchVariance: 0.19,
    charactersPerSecond: 31,
    formantRatio: 2.55,
    waveform: 'triangle',
    volume: 0.58
  }),
  roth: Object.freeze({
    basePitchHz: 185,
    pitchVariance: 0.12,
    charactersPerSecond: 23,
    formantRatio: 1.85,
    waveform: 'square',
    volume: 0.62
  }),
  martha: Object.freeze({
    basePitchHz: 355,
    pitchVariance: 0.14,
    charactersPerSecond: 25,
    formantRatio: 2.75,
    waveform: 'triangle',
    volume: 0.58
  }),
  maynard: Object.freeze({
    basePitchHz: 205,
    pitchVariance: 0.15,
    charactersPerSecond: 22,
    formantRatio: 1.95,
    waveform: 'sawtooth',
    volume: 0.64
  }),
  ch23NonPbr: Object.freeze({
    basePitchHz: 300,
    pitchVariance: 0.17,
    charactersPerSecond: 29,
    formantRatio: 2.35,
    waveform: 'triangle',
    volume: 0.58
  }),
  ch16NonPbr: Object.freeze({
    basePitchHz: 265,
    pitchVariance: 0.16,
    charactersPerSecond: 27,
    formantRatio: 2.2,
    waveform: 'triangle',
    volume: 0.58
  }),
  ch01NonPbr: Object.freeze({
    basePitchHz: 385,
    pitchVariance: 0.19,
    charactersPerSecond: 32,
    formantRatio: 2.8,
    waveform: 'triangle',
    volume: 0.56
  }),
  ch33NonPbr: Object.freeze({
    basePitchHz: 240,
    pitchVariance: 0.18,
    charactersPerSecond: 27,
    formantRatio: 2.1,
    waveform: 'square',
    volume: 0.6
  }),
  ch02NonPbr: Object.freeze({
    basePitchHz: 315,
    pitchVariance: 0.15,
    charactersPerSecond: 28,
    formantRatio: 2.5,
    waveform: 'triangle',
    volume: 0.58
  }),
  ch08NonPbr: Object.freeze({
    basePitchHz: 365,
    pitchVariance: 0.2,
    charactersPerSecond: 32,
    formantRatio: 2.85,
    waveform: 'triangle',
    volume: 0.56
  }),
  ch20NonPbr: Object.freeze({
    basePitchHz: 225,
    pitchVariance: 0.16,
    charactersPerSecond: 25,
    formantRatio: 2,
    waveform: 'square',
    volume: 0.61
  }),
  ch11NonPbr: Object.freeze({
    basePitchHz: 345,
    pitchVariance: 0.18,
    charactersPerSecond: 30,
    formantRatio: 2.65,
    waveform: 'triangle',
    volume: 0.57
  }),
  remy: Object.freeze({
    basePitchHz: 275,
    pitchVariance: 0.14,
    charactersPerSecond: 27,
    formantRatio: 2.25,
    waveform: 'triangle',
    volume: 0.6
  }),
  solider: Object.freeze({
    basePitchHz: 175,
    pitchVariance: 0.09,
    charactersPerSecond: 24,
    formantRatio: 1.8,
    waveform: 'square',
    volume: 0.66
  }),
  lewis: Object.freeze({
    basePitchHz: 255,
    pitchVariance: 0.15,
    charactersPerSecond: 27,
    formantRatio: 2.18,
    waveform: 'triangle',
    volume: 0.59
  }),
  pete: Object.freeze({
    basePitchHz: 235,
    pitchVariance: 0.14,
    charactersPerSecond: 26,
    formantRatio: 2.05,
    waveform: 'triangle',
    volume: 0.6
  }),
  david: Object.freeze({
    basePitchHz: 245,
    pitchVariance: 0.15,
    charactersPerSecond: 27,
    formantRatio: 2.1,
    waveform: 'triangle',
    volume: 0.6
  }),
  draco: Object.freeze({
    basePitchHz: 170,
    pitchVariance: 0.16,
    charactersPerSecond: 24,
    formantRatio: 1.75,
    waveform: 'sawtooth',
    volume: 0.66
  }),
  jody: Object.freeze({
    basePitchHz: 380,
    pitchVariance: 0.18,
    charactersPerSecond: 31,
    formantRatio: 2.9,
    waveform: 'triangle',
    volume: 0.55
  }),
  shannon: Object.freeze({
    basePitchHz: 390,
    pitchVariance: 0.18,
    charactersPerSecond: 31,
    formantRatio: 2.95,
    waveform: 'triangle',
    volume: 0.55
  }),
  swat: Object.freeze({
    basePitchHz: 165,
    pitchVariance: 0.08,
    charactersPerSecond: 25,
    formantRatio: 1.7,
    waveform: 'square',
    volume: 0.67
  }),
  zombiegirlWKurniawan: Object.freeze({
    basePitchHz: 235,
    pitchVariance: 0.27,
    charactersPerSecond: 19,
    formantRatio: 1.95,
    waveform: 'sawtooth',
    volume: 0.61
  }),
  elizabeth: Object.freeze({
    basePitchHz: 405,
    pitchVariance: 0.16,
    charactersPerSecond: 30,
    formantRatio: 3,
    waveform: 'triangle',
    volume: 0.55
  }),
  bryce: Object.freeze({
    basePitchHz: 250,
    pitchVariance: 0.15,
    charactersPerSecond: 28,
    formantRatio: 2.15,
    waveform: 'triangle',
    volume: 0.6
  }),
  brian: Object.freeze({
    basePitchHz: 230,
    pitchVariance: 0.14,
    charactersPerSecond: 26,
    formantRatio: 2,
    waveform: 'triangle',
    volume: 0.61
  }),
  kai: Object.freeze({
    basePitchHz: 360,
    pitchVariance: 0.19,
    charactersPerSecond: 34,
    formantRatio: 2.75,
    waveform: 'square',
    volume: 0.56
  }),
  alienSoldier: Object.freeze({
    basePitchHz: 520,
    pitchVariance: 0.1,
    charactersPerSecond: 33,
    formantRatio: 3.8,
    waveform: 'square',
    volume: 0.52
  }),
  leonard: Object.freeze({
    basePitchHz: 215,
    pitchVariance: 0.13,
    charactersPerSecond: 24,
    formantRatio: 1.95,
    waveform: 'triangle',
    volume: 0.61
  }),
  pumpkinhulkLShaw: Object.freeze({
    basePitchHz: 135,
    pitchVariance: 0.18,
    charactersPerSecond: 20,
    formantRatio: 1.6,
    waveform: 'sawtooth',
    volume: 0.7
  }),
  kate: Object.freeze({
    basePitchHz: 395,
    pitchVariance: 0.17,
    charactersPerSecond: 31,
    formantRatio: 2.95,
    waveform: 'triangle',
    volume: 0.55
  }),
  ninja: Object.freeze({
    basePitchHz: 300,
    pitchVariance: 0.11,
    charactersPerSecond: 37,
    formantRatio: 2.55,
    waveform: 'square',
    volume: 0.54
  }),
  megan: Object.freeze({
    basePitchHz: 410,
    pitchVariance: 0.18,
    charactersPerSecond: 32,
    formantRatio: 3.05,
    waveform: 'triangle',
    volume: 0.54
  }),
  james: Object.freeze({
    basePitchHz: 240,
    pitchVariance: 0.15,
    charactersPerSecond: 27,
    formantRatio: 2.1,
    waveform: 'triangle',
    volume: 0.6
  }),
  prisonerZombie: Object.freeze({
    basePitchHz: 180,
    pitchVariance: 0.24,
    charactersPerSecond: 20,
    formantRatio: 1.75,
    waveform: 'sawtooth',
    volume: 0.64
  }),
  louise: Object.freeze({
    basePitchHz: 370,
    pitchVariance: 0.17,
    charactersPerSecond: 30,
    formantRatio: 2.8,
    waveform: 'triangle',
    volume: 0.56
  }),
  theBoss: Object.freeze({
    basePitchHz: 160,
    pitchVariance: 0.1,
    charactersPerSecond: 24,
    formantRatio: 1.75,
    waveform: 'square',
    volume: 0.68
  })
});

function clampNumber(value, fallback, { min, max }) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, numeric));
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

function createHashedNpcVoice(modelId = '') {
  const lowVoice = /brute|hulk|boss|swat|soldier|zombie|draco|roth|maynard/iu.test(modelId);
  const botVoice = /bot|alien/iu.test(modelId);
  const highVoice = /martha|kate|megan|louise|elizabeth|jody|shannon|girl/iu.test(modelId);
  const pitchBase = lowVoice ? 145 : (botVoice ? 430 : (highVoice ? 365 : 235));
  const pitchSpread = lowVoice ? 80 : (botVoice ? 140 : 170);
  const waveform = botVoice
    ? 'square'
    : (lowVoice ? (getHashUnit(modelId, 4) > 0.45 ? 'sawtooth' : 'square') : 'triangle');

  return Object.freeze({
    basePitchHz: Math.round(pitchBase + getHashUnit(modelId, 1) * pitchSpread),
    pitchVariance: Number((0.08 + getHashUnit(modelId, 2) * 0.18).toFixed(3)),
    charactersPerSecond: Math.round(20 + getHashUnit(modelId, 3) * 16),
    formantRatio: Number((1.7 + getHashUnit(modelId, 5) * 1.5).toFixed(2)),
    waveform,
    volume: Number((0.54 + getHashUnit(modelId, 6) * 0.12).toFixed(2))
  });
}

export function getDefaultNpcVoiceForModelId(modelId = '') {
  const normalizedModelId = String(modelId ?? '').trim();
  return NPC_MODEL_VOICE_DEFAULTS[normalizedModelId] ?? createHashedNpcVoice(normalizedModelId);
}

export function normalizeNpcVoice(voice = {}, fallbackVoice = DEFAULT_NPC_VOICE) {
  const fallback = fallbackVoice && typeof fallbackVoice === 'object'
    ? fallbackVoice
    : DEFAULT_NPC_VOICE;
  const waveform = NPC_VOICE_WAVEFORMS.includes(voice?.waveform)
    ? voice.waveform
    : (NPC_VOICE_WAVEFORMS.includes(fallback.waveform) ? fallback.waveform : DEFAULT_NPC_VOICE.waveform);

  return {
    basePitchHz: Math.round(clampNumber(
      voice?.basePitchHz,
      fallback.basePitchHz,
      NPC_VOICE_LIMITS.basePitchHz
    )),
    pitchVariance: Number(clampNumber(
      voice?.pitchVariance,
      fallback.pitchVariance,
      NPC_VOICE_LIMITS.pitchVariance
    ).toFixed(3)),
    charactersPerSecond: Math.round(clampNumber(
      voice?.charactersPerSecond,
      fallback.charactersPerSecond,
      NPC_VOICE_LIMITS.charactersPerSecond
    )),
    formantRatio: Number(clampNumber(
      voice?.formantRatio,
      fallback.formantRatio,
      NPC_VOICE_LIMITS.formantRatio
    ).toFixed(2)),
    waveform,
    volume: Number(clampNumber(
      voice?.volume,
      fallback.volume,
      NPC_VOICE_LIMITS.volume
    ).toFixed(2))
  };
}

export function createDefaultNpcModelVoiceMap() {
  return Object.fromEntries(
    Object.keys(NPC_MODEL_VOICE_DEFAULTS).map((modelId) => [
      modelId,
      normalizeNpcVoice(NPC_MODEL_VOICE_DEFAULTS[modelId])
    ])
  );
}

export function normalizeNpcModelVoiceMap(modelVoices = {}) {
  const defaults = createDefaultNpcModelVoiceMap();
  const input = modelVoices && typeof modelVoices === 'object' && !Array.isArray(modelVoices)
    ? modelVoices
    : {};
  const output = { ...defaults };

  for (const [modelId, voice] of Object.entries(input)) {
    if (!modelId) {
      continue;
    }
    output[modelId] = normalizeNpcVoice(voice, getDefaultNpcVoiceForModelId(modelId));
  }

  return output;
}

export function getNpcModelVoice(modelVoices = {}, modelId = '') {
  const normalizedModelId = String(modelId ?? '').trim();
  const defaultVoice = getDefaultNpcVoiceForModelId(normalizedModelId);
  return normalizeNpcVoice(modelVoices?.[normalizedModelId], defaultVoice);
}

export function updateNpcModelVoiceMap(modelVoices = {}, modelId = '', voice = {}) {
  const normalizedModelId = String(modelId ?? '').trim();
  if (!normalizedModelId) {
    return normalizeNpcModelVoiceMap(modelVoices);
  }

  return {
    ...normalizeNpcModelVoiceMap(modelVoices),
    [normalizedModelId]: normalizeNpcVoice(voice, getDefaultNpcVoiceForModelId(normalizedModelId))
  };
}

export function cloneNpcModelVoiceMap(modelVoices = {}) {
  return structuredClone(normalizeNpcModelVoiceMap(modelVoices));
}
