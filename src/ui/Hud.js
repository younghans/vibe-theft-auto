import { EMOTE_SLOTS } from '../player/emotes.js';

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
    this.chatRoot = this.overlay.querySelector('[data-chat]');
    this.chatTitle = this.overlay.querySelector('[data-chat-title]');
    this.chatSubtitle = this.overlay.querySelector('[data-chat-subtitle]');
    this.chatLog = this.overlay.querySelector('[data-chat-log]');
    this.chatForm = this.overlay.querySelector('[data-chat-form]');
    this.chatInput = this.overlay.querySelector('[data-chat-input]');
    this.chatSend = this.overlay.querySelector('[data-chat-send]');
    this.chatStatus = this.overlay.querySelector('[data-chat-status]');
    this.chatClose = this.overlay.querySelector('[data-chat-close]');
    this.emoteMenu = this.overlay.querySelector('[data-emote-menu]');
    this.emoteWheel = this.overlay.querySelector('[data-emote-wheel]');
    this.emoteSelection = this.overlay.querySelector('[data-emote-selection]');
    this.emoteHint = this.overlay.querySelector('[data-emote-hint]');
    this.emoteSliceNodes = [];
    this.toastTimeout = 0;
    this.lastInteractionState = null;
    this.lastNpcEditorState = null;
    this.buildEmoteWheel();
  }

  createLoading() {
    const node = document.createElement('div');
    node.className = 'loading';
    node.innerHTML = `
      <div class="loading__card">
        <p class="hud__eyebrow">Booting</p>
        <h1 class="loading__title">Stick RPG 3D</h1>
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

  createOverlay() {
    const node = document.createElement('div');
    node.className = 'hud';
    node.innerHTML = `
      <section class="hud__panel">
        <p class="hud__eyebrow">Prototype</p>
        <h1 class="hud__title">Stick RPG 3D</h1>
        <p class="hud__body">WASD to move. Press E near an NPC, door, ATM, or marker. Hold B for emotes.</p>
      </section>
      <button class="hud__mode-toggle" type="button" data-mode-toggle aria-label="Toggle build mode" title="Toggle build mode">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.5 3.5l6 6" />
          <path d="M13 5l4.5-1.5-1.5 4.5" />
          <path d="M4.5 19.5l7.7-7.7 3.5 3.5L8 23H4.5v-3.5z" />
          <path d="M9.5 14.5l3.5 3.5" />
        </svg>
      </button>
      <section class="hud__toast">
        <p class="hud__toast-text" data-toast></p>
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
      <section class="hud__chat" data-chat>
        <div class="hud__chat-header">
          <div>
            <p class="hud__eyebrow">Conversation</p>
            <h2 class="hud__dialog-title" data-chat-title></h2>
            <p class="hud__body" data-chat-subtitle></p>
          </div>
          <button class="hud__chat-close" type="button" data-chat-close aria-label="Close chat">Close</button>
        </div>
        <div class="hud__chat-log" data-chat-log></div>
        <form class="hud__chat-form" data-chat-form>
          <textarea class="hud__field-control hud__field-control--textarea hud__chat-input" rows="3" maxlength="280" data-chat-input placeholder="Say something..."></textarea>
          <div class="hud__chat-footer">
            <p class="hud__chat-status" data-chat-status></p>
            <button class="hud__chat-send" type="submit" data-chat-send>Send</button>
          </div>
        </form>
      </section>
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

  bindInteractionEvents({ onAction, onCloseInteraction, onSendChat, onCloseChat }) {
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

    this.chatForm.addEventListener('submit', (event) => {
      event.preventDefault();
      onSendChat(this.chatInput.value);
    });

    this.chatClose.addEventListener('click', () => {
      onCloseChat();
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
    this.modeToggle.title = enabled ? 'Return to player mode' : 'Enter build mode';
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

  setChatState({ visible, title = '', subtitle = '', entries = [], busy = false, error = '', canSend = true }) {
    this.chatRoot.classList.toggle('is-visible', visible);
    if (!visible) {
      return;
    }

    this.chatTitle.textContent = title;
    this.chatSubtitle.textContent = subtitle;
    this.chatStatus.textContent = error || (busy ? 'Waiting for reply...' : 'Public room chat. Everyone in the room sees this conversation.');
    this.chatStatus.classList.toggle('is-error', Boolean(error));
    this.chatInput.disabled = busy || !canSend;
    this.chatSend.disabled = busy || !canSend;

    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
      const row = document.createElement('article');
      row.className = `hud__chat-entry is-${entry.speaker}`;

      const author = document.createElement('p');
      author.className = 'hud__chat-author';
      author.textContent = entry.author;

      const text = document.createElement('p');
      text.className = 'hud__chat-text';
      text.textContent = entry.text;

      row.append(author, text);
      fragment.append(row);
    }

    this.chatLog.replaceChildren(fragment);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  clearChatInput() {
    this.chatInput.value = '';
  }

  focusChatInput() {
    this.chatInput.focus();
    this.chatInput.select();
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
