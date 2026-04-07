import { EMOTE_SLOTS } from '../player/emotes.js';
import { HELD_ITEM_AIM_POSE_FIELDS } from '../shared/heldItemDefinitions.js';

function setFieldValue(field, value) {
  if (!field || document.activeElement === field) {
    return;
  }

  field.value = value;
}

function getBuilderPlaceholder(label) {
  return String(label ?? '??')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const HUD_CONTROLS = Object.freeze([
  { label: 'Move', key: 'WASD' },
  { label: 'Fire', mouseButton: 'left' },
  { label: 'Aim', mouseButton: 'right' },
  { label: 'Interact', key: 'E' },
  { label: 'Reload', key: 'R' },
  { label: 'Chat', key: 'Enter' },
  { label: 'Emote', key: 'B' }
]);

function getMouseControlIconMarkup(side) {
  const leftActive = side === 'left' ? ' is-active' : '';
  const rightActive = side === 'right' ? ' is-active' : '';
  return `
    <span class="hud__control-badge hud__control-badge--mouse" aria-hidden="true">
      <svg class="hud__control-mouse" viewBox="0 0 32 40">
        <path
          class="hud__control-mouse-button${leftActive}"
          d="M16 5H11.4a3.7 3.7 0 0 0-3.7 3.7V16H16V5z"
        />
        <path
          class="hud__control-mouse-button${rightActive}"
          d="M16 5h4.6a3.7 3.7 0 0 1 3.7 3.7V16H16V5z"
        />
        <path
          class="hud__control-mouse-shell"
          d="M16 2C9.4 2 5 6.9 5 13.4v13.2C5 33.1 9.7 38 16 38s11-4.9 11-11.4V13.4C27 6.9 22.6 2 16 2z"
        />
        <path class="hud__control-mouse-divider" d="M16 4.8V16" />
        <path class="hud__control-mouse-divider" d="M8 16h16" />
      </svg>
    </span>
  `;
}

function getHudControlsMarkup() {
  return HUD_CONTROLS.map((control) => `
    <div class="hud__controls-row">
      ${control.mouseButton
        ? getMouseControlIconMarkup(control.mouseButton)
        : `<span class="hud__control-badge hud__control-badge--key">${control.key}</span>`}
      <span class="hud__controls-label">${control.label}</span>
    </div>
  `).join('');
}

export class Hud {
  constructor(root) {
    this.root = root;
    this.builderPreviewImages = new Map();
    this.loading = this.createLoading();
    this.overlay = this.createOverlay();
    this.promptText = this.overlay.querySelector('[data-prompt]');
    this.toastText = this.overlay.querySelector('[data-toast]');
    this.aimDebugRoot = this.overlay.querySelector('[data-aim-debug]');
    this.aimDebugToggle = this.overlay.querySelector('[data-aim-debug-toggle]');
    this.aimDebugStatus = this.overlay.querySelector('[data-aim-debug-status]');
    this.aimDebugFields = this.overlay.querySelector('[data-aim-debug-fields]');
    this.aimDebugBoneToggle = this.overlay.querySelector('[data-aim-debug-bones]');
    this.aimDebugReset = this.overlay.querySelector('[data-aim-debug-reset]');
    this.aimDebugPrint = this.overlay.querySelector('[data-aim-debug-print]');
    this.shaderDebugRoot = this.overlay.querySelector('[data-shader-debug]');
    this.shaderDebugToggle = this.overlay.querySelector('[data-shader-debug-toggle]');
    this.shaderDebugClose = this.overlay.querySelector('[data-shader-debug-close]');
    this.shaderDebugStatus = this.overlay.querySelector('[data-shader-debug-status]');
    this.shaderDebugIntensity = this.overlay.querySelector('[data-shader-debug-intensity]');
    this.shaderDebugIntensityValue = this.overlay.querySelector('[data-shader-debug-intensity-value]');
    this.shaderDebugIntensityReset = this.overlay.querySelector('[data-shader-debug-intensity-reset]');
    this.shaderDebugList = this.overlay.querySelector('[data-shader-debug-list]');
    this.combatRoot = this.overlay.querySelector('[data-combat-root]');
    this.combatMeter = this.overlay.querySelector('[data-combat-meter]');
    this.combatHealthTrail = this.overlay.querySelector('[data-combat-health-trail]');
    this.combatHealthFill = this.overlay.querySelector('[data-combat-health-fill]');
    this.combatHealthBurst = this.overlay.querySelector('[data-combat-health-burst]');
    this.respawnText = this.overlay.querySelector('[data-respawn]');
    this.hitMarker = this.overlay.querySelector('[data-hitmarker]');
    this.zoomControls = this.overlay.querySelector('[data-zoom-controls]');
    this.zoomOutButton = this.overlay.querySelector('[data-zoom-out]');
    this.zoomInButton = this.overlay.querySelector('[data-zoom-in]');
    this.zoomLabel = this.overlay.querySelector('[data-zoom-label]');
    this.zoomHint = this.overlay.querySelector('[data-zoom-hint]');
    this.modeToggle = this.overlay.querySelector('[data-mode-toggle]');
    this.builderRoot = this.overlay.querySelector('[data-builder]');
    this.builderStatus = this.overlay.querySelector('[data-builder-status]');
    this.builderMeta = this.overlay.querySelector('[data-builder-meta]');
    this.builderTabs = this.overlay.querySelector('[data-builder-tabs]');
    this.builderGroups = this.overlay.querySelector('[data-builder-groups]');
    this.builderTiles = this.overlay.querySelector('[data-builder-tiles]');
    this.builderCopy = this.overlay.querySelector('[data-builder-copy]');
    this.builderClose = this.overlay.querySelector('[data-builder-close]');
    this.builderSelection = this.overlay.querySelector('[data-builder-selection]');
    this.builderSelectionRotate = this.overlay.querySelector('[data-builder-selection-rotate]');
    this.builderSelectionDelete = this.overlay.querySelector('[data-builder-selection-delete]');
    this.builderSelectionConfirm = this.overlay.querySelector('[data-builder-selection-confirm]');
    this.builderNpcEditor = this.overlay.querySelector('[data-builder-npc-editor]');
    this.builderNpcModel = this.overlay.querySelector('[data-builder-npc-model]');
    this.builderNpcName = this.overlay.querySelector('[data-builder-npc-name]');
    this.builderNpcRadius = this.overlay.querySelector('[data-builder-npc-radius]');
    this.builderNpcPrompt = this.overlay.querySelector('[data-builder-npc-prompt]');
    this.builderNpcConfirm = this.overlay.querySelector('[data-builder-npc-confirm]');
    this.interactionRoot = this.overlay.querySelector('[data-interaction]');
    this.interactionTitle = this.overlay.querySelector('[data-interaction-title]');
    this.interactionSubtitle = this.overlay.querySelector('[data-interaction-subtitle]');
    this.interactionActions = this.overlay.querySelector('[data-interaction-actions]');
    this.quickChatRoot = this.overlay.querySelector('[data-quick-chat]');
    this.quickChatForm = this.overlay.querySelector('[data-quick-chat-form]');
    this.quickChatInput = this.overlay.querySelector('[data-quick-chat-input]');
    this.quickChatHint = this.overlay.querySelector('[data-quick-chat-hint]');
    this.speechLayer = this.overlay.querySelector('[data-speech-layer]');
    this.emoteMenu = this.overlay.querySelector('[data-emote-menu]');
    this.emoteWheel = this.overlay.querySelector('[data-emote-wheel]');
    this.emoteSelection = this.overlay.querySelector('[data-emote-selection]');
    this.emoteHint = this.overlay.querySelector('[data-emote-hint]');
    this.emoteSliceNodes = [];
    this.speechBubbleNodes = new Map();
    this.aimDebugInputs = new Map();
    this.toastTimeout = 0;
    this.healthTrailFrame = 0;
    this.healthTrailTimeout = 0;
    this.healthHitTimeout = 0;
    this.lastCombatHealthPercent = null;
    this.lastInteractionState = null;
    this.lastNpcEditorState = null;
    this.buildAimPoseDebugFields();
    this.buildEmoteWheel();
  }

  createLoading() {
    const node = document.createElement('div');
    node.className = 'loading';
    node.innerHTML = `
      <div class="loading__card">
        <p class="hud__eyebrow">Booting</p>
        <h1 class="loading__title">Vibe Theft Auto</h1>
        <p class="loading__subtitle">Streaming city blocks, NPCs, and player assets...</p>
      </div>
    `;
    this.root.append(node);
    return node;
  }

  buildEmoteWheel() {
    const markup = EMOTE_SLOTS.map((entry, index) => `
      <div
        class="hud__emote-slice${entry ? ' is-filled' : ' is-empty'}"
        data-emote-slice
        style="--slot-angle:${index * 45}deg"
      >
        <span class="hud__emote-label">${entry?.label ?? ''}</span>
      </div>
    `).join('');

    this.emoteWheel.insertAdjacentHTML('beforeend', markup);
    this.emoteSliceNodes = Array.from(this.emoteWheel.querySelectorAll('[data-emote-slice]'));
  }

  buildAimPoseDebugFields() {
    if (!this.aimDebugFields) {
      return;
    }

    this.aimDebugFields.innerHTML = HELD_ITEM_AIM_POSE_FIELDS.map((field) => `
      <label class="hud__aim-debug-field">
        <span class="hud__aim-debug-label">${field.label}</span>
        <div class="hud__aim-debug-inputs">
          <input
            class="hud__aim-debug-range"
            type="range"
            min="${field.min}"
            max="${field.max}"
            step="${field.step}"
            value="0"
            data-aim-debug-input="${field.key}"
            data-aim-debug-kind="range"
          />
          <input
            class="hud__field-control hud__aim-debug-number"
            type="number"
            min="${field.min}"
            max="${field.max}"
            step="${field.step}"
            value="0"
            data-aim-debug-input="${field.key}"
            data-aim-debug-kind="number"
          />
        </div>
      </label>
    `).join('');

    this.aimDebugInputs.clear();
    for (const field of HELD_ITEM_AIM_POSE_FIELDS) {
      this.aimDebugInputs.set(field.key, {
        range: this.aimDebugFields.querySelector(`[data-aim-debug-input="${field.key}"][data-aim-debug-kind="range"]`),
        number: this.aimDebugFields.querySelector(`[data-aim-debug-input="${field.key}"][data-aim-debug-kind="number"]`)
      });
    }
  }

  createOverlay() {
    const node = document.createElement('div');
    node.className = 'hud';
    node.innerHTML = `
      <section class="hud__panel">
        <div class="hud__controls-list">
          ${getHudControlsMarkup()}
        </div>
      </section>
      <section class="hud__combat" data-combat-root role="progressbar" aria-label="Health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
        <div class="hud__combat-meter" data-combat-meter aria-hidden="true">
          <div class="hud__combat-meter-trail" data-combat-health-trail></div>
          <div class="hud__combat-meter-fill" data-combat-health-fill></div>
          <div class="hud__combat-meter-burst" data-combat-health-burst></div>
        </div>
      </section>
      <div class="hud__top-actions">
        <button
          class="hud__shader-debug-toggle"
          type="button"
          data-shader-debug-toggle
          aria-label="Toggle shader vibe menu"
          aria-pressed="false"
          title="Show shader vibe menu"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
            <path d="M18.5 13.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" />
            <path d="M5.5 14.5l1.1 2.4 2.4 1.1-2.4 1.1L5.5 21l-1.1-2.4L2 17.5l2.4-1.1 1.1-2.4z" />
          </svg>
        </button>
        <button
          class="hud__aim-debug-toggle"
          type="button"
          data-aim-debug-toggle
          aria-label="Toggle Aim Pose debug"
          aria-pressed="false"
          title="Show Aim Pose debug"
          hidden
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="8" />
            <path d="M12 2v3" />
            <path d="M12 19v3" />
            <path d="M2 12h3" />
            <path d="M19 12h3" />
          </svg>
        </button>
        <button class="hud__mode-toggle" type="button" data-mode-toggle aria-label="Toggle world edit mode" title="Enter world edit mode">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.5 3.5l6 6" />
            <path d="M13 5l4.5-1.5-1.5 4.5" />
            <path d="M4.5 19.5l7.7-7.7 3.5 3.5L8 23H4.5v-3.5z" />
            <path d="M9.5 14.5l3.5 3.5" />
          </svg>
        </button>
      </div>
      <section class="hud__shader-debug" data-shader-debug hidden>
        <div class="hud__shader-debug-header">
          <div>
            <p class="hud__eyebrow">Shader Vibes</p>
            <p class="hud__body hud__shader-debug-status" data-shader-debug-status>Default render pipeline active.</p>
          </div>
          <button class="hud__builder-icon-button" type="button" data-shader-debug-close aria-label="Close shader vibe menu" title="Close shader vibe menu">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="hud__shader-debug-controls">
          <label class="hud__shader-debug-intensity">
            <span class="hud__shader-debug-intensity-label">Intensity</span>
            <div class="hud__shader-debug-intensity-row">
              <input
                class="hud__shader-debug-intensity-range"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value="1"
                data-shader-debug-intensity
              />
              <span class="hud__shader-debug-intensity-value" data-shader-debug-intensity-value>100%</span>
            </div>
          </label>
          <button class="hud__builder-icon-button hud__shader-debug-reset" type="button" data-shader-debug-intensity-reset title="Reset active vibe intensity">Reset</button>
        </div>
        <div class="hud__shader-debug-list" data-shader-debug-list></div>
      </section>
      <section class="hud__toast">
        <p class="hud__toast-text" data-toast></p>
      </section>
      <section class="hud__aim-debug" data-aim-debug hidden>
        <div class="hud__aim-debug-header">
          <div>
            <p class="hud__eyebrow">Aim Pose Debug</p>
            <p class="hud__body hud__aim-debug-status" data-aim-debug-status>Hold right click to preview the live aim pose.</p>
          </div>
          <div class="hud__aim-debug-actions">
            <button class="hud__builder-icon-button" type="button" data-aim-debug-bones title="Toggle skeleton helper">Bones</button>
            <button class="hud__builder-icon-button" type="button" data-aim-debug-print title="Print current pose">Print</button>
            <button class="hud__builder-icon-button" type="button" data-aim-debug-reset title="Reset aim pose overrides">Reset</button>
          </div>
        </div>
        <div class="hud__aim-debug-fields" data-aim-debug-fields></div>
      </section>
      <section class="hud__prompt">
        <span class="hud__key">E</span>
        <span class="hud__prompt-text" data-prompt></span>
      </section>
      <section class="hud__builder" data-builder hidden>
        <div class="hud__builder-header">
          <div>
            <p class="hud__eyebrow">World Builder</p>
            <p class="hud__body" data-builder-status>Use the hammer button to enter builder mode.</p>
            <p class="hud__body hud__builder-meta" data-builder-meta></p>
          </div>
          <div class="hud__builder-actions">
            <button class="hud__builder-action hud__builder-copy" type="button" data-builder-copy>Copy Layout JSON</button>
            <button class="hud__builder-icon-button" type="button" data-builder-close aria-label="Close world builder" title="Close world builder">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
        <div class="hud__builder-tabs" data-builder-tabs></div>
        <div class="hud__builder-subtabs" data-builder-groups></div>
        <div class="hud__builder-scroll">
          <div class="hud__builder-grid" data-builder-tiles></div>
          <section class="hud__builder-editor" data-builder-npc-editor>
            <p class="hud__eyebrow">NPC Editor</p>
            <label class="hud__field">
              <span class="hud__field-label">Model</span>
              <select class="hud__field-control" data-builder-npc-model></select>
            </label>
            <label class="hud__field">
              <span class="hud__field-label">Name</span>
              <input class="hud__field-control" type="text" maxlength="40" data-builder-npc-name />
            </label>
            <label class="hud__field">
              <span class="hud__field-label">Interact Radius</span>
              <input class="hud__field-control" type="number" min="1.5" max="12" step="0.1" data-builder-npc-radius />
            </label>
            <label class="hud__field">
              <span class="hud__field-label">Prompt</span>
              <textarea class="hud__field-control hud__field-control--textarea" rows="5" data-builder-npc-prompt></textarea>
            </label>
            <button class="hud__builder-action hud__builder-confirm" type="button" data-builder-npc-confirm>Confirm NPC</button>
          </section>
        </div>
      </section>
      <section class="hud__interaction" data-interaction>
        <p class="hud__eyebrow">Interaction</p>
        <h2 class="hud__dialog-title" data-interaction-title></h2>
        <p class="hud__body" data-interaction-subtitle></p>
        <div class="hud__dialog-actions" data-interaction-actions></div>
      </section>
      <form class="hud__quick-chat" data-quick-chat data-quick-chat-form>
        <span class="hud__key">Enter</span>
        <input class="hud__field-control hud__quick-chat-input" type="text" maxlength="280" data-quick-chat-input placeholder="Say something..." />
        <p class="hud__quick-chat-hint" data-quick-chat-hint>Enter to send. Escape to cancel.</p>
      </form>
      <section class="hud__speech-layer" data-speech-layer></section>
      <p class="hud__respawn" data-respawn></p>
      <div class="hud__hitmarker" data-hitmarker></div>
      <section class="hud__emote-menu" data-emote-menu>
        <div class="hud__emote-wheel" data-emote-wheel>
          <div class="hud__emote-selection" data-emote-selection></div>
        </div>
        <p class="hud__emote-hint" data-emote-hint>Hold B, push the cursor into a slice, release B to emote.</p>
      </section>
      <section class="hud__selection" data-builder-selection>
        <div class="hud__selection-actions">
          <button class="hud__selection-icon-button" type="button" data-builder-selection-rotate aria-label="Rotate selected piece" title="Rotate selected piece">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11a8 8 0 1 1-2.34-5.66" />
              <path d="M20 4v6h-6" />
            </svg>
          </button>
          <button class="hud__selection-icon-button hud__selection-delete" type="button" data-builder-selection-delete aria-label="Delete selected piece" title="Delete selected piece">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M9 7V4h6v3" />
              <path d="M7 7l1 12h8l1-12" />
              <path d="M10 11v5" />
              <path d="M14 11v5" />
            </svg>
          </button>
          <button class="hud__selection-icon-button hud__selection-confirm" type="button" data-builder-selection-confirm aria-label="Close selection menu" title="Close selection menu">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5l4.2 4.2L19 7" />
            </svg>
          </button>
        </div>
      </section>
    `;
    this.root.append(node);
    return node;
  }

  hideLoading() {
    this.loading.classList.add('is-hidden');
  }

  isElementInteractive(element) {
    return Boolean(element) && !element.hidden && element.classList.contains('is-visible');
  }

  setPrompt(interactable) {
    const prompt = this.overlay.querySelector('.hud__prompt');
    if (!interactable) {
      prompt.classList.remove('is-visible');
      this.promptText.textContent = '';
      return;
    }

    this.promptText.textContent = interactable.prompt;
    prompt.classList.add('is-visible');
  }

  showToast(message) {
    const toast = this.overlay.querySelector('.hud__toast');
    this.toastText.textContent = message;
    toast.classList.add('is-visible');

    window.clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  bindAimPoseDebugEvents({
    onTogglePanel,
    onFieldChange,
    onReset,
    onPrint,
    onToggleBones
  }) {
    this.aimDebugToggle?.addEventListener('click', () => {
      onTogglePanel();
    });

    this.aimDebugFields?.addEventListener('input', (event) => {
      if (!this.isElementInteractive(this.aimDebugRoot)) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      const fieldKey = target.dataset.aimDebugInput;
      if (!fieldKey) {
        return;
      }

      onFieldChange(fieldKey, Number(target.value));
    });

    this.aimDebugReset?.addEventListener('click', () => {
      if (!this.isElementInteractive(this.aimDebugRoot)) {
        return;
      }

      onReset();
    });

    this.aimDebugPrint?.addEventListener('click', () => {
      if (!this.isElementInteractive(this.aimDebugRoot)) {
        return;
      }

      onPrint();
    });

    this.aimDebugBoneToggle?.addEventListener('click', () => {
      if (!this.isElementInteractive(this.aimDebugRoot)) {
        return;
      }

      onToggleBones();
    });
  }

  bindShaderDebugEvents({
    onToggleMenu,
    onCloseMenu,
    onSelectPreset,
    onSetIntensity,
    onResetIntensity
  }) {
    this.shaderDebugToggle?.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });

    this.shaderDebugToggle?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggleMenu();
    });

    this.shaderDebugClose?.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.shaderDebugRoot)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onCloseMenu();
    });

    this.shaderDebugList?.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.shaderDebugRoot)) {
        return;
      }

      event.stopPropagation();
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const button = target?.closest('[data-shader-preset]');
      if (!button) {
        return;
      }

      onSelectPreset(button.dataset.shaderPreset);
    });

    this.shaderDebugIntensity?.addEventListener('input', (event) => {
      if (!this.isElementInteractive(this.shaderDebugRoot)) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      onSetIntensity(Number(target.value));
    });

    this.shaderDebugIntensityReset?.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.shaderDebugRoot)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onResetIntensity();
    });
  }

  bindZoomEvents({ onZoomIn, onZoomOut }) {
    this.zoomInButton?.addEventListener('click', () => {
      onZoomIn();
    });

    this.zoomOutButton?.addEventListener('click', () => {
      onZoomOut();
    });
  }

  bindBuilderEvents({
    onToggleBuildMode,
    onSelectCategory,
    onSelectGroup,
    onSelectTile,
    onCopyLayout,
    onRotateSelection,
    onDeleteSelection,
    onConfirmSelection,
    onNpcNameChange,
    onNpcPromptChange,
    onNpcRadiusChange,
    onNpcModelChange,
    onConfirmNpc
  }) {
    this.modeToggle.addEventListener('click', () => {
      onToggleBuildMode();
    });

    this.builderTabs.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.builderRoot)) {
        return;
      }

      const button = event.target.closest('[data-builder-category]');
      if (!button) {
        return;
      }
      onSelectCategory(button.dataset.builderCategory);
    });

    this.builderGroups.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.builderRoot)) {
        return;
      }

      const button = event.target.closest('[data-builder-group]');
      if (!button) {
        return;
      }
      onSelectGroup(button.dataset.builderGroup);
    });

    this.builderTiles.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.builderRoot)) {
        return;
      }

      const button = event.target.closest('[data-builder-index]');
      if (!button) {
        return;
      }
      onSelectTile(Number(button.dataset.builderIndex));
    });

    this.builderCopy.addEventListener('click', () => {
      if (!this.isElementInteractive(this.builderRoot)) {
        return;
      }

      onCopyLayout();
    });

    this.builderClose.addEventListener('click', () => {
      if (!this.isElementInteractive(this.builderRoot)) {
        return;
      }

      onToggleBuildMode();
    });

    this.builderSelectionRotate.addEventListener('click', () => {
      onRotateSelection();
    });

    this.builderSelectionDelete.addEventListener('click', () => {
      onDeleteSelection();
    });

    this.builderSelectionConfirm.addEventListener('click', () => {
      onConfirmSelection();
    });

    this.builderNpcName.addEventListener('input', () => {
      onNpcNameChange(this.builderNpcName.value);
    });

    this.builderNpcPrompt.addEventListener('input', () => {
      onNpcPromptChange(this.builderNpcPrompt.value);
    });

    this.builderNpcRadius.addEventListener('input', () => {
      onNpcRadiusChange(Number(this.builderNpcRadius.value));
    });

    this.builderNpcModel.addEventListener('change', () => {
      onNpcModelChange(this.builderNpcModel.value);
    });

    this.builderNpcConfirm.addEventListener('click', () => {
      onConfirmNpc();
    });
  }

  bindInteractionEvents({ onAction, onCloseInteraction }) {
    this.interactionActions.addEventListener('click', (event) => {
      const button = event.target.closest('[data-interaction-action]');
      if (!button) {
        return;
      }
      onAction(button.dataset.interactionAction);
    });

    this.interactionRoot.addEventListener('click', (event) => {
      if (event.target === this.interactionRoot) {
        onCloseInteraction();
      }
    });
  }

  bindQuickChatEvents({ onSubmit, onCancel }) {
    this.quickChatForm.addEventListener('submit', (event) => {
      event.preventDefault();
      onSubmit(this.quickChatInput.value);
    });

    this.quickChatInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      onCancel();
    });
  }

  setBuilderState({
    enabled,
    statusText,
    metaText,
    tabs = [],
    groupTabs = [],
    sections = []
  }) {
    this.builderRoot.hidden = !enabled;
    this.builderRoot.classList.toggle('is-visible', enabled);
    this.modeToggle.classList.toggle('is-active', enabled);
    this.modeToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    this.modeToggle.title = enabled ? 'Return to player mode' : 'Enter world edit mode';
    this.builderStatus.textContent = statusText;
    this.builderMeta.textContent = metaText;

    this.builderTabs.innerHTML = tabs.map((tab) => `
      <button
        class="hud__builder-chip${tab.active ? ' is-active' : ''}"
        type="button"
        data-builder-category="${tab.id}"
      >
        <span>${tab.label}</span>
        <span class="hud__builder-chip-count">${tab.count}</span>
      </button>
    `).join('');

    this.builderGroups.innerHTML = groupTabs.map((group) => `
        <button
          class="hud__builder-subchip${group.active ? ' is-active' : ''}"
          type="button"
          data-builder-group="${group.id}"
        >
          <span>${group.label}</span>
          <span class="hud__builder-chip-count">${group.count ?? 0}</span>
        </button>
      `).join('');

    this.builderTiles.innerHTML = sections.map((section) => `
      <section class="hud__builder-section">
        <div class="hud__builder-section-header">
          <p class="hud__builder-section-title">${section.label}</p>
          <span class="hud__builder-section-count">${section.count}</span>
        </div>
        <div class="hud__builder-card-grid">
          ${section.cards.map((card) => {
            const preview = this.builderPreviewImages.get(card.previewId);
            return `
              <button
                class="hud__builder-card${card.selected ? ' is-active' : ''}"
                type="button"
                data-builder-index="${card.sourceIndex}"
              >
                ${card.shortcut ? `<span class="hud__builder-key hud__builder-card-key">${card.shortcut}</span>` : ''}
                <span class="hud__builder-thumb" data-builder-preview="${card.previewId}">
                  ${preview
                    ? `<img class="hud__builder-thumb-image" src="${preview}" alt="${card.label}" loading="lazy" />`
                    : `<span class="hud__builder-thumb-placeholder">${getBuilderPlaceholder(card.label)}</span>`}
                </span>
                <span class="hud__builder-card-copy">
                  <span class="hud__builder-card-title">${card.label}</span>
                </span>
              </button>
            `;
          }).join('')}
        </div>
      </section>
    `).join('');
  }

  setBuilderPreviewImage(itemId, src) {
    if (!itemId || !src) {
      return;
    }

    this.builderPreviewImages.set(itemId, src);

    const node = this.builderTiles.querySelector(`[data-builder-preview="${itemId}"]`);
    if (!node) {
      return;
    }

    node.innerHTML = `<img class="hud__builder-thumb-image" src="${src}" alt="" loading="lazy" />`;
  }

  setBuilderSelection(selection) {
    const node = this.builderSelection;
    if (!selection) {
      node.classList.remove('is-visible');
      return;
    }

    node.classList.add('is-visible');
    node.style.left = `${selection.screenX}px`;
    node.style.top = `${selection.screenY}px`;
  }

  setBuilderNpcEditor(editorState) {
    if (!editorState) {
      this.lastNpcEditorState = null;
      this.builderNpcEditor.classList.remove('is-visible');
      return;
    }

    this.builderNpcEditor.classList.add('is-visible');

    const modelsChanged = this.lastNpcEditorState?.models?.length !== editorState.models.length
      || this.lastNpcEditorState?.models?.some((entry, index) => entry.id !== editorState.models[index].id);

    if (modelsChanged) {
      this.builderNpcModel.innerHTML = editorState.models.map((model) => `
        <option value="${model.id}">${model.label}</option>
      `).join('');
    }

    if (document.activeElement !== this.builderNpcModel) {
      this.builderNpcModel.value = editorState.modelId;
    }
    setFieldValue(this.builderNpcName, editorState.name);
    setFieldValue(this.builderNpcRadius, String(editorState.interactRadius));
    setFieldValue(this.builderNpcPrompt, editorState.prompt);
    this.builderNpcConfirm.disabled = editorState.active;
    this.builderNpcConfirm.textContent = editorState.active ? 'NPC Active' : 'Confirm NPC';

    this.lastNpcEditorState = structuredClone(editorState);
  }

  showInteractionMenu({ title, subtitle, actions }) {
    this.lastInteractionState = { title, subtitle, actions };
    this.interactionTitle.textContent = title;
    this.interactionSubtitle.textContent = subtitle;
    this.interactionActions.innerHTML = actions.map((action) => `
      <button
        class="hud__dialog-button${action.primary ? ' is-primary' : ''}"
        type="button"
        data-interaction-action="${action.id}"
        ${action.disabled ? 'disabled' : ''}
      >
        ${action.label}
      </button>
    `).join('');
    this.interactionRoot.classList.add('is-visible');
  }

  hideInteractionMenu() {
    this.lastInteractionState = null;
    this.interactionRoot.classList.remove('is-visible');
  }

  setQuickChatState({ visible, disabled = false, hint = 'Enter to send. Escape to cancel.' }) {
    this.quickChatRoot.classList.toggle('is-visible', visible);
    this.quickChatInput.disabled = disabled;
    this.quickChatHint.textContent = hint;
  }

  clearQuickChatInput() {
    this.quickChatInput.value = '';
  }

  focusQuickChatInput() {
    this.quickChatInput.focus();
    this.quickChatInput.select();
  }

  blurQuickChatInput() {
    this.quickChatInput.blur();
  }

  isQuickChatOpen() {
    return this.quickChatRoot.classList.contains('is-visible');
  }

  syncCombatTrail(healthPercent) {
    if (!this.combatHealthTrail) {
      return;
    }

    window.cancelAnimationFrame(this.healthTrailFrame);
    this.combatHealthTrail.style.transition = 'none';
    this.combatHealthTrail.style.width = `${healthPercent}%`;
    this.combatHealthTrail.style.opacity = '0';
    this.combatHealthTrail.style.transform = 'translateY(0)';
    void this.combatHealthTrail.offsetWidth;
    this.combatHealthTrail.style.transition = '';
  }

  triggerCombatHitAnimation() {
    window.clearTimeout(this.healthHitTimeout);
    this.combatRoot.classList.remove('is-hit');
    void this.combatRoot.offsetWidth;
    this.combatRoot.classList.add('is-hit');
    this.healthHitTimeout = window.setTimeout(() => {
      this.combatRoot.classList.remove('is-hit');
    }, 380);
  }

  spawnCombatHealthSparks(previousPercent, healthPercent) {
    if (!this.combatMeter || !this.combatHealthBurst) {
      return;
    }

    const lostPercent = previousPercent - healthPercent;
    if (lostPercent <= 0.5) {
      return;
    }

    const meterBounds = this.combatMeter.getBoundingClientRect();
    const meterWidth = meterBounds.width;
    const meterHeight = meterBounds.height;
    const anchorX = meterWidth * (healthPercent / 100);
    const sparkCount = Math.min(16, Math.max(6, Math.round(lostPercent / 2.4)));

    for (let index = 0; index < sparkCount; index += 1) {
      const spark = document.createElement('span');
      const angle = Math.random() * Math.PI * 2;
      const distance = 24 + Math.random() * 42;
      const midDistance = distance * (0.38 + Math.random() * 0.2);
      const endDistance = distance * (0.95 + Math.random() * 0.3);
      const driftX = Math.cos(angle) * endDistance;
      const driftY = (Math.sin(angle) * endDistance) + (6 + Math.random() * 18);
      const midX = Math.cos(angle) * midDistance;
      const midY = Math.sin(angle) * midDistance;
      const angleDeg = ((angle * 180) / Math.PI).toFixed(2);
      const duration = 420 + Math.random() * 220;
      const length = 14 + Math.random() * 18;
      const thickness = 2 + Math.random() * 2.2;
      const scaleEnd = (0.24 + Math.random() * 0.3).toFixed(2);
      const flareScale = (0.85 + Math.random() * 0.9).toFixed(2);
      const brightness = (0.92 + Math.random() * 0.32).toFixed(2);

      spark.className = 'hud__combat-spark';
      spark.style.left = `${anchorX}px`;
      spark.style.top = `${(meterHeight * 0.5) + ((Math.random() - 0.5) * 8)}px`;
      spark.style.width = `${length}px`;
      spark.style.height = `${thickness}px`;
      spark.style.setProperty('--spark-mid-x', `${midX}px`);
      spark.style.setProperty('--spark-mid-y', `${midY}px`);
      spark.style.setProperty('--spark-x', `${driftX}px`);
      spark.style.setProperty('--spark-y', `${driftY}px`);
      spark.style.setProperty('--spark-angle', `${angleDeg}deg`);
      spark.style.setProperty('--spark-scale-end', scaleEnd);
      spark.style.setProperty('--spark-flare-scale', flareScale);
      spark.style.setProperty('--spark-brightness', brightness);
      spark.style.setProperty('--spark-duration', `${duration}ms`);
      spark.style.animationDelay = `${index * 12}ms`;
      this.combatHealthBurst.append(spark);
      spark.addEventListener('animationend', () => {
        spark.remove();
      }, { once: true });
    }
  }

  animateCombatHealthDrop(previousPercent, healthPercent) {
    if (!this.combatHealthTrail) {
      return;
    }

    window.clearTimeout(this.healthTrailTimeout);
    window.cancelAnimationFrame(this.healthTrailFrame);
    this.combatHealthTrail.style.transition = 'none';
    this.combatHealthTrail.style.width = `${previousPercent}%`;
    this.combatHealthTrail.style.opacity = '0.96';
    this.combatHealthTrail.style.transform = 'translateY(0)';
    void this.combatHealthTrail.offsetWidth;
    this.combatHealthTrail.style.transition = '';
    this.healthTrailFrame = window.requestAnimationFrame(() => {
      this.combatHealthTrail.style.width = `${healthPercent}%`;
      this.combatHealthTrail.style.opacity = '0';
      this.combatHealthTrail.style.transform = 'translateY(12px)';
    });
    this.triggerCombatHitAnimation();
    this.spawnCombatHealthSparks(previousPercent, healthPercent);

    this.healthTrailTimeout = window.setTimeout(() => {
      this.syncCombatTrail(healthPercent);
    }, 760);
  }

  setCombatState({
    visible = true,
    health = 100,
    maxHealth = 100,
    ammoInClip = 0,
    reserveAmmo = 0,
    isReloading = false,
    reloadEndsAt = 0,
    alive = true,
    respawnAt = 0,
    kills = 0,
    deaths = 0,
    armed = false
  } = {}) {
    this.combatRoot.hidden = !visible;
    if (!visible) {
      this.lastCombatHealthPercent = null;
      this.syncCombatTrail(0);
      this.respawnText.classList.remove('is-visible');
      return;
    }

    const safeMaxHealth = Math.max(1, maxHealth);
    const healthRatio = Math.min(Math.max(health / safeMaxHealth, 0), 1);
    const healthPercent = Math.round(healthRatio * 100);
    const hue = Math.round(healthRatio * 120);
    const startHue = Math.max(0, hue - 18);
    const endHue = Math.min(120, hue + 8);
    const currentHealth = Math.max(0, Math.min(health, safeMaxHealth));
    const previousPercent = this.lastCombatHealthPercent ?? healthPercent;
    const tookDamage = healthPercent < previousPercent;

    this.combatRoot.classList.toggle('is-critical', alive && healthRatio <= 0.28);
    this.combatRoot.classList.toggle('is-down', !alive);
    this.combatRoot.style.setProperty('--health-hue-start', `${startHue}`);
    this.combatRoot.style.setProperty('--health-hue-end', `${endHue}`);
    this.combatRoot.style.setProperty('--health-ratio', `${healthRatio}`);
    this.combatHealthFill.style.width = `${healthPercent}%`;
    this.combatHealthFill.style.background = alive
      ? `linear-gradient(90deg, hsl(${startHue} 78% 34%), hsl(${hue} 88% 44%) 55%, hsl(${endHue} 84% 56%))`
      : 'linear-gradient(90deg, hsl(0 48% 28%), hsl(0 58% 40%))';
    this.combatRoot.setAttribute('aria-valuemax', `${safeMaxHealth}`);
    this.combatRoot.setAttribute('aria-valuenow', `${currentHealth}`);
    this.combatRoot.setAttribute('aria-valuetext', `${health} of ${maxHealth}`);
    this.combatRoot.title = `${health} / ${maxHealth}`;
    if (tookDamage) {
      this.animateCombatHealthDrop(previousPercent, healthPercent);
    } else {
      this.syncCombatTrail(healthPercent);
    }
    this.lastCombatHealthPercent = healthPercent;

    if (!alive) {
      const seconds = Math.max(0, Math.ceil((respawnAt - Date.now()) / 1000));
      this.respawnText.textContent = seconds > 0 ? `Respawning in ${seconds}s` : 'Respawning...';
      this.respawnText.classList.add('is-visible');
      return;
    }

    this.respawnText.classList.remove('is-visible');
  }

  setHitMarkerVisible(visible) {
    this.hitMarker.classList.toggle('is-visible', visible);
  }

  setZoomState({
    label = '100%',
    hint = 'Wheel / +/-',
    disabled = false,
    canZoomIn = true,
    canZoomOut = true
  } = {}) {
    if (!this.zoomControls || !this.zoomLabel || !this.zoomHint) {
      return;
    }

    this.zoomLabel.textContent = label;
    this.zoomHint.textContent = hint;
    this.zoomControls?.classList.toggle('is-disabled', disabled);

    if (this.zoomInButton) {
      this.zoomInButton.disabled = disabled || !canZoomIn;
    }

    if (this.zoomOutButton) {
      this.zoomOutButton.disabled = disabled || !canZoomOut;
    }
  }

  setAimPoseDebugState({
    available = false,
    visible = false,
    statusText = '',
    showSkeleton = false,
    values = {}
  } = {}) {
    if (!this.aimDebugRoot) {
      return;
    }

    if (this.aimDebugToggle) {
      this.aimDebugToggle.hidden = !available;
      this.aimDebugToggle.classList.toggle('is-active', visible);
      this.aimDebugToggle.setAttribute('aria-pressed', visible ? 'true' : 'false');
      this.aimDebugToggle.title = visible ? 'Hide Aim Pose debug' : 'Show Aim Pose debug';
    }

    this.aimDebugRoot.hidden = !visible;
    this.aimDebugRoot.classList.toggle('is-visible', visible);
    this.aimDebugStatus.textContent = statusText;
    this.aimDebugBoneToggle.classList.toggle('is-active', showSkeleton);
    this.aimDebugBoneToggle.setAttribute('aria-pressed', showSkeleton ? 'true' : 'false');

    for (const field of HELD_ITEM_AIM_POSE_FIELDS) {
      const value = Number(values?.[field.key] ?? 0);
      const formattedValue = Number.isFinite(value) ? value.toFixed(2) : '0.00';
      const inputs = this.aimDebugInputs.get(field.key);
      setFieldValue(inputs?.range, formattedValue);
      setFieldValue(inputs?.number, formattedValue);
    }
  }

  setShaderDebugState({
    visible = false,
    activePresetId = '',
    statusText = '',
    presets = [],
    intensity = 1,
    intensityEnabled = false
  } = {}) {
    if (!this.shaderDebugRoot) {
      return;
    }

    this.shaderDebugRoot.hidden = !visible;
    this.shaderDebugRoot.classList.toggle('is-visible', visible);
    this.shaderDebugStatus.textContent = statusText;

    if (this.shaderDebugToggle) {
      this.shaderDebugToggle.hidden = false;
      const highlightToggle = visible || (activePresetId && activePresetId !== 'default');
      this.shaderDebugToggle.classList.toggle('is-active', highlightToggle);
      this.shaderDebugToggle.setAttribute('aria-pressed', visible ? 'true' : 'false');
      this.shaderDebugToggle.title = visible ? 'Hide shader vibe menu' : 'Show shader vibe menu';
    }

    const clampedIntensity = Math.max(0, Math.min(1, Number.isFinite(intensity) ? intensity : 1));
    if (this.shaderDebugIntensity instanceof HTMLInputElement) {
      setFieldValue(this.shaderDebugIntensity, clampedIntensity.toFixed(2));
      this.shaderDebugIntensity.disabled = !intensityEnabled;
    }
    if (this.shaderDebugIntensityValue) {
      this.shaderDebugIntensityValue.textContent = `${Math.round(clampedIntensity * 100)}%`;
      this.shaderDebugIntensityValue.classList.toggle('is-disabled', !intensityEnabled);
    }
    this.shaderDebugIntensityReset?.toggleAttribute('disabled', !intensityEnabled);

    this.shaderDebugList.innerHTML = presets.map((preset) => {
      const active = preset.id === activePresetId;
      return `
        <button
          class="hud__shader-debug-card${active ? ' is-active' : ''}"
          type="button"
          data-shader-preset="${preset.id}"
        >
          <span class="hud__shader-debug-card-top">
            <strong class="hud__shader-debug-card-title">${preset.label}</strong>
            <span class="hud__shader-debug-card-tag">${active ? 'Live' : 'Switch'}</span>
          </span>
          <span class="hud__shader-debug-card-copy">${preset.description}</span>
        </button>
      `;
    }).join('');
  }

  setSpeechBubbles(bubbles = []) {
    const activeIds = new Set();

    for (const bubble of bubbles) {
      if (!bubble?.id || !bubble.visible) {
        continue;
      }

      activeIds.add(bubble.id);
      let node = this.speechBubbleNodes.get(bubble.id);
      if (!node) {
        node = document.createElement('article');
        node.className = 'hud__speech-bubble';

        const label = document.createElement('p');
        label.className = 'hud__speech-label';

        const text = document.createElement('p');
        text.className = 'hud__speech-text';

        node.append(label, text);
        this.speechLayer.append(node);
        this.speechBubbleNodes.set(bubble.id, node);
      }

      node.classList.toggle('is-self', bubble.variant === 'self');
      node.classList.toggle('is-npc', bubble.variant === 'npc');
      node.classList.toggle('is-player', bubble.variant === 'player');
      node.classList.toggle('is-thinking', bubble.status === 'thinking');
      node.style.left = `${bubble.screenX}px`;
      node.style.top = `${bubble.screenY}px`;

      const [labelNode, textNode] = node.children;
      labelNode.textContent = bubble.label ?? '';
      labelNode.hidden = !bubble.label;
      textNode.textContent = bubble.status === 'thinking' ? '' : (bubble.text ?? '');
    }

    for (const [id, node] of this.speechBubbleNodes.entries()) {
      if (activeIds.has(id)) {
        continue;
      }

      node.remove();
      this.speechBubbleNodes.delete(id);
    }
  }

  setEmoteMenuState({ open, activeIndex = -1, selectedLabel = '', hasSelection = false }) {
    this.emoteMenu.classList.toggle('is-visible', open);

    if (!open) {
      this.emoteSliceNodes.forEach((node) => node.classList.remove('is-active'));
      this.emoteSelection.classList.remove('is-visible');
      this.emoteSelection.style.setProperty('--emote-angle', '0deg');
      this.emoteHint.textContent = 'Hold B, push the cursor into a slice, release B to emote.';
      return;
    }

    this.emoteSliceNodes.forEach((node, index) => {
      node.classList.toggle('is-active', index === activeIndex && hasSelection);
    });
    this.emoteSelection.classList.toggle('is-visible', hasSelection);
    this.emoteSelection.style.setProperty('--emote-angle', `${Math.max(activeIndex, 0) * 45}deg`);

    this.emoteHint.textContent = hasSelection
      ? `Release B to play ${selectedLabel}.`
      : 'Move farther from center to choose an emote.';
  }
}
