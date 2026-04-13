import { EMOTE_SLOTS } from '../player/emotes.js';
import { HELD_ITEM_AIM_POSE_FIELDS } from '../shared/heldItemDefinitions.js';

const POSE_DEBUG_EXTRA_FIELDS = Object.freeze([
  Object.freeze({
    key: 'punchAimYawOffset',
    label: 'Punch Facing Offset',
    min: -1,
    max: 1,
    step: 0.01
  })
]);

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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatNpcStepLabel(type) {
  switch (type) {
    case 'travelToPlacement':
      return 'Travel';
    case 'usePlacement':
      return 'Use Spot';
    case 'loiterNearPlacement':
      return 'Loiter';
    case 'enterHideAtPlacement':
      return 'Hide Inside';
    case 'wanderNearPlacement':
      return 'Wander';
    default:
      return 'Step';
  }
}

function getNpcRoutineEditorSignature(editorState) {
  if (!editorState) {
    return '';
  }

  return JSON.stringify({
    stepTypes: (editorState.stepTypes ?? []).map((entry) => ({
      id: entry.id,
      label: entry.label
    })),
    steps: (editorState.routine?.steps ?? []).map((step) => ({
      type: step.type,
      targetPlacementId: step.targetPlacementId ?? '',
      durationMs: step.durationMs ?? '',
      hiddenDurationMs: step.hiddenDurationMs ?? '',
      radius: step.radius ?? '',
      warning: step.warning ?? '',
      pickModeActive: step.pickModeActive === true,
      targetOptions: (step.targetOptions ?? []).map((option) => ({
        id: option.id,
        label: option.label
      }))
    }))
  });
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

const BUILDER_PANEL_DEFAULT_WIDTH = 620;
const BUILDER_PANEL_MIN_WIDTH = 320;
const BUILDER_PANEL_MAX_WIDTH = 860;
const BUILDER_PANEL_MOBILE_BREAKPOINT = 900;

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
    this.builderPreviewLoadPromises = new Map();
    this.builderPreviewFailedIds = new Set();
    this.loading = this.createLoading();
    this.overlay = this.createOverlay();
    this.joinTitle = this.overlay.querySelector('[data-join-title]');
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
    this.adminPositionRoot = this.overlay.querySelector('[data-admin-position]');
    this.adminPositionValue = this.overlay.querySelector('[data-admin-position-value]');
    this.adminPositionHint = this.overlay.querySelector('[data-admin-position-hint]');
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
    this.characterSelectorRoot = this.overlay.querySelector('[data-character-selector]');
    this.characterSelectorToggle = this.overlay.querySelector('[data-character-selector-toggle]');
    this.characterSelectorClose = this.overlay.querySelector('[data-character-selector-close]');
    this.characterSelectorName = this.overlay.querySelector('[data-character-selector-name]');
    this.characterSelectorSubtitle = this.overlay.querySelector('[data-character-selector-subtitle]');
    this.characterSelectorStatus = this.overlay.querySelector('[data-character-selector-status]');
    this.characterSelectorPreview = this.overlay.querySelector('[data-character-preview]');
    this.characterSelectorPrev = this.overlay.querySelector('[data-character-selector-prev]');
    this.characterSelectorNext = this.overlay.querySelector('[data-character-selector-next]');
    this.characterSelectorGrid = this.overlay.querySelector('[data-character-selector-grid]');
    this.modeToggle = this.overlay.querySelector('[data-mode-toggle]');
    this.builderRoot = this.overlay.querySelector('[data-builder]');
    this.builderTabs = this.overlay.querySelector('[data-builder-tabs]');
    this.builderGroups = this.overlay.querySelector('[data-builder-groups]');
    this.builderTiles = this.overlay.querySelector('[data-builder-tiles]');
    this.builderClose = this.overlay.querySelector('[data-builder-close]');
    this.builderResizeHandles = Array.from(this.overlay.querySelectorAll('[data-builder-resize-handle]'));
    this.builderSelection = this.overlay.querySelector('[data-builder-selection]');
    this.builderSelectionMove = this.overlay.querySelector('[data-builder-selection-move]');
    this.builderSelectionRotate = this.overlay.querySelector('[data-builder-selection-rotate]');
    this.builderSelectionDelete = this.overlay.querySelector('[data-builder-selection-delete]');
    this.builderSelectionConfirm = this.overlay.querySelector('[data-builder-selection-confirm]');
    this.builderNpcEditor = this.overlay.querySelector('[data-builder-npc-editor]');
    this.builderNpcEditorClose = this.overlay.querySelector('[data-builder-npc-close]');
    this.builderNpcEditorTitle = this.overlay.querySelector('[data-builder-npc-title]');
    this.builderNpcEditorSubtitle = this.overlay.querySelector('[data-builder-npc-subtitle]');
    this.builderNpcModel = this.overlay.querySelector('[data-builder-npc-model]');
    this.builderNpcName = this.overlay.querySelector('[data-builder-npc-name]');
    this.builderNpcRadius = this.overlay.querySelector('[data-builder-npc-radius]');
    this.builderNpcRespawnDelay = this.overlay.querySelector('[data-builder-npc-respawn-delay]');
    this.builderNpcPrompt = this.overlay.querySelector('[data-builder-npc-prompt]');
    this.builderNpcWarnings = this.overlay.querySelector('[data-builder-npc-warnings]');
    this.builderNpcRoutineSteps = this.overlay.querySelector('[data-builder-npc-routine-steps]');
    this.builderNpcStepAddType = this.overlay.querySelector('[data-builder-npc-step-add-type]');
    this.builderNpcStepAdd = this.overlay.querySelector('[data-builder-npc-step-add]');
    this.builderNpcPickStatus = this.overlay.querySelector('[data-builder-npc-pick-status]');
    this.builderNpcCombatArchetype = this.overlay.querySelector('[data-builder-npc-combat-archetype]');
    this.builderNpcCombatAggroRadius = this.overlay.querySelector('[data-builder-npc-combat-aggro]');
    this.builderNpcCombatLeashField = this.overlay.querySelector('[data-builder-npc-combat-leash-field]');
    this.builderNpcCombatLeashRadius = this.overlay.querySelector('[data-builder-npc-combat-leash]');
    this.builderNpcCombatFleeHealth = this.overlay.querySelector('[data-builder-npc-combat-flee]');
    this.builderNpcCombatWeapon = this.overlay.querySelector('[data-builder-npc-combat-weapon]');
    this.builderNpcConfirm = this.overlay.querySelector('[data-builder-npc-confirm]');
    this.builderNpcDebugSummary = this.overlay.querySelector('[data-builder-npc-debug-summary]');
    this.builderNpcDebugMetrics = this.overlay.querySelector('[data-builder-npc-debug-metrics]');
    this.builderBuildingEditor = this.overlay.querySelector('[data-builder-building-editor]');
    this.builderBuildingEditorClose = this.overlay.querySelector('[data-builder-building-close]');
    this.builderBuildingEditorTitle = this.overlay.querySelector('[data-builder-building-title]');
    this.builderBuildingEditorSubtitle = this.overlay.querySelector('[data-builder-building-subtitle]');
    this.builderBuildingLabel = this.overlay.querySelector('[data-builder-building-label]');
    this.builderBuildingPrompt = this.overlay.querySelector('[data-builder-building-prompt]');
    this.builderBuildingActionText = this.overlay.querySelector('[data-builder-building-action]');
    this.builderBuildingRadius = this.overlay.querySelector('[data-builder-building-radius]');
    this.builderBuildingDistance = this.overlay.querySelector('[data-builder-building-distance]');
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
    this.poseDebugExtraInputs = new Map();
    this.joinTitleTimeout = 0;
    this.toastTimeout = 0;
    this.healthTrailFrame = 0;
    this.healthTrailTimeout = 0;
    this.healthHitTimeout = 0;
    this.lastCombatHealthPercent = null;
    this.lastInteractionState = null;
    this.lastNpcEditorState = null;
    this.lastBuildingEditorState = null;
    this.lastCharacterSelectorSignature = '';
    this.lastAdminPositionSignature = '';
    this.builderAvailable = false;
    this.builderEnabled = false;
    this.builderPanelWidth = BUILDER_PANEL_DEFAULT_WIDTH;
    this.activeBuilderResizePointerId = null;
    this.builderResizeRightEdge = 0;
    this.builderNpcEditorVisible = false;
    this.builderBuildingEditorVisible = false;
    this.onBuilderResizePointerMove = this.onBuilderResizePointerMove.bind(this);
    this.onBuilderResizePointerUp = this.onBuilderResizePointerUp.bind(this);
    this.buildAimPoseDebugFields();
    this.buildEmoteWheel();
    this.initializeBuilderPanelResize();
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

    const extraMarkup = POSE_DEBUG_EXTRA_FIELDS.map((field) => `
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

    const aimPoseMarkup = HELD_ITEM_AIM_POSE_FIELDS.map((field) => `
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

    this.aimDebugFields.innerHTML = `
      <div class="hud__builder-tabs hud__aim-debug-sections" data-aim-debug-sections>
        <button class="hud__builder-chip" type="button" data-aim-debug-section="unarmed">Unarmed Pose</button>
        <button class="hud__builder-chip" type="button" data-aim-debug-section="weaponAim">Weapon Aim Pose</button>
      </div>
      <section class="hud__builder-section" data-aim-debug-section-panel="unarmed">
        <div class="hud__builder-section-header">
          <p class="hud__builder-section-title">Unarmed Pose</p>
        </div>
        <div class="hud__aim-debug-group">${extraMarkup}</div>
      </section>
      <section class="hud__builder-section" data-aim-debug-section-panel="weaponAim">
        <div class="hud__builder-section-header">
          <p class="hud__builder-section-title">Weapon Aim Pose</p>
        </div>
        <div class="hud__aim-debug-group">${aimPoseMarkup}</div>
      </section>
    `;

    this.aimDebugInputs.clear();
    this.poseDebugExtraInputs.clear();
    for (const field of POSE_DEBUG_EXTRA_FIELDS) {
      this.poseDebugExtraInputs.set(field.key, {
        range: this.aimDebugFields.querySelector(`[data-aim-debug-input="${field.key}"][data-aim-debug-kind="range"]`),
        number: this.aimDebugFields.querySelector(`[data-aim-debug-input="${field.key}"][data-aim-debug-kind="number"]`)
      });
    }
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
        <section class="hud__toast">
          <p class="hud__toast-text" data-toast></p>
        </section>
        <div class="hud__top-actions-buttons">
          <button
            class="hud__character-selector-toggle"
            type="button"
            data-character-selector-toggle
            aria-label="Toggle character selector"
            aria-pressed="false"
            title="Choose your character"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4.5c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4z" />
              <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
              <path d="M4 8.5h2.5" />
              <path d="M17.5 8.5H20" />
            </svg>
          </button>
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
            aria-label="Toggle pose debug"
            aria-pressed="false"
            title="Show pose debug"
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
          <button class="hud__mode-toggle" type="button" data-mode-toggle aria-label="Toggle world edit mode" title="Enter world edit mode" hidden>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14.5 3.5l6 6" />
              <path d="M13 5l4.5-1.5-1.5 4.5" />
              <path d="M4.5 19.5l7.7-7.7 3.5 3.5L8 23H4.5v-3.5z" />
              <path d="M9.5 14.5l3.5 3.5" />
            </svg>
          </button>
        </div>
      </div>
      <section class="hud__character-selector" data-character-selector hidden>
        <div class="hud__character-selector-header">
          <div>
            <p class="hud__eyebrow">Character Select</p>
            <h2 class="hud__character-selector-name" data-character-selector-name>Ch08</h2>
            <p class="hud__body hud__character-selector-subtitle" data-character-selector-subtitle>Roster Variant</p>
          </div>
          <button class="hud__builder-icon-button" type="button" data-character-selector-close aria-label="Close character selector" title="Close character selector">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="hud__character-stage-shell">
          <button class="hud__character-nav" type="button" data-character-selector-prev aria-label="Previous character" title="Previous character">
            <span aria-hidden="true">&#8249;</span>
          </button>
          <div class="hud__character-stage">
            <div class="hud__character-stage-glow"></div>
            <div class="hud__character-stage-canvas-wrap" data-character-preview></div>
          </div>
          <button class="hud__character-nav" type="button" data-character-selector-next aria-label="Next character" title="Next character">
            <span aria-hidden="true">&#8250;</span>
          </button>
        </div>
        <div class="hud__character-selection-status" data-character-selector-status>Currently selected</div>
        <div class="hud__character-grid" data-character-selector-grid></div>
      </section>
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
      <section class="hud__admin-position" data-admin-position hidden>
        <p class="hud__eyebrow">Admin Position</p>
        <p class="hud__admin-position-value" data-admin-position-value>X 0.00 Z 0.00</p>
        <p class="hud__body hud__admin-position-hint" data-admin-position-hint>World coordinates for collider debugging.</p>
      </section>
      <section class="hud__join-title" data-join-title aria-hidden="true">
        <div class="hud__join-title-stack">
          <span
            class="hud__join-title-word"
            style="--join-order:0; --join-direction:-1; --join-tilt:-7deg;"
          >Vibe</span>
          <span
            class="hud__join-title-word"
            style="--join-order:1; --join-direction:1; --join-tilt:5deg;"
          >Theft</span>
          <span
            class="hud__join-title-word"
            style="--join-order:2; --join-direction:-1; --join-tilt:-4deg;"
          >Auto</span>
        </div>
      </section>
      <section class="hud__aim-debug" data-aim-debug hidden>
        <div class="hud__aim-debug-header">
          <div>
            <p class="hud__eyebrow">Pose Debug</p>
            <p class="hud__body hud__aim-debug-status" data-aim-debug-status>Adjust weapon aim poses and unarmed punch facing.</p>
          </div>
          <div class="hud__aim-debug-actions">
            <button class="hud__builder-icon-button" type="button" data-aim-debug-bones title="Toggle skeleton helper">Bones</button>
            <button class="hud__builder-icon-button" type="button" data-aim-debug-print title="Print current pose settings">Print</button>
            <button class="hud__builder-icon-button" type="button" data-aim-debug-reset title="Reset pose debug overrides">Reset</button>
          </div>
        </div>
        <div class="hud__aim-debug-fields" data-aim-debug-fields></div>
      </section>
      <section class="hud__prompt">
        <span class="hud__key">E</span>
        <span class="hud__prompt-text" data-prompt></span>
      </section>
      <section class="hud__builder" data-builder hidden>
        <div class="hud__builder-resize-handle" data-builder-resize-handle aria-hidden="true"></div>
        <div class="hud__builder-header">
          <div>
            <p class="hud__eyebrow">World Builder</p>
          </div>
          <div class="hud__builder-actions">
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
        </div>
      </section>
      <section class="hud__builder-instance" data-builder-npc-editor hidden>
        <div class="hud__builder-resize-handle" data-builder-resize-handle aria-hidden="true"></div>
        <div class="hud__builder-header">
          <div>
            <p class="hud__eyebrow">NPC Details</p>
            <h2 class="hud__dialog-title" data-builder-npc-title>NPC</h2>
            <p class="hud__body hud__builder-instance-subtitle" data-builder-npc-subtitle>Configure this NPC instance without leaving the world.</p>
          </div>
          <div class="hud__builder-actions">
            <button class="hud__builder-icon-button" type="button" data-builder-npc-close aria-label="Return to world builder" title="Return to world builder">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          </div>
        </div>
        <div class="hud__builder-instance-scroll">
          <div class="hud__builder-instance-card">
            <section class="hud__builder-section">
              <div class="hud__builder-section-header">
                <p class="hud__builder-section-title">Identity</p>
              </div>
              <label class="hud__field">
                <span class="hud__field-label">Model</span>
                <select class="hud__field-control" data-builder-npc-model></select>
              </label>
              <label class="hud__field">
                <span class="hud__field-label">Name</span>
                <input class="hud__field-control" type="text" maxlength="40" data-builder-npc-name />
              </label>
              <div class="hud__builder-instance-metrics">
                <label class="hud__field">
                  <span class="hud__field-label">Interact Radius</span>
                  <input class="hud__field-control" type="number" min="1.5" max="12" step="0.1" data-builder-npc-radius />
                </label>
                <label class="hud__field">
                  <span class="hud__field-label">Respawn Timer (ms)</span>
                  <input class="hud__field-control" type="number" min="0" max="600000" step="100" data-builder-npc-respawn-delay />
                </label>
              </div>
              <div class="hud__builder-instance-metrics">
                <label class="hud__field">
                  <span class="hud__field-label">Archetype</span>
                  <select class="hud__field-control" data-builder-npc-combat-archetype></select>
                </label>
                <label class="hud__field">
                  <span class="hud__field-label">Weapon</span>
                  <select class="hud__field-control" data-builder-npc-combat-weapon></select>
                </label>
              </div>
              <div class="hud__builder-instance-metrics">
                <label class="hud__field">
                  <span class="hud__field-label">Aggro Radius</span>
                  <input class="hud__field-control" type="number" min="2" max="80" step="0.1" data-builder-npc-combat-aggro />
                </label>
                <label class="hud__field" data-builder-npc-combat-leash-field hidden>
                  <span class="hud__field-label">Hostile Leash Radius</span>
                  <input class="hud__field-control" type="number" min="0" max="120" step="0.1" data-builder-npc-combat-leash />
                </label>
              </div>
              <div class="hud__builder-instance-metrics">
                <label class="hud__field" hidden>
                  <span class="hud__field-label">Flee Threshold</span>
                  <input class="hud__field-control" type="number" min="1" max="100" step="1" data-builder-npc-combat-flee />
                </label>
              </div>
              <label class="hud__field">
                <span class="hud__field-label">Prompt</span>
                <textarea class="hud__field-control hud__field-control--textarea" rows="5" data-builder-npc-prompt></textarea>
              </label>
            </section>
            <div class="hud__builder-section-divider" aria-hidden="true"></div>
            <section class="hud__builder-section">
              <div class="hud__builder-section-header">
                <p class="hud__builder-section-title">Routine</p>
              </div>
              <p class="hud__body" data-builder-npc-warnings hidden></p>
              <p class="hud__body" data-builder-npc-pick-status hidden></p>
              <div class="hud__builder-instance-metrics">
                <label class="hud__field">
                  <span class="hud__field-label">Add Step</span>
                  <select class="hud__field-control" data-builder-npc-step-add-type></select>
                </label>
              </div>
              <button class="hud__builder-action" type="button" data-builder-npc-step-add>Add Routine Step</button>
              <div data-builder-npc-routine-steps></div>
            </section>
            <section class="hud__builder-section">
              <div class="hud__builder-section-header">
                <p class="hud__builder-section-title">Runtime Debug</p>
              </div>
              <p class="hud__body" data-builder-npc-debug-summary>NPC debug is unavailable. Enable server-side NPC debug to inspect live sim data.</p>
              <div class="hud__builder-instance-metrics" data-builder-npc-debug-metrics hidden></div>
            </section>
            <button class="hud__builder-action hud__builder-confirm" type="button" data-builder-npc-confirm>Confirm NPC</button>
          </div>
        </div>
      </section>
      <section class="hud__builder-instance" data-builder-building-editor hidden>
        <div class="hud__builder-resize-handle" data-builder-resize-handle aria-hidden="true"></div>
        <div class="hud__builder-header">
          <div>
            <p class="hud__eyebrow">Building Instance</p>
            <h2 class="hud__dialog-title" data-builder-building-title>Building</h2>
            <p class="hud__body hud__builder-instance-subtitle" data-builder-building-subtitle>Configure placement-specific data for this building.</p>
          </div>
          <div class="hud__builder-actions">
            <button class="hud__builder-icon-button" type="button" data-builder-building-close aria-label="Return to world builder" title="Return to world builder">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          </div>
        </div>
        <div class="hud__builder-instance-scroll">
          <div class="hud__builder-instance-card">
            <label class="hud__field">
              <span class="hud__field-label">Display Name</span>
              <input class="hud__field-control" type="text" maxlength="48" data-builder-building-label />
            </label>
            <label class="hud__field">
              <span class="hud__field-label">Prompt Text</span>
              <input class="hud__field-control" type="text" maxlength="80" data-builder-building-prompt />
            </label>
            <label class="hud__field">
              <span class="hud__field-label">Action Text</span>
              <textarea class="hud__field-control hud__field-control--textarea" rows="4" data-builder-building-action></textarea>
            </label>
            <div class="hud__builder-instance-metrics">
              <label class="hud__field">
                <span class="hud__field-label">Interact Radius</span>
                <input class="hud__field-control" type="number" min="1.5" max="12" step="0.1" data-builder-building-radius />
              </label>
              <label class="hud__field">
                <span class="hud__field-label">Prompt Offset</span>
                <input class="hud__field-control" type="number" min="1" max="28" step="0.1" data-builder-building-distance />
              </label>
            </div>
          </div>
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
          <button class="hud__selection-icon-button hud__selection-move" type="button" data-builder-selection-move aria-label="Move selected piece" title="Move selected piece">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v16" />
              <path d="M4 12h16" />
              <path d="M9.5 6.5L12 4l2.5 2.5" />
              <path d="M9.5 17.5L12 20l2.5-2.5" />
              <path d="M6.5 9.5L4 12l2.5 2.5" />
              <path d="M17.5 9.5L20 12l-2.5 2.5" />
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

  clampBuilderPanelWidth(width) {
    const viewportLimit = Math.max(BUILDER_PANEL_MIN_WIDTH, window.innerWidth - 48);
    return Math.min(
      Math.max(Math.round(width), BUILDER_PANEL_MIN_WIDTH),
      Math.min(BUILDER_PANEL_MAX_WIDTH, viewportLimit)
    );
  }

  setBuilderPanelWidth(width) {
    this.builderPanelWidth = this.clampBuilderPanelWidth(width);
    this.overlay.style.setProperty('--builder-panel-width', `${this.builderPanelWidth}px`);
  }

  initializeBuilderPanelResize() {
    this.setBuilderPanelWidth(this.builderPanelWidth);
    for (const handle of this.builderResizeHandles) {
      handle.addEventListener('pointerdown', (event) => {
        if (window.innerWidth <= BUILDER_PANEL_MOBILE_BREAKPOINT) {
          return;
        }

        const panel = event.currentTarget.closest('.hud__builder, .hud__builder-instance');
        if (!(panel instanceof HTMLElement)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.activeBuilderResizePointerId = event.pointerId;
        this.builderResizeRightEdge = panel.getBoundingClientRect().right;
        panel.classList.add('is-resizing');
        handle.setPointerCapture?.(event.pointerId);
        document.body.classList.add('is-builder-resizing');
        window.addEventListener('pointermove', this.onBuilderResizePointerMove);
        window.addEventListener('pointerup', this.onBuilderResizePointerUp);
        window.addEventListener('pointercancel', this.onBuilderResizePointerUp);
      });
    }
  }

  onBuilderResizePointerMove(event) {
    if (event.pointerId !== this.activeBuilderResizePointerId) {
      return;
    }

    event.preventDefault();
    this.setBuilderPanelWidth(this.builderResizeRightEdge - event.clientX);
  }

  onBuilderResizePointerUp(event) {
    if (event.pointerId !== this.activeBuilderResizePointerId) {
      return;
    }

    this.activeBuilderResizePointerId = null;
    document.body.classList.remove('is-builder-resizing');
    this.builderRoot.classList.remove('is-resizing');
    this.builderNpcEditor.classList.remove('is-resizing');
    this.builderBuildingEditor.classList.remove('is-resizing');
    window.removeEventListener('pointermove', this.onBuilderResizePointerMove);
    window.removeEventListener('pointerup', this.onBuilderResizePointerUp);
    window.removeEventListener('pointercancel', this.onBuilderResizePointerUp);
  }

  playJoinTitleAnimation() {
    if (!this.joinTitle) {
      return;
    }

    window.clearTimeout(this.joinTitleTimeout);
    this.joinTitle.classList.remove('is-active');
    void this.joinTitle.offsetWidth;
    this.joinTitle.classList.add('is-active');

    this.joinTitleTimeout = window.setTimeout(() => {
      this.joinTitle.classList.remove('is-active');
    }, 2400);
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
    onToggleBones,
    onSelectSection
  }) {
    this.aimDebugToggle?.addEventListener('click', () => {
      onTogglePanel();
    });

    this.aimDebugFields?.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.aimDebugRoot)) {
        return;
      }

      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const button = target?.closest('[data-aim-debug-section]');
      if (!button) {
        return;
      }

      onSelectSection(button.dataset.aimDebugSection);
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

  bindCharacterSelectorEvents({
    onTogglePanel,
    onCycleCharacter,
    onSelectCharacter,
    onViewportChange
  }) {
    this.characterSelectorToggle?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onTogglePanel();
    });

    this.characterSelectorClose?.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.characterSelectorRoot)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onTogglePanel(false);
    });

    this.characterSelectorPrev?.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.characterSelectorRoot)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onCycleCharacter(-1);
    });

    this.characterSelectorNext?.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.characterSelectorRoot)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onCycleCharacter(1);
    });

    this.characterSelectorGrid?.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.characterSelectorRoot)) {
        return;
      }

      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const button = target?.closest('[data-character-id]');
      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onSelectCharacter(button.dataset.characterId);
    });

    this.characterSelectorGrid?.addEventListener('scroll', () => {
      onViewportChange?.();
    }, { passive: true });
  }

  bindBuilderEvents({
    onToggleBuildMode,
    onSelectCategory,
    onSelectGroup,
    onSelectTile,
    onRotateSelection,
    onMoveSelection,
    onDeleteSelection,
    onConfirmSelection,
    onNpcNameChange,
    onNpcPromptChange,
    onNpcRadiusChange,
    onNpcRespawnDelayChange,
    onNpcModelChange,
    onNpcRoutineAddStep,
    onNpcRoutineRemoveStep,
    onNpcRoutineStepChange,
    onNpcRoutinePickTarget,
    onNpcCombatChange,
    onConfirmNpc,
    onCloseNpcEditor,
    onCloseBuildingEditor,
    onBuildingLabelChange,
    onBuildingPromptChange,
    onBuildingActionTextChange,
    onBuildingRadiusChange,
    onBuildingDistanceChange
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

    this.builderClose.addEventListener('click', () => {
      if (!this.isElementInteractive(this.builderRoot)) {
        return;
      }

      onToggleBuildMode();
    });

    this.builderSelectionRotate.addEventListener('click', () => {
      onRotateSelection();
    });

    this.builderSelectionMove.addEventListener('click', () => {
      onMoveSelection();
    });

    this.builderSelectionDelete.addEventListener('click', () => {
      onDeleteSelection();
    });

    this.builderSelectionConfirm.addEventListener('click', () => {
      onConfirmSelection();
    });

    this.builderNpcEditorClose.addEventListener('click', () => {
      onCloseNpcEditor();
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

    this.builderNpcRespawnDelay?.addEventListener('input', () => {
      onNpcRespawnDelayChange?.(Number(this.builderNpcRespawnDelay.value));
    });

    this.builderNpcModel.addEventListener('change', () => {
      onNpcModelChange(this.builderNpcModel.value);
    });

    this.builderNpcStepAdd?.addEventListener('click', () => {
      onNpcRoutineAddStep(this.builderNpcStepAddType?.value ?? '');
    });

    this.builderNpcRoutineSteps?.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const pickButton = target?.closest('[data-builder-npc-step-pick]');
      if (pickButton) {
        onNpcRoutinePickTarget?.(
          Number(pickButton.dataset.builderNpcStepPick),
          pickButton.dataset.builderNpcStepPickMode === 'active'
            ? 'cancel'
            : 'start'
        );
        return;
      }
      const button = target?.closest('[data-builder-npc-step-remove]');
      if (!button) {
        return;
      }

      onNpcRoutineRemoveStep(Number(button.dataset.builderNpcStepRemove));
    });

    const handleNpcRoutineStepFieldChange = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
        return;
      }

      const stepIndex = Number(target.dataset.builderNpcStepIndex);
      const field = target.dataset.builderNpcStepField;
      if (!Number.isFinite(stepIndex) || !field) {
        return;
      }

      const value = target instanceof HTMLInputElement && target.type === 'number'
        ? Number(target.value)
        : target.value;
      onNpcRoutineStepChange(stepIndex, field, value);
    };

    this.builderNpcRoutineSteps?.addEventListener('input', handleNpcRoutineStepFieldChange);
    this.builderNpcRoutineSteps?.addEventListener('change', handleNpcRoutineStepFieldChange);

    this.builderNpcCombatArchetype?.addEventListener('change', () => {
      onNpcCombatChange('archetype', this.builderNpcCombatArchetype.value);
    });

    this.builderNpcCombatWeapon?.addEventListener('change', () => {
      onNpcCombatChange('weaponId', this.builderNpcCombatWeapon.value);
    });

    this.builderNpcCombatAggroRadius?.addEventListener('input', () => {
      onNpcCombatChange('aggroRadius', Number(this.builderNpcCombatAggroRadius.value));
    });

    this.builderNpcCombatLeashRadius?.addEventListener('input', () => {
      onNpcCombatChange('leashRadius', Number(this.builderNpcCombatLeashRadius.value));
    });

    this.builderNpcCombatFleeHealth?.addEventListener('input', () => {
      onNpcCombatChange('fleeHealthThreshold', Number(this.builderNpcCombatFleeHealth.value));
    });

    this.builderNpcConfirm.addEventListener('click', () => {
      onConfirmNpc();
    });

    this.builderBuildingEditorClose.addEventListener('click', () => {
      onCloseBuildingEditor();
    });

    this.builderBuildingLabel.addEventListener('input', () => {
      onBuildingLabelChange(this.builderBuildingLabel.value);
    });

    this.builderBuildingPrompt.addEventListener('input', () => {
      onBuildingPromptChange(this.builderBuildingPrompt.value);
    });

    this.builderBuildingActionText.addEventListener('input', () => {
      onBuildingActionTextChange(this.builderBuildingActionText.value);
    });

    this.builderBuildingRadius.addEventListener('input', () => {
      onBuildingRadiusChange(Number(this.builderBuildingRadius.value));
    });

    this.builderBuildingDistance.addEventListener('input', () => {
      onBuildingDistanceChange(Number(this.builderBuildingDistance.value));
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
    available = false,
    enabled,
    tabs = [],
    groupTabs = [],
    sections = []
  }) {
    this.builderAvailable = available;
    this.builderEnabled = enabled;
    this.modeToggle.hidden = !available;
    this.syncBuilderVisibility();
    this.modeToggle.classList.toggle('is-active', enabled);
    this.modeToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    this.modeToggle.title = enabled ? 'Return to player mode' : 'Enter world edit mode';

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
            const preview = this.builderPreviewImages.get(card.previewId) ?? '';
            const imageSrc = preview || (card.previewMode === 'static' ? card.previewImageSrc : '');
            if (!preview && card.previewMode === 'static' && card.previewImageSrc) {
              this.queueBuilderStaticPreview(card.previewId, card.previewImageSrc);
            }
            return `
              <button
                class="hud__builder-card${card.selected ? ' is-active' : ''}"
                type="button"
                data-builder-index="${card.sourceIndex}"
              >
                ${card.shortcut ? `<span class="hud__builder-key hud__builder-card-key">${card.shortcut}</span>` : ''}
                <span class="hud__builder-thumb" data-builder-preview="${card.previewId}">
                  ${imageSrc
                    ? `<img class="hud__builder-thumb-image" src="${imageSrc}" alt="${card.label}" loading="lazy" />`
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

  syncBuilderVisibility() {
    const instanceEditorVisible = this.builderNpcEditorVisible || this.builderBuildingEditorVisible;
    const builderVisible = this.builderAvailable && this.builderEnabled && !instanceEditorVisible;
    const npcEditorVisible = this.builderAvailable && this.builderEnabled && this.builderNpcEditorVisible;
    const buildingEditorVisible = this.builderAvailable && this.builderEnabled && this.builderBuildingEditorVisible;
    this.builderRoot.hidden = !builderVisible;
    this.builderRoot.classList.toggle('is-visible', builderVisible);
    this.builderNpcEditor.hidden = !npcEditorVisible;
    this.builderNpcEditor.classList.toggle('is-visible', npcEditorVisible);
    this.builderBuildingEditor.hidden = !buildingEditorVisible;
    this.builderBuildingEditor.classList.toggle('is-visible', buildingEditorVisible);
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

  queueBuilderStaticPreview(itemId, src) {
    if (!itemId || !src || this.builderPreviewImages.has(itemId) || this.builderPreviewFailedIds.has(itemId)) {
      return;
    }

    if (this.builderPreviewLoadPromises.has(itemId)) {
      return;
    }

    const load = new Promise((resolve) => {
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'lazy';
      image.onload = () => {
        this.builderPreviewLoadPromises.delete(itemId);
        this.setBuilderPreviewImage(itemId, src);
        resolve(true);
      };
      image.onerror = () => {
        this.builderPreviewLoadPromises.delete(itemId);
        this.builderPreviewFailedIds.add(itemId);
        resolve(false);
      };
      image.src = src;
    });

    this.builderPreviewLoadPromises.set(itemId, load);
  }

  setBuilderSelection(selection) {
    const node = this.builderSelection;
    if (!selection || selection.moving) {
      node.classList.remove('is-visible');
      this.builderSelectionMove?.classList.remove('is-active');
      return;
    }

    node.classList.add('is-visible');
    node.style.left = `${selection.screenX}px`;
    node.style.top = `${selection.screenY}px`;
    this.builderSelectionMove?.classList.toggle('is-active', Boolean(selection.moving));
  }

  setBuilderNpcEditor(editorState) {
    if (!editorState) {
      this.lastNpcEditorState = null;
      this.builderNpcEditorVisible = false;
      this.syncBuilderVisibility();
      return;
    }

    this.builderNpcEditorVisible = true;
    this.syncBuilderVisibility();
    this.builderNpcEditorTitle.textContent = editorState.title;
    this.builderNpcEditorSubtitle.textContent = editorState.subtitle;

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
    setFieldValue(this.builderNpcRespawnDelay, String(editorState.respawnDelayMs ?? 0));
    setFieldValue(this.builderNpcPrompt, editorState.prompt);

    const stepTypesChanged = this.lastNpcEditorState?.stepTypes?.length !== editorState.stepTypes.length
      || this.lastNpcEditorState?.stepTypes?.some((entry, index) => entry.id !== editorState.stepTypes[index].id);
    if (stepTypesChanged && this.builderNpcStepAddType) {
      this.builderNpcStepAddType.innerHTML = editorState.stepTypes.map((stepType) => `
        <option value="${escapeHtml(stepType.id)}">${escapeHtml(stepType.label)}</option>
      `).join('');
    }
    if (this.builderNpcStepAddType && document.activeElement !== this.builderNpcStepAddType) {
      this.builderNpcStepAddType.value = editorState.stepTypes.some((entry) => entry.id === editorState.newStepType)
        ? editorState.newStepType
        : editorState.stepTypes[0]?.id ?? '';
    }

    const archetypesChanged = this.lastNpcEditorState?.combatArchetypes?.length !== editorState.combatArchetypes.length
      || this.lastNpcEditorState?.combatArchetypes?.some((entry, index) => entry.id !== editorState.combatArchetypes[index].id);
    if (archetypesChanged && this.builderNpcCombatArchetype) {
      this.builderNpcCombatArchetype.innerHTML = editorState.combatArchetypes.map((entry) => `
        <option value="${escapeHtml(entry.id)}">${escapeHtml(entry.label)}</option>
      `).join('');
    }

    const weaponOptionsChanged = this.lastNpcEditorState?.weaponOptions?.length !== editorState.weaponOptions.length
      || this.lastNpcEditorState?.weaponOptions?.some((entry, index) => entry.id !== editorState.weaponOptions[index].id);
    if (weaponOptionsChanged && this.builderNpcCombatWeapon) {
      this.builderNpcCombatWeapon.innerHTML = editorState.weaponOptions.map((entry) => `
        <option value="${escapeHtml(entry.id)}">${escapeHtml(entry.label)}</option>
      `).join('');
    }

    if (document.activeElement !== this.builderNpcCombatArchetype) {
      this.builderNpcCombatArchetype.value = editorState.combat.archetype;
    }
    if (document.activeElement !== this.builderNpcCombatWeapon) {
      this.builderNpcCombatWeapon.value = editorState.combat.weaponId;
    }
    setFieldValue(this.builderNpcCombatAggroRadius, String(editorState.combat.aggroRadius));
    setFieldValue(this.builderNpcCombatLeashRadius, String(editorState.combat.leashRadius));
    setFieldValue(this.builderNpcCombatFleeHealth, String(editorState.combat.fleeHealthThreshold));
    if (this.builderNpcCombatLeashField) {
      const showHostileLeash = editorState.combat.archetype === 'hostile';
      this.builderNpcCombatLeashField.hidden = !showHostileLeash;
      if (this.builderNpcCombatLeashRadius) {
        this.builderNpcCombatLeashRadius.disabled = !showHostileLeash;
      }
    }

    if (this.builderNpcWarnings) {
      const warnings = editorState.warnings ?? [];
      this.builderNpcWarnings.hidden = warnings.length === 0;
      this.builderNpcWarnings.textContent = warnings.join(' ');
    }

    if (this.builderNpcPickStatus) {
      const pickingState = editorState.pickingTarget ?? null;
      this.builderNpcPickStatus.hidden = !pickingState;
      this.builderNpcPickStatus.textContent = pickingState
        ? `Selecting destination for step ${pickingState.stepNumber}: click a valid building or prop in the world. Right-click, press Escape, or press the picker again to cancel.`
        : '';
    }

    const previousRoutineSignature = getNpcRoutineEditorSignature(this.lastNpcEditorState);
    const nextRoutineSignature = getNpcRoutineEditorSignature(editorState);

    if (this.builderNpcRoutineSteps && previousRoutineSignature !== nextRoutineSignature) {
      this.builderNpcRoutineSteps.innerHTML = editorState.routine.steps.length
        ? editorState.routine.steps.map((step, index) => {
            const targetOptions = step.targetOptions ?? [];
            const targetValue = step.targetPlacementId ?? '';
            const targetOptionMarkup = [
              '<option value="">Select a destination</option>',
              ...targetOptions.map((option) => `
                <option value="${escapeHtml(option.id)}"${option.id === targetValue ? ' selected' : ''}>
                  ${escapeHtml(option.label)}
                </option>
              `)
            ].join('');

            const detailFields = [];
            if (step.type === 'usePlacement' || step.type === 'loiterNearPlacement' || step.type === 'wanderNearPlacement') {
              detailFields.push(`
                <label class="hud__field">
                  <span class="hud__field-label">Duration (ms)</span>
                  <input
                    class="hud__field-control"
                    type="number"
                    min="500"
                    max="120000"
                    step="100"
                    value="${escapeHtml(step.durationMs)}"
                    data-builder-npc-step-index="${index}"
                    data-builder-npc-step-field="durationMs"
                  />
                </label>
              `);
            }
            if (step.type === 'enterHideAtPlacement') {
              detailFields.push(`
                <label class="hud__field">
                  <span class="hud__field-label">Hidden Time (ms)</span>
                  <input
                    class="hud__field-control"
                    type="number"
                    min="500"
                    max="120000"
                    step="100"
                    value="${escapeHtml(step.hiddenDurationMs)}"
                    data-builder-npc-step-index="${index}"
                    data-builder-npc-step-field="hiddenDurationMs"
                  />
                </label>
              `);
            }
            if (step.type === 'loiterNearPlacement' || step.type === 'wanderNearPlacement') {
              detailFields.push(`
                <label class="hud__field">
                  <span class="hud__field-label">Radius</span>
                  <input
                    class="hud__field-control"
                    type="number"
                    min="1"
                    max="30"
                    step="0.1"
                    value="${escapeHtml(step.radius)}"
                    data-builder-npc-step-index="${index}"
                    data-builder-npc-step-field="radius"
                  />
                </label>
              `);
            }

            return `
              <section class="hud__builder-section">
                <div class="hud__builder-section-header">
                  <p class="hud__builder-section-title">${index + 1}. ${escapeHtml(formatNpcStepLabel(step.type))}</p>
                  <button
                    class="hud__builder-icon-button"
                    type="button"
                    data-builder-npc-step-remove="${index}"
                    aria-label="Remove routine step"
                    title="Remove routine step"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h16" />
                      <path d="M9 7V4h6v3" />
                      <path d="M7 7l1 12h8l1-12" />
                    </svg>
                  </button>
                </div>
                <div class="hud__builder-instance-metrics">
                  <label class="hud__field">
                    <span class="hud__field-label">Step Type</span>
                    <select
                      class="hud__field-control"
                      data-builder-npc-step-index="${index}"
                      data-builder-npc-step-field="type"
                    >
                      ${editorState.stepTypes.map((stepType) => `
                        <option value="${escapeHtml(stepType.id)}"${stepType.id === step.type ? ' selected' : ''}>
                          ${escapeHtml(stepType.label)}
                        </option>
                      `).join('')}
                    </select>
                  </label>
                  <label class="hud__field">
                    <span class="hud__field-label">Destination</span>
                    <div class="hud__field-inline">
                      <select
                        class="hud__field-control"
                        data-builder-npc-step-index="${index}"
                        data-builder-npc-step-field="targetPlacementId"
                      >
                        ${targetOptionMarkup}
                      </select>
                      <button
                        class="hud__builder-icon-button${step.pickModeActive ? ' is-active' : ''}"
                        type="button"
                        data-builder-npc-step-pick="${index}"
                        data-builder-npc-step-pick-mode="${step.pickModeActive ? 'active' : 'idle'}"
                        aria-label="${step.pickModeActive ? 'Cancel world destination picking' : 'Pick destination in world'}"
                        title="${step.pickModeActive ? 'Cancel world destination picking' : 'Pick destination in world'}"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="12" r="5" />
                          <path d="M12 3v4" />
                          <path d="M12 17v4" />
                          <path d="M3 12h4" />
                          <path d="M17 12h4" />
                        </svg>
                      </button>
                    </div>
                  </label>
                </div>
                ${detailFields.length ? `<div class="hud__builder-instance-metrics">${detailFields.join('')}</div>` : ''}
                ${step.warning ? `<p class="hud__body">${escapeHtml(step.warning)}</p>` : ''}
              </section>
            `;
          }).join('')
        : '<p class="hud__body">No routine steps yet. Add a destination-driven step to start the loop.</p>';
    }

    if (this.builderNpcDebugSummary) {
      const debug = editorState.debug ?? null;
      this.builderNpcDebugSummary.textContent = debug
        ? `Mode ${debug.mode} | Activity ${debug.activity} | Step ${debug.currentStep}`
        : 'NPC debug is unavailable. Enable server-side NPC debug to inspect live sim data.';
    }

    if (this.builderNpcDebugMetrics) {
      const debug = editorState.debug ?? null;
      this.builderNpcDebugMetrics.hidden = !debug;
      this.builderNpcDebugMetrics.innerHTML = debug
        ? [
            ['Target', debug.targetLabel],
            ['Path Nodes', `${debug.pathNodeCount} total | index ${debug.pathLabel}`],
            ['Idle Left', `${Math.max(0, debug.idleRemainingMs ?? 0)} ms`],
            ['Calm Left', `${Math.max(0, debug.calmRemainingMs ?? 0)} ms`],
            ['Hidden Left', `${Math.max(0, debug.hiddenRemainingMs ?? 0)} ms`],
            ['Respawn Left', `${Math.max(0, debug.respawnRemainingMs ?? 0)} ms`],
            ['Last Repath', `${Math.max(0, debug.lastRepathAgeMs ?? 0)} ms ago`],
            ['Next Point', debug.nextPathPoint ? `${debug.nextPathPoint.x.toFixed(2)}, ${debug.nextPathPoint.z.toFixed(2)}` : 'None'],
            ['Steering', debug.steeringTarget ? `${debug.steeringTarget.x.toFixed(2)}, ${debug.steeringTarget.z.toFixed(2)}` : 'None'],
            ['Final Target', debug.finalTarget ? `${debug.finalTarget.x.toFixed(2)}, ${debug.finalTarget.z.toFixed(2)}` : 'None']
          ].map(([label, value]) => `
            <div class="hud__field">
              <span class="hud__field-label">${escapeHtml(label)}</span>
              <span class="hud__body">${escapeHtml(value)}</span>
            </div>
          `).join('')
        : '';
    }

    this.builderNpcConfirm.disabled = editorState.active;
    this.builderNpcConfirm.textContent = editorState.active ? 'NPC Active' : 'Confirm NPC';

    this.lastNpcEditorState = structuredClone(editorState);
  }

  setBuilderBuildingEditor(editorState) {
    if (!editorState) {
      this.lastBuildingEditorState = null;
      this.builderBuildingEditorVisible = false;
      this.syncBuilderVisibility();
      return;
    }

    this.builderBuildingEditorVisible = true;
    this.syncBuilderVisibility();
    this.builderBuildingEditorTitle.textContent = editorState.title;
    this.builderBuildingEditorSubtitle.textContent = editorState.subtitle;
    setFieldValue(this.builderBuildingLabel, editorState.label);
    setFieldValue(this.builderBuildingPrompt, editorState.prompt);
    setFieldValue(this.builderBuildingActionText, editorState.actionText);
    setFieldValue(this.builderBuildingRadius, String(editorState.radius));
    setFieldValue(this.builderBuildingDistance, String(editorState.distance));
    this.lastBuildingEditorState = structuredClone(editorState);
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

  setAdminPositionState({
    visible = false,
    x = 0,
    y = 0,
    z = 0,
    heading = 0
  } = {}) {
    if (!this.adminPositionRoot || !this.adminPositionValue || !this.adminPositionHint) {
      return;
    }

    if (!visible) {
      this.adminPositionRoot.hidden = true;
      this.lastAdminPositionSignature = '';
      return;
    }

    const signature = [
      Number(x).toFixed(2),
      Number(y).toFixed(2),
      Number(z).toFixed(2),
      Number(heading).toFixed(1)
    ].join('|');

    if (signature === this.lastAdminPositionSignature) {
      this.adminPositionRoot.hidden = false;
      return;
    }

    this.lastAdminPositionSignature = signature;
    this.adminPositionRoot.hidden = false;
    this.adminPositionValue.textContent = `X ${Number(x).toFixed(2)}  Y ${Number(y).toFixed(2)}  Z ${Number(z).toFixed(2)}`;
    this.adminPositionHint.textContent = `Heading ${Number(heading).toFixed(1)}°`;
  }

  setCharacterSelectorPreviewCanvas(node) {
    if (!this.characterSelectorPreview || !node) {
      return;
    }

    if (this.characterSelectorPreview.contains(node)) {
      return;
    }

    this.characterSelectorPreview.replaceChildren(node);
  }

  setCharacterSelectorState({
    available = false,
    visible = false,
    selectedId = '',
    statusText = 'Currently selected',
    entries = []
  } = {}) {
    if (!this.characterSelectorRoot) {
      return;
    }

    const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;

    const panelVisible = Boolean(available && visible);

    if (this.characterSelectorToggle) {
      this.characterSelectorToggle.hidden = !available;
      this.characterSelectorToggle.classList.toggle('is-active', panelVisible);
      this.characterSelectorToggle.setAttribute('aria-pressed', panelVisible ? 'true' : 'false');
      this.characterSelectorToggle.title = panelVisible ? 'Hide character selector' : 'Choose your character';
    }

    this.characterSelectorRoot.hidden = !panelVisible;
    this.characterSelectorRoot.classList.toggle('is-visible', panelVisible);

    if (this.characterSelectorName) {
      this.characterSelectorName.textContent = selectedEntry?.label ?? 'Unknown Fighter';
    }

    if (this.characterSelectorSubtitle) {
      this.characterSelectorSubtitle.textContent = selectedEntry?.subtitle ?? '';
    }

    if (this.characterSelectorStatus) {
      this.characterSelectorStatus.textContent = statusText;
    }

    const signature = JSON.stringify(entries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      subtitle: entry.subtitle ?? ''
    })));

    if (signature !== this.lastCharacterSelectorSignature) {
      this.lastCharacterSelectorSignature = signature;
      this.characterSelectorGrid.innerHTML = entries.map((entry) => `
        <button
          class="hud__character-card"
          type="button"
          data-character-id="${entry.id}"
        >
          <span class="hud__character-card-frame">
            <span class="hud__character-card-preview" data-character-preview-card="${entry.id}">
              <span class="hud__character-card-placeholder">${entry.label}</span>
            </span>
          </span>
          <span class="hud__character-card-label">${entry.label}</span>
        </button>
      `).join('');
    }

    for (const button of this.characterSelectorGrid?.querySelectorAll('[data-character-id]') ?? []) {
      button.classList.toggle('is-selected', button.dataset.characterId === selectedId);
    }
  }

  getCharacterSelectorCardPreviewMount(characterId) {
    return this.characterSelectorGrid?.querySelector(`[data-character-preview-card="${characterId}"]`) ?? null;
  }

  getVisibleCharacterSelectorCardIds({ overscanPx = 0 } = {}) {
    if (!this.characterSelectorGrid) {
      return [];
    }

    const gridBounds = this.characterSelectorGrid.getBoundingClientRect();
    return Array.from(this.characterSelectorGrid.querySelectorAll('[data-character-id]'))
      .filter((button) => {
        const bounds = button.getBoundingClientRect();
        return (
          bounds.bottom >= gridBounds.top - overscanPx
          && bounds.top <= gridBounds.bottom + overscanPx
          && bounds.right >= gridBounds.left
          && bounds.left <= gridBounds.right
        );
      })
      .map((button) => button.dataset.characterId)
      .filter(Boolean);
  }

  isCharacterSelectorOpen() {
    return this.characterSelectorRoot?.classList.contains('is-visible') ?? false;
  }

  setAimPoseDebugState({
    available = false,
    visible = false,
    statusText = '',
    showSkeleton = false,
    values = {},
    extraValues = {},
    selectedSection = 'unarmed'
  } = {}) {
    if (!this.aimDebugRoot) {
      return;
    }

    if (this.aimDebugToggle) {
      this.aimDebugToggle.hidden = !available;
      this.aimDebugToggle.classList.toggle('is-active', visible);
      this.aimDebugToggle.setAttribute('aria-pressed', visible ? 'true' : 'false');
      this.aimDebugToggle.title = visible ? 'Hide pose debug' : 'Show pose debug';
    }

    this.aimDebugRoot.hidden = !visible;
    this.aimDebugRoot.classList.toggle('is-visible', visible);
    this.aimDebugStatus.textContent = statusText;
    this.aimDebugBoneToggle.classList.toggle('is-active', showSkeleton);
    this.aimDebugBoneToggle.setAttribute('aria-pressed', showSkeleton ? 'true' : 'false');

    for (const button of this.aimDebugFields?.querySelectorAll('[data-aim-debug-section]') ?? []) {
      const active = button.dataset.aimDebugSection === selectedSection;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    for (const panel of this.aimDebugFields?.querySelectorAll('[data-aim-debug-section-panel]') ?? []) {
      panel.hidden = panel.dataset.aimDebugSectionPanel !== selectedSection;
    }

    for (const field of POSE_DEBUG_EXTRA_FIELDS) {
      const value = Number(extraValues?.[field.key] ?? 0);
      const formattedValue = Number.isFinite(value) ? value.toFixed(2) : '0.00';
      const inputs = this.poseDebugExtraInputs.get(field.key);
      setFieldValue(inputs?.range, formattedValue);
      setFieldValue(inputs?.number, formattedValue);
    }

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
      const highlightToggle = visible || intensityEnabled;
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
