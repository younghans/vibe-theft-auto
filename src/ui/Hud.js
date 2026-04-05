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
    this.combatRoot = this.overlay.querySelector('[data-combat-root]');
    this.combatHealth = this.overlay.querySelector('[data-combat-health]');
    this.combatAmmo = this.overlay.querySelector('[data-combat-ammo]');
    this.combatStatus = this.overlay.querySelector('[data-combat-status]');
    this.combatScore = this.overlay.querySelector('[data-combat-score]');
    this.respawnText = this.overlay.querySelector('[data-respawn]');
    this.hitMarker = this.overlay.querySelector('[data-hitmarker]');
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
        <p class="hud__eyebrow">Prototype</p>
        <h1 class="hud__title">Vibe Theft Auto</h1>
        <p class="hud__body">WASD to move. Mouse steers aim when armed, left click fires, hold right click to aim in, R reloads, Enter chats, E interacts, and hold B for emotes.</p>
        <section class="hud__combat" data-combat-root>
          <div class="hud__combat-row">
            <span class="hud__combat-label">Health</span>
            <strong class="hud__combat-value" data-combat-health>100 / 100</strong>
          </div>
          <div class="hud__combat-row">
            <span class="hud__combat-label">Ammo</span>
            <strong class="hud__combat-value" data-combat-ammo>Unarmed</strong>
          </div>
          <p class="hud__combat-status" data-combat-status>Find a pistol pickup to start blasting.</p>
          <p class="hud__combat-score" data-combat-score>K 0 / D 0</p>
        </section>
      </section>
      <div class="hud__top-actions">
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
      <section class="hud__toast">
        <p class="hud__toast-text" data-toast></p>
      </section>
      <section class="hud__aim-debug" data-aim-debug>
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
      <section class="hud__builder" data-builder>
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
      onReset();
    });

    this.aimDebugPrint?.addEventListener('click', () => {
      onPrint();
    });

    this.aimDebugBoneToggle?.addEventListener('click', () => {
      onToggleBones();
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
      const button = event.target.closest('[data-builder-category]');
      if (!button) {
        return;
      }
      onSelectCategory(button.dataset.builderCategory);
    });

    this.builderGroups.addEventListener('click', (event) => {
      const button = event.target.closest('[data-builder-group]');
      if (!button) {
        return;
      }
      onSelectGroup(button.dataset.builderGroup);
    });

    this.builderTiles.addEventListener('click', (event) => {
      const button = event.target.closest('[data-builder-index]');
      if (!button) {
        return;
      }
      onSelectTile(Number(button.dataset.builderIndex));
    });

    this.builderCopy.addEventListener('click', () => {
      onCopyLayout();
    });

    this.builderClose.addEventListener('click', () => {
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
      this.respawnText.classList.remove('is-visible');
      return;
    }

    this.combatHealth.textContent = `${health} / ${maxHealth}`;
    this.combatAmmo.textContent = armed ? `${ammoInClip} / ${reserveAmmo}` : 'Unarmed';
    this.combatScore.textContent = `K ${kills} / D ${deaths}`;

    if (!alive) {
      const seconds = Math.max(0, Math.ceil((respawnAt - Date.now()) / 1000));
      this.combatStatus.textContent = 'You are down.';
      this.respawnText.textContent = seconds > 0 ? `Respawning in ${seconds}s` : 'Respawning...';
      this.respawnText.classList.add('is-visible');
      return;
    }

    this.respawnText.classList.remove('is-visible');
    if (isReloading) {
      const remainingMs = Math.max(0, reloadEndsAt - Date.now());
      const seconds = (remainingMs / 1000).toFixed(1);
      this.combatStatus.textContent = `Reloading${remainingMs > 0 ? ` (${seconds}s)` : '...'}`;
    } else if (!armed) {
      this.combatStatus.textContent = 'Find a pistol pickup to start blasting.';
    } else {
      this.combatStatus.textContent = 'Armed and ready.';
    }
  }

  setHitMarkerVisible(visible) {
    this.hitMarker.classList.toggle('is-visible', visible);
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
