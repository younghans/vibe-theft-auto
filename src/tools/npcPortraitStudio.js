import {
  CharacterPreviewRenderer,
  DEFAULT_MUGSHOT_CAMERA_PRESET,
  MUGSHOT_EXPORT_PROFILE,
  MUGSHOT_EXPORT_SIZE
} from '../ui/CharacterPreviewRenderer.js';
import { listPlayableCharacters } from '../player/playableCharacterCatalog.js';
import { escapeHtml } from '../shared/htmlEscape.js';
import { ModelLibrary } from '../world/ModelLibrary.js';

const SAVE_ENDPOINT = '/__dev_write_asset';
const OUTPUT_DIRECTORY = 'assets/mixamo/portraits';
const PRESETS_FILE_PATH = `${OUTPUT_DIRECTORY}/portrait-presets.json`;
const PRESET_FIELDS = Object.freeze([
  Object.freeze({
    key: 'yawDegrees',
    label: 'Angle',
    min: -60,
    max: 60,
    step: 1,
    format: (value) => `${Math.round(value)} deg`
  }),
  Object.freeze({
    key: 'zoom',
    label: 'Zoom',
    min: 0.7,
    max: 3,
    step: 0.01,
    format: (value) => `${Number(value).toFixed(2)}x`
  }),
  Object.freeze({
    key: 'focusXRatio',
    label: 'Frame X',
    min: -0.45,
    max: 0.45,
    step: 0.01,
    format: (value) => Number(value).toFixed(2)
  }),
  Object.freeze({
    key: 'focusYRatio',
    label: 'Frame Y',
    min: -0.45,
    max: 1,
    step: 0.01,
    format: (value) => Number(value).toFixed(2)
  })
]);

const library = new ModelLibrary();
const portraitRenderer = new CharacterPreviewRenderer({
  library,
  portraitSnapshotSize: MUGSHOT_EXPORT_SIZE,
  portraitSnapshotProfile: MUGSHOT_EXPORT_PROFILE
});

const app = document.querySelector('[data-npc-portrait-studio]');

const state = {
  entries: listPlayableCharacters()
    .filter((entry) => entry?.portraitFileName)
    .map((entry) => ({
      ...entry,
      saving: false,
      rendering: false,
      previewSrc: '',
      dataUrl: '',
      error: '',
      savedPath: '',
      needsRender: false,
      needsSave: false
    })),
  sharedPreset: { ...DEFAULT_MUGSHOT_CAMERA_PRESET },
  sharedPresetDirty: false,
  running: false,
  previewingAll: false,
  pendingPreviewRefresh: false,
  batchTotal: 0,
  batchProcessed: 0,
  batchSaved: 0,
  batchFailed: 0,
  batchFailures: [],
  savingPresets: false,
  presetsSavedPath: '',
  presetsError: ''
};

function formatPresetValue(field, value) {
  return field.format(Number.isFinite(value) ? value : 0);
}

function getOutputPath(entry) {
  return `${OUTPUT_DIRECTORY}/${entry.portraitFileName}`;
}

function getStatusText(entry) {
  if (entry.error) {
    return entry.error;
  }
  if (entry.saving) {
    return 'Saving PNG...';
  }
  if (entry.rendering) {
    return 'Rendering portrait...';
  }
  if (entry.needsRender) {
    return 'Shared framing changed. Render a fresh preview.';
  }
  if (entry.needsSave) {
    return 'Preview ready. Save PNG when it looks right.';
  }
  if (entry.savedPath) {
    return `Saved PNG to ${entry.savedPath}`;
  }
  if (entry.previewSrc) {
    return 'Existing PNG loaded from disk.';
  }
  return `Will write ${getOutputPath(entry)}`;
}

function getPresetPayload() {
  return { ...state.sharedPreset };
}

function getBatchSummaryText() {
  if (!state.batchTotal) {
    return '';
  }

  if (state.running) {
    return `Batch export ${state.batchProcessed}/${state.batchTotal}. Saved ${state.batchSaved}, failed ${state.batchFailed}.`;
  }

  return `Last batch finished. Saved ${state.batchSaved}/${state.batchTotal}${state.batchFailed ? `, failed ${state.batchFailed}` : ''}.`;
}

async function readJsonResponse(response, fallbackMessage) {
  const raw = await response.text();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    const clipped = raw.length > 180 ? `${raw.slice(0, 177)}...` : raw;
    throw new Error(`${fallbackMessage} (${response.status}): ${clipped}`);
  }
}

function readPresetCandidate(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return null;
  }

  const preset = { ...DEFAULT_MUGSHOT_CAMERA_PRESET };
  let foundAnyValue = false;

  for (const field of PRESET_FIELDS) {
    const value = Number(source[field.key]);
    if (!Number.isFinite(value)) {
      continue;
    }
    preset[field.key] = value;
    foundAnyValue = true;
  }

  return foundAnyValue ? preset : null;
}

function renderPresetControl(field) {
  const value = Number(
    state.sharedPreset[field.key]
    ?? DEFAULT_MUGSHOT_CAMERA_PRESET[field.key]
    ?? 0
  );

  return `
    <label class="portrait-studio__control">
      <span class="portrait-studio__control-top">
        <span>${escapeHtml(field.label)}</span>
        <span>${escapeHtml(formatPresetValue(field, value))}</span>
      </span>
      <input
        class="portrait-studio__slider"
        type="range"
        min="${field.min}"
        max="${field.max}"
        step="${field.step}"
        value="${value}"
        data-setting="${field.key}"
      />
    </label>
  `;
}

function render() {
  const completed = state.entries.filter((entry) => entry.savedPath).length;
  const busy = (
    state.running
    || state.previewingAll
    || state.savingPresets
    || state.entries.some((entry) => entry.rendering || entry.saving)
  );

  app.innerHTML = `
    <section class="portrait-studio__hero">
      <div>
        <p class="portrait-studio__eyebrow">Portrait Studio</p>
        <h1>Frame one shared mug-shot preset for NPC cards and the character selector.</h1>
        <p class="portrait-studio__copy">
          Tune one general camera preset here, save it to <code>${escapeHtml(PRESETS_FILE_PATH)}</code>,
          then render PNGs into <code>${escapeHtml(OUTPUT_DIRECTORY)}</code>. The live client uses those static files
          instead of instantiating every character rig for menu thumbnails.
        </p>
        <div class="portrait-studio__controls portrait-studio__controls--hero">
          ${PRESET_FIELDS.map((field) => renderPresetControl(field)).join('')}
        </div>
        <p class="portrait-studio__hero-note">
          This shared framing applies across the full roster, so the same preset feeds both the NPC builder and the character select menu.
        </p>
      </div>
      <div class="portrait-studio__actions">
        <button class="portrait-studio__button" type="button" data-action="save-presets" ${state.savingPresets ? 'disabled' : ''}>
          Save Shared Framing
        </button>
        <button class="portrait-studio__button portrait-studio__button--secondary" type="button" data-action="reset-preset" ${busy ? 'disabled' : ''}>
          Reset Framing
        </button>
        <button class="portrait-studio__button" type="button" data-action="render-all" ${busy ? 'disabled' : ''}>
          Render and Save All
        </button>
        <span class="portrait-studio__meta">${completed}/${state.entries.length} available on disk</span>
        ${state.sharedPresetDirty
          ? '<span class="portrait-studio__meta">Shared framing has unsaved changes.</span>'
          : ''}
        ${state.previewingAll
          ? '<span class="portrait-studio__meta">Refreshing portrait previews...</span>'
          : ''}
        ${state.presetsSavedPath
          ? `<span class="portrait-studio__meta">Preset saved to ${escapeHtml(state.presetsSavedPath)}</span>`
          : ''}
        ${state.presetsError
          ? `<span class="portrait-studio__meta portrait-studio__meta--error">${escapeHtml(state.presetsError)}</span>`
          : ''}
        ${getBatchSummaryText()
          ? `<span class="portrait-studio__meta${state.batchFailed ? ' portrait-studio__meta--error' : ''}">${escapeHtml(getBatchSummaryText())}</span>`
          : ''}
        ${state.batchFailures.length
          ? `
            <div class="portrait-studio__batch-failures">
              ${state.batchFailures.map((failure) => `
                <div class="portrait-studio__batch-failure">${escapeHtml(failure)}</div>
              `).join('')}
            </div>
          `
          : ''}
      </div>
    </section>
    <section class="portrait-studio__grid">
      ${state.entries.map((entry) => `
        <article class="portrait-studio__card">
          <div class="portrait-studio__frame">
            ${entry.previewSrc
              ? `<img class="portrait-studio__image" src="${entry.previewSrc}" alt="${escapeHtml(entry.label)} portrait" />`
              : `<div class="portrait-studio__placeholder">${escapeHtml(entry.label)}</div>`}
          </div>
          <div class="portrait-studio__card-body">
            <div>
              <h2>${escapeHtml(entry.label)}</h2>
              <p>${escapeHtml(entry.subtitle ?? '')}</p>
            </div>
            <code>${escapeHtml(getOutputPath(entry))}</code>
            <p class="portrait-studio__status${entry.error ? ' is-error' : ''}">${escapeHtml(getStatusText(entry))}</p>
            <div class="portrait-studio__card-actions">
              <button class="portrait-studio__button" type="button" data-action="render-one" data-character-id="${entry.id}" ${entry.rendering || entry.saving ? 'disabled' : ''}>
                Render Preview
              </button>
              <button class="portrait-studio__button portrait-studio__button--secondary" type="button" data-action="save-one" data-character-id="${entry.id}" ${!entry.dataUrl || entry.saving || entry.rendering || entry.needsRender ? 'disabled' : ''}>
                Save PNG
              </button>
            </div>
          </div>
        </article>
      `).join('')}
    </section>
  `;
}

function getEntry(characterId) {
  return state.entries.find((entry) => entry.id === characterId) ?? null;
}

function updateEntry(characterId, updates) {
  const entry = getEntry(characterId);
  if (!entry) {
    return null;
  }

  Object.assign(entry, updates);
  render();
  return entry;
}

function markEntriesNeedingRender() {
  for (const entry of state.entries) {
    entry.error = '';
    entry.savedPath = '';
    entry.dataUrl = '';
    entry.needsRender = true;
    entry.needsSave = false;
  }
  if (state.previewingAll) {
    state.pendingPreviewRefresh = true;
  }
}

async function loadPresetFile() {
  try {
    const response = await fetch(`/${PRESETS_FILE_PATH}`, { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const payload = await readJsonResponse(response, 'Could not read portrait preset');
    const sharedPreset = readPresetCandidate(payload);
    if (sharedPreset) {
      state.sharedPreset = sharedPreset;
      return;
    }

    if (!payload || typeof payload !== 'object') {
      return;
    }

    const legacyPreset = Object.values(payload)
      .map((value) => readPresetCandidate(value))
      .find(Boolean);
    if (legacyPreset) {
      state.sharedPreset = legacyPreset;
    }
  } catch (error) {
    state.presetsError = error?.message ?? String(error);
  }
}

async function loadExistingPortraits() {
  await Promise.all(state.entries.map(async (entry) => {
    if (!entry.portraitStaticSrc) {
      return;
    }

    try {
      const response = await fetch(entry.portraitStaticSrc, { cache: 'no-store' });
      if (!response.ok) {
        return;
      }

      entry.previewSrc = entry.portraitStaticSrc;
      entry.dataUrl = '';
      entry.savedPath = getOutputPath(entry);
      entry.needsRender = false;
      entry.needsSave = false;
    } catch {
      // Ignore missing portraits on disk and fall back to placeholders.
    }
  }));
}

async function savePresetFile() {
  state.savingPresets = true;
  state.presetsError = '';
  state.presetsSavedPath = '';
  render();

  try {
    const response = await fetch(SAVE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        relativePath: PRESETS_FILE_PATH,
        textContents: JSON.stringify(getPresetPayload(), null, 2)
      })
    });
    const payload = await readJsonResponse(response, 'Could not save portrait preset');
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error ?? 'Could not save portrait preset.');
    }

    state.sharedPresetDirty = false;
    state.presetsSavedPath = payload.relativePath;
  } catch (error) {
    state.presetsError = error?.message ?? String(error);
    throw error;
  } finally {
    state.savingPresets = false;
    render();
  }
}

async function renderPortrait(characterId) {
  const entry = getEntry(characterId);
  if (!entry) {
    return '';
  }

  updateEntry(characterId, {
    rendering: true,
    error: ''
  });

  try {
    const dataUrl = await portraitRenderer.renderPortraitDataUrl(characterId, {
      portraitPreset: state.sharedPreset
    });
    updateEntry(characterId, {
      previewSrc: dataUrl,
      dataUrl,
      rendering: false,
      savedPath: '',
      needsRender: false,
      needsSave: true
    });
    return dataUrl;
  } catch (error) {
    updateEntry(characterId, {
      rendering: false,
      error: error?.message ?? String(error)
    });
    throw error;
  }
}

function shouldRenderPreview(entry, { force = false } = {}) {
  if (force) {
    return true;
  }
  return entry.needsRender || !entry.previewSrc;
}

async function renderPreviewGrid(options = {}) {
  if (state.running) {
    return;
  }

  const { force = false } = options;
  if (state.previewingAll) {
    state.pendingPreviewRefresh = true;
    return;
  }
  const targets = state.entries.filter((entry) => shouldRenderPreview(entry, { force }));
  if (targets.length === 0) {
    return;
  }

  state.previewingAll = true;
  render();

  try {
    for (const entry of targets) {
      await renderPortrait(entry.id);
    }
  } finally {
    state.previewingAll = false;
    if (state.pendingPreviewRefresh) {
      state.pendingPreviewRefresh = false;
      void renderPreviewGrid();
      return;
    }
    render();
  }
}

async function savePortrait(characterId) {
  const entry = getEntry(characterId);
  if (!entry?.dataUrl || entry.needsRender) {
    return '';
  }

  updateEntry(characterId, {
    saving: true,
    error: ''
  });

  try {
    const response = await fetch(SAVE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        relativePath: getOutputPath(entry),
        dataUrl: entry.dataUrl
      })
    });
    const payload = await readJsonResponse(response, 'Could not save portrait PNG');
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error ?? 'Could not save portrait PNG.');
    }

    updateEntry(characterId, {
      saving: false,
      savedPath: payload.relativePath,
      needsSave: false
    });
    return payload.relativePath;
  } catch (error) {
    updateEntry(characterId, {
      saving: false,
      error: error?.message ?? String(error)
    });
    throw error;
  }
}

async function renderAndSaveAll() {
  if (state.running) {
    return;
  }

  state.running = true;
  state.batchTotal = state.entries.length;
  state.batchProcessed = 0;
  state.batchSaved = 0;
  state.batchFailed = 0;
  state.batchFailures = [];
  render();

  try {
    await savePresetFile();
    for (const entry of state.entries) {
      try {
        await renderPortrait(entry.id);
        await savePortrait(entry.id);
        state.batchSaved += 1;
      } catch (error) {
        state.batchFailed += 1;
        state.batchFailures.push(`${entry.label}: ${error?.message ?? String(error)}`);
      } finally {
        state.batchProcessed += 1;
        render();
      }
    }
  } catch (error) {
    const message = error?.message ?? String(error);
    state.batchFailed = Math.max(state.batchFailed, state.batchTotal - state.batchProcessed);
    state.batchFailures.push(`Batch setup failed: ${message}`);
  } finally {
    state.running = false;
    render();
  }
}

app.addEventListener('click', async (event) => {
  const target = event.target instanceof Element
    ? event.target.closest('[data-action]')
    : null;
  if (!target) {
    return;
  }

  const action = target.getAttribute('data-action');
  const characterId = target.getAttribute('data-character-id') ?? '';

  if (action === 'save-presets') {
    await savePresetFile();
    await renderPreviewGrid();
    return;
  }

  if (action === 'reset-preset') {
    state.sharedPreset = { ...DEFAULT_MUGSHOT_CAMERA_PRESET };
    state.sharedPresetDirty = true;
    state.presetsSavedPath = '';
    state.presetsError = '';
    markEntriesNeedingRender();
    render();
    return;
  }

  if (action === 'render-all') {
    await renderAndSaveAll();
    return;
  }

  if (!characterId) {
    return;
  }

  if (action === 'render-one') {
    await renderPortrait(characterId);
    return;
  }

  if (action === 'save-one') {
    await savePortrait(characterId);
  }
});

app.addEventListener('input', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.dataset.setting == null) {
    return;
  }

  const setting = target.dataset.setting ?? '';
  if (!setting) {
    return;
  }

  state.sharedPreset = {
    ...state.sharedPreset,
    [setting]: Number(target.value)
  };
  state.sharedPresetDirty = true;
  state.presetsSavedPath = '';
  state.presetsError = '';
  markEntriesNeedingRender();
  render();
});

await loadPresetFile();
await loadExistingPortraits();
render();
void renderPreviewGrid();
