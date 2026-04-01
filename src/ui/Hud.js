import { EMOTE_SLOTS } from '../player/emotes.js';

export class Hud {
  constructor(root) {
    this.root = root;
    this.loading = this.createLoading();
    this.overlay = this.createOverlay();
    this.promptText = this.overlay.querySelector('[data-prompt]');
    this.toastText = this.overlay.querySelector('[data-toast]');
    this.modeToggle = this.overlay.querySelector('[data-mode-toggle]');
    this.builderRoot = this.overlay.querySelector('[data-builder]');
    this.builderStatus = this.overlay.querySelector('[data-builder-status]');
    this.builderMeta = this.overlay.querySelector('[data-builder-meta]');
    this.builderTabs = this.overlay.querySelector('[data-builder-tabs]');
    this.builderTiles = this.overlay.querySelector('[data-builder-tiles]');
    this.builderCopy = this.overlay.querySelector('[data-builder-copy]');
    this.builderSelection = this.overlay.querySelector('[data-builder-selection]');
    this.builderSelectionRotate = this.overlay.querySelector('[data-builder-selection-rotate]');
    this.builderSelectionDelete = this.overlay.querySelector('[data-builder-selection-delete]');
    this.builderSelectionConfirm = this.overlay.querySelector('[data-builder-selection-confirm]');
    this.emoteMenu = this.overlay.querySelector('[data-emote-menu]');
    this.emoteWheel = this.overlay.querySelector('[data-emote-wheel]');
    this.emoteSelection = this.overlay.querySelector('[data-emote-selection]');
    this.emoteHint = this.overlay.querySelector('[data-emote-hint]');
    this.emoteSliceNodes = [];
    this.toastTimeout = 0;
    this.buildEmoteWheel();
  }

  createLoading() {
    const node = document.createElement('div');
    node.className = 'loading';
    node.innerHTML = `
      <div class="loading__card">
        <p class="hud__eyebrow">Booting</p>
        <h1 class="loading__title">Stick RPG 3D</h1>
        <p class="loading__subtitle">Streaming city blocks and player assets...</p>
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
        <p class="hud__body">WASD to move through the city. Press E near doors, ATMs, and storefront markers. Hold B for emotes.</p>
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
        <p class="hud__eyebrow">World Builder</p>
        <p class="hud__body" data-builder-status>Use the hammer button to enter builder mode.</p>
        <p class="hud__body hud__builder-meta" data-builder-meta></p>
        <div class="hud__builder-tabs" data-builder-tabs></div>
        <div class="hud__builder-grid" data-builder-tiles></div>
        <button class="hud__builder-button hud__builder-copy" type="button" data-builder-copy>Copy Layout JSON</button>
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

  bindBuilderEvents({ onToggleBuildMode, onSelectCategory, onSelectTile, onCopyLayout, onRotateSelection, onDeleteSelection, onConfirmSelection }) {
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

    this.builderSelectionRotate.addEventListener('click', () => {
      onRotateSelection();
    });

    this.builderSelectionDelete.addEventListener('click', () => {
      onDeleteSelection();
    });

    this.builderSelectionConfirm.addEventListener('click', () => {
      onConfirmSelection();
    });
  }

  setBuilderState({ enabled, rotationQuarterTurns, selectedIndex, categories, activeCategoryId }) {
    this.builderRoot.classList.toggle('is-visible', enabled);
    this.modeToggle.classList.toggle('is-active', enabled);
    this.modeToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    this.modeToggle.title = enabled ? 'Return to player mode' : 'Enter build mode';
    const activeCategory = categories.find((entry) => entry.id === activeCategoryId) ?? categories[0];
    const items = activeCategory?.items ?? [];
    this.builderStatus.textContent = enabled
      ? 'Builder active. Left click places the selected piece. Click any existing tile or prop to edit it.'
      : 'Use the hammer button to enter builder mode.';
    this.builderMeta.textContent = enabled
      ? `${activeCategory?.description ?? ''} Rotation: ${rotationQuarterTurns * 90}deg | WASD pans | Mouse wheel zooms | Delete removes selected`
      : 'When active, use tabs to switch layers and 1-9 to choose a piece.';

    this.builderTabs.innerHTML = categories.map((category) => `
      <button
        class="hud__builder-chip${category.id === activeCategoryId ? ' is-active' : ''}"
        type="button"
        data-builder-category="${category.id}"
      >
        ${category.label}
      </button>
    `).join('');

    this.builderTiles.innerHTML = items.map((tile, index) => `
      <button
        class="hud__builder-button${index === selectedIndex ? ' is-active' : ''}"
        type="button"
        data-builder-index="${index}"
      >
        ${index < 9 ? `<span class="hud__builder-key">${index + 1}</span>` : ''}
        <span>${tile.label}</span>
      </button>
    `).join('');
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
