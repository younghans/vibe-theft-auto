import { EMOTE_SLOTS } from '../player/emotes.js';
import { WEAPON_CLIP_SIZE } from '../shared/combatConstants.js';
import { PLAYER_RESPAWN_COST } from '../shared/respawnRules.js';
import { HELD_ITEM_AIM_POSE_FIELDS, HELD_ITEM_IDS, PHONE_GRIP_DEBUG_FIELDS } from '../shared/heldItemDefinitions.js';
import { DRINK_ITEM_IDS, DRUNKNESS_MAX_LEVEL, getDrunknessLevelLabel } from '../shared/bartender.js';
import { assets } from '../world/assetManifest.js';
import {
  BLACKJACK_DEFAULT_WAGER,
  BLACKJACK_MAX_WAGER
} from '../shared/blackjack.js';
import { escapeHtml } from '../shared/htmlEscape.js';
import { getStockTradeValue, normalizeStockTradeQuantity } from '../shared/stockMarket.js';
import { SCHOOL_MICROGAME_IDS } from '../shared/schoolMicrogames.js';
import {
  OFFICE_JOB_GAME_IDS,
  OFFICE_JOB_IDS,
  canPlayerWorkOfficeJob,
  getOfficeJobRequirementSummary,
  listOfficeJobDefinitions
} from '../shared/officeJobs.js';
import {
  VIBE_HERO_LANE_COUNT,
  VIBE_HERO_NOTE_TRAVEL_MS
} from '../shared/vibeHero.js';
import { getAgentTaskPromptTitle } from '../shared/agentTaskSummary.js';
import { NpcSpeechPlayback } from './NpcSpeechPlayback.js';

const TASK_CONFETTI_COLORS = Object.freeze([
  '#ff3d8f',
  '#ff6a2a',
  '#ffd84f',
  '#61ef8a',
  '#38d3ff',
  '#9c6bff',
  '#ffffff'
]);
const TASK_CONFETTI_PARTICLE_COUNT = 190;
const TASK_CONFETTI_DPR_CAP = 2;
const TASK_CONFETTI_MAX_DELTA_SECONDS = 0.034;
const TASK_CONFETTI_CANVAS_BOTTOM_PADDING = 120;
const TASK_CONFETTI_FADE_IN_MS = 90;
const TASK_CONFETTI_FADE_OUT_MS = 760;
const TASK_CONFETTI_DEFAULT_ORIGIN_Y = 72;
const TASK_CONFETTI_ORIGIN_SPREAD_MAX = 280;
const TASK_CONFETTI_UPWARD_CONE_RADIANS = Math.PI * 1.28;
const AMMO_BULLET_RING_RADIUS_PERCENT = 37;
const AMMO_BULLET_STAGGER_MS = 18;
const AMMO_BULLET_MAX_STAGGER_MS = 180;
const AMMO_LOW_CLIP_RATIO = 0.28;
const PHONE_CLOSE_ANIMATION_MS = 260;
const BLACKJACK_CARD_STAGGER_MS = 78;
const BLACKJACK_CARD_ANIMATION_MS = Object.freeze({
  'deal-flip': 350,
  'deal-hidden': 185,
  reveal: 254
});
const INTERACTION_MENU_VIEWPORT_PADDING = 12;
const INTERACTION_MENU_ANCHOR_GAP = 14;
const INTERACTION_MENU_ANCHOR_SIDE_GAP = 18;
const RESPAWN_DEATH_LINES = Object.freeze([
  'You tried your best.',
  'Hope you have health insurance.',
  'The pavement remains undefeated.',
  'That was technically a strategy.',
  'Maybe dodge next time.',
  'Your survival plan had gaps.',
  'The hospital knows you by name now.',
  'Bold choices, terrible outcome.',
  'You were almost intimidating.',
  'At least the deductible is only fifty bucks.',
  'Respawn department: frequent flyer.'
]);

function clampPanelPosition(value, min, max) {
  if (max <= min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function getRespawnDeathLine(deaths = 0) {
  const index = Math.max(0, Math.floor(Number(deaths) || 0) - 1) % RESPAWN_DEATH_LINES.length;
  return RESPAWN_DEATH_LINES[index];
}

const PHONE_APPS = Object.freeze([
  ['messages', 'Messages', 'messages', '#30d66a', 'Story texts will appear here.'],
  ['map', 'Map', 'map', '#3aa4ff', 'A portable city map and waypoint list will live here.'],
  ['missions', 'Missions', 'missions', '#f2ba45', 'Active objectives, rewards, and progress will be grouped here.'],
  ['vibe-radio', 'Vibe Radio', 'radio', '#e85d9a', 'Player-specific music controls and the world playlist live here.'],
  ['wallet', 'Wallet', 'wallet', '#31c98d', 'Cash, cards, memberships, and future passes will be organized here.'],
  ['stocks', 'Stocks', 'stocks', '#55c7ff', 'Street exchange quotes and trades.'],
  ['skills', 'Skills', 'skills', '#68e08f', 'Skill levels and XP progress live here.'],
  ['character', 'Character', 'character', '#f08662', 'Choose your city avatar and keep your selected fighter in sync.'],
  ['settings', 'Settings', 'settings', '#97a4b4', 'Game options and quality-of-life controls will be added here.']
].map(([id, label, icon, color, body]) => Object.freeze({
  id,
  label,
  icon,
  color,
  body
})));

const PHONE_APP_ICON_PATHS = Object.freeze({
  messages: '<path d="M5.5 7.25h13a2.25 2.25 0 0 1 2.25 2.25v4.75a2.25 2.25 0 0 1-2.25 2.25h-6.3l-4.45 3.25v-3.25H5.5a2.25 2.25 0 0 1-2.25-2.25V9.5A2.25 2.25 0 0 1 5.5 7.25Z"/><path d="M7.75 10.5h8.5M7.75 13.25h5.8"/>',
  map: '<path d="m4 6.75 5-2 6 2 5-2v12.5l-5 2-6-2-5 2V6.75Z"/><path d="M9 4.75v12.5M15 6.75v12.5"/><path d="M17.4 9.6 15 12l-1.45-1.45"/>',
  missions: '<path d="M5.5 4.75h10.25L19 8v11.25H5.5V4.75Z"/><path d="M15.5 4.75V8.2H19"/><path d="m8.25 12.05 1.6 1.6 3.65-3.8"/><path d="M8.5 16.25h7"/>',
  radio: '<path d="M6.5 9.75h11A2.5 2.5 0 0 1 20 12.25v4.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.75v-4.5a2.5 2.5 0 0 1 2.5-2.5Z"/><path d="M7.25 9.75 16.9 4.8"/><path d="M8 14.5a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z"/><path d="M15.25 13.15h2.1M15.25 15.85h2.1"/>',
  wallet: '<path d="M4 7.5h13.75A2.25 2.25 0 0 1 20 9.75v7A2.25 2.25 0 0 1 17.75 19H5.25A2.25 2.25 0 0 1 3 16.75v-8A1.25 1.25 0 0 1 4.25 7.5Z"/><path d="M4.75 7.5 15.5 4.85a1.7 1.7 0 0 1 2.1 1.65v1"/><path d="M16.5 12.25h3.5v3.5h-3.5a1.75 1.75 0 1 1 0-3.5Z"/>',
  stocks: '<path d="M4.5 19.25h15"/><path d="M5.75 16.5l4.1-4.1 3.25 2.7 5.6-7.35"/><path d="M16.25 7.75h2.45v2.45"/><path d="M6 7.75h2.2M6 10.8h2.2M6 13.85h1.1"/>',
  skills: '<path d="M5.5 18.75h13"/><path d="M7 17V9.8M12 17V5.25M17 17v-4.7"/><path d="M7 9.8l2.3 1.55L12 5.25l2.6 7.05L17 12.3"/><path d="M4.7 6.2 6 4.9l1.3 1.3M17.1 7.1l1.5-1.5 1.5 1.5"/>',
  character: '<path d="M8.35 9.15a3.65 3.65 0 1 0 7.3 0 3.65 3.65 0 0 0-7.3 0Z"/><path d="M5.25 19.25c.95-2.75 3.45-4.55 6.75-4.55s5.8 1.8 6.75 4.55"/><path d="M4.5 6.25 6.25 4.5 8 6.25"/><path d="M6.25 4.5v4.25"/><path d="m19.5 17.75-1.75 1.75-1.75-1.75"/><path d="M17.75 15.25v4.25"/>',
  settings: '<path d="M10.25 4.75h3.5l.45 2.1c.5.18.98.44 1.42.75l2.02-.68 1.75 3.03-1.58 1.42c.04.26.06.53.06.8s-.02.54-.06.8l1.58 1.42-1.75 3.03-2.02-.68c-.44.31-.92.57-1.42.75l-.45 2.1h-3.5l-.45-2.1a6.18 6.18 0 0 1-1.42-.75l-2.02.68-1.75-3.03 1.58-1.42a5.58 5.58 0 0 1-.06-.8c0-.27.02-.54.06-.8L4.61 9.95l1.75-3.03 2.02.68c.44-.31.92-.57 1.42-.75l.45-2.1Z"/><path d="M9.5 12.17a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z"/>'
});

const PHONE_SKILL_ICON_ENTITIES = Object.freeze({
  strength: '&#127947;',
  agility: '&#127939;',
  intelligence: '&#129504;',
  charisma: '&#128526;'
});

const PHONE_SETTINGS_CONTROLS = Object.freeze([
  Object.freeze({ action: 'Move', control: 'WASD / left touch stick' }),
  Object.freeze({ action: 'Interact', control: 'E / action button' }),
  Object.freeze({ action: 'Phone', control: 'Tab / phone button' }),
  Object.freeze({ action: 'Emotes', control: 'B' }),
  Object.freeze({ action: 'Aim', control: 'Right mouse / right touch stick' }),
  Object.freeze({ action: 'Fire', control: 'Left mouse' }),
  Object.freeze({ action: 'Reload', control: 'R' }),
  Object.freeze({ action: 'Zoom', control: 'Mouse wheel or plus/minus' }),
  Object.freeze({ action: 'Close menus', control: 'Escape' })
]);

const PHONE_MISSION_ICON_ENTITIES = Object.freeze({
  money: '&#128181;',
  package: '&#128230;',
  school: '&#127979;',
  janitor: '&#129529;',
  muscle: '&#128170;',
  chart: '&#128200;',
  'playing-card': '&#127183;',
  skateboard: '&#128761;',
  car: '&#128663;',
  office: '&#128188;',
  charisma: '&#128526;',
  custom: '&#10022;'
});

const PHONE_MISSION_STATUS_LABELS = Object.freeze({
  available: 'Available',
  completed: 'Done',
  inProgress: 'In Progress',
  locked: 'Locked'
});

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

function getPhoneAppById(appId = '') {
  return PHONE_APPS.find((app) => app.id === appId) ?? null;
}

function getPhoneAppIconMarkup(app, extraClass = '') {
  const iconPaths = PHONE_APP_ICON_PATHS[app.icon] ?? PHONE_APP_ICON_PATHS.settings;
  const className = `hud__phone-app-icon${extraClass ? ` ${extraClass}` : ''}`;
  return `
    <span class="${escapeHtml(className)}" aria-hidden="true">
      <svg class="hud__phone-app-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" focusable="false">
        ${iconPaths}
      </svg>
    </span>
  `;
}

function getPhoneAppButtonMarkup(app) {
  return `
    <button
      class="hud__phone-app"
      type="button"
      data-phone-app="${escapeHtml(app.id)}"
      style="--phone-app-color:${escapeHtml(app.color)}"
    >
      ${getPhoneAppIconMarkup(app)}
      <span class="hud__phone-app-label">${escapeHtml(app.label)}</span>
    </button>
  `;
}

function getPhoneHomeMarkup() {
  return `
    <div class="hud__phone-home-screen">
      <div class="hud__phone-app-grid">
        ${PHONE_APPS.map((app) => getPhoneAppButtonMarkup(app)).join('')}
      </div>
    </div>
  `;
}

function getPhoneCharacterAppMarkup(app) {
  return `
    <div
      class="hud__phone-app-panel hud__phone-character-app"
      data-phone-character-app
      style="--phone-app-color:${escapeHtml(app.color)}"
    >
      <div class="hud__phone-app-panel-head">
        <button class="hud__phone-nav-button" type="button" data-phone-home aria-label="Back to phone home">
          <span aria-hidden="true">&lsaquo;</span>
        </button>
      </div>
      <div class="hud__phone-character-stage-shell">
        <button class="hud__phone-character-nav" type="button" data-phone-character-prev aria-label="Previous character">
          <span aria-hidden="true">&#8249;</span>
        </button>
        <div class="hud__phone-character-stage">
          <div class="hud__phone-character-stage-glow" aria-hidden="true"></div>
          <div class="hud__phone-character-preview" data-phone-character-preview></div>
        </div>
        <button class="hud__phone-character-nav" type="button" data-phone-character-next aria-label="Next character">
          <span aria-hidden="true">&#8250;</span>
        </button>
      </div>
      <div class="hud__phone-character-status" data-phone-character-status>Character</div>
    </div>
  `;
}

function getPhoneMissionsAppMarkup(app) {
  return `
    <div
      class="hud__phone-app-panel hud__phone-missions-app"
      data-phone-missions-app
      style="--phone-app-color:${escapeHtml(app.color)}"
    >
      <div class="hud__phone-app-panel-head hud__phone-missions-head">
        <button class="hud__phone-nav-button" type="button" data-phone-home aria-label="Back to phone home">
          <span aria-hidden="true">&lsaquo;</span>
        </button>
        <div class="hud__phone-missions-title-block">
          <h2>Missions</h2>
          <p data-phone-missions-count>Loading objectives</p>
        </div>
      </div>
      <section class="hud__phone-missions-current" data-phone-missions-current aria-label="Current mission"></section>
      <section class="hud__phone-missions-list" data-phone-missions-list aria-label="Mission list"></section>
    </div>
  `;
}

function getVibeRadioControlsMarkup({
  context = 'main',
  playing = false,
  volume = 0.5,
  disabled = false
} = {}) {
  const signature = getVibeRadioControlsSignature({ context, playing, volume, disabled });
  const dataPrefix = context === 'phone' ? 'data-phone-vibe-radio-action' : 'data-vibe-radio-action';
  const volumeData = context === 'phone' ? 'data-phone-vibe-radio-volume' : 'data-vibe-radio-volume';
  const disabledAttr = disabled ? ' disabled' : '';
  const safeVolume = Math.max(0, Math.min(1, Number(volume) || 0));
  const playLabel = playing ? 'Pause' : 'Play';
  const playIcon = playing
    ? '<path d="M8.25 6.5h2.5v11h-2.5zM13.25 6.5h2.5v11h-2.5z" />'
    : '<path d="M8.25 5.75v12.5L17 12 8.25 5.75Z" />';

  return `
    <div class="hud__vibe-radio-controls${context === 'phone' ? ' is-phone' : ''}" data-vibe-radio-controls-signature="${escapeHtml(signature)}">
      <button class="hud__vibe-radio-control" type="button" ${dataPrefix}="rewind" aria-label="Rewind vibe radio" title="Rewind"${disabledAttr}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M11 6.25 4.75 12 11 17.75V6.25Z" />
          <path d="M19 6.25 12.75 12 19 17.75V6.25Z" />
        </svg>
      </button>
      <button class="hud__vibe-radio-control is-play" type="button" ${dataPrefix}="play" aria-label="${playLabel} vibe radio" title="${playLabel}"${disabledAttr}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${playIcon}</svg>
      </button>
      <button class="hud__vibe-radio-control" type="button" ${dataPrefix}="forward" aria-label="Fast forward vibe radio" title="Fast forward"${disabledAttr}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M13 6.25 19.25 12 13 17.75V6.25Z" />
          <path d="M5 6.25 11.25 12 5 17.75V6.25Z" />
        </svg>
      </button>
      <label class="hud__vibe-radio-volume" title="Radio volume" aria-label="Radio volume">
        <span class="hud__vibe-radio-volume-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M4.5 9.25h3.4l4.6-3.7v12.9l-4.6-3.7H4.5v-5.5Z" />
            <path d="M15.5 8.35a5 5 0 0 1 0 7.3" />
          </svg>
        </span>
        <input class="hud__vibe-radio-volume-slider" type="range" min="0" max="100" step="1" value="${Math.round(safeVolume * 100)}" style="--radio-volume:${(safeVolume * 100).toFixed(1)}%" aria-label="Radio volume" ${volumeData}${disabledAttr} />
      </label>
    </div>
  `;
}

function getVibeRadioControlsSignature({
  context = 'main',
  playing = false,
  disabled = false
} = {}) {
  return [
    context,
    playing ? 'playing' : 'paused',
    disabled ? 'disabled' : 'enabled'
  ].join(':');
}

function syncVibeRadioControlsElement(root, { volume = 0.5 } = {}) {
  const input = root?.querySelector?.('.hud__vibe-radio-volume-slider');
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  const safeVolume = Math.max(0, Math.min(1, Number(volume) || 0));
  const value = String(Math.round(safeVolume * 100));
  if (input.value !== value) {
    input.value = value;
  }
  input.style.setProperty('--radio-volume', `${(safeVolume * 100).toFixed(1)}%`);
}

function getPhoneVibeRadioAppMarkup(app) {
  return `
    <div
      class="hud__phone-app-panel hud__phone-vibe-radio-app"
      data-phone-vibe-radio-app
      style="--phone-app-color:${escapeHtml(app.color)}"
    >
      <div class="hud__phone-app-panel-head hud__phone-vibe-radio-head">
        <button class="hud__phone-nav-button" type="button" data-phone-home aria-label="Back to phone home">
          <span aria-hidden="true">&lsaquo;</span>
        </button>
        <div>
          <h2>Vibe Radio</h2>
          <p data-phone-vibe-radio-status>Playlist syncing</p>
        </div>
      </div>
      <section class="hud__phone-vibe-radio-now" data-phone-vibe-radio-now></section>
      <section class="hud__phone-vibe-radio-list" data-phone-vibe-radio-list aria-label="Vibe Radio song list"></section>
      <footer class="hud__phone-vibe-radio-footer" data-phone-vibe-radio-controls>
        ${getVibeRadioControlsMarkup({ context: 'phone', disabled: true })}
      </footer>
    </div>
  `;
}

function getPhoneWalletAppMarkup(app) {
  return `
    <div
      class="hud__phone-app-panel hud__phone-wallet-app"
      data-phone-wallet-app
      style="--phone-app-color:${escapeHtml(app.color)}"
    >
      <div class="hud__phone-app-panel-head hud__phone-wallet-head">
        <button class="hud__phone-nav-button" type="button" data-phone-home aria-label="Back to phone home">
          <span aria-hidden="true">&lsaquo;</span>
        </button>
        <div>
          <h2>Wallet</h2>
          <p data-phone-wallet-status>Syncing</p>
        </div>
      </div>
      <section class="hud__phone-wallet-balance">
        <span>Cash</span>
        <strong data-phone-wallet-cash>$0</strong>
      </section>
      <section class="hud__phone-wallet-stats" data-phone-wallet-stats></section>
      <section class="hud__phone-wallet-holdings" data-phone-wallet-holdings></section>
      <button class="hud__phone-wallet-stocks-button" type="button" data-phone-wallet-stocks>Stocks</button>
    </div>
  `;
}

function getPhoneStocksAppMarkup(app) {
  return `
    <div
      class="hud__phone-app-panel hud__phone-stocks-app"
      data-phone-stocks-app
      style="--phone-app-color:${escapeHtml(app.color)}"
    >
      <div class="hud__phone-app-panel-head hud__phone-stocks-head">
        <button class="hud__phone-nav-button" type="button" data-phone-home aria-label="Back to phone home">
          <span aria-hidden="true">&lsaquo;</span>
        </button>
        <div>
          <h2>Stocks</h2>
          <p data-phone-stocks-status>Syncing tape</p>
        </div>
        <button class="hud__phone-stocks-refresh" type="button" data-phone-stocks-refresh aria-label="Refresh stocks" title="Refresh stocks">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M19 6v5h-5" />
            <path d="M5 18v-5h5" />
            <path d="M17.9 10.8A6.5 6.5 0 0 0 6.7 7.7L5 9.2" />
            <path d="M6.1 13.2a6.5 6.5 0 0 0 11.2 3.1L19 14.8" />
          </svg>
        </button>
      </div>
      <section class="hud__phone-stocks-summary" data-phone-stocks-summary></section>
      <section class="hud__phone-stocks-chart" data-phone-stocks-chart aria-label="All stock prices"></section>
      <section class="hud__phone-stocks-list" data-phone-stocks-list aria-label="Stock list"></section>
      <section class="hud__phone-stocks-detail" data-phone-stocks-detail aria-label="Selected stock"></section>
      <footer class="hud__phone-stocks-trade">
        <label class="hud__phone-stocks-quantity">
          <span>Shares</span>
          <input type="number" min="1" step="1" value="1" data-phone-stock-quantity />
        </label>
        <button class="hud__phone-stock-trade-button is-buy" type="button" data-phone-stock-trade="buy">Buy</button>
        <button class="hud__phone-stock-trade-button is-sell" type="button" data-phone-stock-trade="sell">Sell</button>
      </footer>
    </div>
  `;
}

function getPhoneSkillsAppMarkup(app) {
  return `
    <div
      class="hud__phone-app-panel hud__phone-skills-app"
      data-phone-skills-app
      style="--phone-app-color:${escapeHtml(app.color)}"
    >
      <div class="hud__phone-app-panel-head hud__phone-skills-head">
        <button class="hud__phone-nav-button" type="button" data-phone-home aria-label="Back to phone home">
          <span aria-hidden="true">&lsaquo;</span>
        </button>
        <div>
          <h2>Skills</h2>
          <p data-phone-skills-summary>Loading progress</p>
        </div>
      </div>
      <section class="hud__phone-skills-list" data-phone-skills-list></section>
    </div>
  `;
}

function getPhoneMapAppMarkup(app) {
  return `
    <div
      class="hud__phone-app-panel hud__phone-map-app"
      data-phone-map-app
      style="--phone-app-color:${escapeHtml(app.color)}"
    >
      <div class="hud__phone-app-panel-head hud__phone-map-head">
        <button class="hud__phone-nav-button" type="button" data-phone-home aria-label="Back to phone home">
          <span aria-hidden="true">&lsaquo;</span>
        </button>
        <div>
          <h2>Map</h2>
          <p data-phone-map-status>Locating</p>
        </div>
        <div class="hud__phone-map-controls" aria-label="Map zoom controls">
          <button class="hud__phone-map-zoom" type="button" data-phone-map-zoom="-1" data-phone-map-zoom-out aria-label="Zoom out">-</button>
          <span data-phone-map-zoom-label>100%</span>
          <button class="hud__phone-map-zoom" type="button" data-phone-map-zoom="1" data-phone-map-zoom-in aria-label="Zoom in">+</button>
        </div>
      </div>
      <section class="hud__phone-map-canvas" data-phone-map-canvas aria-label="City map"></section>
    </div>
  `;
}

function getPhoneSettingsAppMarkup(app) {
  return `
    <div
      class="hud__phone-app-panel hud__phone-settings-app"
      data-phone-settings-app
      style="--phone-app-color:${escapeHtml(app.color)}"
    >
      <div class="hud__phone-app-panel-head hud__phone-settings-head">
        <button class="hud__phone-nav-button" type="button" data-phone-home aria-label="Back to phone home">
          <span aria-hidden="true">&lsaquo;</span>
        </button>
        <div>
          <h2>Settings</h2>
          <p>Audio and controls</p>
        </div>
      </div>
      <section class="hud__phone-settings-section">
        <div class="hud__phone-settings-section-head">
          <span>Audio</span>
          <strong data-phone-setting-audio-value>82%</strong>
        </div>
        <input class="hud__phone-settings-slider" type="range" min="0" max="100" step="1" value="82" data-phone-setting-audio />
      </section>
      <section class="hud__phone-settings-section hud__phone-settings-controls">
        <div class="hud__phone-settings-section-head">
          <span>Controls</span>
        </div>
        <div class="hud__phone-settings-control-list">
          ${PHONE_SETTINGS_CONTROLS.map((control) => `
            <div class="hud__phone-settings-control-row">
              <strong>${escapeHtml(control.action)}</strong>
              <span>${escapeHtml(control.control)}</span>
            </div>
          `).join('')}
        </div>
      </section>
    </div>
  `;
}

function getPhoneAppPanelMarkup(app) {
  if (app.id === 'character') {
    return getPhoneCharacterAppMarkup(app);
  }

  if (app.id === 'missions') {
    return getPhoneMissionsAppMarkup(app);
  }

  if (app.id === 'vibe-radio') {
    return getPhoneVibeRadioAppMarkup(app);
  }

  if (app.id === 'wallet') {
    return getPhoneWalletAppMarkup(app);
  }

  if (app.id === 'stocks') {
    return getPhoneStocksAppMarkup(app);
  }

  if (app.id === 'skills') {
    return getPhoneSkillsAppMarkup(app);
  }

  if (app.id === 'map') {
    return getPhoneMapAppMarkup(app);
  }

  if (app.id === 'settings') {
    return getPhoneSettingsAppMarkup(app);
  }

  return `
    <div
      class="hud__phone-app-panel"
      style="--phone-app-color:${escapeHtml(app.color)}"
    >
      <div class="hud__phone-app-panel-head">
        <button class="hud__phone-nav-button" type="button" data-phone-home aria-label="Back to phone home">
          <span aria-hidden="true">&lsaquo;</span>
        </button>
      </div>
      <h2>${escapeHtml(app.label)}</h2>
      <p>${escapeHtml(app.body)}</p>
    </div>
  `;
}

function getPhoneScreenMarkup(activeAppId = '') {
  const activeApp = getPhoneAppById(activeAppId);
  return activeApp ? getPhoneAppPanelMarkup(activeApp) : getPhoneHomeMarkup();
}

function formatMoneyAmount(value) {
  const numeric = Number(value ?? 0);
  const amount = Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
  const formattedAmount = Math.abs(amount).toLocaleString('en-US');
  return amount < 0 ? `-$${formattedAmount}` : `$${formattedAmount}`;
}

function formatMediaTime(seconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatStockMoney(value) {
  const numeric = Number(value ?? 0);
  const amount = Number.isFinite(numeric) ? numeric : 0;
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatStockPercent(value) {
  const numeric = Number(value ?? 0);
  const amount = Number.isFinite(numeric) ? numeric : 0;
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount.toFixed(2)}%`;
}

function formatSignedStockMoney(value) {
  const numeric = Number(value ?? 0);
  const amount = Number.isFinite(numeric) ? numeric : 0;
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${formatStockMoney(Math.abs(amount))}`;
}

function getStockTrendClass(value) {
  const numeric = Number(value ?? 0);
  if (numeric > 0) {
    return 'is-up';
  }
  if (numeric < 0) {
    return 'is-down';
  }
  return 'is-flat';
}

function getBlackjackSuitSymbol(suit = '') {
  switch (suit) {
    case 'H':
      return '&hearts;';
    case 'D':
      return '&diams;';
    case 'C':
      return '&clubs;';
    case 'S':
      return '&spades;';
    default:
      return '?';
  }
}

function getBlackjackSuitLabel(suit = '') {
  switch (suit) {
    case 'H':
      return 'Hearts';
    case 'D':
      return 'Diamonds';
    case 'C':
      return 'Clubs';
    case 'S':
      return 'Spades';
    default:
      return 'Unknown';
  }
}

function getBlackjackCardSignature(card = {}, index = 0) {
  if (card?.hidden) {
    return `hidden:${index}`;
  }
  const code = String(card?.code ?? '').trim();
  if (code) {
    return code;
  }
  return `${String(card?.rank ?? '?')}${String(card?.suit ?? '?')}:${index}`;
}

function getBlackjackCardDealOrigin(handKey = 'player', index = 0) {
  const x = Math.max(34, 92 - index * 14);
  return {
    dealX: `${x}px`,
    dealY: handKey === 'dealer' ? '96px' : '-108px',
    dealRotate: handKey === 'dealer' ? '8deg' : '-7deg'
  };
}

function getBlackjackPlayerHandCards(hand = {}) {
  return Array.isArray(hand?.cards) ? hand.cards : [];
}

function createBlackjackCardVisuals({
  game = null,
  dealerHand = [],
  playerHand = [],
  playerHands = [],
  previousState = null
} = {}) {
  const sessionId = String(game?.id ?? '');
  const sameSession = Boolean(sessionId && previousState?.sessionId === sessionId);
  const splitHands = Array.isArray(playerHands) && playerHands.length > 0
    ? playerHands.map(getBlackjackPlayerHandCards)
    : [playerHand];
  const activeHandIndex = Math.max(
    0,
    Math.min(splitHands.length - 1, Math.trunc(Number(game?.activeHandIndex ?? 0) || 0))
  );
  const previous = sameSession ? previousState : { dealer: [], player: [], playerHands: [] };
  const previousPlayerHands = Array.isArray(previous?.playerHands) && previous.playerHands.length > 0
    ? previous.playerHands
    : splitHands.length > 1 && Array.isArray(previous?.player)
      ? previous.player.map((signature) => [signature])
      : [previous?.player ?? []];
  const visuals = { dealer: [], player: [], playerHands: [] };
  const nextState = {
    sessionId,
    dealer: dealerHand.map(getBlackjackCardSignature),
    player: [],
    playerHands: splitHands.map((cards) => cards.map(getBlackjackCardSignature))
  };
  nextState.player = nextState.playerHands[activeHandIndex] ?? nextState.playerHands[0] ?? [];

  const assignVisuals = (handKey, cards, nextSignatures, previousSignatures, target) => {
    cards.forEach((card, index) => {
      const signature = nextSignatures[index];
      const previousSignature = previousSignatures?.[index] ?? '';
      const wasHidden = previousSignature.startsWith('hidden:');
      const isHidden = signature.startsWith('hidden:');
      const isNew = !sameSession || !previousSignature;
      const isReveal = sameSession && wasHidden && !isHidden;
      const animation = isNew
        ? (card?.hidden ? 'deal-hidden' : 'deal-flip')
        : isReveal
          ? 'reveal'
          : '';

      target[index] = {
        animation,
        delay: 0,
        ...getBlackjackCardDealOrigin(handKey, index)
      };
    });
  };

  assignVisuals('dealer', dealerHand, nextState.dealer, previous.dealer, visuals.dealer);
  splitHands.forEach((cards, handIndex) => {
    visuals.playerHands[handIndex] = [];
    assignVisuals(
      `player${handIndex}`,
      cards,
      nextState.playerHands[handIndex],
      previousPlayerHands[handIndex],
      visuals.playerHands[handIndex]
    );
  });
  visuals.player = visuals.playerHands[activeHandIndex] ?? visuals.playerHands[0] ?? [];

  const animatedSlots = [];
  const usedSlots = new Set();
  const pushSlot = (handKey, index) => {
    const slotId = `${handKey}:${index}`;
    const target = handKey === 'dealer'
      ? visuals.dealer
      : visuals.playerHands[Number(handKey.replace('player', ''))] ?? [];
    if (usedSlots.has(slotId) || !target[index]?.animation) {
      return;
    }
    usedSlots.add(slotId);
    animatedSlots.push({ handKey, index });
  };

  const pushPlayerSlots = () => {
    splitHands.forEach((cards, handIndex) => {
      cards.forEach((_, index) => pushSlot(`player${handIndex}`, index));
    });
  };

  if (sameSession) {
    pushPlayerSlots();
    dealerHand.forEach((_, index) => pushSlot('dealer', index));
  } else {
    [
      ['player0', 0],
      ['dealer', 0],
      ['player0', 1],
      ['dealer', 1]
    ].forEach(([handKey, index]) => pushSlot(handKey, index));
    pushPlayerSlots();
    dealerHand.forEach((_, index) => pushSlot('dealer', index));
  }

  let duration = 0;
  animatedSlots.forEach(({ handKey, index }, sequence) => {
    const target = handKey === 'dealer'
      ? visuals.dealer
      : visuals.playerHands[Number(handKey.replace('player', ''))] ?? [];
    const animation = target[index].animation;
    target[index].delay = sequence * BLACKJACK_CARD_STAGGER_MS;
    duration = Math.max(
      duration,
      target[index].delay + (BLACKJACK_CARD_ANIMATION_MS[animation] ?? 0)
    );
  });

  return { visuals, nextState, duration };
}

function createBlackjackCardMarkup(card = {}, index = 0, visual = {}) {
  const rank = escapeHtml(card?.rank ?? '?');
  const suit = String(card?.suit ?? '');
  const redClass = suit === 'H' || suit === 'D' ? ' is-red' : '';
  const hiddenClass = card?.hidden ? ' is-hidden-card' : '';
  const faceClass = card?.hidden ? ' is-face-down' : ' is-face-up';
  const animationClass = visual?.animation ? ` is-${visual.animation}` : '';
  const suitSymbol = getBlackjackSuitSymbol(suit);
  const cardLabel = card?.hidden
    ? 'Face-down card'
    : `${rank} of ${escapeHtml(getBlackjackSuitLabel(suit))}`;
  const style = [
    `--card-index:${index}`,
    `--deal-delay:${Number(visual?.delay ?? 0)}ms`,
    `--deal-x:${visual?.dealX ?? '64px'}`,
    `--deal-y:${visual?.dealY ?? '-84px'}`,
    `--deal-rotate:${visual?.dealRotate ?? '7deg'}`
  ].join(';');

  return `
    <span
      class="hud__blackjack-card${redClass}${hiddenClass}${faceClass}${animationClass}"
      style="${style}"
      aria-label="${cardLabel}"
    >
      <span class="hud__blackjack-card-inner">
        <span class="hud__blackjack-card-face hud__blackjack-card-front">
          ${card?.hidden ? '' : `
            <span class="hud__blackjack-card-corner">${rank}</span>
            <span class="hud__blackjack-card-suit">${suitSymbol}</span>
            <span class="hud__blackjack-card-corner is-bottom">${rank}</span>
          `}
        </span>
        <span class="hud__blackjack-card-face hud__blackjack-card-back-face">
          <span class="hud__blackjack-card-back"></span>
        </span>
        <span class="hud__blackjack-card-edge" aria-hidden="true"></span>
      </span>
    </span>
  `;
}

function getBlackjackSplitOutcomeText(outcome = '', active = false) {
  if (active) {
    return 'Active';
  }
  if (outcome === 'win') {
    return 'Win';
  }
  if (outcome === 'push') {
    return 'Push';
  }
  if (outcome === 'bust') {
    return 'Bust';
  }
  if (outcome === 'stand') {
    return 'Stand';
  }
  if (outcome === 'dealer_win' || outcome === 'dealer_blackjack') {
    return 'Loss';
  }
  return 'Waiting';
}

function createBlackjackSplitHandMarkup(hand = {}, index = 0, visuals = []) {
  const cards = getBlackjackPlayerHandCards(hand);
  const active = hand?.active === true;
  const outcome = String(hand?.outcome ?? '');
  const activeClass = active ? ' is-active' : '';
  const outcomeClass = outcome ? ` is-${outcome.replaceAll('_', '-')}` : '';
  const value = cards.length ? String(hand?.value ?? '-') : '-';
  const wager = Math.max(0, Math.trunc(Number(hand?.wager ?? 0) || 0));
  const label = escapeHtml(hand?.label ?? `Hand ${index + 1}`);
  const status = getBlackjackSplitOutcomeText(outcome, active);
  const cardMarkup = cards.length
    ? cards.map((card, cardIndex) =>
      createBlackjackCardMarkup(card, cardIndex, visuals[cardIndex])
    ).join('')
    : '<span class="hud__blackjack-card-slot"></span><span class="hud__blackjack-card-slot"></span>';

  return `
    <section class="hud__blackjack-split-hand${activeClass}${outcomeClass}">
      <div class="hud__blackjack-split-head">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
      <div class="hud__blackjack-split-cards">${cardMarkup}</div>
      <div class="hud__blackjack-split-meta">
        <span>${formatMoneyAmount(wager)}</span>
        <span>${status}</span>
      </div>
    </section>
  `;
}

function formatMicrogameSeconds(remainingMs = 0) {
  const seconds = Math.max(0, Number(remainingMs) || 0) / 1000;
  return seconds < 10 ? seconds.toFixed(1) : String(Math.ceil(seconds));
}

function getSchoolCountdownCue(game = null) {
  const data = game?.data ?? {};
  const remainingMs = Math.max(0, Number(game?.remainingMs ?? data.countdownMs ?? 0) || 0);
  const goMs = Math.max(0, Number(data.countdownGoMs ?? 0) || 0);
  if (goMs > 0 && remainingMs <= goMs) {
    return 'GO!';
  }
  const stepMs = Math.max(1, Number(data.countdownStepMs ?? 1000) || 1000);
  const countSource = Math.max(1, remainingMs - goMs);
  return String(Math.max(1, Math.min(3, Math.ceil(countSource / stepMs))));
}

function getSchoolMicrogameStatusText(game = null) {
  const phase = String(game?.phase ?? 'ready');
  if (phase === 'countdown') {
    if (game?.context === 'office-job') {
      return getSchoolCountdownCue(game) === 'GO!' ? 'GO!' : 'Starting';
    }
    const roundNumber = Math.max(1, Math.floor(Number(game?.data?.roundNumber ?? 1) || 1));
    return `Round ${roundNumber}`;
  }
  if (phase === 'playing') {
    return `${formatMicrogameSeconds(game?.remainingMs)} seconds`;
  }
  if (phase === 'success') {
    return 'Passed';
  }
  if (phase === 'failure') {
    return 'Failed';
  }
  return 'Ready';
}

function getSchoolMicrogameResultLabel(game = null) {
  const phase = String(game?.phase ?? 'ready');
  if (phase === 'success') {
    return game?.resultTitle || 'Passed';
  }
  if (phase === 'failure') {
    return game?.resultTitle || 'Try again';
  }
  return '';
}

function createSchoolProgressMarkup(value = 0, label = 'Progress') {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  return `
    <div class="hud__school-meter" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent.toFixed(0)}">
      <span class="hud__school-meter-fill" style="--meter:${percent.toFixed(2)}%"></span>
    </div>
  `;
}

function createSchoolTimerMarkup(game = null) {
  const roundDuration = Math.max(1, Number(game?.round?.durationMs ?? 1) || 1);
  const remaining = Math.max(0, Number(game?.remainingMs ?? roundDuration) || 0);
  const percent = Math.max(0, Math.min(100, (remaining / roundDuration) * 100));
  return `
    <div class="hud__school-timer" aria-label="Microgame timer">
      <span class="hud__school-timer-fill" style="--timer:${percent.toFixed(2)}%"></span>
      <strong>${formatMicrogameSeconds(remaining)}</strong>
    </div>
  `;
}

function createSchoolGameButton(action, label, className = '', { disabled = false } = {}) {
  return `
    <button class="hud__school-action${className ? ` ${className}` : ''}" type="button" data-school-microgame-action="${escapeHtml(action)}"${disabled ? ' disabled' : ''}>
      ${escapeHtml(label)}
    </button>
  `;
}

function formatVibeHeroSeconds(milliseconds = 0) {
  const seconds = Math.max(0, Number(milliseconds) || 0) / 1000;
  return seconds < 10 ? seconds.toFixed(1) : String(Math.ceil(seconds));
}

function formatVibeHeroTimestamp(milliseconds = 0) {
  const totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getVibeHeroStatusText(game = null) {
  const phase = String(game?.phase ?? 'select');
  if (phase === 'editor-select') {
    return 'Chart Editor';
  }
  if (phase === 'editor') {
    if (game?.editorRecording) {
      return game?.editorPaused ? 'Recording Paused' : 'Recording';
    }
    return game?.editorPaused ? 'Paused' : 'Editing';
  }
  if (phase === 'countdown') {
    const remainingMs = Math.max(0, Number(game?.countdownMs ?? game?.remainingMs ?? 0) || 0);
    const goMs = Math.max(0, Number(game?.countdownGoMs ?? 0) || 0);
    return goMs > 0 && remainingMs <= goMs ? 'GO!' : 'Ready';
  }
  if (phase === 'playing') {
    return `${formatVibeHeroSeconds(game?.remainingMs)} seconds`;
  }
  if (phase === 'complete') {
    return game?.resultTitle || 'Complete';
  }
  return 'Song Select';
}

function getVibeHeroCountdownCue(game = null) {
  const remainingMs = Math.max(0, Number(game?.countdownMs ?? game?.remainingMs ?? 0) || 0);
  const goMs = Math.max(0, Number(game?.countdownGoMs ?? 0) || 0);
  if (goMs > 0 && remainingMs <= goMs) {
    return 'GO!';
  }
  return String(Math.max(1, Math.min(3, Math.ceil((remainingMs - goMs) / 650))));
}

function createVibeHeroTimerMarkup(game = null) {
  const duration = Math.max(1, Number(game?.durationMs ?? 1) || 1);
  const remaining = Math.max(0, Number(game?.remainingMs ?? duration) || 0);
  const percent = Math.max(0, Math.min(100, (remaining / duration) * 100));
  const label = game?.editorMode
    ? `${formatVibeHeroTimestamp(game?.currentTimeMs)} / ${formatVibeHeroTimestamp(duration)}`
    : formatVibeHeroSeconds(remaining);
  return `
    <div class="hud__vibe-hero-timer" aria-label="Song timer">
      <span class="hud__vibe-hero-timer-fill" style="--timer:${percent.toFixed(2)}%"></span>
      <strong>${escapeHtml(label)}</strong>
    </div>
  `;
}

function createVibeHeroSongSelectMarkup(game = null) {
  const songs = Array.isArray(game?.songs) ? game.songs : [];
  const selectedSongId = String(game?.selectedSongId ?? '');
  const editorMode = game?.editorMode === true;
  return `
    <div class="hud__vibe-hero-select${editorMode ? ' is-editor' : ''}">
      <div class="hud__vibe-hero-record" aria-hidden="true">
        <span></span>
      </div>
      <div class="hud__vibe-hero-song-list">
        ${songs.map((song) => {
          const active = song.id === selectedSongId;
          return `
            <button
              class="hud__vibe-hero-song${active ? ' is-active' : ''}"
              type="button"
              data-vibe-hero-action="song:${escapeHtml(song.id)}"
              style="--song-accent:${escapeHtml(song.previewColor ?? '#54d7ff')}"
            >
              <strong>${escapeHtml(song.title ?? 'Song')}</strong>
              <span>${escapeHtml(`${Math.round((Number(song.durationMs ?? 0) || 0) / 1000)}s | ${song.noteCount ?? 0} notes | ${song.difficulty ?? 'Expert'}${song.chartEdited ? ' | Edited' : ''}`)}</span>
              <em>${escapeHtml(song.performer ?? song.sourceTitle ?? song.artist ?? 'Classical')}</em>
            </button>
          `;
        }).join('')}
      </div>
      <button class="hud__vibe-hero-start" type="button" data-vibe-hero-action="start">${editorMode ? 'Edit Chart' : 'Start'}</button>
    </div>
  `;
}

function createVibeHeroStatsMarkup(game = null) {
  const totalNotes = Math.max(0, Array.isArray(game?.notes) ? game.notes.length : 0);
  const resolved = Math.max(0, Number(game?.hits ?? 0) + Number(game?.misses ?? 0));
  const accuracy = resolved > 0 ? Math.round((Number(game?.hits ?? 0) / resolved) * 100) : 0;
  return `
    <div class="hud__vibe-hero-stats">
      <span><strong>${escapeHtml(String(game?.score ?? 0))}</strong><em>Score</em></span>
      <span><strong>${escapeHtml(String(game?.combo ?? 0))}</strong><em>Combo</em></span>
      <span><strong>${escapeHtml(String(game?.maxCombo ?? 0))}</strong><em>Max</em></span>
      <span><strong>${escapeHtml(String(accuracy))}%</strong><em>${escapeHtml(String(game?.hits ?? 0))}/${escapeHtml(String(totalNotes))}</em></span>
    </div>
  `;
}

function createVibeHeroTrackMarkup(game = null) {
  const notes = Array.isArray(game?.notes) ? game.notes : [];
  const laneCount = Math.max(1, Math.min(8, Math.trunc(Number(game?.laneCount ?? VIBE_HERO_LANE_COUNT) || VIBE_HERO_LANE_COUNT)));
  const phase = String(game?.phase ?? 'select');
  const currentTimeMs = Math.max(0, Number(game?.currentTimeMs ?? 0) || 0);
  const travelMs = Math.max(1, Number(game?.noteTravelMs ?? VIBE_HERO_NOTE_TRAVEL_MS) || VIBE_HERO_NOTE_TRAVEL_MS);
  const hitWindowMs = Math.max(1, Number(game?.hitWindowMs ?? 185) || 185);
  const laneFlashes = Array.isArray(game?.laneFlashes) ? game.laneFlashes : [];
  const renderNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const visibleNotes = notes.filter((note) => {
    if (note.status !== 'pending') {
      return false;
    }
    return note.timeMs >= currentTimeMs - hitWindowMs && note.timeMs <= currentTimeMs + travelMs;
  });
  const hitLineY = 82;

  return `
    <div class="hud__vibe-hero-track" aria-label="Vibe Hero track" style="--lane-count:${laneCount}">
      ${Array.from({ length: laneCount }, (_, laneIndex) => {
        const flash = laneFlashes.find((entry) => entry.lane === laneIndex);
        const flashAgeMs = flash ? Math.max(0, renderNow - (Number(flash.at) || 0)) : 0;
        const showFire = phase === 'playing' && flash && flash.quality !== 'empty';
        const laneNotes = visibleNotes.filter((note) => {
          const lane = Math.max(0, Math.min(laneCount - 1, Math.trunc(Number(note.lane ?? 0) || 0)));
          return lane === laneIndex;
        });
        return `
          <div class="hud__vibe-hero-lane${flash ? ` is-${escapeHtml(flash.quality)}` : ''}">
            <span class="hud__vibe-hero-lane-rail"></span>
            <span class="hud__vibe-hero-fret" style="--hit-y:${hitLineY}%" aria-hidden="true"></span>
            ${showFire ? `
              <span
                class="hud__vibe-hero-hit-fire"
                style="--hit-y:${hitLineY}%; --fire-delay:-${flashAgeMs.toFixed(0)}ms"
                aria-hidden="true"
              >
                <span></span>
              </span>
            ` : ''}
            ${laneNotes.map((note) => {
              const distanceMs = Number(note.timeMs ?? 0) - currentTimeMs;
              const progress = 1 - (distanceMs / travelMs);
              const y = Math.max(4, Math.min(94, 8 + (progress * (hitLineY - 8))));
              return `
                <span
                  class="hud__vibe-hero-note is-lane-${laneIndex}"
                  style="--note-y:${y.toFixed(2)}%; --note-delay:${Math.max(0, distanceMs).toFixed(0)}ms"
                  aria-hidden="true"
                ></span>
              `;
            }).join('')}
          </div>
        `;
      }).join('')}
      <span class="hud__vibe-hero-hit-line" style="--hit-y:${hitLineY}%"></span>
      <div class="hud__vibe-hero-lane-buttons">
        ${Array.from({ length: laneCount }, (_, laneIndex) => `
          <button type="button" data-vibe-hero-action="lane:${laneIndex}">
            <span>${laneIndex + 1}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function createVibeHeroPlayMarkup(game = null) {
  const phase = String(game?.phase ?? 'select');
  const countdown = phase === 'countdown'
    ? `<div class="hud__vibe-hero-countdown"><span>${escapeHtml(getVibeHeroCountdownCue(game))}</span></div>`
    : '';
  const result = phase === 'complete'
    ? `
      <div class="hud__vibe-hero-result">
        <strong>${escapeHtml(game?.resultTitle ?? 'Complete')}</strong>
        <span>${escapeHtml(game?.resultDetail ?? '')}</span>
        <button type="button" data-vibe-hero-action="restart">Replay</button>
      </div>
    `
    : '';

  return `
    <div class="hud__vibe-hero-play">
      ${createVibeHeroStatsMarkup(game)}
      ${createVibeHeroTrackMarkup(game)}
      ${countdown}
      ${result}
    </div>
  `;
}

function createVibeHeroEditorToolbarMarkup(game = null) {
  const noteCount = Math.max(0, Array.isArray(game?.notes) ? game.notes.length : 0);
  const seekStepSeconds = Math.max(1, Math.round((Number(game?.editorSeekStepMs ?? 5000) || 5000) / 1000));
  const currentTime = formatVibeHeroTimestamp(game?.currentTimeMs);
  const recordLabel = game?.editorRecording ? 'Stop R' : 'Record R';
  const playLabel = game?.editorPaused ? 'Play Space' : 'Pause Space';
  return `
    <div class="hud__vibe-hero-editor-toolbar">
      <div class="hud__vibe-hero-editor-meta">
        <span><strong>${escapeHtml(currentTime)}</strong><em>Position</em></span>
        <span><strong>${escapeHtml(String(noteCount))}</strong><em>Notes</em></span>
      </div>
      <div class="hud__vibe-hero-editor-actions">
        <button class="${game?.editorRecording ? 'is-recording' : ''}" type="button" data-vibe-hero-action="editor:record">${escapeHtml(recordLabel)}</button>
        <button type="button" data-vibe-hero-action="editor:rewind">N -${escapeHtml(String(seekStepSeconds))}s</button>
        <button type="button" data-vibe-hero-action="editor:play-pause">${escapeHtml(playLabel)}</button>
        <button type="button" data-vibe-hero-action="editor:forward">M +${escapeHtml(String(seekStepSeconds))}s</button>
      </div>
    </div>
  `;
}

function createVibeHeroEditorMarkup(game = null) {
  return `
    <div class="hud__vibe-hero-editor">
      ${createVibeHeroEditorToolbarMarkup(game)}
      ${createVibeHeroTrackMarkup(game)}
    </div>
  `;
}

function createVibeHeroBodyMarkup(game = null) {
  const phase = String(game?.phase ?? 'select');
  if (phase === 'select' || phase === 'editor-select') {
    return createVibeHeroSongSelectMarkup(game);
  }
  if (phase === 'editor') {
    return createVibeHeroEditorMarkup(game);
  }
  return createVibeHeroPlayMarkup(game);
}

function getBasketballShotStatusText(game = null) {
  const phase = String(game?.phase ?? 'idle');
  if (phase === 'result') {
    return game?.made ? 'Clean Release' : 'Missed';
  }
  if (phase === 'playing') {
    return 'Shot Meter';
  }
  return 'Ready';
}

function getBasketballShotReleaseText(game = null) {
  const release = String(game?.release ?? '');
  if (release === 'clean') {
    return 'Clean';
  }
  if (release === 'great') {
    return 'Slightly Off';
  }
  if (release === 'early') {
    return 'Early';
  }
  if (release === 'late') {
    return 'Late';
  }
  return 'Set';
}

function createBasketballShotMeterMarkup(game = null) {
  const phase = String(game?.phase ?? 'playing');
  const progress = Math.max(0, Math.min(1, Number(game?.progress ?? 0.5) || 0));
  const angle = -82 + (progress * 164);
  const releaseText = getBasketballShotReleaseText(game);
  const releaseClass = String(game?.release ?? 'set');
  const madeClass = game?.made === true ? ' is-made' : game?.made === false ? ' is-miss' : '';
  const disabled = phase !== 'playing' || game?.released === true;
  const score = Math.max(0, Math.min(100, Math.round(Number(game?.score ?? 0) || 0)));

  return `
    <div class="hud__basketball-shot-play${madeClass}">
      <div class="hud__basketball-shot-meter-wrap">
        <button
          class="hud__basketball-shot-meter"
          type="button"
          data-basketball-shot-action="release"
          aria-label="Release basketball shot"
          style="--shot-angle:${angle.toFixed(2)}deg"
          ${disabled ? 'disabled' : ''}
        >
          <span class="hud__basketball-shot-arc" aria-hidden="true"></span>
          <span class="hud__basketball-shot-clean" aria-hidden="true"></span>
          <span class="hud__basketball-shot-needle" aria-hidden="true">
            <span></span>
          </span>
          <span class="hud__basketball-shot-rim" aria-hidden="true"></span>
        </button>
      </div>
      <div class="hud__basketball-shot-readout is-${escapeHtml(releaseClass)}">
        <strong>${escapeHtml(releaseText)}</strong>
        <span>${escapeHtml(phase === 'result' ? `${score}% release` : 'Clean Release')}</span>
      </div>
    </div>
  `;
}

function getSchoolMicrogameRewardText(round = {}, { prefix = false } = {}) {
  const xp = Math.max(0, Math.floor(Number(round.rewardXp ?? 0) || 0));
  const money = Math.max(0, Math.floor(Number(round.rewardMoney ?? 0) || 0));
  return [
    money > 0 ? `${prefix ? '+' : ''}${formatMoneyAmount(money)}` : '',
    xp > 0 ? `${prefix ? '+' : ''}${xp} Intelligence XP` : ''
  ].filter(Boolean).join(' / ');
}

function getOfficeJobRequirementText(job = {}, skills = {}) {
  const intelligence = typeof skills === 'object'
    ? skills.intelligence
    : skills;
  const charismaLevel = typeof skills === 'object'
    ? skills.charismaLevel
    : 0;
  const strengthLevel = typeof skills === 'object'
    ? skills.strengthLevel
    : 0;
  return getOfficeJobRequirementSummary(job, { intelligence, charismaLevel, strengthLevel });
}

const AGENT_TASK_STATUS_LABELS = Object.freeze({
  queued: 'Queued',
  claimed: 'Claimed',
  preparing: 'Preparing',
  coding: 'Coding',
  testing: 'Testing',
  test_failed: 'Tests Failed',
  ready_for_review: 'Ready',
  deploy_queued: 'Deploy Queued',
  deploying: 'Deploying',
  deployed: 'Deployed',
  rolling_back: 'Rolling Back',
  rolled_back: 'Rolled Back',
  failed: 'Failed',
  cancelled: 'Cancelled'
});

const AGENT_TASK_BUSY_STATUSES = new Set([
  'claimed',
  'preparing',
  'coding',
  'testing',
  'deploying',
  'rolling_back'
]);

const AGENT_TASK_CODE_WORK_STATUSES = new Set([
  'claimed',
  'preparing',
  'coding',
  'testing'
]);

const ADMIN_PROMPT_THREAD_LIST_LIMIT = 10;

function isAgentTaskDeployQueued(task = {}) {
  return String(task?.status ?? '') === 'ready_for_review'
    && Number(task?.deployApprovedAt ?? 0) > 0
    && Number(task?.deployStartedAt ?? 0) <= 0;
}

function getAgentTaskDisplayStatus(taskOrStatus = '') {
  if (taskOrStatus && typeof taskOrStatus === 'object' && isAgentTaskDeployQueued(taskOrStatus)) {
    return 'deploy_queued';
  }

  return String(
    taskOrStatus && typeof taskOrStatus === 'object'
      ? taskOrStatus.status
      : taskOrStatus
  );
}

function getAgentTaskStatusLabel(status = '') {
  return AGENT_TASK_STATUS_LABELS[getAgentTaskDisplayStatus(status)] ?? 'Unknown';
}

function getAgentTaskStatusTone(status = '') {
  const normalized = getAgentTaskDisplayStatus(status);
  if (['ready_for_review', 'deployed'].includes(normalized)) {
    return 'is-good';
  }
  if (['failed', 'test_failed', 'cancelled', 'rolled_back'].includes(normalized)) {
    return 'is-bad';
  }
  if (normalized === 'deploy_queued' || AGENT_TASK_BUSY_STATUSES.has(normalized)) {
    return 'is-busy';
  }
  return 'is-muted';
}

function isAgentTaskBusy(status = '') {
  return AGENT_TASK_BUSY_STATUSES.has(String(status ?? ''));
}

function getAgentTaskTimestamp(value = 0) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

function formatAgentTaskDuration(durationMs = 0) {
  const totalSeconds = Math.max(0, Math.floor((Number(durationMs) || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

function getAgentTaskActiveStartedAt(task = {}) {
  const status = String(task?.status ?? '');
  if (AGENT_TASK_CODE_WORK_STATUSES.has(status)) {
    return getAgentTaskTimestamp(task.workStartedAt)
      || getAgentTaskTimestamp(task.claimedAt)
      || getAgentTaskTimestamp(task.createdAt);
  }
  if (status === 'deploying') {
    return getAgentTaskTimestamp(task.deployStartedAt)
      || getAgentTaskTimestamp(task.updatedAt)
      || getAgentTaskTimestamp(task.claimedAt);
  }
  if (status === 'rolling_back') {
    return getAgentTaskTimestamp(task.rollbackStartedAt)
      || getAgentTaskTimestamp(task.updatedAt)
      || getAgentTaskTimestamp(task.claimedAt);
  }
  return 0;
}

function getAgentTaskActiveDurationLabel(task = {}, now = Date.now()) {
  if (!isAgentTaskBusy(task?.status)) {
    return '';
  }
  const startedAt = getAgentTaskActiveStartedAt(task);
  return startedAt > 0 ? formatAgentTaskDuration(Math.max(0, now - startedAt)) : '';
}

function getAgentTaskWorkedDurationLabel(task = {}) {
  const startedAt = getAgentTaskTimestamp(task.workStartedAt)
    || getAgentTaskTimestamp(task.claimedAt);
  const completedAt = getAgentTaskTimestamp(task.workCompletedAt)
    || (String(task.status ?? '') === 'ready_for_review' ? getAgentTaskTimestamp(task.updatedAt) : 0);
  return startedAt > 0 && completedAt >= startedAt
    ? formatAgentTaskDuration(completedAt - startedAt)
    : '';
}

function getAgentTaskWorkedDurationText(task = {}) {
  const duration = getAgentTaskWorkedDurationLabel(task);
  return duration ? `Worked ${duration}` : '';
}

function createAgentTaskStatusBadge(taskOrStatus = '', tagName = 'span') {
  const task = taskOrStatus && typeof taskOrStatus === 'object' ? taskOrStatus : null;
  const normalized = getAgentTaskDisplayStatus(task ?? taskOrStatus ?? 'queued');
  const elementName = tagName === 'em' ? 'em' : 'span';
  const isBusy = isAgentTaskBusy(normalized);
  const busyClass = isBusy ? ' is-working' : '';
  const spinner = isBusy
    ? '<span class="hud__admin-prompt-spinner" aria-hidden="true"></span>'
    : '';
  const activeDuration = task ? getAgentTaskActiveDurationLabel(task) : '';
  const activeTimer = activeDuration
    ? `<span class="hud__admin-prompt-status-time">${escapeHtml(activeDuration)}</span>`
    : '';
  return `<${elementName} class="hud__admin-prompt-status-badge ${escapeHtml(getAgentTaskStatusTone(normalized))}${busyClass}">${spinner}<span>${escapeHtml(getAgentTaskStatusLabel(normalized))}</span>${activeTimer}</${elementName}>`;
}

function getAgentTaskShortId(task = {}) {
  const id = String(task?.id ?? '');
  return id.length > 16 ? id.slice(-13) : id;
}

function formatAgentTaskTime(timestamp = 0) {
  const date = new Date(Number(timestamp) || 0);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) {
    return '';
  }

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function createAgentTaskLink(label, url = '') {
  const href = String(url ?? '').trim();
  if (!href) {
    return '';
  }

  return `<a class="hud__admin-prompt-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function getAdminPromptTabId(tab = '') {
  const normalized = String(tab ?? '').trim();
  return normalized === 'new' ? 'new' : 'threads';
}

function getAdminPromptTabTaskCount(tasks = [], tab = '') {
  const filtered = filterAdminPromptTasksForTab(tasks, tab);
  return filtered.length;
}

function getAgentTaskThreadId(task = {}) {
  return String(task?.threadId || task?.id || '').trim();
}

function getAgentTaskSortTimestamp(task = {}) {
  return Number(task?.createdAt || task?.updatedAt || 0) || 0;
}

function getAgentTaskActivityTimestamp(task = {}) {
  return Math.max(
    getAgentTaskTimestamp(task.updatedAt),
    getAgentTaskTimestamp(task.workCompletedAt),
    getAgentTaskTimestamp(task.workStartedAt),
    getAgentTaskTimestamp(task.deployStartedAt),
    getAgentTaskTimestamp(task.deployedAt),
    getAgentTaskTimestamp(task.rollbackStartedAt),
    getAgentTaskTimestamp(task.rolledBackAt),
    getAgentTaskTimestamp(task.deployApprovedAt),
    getAgentTaskTimestamp(task.rollbackApprovedAt),
    getAgentTaskTimestamp(task.claimedAt),
    getAgentTaskTimestamp(task.createdAt)
  );
}

function sortAgentTasksByCreatedAt(tasks = [], direction = 'desc') {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => (getAgentTaskSortTimestamp(a) - getAgentTaskSortTimestamp(b)) * multiplier);
}

function getAgentThreadTasks(tasks = [], selectedTask = null) {
  const threadId = getAgentTaskThreadId(selectedTask);
  if (!threadId) {
    return [];
  }

  return sortAgentTasksByCreatedAt(
    tasks.filter((task) => getAgentTaskThreadId(task) === threadId),
    'asc'
  );
}

function getAgentThreadLatestTask(threadTasks = []) {
  return sortAgentTasksByCreatedAt(threadTasks)[0] ?? null;
}

function getAgentThreadActivityTimestamp(threadTasks = []) {
  return threadTasks.reduce((latest, task) => Math.max(latest, getAgentTaskActivityTimestamp(task)), 0);
}

function getAgentPromptThreadRows(tasks = []) {
  const groups = new Map();
  for (const task of tasks) {
    const threadId = getAgentTaskThreadId(task);
    if (!threadId) {
      continue;
    }
    if (!groups.has(threadId)) {
      groups.set(threadId, []);
    }
    groups.get(threadId).push(task);
  }

  return [...groups.values()]
    .map((threadTasks) => ({
      latestTask: getAgentThreadLatestTask(threadTasks),
      activityAt: getAgentThreadActivityTimestamp(threadTasks)
    }))
    .filter((thread) => thread.latestTask)
    .sort((a, b) => b.activityAt - a.activityAt)
    .map((thread) => thread.latestTask);
}

function filterAdminPromptTasksForTab(tasks = []) {
  return getAgentPromptThreadRows(tasks);
}

function createAdminPromptTabsMarkup(tasks = []) {
  const count = getAdminPromptTabTaskCount(tasks, 'threads');
  return `
    <button class="hud__admin-prompt-tab is-active" type="button" data-admin-prompt-action="tab:threads" aria-pressed="true">
      <span>Threads</span>
      ${count > 0 ? `<em>${escapeHtml(String(count))}</em>` : ''}
    </button>
  `;
}

function getAgentTaskTitle(task = {}) {
  const label = String(task.contextLabel || task.gameId || task.contextType || task.scope || 'Game').trim();
  return label || 'Game';
}

function getAgentTaskThreadTitle(task = {}) {
  const label = String(task.threadTitle || '').trim();
  return label || getAgentTaskPromptTitle(task);
}

function getAgentTaskContextLine(task = {}, time = '') {
  return [
    getAgentTaskTitle(task),
    getAgentTaskShortId(task),
    time,
    String(task.status ?? '') === 'ready_for_review' ? getAgentTaskWorkedDurationText(task) : ''
  ].filter(Boolean).join(' - ');
}

function createAgentTaskListMarkup(
  tasks = [],
  selectedTaskId = '',
  activeTab = 'threads',
  threadLimit = ADMIN_PROMPT_THREAD_LIST_LIMIT
) {
  const threadRows = filterAdminPromptTasksForTab(tasks);
  const safeLimit = Math.max(ADMIN_PROMPT_THREAD_LIST_LIMIT, Math.floor(Number(threadLimit) || 0));
  const visibleTasks = threadRows.slice(0, safeLimit);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedThreadId = getAgentTaskThreadId(selectedTask);
  const newThreadMarkup = `
    <button class="hud__admin-prompt-task hud__admin-prompt-task--new${activeTab === 'new' ? ' is-active' : ''}" type="button" data-admin-prompt-action="new-thread">
      <span class="hud__admin-prompt-new-thread-icon" aria-hidden="true">+</span>
      <span>
        <strong>New Thread</strong>
        <small>Start a new prompt</small>
      </span>
    </button>
  `;
  const threadMarkup = visibleTasks.map((task) => {
    const threadTasks = getAgentThreadTasks(tasks, task);
    const activeClass = getAgentTaskThreadId(task) === selectedThreadId ? ' is-active' : '';
    const time = formatAgentTaskTime(task.updatedAt || task.createdAt);
    return `
      <button class="hud__admin-prompt-task${activeClass}" type="button" data-admin-prompt-action="select:${escapeHtml(task.id)}">
        <span>
          <strong>${escapeHtml(getAgentTaskThreadTitle(task))}</strong>
          <small>${escapeHtml(`${getAgentTaskContextLine(task, time)}${threadTasks.length > 1 ? ` - ${threadTasks.length} turns` : ''}`)}</small>
        </span>
        ${createAgentTaskStatusBadge(task, 'em')}
      </button>
    `;
  }).join('');
  const hiddenCount = Math.max(0, threadRows.length - visibleTasks.length);
  const loadMoreMarkup = hiddenCount > 0
    ? `
      <button class="hud__admin-prompt-load-more" type="button" data-admin-prompt-action="load-more">
        Load more
      </button>
    `
    : '';
  const emptyMarkup = !threadMarkup
    ? '<div class="hud__admin-prompt-empty">No prompt threads yet.</div>'
    : '';
  return `${newThreadMarkup}${threadMarkup}${loadMoreMarkup}${emptyMarkup}`;
}

function formatAgentTaskMessage(value = '') {
  return escapeHtml(value).replace(/\r?\n/gu, '<br>');
}

function getAgentTaskCompletionMessage(task = {}) {
  return getVisibleAgentTaskMessage(task.agentMessage);
}

function isHiddenAgentTaskMessageSectionHeading(line = '') {
  return /^(?:#{1,6}\s*)?(?:verification|validation|verifications|validations|verified|tests?|testing|checks?|smoke checks?)(?:\s+(?:passed|complete|completed|notes?))?\s*:?\s*$/iu
    .test(String(line ?? '').trim());
}

function isVisibleAgentTaskMessageSectionHeading(line = '') {
  return /^(?:#{1,6}\s*)?(?:changed|changes|key changes|added|implemented|updated|fixed|details|summary)\s*:?\s*$/iu
    .test(String(line ?? '').trim());
}

function collapseAgentTaskMessageBlankLines(lines = []) {
  const collapsed = [];
  for (const line of lines) {
    const isBlank = !String(line ?? '').trim();
    if (isBlank && (!collapsed.length || !String(collapsed.at(-1) ?? '').trim())) {
      continue;
    }
    collapsed.push(line);
  }

  while (collapsed.length && !String(collapsed.at(-1) ?? '').trim()) {
    collapsed.pop();
  }

  return collapsed;
}

function getVisibleAgentTaskMessage(value = '') {
  const lines = String(value || '').replace(/\r\n/gu, '\n').split('\n');
  const visibleLines = [];
  let hiddenSection = false;
  for (const line of lines) {
    if (isHiddenAgentTaskMessageSectionHeading(line)) {
      hiddenSection = true;
      continue;
    }
    if (hiddenSection && isVisibleAgentTaskMessageSectionHeading(line)) {
      hiddenSection = false;
    }
    if (!hiddenSection) {
      visibleLines.push(line);
    }
  }

  return collapseAgentTaskMessageBlankLines(visibleLines).join('\n').trim();
}

function isAgentThreadBusy(threadTasks = []) {
  return threadTasks.some((task) => {
    const status = String(task.status ?? '');
    return ['queued', 'claimed', 'preparing', 'coding', 'testing', 'deploying', 'rolling_back'].includes(status)
      || (status === 'ready_for_review' && Number(task.deployApprovedAt ?? 0) > 0);
  });
}

function createAgentTaskThreadMessageMarkup(threadTasks = []) {
  if (!threadTasks.length) {
    return '<div class="hud__admin-prompt-empty">No thread messages yet.</div>';
  }

  return threadTasks.map((task, index) => {
    const displayStatus = getAgentTaskDisplayStatus(task);
    const time = formatAgentTaskTime(task.updatedAt || task.createdAt);
    const agentMessage = getAgentTaskCompletionMessage(task);
    const statusMessage = String(task.error || (!agentMessage ? task.summary : '') || '').trim();
    const showStatusMessage = statusMessage && statusMessage !== agentMessage;
    return `
      <section class="hud__admin-prompt-turn">
        <div class="hud__admin-prompt-bubble is-user">
          <header>
            <strong>${index === 0 ? 'Prompt' : 'Follow-up'}</strong>
            ${time ? `<span>${escapeHtml(time)}</span>` : ''}
          </header>
          <p>${formatAgentTaskMessage(task.prompt || 'Prompt unavailable.')}</p>
        </div>
        ${agentMessage ? `
          <div class="hud__admin-prompt-bubble is-agent">
            <header>
              <strong>Agent</strong>
              ${createAgentTaskStatusBadge(task)}
            </header>
            <p>${formatAgentTaskMessage(agentMessage)}</p>
          </div>
        ` : ''}
        ${showStatusMessage ? `
          <div class="hud__admin-prompt-bubble is-system${task.error ? ' is-error' : ''}">
            <header>
              <strong>${task.error ? 'Issue' : getAgentTaskStatusLabel(displayStatus)}</strong>
            </header>
            <p>${formatAgentTaskMessage(statusMessage)}</p>
          </div>
        ` : ''}
        ${!agentMessage && !showStatusMessage ? `
          <div class="hud__admin-prompt-bubble is-system">
            <header>
              <strong>${getAgentTaskStatusLabel(displayStatus)}</strong>
              ${createAgentTaskStatusBadge(task)}
            </header>
            <p>Waiting for worker updates.</p>
          </div>
        ` : ''}
      </section>
    `;
  }).join('');
}

function createAgentTaskDetailMarkup(task = null, threadTasks = []) {
  if (!task) {
    return '<div class="hud__admin-prompt-empty">Select a thread to inspect it.</div>';
  }

  const safeThreadTasks = threadTasks.length ? threadTasks : [task];
  const latestTask = getAgentThreadLatestTask(safeThreadTasks) ?? task;
  const status = String(latestTask.status ?? 'queued');
  const branch = String(latestTask.branch ?? '').trim();
  const commitSha = String(latestTask.commitSha ?? '').trim();
  const deployApproved = Number(latestTask.deployApprovedAt ?? 0) > 0;
  const canApproveDeploy = status === 'ready_for_review' && !deployApproved;
  const canCancel = ['queued', 'claimed', 'preparing'].includes(status);
  const canRollback = status === 'deployed' && Number(latestTask.rollbackApprovedAt ?? 0) <= 0;
  const rollbackApproved = Number(latestTask.rollbackApprovedAt ?? 0) > 0 && status !== 'rolled_back';
  const rollbackCommitSha = String(latestTask.rollbackCommitSha ?? '').trim();
  const threadBusy = isAgentThreadBusy(safeThreadTasks);
  const deployTargets = Array.isArray(latestTask.deployTargets)
    ? latestTask.deployTargets.map((target) => String(target ?? '').trim()).filter(Boolean)
    : [];
  const changedFiles = Array.isArray(latestTask.changedFiles)
    ? latestTask.changedFiles.map((filePath) => String(filePath ?? '').trim()).filter(Boolean)
    : [];
  const links = [
    createAgentTaskLink('Preview', latestTask.previewUrl),
    createAgentTaskLink('Deploy', latestTask.deployUrl)
  ].filter(Boolean).join('');
  const workedDuration = String(latestTask.status ?? '') === 'ready_for_review'
    ? getAgentTaskWorkedDurationLabel(latestTask)
    : '';

  return `
    <article class="hud__admin-prompt-detail">
      <header>
        ${createAgentTaskStatusBadge(latestTask)}
        <strong>${escapeHtml(getAgentTaskShortId(latestTask))}</strong>
      </header>
      <h3>${escapeHtml(getAgentTaskThreadTitle(latestTask))}</h3>
      <div class="hud__admin-prompt-meta">
        <span>Context <strong>${escapeHtml(getAgentTaskTitle(latestTask))}</strong></span>
        ${branch ? `<span>Branch <strong>${escapeHtml(branch)}</strong></span>` : ''}
        ${commitSha ? `<span>Commit <strong>${escapeHtml(commitSha.slice(0, 10))}</strong></span>` : ''}
        ${deployTargets.length ? `<span>Targets <strong>${escapeHtml(deployTargets.join(', '))}</strong></span>` : ''}
        ${changedFiles.length ? `<span>Files <strong>${escapeHtml(String(changedFiles.length))}</strong></span>` : ''}
        ${workedDuration ? `<span>Worked <strong>${escapeHtml(workedDuration)}</strong></span>` : ''}
        ${rollbackCommitSha ? `<span>Rollback <strong>${escapeHtml(rollbackCommitSha.slice(0, 10))}</strong></span>` : ''}
        ${deployApproved ? '<span>Deploy approved</span>' : ''}
        ${rollbackApproved ? '<span>Rollback approved</span>' : ''}
      </div>
      ${links ? `<div class="hud__admin-prompt-links">${links}</div>` : ''}
      <div class="hud__admin-prompt-thread" data-admin-prompt-thread>
        ${createAgentTaskThreadMessageMarkup(safeThreadTasks)}
      </div>
      <div class="hud__admin-prompt-detail-actions">
        ${canApproveDeploy ? '<button class="hud__admin-prompt-small" type="button" data-admin-prompt-action="approve-deploy">Approve Deploy</button>' : ''}
        ${canRollback ? '<button class="hud__admin-prompt-small hud__admin-prompt-small--danger" type="button" data-admin-prompt-action="rollback">Rollback</button>' : ''}
        ${canCancel ? '<button class="hud__admin-prompt-small" type="button" data-admin-prompt-action="cancel-task">Cancel</button>' : ''}
      </div>
      <form class="hud__admin-prompt-followup" data-admin-prompt-followup-form>
        <textarea class="hud__admin-prompt-followup-input" data-admin-prompt-followup-prompt maxlength="6000" rows="3" placeholder="${threadBusy ? 'Worker is active...' : 'Continue this thread...'}" ${threadBusy ? 'disabled' : ''}></textarea>
        <button class="hud__admin-prompt-small" type="submit" ${threadBusy ? 'disabled' : ''}>Send Follow-up</button>
      </form>
    </article>
  `;
}

function getSchoolMicrogameBodyRenderKey(game = null, error = '') {
  const phase = String(game?.phase ?? 'ready');
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const gameId = String(round.gameId ?? '');
  const domain = String(game?.context ?? round.domain ?? '');
  const base = [
    game?.id ?? '',
    gameId,
    phase,
    String(error ?? ''),
    String(game?.resultTitle ?? ''),
    String(game?.resultDetail ?? ''),
    String(game?.message ?? '')
  ];
  if (phase === 'menu' && game?.context === 'office-job') {
    base.push(
      String(data.intelligence ?? 0),
      String(data.strengthLevel ?? 0),
      String(data.charismaLevel ?? 0),
      (Array.isArray(data.jobs) ? data.jobs : []).map((job) => `${job.id}:${job.unlocked ? '1' : '0'}:${job.instructions ?? ''}`).join(',')
    );
    return base.join('|');
  }
  if (phase === 'countdown') {
    base.push(
      getSchoolCountdownCue(game),
      String(data.roundNumber ?? 1),
      String(data.sessionXpEarned ?? 0),
      String(data.previousSuccess ?? ''),
      String(data.previousResultTitle ?? ''),
      String(data.previousResultDetail ?? '')
    );
    return base.join('|');
  }
  if (phase !== 'playing') {
    base.push(String(round.instructions ?? ''));
    return base.join('|');
  }

  if (domain === 'office-job') {
    if (gameId === OFFICE_JOB_GAME_IDS.officeManager) {
      return [
        game?.id ?? '',
        gameId,
        phase,
        String(error ?? ''),
        String(game?.resultTitle ?? ''),
        String(game?.resultDetail ?? ''),
        String(round.officeJobId ?? round.jobId ?? ''),
        String(Math.round(Number(round.targetStart ?? 0) * 100)),
        String(Math.round(Number(round.targetEnd ?? 0) * 100))
      ].join('|');
    }

    base.push(
      String(round.officeJobId ?? round.jobId ?? ''),
      String(Math.round(Number(round.targetStart ?? 0) * 100)),
      String(Math.round(Number(round.targetEnd ?? 0) * 100)),
      String(Math.round(Number(round.wind ?? 0) * 100)),
      String(Math.round(Number(data.fill ?? 0))),
      String(Math.round(Number(data.memoPosition ?? 0) * 100)),
      String(Number(data.memoDirection ?? 1) || 1),
      String(Boolean(data.memoTurned)),
      String(data.memoLabel ?? ''),
      String(Number(data.shotNumber ?? 0) || 0),
      String(Number(data.madeThrows ?? 0) || 0),
      String(Number(data.requiredThrows ?? round.requiredThrows ?? 0) || 0),
      String(Number(data.throwSeq ?? 0) || 0),
      String(data.throwMissSide ?? ''),
      String(Boolean(data.throwMade)),
      String(Number(data.dirtSeq ?? 0) || 0),
      String(Math.floor(Number(data.cleanProgress ?? 0) * 20)),
      String(Boolean(data.sparklyClean)),
      String(Boolean(Number(data.mopCleanShowcaseAt ?? 0) || 0)),
      String(data.stampMissSide ?? ''),
      String(Boolean(data.stampSuccess)),
      String(Number(data.stampSeq ?? 0) || 0),
      String(Number(data.approved ?? 0) || 0),
      String(Number(data.requiredApprovals ?? round.requiredApprovals ?? 0) || 0),
      String(Boolean(data.brewing)),
      String(Boolean(data.released)),
      String(Boolean(data.thrown)),
      String(Boolean(data.stamped)),
      String(Boolean(data.keyboardHolding))
    );
  } else if (gameId === SCHOOL_MICROGAME_IDS.popQuiz) {
    const roundResults = Array.isArray(data.roundResults) ? data.roundResults : [];
    base.push(
      String(data.currentQuestionIndex ?? 0),
      String(data.selectedIndex ?? -1),
      String(Boolean(data.questionLocked)),
      String(data.correctImpactIndex ?? -1),
      roundResults.map((result) => result === true ? '1' : result === false ? '0' : '-').join('')
    );
  } else if (gameId === SCHOOL_MICROGAME_IDS.lockerCombo) {
    base.push(Boolean(data.previewActive) ? 'preview' : 'entry', (data.entered ?? []).join(','));
  } else if (gameId === SCHOOL_MICROGAME_IDS.copyNotes) {
    base.push(String(data.enteredCount ?? 0));
  } else if (gameId === SCHOOL_MICROGAME_IDS.teacherLooking) {
    base.push(
      String(data.teacherMode ?? (data.teacherLooking ? 'looking' : 'away')),
      String(data.typedText ?? ''),
      String(data.mistakes ?? 0),
      String(Math.floor(Number(data.progress ?? 0) / 4))
    );
  } else if (gameId === SCHOOL_MICROGAME_IDS.memoryMatch) {
    base.push(
      (data.visibleCardIds ?? []).join(','),
      (data.matchedCardIds ?? []).join(','),
      (data.pendingMismatchIds ?? []).join(','),
      (data.celebratingCardIds ?? []).join(','),
      (data.flippingBackCardIds ?? []).join(','),
      String(data.lastFlippedCardId ?? ''),
      String(data.moves ?? 0),
      String(data.matchBurstSeq ?? 0),
      String(Boolean(data.completing))
    );
  } else if (gameId === SCHOOL_MICROGAME_IDS.dodgeChalk) {
    base.push(
      String(data.playerLane ?? 1),
      String(data.lives ?? 0),
      (data.chalks ?? []).map((chalk) => `${chalk.lane}:${Math.round(Number(chalk.x ?? 0) / 4)}`).join(',')
    );
  } else if (gameId === SCHOOL_MICROGAME_IDS.sortBackpack) {
    base.push(
      String(data.selectedItemId ?? ''),
      String(data.correct ?? 0),
      String(data.wrong ?? 0),
      (data.remaining ?? []).map((item) => item.id).join(',')
    );
  } else if (gameId === SCHOOL_MICROGAME_IDS.bellSprint) {
    base.push(String(Math.round(Number(data.marker ?? 0) * 100)));
  } else if (gameId === SCHOOL_MICROGAME_IDS.scantron) {
    base.push((data.filled ?? []).join(','), String(data.correct ?? 0), String(data.wrong ?? 0));
  }
  return base.join('|');
}

function createReadySchoolMicrogameMarkup(game = null) {
  const round = game?.round ?? {};
  const intelligenceRequirement = Math.max(0, Math.floor(Number(round.intelligenceRequired ?? 0) || 0));
  const charismaLevelRequirement = Math.max(0, Math.floor(Number(round.charismaLevelRequired ?? 0) || 0));
  const strengthLevelRequirement = Math.max(0, Math.floor(Number(round.strengthLevelRequired ?? 0) || 0));
  const requirementText = [
    intelligenceRequirement > 0 ? `${intelligenceRequirement} Intelligence` : '',
    strengthLevelRequirement > 0 ? `Level ${strengthLevelRequirement} Strength` : '',
    charismaLevelRequirement > 0 ? `Level ${charismaLevelRequirement} Charisma` : ''
  ].filter(Boolean).join(' / ');
  const instructions = String(round.instructions ?? '').trim();
  const officeJobId = String(round.officeJobId ?? round.jobId ?? '');
  const officeReadyBackdrop = game?.context === 'office-job' ? createOfficeJobReadyBackdropMarkup(officeJobId, String(round.gameId ?? '')) : '';
  const officeReadyClass = officeReadyBackdrop
    ? ` hud__school-ready--office-job hud__school-ready--${officeJobId === OFFICE_JOB_IDS.officeManager ? 'manager' : escapeHtml(officeJobId)}${round.gameId === OFFICE_JOB_GAME_IDS.janitorMopHero ? ' hud__school-ready--mop-hero' : ''}`
    : '';
  return `
    <div class="hud__school-ready${officeReadyClass}">
      ${officeReadyBackdrop}
      <div class="hud__school-ready-badge" aria-hidden="true">${escapeHtml(round.icon ?? 'GO')}</div>
      <h3>${escapeHtml(round.title ?? 'School Microgame')}</h3>
      <p>${escapeHtml(round.description ?? 'Play fast and clean.')}</p>
      ${instructions ? `
        <div class="hud__school-instructions">
          <span>How to play</span>
          <strong>${escapeHtml(instructions)}</strong>
        </div>
      ` : ''}
      ${requirementText ? `
        <div class="hud__school-requirement">
          <span>Requirement</span>
          <strong>${escapeHtml(requirementText)}</strong>
        </div>
      ` : ''}
      <div class="hud__school-reward">
        <span>Reward</span>
        <strong>${escapeHtml(getSchoolMicrogameRewardText(round))}</strong>
      </div>
      ${createSchoolGameButton('start', 'Start', 'is-primary')}
    </div>
  `;
}

function createOfficeJobReadyBackdropMarkup(jobId = '', gameId = '') {
  switch (jobId) {
    case OFFICE_JOB_IDS.janitor:
      if (gameId === OFFICE_JOB_GAME_IDS.janitorMopHero) {
        return createOfficeMopRoomBackdropMarkup();
      }
      return createJanitorClosetBackdropMarkup();
    case OFFICE_JOB_IDS.officeManager:
      return createOfficeBreakroomBackdropMarkup();
    case OFFICE_JOB_IDS.ceo:
      return createOfficeBoardroomBackdropMarkup();
    default:
      return '';
  }
}

function createJanitorClosetBackdropMarkup() {
  return `
      <div class="hud__office-ready-backdrop hud__office-janitor-closet" aria-hidden="true">
        <span class="hud__office-janitor-closet-wall"></span>
        <span class="hud__office-janitor-closet-shelf is-top"></span>
        <span class="hud__office-janitor-closet-shelf is-mid"></span>
        <span class="hud__office-janitor-closet-supplies is-left"></span>
        <span class="hud__office-janitor-closet-supplies is-right"></span>
        <span class="hud__office-janitor-closet-mop"></span>
        <span class="hud__office-janitor-closet-broom"></span>
        <span class="hud__office-janitor-closet-bucket"></span>
        <span class="hud__office-janitor-closet-door"></span>
      </div>
  `;
}

function createOfficeMopRoomBackdropMarkup({ gameplay = false } = {}) {
  return `
      <div class="${gameplay ? 'hud__office-mop-room' : 'hud__office-ready-backdrop hud__office-mop-room'}" aria-hidden="true">
        <span class="hud__office-mop-room-wall"></span>
        <span class="hud__office-mop-room-window"></span>
        <span class="hud__office-mop-room-desk is-left"></span>
        <span class="hud__office-mop-room-desk is-right"></span>
        <span class="hud__office-mop-room-chair is-left"></span>
        <span class="hud__office-mop-room-chair is-right"></span>
        <span class="hud__office-mop-room-cabinet"></span>
        <span class="hud__office-mop-room-floor"></span>
        <span class="hud__office-mop-room-dirt is-one"></span>
        <span class="hud__office-mop-room-dirt is-two"></span>
        <span class="hud__office-mop-room-dirt is-three"></span>
        <span class="hud__office-mop-room-shine is-one"></span>
        <span class="hud__office-mop-room-shine is-two"></span>
        <span class="hud__office-mop-room-shine is-three"></span>
      </div>
  `;
}

function createOfficeBreakroomBackdropMarkup() {
  return `
      <div class="hud__office-ready-backdrop hud__office-breakroom-backdrop" aria-hidden="true">
        <span class="hud__office-breakroom-wall"></span>
        <span class="hud__office-breakroom-cabinets"></span>
        <span class="hud__office-breakroom-fridge"></span>
        <span class="hud__office-breakroom-counter"></span>
        <span class="hud__office-coffee-maker">
          <span class="hud__office-coffee-light"></span>
          <span class="hud__office-coffee-spout"></span>
          <span class="hud__office-coffee-pot"></span>
        </span>
        <span class="hud__office-cup">
          <span class="hud__office-coffee-fill"></span>
          <span class="hud__office-coffee-shine"></span>
          <span class="hud__office-coffee-target"></span>
          <span class="hud__office-coffee-steam is-one"></span>
          <span class="hud__office-coffee-steam is-two"></span>
          <span class="hud__office-coffee-steam is-three"></span>
        </span>
      </div>
  `;
}

function createOfficeBoardMembersMarkup() {
  return `
        <span class="hud__office-board-face is-far-left hud__office-board-member--cane">
          <span class="hud__office-board-prop hud__office-board-top-hat"></span>
          <span class="hud__office-board-prop hud__office-board-cane"></span>
        </span>
        <span class="hud__office-board-face is-left hud__office-board-member--monocle">
          <span class="hud__office-board-prop hud__office-board-monocle"></span>
          <span class="hud__office-board-prop hud__office-board-cash-stack"></span>
        </span>
        <span class="hud__office-board-face is-center hud__office-board-member--money-bag">
          <span class="hud__office-board-prop hud__office-board-top-hat"></span>
          <span class="hud__office-board-prop hud__office-board-money-bag"></span>
        </span>
        <span class="hud__office-board-face is-right hud__office-board-member--cash-fan">
          <span class="hud__office-board-prop hud__office-board-monocle"></span>
          <span class="hud__office-board-prop hud__office-board-cash-fan"></span>
        </span>
        <span class="hud__office-board-face is-far-right hud__office-board-member--watch">
          <span class="hud__office-board-prop hud__office-board-top-hat"></span>
          <span class="hud__office-board-prop hud__office-board-pocket-watch"></span>
        </span>
  `;
}

function createOfficeBoardroomBackdropMarkup() {
  return `
      <div class="hud__office-ready-backdrop hud__office-boardroom-backdrop" aria-hidden="true">
        <span class="hud__office-boardroom-wall"></span>
        <span class="hud__office-boardroom-window"></span>
        <span class="hud__office-boardroom-table"></span>
        ${createOfficeBoardMembersMarkup()}
        <span class="hud__office-approval-window"></span>
        <span class="hud__office-ceo-memo">
          <strong>Board Memo</strong>
          <em>Q1</em>
        </span>
        <span class="hud__office-ceo-stamp-arm">
          <span class="hud__office-ceo-stamp-handle"></span>
          <span class="hud__office-ceo-stamp-neck"></span>
          <span class="hud__office-ceo-stamp-pad">APPROVE</span>
        </span>
      </div>
  `;
}

function createSchoolCountdownMarkup(game = null) {
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const cue = getSchoolCountdownCue(game);
  const isGo = cue === 'GO!';
  const isOfficeJob = game?.context === 'office-job';
  const roundNumber = Math.max(1, Math.floor(Number(data.roundNumber ?? 1) || 1));
  const sessionXp = Math.max(0, Math.floor(Number(data.sessionXpEarned ?? 0) || 0));
  const previousTitle = String(data.previousResultTitle ?? '').trim();
  const previousDetail = String(data.previousResultDetail ?? '').trim();
  const previousSuccess = data.previousSuccess === true;
  const previousFailure = data.previousSuccess === false;
  return `
    <div class="hud__school-countdown${previousSuccess ? ' is-after-success' : previousFailure ? ' is-after-failure' : ''}">
      ${previousTitle || previousDetail ? `
        <div class="hud__school-countdown-result">
          ${previousTitle ? `<strong>${escapeHtml(previousTitle)}</strong>` : ''}
          ${previousDetail ? `<span>${escapeHtml(previousDetail)}</span>` : ''}
        </div>
      ` : ''}
      <div class="hud__school-countdown-number${isGo ? ' is-go' : ''}" aria-label="${isGo ? 'Go' : `Starting in ${cue}`}">${escapeHtml(cue)}</div>
      <div class="hud__school-countdown-meta">
        <span>${isOfficeJob ? '3..2..1.. GO!' : `Round ${escapeHtml(String(roundNumber))}`}</span>
        <strong>${escapeHtml(round.title ?? 'School Microgame')}</strong>
        <em>${isOfficeJob ? `${escapeHtml(formatMoneyAmount(round.rewardMoney ?? 0))} payday` : `${escapeHtml(String(sessionXp))} Intelligence XP`}</em>
      </div>
    </div>
  `;
}

function createOfficeJobMenuMarkup(game = null) {
  const data = game?.data ?? {};
  const intelligence = Math.max(0, Math.floor(Number(data.intelligence ?? 0) || 0));
  const charismaLevel = Math.max(0, Math.floor(Number(data.charismaLevel ?? 0) || 0));
  const strengthLevel = Math.max(0, Math.floor(Number(data.strengthLevel ?? 0) || 0));
  const jobs = Array.isArray(data.jobs) && data.jobs.length > 0
    ? data.jobs
    : listOfficeJobDefinitions().map((job) => ({
      ...job,
      unlocked: canPlayerWorkOfficeJob(intelligence, job, charismaLevel, strengthLevel)
    }));

  return `
    <div class="hud__office-menu">
      <section class="hud__office-menu-summary">
        <span>Current Skills</span>
        <strong>Int ${escapeHtml(String(intelligence))} / Str Lv ${escapeHtml(String(strengthLevel))} / Cha Lv ${escapeHtml(String(charismaLevel))}</strong>
      </section>
      <div class="hud__office-job-grid">
        ${jobs.map((job) => {
          const unlocked = canPlayerWorkOfficeJob(intelligence, job, charismaLevel, strengthLevel);
          const instructions = String(job.instructions ?? '').trim();
          return `
            <button
              class="hud__office-job-card${unlocked ? '' : ' is-locked'}"
              type="button"
              data-school-microgame-action="office:select:${escapeHtml(job.id)}"
              aria-disabled="${unlocked ? 'false' : 'true'}"
            >
              <span class="hud__office-job-icon" aria-hidden="true">${escapeHtml(job.icon ?? 'JOB')}</span>
              <span class="hud__office-job-copy">
                <strong>${escapeHtml(job.roleLabel ?? job.title ?? 'Job')}</strong>
                <small>${escapeHtml(job.subtitle ?? job.description ?? '')}</small>
                ${instructions ? `<span class="hud__office-job-instruction">${escapeHtml(instructions)}</span>` : ''}
              </span>
              <span class="hud__office-job-meta">
                <em>$${escapeHtml(String(job.rewardMoney ?? 0))}</em>
                <small>${escapeHtml(getOfficeJobRequirementText(job, { intelligence, charismaLevel, strengthLevel }))}</small>
              </span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function createPopQuizMarkup(game = null) {
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const questions = Array.isArray(round.questions) && round.questions.length > 0
    ? round.questions
    : [{
      question: round.question ?? 'Question',
      answers: Array.isArray(round.answers) ? round.answers : [],
      correctIndex: Number(round.correctIndex ?? -1)
    }];
  const currentQuestionIndex = Math.max(0, Math.min(questions.length - 1, Math.floor(Number(data.currentQuestionIndex ?? 0) || 0)));
  const currentQuestion = questions[currentQuestionIndex] ?? questions[0];
  const roundResults = Array.isArray(data.roundResults) ? data.roundResults : [];
  const questionLocked = Boolean(data.questionLocked);
  const selectedIndex = Number(data.selectedIndex ?? -1);
  const totalQuestions = Math.max(questions.length, Number(round.questionCount ?? 0) || 0, 3);
  return `
    <div class="hud__school-quiz">
      <div class="hud__school-quiz-status" aria-label="Quiz rounds">
        ${Array.from({ length: totalQuestions }, (_, index) => {
          const result = roundResults[index];
          const isImpact = result === true && index === Number(data.correctImpactIndex ?? -1);
          const stateClass = `${result === true ? ' is-correct' : index === currentQuestionIndex ? ' is-current' : ''}${isImpact ? ' is-impact' : ''}`;
          const label = result === true ? `Question ${index + 1} correct` : `Question ${index + 1}`;
          return `
            <span class="hud__school-round${stateClass}" aria-label="${escapeHtml(label)}">
              <span class="hud__school-round-dot" aria-hidden="true"></span>
              ${result === true ? `
                <strong class="hud__school-round-check" aria-hidden="true">&#10003;</strong>
                <span class="hud__school-round-dust" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              ` : ''}
            </span>
          `;
        }).join('')}
      </div>
      <div class="hud__school-question-count">Question ${currentQuestionIndex + 1} of ${totalQuestions}</div>
      <div class="hud__school-question">${escapeHtml(currentQuestion.question ?? 'Question')}</div>
      <div class="hud__school-answer-grid">
        ${(currentQuestion.answers ?? []).map((answer) => {
          const index = Number(answer.index ?? 0);
          const selectedClass = selectedIndex === index ? ' is-selected' : '';
          const correctClass = questionLocked && selectedIndex === index && index === Number(currentQuestion.correctIndex ?? -1) ? ' is-correct' : '';
          return createSchoolGameButton(`answer:${index}`, answer.label, `hud__school-answer${selectedClass}${correctClass}`, { disabled: questionLocked });
        }).join('')}
      </div>
    </div>
  `;
}

function createLockerComboMarkup(game = null) {
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const combo = Array.isArray(round.combo) ? round.combo : [];
  const entered = Array.isArray(data.entered) ? data.entered : [];
  const previewActive = Boolean(data.previewActive);
  return `
    <div class="hud__school-locker${previewActive ? ' is-previewing' : ''}">
      <div class="hud__school-locker-door">
        <div class="hud__school-locker-vents" aria-hidden="true"></div>
        <div class="hud__school-combo-strip">
          ${combo.map((digit, index) => `
            <span class="hud__school-combo-digit${previewActive ? ' is-visible' : ''}${entered[index] === digit ? ' is-entered' : ''}">
              ${previewActive ? escapeHtml(digit) : escapeHtml(entered[index] ?? '-')}
            </span>
          `).join('')}
        </div>
      </div>
      <div class="hud__school-keypad">
        ${(round.keypad ?? []).map((digit) => createSchoolGameButton(`digit:${digit}`, String(digit), 'hud__school-key')).join('')}
      </div>
    </div>
  `;
}

function createCopyNotesMarkup(game = null) {
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const sequence = Array.isArray(round.sequence) ? round.sequence : [];
  const enteredCount = Math.max(0, Math.floor(Number(data.enteredCount ?? 0) || 0));
  return `
    <div class="hud__school-notes">
      <div class="hud__school-board">
        ${sequence.map((key, index) => `
          <span class="hud__school-board-token${index < enteredCount ? ' is-copied' : ''}${index === enteredCount ? ' is-next' : ''}">
            ${escapeHtml(key)}
          </span>
        `).join('')}
      </div>
      <div class="hud__school-note-buttons">
        ${(round.keys ?? []).map((key) => createSchoolGameButton(`note:${key}`, key, 'hud__school-note-key')).join('')}
      </div>
    </div>
  `;
}

function createTeacherLookingMarkup(game = null) {
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const sentence = String(round.sentence ?? 'MEET ME AFTER CLASS');
  const typedText = String(data.typedText ?? '').toUpperCase().replace(/[^A-Z ]+/g, '');
  const teacherMode = String(data.teacherMode ?? (data.teacherLooking ? 'looking' : 'away'));
  const modeClass = teacherMode === 'looking' ? 'is-looking' : teacherMode === 'turning' ? 'is-turning' : 'is-away';
  const statusLabel = teacherMode === 'looking' ? 'Red light' : teacherMode === 'turning' ? 'Yellow light' : 'Green light';
  const sceneLabel = teacherMode === 'looking' ? 'Freeze' : teacherMode === 'turning' ? 'Stop' : 'Write';
  const progress = sentence.length > 0 ? Math.min(100, (typedText.length / sentence.length) * 100) : 0;
  const targetMarkup = Array.from(sentence).map((char, index) => {
    const isTyped = index < typedText.length;
    const isCurrent = index === typedText.length;
    const isSpace = char === ' ';
    return `
      <span class="hud__school-type-char${isTyped ? ' is-typed' : ''}${isCurrent ? ' is-current' : ''}${isSpace ? ' is-space' : ''}" aria-label="${isSpace ? 'space' : escapeHtml(char)}">
        ${isSpace ? '&nbsp;' : escapeHtml(char)}
      </span>
    `;
  }).join('');
  return `
    <div class="hud__school-teacher ${modeClass}">
      <div class="hud__school-teacher-topline">
        <div class="hud__school-traffic" aria-hidden="true">
          <span class="hud__school-light is-green${teacherMode === 'away' ? ' is-active' : ''}"></span>
          <span class="hud__school-light is-yellow${teacherMode === 'turning' ? ' is-active' : ''}"></span>
          <span class="hud__school-light is-red${teacherMode === 'looking' ? ' is-active' : ''}"></span>
        </div>
        <div class="hud__school-teacher-status">${escapeHtml(statusLabel)}</div>
      </div>
      <div class="hud__school-teacher-scene" data-school-teacher-preview>
        <div class="hud__school-teacher-fallback" aria-hidden="true">
          <div class="hud__school-blackboard">
            <span>${escapeHtml(statusLabel)}</span>
            <strong>${escapeHtml(sceneLabel)}</strong>
          </div>
          <div class="hud__school-teacher-figure">
            <span class="hud__school-teacher-hair"></span>
            <span class="hud__school-teacher-head"></span>
            <span class="hud__school-teacher-eyes"></span>
            <span class="hud__school-teacher-nose"></span>
            <span class="hud__school-teacher-body"></span>
            <span class="hud__school-teacher-arm"></span>
            <span class="hud__school-teacher-chalk"></span>
          </div>
          <div class="hud__school-student-desk">
            <span class="hud__school-student-paper"></span>
            <span class="hud__school-student-pencil"></span>
          </div>
        </div>
      </div>
      <div class="hud__school-typing-panel">
        <div class="hud__school-type-target" aria-label="Target sentence">
          ${targetMarkup}
        </div>
        <div class="hud__school-type-copy">
          <span>${escapeHtml(String(typedText.length).padStart(2, '0'))}/${escapeHtml(String(sentence.length).padStart(2, '0'))}</span>
          <strong>${typedText ? escapeHtml(typedText) : '&nbsp;'}</strong>
        </div>
      </div>
      ${createSchoolProgressMarkup(progress, 'Sentence progress')}
    </div>
  `;
}

function createMemoryMatchMarkup(game = null) {
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const cards = Array.isArray(round.cards) ? round.cards : [];
  const visibleIds = new Set(Array.isArray(data.visibleCardIds) ? data.visibleCardIds : []);
  const matchedIds = new Set(Array.isArray(data.matchedCardIds) ? data.matchedCardIds : []);
  const pendingMismatchIds = new Set(Array.isArray(data.pendingMismatchIds) ? data.pendingMismatchIds : []);
  const celebratingIds = new Set(Array.isArray(data.celebratingCardIds) ? data.celebratingCardIds : []);
  const flippingBackIds = new Set(Array.isArray(data.flippingBackCardIds) ? data.flippingBackCardIds : []);
  const matchesFound = Math.max(0, Math.floor(Number(data.matchesFound ?? matchedIds.size / 2) || 0));
  const pairCount = Math.max(1, Math.floor(Number(round.pairCount ?? cards.length / 2) || 1));
  const moves = Math.max(0, Math.floor(Number(data.moves ?? 0) || 0));

  return `
    <div class="hud__school-memory">
      <div class="hud__school-memory-score">
        <span><strong>${matchesFound}</strong>/${pairCount} pairs</span>
        <span><strong>${moves}</strong> turns</span>
      </div>
      <div class="hud__school-memory-grid" aria-label="Memory card grid">
        ${cards.map((card, index) => {
          const isMatched = matchedIds.has(card.id);
          const isVisible = isMatched || visibleIds.has(card.id);
          const isPending = pendingMismatchIds.has(card.id);
          const isCelebrating = celebratingIds.has(card.id);
          const isFlippingBack = flippingBackIds.has(card.id);
          const isFlippingUp = isVisible && data.lastFlippedCardId === card.id;
          const cardClass = [
            'hud__school-memory-card',
            isVisible ? 'is-visible' : '',
            isMatched ? 'is-matched' : '',
            isPending ? 'is-pending' : '',
            isCelebrating ? 'is-celebrating' : '',
            isFlippingBack ? 'is-flipping-back' : '',
            isFlippingUp ? 'is-flipping-up' : ''
          ].filter(Boolean).join(' ');
          const disabled = isMatched || isVisible || isFlippingBack || Boolean(data.completing);
          const label = isMatched
            ? `${card.label} matched`
            : isVisible
              ? `${card.label} card`
              : `Face-down memory card ${index + 1}`;

          return `
            <button
              class="${cardClass}"
              type="button"
              data-school-microgame-action="memory:flip:${escapeHtml(card.id)}"
              style="--card-accent:${escapeHtml(card.accent ?? '#78f0b5')}; --memory-card-index:${index}"
              aria-label="${escapeHtml(label)}"
              ${disabled ? 'disabled' : ''}
            >
              <span class="hud__school-memory-card-inner">
                <span class="hud__school-memory-face hud__school-memory-front">
                  <span class="hud__school-memory-icon">${escapeHtml(card.icon ?? '?')}</span>
                  <span class="hud__school-memory-label">${escapeHtml(card.label ?? 'Card')}</span>
                  <span class="hud__school-memory-match-burst" aria-hidden="true">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </span>
                <span class="hud__school-memory-face hud__school-memory-back">
                  <span class="hud__school-memory-back-mark"></span>
                </span>
                <span class="hud__school-memory-edge" aria-hidden="true"></span>
              </span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function createDodgeChalkMarkup(game = null) {
  const data = game?.data ?? {};
  const lanes = Array.isArray(game?.round?.lanes) ? game.round.lanes : ['Left', 'Center', 'Right'];
  const playerLane = Math.max(0, Math.min(2, Math.floor(Number(data.playerLane ?? 1) || 1)));
  const chalks = Array.isArray(data.chalks) ? data.chalks : [];
  return `
    <div class="hud__school-dodge">
      <div class="hud__school-lives">${Array.from({ length: 2 }, (_, index) => `<span class="${index < (data.lives ?? 0) ? 'is-live' : ''}"></span>`).join('')}</div>
      <div class="hud__school-dodge-lanes">
        ${lanes.map((lane, index) => `
          <div class="hud__school-dodge-lane${playerLane === index ? ' is-player-lane' : ''}">
            <span>${escapeHtml(lane)}</span>
          </div>
        `).join('')}
        <div class="hud__school-dodge-player" style="--lane:${playerLane}" aria-label="Student"></div>
        ${chalks.map((chalk) => `
          <span class="hud__school-chalk" style="--lane:${Math.max(0, Math.min(2, Number(chalk.lane ?? 0)))}; --x:${Math.max(0, Math.min(100, Number(chalk.x ?? 0))).toFixed(2)}%"></span>
        `).join('')}
      </div>
      <div class="hud__school-dual-actions">
        ${createSchoolGameButton('move:left', 'Left', 'hud__school-direction')}
        ${createSchoolGameButton('move:right', 'Right', 'hud__school-direction')}
      </div>
    </div>
  `;
}

function createSortBackpackMarkup(game = null) {
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const remaining = Array.isArray(data.remaining) ? data.remaining : (round.items ?? []);
  const selectedId = String(data.selectedItemId ?? '');
  return `
    <div class="hud__school-sort">
      <div class="hud__school-backpack-pile">
        ${remaining.map((item) => createSchoolGameButton(`item:${item.id}`, item.label, `hud__school-backpack-item${selectedId === item.id ? ' is-selected' : ''}`)).join('')}
      </div>
      <div class="hud__school-bin-grid">
        ${(round.bins ?? []).map((bin) => createSchoolGameButton(`bin:${bin}`, bin, 'hud__school-bin')).join('')}
      </div>
      <div class="hud__school-score-strip">
        <span>${Math.max(0, Number(data.correct ?? 0) || 0)} sorted</span>
        <span>${Math.max(0, Number(data.wrong ?? 0) || 0)} wrong</span>
      </div>
    </div>
  `;
}

function createBellSprintMarkup(game = null) {
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const marker = Math.max(0, Math.min(1, Number(data.marker ?? 0) || 0));
  const targetStart = Math.max(0, Math.min(1, Number(round.targetStart ?? 0.62) || 0.62));
  const targetEnd = Math.max(targetStart, Math.min(1, Number(round.targetEnd ?? 0.78) || 0.78));
  return `
    <div class="hud__school-bell">
      <div class="hud__school-hallway-meter">
        <span class="hud__school-classroom-zone" style="--target-left:${(targetStart * 100).toFixed(2)}%; --target-width:${((targetEnd - targetStart) * 100).toFixed(2)}%"></span>
        <span class="hud__school-runner-marker" style="--marker:${(marker * 100).toFixed(2)}%"></span>
      </div>
      <div class="hud__school-bell-labels">
        <span>Hall</span>
        <strong>Class Door</strong>
      </div>
      ${createSchoolGameButton('stop', 'Stop', 'is-primary')}
    </div>
  `;
}

function createScantronMarkup(game = null) {
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const answerKey = Array.isArray(round.answerKey) ? round.answerKey : [];
  const filled = Array.isArray(data.filled) ? data.filled : [];
  return `
    <div class="hud__school-scantron">
      <div class="hud__school-answer-key">
        <span>Key</span>
        <strong>${answerKey.map((answer) => escapeHtml(answer)).join(' ')}</strong>
      </div>
      <div class="hud__school-scantron-sheet">
        ${answerKey.map((answer, rowIndex) => `
          <div class="hud__school-scantron-row">
            <span>${rowIndex + 1}</span>
            ${(round.options ?? ['A', 'B', 'C', 'D']).map((option) => createSchoolGameButton(
              `bubble:${rowIndex}:${option}`,
              option,
              `hud__school-bubble${filled[rowIndex] === option ? ' is-filled' : ''}${answer === option ? ' is-key' : ''}`
            )).join('')}
          </div>
        `).join('')}
      </div>
      <div class="hud__school-score-strip">
        <span>${Math.max(0, Number(data.correct ?? 0) || 0)} correct</span>
        <span>${Math.max(0, Number(data.wrong ?? 0) || 0)} wrong</span>
      </div>
    </div>
  `;
}

function getOfficeTrashAimState(round = {}, data = {}) {
  const marker = Math.max(0, Math.min(1, Number(data.marker ?? 0) || 0));
  const targetStart = Math.max(0, Math.min(1, Number(round.targetStart ?? 0.48) || 0.48));
  const targetEnd = Math.max(targetStart, Math.min(1, Number(round.targetEnd ?? 0.64) || 0.64));
  const wind = Math.max(-0.35, Math.min(0.35, Number(round.wind ?? 0) || 0));
  const targetWidth = Math.max(0.01, targetEnd - targetStart);
  const insideTarget = marker >= targetStart && marker <= targetEnd;
  const outsideDistance = insideTarget
    ? 0
    : marker < targetStart
      ? marker - targetStart
      : marker - targetEnd;
  const rawAimError = Math.max(-1, Math.min(1, outsideDistance / Math.max(0.28, targetWidth * 2.4)));
  const easedMagnitude = Math.abs(rawAimError) * Math.abs(rawAimError) * (3 - 2 * Math.abs(rawAimError));
  const aimError = Math.sign(rawAimError) * easedMagnitude;
  return {
    marker,
    targetStart,
    targetEnd,
    wind,
    targetWidth,
    trajectoryOffset: aimError * 40,
    trajectoryTilt: aimError * 3.4
  };
}

function createOfficeTrashTossMarkup(game = null) {
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const {
    marker,
    targetStart,
    targetEnd,
    wind,
    trajectoryOffset,
    trajectoryTilt
  } = getOfficeTrashAimState(round, data);
  const thrown = data.thrown === true;
  const made = data.throwMade === true;
  const missSide = String(data.throwMissSide ?? '');
  const shotNumber = Math.max(1, Math.floor(Number(data.shotNumber ?? 1) || 1));
  const madeThrows = Math.max(0, Math.floor(Number(data.madeThrows ?? 0) || 0));
  const requiredThrows = Math.max(1, Math.floor(Number(data.requiredThrows ?? round.requiredThrows ?? 3) || 3));
  const progress = Math.max(0, Math.min(100, (madeThrows / requiredThrows) * 100));
  const driftLabel = Math.abs(wind) < 0.025
    ? 'Straight toss'
    : `${wind > 0 ? 'Throw bends right' : 'Throw bends left'} ${Math.round(Math.abs(wind) * 100)}`;
  const throwClass = thrown
    ? made
      ? ' is-thrown is-made'
      : ` is-thrown is-missed${missSide ? ` is-miss-${escapeHtml(missSide)}` : ''}`
    : '';
  return `
    <div class="hud__office-task hud__office-trash${throwClass}" style="--office-aim:${(marker * 100).toFixed(2)}%; --office-aim-offset:${trajectoryOffset.toFixed(1)}px; --office-aim-tilt:${trajectoryTilt.toFixed(2)}deg; --office-wind-shift:${(wind * 120).toFixed(1)}px; --office-wind-soft:${(wind * 28).toFixed(1)}px; --office-wind-long:${(wind * 80).toFixed(1)}px; --office-target-left:${(targetStart * 100).toFixed(2)}%; --office-target-width:${((targetEnd - targetStart) * 100).toFixed(2)}%">
      <div class="hud__office-trash-scene" aria-hidden="true">
        ${createJanitorClosetBackdropMarkup()}
        <span class="hud__office-paper-desk"></span>
        <span class="hud__office-thrower">
          <span class="hud__office-thrower-head"></span>
          <span class="hud__office-thrower-arm"></span>
        </span>
        <span class="hud__office-wind is-one"></span>
        <span class="hud__office-wind is-two"></span>
        <span class="hud__office-wind is-three"></span>
        <span class="hud__office-aim-arc"></span>
        <span class="hud__office-paper-ball"></span>
        <span class="hud__office-trash-basket"></span>
      </div>
      <div class="hud__office-precision-meter">
        <span class="hud__office-target-zone" style="--target-left:${(targetStart * 100).toFixed(2)}%; --target-width:${((targetEnd - targetStart) * 100).toFixed(2)}%"></span>
        <span class="hud__office-marker" style="--marker:${(marker * 100).toFixed(2)}%"></span>
      </div>
      <div class="hud__school-score-strip">
        <span>Round ${escapeHtml(String(shotNumber))}/${escapeHtml(String(requiredThrows))}</span>
        <span>${escapeHtml(driftLabel)}</span>
        <span>${escapeHtml(String(madeThrows))} sunk</span>
      </div>
      ${createSchoolProgressMarkup(progress, 'Janitor toss progress')}
      ${createSchoolGameButton('office:throw', 'Throw', 'is-primary')}
    </div>
  `;
}

function getOfficeMopHeroProgress(data = {}) {
  const patches = Array.isArray(data.dirtPatches) ? data.dirtPatches : [];
  if (!patches.length) {
    return 0;
  }

  const cleanTotal = patches.reduce((sum, patch) => {
    const clean = Math.max(0, Math.min(1, Number(patch.clean ?? 0) || 0));
    return sum + clean;
  }, 0);
  return Math.max(0, Math.min(100, (cleanTotal / patches.length) * 100));
}

function createOfficeMopDirtPatchMarkup(patch = {}, index = 0) {
  const clean = Math.max(0, Math.min(1, Number(patch.clean ?? 0) || 0));
  const x = Math.max(0, Math.min(1, Number(patch.x ?? 0.5) || 0.5));
  const y = Math.max(0, Math.min(1, Number(patch.y ?? 0.5) || 0.5));
  const size = Math.max(0.08, Math.min(0.26, Number(patch.size ?? 0.14) || 0.14));
  const rotation = Math.max(-45, Math.min(45, Number(patch.rotation ?? 0) || 0));
  const id = String(patch.id ?? `mop-dirt-${index + 1}`);
  return `
    <span
      class="hud__office-mop-dirt${clean >= 0.98 ? ' is-clean' : ''}"
      data-office-mop-dirt="${escapeHtml(id)}"
      style="--dirt-x:${(x * 100).toFixed(2)}%; --dirt-y:${(y * 100).toFixed(2)}%; --dirt-size:${(size * 100).toFixed(2)}%; --dirt-rotation:${rotation.toFixed(1)}deg; --dirt-clean:${clean.toFixed(3)}"
    ></span>
  `;
}

function createOfficeMopHeroMarkup(game = null) {
  const data = game?.data ?? {};
  const patches = Array.isArray(data.dirtPatches) ? data.dirtPatches : [];
  const progress = getOfficeMopHeroProgress(data);
  const dirtyCount = patches.filter((patch) => Math.max(0, Math.min(1, Number(patch.clean ?? 0) || 0)) < 0.98).length;
  const dirtyLabel = `${dirtyCount} dirty spot${dirtyCount === 1 ? '' : 's'}`;
  const mopX = Math.max(0.04, Math.min(0.96, Number(data.mopX ?? 0.5) || 0.5));
  const mopY = Math.max(0.12, Math.min(0.9, Number(data.mopY ?? 0.66) || 0.66));
  const mopActive = data.mopActive === true;
  const sparkly = progress >= 98 || data.sparklyClean === true;
  const squeakyClean = Number(data.mopCleanShowcaseAt ?? 0) > 0;
  const dirtStatusLabel = squeakyClean || dirtyCount === 0 ? 'Squeaky clean floor' : dirtyLabel;
  return `
    <div class="hud__office-task hud__office-mop${mopActive ? ' is-mopping' : ''}${sparkly ? ' is-sparkly' : ''}${squeakyClean ? ' is-squeaky-clean' : ''}" style="--mop-x:${(mopX * 100).toFixed(2)}%; --mop-y:${(mopY * 100).toFixed(2)}%; --mop-progress:${progress.toFixed(2)}%">
      <div class="hud__office-mop-stage" data-office-mop-stage aria-label="Mop Hero office room">
        ${createOfficeMopRoomBackdropMarkup({ gameplay: true })}
        <span class="hud__office-mop-clean-glow"></span>
        <div class="hud__office-mop-dirt-layer">
          ${patches.map(createOfficeMopDirtPatchMarkup).join('')}
        </div>
        <span class="hud__office-mop-sparkles" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </span>
        <span class="hud__office-mop-janitor" aria-hidden="true">
          <span class="hud__office-mop-janitor-shadow"></span>
          <span class="hud__office-mop-janitor-body"></span>
          <span class="hud__office-mop-janitor-head"></span>
          <span class="hud__office-mop-janitor-arm"></span>
          <span class="hud__office-mop-handle"></span>
          <span class="hud__office-mop-head"></span>
        </span>
      </div>
      <div class="hud__school-score-strip">
        <span data-office-mop-progress-label>${Math.round(progress)}% clean</span>
        <span data-office-mop-dirt-count>${escapeHtml(dirtStatusLabel)}</span>
      </div>
      ${createSchoolProgressMarkup(progress, 'Mop Hero cleaning progress')}
    </div>
  `;
}

function createOfficeCoffeeFillMarkup(game = null) {
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const fill = Math.max(0, Math.min(100, Number(data.fill ?? 0) || 0));
  const targetStart = Math.max(0, Math.min(100, Number(round.targetStart ?? 72) || 72));
  const targetEnd = Math.max(targetStart, Math.min(100, Number(round.targetEnd ?? 82) || 82));
  const brewing = data.brewing === true && data.released !== true;
  return `
    <div class="hud__office-task hud__office-coffee${brewing ? ' is-brewing' : ''}${data.released === true ? ' is-released' : ''}" style="--fill:${fill.toFixed(2)}%; --target-bottom:${targetStart.toFixed(2)}%; --target-height:${(targetEnd - targetStart).toFixed(2)}%">
      <div class="hud__office-coffee-station" aria-label="Coffee maker and mug">
        <span class="hud__office-breakroom-wall"></span>
        <span class="hud__office-breakroom-cabinets"></span>
        <span class="hud__office-breakroom-fridge"></span>
        <span class="hud__office-breakroom-counter"></span>
        <span class="hud__office-coffee-maker">
          <span class="hud__office-coffee-light"></span>
          <span class="hud__office-coffee-spout"></span>
          <span class="hud__office-coffee-pot"></span>
        </span>
        <span class="hud__office-coffee-stream"></span>
        <span class="hud__office-cup">
          <span class="hud__office-coffee-fill"></span>
          <span class="hud__office-coffee-shine"></span>
          <span class="hud__office-coffee-target"></span>
          <span class="hud__office-coffee-steam is-one"></span>
          <span class="hud__office-coffee-steam is-two"></span>
          <span class="hud__office-coffee-steam is-three"></span>
        </span>
      </div>
      <div class="hud__school-score-strip">
        <span data-office-coffee-fill-label>${Math.round(fill)}% full</span>
        <span data-office-coffee-target-label>Target ${Math.round(targetStart)}-${Math.round(targetEnd)}%</span>
      </div>
      <button class="hud__school-hold-button hud__office-brew-button" type="button" data-school-microgame-hold aria-pressed="${brewing ? 'true' : 'false'}">
        Hold Brew
      </button>
    </div>
  `;
}

function createOfficeCeoMarkup(game = null) {
  const round = game?.round ?? {};
  const data = game?.data ?? {};
  const rawMemoPosition = Number(data.memoPosition);
  const memoPosition = Number.isFinite(rawMemoPosition) ? Math.max(-0.16, Math.min(1.16, rawMemoPosition)) : -0.14;
  const targetStart = Math.max(0, Math.min(1, Number(round.targetStart ?? 0.44) || 0.44));
  const targetEnd = Math.max(targetStart, Math.min(1, Number(round.targetEnd ?? 0.6) || 0.6));
  const approved = Math.max(0, Math.floor(Number(data.approved ?? 0) || 0));
  const required = Math.max(1, Math.floor(Number(data.requiredApprovals ?? round.requiredApprovals ?? 3) || 3));
  const progress = Math.max(0, Math.min(100, (approved / required) * 100));
  const stamped = data.stamped === true;
  const stampSuccess = data.stampSuccess === true;
  const returning = data.memoTurned === true || Number(data.memoDirection ?? 1) < 0;
  const stampState = `${returning ? ' is-returning' : ''}${stamped ? stampSuccess ? ' is-stamping is-approved' : ' is-stamping is-rejected' : ''}`;
  const stampLeft = memoPosition * 100;
  return `
    <div class="hud__office-task hud__office-ceo hud__office-ceo-stamp${stampState}" style="--memo-left:${(memoPosition * 100).toFixed(2)}%; --target-left:${(targetStart * 100).toFixed(2)}%; --target-width:${((targetEnd - targetStart) * 100).toFixed(2)}%; --stamp-left:${stampLeft.toFixed(2)}%">
      <div class="hud__office-boardroom-scene" aria-hidden="true">
        <span class="hud__office-boardroom-wall"></span>
        <span class="hud__office-boardroom-window"></span>
        <span class="hud__office-boardroom-table"></span>
        ${createOfficeBoardMembersMarkup()}
        <span class="hud__office-approval-window"></span>
        <span class="hud__office-ceo-memo">
          <strong>${escapeHtml(data.memoLabel ?? 'Board Memo')}</strong>
          <em>Q${escapeHtml(String(Math.min(required, approved + 1)))}</em>
        </span>
        <span class="hud__office-ceo-stamp-arm">
          <span class="hud__office-ceo-stamp-handle"></span>
          <span class="hud__office-ceo-stamp-neck"></span>
          <span class="hud__office-ceo-stamp-pad">APPROVE</span>
        </span>
        <span class="hud__office-ceo-stamp-mark">APPROVED</span>
      </div>
      <div class="hud__school-score-strip">
        <span>${escapeHtml(approved)}/${escapeHtml(required)} memos approved</span>
        <span>${returning ? 'Return pass' : 'Forward pass'}</span>
      </div>
      ${createSchoolProgressMarkup(progress, 'Approval progress')}
      ${createSchoolGameButton('office:stamp', 'Stamp', 'is-primary')}
    </div>
  `;
}

function createSchoolMicrogamePlayMarkup(game = null) {
  const gameId = String(game?.round?.gameId ?? '');
  switch (gameId) {
    case SCHOOL_MICROGAME_IDS.popQuiz:
      return createPopQuizMarkup(game);
    case SCHOOL_MICROGAME_IDS.lockerCombo:
      return createLockerComboMarkup(game);
    case SCHOOL_MICROGAME_IDS.copyNotes:
      return createCopyNotesMarkup(game);
    case SCHOOL_MICROGAME_IDS.teacherLooking:
      return createTeacherLookingMarkup(game);
    case SCHOOL_MICROGAME_IDS.memoryMatch:
      return createMemoryMatchMarkup(game);
    case SCHOOL_MICROGAME_IDS.dodgeChalk:
      return createDodgeChalkMarkup(game);
    case SCHOOL_MICROGAME_IDS.sortBackpack:
      return createSortBackpackMarkup(game);
    case SCHOOL_MICROGAME_IDS.bellSprint:
      return createBellSprintMarkup(game);
    case SCHOOL_MICROGAME_IDS.scantron:
      return createScantronMarkup(game);
    case OFFICE_JOB_GAME_IDS.janitorTrashToss:
      return createOfficeTrashTossMarkup(game);
    case OFFICE_JOB_GAME_IDS.janitorMopHero:
      return createOfficeMopHeroMarkup(game);
    case OFFICE_JOB_GAME_IDS.officeManager:
      return createOfficeCoffeeFillMarkup(game);
    case OFFICE_JOB_GAME_IDS.ceo:
      return createOfficeCeoMarkup(game);
    default:
      return '<div class="hud__school-ready"><p>Unknown school microgame.</p></div>';
  }
}

function updateOfficeTrashTossLiveMarkup(root = null, game = null) {
  const task = root?.querySelector?.('.hud__office-trash');
  if (!task || game?.phase !== 'playing') {
    return;
  }

  const {
    marker,
    targetStart,
    targetEnd,
    wind,
    trajectoryOffset,
    trajectoryTilt
  } = getOfficeTrashAimState(game.round ?? {}, game.data ?? {});
  task.style.setProperty('--office-aim', `${(marker * 100).toFixed(3)}%`);
  task.style.setProperty('--office-aim-offset', `${trajectoryOffset.toFixed(2)}px`);
  task.style.setProperty('--office-aim-tilt', `${trajectoryTilt.toFixed(3)}deg`);
  task.style.setProperty('--office-wind-shift', `${(wind * 120).toFixed(1)}px`);
  task.style.setProperty('--office-wind-soft', `${(wind * 28).toFixed(1)}px`);
  task.style.setProperty('--office-wind-long', `${(wind * 80).toFixed(1)}px`);
  task.style.setProperty('--office-target-left', `${(targetStart * 100).toFixed(2)}%`);
  task.style.setProperty('--office-target-width', `${((targetEnd - targetStart) * 100).toFixed(2)}%`);

  const markerNode = task.querySelector('.hud__office-marker');
  if (markerNode instanceof HTMLElement) {
    markerNode.style.setProperty('--marker', `${(marker * 100).toFixed(3)}%`);
  }
}

function updateOfficeMopHeroLiveMarkup(root = null, game = null) {
  const task = root?.querySelector?.('.hud__office-mop');
  if (!task || game?.phase !== 'playing') {
    return;
  }

  const data = game.data ?? {};
  const mopX = Math.max(0.04, Math.min(0.96, Number(data.mopX ?? 0.5) || 0.5));
  const mopY = Math.max(0.12, Math.min(0.9, Number(data.mopY ?? 0.66) || 0.66));
  const progress = getOfficeMopHeroProgress(data);
  const patches = Array.isArray(data.dirtPatches) ? data.dirtPatches : [];
  const dirtyCount = patches.filter((patch) => Math.max(0, Math.min(1, Number(patch.clean ?? 0) || 0)) < 0.98).length;
  const dirtyLabel = `${dirtyCount} dirty spot${dirtyCount === 1 ? '' : 's'}`;
  const squeakyClean = Number(data.mopCleanShowcaseAt ?? 0) > 0;
  const dirtStatusLabel = squeakyClean || dirtyCount === 0 ? 'Squeaky clean floor' : dirtyLabel;
  task.style.setProperty('--mop-x', `${(mopX * 100).toFixed(3)}%`);
  task.style.setProperty('--mop-y', `${(mopY * 100).toFixed(3)}%`);
  task.style.setProperty('--mop-progress', `${progress.toFixed(2)}%`);
  task.classList.toggle('is-mopping', data.mopActive === true);
  task.classList.toggle('is-sparkly', progress >= 98 || data.sparklyClean === true);
  task.classList.toggle('is-squeaky-clean', squeakyClean);

  const progressLabel = task.querySelector('[data-office-mop-progress-label]');
  if (progressLabel) {
    progressLabel.textContent = `${Math.round(progress)}% clean`;
  }
  const dirtCountLabel = task.querySelector('[data-office-mop-dirt-count]');
  if (dirtCountLabel) {
    dirtCountLabel.textContent = dirtStatusLabel;
  }
  const meterFill = task.querySelector('.hud__school-meter-fill');
  if (meterFill instanceof HTMLElement) {
    meterFill.style.setProperty('--meter', `${progress.toFixed(2)}%`);
  }
  const meter = task.querySelector('.hud__school-meter');
  if (meter instanceof HTMLElement) {
    meter.setAttribute('aria-valuenow', progress.toFixed(0));
  }

  for (const patch of patches) {
    const id = String(patch.id ?? '');
    if (!id) {
      continue;
    }
    const escapedId = globalThis.CSS?.escape
      ? globalThis.CSS.escape(id)
      : id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const dirtNode = task.querySelector(`[data-office-mop-dirt="${escapedId}"]`);
    if (!(dirtNode instanceof HTMLElement)) {
      continue;
    }
    const clean = Math.max(0, Math.min(1, Number(patch.clean ?? 0) || 0));
    dirtNode.style.setProperty('--dirt-clean', clean.toFixed(3));
    dirtNode.classList.toggle('is-clean', clean >= 0.98);
  }
}

function updateOfficeCoffeeFillLiveMarkup(root = null, game = null) {
  const task = root?.querySelector?.('.hud__office-coffee');
  if (!task || game?.phase !== 'playing') {
    return;
  }

  const round = game.round ?? {};
  const data = game.data ?? {};
  const fill = Math.max(0, Math.min(100, Number(data.fill ?? 0) || 0));
  const targetStart = Math.max(0, Math.min(100, Number(round.targetStart ?? 72) || 72));
  const targetEnd = Math.max(targetStart, Math.min(100, Number(round.targetEnd ?? 82) || 82));
  const brewing = data.brewing === true && data.released !== true;

  task.style.setProperty('--fill', `${fill.toFixed(2)}%`);
  task.style.setProperty('--target-bottom', `${targetStart.toFixed(2)}%`);
  task.style.setProperty('--target-height', `${(targetEnd - targetStart).toFixed(2)}%`);
  task.classList.toggle('is-brewing', brewing);
  task.classList.toggle('is-released', data.released === true);

  const fillLabel = task.querySelector('[data-office-coffee-fill-label]');
  if (fillLabel) {
    fillLabel.textContent = `${Math.round(fill)}% full`;
  }
  const targetLabel = task.querySelector('[data-office-coffee-target-label]');
  if (targetLabel) {
    targetLabel.textContent = `Target ${Math.round(targetStart)}-${Math.round(targetEnd)}%`;
  }
  const holdButton = task.querySelector('[data-school-microgame-hold]');
  if (holdButton) {
    holdButton.setAttribute('aria-pressed', brewing ? 'true' : 'false');
  }
}

function updateSchoolMicrogameLiveMarkup(root = null, game = null) {
  if (!root || game?.context !== 'office-job' || game?.phase !== 'playing') {
    return;
  }

  if (String(game.round?.gameId ?? '') === OFFICE_JOB_GAME_IDS.officeManager) {
    updateOfficeCoffeeFillLiveMarkup(root, game);
    return;
  }

  if (String(game.round?.gameId ?? '') === OFFICE_JOB_GAME_IDS.janitorMopHero) {
    updateOfficeMopHeroLiveMarkup(root, game);
    return;
  }

  if (String(game.round?.officeJobId ?? game.round?.jobId ?? '') === OFFICE_JOB_IDS.janitor) {
    updateOfficeTrashTossLiveMarkup(root, game);
  }
}

function createSchoolMicrogameBodyMarkup(game = null) {
  const phase = String(game?.phase ?? 'ready');
  if (phase === 'menu' && game?.context === 'office-job') {
    return createOfficeJobMenuMarkup(game);
  }
  if (phase === 'ready') {
    return createReadySchoolMicrogameMarkup(game);
  }

  if (phase === 'countdown') {
    return createSchoolCountdownMarkup(game);
  }

  if (phase === 'success' || phase === 'failure') {
    const resultClass = phase === 'success' ? ' is-success' : ' is-failure';
    const isSchoolSession = game?.context === 'school-minigame';
    return `
      <div class="hud__school-result${resultClass}">
        <div class="hud__school-result-burst" aria-hidden="true"></div>
        <strong>${escapeHtml(getSchoolMicrogameResultLabel(game))}</strong>
        <p>${escapeHtml(game?.resultDetail || game?.message || '')}</p>
        ${phase === 'success' ? `<span>${escapeHtml(getSchoolMicrogameRewardText(game?.round, { prefix: true }))}</span>` : ''}
        ${isSchoolSession ? '' : createSchoolGameButton('restart', 'Play Again', 'is-primary')}
      </div>
    `;
  }

  return createSchoolMicrogamePlayMarkup(game);
}

function createStockIconMarkup(stock = {}, className = '') {
  const icon = String(stock?.icon ?? '').trim();
  const label = escapeHtml(stock?.symbol ?? 'Stock');
  const classes = `hud__stock-icon${className ? ` ${className}` : ''}`;
  const common = `
    class="${classes}"
    viewBox="0 0 32 32"
    role="img"
    aria-label="${label}"
    style="--stock-accent:${escapeHtml(stock?.accent ?? '#f2c871')}"
  `;

  switch (icon) {
    case 'burger':
      return `
        <svg ${common}>
          <path class="hud__stock-icon-fill" d="M7 14c.8-5 4.5-8 9-8s8.2 3 9 8H7z" />
          <path class="hud__stock-icon-stroke" d="M6 18h20" />
          <path class="hud__stock-icon-fill" d="M7 20h18l-1.8 4H8.8L7 20z" />
          <path class="hud__stock-icon-stroke" d="M11 11h2M16 9h2M20 12h2" />
        </svg>
      `;
    case 'cola':
      return `
        <svg ${common}>
          <path class="hud__stock-icon-stroke" d="M13 4h6M14 8h4l2 18h-8l2-18z" />
          <path class="hud__stock-icon-fill" d="M13 15h6l.7 7h-7.4l.7-7z" />
          <path class="hud__stock-icon-stroke" d="M12 26h8" />
        </svg>
      `;
    case 'gym':
      return `
        <svg ${common}>
          <path class="hud__stock-icon-stroke" d="M4 13v6M8 10v12M24 10v12M28 13v6M8 16h16" />
          <path class="hud__stock-icon-fill" d="M12 14h8v4h-8z" />
        </svg>
      `;
    case 'medical':
      return `
        <svg ${common}>
          <path class="hud__stock-icon-stroke" d="M10 9V7h12v2M8 10h16v16H8z" />
          <path class="hud__stock-icon-fill" d="M14 13h4v4h4v4h-4v4h-4v-4h-4v-4h4z" />
        </svg>
      `;
    case 'cab':
      return `
        <svg ${common}>
          <path class="hud__stock-icon-stroke" d="M8 18l2-7h12l2 7M7 18h18v6H7zM10 24v2M22 24v2" />
          <path class="hud__stock-icon-fill" d="M11 13h10l1 4H10z" />
          <path class="hud__stock-icon-stroke" d="M11 21h2M19 21h2" />
        </svg>
      `;
    case 'token':
      return `
        <svg ${common}>
          <circle class="hud__stock-icon-fill" cx="16" cy="16" r="10" />
          <circle class="hud__stock-icon-stroke" cx="16" cy="16" r="6" />
          <path class="hud__stock-icon-stroke" d="M16 10v12M10 16h12" />
        </svg>
      `;
    case 'tool':
      return `
        <svg ${common}>
          <path class="hud__stock-icon-stroke" d="M20 5a7 7 0 0 0 7 7L15 24l-5-5L22 7a7 7 0 0 0-2-2z" />
          <path class="hud__stock-icon-fill" d="M7 21l4 4-2 2H5v-4l2-2z" />
        </svg>
      `;
    case 'rent':
      return `
        <svg ${common}>
          <path class="hud__stock-icon-stroke" d="M7 14l9-8 9 8v12H7z" />
          <path class="hud__stock-icon-fill" d="M13 18h6v8h-6z" />
          <path class="hud__stock-icon-stroke" d="M11 15h10" />
        </svg>
      `;
    default:
      return `
        <svg ${common}>
          <circle class="hud__stock-icon-fill" cx="16" cy="16" r="10" />
          <text class="hud__stock-icon-text" x="16" y="20">${escapeHtml(String(stock?.symbol ?? '?').slice(0, 2))}</text>
        </svg>
      `;
  }
}

function createAllStockChartMarkup(stocks = [], selectedSymbol = '', options = {}) {
  const layout = options?.layout === 'phone' ? 'phone' : 'wide';
  const series = (Array.isArray(stocks) ? stocks : [])
    .map((stock) => ({
      ...stock,
      values: Array.isArray(stock?.history)
        ? stock.history.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : []
    }))
    .filter((stock) => stock.values.length >= 2);
  if (!series.length) {
    return '<div class="hud__stock-overview-empty">No market history yet.</div>';
  }

  const phoneLayout = layout === 'phone';
  const width = phoneLayout ? 360 : 960;
  const height = phoneLayout ? 280 : 260;
  const plotRight = phoneLayout ? 316 : 890;
  const markerX = phoneLayout ? 342 : 930;
  const tooltipWidth = phoneLayout ? 252 : 420;
  const tooltipHeight = phoneLayout ? 86 : 124;
  const plotTop = phoneLayout ? 14 : 18;
  const plotBottom = height - (phoneLayout ? 14 : 18);
  const plotHeight = Math.max(1, plotBottom - plotTop);
  const scaleValues = series.flatMap((stock) => {
    const price = Number(stock.price);
    return Number.isFinite(price)
      ? [...stock.values, price]
      : stock.values;
  });
  const min = Math.min(...scaleValues);
  const max = Math.max(...scaleValues);
  const span = Math.max(0.01, max - min);
  const toY = (value) => plotBottom - (((value - min) / span) * plotHeight);
  const gridPath = [
    `M0 ${(plotTop + plotHeight * 0.25).toFixed(1)}h${plotRight}`,
    `M0 ${(plotTop + plotHeight * 0.5).toFixed(1)}h${plotRight}`,
    `M0 ${(plotTop + plotHeight * 0.75).toFixed(1)}h${plotRight}`,
    `M${(plotRight * 0.2).toFixed(1)} ${plotTop}v${plotHeight}`,
    `M${(plotRight * 0.4).toFixed(1)} ${plotTop}v${plotHeight}`,
    `M${(plotRight * 0.6).toFixed(1)} ${plotTop}v${plotHeight}`,
    `M${(plotRight * 0.8).toFixed(1)} ${plotTop}v${plotHeight}`
  ].join('');
  const groups = [];

  for (const stock of series) {
    const points = stock.values.map((value, index) => {
      const x = stock.values.length <= 1 ? 0 : (index / (stock.values.length - 1)) * plotRight;
      return `${x.toFixed(2)},${toY(value).toFixed(2)}`;
    }).join(' ');
    const y = toY(stock.price ?? stock.values[stock.values.length - 1]);
    const active = stock.symbol === selectedSymbol;
    const activeClass = active ? ' is-active' : '';
    const tooltipX = Math.max(8, markerX - tooltipWidth - 24);
    const tooltipY = Math.min(
      height - tooltipHeight - 8,
      Math.max(8, y - (tooltipHeight / 2))
    );
    groups.push(`
      <g
        class="hud__stock-overview-series${activeClass}"
        data-stock-symbol="${escapeHtml(stock.symbol)}"
        style="--stock-accent:${escapeHtml(stock.accent)}"
      >
        <polyline
          class="hud__stock-overview-line"
          points="${points}"
        ></polyline>
        <polyline class="hud__stock-overview-hit" points="${points}"></polyline>
        <g class="hud__stock-overview-marker" transform="translate(${markerX.toFixed(2)} ${y.toFixed(2)})">
          <circle class="hud__stock-overview-marker-bg" r="14"></circle>
          <foreignObject x="-10" y="-10" width="20" height="20">
            <div xmlns="http://www.w3.org/1999/xhtml" class="hud__stock-overview-icon">
              ${createStockIconMarkup(stock, 'is-mini')}
            </div>
          </foreignObject>
        </g>
        <foreignObject class="hud__stock-overview-tooltip" x="${tooltipX.toFixed(2)}" y="${tooltipY.toFixed(2)}" width="${tooltipWidth}" height="${tooltipHeight}">
          <div xmlns="http://www.w3.org/1999/xhtml" class="hud__stock-tooltip">
            ${createStockIconMarkup(stock, 'is-mini')}
            <span>
              <strong>${escapeHtml(stock.name)}</strong>
              <em>${escapeHtml(stock.symbol)} ${formatStockMoney(stock.price)}</em>
            </span>
          </div>
        </foreignObject>
      </g>
    `);
  }

  return `
    <svg class="hud__stock-overview-chart${phoneLayout ? ' is-phone-layout' : ''}" viewBox="0 0 ${width} ${height}" aria-label="All stock prices">
      <path class="hud__stock-overview-grid" d="${gridPath}" />
      <g class="hud__stock-overview-lines">${groups.join('')}</g>
      <path class="hud__stock-overview-axis" d="M${plotRight} ${plotTop}v${plotHeight}" />
    </svg>
  `;
}

function formatHudCount(value) {
  const numeric = Number(value ?? 0);
  const amount = Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
  return amount.toLocaleString('en-US');
}

function randomBetween(min, max) {
  return min + (Math.random() * (max - min));
}

function getTaskConfettiShape(index) {
  if (index % 13 === 0) {
    return 'circle';
  }

  return index % 5 === 0 ? 'streamer' : 'rect';
}

function createTaskConfettiParticle({ index, now, originX, originY, originSpread, colors = TASK_CONFETTI_COLORS }) {
  const direction = index % 2 === 0 ? -1 : 1;
  const cone = (-Math.PI * 0.5) + ((Math.random() - 0.5) * TASK_CONFETTI_UPWARD_CONE_RADIANS);
  const speed = randomBetween(420, 1400);
  const wideKick = randomBetween(-210, 210);
  const size = randomBetween(5, 15);

  return {
    x: originX + randomBetween(-originSpread * 0.5, originSpread * 0.5),
    y: originY + randomBetween(-6, 6),
    vx: (Math.cos(cone) * speed) + wideKick,
    vy: (Math.sin(cone) * speed) - randomBetween(0, 220),
    gravity: randomBetween(920, 1440),
    drag: randomBetween(0.982, 0.994),
    sway: randomBetween(28, 123),
    flutterPhase: Math.random() * Math.PI * 2,
    flutterSpeed: randomBetween(4, 12),
    width: size * randomBetween(0.75, 1.6),
    height: size * randomBetween(1.1, 2.7),
    color: colors[index % colors.length],
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: direction * randomBetween(5, 23),
    flipSpeed: randomBetween(5, 15),
    bornAt: now,
    lifetime: randomBetween(2200, 3500),
    opacity: randomBetween(0.76, 1),
    shape: getTaskConfettiShape(index)
  };
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
      warning: step.warning ?? '',
      pickModeActive: step.pickModeActive === true,
      targetOptions: (step.targetOptions ?? []).map((option) => ({
        id: option.id,
        label: option.label
      }))
    }))
  });
}

function getNpcRoutineStepFieldValue(step, field) {
  switch (field) {
    case 'type':
      return step.type ?? '';
    case 'targetPlacementId':
      return step.targetPlacementId ?? '';
    case 'durationMs':
      return step.durationMs ?? '';
    case 'hiddenDurationMs':
      return step.hiddenDurationMs ?? '';
    case 'radius':
      return step.radius ?? '';
    default:
      return '';
  }
}

const HUD_CONTROLS = Object.freeze([
  { label: 'Move', key: 'WASD' },
  { label: 'Fire', mouseButton: 'left' },
  { label: 'Aim', mouseButton: 'right' },
  { label: 'Interact', key: 'E' },
  { label: 'Phone', key: 'Tab' },
  { label: 'Reload', key: 'R' },
  { label: 'Chat', key: 'Enter' },
  { label: 'Emote', key: 'B' }
]);

const HOTBAR_ICON_ASSETS = Object.freeze({
  hotbarPistol: assets.ui.hotbarPistol
});

function getHotbarItemIconMarkup(slot = {}) {
  if (slot.hotbarIconId === 'drinkBeer') {
    return '<span class="hud__hotbar-drink-icon hud__hotbar-drink-icon--beer" aria-hidden="true"><span class="hud__hotbar-drink-body"></span><span class="hud__hotbar-drink-foam"></span><span class="hud__hotbar-drink-handle"></span></span>';
  }

  if (slot.hotbarIconId === 'drinkShot') {
    return '<span class="hud__hotbar-drink-icon hud__hotbar-drink-icon--shot" aria-hidden="true"><span class="hud__hotbar-drink-body"></span><span class="hud__hotbar-drink-fill"></span></span>';
  }

  if (slot.hotbarIconId === 'consumableCigarettes') {
    return '<span class="hud__hotbar-cigarette-icon" aria-hidden="true"><span class="hud__hotbar-cigarette-pack"></span><span class="hud__hotbar-cigarette-stick"></span><span class="hud__hotbar-cigarette-filter"></span></span>';
  }

  if (slot.hotbarIconId === 'foodBurger') {
    return '<span class="hud__hotbar-food-icon hud__hotbar-food-icon--burger" aria-hidden="true"><span class="hud__hotbar-food-cheese"></span><span class="hud__hotbar-food-patty"></span></span>';
  }

  if (slot.hotbarIconId === 'foodGlizzy') {
    return '<span class="hud__hotbar-food-icon hud__hotbar-food-icon--glizzy" aria-hidden="true"><span class="hud__hotbar-food-sausage"></span></span>';
  }

  if (slot.hotbarIconId === 'foodSoda') {
    return '<span class="hud__hotbar-food-icon hud__hotbar-food-icon--soda" aria-hidden="true"><span class="hud__hotbar-soda-straw"></span><span class="hud__hotbar-soda-lid"></span><span class="hud__hotbar-soda-cup"></span></span>';
  }

  const iconUrl = HOTBAR_ICON_ASSETS[slot.hotbarIconId] ?? '';
  if (!iconUrl) {
    return '';
  }

  const iconClass = slot.hotbarIconId === 'hotbarPistol' ? ' hud__hotbar-pistol-icon' : '';
  return `<img class="hud__hotbar-item-icon${iconClass}" src="${escapeHtml(iconUrl)}" alt="" aria-hidden="true" draggable="false">`;
}

function getHotbarSlotMarkup(slot = {}, selectedSlotIndex = 0) {
  const index = Number(slot.index) || 0;
  const isSelected = index === selectedSlotIndex;
  const isEmpty = !slot.itemId;
  const label = slot.label || (isEmpty ? 'Empty' : 'Item');
  return `
    <button
      class="hud__hotbar-slot${isSelected ? ' is-selected' : ''}${isEmpty ? ' is-empty' : ''}"
      type="button"
      data-hotbar-slot="${index}"
      data-hotbar-item-id="${escapeHtml(slot.itemId ?? '')}"
      draggable="false"
      aria-label="Hotbar ${escapeHtml(slot.key ?? String(index + 1))}: ${escapeHtml(label)}"
      aria-pressed="${isSelected ? 'true' : 'false'}"
    >
      <span class="hud__hotbar-slot-glow" aria-hidden="true"></span>
      <span class="hud__hotbar-item">${getHotbarItemIconMarkup(slot)}</span>
      ${slot.count > 1 ? `<span class="hud__hotbar-count" aria-hidden="true">${formatHudCount(slot.count)}</span>` : ''}
      <span class="hud__hotbar-name">${escapeHtml(label)}</span>
    </button>
  `;
}

function getSkateboardBadgeMarkup() {
  return `
    <span class="hud__bound-skateboard-icon" aria-hidden="true">
      <span class="hud__bound-skateboard-deck"></span>
      <span class="hud__bound-skateboard-truck hud__bound-skateboard-truck--front"></span>
      <span class="hud__bound-skateboard-truck hud__bound-skateboard-truck--back"></span>
      <span class="hud__bound-skateboard-wheel hud__bound-skateboard-wheel--front-left"></span>
      <span class="hud__bound-skateboard-wheel hud__bound-skateboard-wheel--front-right"></span>
      <span class="hud__bound-skateboard-wheel hud__bound-skateboard-wheel--back-left"></span>
      <span class="hud__bound-skateboard-wheel hud__bound-skateboard-wheel--back-right"></span>
    </span>
  `;
}

function getVehicleBadgeMarkup() {
  return `
    <span class="hud__bound-vehicle-icon" aria-hidden="true">
      <span class="hud__bound-vehicle-body"></span>
      <span class="hud__bound-vehicle-cabin"></span>
      <span class="hud__bound-vehicle-wheel hud__bound-vehicle-wheel--front"></span>
      <span class="hud__bound-vehicle-wheel hud__bound-vehicle-wheel--back"></span>
    </span>
  `;
}

function getCarSelectorCardMarkup(entry = {}) {
  return `
    <button
      class="hud__character-card hud__car-card${entry.selected ? ' is-selected' : ''}"
      type="button"
      data-car-item-id="${escapeHtml(entry.id ?? '')}"
      style="--car-accent:${escapeHtml(entry.accent ?? '#d85b4d')}"
      aria-pressed="${entry.selected ? 'true' : 'false'}"
    >
      <span class="hud__character-card-frame hud__car-card-frame">
        <span class="hud__car-card-preview" data-car-preview-card="${escapeHtml(entry.id ?? '')}">
          <span class="hud__car-model-placeholder" aria-hidden="true"></span>
        </span>
      </span>
      <span class="hud__character-card-label">${escapeHtml(entry.label ?? 'Vehicle')}</span>
    </button>
  `;
}

function getInteractionActionMarkup(action = {}) {
  const hasVehiclePreview = Boolean(action.previewItemId);
  const className = [
    'hud__dialog-button',
    action.primary ? 'is-primary' : '',
    hasVehiclePreview ? 'hud__dialog-button--vehicle' : ''
  ].filter(Boolean).join(' ');
  const label = String(action.label ?? action.title ?? 'Action');
  const content = hasVehiclePreview
    ? `
      <span class="hud__dialog-button-preview" data-car-dealer-preview="${escapeHtml(action.previewItemId)}">
        <span class="hud__car-model-placeholder" aria-hidden="true"></span>
      </span>
      <span class="hud__dialog-button-copy">
        <strong>${escapeHtml(action.title ?? label)}</strong>
        ${action.meta ? `<span>${escapeHtml(action.meta)}</span>` : ''}
        ${action.state ? `<em>${escapeHtml(action.state)}</em>` : ''}
      </span>
    `
    : escapeHtml(label);

  return `
    <button
      class="${className}"
      type="button"
      data-interaction-action="${escapeHtml(action.id ?? '')}"
      aria-label="${escapeHtml(action.ariaLabel ?? label)}"
      ${action.disabled ? 'disabled' : ''}
    >
      ${content}
    </button>
  `;
}

function normalizeHudDrunknessLevel(level = 0) {
  const numeric = Number(level);
  return Number.isFinite(numeric)
    ? Math.max(0, Math.min(DRUNKNESS_MAX_LEVEL, Math.floor(numeric)))
    : 0;
}

function getHudDrunknessHue(level = 0) {
  const normalizedLevel = normalizeHudDrunknessLevel(level);
  return normalizedLevel > 0
    ? Math.round(120 - ((normalizedLevel - 1) / Math.max(1, DRUNKNESS_MAX_LEVEL - 1)) * 120)
    : 120;
}

function getHudDrunknessLabelMarkup() {
  return Array.from({ length: DRUNKNESS_MAX_LEVEL }, (_, index) => {
    const level = DRUNKNESS_MAX_LEVEL - index;
    const hue = getHudDrunknessHue(level);
    return `<span class="hud__drunkness-label" data-drunkness-label-level="${level}" style="--drunkness-label-hue: ${hue};">${escapeHtml(getDrunknessLevelLabel(level))}</span>`;
  }).join('');
}

const BUILDER_PANEL_DEFAULT_WIDTH = 620;
const BUILDER_PANEL_MIN_WIDTH = 320;
const BUILDER_PANEL_MAX_WIDTH = 860;
const BUILDER_PANEL_MOBILE_BREAKPOINT = 900;
const ADMIN_PROMPT_MIN_WIDTH = 340;
const ADMIN_PROMPT_MIN_HEIGHT = 280;
const ADMIN_PROMPT_MAX_WIDTH = 980;
const ADMIN_PROMPT_MAX_HEIGHT = 780;
const ADMIN_PROMPT_DEFAULT_WIDTH = ADMIN_PROMPT_MAX_WIDTH;
const ADMIN_PROMPT_DEFAULT_HEIGHT = ADMIN_PROMPT_MAX_HEIGHT;
const ADMIN_PROMPT_VIEWPORT_MARGIN = 6;
const ADMIN_PROMPT_TOP_ACTIONS_GAP = 12;

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
    this.loadingTargetProgress = 0;
    this.loadingRequestedProgress = 0;
    this.loadingDisplayedProgress = 0;
    this.loadingProgressFrame = 0;
    this.loadingProgressDelayTimeout = 0;
    this.loadingProgressLastFrameAt = 0;
    this.loadingProgressUnlockAt = performance.now() + 900;
    this.officeMopHeroPointerPosition = { x: 0, y: 0, inside: false };
    this.setLoadingProgress(0);
    this.overlay = this.createOverlay();
    this.joinTitle = this.overlay.querySelector('[data-join-title]');
    this.promptText = this.overlay.querySelector('[data-prompt]');
    this.toastText = this.overlay.querySelector('[data-toast]');
    this.jobLockAlert = this.overlay.querySelector('[data-office-prereq-alert]');
    this.jobLockAlertText = this.overlay.querySelector('[data-office-prereq-text]');
    this.connectionStatusRoot = this.overlay.querySelector('[data-connection-status]');
    this.connectionStatusLabel = this.overlay.querySelector('[data-connection-status-label]');
    this.connectionPlayers = this.overlay.querySelector('[data-connection-players]');
    this.connectionPlayerCount = this.overlay.querySelector('[data-connection-player-count]');
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
    this.mapCaptureToggle = this.overlay.querySelector('[data-map-capture-toggle]');
    this.adminPositionRoot = this.overlay.querySelector('[data-admin-position]');
    this.adminPositionValue = this.overlay.querySelector('[data-admin-position-value]');
    this.adminPositionHint = this.overlay.querySelector('[data-admin-position-hint]');
    this.combatRoot = this.overlay.querySelector('[data-combat-root]');
    this.combatMeter = this.overlay.querySelector('[data-combat-meter]');
    this.combatHealthTrail = this.overlay.querySelector('[data-combat-health-trail]');
    this.combatHealthFill = this.overlay.querySelector('[data-combat-health-fill]');
    this.combatHealthBurst = this.overlay.querySelector('[data-combat-health-burst]');
    this.ammoRoot = this.overlay.querySelector('[data-ammo-root]');
    this.ammoBullets = this.overlay.querySelector('[data-ammo-bullets]');
    this.ammoReserveValue = this.overlay.querySelector('[data-ammo-reserve-value]');
    this.ammoReserveLabel = this.overlay.querySelector('[data-ammo-reserve-label]');
    this.hotbarRoot = this.overlay.querySelector('[data-hotbar-root]');
    this.hotbarSlotsRoot = this.overlay.querySelector('[data-hotbar-slots]');
    this.boundItemsRoot = this.overlay.querySelector('[data-bound-items]');
    this.boundVehicleRoot = this.overlay.querySelector('[data-bound-item-vehicle]');
    this.boundVehicleLabel = null;
    this.boundVehicleSkateboardIcon = this.overlay.querySelector('[data-bound-item-skateboard-icon]');
    this.boundVehicleCarIcon = this.overlay.querySelector('[data-bound-item-car-icon]');
    this.carSelectorRoot = this.overlay.querySelector('[data-car-selector]');
    this.carSelectorClose = this.overlay.querySelector('[data-car-selector-close]');
    this.carSelectorName = this.overlay.querySelector('[data-car-selector-name]');
    this.carSelectorSubtitle = this.overlay.querySelector('[data-car-selector-subtitle]');
    this.carSelectorStatus = this.overlay.querySelector('[data-car-selector-status]');
    this.carSelectorPreview = this.overlay.querySelector('[data-car-selector-preview]');
    this.carSelectorPrev = this.overlay.querySelector('[data-car-selector-prev]');
    this.carSelectorNext = this.overlay.querySelector('[data-car-selector-next]');
    this.carSelectorGrid = this.overlay.querySelector('[data-car-selector-grid]');
    this.drunknessRoot = this.overlay.querySelector('[data-drunkness-root]');
    this.drunknessFill = this.overlay.querySelector('[data-drunkness-fill]');
    this.drunknessLabels = Array.from(this.overlay.querySelectorAll('[data-drunkness-label-level]'));
    this.moneyRoot = this.overlay.querySelector('[data-money]');
    this.moneyValue = this.overlay.querySelector('[data-money-value]');
    this.moneyNetWorth = this.overlay.querySelector('[data-money-net-worth]');
    this.taskRoot = this.overlay.querySelector('[data-task]');
    this.taskTitle = this.overlay.querySelector('[data-task-title]');
    this.taskConfetti = this.overlay.querySelector('[data-task-confetti]');
    this.skillLevelUpRoot = this.overlay.querySelector('[data-skill-level-up]');
    this.skillLevelUpIcon = this.overlay.querySelector('[data-skill-level-up-icon]');
    this.skillLevelUpTitle = this.overlay.querySelector('[data-skill-level-up-title]');
    this.skillLevelUpSubtitle = this.overlay.querySelector('[data-skill-level-up-subtitle]');
    this.respawnText = this.overlay.querySelector('[data-respawn]');
    this.respawnLine = this.overlay.querySelector('[data-respawn-line]');
    this.respawnDetail = this.overlay.querySelector('[data-respawn-detail]');
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
    this.builderPropSizePanel = this.overlay.querySelector('[data-builder-prop-size-panel]');
    this.builderPropSizeInput = this.overlay.querySelector('[data-builder-prop-size]');
    this.builderPropSizeValue = this.overlay.querySelector('[data-builder-prop-size-value]');
    this.builderPropSizeTarget = this.overlay.querySelector('[data-builder-prop-size-target]');
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
    this.builderNpcRotate = this.overlay.querySelector('[data-builder-npc-rotate]');
    this.builderNpcMove = this.overlay.querySelector('[data-builder-npc-move]');
    this.builderNpcDelete = this.overlay.querySelector('[data-builder-npc-delete]');
    this.builderNpcDone = this.overlay.querySelector('[data-builder-npc-done]');
    this.builderNpcModel = this.overlay.querySelector('[data-builder-npc-model]');
    this.builderNpcModelOptions = this.overlay.querySelector('[data-builder-npc-model-options]');
    this.builderNpcVoicePitch = this.overlay.querySelector('[data-builder-npc-voice-pitch]');
    this.builderNpcVoiceSpeed = this.overlay.querySelector('[data-builder-npc-voice-speed]');
    this.builderNpcVoiceRange = this.overlay.querySelector('[data-builder-npc-voice-range]');
    this.builderNpcVoiceTone = this.overlay.querySelector('[data-builder-npc-voice-tone]');
    this.builderNpcVoiceVolume = this.overlay.querySelector('[data-builder-npc-voice-volume]');
    this.builderNpcName = this.overlay.querySelector('[data-builder-npc-name]');
    this.builderNpcRadius = this.overlay.querySelector('[data-builder-npc-radius]');
    this.builderNpcSpeed = this.overlay.querySelector('[data-builder-npc-speed]');
    this.builderNpcRespawnDelay = this.overlay.querySelector('[data-builder-npc-respawn-delay]');
    this.builderNpcDeliveryQuest = this.overlay.querySelector('[data-builder-npc-delivery-quest]');
    this.builderNpcGymCheckIn = this.overlay.querySelector('[data-builder-npc-gym-check-in]');
    this.builderNpcRentCollector = this.overlay.querySelector('[data-builder-npc-rent-collector]');
    this.builderNpcStockMarket = this.overlay.querySelector('[data-builder-npc-stock-market]');
    this.builderNpcBartender = this.overlay.querySelector('[data-builder-npc-bartender]');
    this.builderNpcPawnShopOwner = this.overlay.querySelector('[data-builder-npc-pawn-shop-owner]');
    this.builderNpcCarDealer = this.overlay.querySelector('[data-builder-npc-car-dealer]');
    this.builderNpcMartha = this.overlay.querySelector('[data-builder-npc-martha]');
    this.builderNpcBlackjackDealer = this.overlay.querySelector('[data-builder-npc-blackjack-dealer]');
    this.builderNpcSchoolMicrogame = this.overlay.querySelector('[data-builder-npc-school-microgame]');
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
    this.stockMarketRoot = this.overlay.querySelector('[data-stock-market]');
    this.stockMarketClose = this.overlay.querySelector('[data-stock-market-close]');
    this.stockMarketRefresh = this.overlay.querySelector('[data-stock-market-refresh]');
    this.stockMarketStatus = this.overlay.querySelector('[data-stock-market-status]');
    this.stockMarketCash = this.overlay.querySelector('[data-stock-market-cash]');
    this.stockMarketPortfolio = this.overlay.querySelector('[data-stock-market-portfolio]');
    this.stockMarketNetWorth = this.overlay.querySelector('[data-stock-market-net-worth]');
    this.stockMarketOverview = this.overlay.querySelector('[data-stock-market-overview]');
    this.stockMarketList = this.overlay.querySelector('[data-stock-market-list]');
    this.stockMarketDetail = this.overlay.querySelector('[data-stock-market-detail]');
    this.stockMarketQuantity = this.overlay.querySelector('[data-stock-market-quantity]');
    this.stockMarketBuy = this.overlay.querySelector('[data-stock-market-buy]');
    this.stockMarketSell = this.overlay.querySelector('[data-stock-market-sell]');
    this.blackjackRoot = this.overlay.querySelector('[data-blackjack]');
    this.blackjackClose = this.overlay.querySelector('[data-blackjack-close]');
    this.blackjackStatus = this.overlay.querySelector('[data-blackjack-status]');
    this.blackjackDealerName = this.overlay.querySelector('[data-blackjack-dealer-name]');
    this.blackjackCash = this.overlay.querySelector('[data-blackjack-cash]');
    this.blackjackWager = this.overlay.querySelector('[data-blackjack-wager]');
    this.blackjackDeal = this.overlay.querySelector('[data-blackjack-deal]');
    this.blackjackDealerHand = this.overlay.querySelector('[data-blackjack-dealer-hand]');
    this.blackjackPlayerHand = this.overlay.querySelector('[data-blackjack-player-hand]');
    this.blackjackDealerValue = this.overlay.querySelector('[data-blackjack-dealer-value]');
    this.blackjackPlayerValue = this.overlay.querySelector('[data-blackjack-player-value]');
    this.blackjackMessage = this.overlay.querySelector('[data-blackjack-message]');
    this.blackjackResult = this.overlay.querySelector('[data-blackjack-result]');
    this.blackjackHit = this.overlay.querySelector('[data-blackjack-hit]');
    this.blackjackStand = this.overlay.querySelector('[data-blackjack-stand]');
    this.blackjackDouble = this.overlay.querySelector('[data-blackjack-double]');
    this.blackjackSplit = this.overlay.querySelector('[data-blackjack-split]');
    this.blackjackWagerChips = this.overlay.querySelector('[data-blackjack-wager-chips]');
    this.schoolMicrogameRoot = this.overlay.querySelector('[data-school-microgame]');
    this.schoolMicrogameClose = this.overlay.querySelector('[data-school-microgame-close]');
    this.schoolMicrogameTitle = this.overlay.querySelector('[data-school-microgame-title]');
    this.schoolMicrogameEyebrow = this.overlay.querySelector('[data-school-microgame-eyebrow]');
    this.schoolMicrogameStatus = this.overlay.querySelector('[data-school-microgame-status]');
    this.schoolMicrogameTimer = this.overlay.querySelector('[data-school-microgame-timer]');
    this.schoolMicrogameBody = this.overlay.querySelector('[data-school-microgame-body]');
    this.schoolMicrogameMessage = this.overlay.querySelector('[data-school-microgame-message]');
    this.vibeHeroRoot = this.overlay.querySelector('[data-vibe-hero]');
    this.vibeHeroClose = this.overlay.querySelector('[data-vibe-hero-close]');
    this.vibeHeroStatus = this.overlay.querySelector('[data-vibe-hero-status]');
    this.vibeHeroTimer = this.overlay.querySelector('[data-vibe-hero-timer]');
    this.vibeHeroBody = this.overlay.querySelector('[data-vibe-hero-body]');
    this.vibeHeroMessage = this.overlay.querySelector('[data-vibe-hero-message]');
    this.basketballShotRoot = this.overlay.querySelector('[data-basketball-shot]');
    this.basketballShotStatus = this.overlay.querySelector('[data-basketball-shot-status]');
    this.basketballShotBody = this.overlay.querySelector('[data-basketball-shot-body]');
    this.basketballShotMessage = this.overlay.querySelector('[data-basketball-shot-message]');
    this.rentIntroCutsceneRoot = this.overlay.querySelector('[data-rent-intro-cutscene]');
    this.adminPromptToggle = this.overlay.querySelector('[data-admin-prompt-toggle]');
    this.adminPromptRoot = this.overlay.querySelector('[data-admin-prompt]');
    this.adminPromptDragHandle = this.overlay.querySelector('[data-admin-prompt-drag-handle]');
    this.adminPromptResizeHandles = Array.from(this.overlay.querySelectorAll('[data-admin-prompt-resize-handle]'));
    this.adminPromptClose = this.overlay.querySelector('[data-admin-prompt-close]');
    this.adminPromptForm = this.overlay.querySelector('[data-admin-prompt-form]');
    this.adminPromptPrompt = this.overlay.querySelector('[data-admin-prompt-prompt]');
    this.adminPromptMode = this.overlay.querySelector('[data-admin-prompt-mode]');
    this.adminPromptAutoOption = this.overlay.querySelector('[data-admin-prompt-mode-auto]');
    this.adminPromptSubmit = this.overlay.querySelector('[data-admin-prompt-submit]');
    this.adminPromptRefresh = this.overlay.querySelector('[data-admin-prompt-refresh]');
    this.adminPromptStatus = this.overlay.querySelector('[data-admin-prompt-status]');
    this.adminPromptTabs = this.overlay.querySelector('[data-admin-prompt-tabs]');
    this.adminPromptNew = this.overlay.querySelector('[data-admin-prompt-new]');
    this.adminPromptTaskBrowser = this.overlay.querySelector('[data-admin-prompt-task-browser]');
    this.adminPromptTasks = this.overlay.querySelector('[data-admin-prompt-tasks]');
    this.adminPromptDetail = this.overlay.querySelector('[data-admin-prompt-detail]');
    this.adminPromptContext = this.overlay.querySelector('[data-admin-prompt-context]');
    this.quickChatRoot = this.overlay.querySelector('[data-quick-chat]');
    this.quickChatForm = this.overlay.querySelector('[data-quick-chat-form]');
    this.quickChatInput = this.overlay.querySelector('[data-quick-chat-input]');
    this.quickChatHint = this.overlay.querySelector('[data-quick-chat-hint]');
    this.overheadHealthLayer = this.overlay.querySelector('[data-overhead-health-layer]');
    this.speechLayer = this.overlay.querySelector('[data-speech-layer]');
    this.emoteMenu = this.overlay.querySelector('[data-emote-menu]');
    this.emoteWheel = this.overlay.querySelector('[data-emote-wheel]');
    this.emoteSelection = this.overlay.querySelector('[data-emote-selection]');
    this.emoteHint = this.overlay.querySelector('[data-emote-hint]');
    this.mobileControls = this.overlay.querySelector('[data-mobile-controls]');
    this.mobileFireLabel = this.overlay.querySelector('[data-mobile-fire-label]');
    this.phoneLauncher = this.overlay.querySelector('[data-phone-launcher]');
    this.phoneStage = this.overlay.querySelector('[data-phone-stage]');
    this.phoneScreenContent = this.overlay.querySelector('[data-phone-screen-content]');
    this.phoneClose = this.overlay.querySelector('[data-phone-close]');
    this.vibeRadioWidget = this.overlay.querySelector('[data-vibe-radio-widget]');
    this.vibeRadioStatus = this.overlay.querySelector('[data-vibe-radio-status]');
    this.vibeRadioTitle = this.overlay.querySelector('[data-vibe-radio-title]');
    this.emoteSliceNodes = [];
    this.overheadHealthBarNodes = new Map();
    this.overheadHealthBarFillNodes = new Map();
    this.overheadHealthBarActiveIds = new Set();
    this.speechBubbleNodes = new Map();
    this.speechBubbleLabelNodes = new Map();
    this.speechBubbleTextNodes = new Map();
    this.speechBubbleActiveIds = new Set();
    this.npcSpeechPlayback = new NpcSpeechPlayback();
    this.aimDebugInputs = new Map();
    this.poseDebugExtraInputs = new Map();
    this.phoneGripDebugInputs = new Map();
    this.joinTitleTimeout = 0;
    this.loadingHideTimeout = 0;
    this.toastTimeout = 0;
    this.jobLockAlertTimeout = 0;
    this.phoneCloseTimeout = 0;
    this.taskCompleteTimeout = 0;
    this.taskConfettiFrame = 0;
    this.taskConfettiLastFrameAt = 0;
    this.taskConfettiParticles = [];
    this.taskTransitioning = false;
    this.pendingTaskState = null;
    this.healthTrailFrame = 0;
    this.healthTrailTimeout = 0;
    this.healthHitTimeout = 0;
    this.lastCombatHealthPercent = null;
    this.lastAmmoClipSize = 0;
    this.lastAmmoSignature = '';
    this.lastHotbarSignature = '';
    this.hotbarDragState = null;
    this.hotbarSuppressClickUntil = 0;
    this.lastInteractionState = null;
    this.stockMarketVisible = false;
    this.stockMarketState = {
      market: null,
      selectedSymbol: '',
      quantity: 1,
      loading: false,
      error: ''
    };
    this.blackjackVisible = false;
    this.blackjackState = {
      game: null,
      wager: BLACKJACK_DEFAULT_WAGER,
      loading: false,
      error: '',
      dealerName: 'Dealer'
    };
    this.blackjackCardVisualState = {
      sessionId: '',
      dealer: [],
      player: []
    };
    this.blackjackCardAnimationTimeout = 0;
    this.schoolMicrogameVisible = false;
    this.schoolMicrogameState = {
      game: null,
      loading: false,
      error: ''
    };
    this.vibeHeroVisible = false;
    this.vibeHeroState = {
      game: null
    };
    this.vibeRadioState = {
      tracks: [],
      selectedTrackId: '',
      playing: false,
      volume: 0.5,
      currentTime: 0,
      duration: 0,
      error: ''
    };
    this.lastPhoneVibeRadioTrackListSignature = '';
    this.basketballShotVisible = false;
    this.basketballShotState = {
      game: null
    };
    this.adminPromptState = {
      available: false,
      open: false,
      activeTab: 'new',
      tasks: [],
      selectedTaskId: '',
      loading: false,
      submitting: false,
      error: '',
      autoDeployAvailable: false,
      contextLabel: 'Game'
    };
    this.adminPromptLayout = null;
    this.adminPromptLayoutCustomized = false;
    this.adminPromptDragState = null;
    this.adminPromptResizeState = null;
    this.lastAdminPromptTabsSignature = '';
    this.lastAdminPromptTaskListSignature = '';
    this.lastAdminPromptDetailSignature = '';
    this.lastAdminPromptSelectedThreadId = '';
    this.adminPromptThreadLimit = ADMIN_PROMPT_THREAD_LIST_LIMIT;
    this.adminPromptDurationTimer = 0;
    this.adminPromptDurationTick = 0;
    this.schoolMicrogameBodyRenderKey = '';
    this.phoneVisible = false;
    this.phoneActiveAppId = '';
    this.phoneMapDragState = null;
    this.lastPhoneMissionsSignature = '';
    this.lastPhoneSkillsSignature = '';
    this.lastPhoneWalletSignature = '';
    this.lastPhoneStocksSignature = '';
    this.lastPhoneMapSignature = '';
    this.skillLevelUpTimeout = 0;
    this.lastNpcEditorState = null;
    this.lastBuildingEditorState = null;
    this.lastCharacterSelectorSignature = '';
    this.lastCarSelectorSignature = '';
    this.lastAdminPositionSignature = '';
    this.builderAvailable = false;
    this.builderEnabled = false;
    this.builderPanelWidth = BUILDER_PANEL_DEFAULT_WIDTH;
    this.builderMissionDragIndex = null;
    this.activeBuilderResizePointerId = null;
    this.builderResizeRightEdge = 0;
    this.builderNpcEditorVisible = false;
    this.builderBuildingEditorVisible = false;
    this.onBuilderResizePointerMove = this.onBuilderResizePointerMove.bind(this);
    this.onBuilderResizePointerUp = this.onBuilderResizePointerUp.bind(this);
    this.onAdminPromptDragPointerMove = this.onAdminPromptDragPointerMove.bind(this);
    this.onAdminPromptDragPointerUp = this.onAdminPromptDragPointerUp.bind(this);
    this.onAdminPromptResizePointerMove = this.onAdminPromptResizePointerMove.bind(this);
    this.onAdminPromptResizePointerUp = this.onAdminPromptResizePointerUp.bind(this);
    this.onAdminPromptViewportResize = this.onAdminPromptViewportResize.bind(this);
    this.buildAimPoseDebugFields();
    this.buildEmoteWheel();
    this.initializeBuilderPanelResize();
    this.initializeAdminPromptInteraction();
    this.setMoneyState({ amount: 0 });
    this.setTaskState({ visible: false });
  }

  createLoading() {
    const node = document.createElement('div');
    node.className = 'loading';
    node.innerHTML = `
      <div class="loading__content">
        <h1 class="loading__title" aria-label="Vibe Theft Auto">
          <span
            class="loading__word"
            data-loading-word
            style="--join-order:0; --join-direction:-1; --join-tilt:-7deg;"
          >
            <span class="loading__word-base">Vibe</span>
            <span class="loading__word-fill" aria-hidden="true">
              <span class="loading__word-liquid">Vibe</span>
            </span>
          </span>
          <span
            class="loading__word"
            data-loading-word
            style="--join-order:1; --join-direction:1; --join-tilt:5deg;"
          >
            <span class="loading__word-base">Theft</span>
            <span class="loading__word-fill" aria-hidden="true">
              <span class="loading__word-liquid">Theft</span>
            </span>
          </span>
          <span
            class="loading__word"
            data-loading-word
            style="--join-order:2; --join-direction:-1; --join-tilt:-4deg;"
          >
            <span class="loading__word-base">Auto</span>
            <span class="loading__word-fill" aria-hidden="true">
              <span class="loading__word-liquid">Auto</span>
            </span>
          </span>
        </h1>
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

    const phoneGripMarkup = PHONE_GRIP_DEBUG_FIELDS.map((field) => `
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
        <button class="hud__builder-chip" type="button" data-aim-debug-section="phoneGrip">Phone Grip</button>
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
      <section class="hud__builder-section" data-aim-debug-section-panel="phoneGrip">
        <div class="hud__builder-section-header">
          <p class="hud__builder-section-title">Phone Grip</p>
        </div>
        <div class="hud__aim-debug-group">${phoneGripMarkup}</div>
      </section>
    `;

    this.aimDebugInputs.clear();
    this.poseDebugExtraInputs.clear();
    this.phoneGripDebugInputs.clear();
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
    for (const field of PHONE_GRIP_DEBUG_FIELDS) {
      this.phoneGripDebugInputs.set(field.key, {
        range: this.aimDebugFields.querySelector(`[data-aim-debug-input="${field.key}"][data-aim-debug-kind="range"]`),
        number: this.aimDebugFields.querySelector(`[data-aim-debug-input="${field.key}"][data-aim-debug-kind="number"]`)
      });
    }
  }

  createOverlay() {
    const node = document.createElement('div');
    node.className = 'hud';
    node.innerHTML = `
      <section class="hud__combat" data-combat-root role="progressbar" aria-label="Health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
        <div class="hud__combat-meter" data-combat-meter aria-hidden="true">
          <div class="hud__combat-meter-trail" data-combat-health-trail></div>
          <div class="hud__combat-meter-fill" data-combat-health-fill></div>
          <div class="hud__combat-meter-burst" data-combat-health-burst></div>
        </div>
      </section>
      <section class="hud__ammo" data-ammo-root role="group" aria-label="Pistol ammo" hidden>
        <div class="hud__ammo-wheel">
          <div class="hud__ammo-bullets" data-ammo-bullets aria-hidden="true"></div>
          <div class="hud__ammo-core">
            <span class="hud__ammo-reserve-value" data-ammo-reserve-value>0</span>
            <span class="hud__ammo-reserve-label" data-ammo-reserve-label>Reserve</span>
          </div>
        </div>
      </section>
      <nav class="hud__hotbar" data-hotbar-root aria-label="Hotbar" hidden>
        <div class="hud__hotbar-slots" data-hotbar-slots></div>
      </nav>
      <section class="hud__bound-items" data-bound-items aria-label="Permanent items" hidden>
        <button
          class="hud__bound-item hud__bound-item--vehicle"
          type="button"
          data-bound-item-vehicle
          aria-haspopup="dialog"
          aria-expanded="false"
          title="Choose vehicle"
        >
          <span data-bound-item-skateboard-icon>${getSkateboardBadgeMarkup()}</span>
          <span data-bound-item-car-icon hidden>${getVehicleBadgeMarkup()}</span>
        </button>
      </section>
      <section class="hud__drunkness" data-drunkness-root role="meter" aria-label="Drunkness" aria-valuemin="0" aria-valuemax="${DRUNKNESS_MAX_LEVEL}" aria-valuenow="0" hidden>
        <div class="hud__drunkness-cylinder" aria-hidden="true">
          <div class="hud__drunkness-track">
            <div class="hud__drunkness-fill" data-drunkness-fill></div>
          </div>
          <div class="hud__drunkness-ticks">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        <div class="hud__drunkness-labels" data-drunkness-labels aria-hidden="true">
          ${getHudDrunknessLabelMarkup()}
        </div>
      </section>
      <section class="hud__money" data-money aria-label="Money" aria-live="polite">
        <span class="hud__money-value" data-money-value>$0</span>
        <span class="hud__money-net-worth is-flat" data-money-net-worth>($0)</span>
      </section>
      <section class="hud__task" data-task aria-live="polite" hidden>
        <div class="hud__task-viewport">
          <p class="hud__task-title" data-task-title></p>
        </div>
      </section>
      <canvas class="hud__task-confetti-canvas" data-task-confetti aria-hidden="true"></canvas>
      <section class="hud__skill-level-up" data-skill-level-up aria-live="polite" hidden>
        <div class="hud__skill-level-up-burst" aria-hidden="true"></div>
        <div class="hud__skill-level-up-icon" data-skill-level-up-icon aria-hidden="true">&#127947;</div>
        <div class="hud__skill-level-up-copy">
          <strong data-skill-level-up-title>Level Up</strong>
          <span data-skill-level-up-subtitle>Skill Level 2</span>
        </div>
      </section>
      <button
        class="hud__phone-launcher"
        type="button"
        data-phone-launcher
        aria-label="Open phone menu"
        aria-pressed="false"
        title="Open phone"
      >
        <span class="hud__phone-launcher-frame" aria-hidden="true">
          <span class="hud__phone-launcher-speaker"></span>
          <span class="hud__phone-launcher-screen"></span>
        </span>
      </button>
      <section class="hud__vibe-radio-widget" data-vibe-radio-widget aria-label="Vibe Radio mini player">
        <div class="hud__vibe-radio-widget-copy">
          <span data-vibe-radio-status>Vibe Radio</span>
          <strong data-vibe-radio-title>No track selected</strong>
        </div>
        ${getVibeRadioControlsMarkup({ disabled: true })}
      </section>
      <section class="hud__phone-stage" data-phone-stage role="dialog" aria-modal="true" aria-label="Phone menu" hidden>
        <button class="hud__phone-backdrop" type="button" data-phone-backdrop aria-label="Close phone"></button>
        <div class="hud__phone-device">
          <div class="hud__phone-frame">
            <div class="hud__phone-island" aria-hidden="true"></div>
            <div class="hud__phone-screen">
              <button class="hud__phone-close" type="button" data-phone-close aria-label="Close phone" title="Close phone">
                <span aria-hidden="true">&times;</span>
              </button>
              <div class="hud__phone-screen-content" data-phone-screen-content>
                ${getPhoneScreenMarkup()}
              </div>
              <button class="hud__phone-home-indicator" type="button" data-phone-home aria-label="Back to phone home"></button>
            </div>
          </div>
        </div>
        <div class="hud__phone-map-tooltip" data-phone-map-tooltip-popover hidden></div>
      </section>
      <div class="hud__top-actions">
        <section class="hud__connection is-connecting" data-connection-status aria-live="polite" title="Connecting to multiplayer">
          <span class="hud__connection-dot" aria-hidden="true"></span>
          <span class="hud__connection-label" data-connection-status-label>Connecting</span>
          <span class="hud__connection-players" data-connection-players hidden aria-label="Active players">
            <span class="hud__connection-player-icon" aria-hidden="true"></span>
            <span data-connection-player-count>0</span>
          </span>
        </section>
        <section class="hud__toast">
          <p class="hud__toast-text" data-toast></p>
        </section>
        <section class="hud__job-lock-alert" data-office-prereq-alert aria-live="assertive" aria-hidden="true">
          <h2 data-office-prereq-text></h2>
        </section>
        <div class="hud__top-actions-stack">
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
              hidden
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
                <path d="M18.5 13.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" />
                <path d="M5.5 14.5l1.1 2.4 2.4 1.1-2.4 1.1L5.5 21l-1.1-2.4L2 17.5l2.4-1.1 1.1-2.4z" />
              </svg>
            </button>
            <button
              class="hud__admin-prompt-toggle"
              type="button"
              data-admin-prompt-toggle
              aria-label="Open Prompt console"
              aria-pressed="false"
              title="Open Prompt console"
              hidden
            >
              <span class="hud__admin-prompt-code" aria-hidden="true">&lt;/&gt;</span>
              <span>Prompt</span>
            </button>
            <button
              class="hud__map-capture-toggle"
              type="button"
              data-map-capture-toggle
              aria-label="Capture phone map image"
              title="Capture phone map image"
              hidden
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6.8l4.5-1.8 6 1.8 5.5-1.8v12.2l-5.5 1.8-6-1.8L4 19V6.8z" />
                <path d="M8.5 5v12.2" />
                <path d="M14.5 6.8V19" />
                <path d="M10.5 11.5h3" />
                <path d="M12 10v3" />
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
          <div class="hud__top-right-stack">
            <section class="hud__admin-position" data-admin-position hidden>
              <p class="hud__eyebrow">Admin Position</p>
              <p class="hud__admin-position-value" data-admin-position-value>X 0.00 Z 0.00</p>
              <p class="hud__body hud__admin-position-hint" data-admin-position-hint>World coordinates for collider debugging.</p>
            </section>
            <section class="hud__admin-prompt" data-admin-prompt hidden>
              <header class="hud__admin-prompt-header" data-admin-prompt-drag-handle title="Drag Prompt panel">
                <div>
                  <p class="hud__eyebrow">Admin</p>
                  <h2 class="hud__dialog-title">Prompt</h2>
                  <p class="hud__body hud__admin-prompt-status" data-admin-prompt-status>Codex worker ready</p>
                </div>
                <div class="hud__admin-prompt-header-actions">
                  <button class="hud__builder-icon-button" type="button" data-admin-prompt-refresh data-admin-prompt-action="refresh" aria-label="Refresh Prompt tasks" title="Refresh Prompt tasks">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19 6v5h-5" />
                      <path d="M5 18v-5h5" />
                      <path d="M17.9 10.8A6.5 6.5 0 0 0 6.7 7.7L5 9.2" />
                      <path d="M6.1 13.2a6.5 6.5 0 0 0 11.2 3.1L19 14.8" />
                    </svg>
                  </button>
                  <button class="hud__builder-icon-button" type="button" data-admin-prompt-close data-admin-prompt-action="close" aria-label="Close Prompt console" title="Close Prompt console">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 6l12 12" />
                      <path d="M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </header>
              <div class="hud__admin-prompt-tabs" data-admin-prompt-tabs></div>
              <div class="hud__admin-prompt-context" data-admin-prompt-context>Context: Game</div>
              <div class="hud__admin-prompt-body">
                <div class="hud__admin-prompt-task-browser" data-admin-prompt-task-browser>
                  <div class="hud__admin-prompt-tasks" data-admin-prompt-tasks></div>
                  <div class="hud__admin-prompt-detail-slot">
                    <form class="hud__admin-prompt-new" data-admin-prompt-new data-admin-prompt-form>
                      <textarea class="hud__admin-prompt-prompt" data-admin-prompt-prompt maxlength="6000" rows="5" placeholder="Describe what should change in the game..."></textarea>
                      <div class="hud__admin-prompt-form-row">
                        <select class="hud__admin-prompt-mode" data-admin-prompt-mode aria-label="Prompt task mode">
                          <option value="preview">Preview</option>
                          <option value="auto" data-admin-prompt-mode-auto>Auto deploy</option>
                        </select>
                        <button class="hud__admin-prompt-submit" type="submit" data-admin-prompt-submit>Submit</button>
                      </div>
                    </form>
                    <div data-admin-prompt-detail hidden></div>
                  </div>
                </div>
              </div>
              <div class="hud__admin-prompt-resize-handle hud__admin-prompt-resize-handle--n" data-admin-prompt-resize-handle="n" aria-hidden="true"></div>
              <div class="hud__admin-prompt-resize-handle hud__admin-prompt-resize-handle--e" data-admin-prompt-resize-handle="e" aria-hidden="true"></div>
              <div class="hud__admin-prompt-resize-handle hud__admin-prompt-resize-handle--s" data-admin-prompt-resize-handle="s" aria-hidden="true"></div>
              <div class="hud__admin-prompt-resize-handle hud__admin-prompt-resize-handle--w" data-admin-prompt-resize-handle="w" aria-hidden="true"></div>
              <div class="hud__admin-prompt-resize-handle hud__admin-prompt-resize-handle--ne" data-admin-prompt-resize-handle="ne" aria-hidden="true"></div>
              <div class="hud__admin-prompt-resize-handle hud__admin-prompt-resize-handle--nw" data-admin-prompt-resize-handle="nw" aria-hidden="true"></div>
              <div class="hud__admin-prompt-resize-handle hud__admin-prompt-resize-handle--se" data-admin-prompt-resize-handle="se" aria-hidden="true"></div>
              <div class="hud__admin-prompt-resize-handle hud__admin-prompt-resize-handle--sw" data-admin-prompt-resize-handle="sw" aria-hidden="true"></div>
            </section>
            <section class="hud__panel">
              <div class="hud__controls-list">
                ${getHudControlsMarkup()}
              </div>
            </section>
          </div>
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
      <section class="hud__character-selector hud__car-selector" data-car-selector hidden>
        <div class="hud__character-selector-header">
          <div>
            <p class="hud__eyebrow">Vehicle Select</p>
            <h2 class="hud__character-selector-name" data-car-selector-name>Vehicle</h2>
            <p class="hud__body hud__character-selector-subtitle" data-car-selector-subtitle>Garage</p>
          </div>
          <button class="hud__builder-icon-button" type="button" data-car-selector-close aria-label="Close vehicle selector" title="Close vehicle selector">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="hud__character-stage-shell hud__car-stage-shell">
          <button class="hud__character-nav" type="button" data-car-selector-prev aria-label="Previous vehicle" title="Previous vehicle">
            <span aria-hidden="true">&#8249;</span>
          </button>
          <div class="hud__character-stage hud__car-stage">
            <div class="hud__character-stage-glow"></div>
            <div class="hud__car-stage-preview" data-car-selector-preview></div>
          </div>
          <button class="hud__character-nav" type="button" data-car-selector-next aria-label="Next vehicle" title="Next vehicle">
            <span aria-hidden="true">&#8250;</span>
          </button>
        </div>
        <div class="hud__character-selection-status" data-car-selector-status>Currently selected</div>
        <div class="hud__character-grid hud__car-grid" data-car-selector-grid></div>
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
        <div class="hud__builder-prop-size" data-builder-prop-size-panel hidden>
          <div class="hud__builder-prop-size-header">
            <span class="hud__field-label">Size</span>
            <strong data-builder-prop-size-value>1.00x</strong>
          </div>
          <input class="hud__builder-range" type="range" min="0.25" max="3" step="0.05" value="1" data-builder-prop-size />
          <span class="hud__builder-prop-size-target" data-builder-prop-size-target></span>
        </div>
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
        <div class="hud__builder-action-row hud__builder-action-row--compact">
          <button class="hud__builder-action" type="button" data-builder-npc-rotate>Rotate</button>
          <button class="hud__builder-action" type="button" data-builder-npc-move>Move</button>
          <button class="hud__builder-action hud__builder-action--danger" type="button" data-builder-npc-delete>Remove</button>
          <button class="hud__builder-action" type="button" data-builder-npc-done>Accept</button>
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
              <div class="hud__npc-model-grid" data-builder-npc-model-options></div>
              <div class="hud__builder-section-header">
                <p class="hud__builder-section-title">Model Voice</p>
              </div>
              <div class="hud__builder-instance-metrics">
                <label class="hud__field">
                  <span class="hud__field-label">Pitch</span>
                  <input class="hud__field-control" type="number" min="120" max="620" step="1" data-builder-npc-voice-pitch />
                </label>
                <label class="hud__field">
                  <span class="hud__field-label">Speed</span>
                  <input class="hud__field-control" type="number" min="12" max="52" step="1" data-builder-npc-voice-speed />
                </label>
              </div>
              <div class="hud__builder-instance-metrics">
                <label class="hud__field">
                  <span class="hud__field-label">Range</span>
                  <input class="hud__field-control" type="number" min="0" max="45" step="1" data-builder-npc-voice-range />
                </label>
                <label class="hud__field">
                  <span class="hud__field-label">Tone</span>
                  <select class="hud__field-control" data-builder-npc-voice-tone>
                    <option value="triangle">Soft</option>
                    <option value="square">Bright</option>
                    <option value="sawtooth">Raspy</option>
                    <option value="sine">Round</option>
                  </select>
                </label>
              </div>
              <div class="hud__builder-instance-metrics">
                <label class="hud__field">
                  <span class="hud__field-label">Volume</span>
                  <input class="hud__field-control" type="number" min="0" max="100" step="1" data-builder-npc-voice-volume />
                </label>
              </div>
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
                  <span class="hud__field-label">Speed</span>
                  <select class="hud__field-control" data-builder-npc-speed>
                    <option value="slow">Slow</option>
                    <option value="fast">Fast</option>
                  </select>
                </label>
              </div>
              <div class="hud__builder-instance-metrics">
                <label class="hud__field">
                  <span class="hud__field-label">Respawn Timer (ms)</span>
                  <input class="hud__field-control" type="number" min="0" max="600000" step="100" data-builder-npc-respawn-delay />
                </label>
              </div>
              <label class="hud__field hud__checkbox-field">
                <input class="hud__checkbox-control" type="checkbox" data-builder-npc-delivery-quest />
                <span class="hud__checkbox-copy">
                  <span class="hud__field-label hud__checkbox-title">Gives Delivery Quests</span>
                </span>
              </label>
              <label class="hud__field hud__checkbox-field">
                <input class="hud__checkbox-control" type="checkbox" data-builder-npc-gym-check-in />
                <span class="hud__checkbox-copy">
                  <span class="hud__field-label hud__checkbox-title">Gym Check-In</span>
                </span>
              </label>
              <label class="hud__field hud__checkbox-field">
                <input class="hud__checkbox-control" type="checkbox" data-builder-npc-rent-collector />
                <span class="hud__checkbox-copy">
                  <span class="hud__field-label hud__checkbox-title">Rent Collector / Initial Spawn</span>
                </span>
              </label>
              <label class="hud__field hud__checkbox-field">
                <input class="hud__checkbox-control" type="checkbox" data-builder-npc-stock-market />
                <span class="hud__checkbox-copy">
                  <span class="hud__field-label hud__checkbox-title">Stock Broker / Market</span>
                </span>
              </label>
              <label class="hud__field hud__checkbox-field">
                <input class="hud__checkbox-control" type="checkbox" data-builder-npc-bartender />
                <span class="hud__checkbox-copy">
                  <span class="hud__field-label hud__checkbox-title">Bartender / Drinks</span>
                </span>
              </label>
              <label class="hud__field hud__checkbox-field">
                <input class="hud__checkbox-control" type="checkbox" data-builder-npc-pawn-shop-owner />
                <span class="hud__checkbox-copy">
                  <span class="hud__field-label hud__checkbox-title">Pawn Shop Owner</span>
                </span>
              </label>
              <label class="hud__field hud__checkbox-field">
                <input class="hud__checkbox-control" type="checkbox" data-builder-npc-car-dealer />
                <span class="hud__checkbox-copy">
                  <span class="hud__field-label hud__checkbox-title">Car Dealer</span>
                </span>
              </label>
              <label class="hud__field hud__checkbox-field">
                <input class="hud__checkbox-control" type="checkbox" data-builder-npc-martha />
                <span class="hud__checkbox-copy">
                  <span class="hud__field-label hud__checkbox-title">Martha / Grille Food</span>
                </span>
              </label>
              <label class="hud__field hud__checkbox-field">
                <input class="hud__checkbox-control" type="checkbox" data-builder-npc-blackjack-dealer />
                <span class="hud__checkbox-copy">
                  <span class="hud__field-label hud__checkbox-title">Blackjack Dealer</span>
                </span>
              </label>
              <label class="hud__field hud__checkbox-field">
                <input class="hud__checkbox-control" type="checkbox" data-builder-npc-school-microgame />
                <span class="hud__checkbox-copy">
                  <span class="hud__field-label hud__checkbox-title">School Microgames</span>
                </span>
              </label>
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
            <button class="hud__builder-action hud__builder-confirm" type="button" data-builder-npc-confirm>Close</button>
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
      <section class="hud__stock-market" data-stock-market hidden>
        <header class="hud__stock-header">
          <div>
            <p class="hud__eyebrow">Street Exchange</p>
            <h2 class="hud__stock-title">Stock Market</h2>
            <p class="hud__body hud__stock-status" data-stock-market-status>Loading tape...</p>
          </div>
          <div class="hud__stock-header-actions">
            <button class="hud__builder-icon-button" type="button" data-stock-market-refresh aria-label="Refresh market" title="Refresh market">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 12a8 8 0 1 1-2.34-5.66" />
                <path d="M20 4v6h-6" />
              </svg>
            </button>
            <button class="hud__builder-icon-button" type="button" data-stock-market-close aria-label="Close stock market" title="Close stock market">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            </button>
          </div>
        </header>
        <div class="hud__stock-summary">
          <div class="hud__stock-summary-item">
            <span>Cash</span>
            <strong data-stock-market-cash>$0</strong>
          </div>
          <div class="hud__stock-summary-item">
            <span>Holdings</span>
            <strong data-stock-market-portfolio>$0</strong>
          </div>
          <div class="hud__stock-summary-item">
            <span>Net Worth</span>
            <strong data-stock-market-net-worth>$0</strong>
          </div>
        </div>
        <section class="hud__stock-overview hud__stock-market-overview" data-stock-market-overview>
          <div class="hud__stock-overview-header">
            <span>All Stocks</span>
            <strong>Loading</strong>
          </div>
          <div class="hud__stock-overview-empty">Loading market tape...</div>
        </section>
        <div class="hud__stock-body">
          <div class="hud__stock-list" data-stock-market-list></div>
          <div class="hud__stock-detail" data-stock-market-detail></div>
        </div>
        <footer class="hud__stock-trade">
          <label class="hud__stock-quantity-field">
            <span class="hud__field-label">Shares</span>
            <input class="hud__field-control" type="number" min="1" step="1" value="1" data-stock-market-quantity />
          </label>
          <button class="hud__stock-trade-button is-buy" type="button" data-stock-market-buy>Buy</button>
          <button class="hud__stock-trade-button is-sell" type="button" data-stock-market-sell>Sell</button>
        </footer>
      </section>
      <section class="hud__blackjack" data-blackjack hidden>
        <header class="hud__blackjack-header">
          <div>
            <p class="hud__eyebrow">Table Game</p>
            <h2 class="hud__blackjack-title">Blackjack</h2>
            <p class="hud__body hud__blackjack-status" data-blackjack-status>Waiting for a seat...</p>
          </div>
          <button class="hud__builder-icon-button" type="button" data-blackjack-close aria-label="Close blackjack" title="Close blackjack">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div class="hud__blackjack-table">
          <div class="hud__blackjack-rail" aria-hidden="true"></div>
          <section class="hud__blackjack-hand hud__blackjack-hand--dealer">
            <div class="hud__blackjack-hand-head">
              <span data-blackjack-dealer-name>Dealer</span>
              <strong data-blackjack-dealer-value>0</strong>
            </div>
            <div class="hud__blackjack-cards" data-blackjack-dealer-hand></div>
          </section>
          <div class="hud__blackjack-center">
            <p class="hud__blackjack-message" data-blackjack-message>Place a wager and deal.</p>
            <div class="hud__blackjack-result" data-blackjack-result></div>
          </div>
          <section class="hud__blackjack-hand hud__blackjack-hand--player">
            <div class="hud__blackjack-hand-head">
              <span>Your Hand</span>
              <strong data-blackjack-player-value>0</strong>
            </div>
            <div class="hud__blackjack-cards" data-blackjack-player-hand></div>
          </section>
        </div>
        <footer class="hud__blackjack-controls">
          <div class="hud__blackjack-bankroll">
            <span>Cash</span>
            <strong data-blackjack-cash>$0</strong>
          </div>
          <label class="hud__blackjack-wager">
            <span class="hud__field-label">Wager</span>
            <input class="hud__field-control" type="number" min="0" max="${BLACKJACK_MAX_WAGER}" step="5" value="${BLACKJACK_DEFAULT_WAGER}" data-blackjack-wager />
          </label>
          <div class="hud__blackjack-chips" data-blackjack-wager-chips aria-hidden="true"></div>
          <div class="hud__blackjack-actions">
            <button class="hud__blackjack-action is-deal" type="button" data-blackjack-deal>Deal</button>
            <button class="hud__blackjack-action" type="button" data-blackjack-hit>Hit</button>
            <button class="hud__blackjack-action" type="button" data-blackjack-stand>Stand</button>
            <button class="hud__blackjack-action" type="button" data-blackjack-double>Double</button>
            <button class="hud__blackjack-action" type="button" data-blackjack-split>Split</button>
          </div>
        </footer>
      </section>
      <section class="hud__school-microgame" data-school-microgame hidden>
        <header class="hud__school-header">
          <div>
            <p class="hud__eyebrow" data-school-microgame-eyebrow>School</p>
            <h2 class="hud__school-title" data-school-microgame-title>School Microgame</h2>
            <p class="hud__body hud__school-status" data-school-microgame-status>Ready</p>
          </div>
          <button class="hud__builder-icon-button" type="button" data-school-microgame-close aria-label="Close school microgame" title="Close school microgame">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div class="hud__school-timer-slot" data-school-microgame-timer></div>
        <div class="hud__school-body" data-school-microgame-body></div>
        <footer class="hud__school-footer">
          <p data-school-microgame-message>Start when ready.</p>
        </footer>
      </section>
      <section class="hud__vibe-hero" data-vibe-hero hidden>
        <header class="hud__vibe-hero-header">
          <div>
            <p class="hud__eyebrow">Music Game</p>
            <h2 class="hud__vibe-hero-title">Vibe Hero</h2>
            <p class="hud__body hud__vibe-hero-status" data-vibe-hero-status>Song Select</p>
          </div>
          <button class="hud__builder-icon-button" type="button" data-vibe-hero-close aria-label="Close Vibe Hero" title="Close Vibe Hero">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div class="hud__vibe-hero-timer-slot" data-vibe-hero-timer></div>
        <div class="hud__vibe-hero-body" data-vibe-hero-body></div>
        <footer class="hud__vibe-hero-footer">
          <p data-vibe-hero-message>Pick a song and take the stage.</p>
        </footer>
      </section>
      <section class="hud__basketball-shot" data-basketball-shot hidden>
        <header class="hud__basketball-shot-header">
          <div>
            <p class="hud__eyebrow">Basketball</p>
            <h2 class="hud__basketball-shot-title">The Basketball Shot</h2>
            <p class="hud__body hud__basketball-shot-status" data-basketball-shot-status>Ready</p>
          </div>
        </header>
        <div class="hud__basketball-shot-body" data-basketball-shot-body></div>
        <footer class="hud__basketball-shot-footer">
          <p data-basketball-shot-message>Line up the meter.</p>
        </footer>
      </section>
      <form class="hud__quick-chat" data-quick-chat data-quick-chat-form>
        <span class="hud__key">Enter</span>
        <input class="hud__field-control hud__quick-chat-input" type="text" maxlength="280" data-quick-chat-input placeholder="Say something..." />
        <p class="hud__quick-chat-hint" data-quick-chat-hint>Enter to send. Escape to cancel.</p>
      </form>
      <section class="hud__overhead-health-layer" data-overhead-health-layer></section>
      <section class="hud__speech-layer" data-speech-layer></section>
      <section class="hud__rent-cutscene" data-rent-intro-cutscene aria-hidden="true" hidden>
        <div class="hud__rent-cutscene-vignette" aria-hidden="true"></div>
        <div class="hud__rent-cutscene-lid hud__rent-cutscene-lid--top" aria-hidden="true"></div>
        <div class="hud__rent-cutscene-lid hud__rent-cutscene-lid--bottom" aria-hidden="true"></div>
      </section>
      <section class="hud__respawn" data-respawn aria-live="polite">
        <p class="hud__respawn-line" data-respawn-line></p>
        <p class="hud__respawn-detail" data-respawn-detail></p>
      </section>
      <div class="hud__hitmarker" data-hitmarker></div>
      <section class="hud__emote-menu" data-emote-menu>
        <div class="hud__emote-wheel" data-emote-wheel>
          <div class="hud__emote-selection" data-emote-selection></div>
        </div>
        <p class="hud__emote-hint" data-emote-hint>Hold B, push the cursor into a slice, release B to emote.</p>
      </section>
      <section class="hud__mobile-controls is-hidden" data-mobile-controls aria-hidden="true">
        <div class="hud__mobile-stick hud__mobile-stick--move" data-mobile-joystick role="button" aria-label="Move">
          <span class="hud__mobile-stick-ring" aria-hidden="true"></span>
          <span class="hud__mobile-stick-knob" data-mobile-joystick-knob aria-hidden="true"></span>
        </div>
        <div class="hud__mobile-right-cluster">
          <div class="hud__mobile-stick hud__mobile-stick--aim" data-mobile-aim role="button" aria-label="Aim">
            <span class="hud__mobile-stick-ring" aria-hidden="true"></span>
            <span class="hud__mobile-stick-knob" data-mobile-aim-knob aria-hidden="true"></span>
          </div>
          <div class="hud__mobile-actions" role="group" aria-label="Actions">
            <button class="hud__mobile-action hud__mobile-action--fire" type="button" data-mobile-action="fire" aria-label="Attack">
              <span data-mobile-fire-label>Hit</span>
            </button>
            <button class="hud__mobile-action" type="button" data-mobile-action="interact">Use</button>
            <button class="hud__mobile-action" type="button" data-mobile-action="reload">Reload</button>
            <button class="hud__mobile-action" type="button" data-mobile-action="chat">Chat</button>
            <button class="hud__mobile-action" type="button" data-mobile-action="emote">Emote</button>
          </div>
        </div>
      </section>
      <section class="hud__orientation-lock" aria-hidden="true">
        <div class="hud__orientation-device" aria-hidden="true">
          <span class="hud__orientation-screen"></span>
        </div>
        <p class="hud__orientation-title">Rotate to landscape</p>
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
    window.clearTimeout(this.loadingHideTimeout);
    window.clearTimeout(this.loadingProgressDelayTimeout);
    if (this.loadingProgressFrame) {
      window.cancelAnimationFrame(this.loadingProgressFrame);
      this.loadingProgressFrame = 0;
    }
    this.loadingTargetProgress = 1;
    this.loadingRequestedProgress = 1;
    this.loadingDisplayedProgress = 1;
    this.loadingProgressLastFrameAt = 0;
    this.loading.classList.add('is-dismissing');
    this.loading.style.pointerEvents = 'none';
    this.loading.style.setProperty('--loading-progress', '1');
    this.loadingHideTimeout = window.setTimeout(() => {
      this.loading.classList.add('is-hidden');
      this.loadingHideTimeout = window.setTimeout(() => {
        this.loading.hidden = true;
      }, 360);
    }, 420);
  }

  setLoadingProgress(progress = 0) {
    if (!this.loading) {
      return;
    }

    this.loading.hidden = false;
    this.loading.classList.remove('is-dismissing', 'is-hidden');
    this.loading.style.pointerEvents = '';
    const requestedProgress = Math.max(0, Math.min(1, Number(progress) || 0));
    this.loadingRequestedProgress = requestedProgress;
    const now = performance.now();
    if (
      requestedProgress > 0
      && this.loadingDisplayedProgress <= 0
      && now < this.loadingProgressUnlockAt
    ) {
      window.clearTimeout(this.loadingProgressDelayTimeout);
      this.loadingProgressDelayTimeout = window.setTimeout(() => {
        this.loadingProgressDelayTimeout = 0;
        this.loadingProgressLastFrameAt = performance.now();
        this.setLoadingProgress(requestedProgress);
      }, Math.max(0, this.loadingProgressUnlockAt - now));
      return;
    }

    const elapsedSinceUnlock = Math.max(0, now - this.loadingProgressUnlockAt);
    const timedMinimumProgress = elapsedSinceUnlock <= 0
      ? 0
      : Math.min(1, 1 - Math.pow(1 - Math.min(1, elapsedSinceUnlock / 950), 1.75));
    this.loadingTargetProgress = Math.max(this.loadingRequestedProgress, timedMinimumProgress);

    if (!this.loadingProgressFrame) {
      this.loadingProgressLastFrameAt = now;
      const animateProgress = (now) => {
        const elapsedSeconds = Math.min(
          0.05,
          Math.max(0.001, (now - this.loadingProgressLastFrameAt) / 1000)
        );
        this.loadingProgressLastFrameAt = now;
        const elapsedSinceUnlock = Math.max(0, now - this.loadingProgressUnlockAt);
        const timedMinimumProgress = elapsedSinceUnlock <= 0
          ? 0
          : Math.min(1, 1 - Math.pow(1 - Math.min(1, elapsedSinceUnlock / 950), 1.75));
        this.loadingTargetProgress = Math.max(this.loadingRequestedProgress, timedMinimumProgress);
        const gap = this.loadingTargetProgress - this.loadingDisplayedProgress;
        if (Math.abs(gap) <= 0.0025) {
          this.loadingDisplayedProgress = this.loadingTargetProgress;
          this.loading.style.setProperty('--loading-progress', this.loadingDisplayedProgress.toFixed(4));
          if (
            this.loadingTargetProgress < 0.999
            && !this.loading.classList.contains('is-hidden')
          ) {
            this.loadingProgressFrame = window.requestAnimationFrame(animateProgress);
          } else {
            this.loadingProgressFrame = 0;
            this.loadingProgressLastFrameAt = 0;
          }
          return;
        }

        const smoothing = 1 - Math.exp(-elapsedSeconds / 0.52);
        this.loadingDisplayedProgress += gap * smoothing;
        this.loading.style.setProperty('--loading-progress', this.loadingDisplayedProgress.toFixed(4));
        this.loadingProgressFrame = window.requestAnimationFrame(animateProgress);
      };

      this.loadingProgressFrame = window.requestAnimationFrame(animateProgress);
    }
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

  getAdminPromptViewportBounds() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const margin = Math.min(ADMIN_PROMPT_VIEWPORT_MARGIN, Math.floor(Math.min(width, height) * 0.08));
    return {
      width,
      height,
      margin,
      maxWidth: Math.max(1, width - (margin * 2)),
      maxHeight: Math.max(1, height - (margin * 2))
    };
  }

  clampAdminPromptSize(width, height) {
    const bounds = this.getAdminPromptViewportBounds();
    const minWidth = Math.min(ADMIN_PROMPT_MIN_WIDTH, bounds.maxWidth);
    const minHeight = Math.min(ADMIN_PROMPT_MIN_HEIGHT, bounds.maxHeight);
    const maxWidth = Math.max(minWidth, Math.min(ADMIN_PROMPT_MAX_WIDTH, bounds.maxWidth));
    const maxHeight = Math.max(minHeight, Math.min(ADMIN_PROMPT_MAX_HEIGHT, bounds.maxHeight));
    return {
      width: Math.min(Math.max(Math.round(Number(width) || ADMIN_PROMPT_DEFAULT_WIDTH), minWidth), maxWidth),
      height: Math.min(Math.max(Math.round(Number(height) || ADMIN_PROMPT_DEFAULT_HEIGHT), minHeight), maxHeight)
    };
  }

  clampAdminPromptLayout(layout = {}) {
    const bounds = this.getAdminPromptViewportBounds();
    const size = this.clampAdminPromptSize(layout.width, layout.height);
    const maxX = Math.max(bounds.margin, bounds.width - size.width - bounds.margin);
    const maxY = Math.max(bounds.margin, bounds.height - size.height - bounds.margin);
    return {
      x: Math.min(Math.max(Math.round(Number(layout.x) || bounds.margin), bounds.margin), maxX),
      y: Math.min(Math.max(Math.round(Number(layout.y) || bounds.margin), bounds.margin), maxY),
      width: size.width,
      height: size.height
    };
  }

  getAdminPromptDefaultAnchor(bounds = this.getAdminPromptViewportBounds()) {
    const topActionsStack = this.overlay?.querySelector('.hud__top-actions-stack') ?? null;
    const topActionsButtons = this.overlay?.querySelector('.hud__top-actions-buttons') ?? null;
    const gap = Math.max(ADMIN_PROMPT_TOP_ACTIONS_GAP, bounds.margin);
    const clearanceRects = [
      this.connectionStatusRoot,
      topActionsButtons
    ].map((element) => element?.getBoundingClientRect?.() ?? null)
      .filter((rect) => rect && rect.width > 0 && rect.height > 0);
    const anchorRects = [
      topActionsStack,
      topActionsButtons
    ].map((element) => element?.getBoundingClientRect?.() ?? null)
      .filter((rect) => rect && rect.width > 0 && rect.height > 0);
    const clearedBottom = clearanceRects.reduce(
      (bottom, rect) => Math.max(bottom, rect.bottom),
      0
    );
    const rightEdge = anchorRects.reduce(
      (right, rect) => Math.max(right, rect.right),
      0
    );

    return {
      right: rightEdge > 0
        ? Math.min(bounds.width - bounds.margin, Math.ceil(rightEdge))
        : bounds.width - Math.max(14, bounds.margin),
      y: clearedBottom > 0
        ? Math.max(bounds.margin, Math.ceil(clearedBottom + gap))
        : bounds.margin
    };
  }

  getDefaultAdminPromptLayout() {
    const bounds = this.getAdminPromptViewportBounds();
    const anchor = this.getAdminPromptDefaultAnchor(bounds);
    const availableHeightBelowActions = Math.max(
      ADMIN_PROMPT_MIN_HEIGHT,
      bounds.height - anchor.y - bounds.margin
    );
    const size = this.clampAdminPromptSize(
      Math.min(ADMIN_PROMPT_DEFAULT_WIDTH, bounds.maxWidth),
      Math.min(ADMIN_PROMPT_DEFAULT_HEIGHT, bounds.maxHeight, availableHeightBelowActions)
    );
    return this.clampAdminPromptLayout({
      x: anchor.right - size.width,
      y: anchor.y,
      width: size.width,
      height: size.height
    });
  }

  applyAdminPromptLayout(layout = {}, { customized = this.adminPromptLayoutCustomized } = {}) {
    if (!this.adminPromptRoot) {
      return;
    }

    this.adminPromptLayout = this.clampAdminPromptLayout(layout);
    this.adminPromptLayoutCustomized = Boolean(customized);
    this.adminPromptRoot.style.setProperty('--admin-prompt-x', `${this.adminPromptLayout.x}px`);
    this.adminPromptRoot.style.setProperty('--admin-prompt-y', `${this.adminPromptLayout.y}px`);
    this.adminPromptRoot.style.setProperty('--admin-prompt-width', `${this.adminPromptLayout.width}px`);
    this.adminPromptRoot.style.setProperty('--admin-prompt-height', `${this.adminPromptLayout.height}px`);
  }

  ensureAdminPromptLayout() {
    if (!this.adminPromptRoot) {
      return;
    }

    if (!this.adminPromptLayout || !this.adminPromptLayoutCustomized) {
      this.applyAdminPromptLayout(this.getDefaultAdminPromptLayout(), { customized: false });
      return;
    }

    this.applyAdminPromptLayout(this.adminPromptLayout, { customized: true });
  }

  initializeAdminPromptInteraction() {
    this.adminPromptDragHandle?.addEventListener('pointerdown', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      if (
        event.button !== 0
        || target?.closest('button, input, textarea, select, a, [data-admin-prompt-resize-handle]')
      ) {
        return;
      }

      if (!this.adminPromptRoot || this.adminPromptRoot.hidden) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const rect = this.adminPromptRoot.getBoundingClientRect();
      this.adminPromptDragState = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: rect.left,
        startY: rect.top,
        width: rect.width,
        height: rect.height
      };
      this.adminPromptRoot.classList.add('is-dragging');
      this.adminPromptDragHandle.setPointerCapture?.(event.pointerId);
      document.body.classList.add('is-admin-prompt-dragging');
      window.addEventListener('pointermove', this.onAdminPromptDragPointerMove);
      window.addEventListener('pointerup', this.onAdminPromptDragPointerUp);
      window.addEventListener('pointercancel', this.onAdminPromptDragPointerUp);
    });

    for (const handle of this.adminPromptResizeHandles) {
      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || !this.adminPromptRoot || this.adminPromptRoot.hidden) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        const rect = this.adminPromptRoot.getBoundingClientRect();
        this.adminPromptResizeState = {
          pointerId: event.pointerId,
          direction: handle.getAttribute('data-admin-prompt-resize-handle') ?? '',
          startClientX: event.clientX,
          startClientY: event.clientY,
          startX: rect.left,
          startY: rect.top,
          startRight: rect.right,
          startBottom: rect.bottom,
          startWidth: rect.width,
          startHeight: rect.height
        };
        this.adminPromptRoot.classList.add('is-resizing');
        handle.setPointerCapture?.(event.pointerId);
        document.body.classList.add('is-admin-prompt-resizing');
        window.addEventListener('pointermove', this.onAdminPromptResizePointerMove);
        window.addEventListener('pointerup', this.onAdminPromptResizePointerUp);
        window.addEventListener('pointercancel', this.onAdminPromptResizePointerUp);
      });
    }

    window.addEventListener('resize', this.onAdminPromptViewportResize);
  }

  onAdminPromptDragPointerMove(event) {
    const state = this.adminPromptDragState;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }

    event.preventDefault();
    this.applyAdminPromptLayout({
      x: state.startX + (event.clientX - state.startClientX),
      y: state.startY + (event.clientY - state.startClientY),
      width: state.width,
      height: state.height
    }, { customized: true });
  }

  onAdminPromptDragPointerUp(event) {
    const state = this.adminPromptDragState;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }

    this.adminPromptDragState = null;
    this.adminPromptRoot?.classList.remove('is-dragging');
    document.body.classList.remove('is-admin-prompt-dragging');
    window.removeEventListener('pointermove', this.onAdminPromptDragPointerMove);
    window.removeEventListener('pointerup', this.onAdminPromptDragPointerUp);
    window.removeEventListener('pointercancel', this.onAdminPromptDragPointerUp);
  }

  onAdminPromptResizePointerMove(event) {
    const state = this.adminPromptResizeState;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }

    event.preventDefault();
    const direction = state.direction;
    const deltaX = event.clientX - state.startClientX;
    const deltaY = event.clientY - state.startClientY;
    const requestedWidth = direction.includes('w')
      ? state.startWidth - deltaX
      : direction.includes('e')
        ? state.startWidth + deltaX
        : state.startWidth;
    const requestedHeight = direction.includes('n')
      ? state.startHeight - deltaY
      : direction.includes('s')
        ? state.startHeight + deltaY
        : state.startHeight;
    const size = this.clampAdminPromptSize(requestedWidth, requestedHeight);
    const x = direction.includes('w') ? state.startRight - size.width : state.startX;
    const y = direction.includes('n') ? state.startBottom - size.height : state.startY;
    this.applyAdminPromptLayout({
      x,
      y,
      width: size.width,
      height: size.height
    }, { customized: true });
  }

  onAdminPromptResizePointerUp(event) {
    const state = this.adminPromptResizeState;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }

    this.adminPromptResizeState = null;
    this.adminPromptRoot?.classList.remove('is-resizing');
    document.body.classList.remove('is-admin-prompt-resizing');
    window.removeEventListener('pointermove', this.onAdminPromptResizePointerMove);
    window.removeEventListener('pointerup', this.onAdminPromptResizePointerUp);
    window.removeEventListener('pointercancel', this.onAdminPromptResizePointerUp);
  }

  onAdminPromptViewportResize() {
    if (!this.adminPromptRoot || this.adminPromptRoot.hidden) {
      return;
    }

    this.ensureAdminPromptLayout();
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

  getMobileControlsRoot() {
    return this.mobileControls;
  }

  isLoadingVisible() {
    return Boolean(this.loading && !this.loading.hidden && !this.loading.classList.contains('is-hidden'));
  }

  setMobileControlsState({ visible = true, armed = false, fireLabel = '' } = {}) {
    if (!this.mobileControls) {
      return;
    }

    const nextVisible = Boolean(visible);
    this.mobileControls.classList.toggle('is-hidden', !nextVisible);
    this.mobileControls.setAttribute('aria-hidden', nextVisible ? 'false' : 'true');
    if (this.mobileFireLabel) {
      this.mobileFireLabel.textContent = fireLabel || (armed ? 'Fire' : 'Hit');
    }
  }

  renderPhoneScreen() {
    if (!this.phoneScreenContent) {
      return;
    }

    this.hidePhoneMapTooltip();
    this.phoneMapDragState = null;
    this.lastPhoneMissionsSignature = '';
    this.lastPhoneSkillsSignature = '';
    this.lastPhoneWalletSignature = '';
    this.lastPhoneStocksSignature = '';
    this.lastPhoneMapSignature = '';
    this.lastPhoneVibeRadioTrackListSignature = '';
    this.phoneScreenContent.innerHTML = getPhoneScreenMarkup(this.phoneActiveAppId);
  }

  setPhoneState({ visible = this.phoneVisible, activeAppId = this.phoneActiveAppId } = {}) {
    if (!this.phoneStage) {
      return;
    }

    const nextVisible = Boolean(visible);
    const previousVisible = this.phoneVisible;
    const previousActiveAppId = this.phoneActiveAppId;
    this.phoneVisible = nextVisible;
    this.phoneActiveAppId = nextVisible && getPhoneAppById(activeAppId) ? activeAppId : '';
    if (previousVisible !== this.phoneVisible || previousActiveAppId !== this.phoneActiveAppId) {
      this.renderPhoneScreen();
    }

    window.clearTimeout(this.phoneCloseTimeout);
    this.phoneLauncher?.classList.toggle('is-active', nextVisible);
    this.phoneLauncher?.setAttribute('aria-pressed', nextVisible ? 'true' : 'false');
    this.phoneStage.classList.toggle('is-app-open', Boolean(this.phoneActiveAppId));
    if (this.phoneActiveAppId) {
      this.phoneStage.dataset.phoneActiveApp = this.phoneActiveAppId;
    } else {
      delete this.phoneStage.dataset.phoneActiveApp;
    }

    if (nextVisible) {
      this.phoneStage.hidden = false;
      this.phoneStage.classList.remove('is-closing');
      void this.phoneStage.offsetWidth;
      this.phoneStage.classList.add('is-visible');
      return;
    }

    this.phoneStage.classList.remove('is-visible');
    this.phoneStage.classList.add('is-closing');
    this.phoneCloseTimeout = window.setTimeout(() => {
      if (this.phoneVisible) {
        return;
      }

      this.phoneStage.hidden = true;
      this.phoneStage.classList.remove('is-closing', 'is-app-open');
    }, PHONE_CLOSE_ANIMATION_MS);
  }

  setPhoneActiveApp(appId = '') {
    if (!this.phoneVisible) {
      return;
    }

    this.setPhoneState({
      visible: true,
      activeAppId: getPhoneAppById(appId) ? appId : ''
    });
  }

  isPhoneOpen() {
    return Boolean(this.phoneVisible && this.phoneStage && !this.phoneStage.hidden);
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

  showOfficeJobLockAlert(message) {
    const text = String(message ?? '').trim();
    if (!text || !this.jobLockAlert || !this.jobLockAlertText) {
      return;
    }

    this.jobLockAlertText.textContent = text;
    this.jobLockAlert.classList.remove('is-visible');
    void this.jobLockAlert.offsetWidth;
    this.jobLockAlert.classList.add('is-visible');
    this.jobLockAlert.setAttribute('aria-hidden', 'false');

    window.clearTimeout(this.jobLockAlertTimeout);
    this.jobLockAlertTimeout = window.setTimeout(() => {
      this.jobLockAlert?.classList.remove('is-visible');
      this.jobLockAlert?.setAttribute('aria-hidden', 'true');
    }, 2500);
  }

  setConnectionStatus({
    status = 'online',
    label = '',
    detail = '',
    activePlayerCount = null
  } = {}) {
    if (!this.connectionStatusRoot || !this.connectionStatusLabel) {
      return;
    }

    const normalizedStatus = String(status || 'online').toLowerCase();
    const defaultLabels = {
      connecting: 'Connecting',
      online: 'Online',
      reconnecting: 'Reconnecting',
      rejoining: 'Rejoining',
      updating: 'Server updating',
      offline: 'Offline',
      local: 'Local',
      'update-ready': 'Update ready'
    };
    this.connectionStatusLabel.textContent = String(label || defaultLabels[normalizedStatus] || 'Online');
    const rawPlayerCount = Number(activePlayerCount);
    const shouldShowPlayerCount = ['online', 'update-ready'].includes(normalizedStatus)
      && Number.isFinite(rawPlayerCount)
      && rawPlayerCount >= 0;
    const playerCount = shouldShowPlayerCount ? Math.floor(rawPlayerCount) : 0;
    if (this.connectionPlayers) {
      this.connectionPlayers.hidden = !shouldShowPlayerCount;
      this.connectionPlayers.setAttribute(
        'aria-label',
        `${playerCount} active ${playerCount === 1 ? 'player' : 'players'}`
      );
    }
    if (this.connectionPlayerCount) {
      this.connectionPlayerCount.textContent = String(playerCount);
    }

    const titleText = String(detail || this.connectionStatusLabel.textContent);
    this.connectionStatusRoot.title = shouldShowPlayerCount
      ? `${titleText} ${playerCount} active ${playerCount === 1 ? 'player' : 'players'}.`
      : titleText;
    this.connectionStatusRoot.classList.remove(
      'is-connecting',
      'is-online',
      'is-reconnecting',
      'is-rejoining',
      'is-updating',
      'is-offline',
      'is-local',
      'is-update-ready'
    );
    this.connectionStatusRoot.classList.add(`is-${normalizedStatus}`);
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

  bindMapCaptureEvents({ onCapture } = {}) {
    this.mapCaptureToggle?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.mapCaptureToggle.disabled) {
        return;
      }

      onCapture?.();
    });
  }

  bindAdminPromptEvents({
    onToggle,
    onClose,
    onRefresh,
    onSubmit,
    onFollowup,
    onSelect,
    onCancel,
    onApproveDeploy,
    onRollback,
    onTab
  } = {}) {
    this.adminPromptToggle?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggle?.();
    });

    this.adminPromptForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSubmit?.({
        prompt: this.adminPromptPrompt?.value ?? '',
        mode: this.adminPromptMode?.value ?? 'preview'
      });
    });

    this.adminPromptRoot?.addEventListener('submit', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const followupForm = target?.closest('[data-admin-prompt-followup-form]');
      if (!followupForm) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const promptField = followupForm.querySelector('[data-admin-prompt-followup-prompt]');
      onFollowup?.(this.adminPromptState.selectedTaskId, {
        prompt: promptField?.value ?? '',
        mode: 'preview'
      });
    });

    this.adminPromptRoot?.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const actionTarget = target?.closest('[data-admin-prompt-action]');
      if (!actionTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const action = actionTarget.getAttribute('data-admin-prompt-action') ?? '';
      if (action === 'close') {
        onClose?.();
      } else if (action === 'refresh') {
        onRefresh?.();
      } else if (action === 'new-thread') {
        onTab?.('new');
      } else if (action === 'load-more') {
        this.adminPromptThreadLimit += ADMIN_PROMPT_THREAD_LIST_LIMIT;
        this.lastAdminPromptTaskListSignature = '';
        this.renderAdminPromptPanel();
      } else if (action.startsWith('tab:')) {
        onTab?.(action.slice('tab:'.length));
      } else if (action.startsWith('select:')) {
        onSelect?.(action.slice('select:'.length));
      } else if (action === 'cancel-task') {
        onCancel?.(this.adminPromptState.selectedTaskId);
      } else if (action === 'approve-deploy') {
        onApproveDeploy?.(this.adminPromptState.selectedTaskId);
      } else if (action === 'rollback') {
        onRollback?.(this.adminPromptState.selectedTaskId);
      }
    });
  }

  getPhoneMapTooltipElement() {
    return this.phoneStage?.querySelector('[data-phone-map-tooltip-popover]') ?? null;
  }

  getPhoneMapMarkerFromEvent(event) {
    const target = event.target instanceof Element
      ? event.target
      : event.target?.parentElement ?? null;
    return target?.closest('[data-phone-map-tooltip]') ?? null;
  }

  showPhoneMapTooltip(marker, event = null) {
    const tooltip = this.getPhoneMapTooltipElement();
    const label = marker?.getAttribute?.('data-phone-map-tooltip')?.trim() ?? '';
    if (!tooltip || !label) {
      return;
    }

    const icon = marker.getAttribute('data-phone-map-tooltip-icon')?.trim() ?? '';
    const kind = marker.getAttribute('data-phone-map-tooltip-kind')?.trim() ?? 'default';
    tooltip.innerHTML = `
      <span class="hud__phone-map-tooltip-icon is-${escapeHtml(kind)}">${escapeHtml(icon || '?')}</span>
      <strong>${escapeHtml(label)}</strong>
    `;
    tooltip.hidden = false;
    this.positionPhoneMapTooltip(marker, event);
  }

  positionPhoneMapTooltip(marker, event = null) {
    const tooltip = this.getPhoneMapTooltipElement();
    const stage = this.phoneStage;
    if (!tooltip || !(stage instanceof HTMLElement)) {
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const markerRect = marker?.getBoundingClientRect?.();
    const clientX = Number.isFinite(event?.clientX)
      ? event.clientX
      : markerRect
        ? markerRect.left + markerRect.width * 0.5
        : stageRect.left + stageRect.width * 0.5;
    const clientY = Number.isFinite(event?.clientY)
      ? event.clientY
      : markerRect
        ? markerRect.top + markerRect.height * 0.5
        : stageRect.top + stageRect.height * 0.5;

    tooltip.style.transform = 'none';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 12;
    const offset = 16;
    let left = clientX - stageRect.left + offset;
    let top = clientY - stageRect.top - tooltipRect.height - offset;

    if (left + tooltipRect.width > stageRect.width - margin) {
      left = clientX - stageRect.left - tooltipRect.width - offset;
    }
    if (top < margin) {
      top = clientY - stageRect.top + offset;
    }

    tooltip.style.left = `${Math.max(margin, Math.min(stageRect.width - tooltipRect.width - margin, left))}px`;
    tooltip.style.top = `${Math.max(margin, Math.min(stageRect.height - tooltipRect.height - margin, top))}px`;
  }

  hidePhoneMapTooltip() {
    const tooltip = this.getPhoneMapTooltipElement();
    if (!tooltip) {
      return;
    }

    tooltip.hidden = true;
    tooltip.innerHTML = '';
  }

  bindZoomEvents({ onZoomIn, onZoomOut }) {
    this.zoomInButton?.addEventListener('click', () => {
      onZoomIn();
    });

    this.zoomOutButton?.addEventListener('click', () => {
      onZoomOut();
    });
  }

  bindHotbarEvents({ onSelectSlot, onMoveSlot } = {}) {
    this.hotbarSlotsRoot?.addEventListener('pointerdown', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const button = target?.closest('[data-hotbar-slot]');
      if (!button || button.disabled || (event.pointerType === 'mouse' && event.button !== 0)) {
        return;
      }

      event.stopPropagation();
      if (button.classList.contains('is-empty')) {
        return;
      }

      this.startHotbarSlotDrag(event, button, onMoveSlot);
    });

    this.hotbarSlotsRoot?.addEventListener('click', (event) => {
      if (performance.now() < this.hotbarSuppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const button = target?.closest('[data-hotbar-slot]');
      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onSelectSlot?.(Number(button.dataset.hotbarSlot));
    });
  }

  startHotbarSlotDrag(event, button, onMoveSlot) {
    this.endHotbarSlotDrag(null, { cancelled: true });

    const fromIndex = Number(button.dataset.hotbarSlot);
    if (!Number.isFinite(fromIndex)) {
      return;
    }

    const state = {
      pointerId: event.pointerId,
      fromIndex,
      source: button,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      dragging: false,
      dropIndex: -1,
      dropTarget: null,
      ghost: null,
      onMoveSlot,
      moveHandler: null,
      upHandler: null,
      cancelHandler: null
    };
    state.moveHandler = (moveEvent) => this.handleHotbarSlotDragMove(moveEvent);
    state.upHandler = (upEvent) => this.endHotbarSlotDrag(upEvent);
    state.cancelHandler = (cancelEvent) => this.endHotbarSlotDrag(cancelEvent, { cancelled: true });

    this.hotbarDragState = state;
    try {
      button.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture can fail if the browser has already cancelled the pointer.
    }

    window.addEventListener('pointermove', state.moveHandler, { passive: false });
    window.addEventListener('pointerup', state.upHandler, { passive: false });
    window.addEventListener('pointercancel', state.cancelHandler, { passive: false });
  }

  handleHotbarSlotDragMove(event) {
    const state = this.hotbarDragState;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }

    state.currentX = event.clientX;
    state.currentY = event.clientY;
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (!state.dragging && Math.hypot(deltaX, deltaY) < 6) {
      return;
    }

    if (!state.dragging) {
      this.startHotbarSlotDragVisual(state);
    }

    event.preventDefault();
    event.stopPropagation();
    this.positionHotbarSlotDragGhost(state, event.clientX, event.clientY);
    this.updateHotbarSlotDropTarget(event.clientX, event.clientY);
  }

  startHotbarSlotDragVisual(state) {
    state.dragging = true;
    this.hotbarSuppressClickUntil = performance.now() + 300;
    this.hotbarRoot?.classList.add('is-dragging');
    state.source?.classList.add('is-drag-source');
    state.source?.setAttribute('aria-grabbed', 'true');

    const ghost = state.source?.cloneNode(true);
    if (ghost instanceof HTMLElement) {
      const rect = state.source.getBoundingClientRect();
      ghost.classList.add('hud__hotbar-drag-ghost');
      ghost.classList.remove('is-drag-source', 'is-drop-target');
      ghost.disabled = true;
      ghost.setAttribute('aria-hidden', 'true');
      ghost.removeAttribute('data-hotbar-slot');
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      document.body.append(ghost);
      state.ghost = ghost;
      this.positionHotbarSlotDragGhost(state, state.currentX, state.currentY);
    }
  }

  positionHotbarSlotDragGhost(state, clientX, clientY) {
    if (!state?.ghost) {
      return;
    }

    state.ghost.style.left = `${clientX}px`;
    state.ghost.style.top = `${clientY}px`;
  }

  updateHotbarSlotDropTarget(clientX, clientY) {
    const state = this.hotbarDragState;
    if (!state) {
      return;
    }

    const element = document.elementFromPoint(clientX, clientY);
    const button = element instanceof Element
      ? element.closest('[data-hotbar-slot]')
      : null;
    const nextTarget = button && this.hotbarSlotsRoot?.contains(button)
      ? button
      : null;
    const nextIndex = Number(nextTarget?.dataset.hotbarSlot);
    const validTarget = Number.isFinite(nextIndex) && nextIndex !== state.fromIndex
      ? nextTarget
      : null;

    if (state.dropTarget && state.dropTarget !== validTarget) {
      state.dropTarget.classList.remove('is-drop-target');
    }

    state.dropTarget = validTarget;
    state.dropIndex = validTarget ? nextIndex : -1;
    validTarget?.classList.add('is-drop-target');
  }

  endHotbarSlotDrag(event = null, { cancelled = false } = {}) {
    const state = this.hotbarDragState;
    if (!state || (event && event.pointerId !== state.pointerId)) {
      return;
    }

    if (state.dragging) {
      event?.preventDefault();
      event?.stopPropagation();
      this.hotbarSuppressClickUntil = performance.now() + 350;
      if (!cancelled && event) {
        this.updateHotbarSlotDropTarget(event.clientX, event.clientY);
      }
      if (!cancelled && state.dropIndex >= 0) {
        state.onMoveSlot?.(state.fromIndex, state.dropIndex);
      }
    }

    state.moveHandler && window.removeEventListener('pointermove', state.moveHandler);
    state.upHandler && window.removeEventListener('pointerup', state.upHandler);
    state.cancelHandler && window.removeEventListener('pointercancel', state.cancelHandler);
    try {
      state.source?.releasePointerCapture?.(state.pointerId);
    } catch {
      // The pointer may already be released after cancellation.
    }

    this.hotbarRoot?.classList.remove('is-dragging');
    state.source?.classList.remove('is-drag-source');
    state.source?.removeAttribute('aria-grabbed');
    state.dropTarget?.classList.remove('is-drop-target');
    state.ghost?.remove();
    this.hotbarDragState = null;
  }

  bindCarSelectorEvents({
    onTogglePanel,
    onCycleCar,
    onSelectCar
  } = {}) {
    this.boundVehicleRoot?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onTogglePanel?.();
    });

    this.carSelectorClose?.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.carSelectorRoot)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onTogglePanel?.(false);
    });

    this.carSelectorPrev?.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.carSelectorRoot)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onCycleCar?.(-1);
    });

    this.carSelectorNext?.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.carSelectorRoot)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onCycleCar?.(1);
    });

    this.carSelectorGrid?.addEventListener('click', (event) => {
      if (!this.isElementInteractive(this.carSelectorRoot)) {
        return;
      }

      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const button = target?.closest('[data-car-item-id]');
      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onSelectCar?.(button.dataset.carItemId ?? '');
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
    onPropSizeChange,
    onRotateSelection,
    onMoveSelection,
    onDeleteSelection,
    onConfirmSelection,
    onNpcNameChange,
    onNpcPromptChange,
    onNpcRadiusChange,
    onNpcSpeedChange,
    onNpcRespawnDelayChange,
    onNpcDeliveryQuestChange,
    onNpcGymCheckInChange,
    onNpcRentCollectorChange,
    onNpcStockMarketChange,
    onNpcBartenderChange,
    onNpcPawnShopOwnerChange,
    onNpcCarDealerChange,
    onNpcMarthaChange,
    onNpcBlackjackDealerChange,
    onNpcSchoolMicrogameChange,
    onNpcModelChange,
    onNpcModelVoiceChange,
    onNpcRoutineAddStep,
    onNpcRoutineRemoveStep,
    onNpcRoutineStepChange,
    onNpcRoutinePickTarget,
    onNpcCombatChange,
    onCloseNpcEditor,
    onCloseBuildingEditor,
    onBuildingLabelChange,
    onBuildingPromptChange,
    onBuildingActionTextChange,
    onBuildingRadiusChange,
    onBuildingDistanceChange,
    onMissionSequenceReorder,
    onMissionSequenceRuleChange,
    onMissionSequencePromptInput,
    onMissionSequencePromptSubmit
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

    this.builderTiles.addEventListener('dragstart', (event) => {
      if (!this.isElementInteractive(this.builderRoot)) {
        event.preventDefault();
        return;
      }

      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      if (target?.closest('input, select, textarea, button')) {
        event.preventDefault();
        return;
      }

      const row = target?.closest('[data-builder-mission-index]');
      if (!row) {
        return;
      }

      const fromIndex = Number(row.dataset.builderMissionIndex);
      if (!Number.isFinite(fromIndex)) {
        event.preventDefault();
        return;
      }

      this.builderMissionDragIndex = fromIndex;
      row.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain', String(fromIndex));
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
    });

    this.builderTiles.addEventListener('dragover', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const row = target?.closest('[data-builder-mission-index]');
      if (!row) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      this.builderTiles
        .querySelectorAll('.hud__mission-sequencer-row.is-drag-over')
        .forEach((entry) => {
          if (entry !== row) {
            entry.classList.remove('is-drag-over');
          }
        });
      row.classList.add('is-drag-over');
    });

    this.builderTiles.addEventListener('dragleave', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const row = target?.closest('[data-builder-mission-index]');
      const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (row && !row.contains(related)) {
        row.classList.remove('is-drag-over');
      }
    });

    this.builderTiles.addEventListener('drop', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const row = target?.closest('[data-builder-mission-index]');
      if (!row) {
        return;
      }

      event.preventDefault();
      const transfer = String(event.dataTransfer?.getData('text/plain') ?? '');
      const transferIndex = Number(transfer);
      const fromIndex = Number.isFinite(transferIndex) ? transferIndex : this.builderMissionDragIndex;
      const toIndex = Number(row.dataset.builderMissionIndex);
      this.clearMissionSequencerDragClasses();
      this.builderMissionDragIndex = null;
      if (
        !Number.isFinite(fromIndex)
        || !Number.isFinite(toIndex)
        || fromIndex === toIndex
      ) {
        return;
      }

      onMissionSequenceReorder?.(fromIndex, toIndex);
    });

    this.builderTiles.addEventListener('dragend', () => {
      this.clearMissionSequencerDragClasses();
      this.builderMissionDragIndex = null;
    });

    const handleMissionSequenceRuleChange = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      const row = target.closest('[data-builder-mission-id]');
      const missionId = row?.getAttribute('data-builder-mission-id') ?? '';
      if (!missionId) {
        return;
      }

      if (target.matches('[data-builder-mission-rule-enabled]')) {
        onMissionSequenceRuleChange?.(missionId, {
          makeAvailableAfterMission: target.checked === true
        });
        return;
      }

      if (target.matches('[data-builder-mission-rule-number]')) {
        onMissionSequenceRuleChange?.(missionId, {
          availableAfterMissionNumber: Number(target.value)
        });
      }
    };

    this.builderTiles.addEventListener('change', handleMissionSequenceRuleChange);

    this.builderTiles.addEventListener('input', (event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement && target.matches('[data-builder-mission-prompt]')) {
        onMissionSequencePromptInput?.(target.value);
      }
    });

    this.builderTiles.addEventListener('submit', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : null;
      const form = target?.closest('[data-builder-mission-add-form]');
      if (!form || !this.isElementInteractive(this.builderRoot)) {
        return;
      }

      event.preventDefault();
      const field = form.querySelector('[data-builder-mission-prompt]');
      const prompt = field instanceof HTMLTextAreaElement ? field.value : '';
      onMissionSequencePromptSubmit?.(prompt);
    });

    this.builderPropSizeInput?.addEventListener('input', () => {
      onPropSizeChange?.(Number(this.builderPropSizeInput.value));
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

    this.builderNpcRotate?.addEventListener('click', () => {
      onRotateSelection();
    });

    this.builderNpcMove?.addEventListener('click', () => {
      onMoveSelection();
    });

    this.builderNpcDelete?.addEventListener('click', () => {
      onDeleteSelection();
    });

    this.builderNpcDone?.addEventListener('click', () => {
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

    this.builderNpcSpeed?.addEventListener('change', () => {
      onNpcSpeedChange?.(this.builderNpcSpeed.value);
    });

    this.builderNpcRespawnDelay?.addEventListener('input', () => {
      onNpcRespawnDelayChange?.(Number(this.builderNpcRespawnDelay.value));
    });

    this.builderNpcDeliveryQuest?.addEventListener('change', () => {
      onNpcDeliveryQuestChange?.(this.builderNpcDeliveryQuest.checked === true);
    });

    this.builderNpcGymCheckIn?.addEventListener('change', () => {
      onNpcGymCheckInChange?.(this.builderNpcGymCheckIn.checked === true);
    });

    this.builderNpcRentCollector?.addEventListener('change', () => {
      onNpcRentCollectorChange?.(this.builderNpcRentCollector.checked === true);
    });

    this.builderNpcStockMarket?.addEventListener('change', () => {
      onNpcStockMarketChange?.(this.builderNpcStockMarket.checked === true);
    });

    this.builderNpcBartender?.addEventListener('change', () => {
      onNpcBartenderChange?.(this.builderNpcBartender.checked === true);
    });

    this.builderNpcPawnShopOwner?.addEventListener('change', () => {
      onNpcPawnShopOwnerChange?.(this.builderNpcPawnShopOwner.checked === true);
    });

    this.builderNpcCarDealer?.addEventListener('change', () => {
      onNpcCarDealerChange?.(this.builderNpcCarDealer.checked === true);
    });

    this.builderNpcMartha?.addEventListener('change', () => {
      onNpcMarthaChange?.(this.builderNpcMartha.checked === true);
    });

    this.builderNpcBlackjackDealer?.addEventListener('change', () => {
      onNpcBlackjackDealerChange?.(this.builderNpcBlackjackDealer.checked === true);
    });

    this.builderNpcSchoolMicrogame?.addEventListener('change', () => {
      onNpcSchoolMicrogameChange?.(this.builderNpcSchoolMicrogame.checked === true);
    });

    this.builderNpcModel.addEventListener('change', () => {
      onNpcModelChange(this.builderNpcModel.value);
    });

    this.builderNpcModelOptions?.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const button = target?.closest('[data-builder-npc-model-option]');
      if (!button) {
        return;
      }

      const modelId = button.dataset.builderNpcModelOption;
      if (modelId) {
        onNpcModelChange(modelId);
      }
    });

    const handleNpcModelVoiceChange = () => {
      onNpcModelVoiceChange?.({
        basePitchHz: Number(this.builderNpcVoicePitch?.value),
        charactersPerSecond: Number(this.builderNpcVoiceSpeed?.value),
        pitchVariance: Number(this.builderNpcVoiceRange?.value) / 100,
        waveform: this.builderNpcVoiceTone?.value,
        volume: Number(this.builderNpcVoiceVolume?.value) / 100
      });
    };

    this.builderNpcVoicePitch?.addEventListener('input', handleNpcModelVoiceChange);
    this.builderNpcVoiceSpeed?.addEventListener('input', handleNpcModelVoiceChange);
    this.builderNpcVoiceRange?.addEventListener('input', handleNpcModelVoiceChange);
    this.builderNpcVoiceTone?.addEventListener('change', handleNpcModelVoiceChange);
    this.builderNpcVoiceVolume?.addEventListener('input', handleNpcModelVoiceChange);

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

    this.builderNpcConfirm.addEventListener('click', () => {
      onCloseNpcEditor();
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

  bindPhoneEvents({
    onToggle,
    onClose,
    onOpenApp,
    onHome,
    onCycleCharacter,
    onSelectMission,
    onOpenWalletStocks,
    onPhoneStockRefresh,
    onPhoneStockSelect,
    onPhoneStockQuantityChange,
    onPhoneStockTrade,
    onMapZoom,
    onMapPan,
    onMasterVolumeChange,
    onVibeRadioAction,
    onVibeRadioTrackSelect,
    onVibeRadioVolumeChange
  }) {
    this.phoneLauncher?.addEventListener('click', () => {
      onToggle?.();
    });

    this.phoneClose?.addEventListener('click', () => {
      onClose?.();
    });

    this.phoneStage?.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      if (target?.closest('[data-phone-backdrop]')) {
        onClose?.();
      }
    });

    this.phoneScreenContent?.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;

      if (target?.closest('[data-phone-character-prev]')) {
        event.preventDefault();
        event.stopPropagation();
        onCycleCharacter?.(-1);
        return;
      }

      if (target?.closest('[data-phone-character-next]')) {
        event.preventDefault();
        event.stopPropagation();
        onCycleCharacter?.(1);
        return;
      }

      const missionButton = target?.closest('[data-phone-mission-id]');
      if (missionButton) {
        event.preventDefault();
        event.stopPropagation();
        if (!missionButton.disabled) {
          onSelectMission?.(missionButton.getAttribute('data-phone-mission-id') ?? '');
        }
        return;
      }

      const walletStocksButton = target?.closest('[data-phone-wallet-stocks]');
      if (walletStocksButton) {
        event.preventDefault();
        event.stopPropagation();
        if (!walletStocksButton.disabled) {
          onOpenWalletStocks?.();
        }
        return;
      }

      const phoneStockRefreshButton = target?.closest('[data-phone-stocks-refresh]');
      if (phoneStockRefreshButton) {
        event.preventDefault();
        event.stopPropagation();
        if (!phoneStockRefreshButton.disabled) {
          onPhoneStockRefresh?.();
        }
        return;
      }

      const phoneStockTradeButton = target?.closest('[data-phone-stock-trade]');
      if (phoneStockTradeButton) {
        event.preventDefault();
        event.stopPropagation();
        if (!phoneStockTradeButton.disabled) {
          onPhoneStockTrade?.(phoneStockTradeButton.getAttribute('data-phone-stock-trade') ?? '');
        }
        return;
      }

      const phoneStockButton = target?.closest('[data-phone-stock-symbol]');
      if (phoneStockButton) {
        event.preventDefault();
        event.stopPropagation();
        onPhoneStockSelect?.(phoneStockButton.getAttribute('data-phone-stock-symbol') ?? '');
        return;
      }

      const vibeRadioTrackButton = target?.closest('[data-phone-vibe-radio-track]');
      if (vibeRadioTrackButton) {
        event.preventDefault();
        event.stopPropagation();
        if (!vibeRadioTrackButton.disabled) {
          onVibeRadioTrackSelect?.(vibeRadioTrackButton.getAttribute('data-phone-vibe-radio-track') ?? '');
        }
        return;
      }

      const vibeRadioActionButton = target?.closest('[data-phone-vibe-radio-action]');
      if (vibeRadioActionButton) {
        event.preventDefault();
        event.stopPropagation();
        if (!vibeRadioActionButton.disabled) {
          onVibeRadioAction?.(vibeRadioActionButton.getAttribute('data-phone-vibe-radio-action') ?? '');
        }
        return;
      }

      const mapZoomButton = target?.closest('[data-phone-map-zoom]');
      if (mapZoomButton) {
        event.preventDefault();
        event.stopPropagation();
        if (!mapZoomButton.disabled) {
          onMapZoom?.(Number(mapZoomButton.getAttribute('data-phone-map-zoom') ?? 0));
        }
        return;
      }

      const appButton = target?.closest('[data-phone-app]');
      if (appButton) {
        onOpenApp?.(appButton.getAttribute('data-phone-app') ?? '');
        return;
      }

      if (target?.closest('[data-phone-home]')) {
        onHome?.();
      }
    });

    this.phoneScreenContent?.addEventListener('wheel', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      if (!target?.closest('[data-phone-map-canvas]')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const deltaY = Number(event.deltaY) || 0;
      if (deltaY === 0) {
        return;
      }
      const direction = deltaY < 0 ? 1 : -1;
      onMapZoom?.(direction);
    }, { passive: false });

    this.phoneScreenContent?.addEventListener('pointerdown', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const canvas = target?.closest('[data-phone-map-canvas]');
      if (!(canvas instanceof HTMLElement) || target?.closest('button')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.hidePhoneMapTooltip();
      this.phoneMapDragState = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY
      };
      canvas.classList.add('is-dragging');
      canvas.setPointerCapture?.(event.pointerId);
    });

    this.phoneScreenContent?.addEventListener('pointermove', (event) => {
      if (!this.phoneMapDragState || event.pointerId !== this.phoneMapDragState.pointerId) {
        return;
      }

      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const canvas = target?.closest('[data-phone-map-canvas]')
        ?? this.phoneScreenContent?.querySelector('[data-phone-map-canvas]');
      if (!(canvas instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const pixelDeltaX = event.clientX - this.phoneMapDragState.lastX;
      const pixelDeltaY = event.clientY - this.phoneMapDragState.lastY;
      this.phoneMapDragState.lastX = event.clientX;
      this.phoneMapDragState.lastY = event.clientY;
      if (Math.abs(pixelDeltaX) > 0.01 || Math.abs(pixelDeltaY) > 0.01) {
        onMapPan?.({
          pixelDeltaX,
          pixelDeltaY,
          width: rect.width,
          height: rect.height
        });
      }
    });

    const endPhoneMapDrag = (event) => {
      if (!this.phoneMapDragState || event.pointerId !== this.phoneMapDragState.pointerId) {
        return;
      }

      const canvas = this.phoneScreenContent?.querySelector('[data-phone-map-canvas]');
      canvas?.classList.remove('is-dragging');
      canvas?.releasePointerCapture?.(event.pointerId);
      this.phoneMapDragState = null;
    };
    this.phoneScreenContent?.addEventListener('pointerup', endPhoneMapDrag);
    this.phoneScreenContent?.addEventListener('pointercancel', endPhoneMapDrag);
    this.phoneScreenContent?.addEventListener('lostpointercapture', endPhoneMapDrag);

    this.phoneScreenContent?.addEventListener('pointerover', (event) => {
      if (this.phoneMapDragState) {
        return;
      }

      const marker = this.getPhoneMapMarkerFromEvent(event);
      if (marker) {
        this.showPhoneMapTooltip(marker, event);
      }
    });

    this.phoneScreenContent?.addEventListener('pointermove', (event) => {
      if (this.phoneMapDragState) {
        return;
      }

      const marker = this.getPhoneMapMarkerFromEvent(event);
      if (marker) {
        this.positionPhoneMapTooltip(marker, event);
      }
    });

    this.phoneScreenContent?.addEventListener('pointerout', (event) => {
      const marker = this.getPhoneMapMarkerFromEvent(event);
      if (!marker) {
        return;
      }

      const relatedTarget = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (!relatedTarget || !marker.contains(relatedTarget)) {
        this.hidePhoneMapTooltip();
      }
    });

    this.phoneScreenContent?.addEventListener('focusin', (event) => {
      const marker = this.getPhoneMapMarkerFromEvent(event);
      if (marker) {
        this.showPhoneMapTooltip(marker, event);
      }
    });

    this.phoneScreenContent?.addEventListener('focusout', (event) => {
      const marker = this.getPhoneMapMarkerFromEvent(event);
      if (marker) {
        this.hidePhoneMapTooltip();
      }
    });

    this.phoneStage?.querySelector('[data-phone-home]')?.addEventListener('click', () => {
      onHome?.();
    });

    this.phoneScreenContent?.addEventListener('input', (event) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      if (target?.matches('[data-phone-setting-audio]')) {
        onMasterVolumeChange?.(Number(target.value) / 100);
      }
      if (target?.matches('[data-phone-stock-quantity]')) {
        onPhoneStockQuantityChange?.(Number(target.value));
      }
      if (target?.matches('[data-phone-vibe-radio-volume]')) {
        onVibeRadioVolumeChange?.(Number(target.value) / 100);
      }
    });
  }

  bindVibeRadioEvents({
    onAction,
    onVolumeChange
  } = {}) {
    const containRadioPointerEvent = (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      if (target?.closest('[data-vibe-radio-action], [data-vibe-radio-volume]')) {
        event.stopPropagation();
      }
    };
    this.vibeRadioWidget?.addEventListener('pointerdown', containRadioPointerEvent);
    this.vibeRadioWidget?.addEventListener('mousedown', containRadioPointerEvent);
    this.vibeRadioWidget?.addEventListener('touchstart', containRadioPointerEvent);

    this.vibeRadioWidget?.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const actionTarget = target?.closest('[data-vibe-radio-action]');
      if (!actionTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (!actionTarget.disabled) {
        onAction?.(actionTarget.getAttribute('data-vibe-radio-action') ?? '');
      }
    });

    this.vibeRadioWidget?.addEventListener('input', (event) => {
      const target = event.target instanceof HTMLInputElement ? event.target : null;
      if (target?.matches('[data-vibe-radio-volume]')) {
        onVolumeChange?.(Number(target.value) / 100);
      }
    });
  }

  bindStockMarketEvents({
    onClose,
    onRefresh,
    onSelectStock,
    onQuantityChange,
    onBuy,
    onSell
  }) {
    this.stockMarketClose?.addEventListener('click', () => {
      onClose?.();
    });

    this.stockMarketRefresh?.addEventListener('click', () => {
      onRefresh?.();
    });

    const selectStockFromEvent = (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const stockTarget = target?.closest('[data-stock-symbol]');
      if (!stockTarget) {
        return;
      }

      onSelectStock?.(stockTarget.getAttribute('data-stock-symbol') ?? '');
    };

    this.stockMarketList?.addEventListener('click', selectStockFromEvent);
    this.stockMarketOverview?.addEventListener('click', selectStockFromEvent);

    this.stockMarketQuantity?.addEventListener('input', () => {
      onQuantityChange?.(Number(this.stockMarketQuantity.value));
    });

    this.stockMarketBuy?.addEventListener('click', () => {
      onBuy?.();
    });

    this.stockMarketSell?.addEventListener('click', () => {
      onSell?.();
    });
  }

  bindBlackjackEvents({
    onClose,
    onWagerChange,
    onDeal,
    onHit,
    onStand,
    onDouble,
    onSplit
  }) {
    this.blackjackClose?.addEventListener('click', () => {
      onClose?.();
    });

    this.blackjackWager?.addEventListener('input', () => {
      onWagerChange?.(Number(this.blackjackWager.value));
    });

    this.blackjackDeal?.addEventListener('click', () => {
      onDeal?.();
    });

    this.blackjackHit?.addEventListener('click', () => {
      onHit?.();
    });

    this.blackjackStand?.addEventListener('click', () => {
      onStand?.();
    });

    this.blackjackDouble?.addEventListener('click', () => {
      onDouble?.();
    });

    this.blackjackSplit?.addEventListener('click', () => {
      onSplit?.();
    });
  }

  bindSchoolMicrogameEvents({
    onClose,
    onAction
  }) {
    this.schoolMicrogameClose?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
    });

    let actionPointerHandledUntil = 0;

    this.schoolMicrogameRoot?.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const actionTarget = target?.closest('[data-school-microgame-action]');
      if (!actionTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (performance.now() < actionPointerHandledUntil) {
        return;
      }
      onAction?.(actionTarget.getAttribute('data-school-microgame-action') ?? '');
    });

    let holdPointerActive = false;

    this.schoolMicrogameRoot?.addEventListener('pointerdown', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const holdTarget = target?.closest('[data-school-microgame-hold]');
      if (!holdTarget) {
        const actionTarget = target?.closest('[data-school-microgame-action]');
        if (!actionTarget || (typeof event.button === 'number' && event.button !== 0)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        actionPointerHandledUntil = performance.now() + 420;
        onAction?.(actionTarget.getAttribute('data-school-microgame-action') ?? '');
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      holdPointerActive = true;
      holdTarget.setPointerCapture?.(event.pointerId);
      onAction?.('hold:start');
    });

    const releaseHold = (event) => {
      if (!holdPointerActive) {
        return;
      }

      holdPointerActive = false;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      onAction?.('hold:end');
    };

    this.schoolMicrogameRoot?.addEventListener('pointerup', releaseHold);
    this.schoolMicrogameRoot?.addEventListener('pointercancel', releaseHold);
    window.addEventListener('pointerup', releaseHold);
    window.addEventListener('blur', releaseHold);
  }

  bindVibeHeroEvents({
    onClose,
    onAction
  }) {
    this.vibeHeroClose?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
    });

    this.vibeHeroRoot?.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const actionTarget = target?.closest('[data-vibe-hero-action]');
      if (!actionTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onAction?.(actionTarget.getAttribute('data-vibe-hero-action') ?? '');
    });
  }

  bindBasketballShotEvents({
    onAction
  }) {
    this.basketballShotRoot?.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target
        : event.target?.parentElement ?? null;
      const actionTarget = target?.closest('[data-basketball-shot-action]');
      if (!actionTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onAction?.(actionTarget.getAttribute('data-basketball-shot-action') ?? '');
    });
  }

  bindQuickChatEvents({ onSubmit, onCancel }) {
    this.quickChatForm.addEventListener('submit', (event) => {
      event.preventDefault();
      this.npcSpeechPlayback.prime();
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

  clearMissionSequencerDragClasses() {
    this.builderTiles
      ?.querySelectorAll('.hud__mission-sequencer-row.is-dragging, .hud__mission-sequencer-row.is-drag-over')
      .forEach((entry) => {
        entry.classList.remove('is-dragging', 'is-drag-over');
      });
  }

  getBuilderMissionSequencerRowMarkup(row = {}) {
    const missionNumber = Math.max(1, Math.floor(Number(row.missionNumber) || 1));
    const canRequireMission = row.canRequireMission === true;
    const gateEnabled = canRequireMission && row.makeAvailableAfterMission === true;
    const maxGateNumber = Math.max(0, Math.floor(Number(row.maxAvailableAfterMissionNumber) || 0));
    const gateNumber = canRequireMission
      ? Math.min(
          Math.max(1, Math.floor(Number(row.availableAfterMissionNumber) || maxGateNumber || 1)),
          Math.max(1, maxGateNumber)
        )
      : 0;
    const checkboxDisabled = canRequireMission ? '' : ' disabled';
    const numberDisabled = canRequireMission && gateEnabled ? '' : ' disabled';
    const checked = gateEnabled ? ' checked' : '';

    return `
      <article
        class="hud__mission-sequencer-row"
        draggable="true"
        data-builder-mission-id="${escapeHtml(row.missionId ?? '')}"
        data-builder-mission-index="${missionNumber - 1}"
      >
        <span class="hud__mission-sequencer-handle" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M9 6.5h.01M15 6.5h.01M9 12h.01M15 12h.01M9 17.5h.01M15 17.5h.01" />
          </svg>
        </span>
        <span class="hud__mission-sequencer-number">${missionNumber}</span>
        <span class="hud__mission-sequencer-copy">
          <span class="hud__mission-sequencer-title">${escapeHtml(row.label ?? row.title ?? 'Mission')}</span>
          <span class="hud__mission-sequencer-detail">${escapeHtml(row.description ?? '')}</span>
        </span>
        <label class="hud__field hud__checkbox-field hud__mission-sequencer-rule">
          <input
            class="hud__checkbox-control"
            type="checkbox"
            data-builder-mission-rule-enabled
            ${checked}${checkboxDisabled}
          />
          <span class="hud__checkbox-copy hud__mission-sequencer-rule-copy">
            <span class="hud__field-label hud__checkbox-title">Make available after mission</span>
            <input
              class="hud__field-control hud__mission-sequencer-number-input"
              type="number"
              min="${canRequireMission ? 1 : 0}"
              max="${maxGateNumber}"
              step="1"
              value="${gateNumber}"
              data-builder-mission-rule-number
              aria-label="Required mission number for ${escapeHtml(row.label ?? 'mission')}"
              ${numberDisabled}
            />
          </span>
        </label>
      </article>
    `;
  }

  getBuilderMissionSequencerMarkup(missionSequencer = {}) {
    const rows = Array.isArray(missionSequencer.rows) ? missionSequencer.rows : [];
    const prompt = String(missionSequencer.prompt ?? '');
    return `
      <section class="hud__builder-section hud__mission-sequencer" data-builder-mission-sequencer>
        <div class="hud__builder-section-header">
          <p class="hud__builder-section-title">Mission Sequencer</p>
          <span class="hud__builder-section-count">${rows.length}</span>
        </div>
        <form class="hud__mission-sequencer-add" data-builder-mission-add-form>
          <label class="hud__field hud__mission-sequencer-prompt">
            <span class="hud__field-label">New mission prompt</span>
            <textarea
              class="hud__field-control hud__field-control--textarea hud__mission-sequencer-prompt-input"
              rows="3"
              maxlength="220"
              placeholder="Add a mission for the sequence"
              data-builder-mission-prompt
            >${escapeHtml(prompt)}</textarea>
          </label>
          <button class="hud__builder-action hud__mission-sequencer-add-button" type="submit">Add Mission</button>
        </form>
        <div class="hud__mission-sequencer-list">
          ${rows.map((row) => this.getBuilderMissionSequencerRowMarkup(row)).join('')}
        </div>
      </section>
    `;
  }

  setBuilderState({
    available = false,
    enabled,
    tabs = [],
    groupTabs = [],
    sections = [],
    propSizeControl = null,
    missionSequencer = null
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

    this.builderGroups.hidden = Boolean(missionSequencer) || groupTabs.length === 0;
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

    const showPropSizeControl = Boolean(propSizeControl);
    if (this.builderPropSizePanel) {
      this.builderPropSizePanel.hidden = !showPropSizeControl;
    }
    if (showPropSizeControl && this.builderPropSizeInput) {
      this.builderPropSizeInput.min = String(propSizeControl.min ?? 0.25);
      this.builderPropSizeInput.max = String(propSizeControl.max ?? 3);
      this.builderPropSizeInput.step = String(propSizeControl.step ?? 0.05);
      this.builderPropSizeInput.value = String(propSizeControl.value ?? 1);
    }
    if (showPropSizeControl && this.builderPropSizeValue) {
      this.builderPropSizeValue.textContent = `${Number(propSizeControl.value ?? 1).toFixed(2)}x`;
    }
    if (showPropSizeControl && this.builderPropSizeTarget) {
      this.builderPropSizeTarget.textContent = [
        propSizeControl.targetMode,
        propSizeControl.targetLabel
      ].filter(Boolean).join(' - ');
    }

    if (missionSequencer) {
      this.builderTiles.innerHTML = this.getBuilderMissionSequencerMarkup(missionSequencer);
      return;
    }

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
    this.builderNpcMove?.classList.toggle('is-active', Boolean(editorState.selectionActions?.moving));

    const modelsChanged = this.lastNpcEditorState?.models?.length !== editorState.models.length
      || this.lastNpcEditorState?.models?.some((entry, index) => entry.id !== editorState.models[index].id);

    if (modelsChanged) {
      this.builderNpcModel.innerHTML = editorState.models.map((model) => `
        <option value="${model.id}">${model.label}</option>
      `).join('');

      if (this.builderNpcModelOptions) {
        this.builderNpcModelOptions.innerHTML = editorState.models.map((model) => `
          <button
            class="hud__npc-model-card"
            type="button"
            data-builder-npc-model-option="${escapeHtml(model.id)}"
            aria-pressed="false"
            title="${escapeHtml(model.label)}"
          >
            <span class="hud__npc-model-card-preview">
              ${model.portraitSrc
                ? `<img class="hud__npc-model-card-image" src="${escapeHtml(model.portraitSrc)}" alt="${escapeHtml(model.label)}" loading="lazy" />`
                : `<span class="hud__builder-thumb-placeholder">${getBuilderPlaceholder(model.label)}</span>`}
            </span>
            <span class="hud__npc-model-card-label">${escapeHtml(model.label)}</span>
          </button>
        `).join('');
      }
    }

    if (document.activeElement !== this.builderNpcModel) {
      this.builderNpcModel.value = editorState.modelId;
    }
    if (this.builderNpcModelOptions) {
      this.builderNpcModelOptions
        .querySelectorAll('[data-builder-npc-model-option]')
        .forEach((button) => {
          const active = button instanceof HTMLElement
            && button.dataset.builderNpcModelOption === editorState.modelId;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }
    const modelVoice = editorState.modelVoice ?? {};
    setFieldValue(this.builderNpcVoicePitch, String(Math.round(Number(modelVoice.basePitchHz ?? 285))));
    setFieldValue(this.builderNpcVoiceSpeed, String(Math.round(Number(modelVoice.charactersPerSecond ?? 28))));
    setFieldValue(this.builderNpcVoiceRange, String(Math.round(Number(modelVoice.pitchVariance ?? 0.16) * 100)));
    setFieldValue(this.builderNpcVoiceVolume, String(Math.round(Number(modelVoice.volume ?? 0.6) * 100)));
    if (this.builderNpcVoiceTone && document.activeElement !== this.builderNpcVoiceTone) {
      this.builderNpcVoiceTone.value = modelVoice.waveform ?? 'triangle';
    }
    setFieldValue(this.builderNpcName, editorState.name);
    setFieldValue(this.builderNpcRadius, String(editorState.interactRadius));
    if (document.activeElement !== this.builderNpcSpeed && this.builderNpcSpeed) {
      this.builderNpcSpeed.value = editorState.speed ?? 'slow';
    }
    setFieldValue(this.builderNpcRespawnDelay, String(editorState.respawnDelayMs ?? 0));
    if (this.builderNpcDeliveryQuest && document.activeElement !== this.builderNpcDeliveryQuest) {
      this.builderNpcDeliveryQuest.checked = editorState.deliveryQuestEnabled === true;
    }
    if (this.builderNpcGymCheckIn && document.activeElement !== this.builderNpcGymCheckIn) {
      this.builderNpcGymCheckIn.checked = editorState.gymCheckInEnabled === true;
    }
    if (this.builderNpcRentCollector && document.activeElement !== this.builderNpcRentCollector) {
      this.builderNpcRentCollector.checked = editorState.rentCollectorEnabled === true;
    }
    if (this.builderNpcStockMarket && document.activeElement !== this.builderNpcStockMarket) {
      this.builderNpcStockMarket.checked = editorState.stockMarketEnabled === true;
    }
    if (this.builderNpcBartender && document.activeElement !== this.builderNpcBartender) {
      this.builderNpcBartender.checked = editorState.bartenderEnabled === true;
    }
    if (this.builderNpcPawnShopOwner && document.activeElement !== this.builderNpcPawnShopOwner) {
      this.builderNpcPawnShopOwner.checked = editorState.pawnShopOwnerEnabled === true;
    }
    if (this.builderNpcCarDealer && document.activeElement !== this.builderNpcCarDealer) {
      this.builderNpcCarDealer.checked = editorState.carDealerEnabled === true;
    }
    if (this.builderNpcMartha && document.activeElement !== this.builderNpcMartha) {
      this.builderNpcMartha.checked = editorState.marthaEnabled === true;
    }
    if (this.builderNpcBlackjackDealer && document.activeElement !== this.builderNpcBlackjackDealer) {
      this.builderNpcBlackjackDealer.checked = editorState.blackjackDealerEnabled === true;
    }
    if (this.builderNpcSchoolMicrogame && document.activeElement !== this.builderNpcSchoolMicrogame) {
      this.builderNpcSchoolMicrogame.checked = editorState.schoolMicrogameEnabled === true;
    }
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

    if (this.builderNpcRoutineSteps) {
      this.builderNpcRoutineSteps
        .querySelectorAll('[data-builder-npc-step-field]')
        .forEach((field) => {
          if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) {
            return;
          }

          const stepIndex = Number(field.dataset.builderNpcStepIndex);
          const fieldName = field.dataset.builderNpcStepField;
          const step = editorState.routine.steps?.[stepIndex];
          if (!Number.isInteger(stepIndex) || !fieldName || !step) {
            return;
          }

          setFieldValue(field, String(getNpcRoutineStepFieldValue(step, fieldName)));
        });
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

    this.builderNpcConfirm.disabled = false;
    this.builderNpcConfirm.textContent = 'Close';

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

  setInteractionMenuAnchor(anchor = null) {
    const screenX = Number(anchor?.screenX);
    const screenY = Number(anchor?.screenY);
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
      this.interactionRoot.classList.remove('is-world-anchored');
      this.interactionRoot.style.removeProperty('left');
      this.interactionRoot.style.removeProperty('right');
      this.interactionRoot.style.removeProperty('top');
      this.interactionRoot.style.removeProperty('bottom');
      return;
    }

    this.interactionRoot.classList.add('is-world-anchored');
    this.interactionRoot.style.right = 'auto';
    this.interactionRoot.style.bottom = 'auto';

    const bounds = this.interactionRoot.getBoundingClientRect();
    const panelWidth = Math.max(1, bounds.width || 360);
    const panelHeight = Math.max(1, bounds.height || 180);
    const minLeft = INTERACTION_MENU_VIEWPORT_PADDING;
    const minTop = INTERACTION_MENU_VIEWPORT_PADDING;
    const maxLeft = Math.max(minLeft, window.innerWidth - panelWidth - INTERACTION_MENU_VIEWPORT_PADDING);
    const maxTop = Math.max(minTop, window.innerHeight - panelHeight - INTERACTION_MENU_VIEWPORT_PADDING);
    let left = screenX + INTERACTION_MENU_ANCHOR_SIDE_GAP;
    if (left + panelWidth > window.innerWidth - INTERACTION_MENU_VIEWPORT_PADDING) {
      left = screenX - panelWidth - INTERACTION_MENU_ANCHOR_SIDE_GAP;
    }
    if (left < minLeft || left > maxLeft) {
      left = screenX - (panelWidth * 0.5);
    }

    let top = screenY - panelHeight - INTERACTION_MENU_ANCHOR_GAP;
    if (top < minTop) {
      top = screenY + INTERACTION_MENU_ANCHOR_GAP;
    }

    this.interactionRoot.style.left = `${Math.round(clampPanelPosition(left, minLeft, maxLeft))}px`;
    this.interactionRoot.style.top = `${Math.round(clampPanelPosition(top, minTop, maxTop))}px`;
  }

  showInteractionMenu({ title, subtitle, actions, anchor = null, variant = '' }) {
    this.lastInteractionState = { title, subtitle, actions, variant };
    this.interactionTitle.textContent = title;
    this.interactionSubtitle.textContent = subtitle;
    this.interactionRoot.dataset.interactionVariant = String(variant ?? '');
    this.interactionActions.innerHTML = actions.map((action) => getInteractionActionMarkup(action)).join('');
    this.interactionRoot.classList.add('is-visible');
    this.setInteractionMenuAnchor(anchor);
  }

  hideInteractionMenu() {
    this.lastInteractionState = null;
    this.interactionRoot.classList.remove('is-visible');
    this.interactionRoot.dataset.interactionVariant = '';
    this.setInteractionMenuAnchor(null);
  }

  isInteractionMenuOpen() {
    return Boolean(this.interactionRoot?.classList.contains('is-visible'));
  }

  setStockMarketVisible(visible) {
    this.stockMarketVisible = Boolean(visible);
    if (!this.stockMarketRoot) {
      return;
    }

    this.stockMarketRoot.hidden = !this.stockMarketVisible;
    this.stockMarketRoot.classList.toggle('is-visible', this.stockMarketVisible);
  }

  isStockMarketOpen() {
    return Boolean(this.stockMarketVisible && this.stockMarketRoot && !this.stockMarketRoot.hidden);
  }

  setStockMarketState({
    visible = this.stockMarketVisible,
    market = this.stockMarketState.market,
    selectedSymbol = this.stockMarketState.selectedSymbol,
    quantity = this.stockMarketState.quantity,
    loading = this.stockMarketState.loading,
    error = this.stockMarketState.error
  } = {}) {
    this.stockMarketState = {
      market,
      selectedSymbol: String(selectedSymbol ?? ''),
      quantity: normalizeStockTradeQuantity(quantity),
      loading: Boolean(loading),
      error: String(error ?? '')
    };
    this.setStockMarketVisible(visible);
    this.renderStockMarket();
  }

  renderStockMarket() {
    if (!this.stockMarketRoot) {
      return;
    }

    const { market, loading, error } = this.stockMarketState;
    const stocks = Array.isArray(market?.stocks) ? market.stocks : [];
    const selected = stocks.find((stock) => stock.symbol === this.stockMarketState.selectedSymbol) ?? stocks[0] ?? null;
    if (selected && selected.symbol !== this.stockMarketState.selectedSymbol) {
      this.stockMarketState.selectedSymbol = selected.symbol;
    }

    if (this.stockMarketStatus) {
      const updatedAt = Number(market?.updatedAt ?? 0);
      const updatedLabel = updatedAt
        ? new Date(updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
        : '';
      this.stockMarketStatus.textContent = loading
        ? 'Syncing market...'
        : error
          ? error
          : `${market?.marketMood ?? 'Mixed Tape'}${updatedLabel ? ` | ${updatedLabel}` : ''}`;
      this.stockMarketStatus.classList.toggle('is-error', Boolean(error));
    }

    if (this.stockMarketCash) {
      this.stockMarketCash.textContent = formatMoneyAmount(market?.cash ?? 0);
    }
    if (this.stockMarketPortfolio) {
      this.stockMarketPortfolio.textContent = formatMoneyAmount(market?.portfolioValue ?? 0);
    }
    if (this.stockMarketNetWorth) {
      this.stockMarketNetWorth.textContent = formatMoneyAmount(market?.netWorth ?? 0);
    }

    if (this.stockMarketOverview) {
      this.stockMarketOverview.innerHTML = `
        <div class="hud__stock-overview-header">
          <span>All Stocks</span>
          <strong>${selected ? `${escapeHtml(selected.symbol)} ${formatStockMoney(selected.price)}` : 'Waiting'}</strong>
        </div>
        ${createAllStockChartMarkup(stocks, selected?.symbol ?? '')}
      `;
    }

    if (this.stockMarketList) {
      this.stockMarketList.innerHTML = stocks.length
        ? stocks.map((stock) => {
            const trendClass = getStockTrendClass(stock.delta);
            const activeClass = stock.symbol === selected?.symbol ? ' is-active' : '';
            return `
              <button
                class="hud__stock-row ${trendClass}${activeClass}"
                type="button"
                data-stock-symbol="${escapeHtml(stock.symbol)}"
                style="--stock-accent:${escapeHtml(stock.accent)}"
              >
                ${createStockIconMarkup(stock, 'is-row')}
                <span class="hud__stock-row-main">
                  <strong>${escapeHtml(stock.symbol)}</strong>
                  <span>${escapeHtml(stock.name)}</span>
                </span>
                <span class="hud__stock-row-price">
                  <strong>${formatStockMoney(stock.price)}</strong>
                  <span>${formatStockPercent(stock.deltaPercent)}</span>
                </span>
                ${stock.shares > 0 ? `<span class="hud__stock-row-owned">${formatHudCount(stock.shares)} owned</span>` : ''}
              </button>
            `;
          }).join('')
        : '<p class="hud__stock-empty">No tape yet.</p>';
    }

    const quantity = this.stockMarketState.quantity;
    if (this.stockMarketQuantity && document.activeElement !== this.stockMarketQuantity) {
      this.stockMarketQuantity.value = String(quantity);
    }

    if (!selected) {
      if (this.stockMarketDetail) {
        this.stockMarketDetail.innerHTML = '<p class="hud__stock-empty">Pick a listed item to trade.</p>';
      }
      if (this.stockMarketBuy) {
        this.stockMarketBuy.disabled = true;
      }
      if (this.stockMarketSell) {
        this.stockMarketSell.disabled = true;
      }
      return;
    }

    const tradeValue = getStockTradeValue(selected.price, quantity);
    const buyTotal = tradeValue;
    const sellProceeds = tradeValue;
    const buyDisabled = loading || Number(market?.cash ?? 0) < buyTotal;
    const sellDisabled = loading || Number(selected.shares ?? 0) < quantity;

    if (this.stockMarketBuy) {
      this.stockMarketBuy.disabled = buyDisabled;
      this.stockMarketBuy.textContent = `Buy ${formatMoneyAmount(buyTotal)}`;
    }
    if (this.stockMarketSell) {
      this.stockMarketSell.disabled = sellDisabled;
      this.stockMarketSell.textContent = `Sell ${formatMoneyAmount(sellProceeds)}`;
    }

    if (this.stockMarketDetail) {
      const trendClass = getStockTrendClass(selected.delta);
      this.stockMarketDetail.innerHTML = `
        <div class="hud__stock-detail-head" style="--stock-accent:${escapeHtml(selected.accent)}">
          ${createStockIconMarkup(selected, 'is-detail')}
          <div>
            <span class="hud__stock-symbol">${escapeHtml(selected.symbol)}</span>
            <h3>${escapeHtml(selected.name)}</h3>
            <p>${escapeHtml(selected.sector)} | ${escapeHtml(selected.modeLabel ?? 'Sideways')}</p>
          </div>
          <div class="hud__stock-price-stack ${trendClass}">
            <strong>${formatStockMoney(selected.price)}</strong>
            <span>${formatSignedStockMoney(selected.delta)} (${formatStockPercent(selected.deltaPercent)})</span>
          </div>
        </div>
        <div class="hud__stock-position-grid">
          <div>
            <span>Owned</span>
            <strong>${formatHudCount(selected.shares)}</strong>
          </div>
          <div>
            <span>Average</span>
            <strong>${formatStockMoney(selected.averageCost)}</strong>
          </div>
          <div>
            <span>Value</span>
            <strong>${formatMoneyAmount(selected.marketValue)}</strong>
          </div>
          <div class="${getStockTrendClass(selected.unrealizedProfit)}">
            <span>P/L</span>
            <strong>${formatSignedStockMoney(selected.unrealizedProfit)}</strong>
          </div>
        </div>
      `;
    }
  }

  setBlackjackVisible(visible) {
    this.blackjackVisible = Boolean(visible);
    if (!this.blackjackRoot) {
      return;
    }

    this.blackjackRoot.hidden = !this.blackjackVisible;
    this.blackjackRoot.classList.toggle('is-visible', this.blackjackVisible);
  }

  isBlackjackOpen() {
    return Boolean(this.blackjackVisible && this.blackjackRoot && !this.blackjackRoot.hidden);
  }

  setBlackjackState({
    visible = this.blackjackVisible,
    game = this.blackjackState.game,
    wager = this.blackjackState.wager,
    loading = this.blackjackState.loading,
    error = this.blackjackState.error,
    dealerName = this.blackjackState.dealerName
  } = {}) {
    const numericWager = Number(wager);
    this.blackjackState = {
      game,
      wager: Number.isFinite(numericWager) ? Math.max(0, Math.min(BLACKJACK_MAX_WAGER, Math.trunc(numericWager))) : BLACKJACK_DEFAULT_WAGER,
      loading: Boolean(loading),
      error: String(error ?? ''),
      dealerName: String(dealerName || 'Dealer')
    };
    this.setBlackjackVisible(visible);
    this.renderBlackjack();
  }

  renderBlackjack() {
    if (!this.blackjackRoot) {
      return;
    }

    const { game, wager, loading, error, dealerName } = this.blackjackState;
    const phase = game?.phase ?? 'idle';
    const handActive = phase === 'playerTurn';
    const handComplete = phase === 'complete';
    const cash = Number(game?.money ?? 0);
    const currentWager = Number(game?.wager ?? wager ?? 0);
    const payout = Number(game?.payout ?? 0);
    const dealerHand = Array.isArray(game?.dealerHand) ? game.dealerHand : [];
    const playerHand = Array.isArray(game?.playerHand) ? game.playerHand : [];
    const playerHands = Array.isArray(game?.playerHands) ? game.playerHands : [];
    const splitActive = game?.split === true && playerHands.length > 1;
    const activeHandIndex = Math.max(
      0,
      Math.min(playerHands.length - 1, Math.trunc(Number(game?.activeHandIndex ?? 0) || 0))
    );
    const activeSplitHand = splitActive ? playerHands[activeHandIndex] : null;

    if (this.blackjackStatus) {
      this.blackjackStatus.textContent = loading
        ? 'The dealer is shuffling...'
        : error
          ? error
          : handActive
            ? splitActive
              ? `Hand ${activeHandIndex + 1} action`
              : 'Player action'
            : handComplete
              ? 'Hand complete'
              : 'Open seat';
      this.blackjackStatus.classList.toggle('is-error', Boolean(error));
    }

    if (this.blackjackDealerName) {
      this.blackjackDealerName.textContent = dealerName;
    }
    if (this.blackjackCash) {
      this.blackjackCash.textContent = formatMoneyAmount(cash);
    }
    if (this.blackjackWager && document.activeElement !== this.blackjackWager) {
      this.blackjackWager.value = String(wager);
    }
    if (this.blackjackWager) {
      this.blackjackWager.disabled = loading || handActive;
    }

    const blackjackCardVisuals = createBlackjackCardVisuals({
      game,
      dealerHand,
      playerHand,
      playerHands: splitActive ? playerHands : [],
      previousState: this.blackjackCardVisualState
    });
    if (blackjackCardVisuals.duration > 0) {
      window.clearTimeout(this.blackjackCardAnimationTimeout);
      this.blackjackRoot.classList.add('is-dealing');
      this.blackjackCardAnimationTimeout = window.setTimeout(() => {
        this.blackjackRoot?.classList.remove('is-dealing');
      }, blackjackCardVisuals.duration + 40);
    }
    if (this.blackjackDealerHand) {
      this.blackjackDealerHand.innerHTML = dealerHand.length
        ? dealerHand.map((card, index) =>
          createBlackjackCardMarkup(card, index, blackjackCardVisuals.visuals.dealer[index])
        ).join('')
        : '<span class="hud__blackjack-card-slot"></span><span class="hud__blackjack-card-slot"></span>';
    }
    if (this.blackjackPlayerHand) {
      if (splitActive) {
        this.blackjackPlayerHand.innerHTML = `
          <div class="hud__blackjack-split-hands">
            ${playerHands.map((hand, index) =>
              createBlackjackSplitHandMarkup(hand, index, blackjackCardVisuals.visuals.playerHands[index] ?? [])
            ).join('')}
          </div>
        `;
      } else {
        this.blackjackPlayerHand.innerHTML = playerHand.length
          ? playerHand.map((card, index) =>
            createBlackjackCardMarkup(card, index, blackjackCardVisuals.visuals.player[index])
          ).join('')
          : '<span class="hud__blackjack-card-slot"></span><span class="hud__blackjack-card-slot"></span>';
      }
    }
    this.blackjackCardVisualState = blackjackCardVisuals.nextState;
    if (this.blackjackDealerValue) {
      this.blackjackDealerValue.textContent = dealerHand.length ? String(game?.dealerValue ?? 0) : '-';
    }
    if (this.blackjackPlayerValue) {
      this.blackjackPlayerValue.textContent = splitActive
        ? String(activeSplitHand?.value ?? game?.playerValue ?? 0)
        : playerHand.length
          ? String(game?.playerValue ?? 0)
          : '-';
    }
    if (this.blackjackMessage) {
      this.blackjackMessage.textContent = error || game?.message || 'Place a wager and deal.';
    }
    if (this.blackjackResult) {
      const resultClass = game?.outcome ? ` is-${String(game.outcome).replaceAll('_', '-')}` : '';
      this.blackjackResult.className = `hud__blackjack-result${resultClass}`;
      this.blackjackResult.textContent = handComplete
        ? `${payout > 0 ? `${formatMoneyAmount(payout)} returned` : 'No payout'}`
        : currentWager > 0
          ? `${formatMoneyAmount(currentWager)} on the felt`
          : 'Practice hand';
    }
    if (this.blackjackWagerChips) {
      const chipCount = Math.max(1, Math.min(5, Math.ceil(Math.max(0, currentWager) / 25)));
      this.blackjackWagerChips.innerHTML = Array.from({ length: chipCount }, (_, index) => `
        <span class="hud__blackjack-chip" style="--chip-index:${index}"></span>
      `).join('');
      this.blackjackWagerChips.classList.toggle('is-empty', currentWager <= 0);
    }

    if (this.blackjackDeal) {
      this.blackjackDeal.disabled = loading;
      this.blackjackDeal.textContent = handActive ? 'New Hand' : 'Deal';
    }
    if (this.blackjackHit) {
      this.blackjackHit.disabled = loading || !game?.canHit;
    }
    if (this.blackjackStand) {
      this.blackjackStand.disabled = loading || !game?.canStand;
    }
    if (this.blackjackDouble) {
      this.blackjackDouble.disabled = loading || !game?.canDouble;
    }
    if (this.blackjackSplit) {
      this.blackjackSplit.disabled = loading || !game?.canSplit;
    }
  }

  setSchoolMicrogameVisible(visible) {
    this.schoolMicrogameVisible = Boolean(visible);
    if (!this.schoolMicrogameRoot) {
      return;
    }

    this.schoolMicrogameRoot.hidden = !this.schoolMicrogameVisible;
    this.schoolMicrogameRoot.classList.toggle('is-visible', this.schoolMicrogameVisible);
  }

  isSchoolMicrogameOpen() {
    return Boolean(this.schoolMicrogameVisible && this.schoolMicrogameRoot && !this.schoolMicrogameRoot.hidden);
  }

  setVibeHeroVisible(visible) {
    this.vibeHeroVisible = Boolean(visible);
    if (!this.vibeHeroRoot) {
      return;
    }

    this.vibeHeroRoot.hidden = !this.vibeHeroVisible;
    this.vibeHeroRoot.classList.toggle('is-visible', this.vibeHeroVisible);
  }

  isVibeHeroOpen() {
    return Boolean(this.vibeHeroVisible && this.vibeHeroRoot && !this.vibeHeroRoot.hidden);
  }

  setBasketballShotVisible(visible) {
    this.basketballShotVisible = Boolean(visible);
    if (!this.basketballShotRoot) {
      return;
    }

    this.basketballShotRoot.hidden = !this.basketballShotVisible;
    this.basketballShotRoot.classList.toggle('is-visible', this.basketballShotVisible);
  }

  isBasketballShotOpen() {
    return Boolean(this.basketballShotVisible && this.basketballShotRoot && !this.basketballShotRoot.hidden);
  }

  getSchoolTeacherPreviewMount() {
    return this.schoolMicrogameBody?.querySelector('[data-school-teacher-preview]') ?? null;
  }

  getOfficeMopHeroPointerPosition(pointer = {}, target = this.officeMopHeroPointerPosition) {
    const stage = this.schoolMicrogameBody?.querySelector('[data-office-mop-stage]');
    if (!(stage instanceof HTMLElement)) {
      return null;
    }

    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const clientX = Number(pointer.x);
    const clientY = Number(pointer.y);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return null;
    }

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    target.x = Math.max(0, Math.min(1, x));
    target.y = Math.max(0, Math.min(1, y));
    target.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    return target;
  }

  setAdminPromptState({
    available = this.adminPromptState.available,
    open = this.adminPromptState.open,
    activeTab = this.adminPromptState.activeTab,
    tasks = this.adminPromptState.tasks,
    selectedTaskId = this.adminPromptState.selectedTaskId,
    loading = this.adminPromptState.loading,
    submitting = this.adminPromptState.submitting,
    error = this.adminPromptState.error,
    autoDeployAvailable = this.adminPromptState.autoDeployAvailable,
    contextLabel = this.adminPromptState.contextLabel
  } = {}) {
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const safeActiveTab = getAdminPromptTabId(activeTab);
    const visibleTasks = filterAdminPromptTasksForTab(safeTasks);
    let safeSelectedTaskId = String(selectedTaskId ?? '').trim();
    if (safeSelectedTaskId && !safeTasks.some((task) => task.id === safeSelectedTaskId)) {
      safeSelectedTaskId = '';
    }
    if (safeActiveTab === 'new') {
      safeSelectedTaskId = '';
    }
    if (safeActiveTab !== 'new' && safeSelectedTaskId && !visibleTasks.some((task) => task.id === safeSelectedTaskId)) {
      safeSelectedTaskId = '';
    }
    if (safeActiveTab !== 'new' && !safeSelectedTaskId && visibleTasks.length > 0) {
      safeSelectedTaskId = visibleTasks[0].id;
    }

    this.adminPromptState = {
      available: Boolean(available),
      open: Boolean(open),
      activeTab: safeActiveTab,
      tasks: safeTasks,
      selectedTaskId: safeSelectedTaskId,
      loading: Boolean(loading),
      submitting: Boolean(submitting),
      error: String(error ?? ''),
      autoDeployAvailable: Boolean(autoDeployAvailable),
      contextLabel: String(contextLabel ?? 'Game')
    };
    this.renderAdminPromptPanel();
    this.syncAdminPromptDurationTimer();
  }

  setVibeHeroState({
    visible = this.vibeHeroVisible,
    game = this.vibeHeroState.game
  } = {}) {
    this.vibeHeroState = { game };
    this.setVibeHeroVisible(visible);
    this.renderVibeHero();
  }

  renderVibeHero() {
    if (!this.vibeHeroRoot) {
      return;
    }

    const game = this.vibeHeroState.game;
    const phase = String(game?.phase ?? 'select');
    this.vibeHeroRoot.classList.toggle('is-select', phase === 'select');
    this.vibeHeroRoot.classList.toggle('is-editor-select', phase === 'editor-select');
    this.vibeHeroRoot.classList.toggle('is-countdown', phase === 'countdown');
    this.vibeHeroRoot.classList.toggle('is-playing', phase === 'playing');
    this.vibeHeroRoot.classList.toggle('is-editor', phase === 'editor');
    this.vibeHeroRoot.classList.toggle('is-recording', game?.editorRecording === true);
    this.vibeHeroRoot.classList.toggle('is-complete', phase === 'complete');

    if (this.vibeHeroStatus) {
      this.vibeHeroStatus.textContent = getVibeHeroStatusText(game);
    }

    if (this.vibeHeroTimer) {
      this.vibeHeroTimer.innerHTML = phase === 'playing' || phase === 'complete' || phase === 'editor'
        ? createVibeHeroTimerMarkup(game)
        : '';
    }

    if (this.vibeHeroBody) {
      this.vibeHeroBody.innerHTML = createVibeHeroBodyMarkup(game);
    }

    if (this.vibeHeroMessage) {
      this.vibeHeroMessage.textContent = game?.message || game?.song?.title || 'Vibe Hero';
    }
  }

  setBasketballShotState({
    visible = this.basketballShotVisible,
    game = this.basketballShotState.game
  } = {}) {
    this.basketballShotState = { game };
    this.setBasketballShotVisible(visible);
    this.renderBasketballShot();
  }

  renderBasketballShot() {
    if (!this.basketballShotRoot) {
      return;
    }

    const game = this.basketballShotState.game;
    const phase = String(game?.phase ?? 'idle');
    this.basketballShotRoot.classList.toggle('is-playing', phase === 'playing');
    this.basketballShotRoot.classList.toggle('is-result', phase === 'result');
    this.basketballShotRoot.classList.toggle('is-made', game?.made === true);
    this.basketballShotRoot.classList.toggle('is-miss', game?.made === false);

    if (this.basketballShotStatus) {
      this.basketballShotStatus.textContent = getBasketballShotStatusText(game);
    }

    if (this.basketballShotBody) {
      this.basketballShotBody.innerHTML = createBasketballShotMeterMarkup(game);
    }

    if (this.basketballShotMessage) {
      this.basketballShotMessage.textContent = game?.message || 'Release at the top of the meter.';
    }
  }

  setRentIntroCutsceneState({ visible = false, blink = 0 } = {}) {
    if (!this.rentIntroCutsceneRoot) {
      return;
    }

    const nextVisible = Boolean(visible);
    this.rentIntroCutsceneRoot.hidden = !nextVisible;
    this.rentIntroCutsceneRoot.classList.toggle('is-visible', nextVisible);
    this.overlay.classList.toggle('is-rent-cutscene-active', nextVisible);
    const closure = Math.max(0, Math.min(1, Number(blink) || 0));
    this.rentIntroCutsceneRoot.style.setProperty('--rent-blink-closure', closure.toFixed(3));
    this.rentIntroCutsceneRoot.style.setProperty('--rent-blink-top-y', `${(-100 + (closure * 104)).toFixed(2)}%`);
    this.rentIntroCutsceneRoot.style.setProperty('--rent-blink-bottom-y', `${(100 - (closure * 104)).toFixed(2)}%`);
  }

  clearAdminPromptText() {
    if (this.adminPromptPrompt) {
      this.adminPromptPrompt.value = '';
    }
  }

  isAdminPromptOpen() {
    return Boolean(this.adminPromptState.open && this.adminPromptRoot && !this.adminPromptRoot.hidden);
  }

  shouldRunAdminPromptDurationTimer() {
    if (!this.adminPromptState.available || !this.adminPromptState.open) {
      return false;
    }

    return filterAdminPromptTasksForTab(
      this.adminPromptState.tasks
    ).some((task) => isAgentTaskBusy(task.status) && getAgentTaskActiveStartedAt(task) > 0);
  }

  syncAdminPromptDurationTimer() {
    const shouldRun = this.shouldRunAdminPromptDurationTimer();
    if (shouldRun && !this.adminPromptDurationTimer) {
      this.adminPromptDurationTimer = window.setInterval(() => {
        this.adminPromptDurationTick += 1;
        this.renderAdminPromptPanel();
      }, 1000);
      return;
    }

    if (!shouldRun && this.adminPromptDurationTimer) {
      window.clearInterval(this.adminPromptDurationTimer);
      this.adminPromptDurationTimer = 0;
    }
  }

  scrollAdminPromptThreadToBottom() {
    const detailSlot = this.adminPromptDetail?.parentElement ?? null;
    if (!(detailSlot instanceof HTMLElement)) {
      return;
    }

    requestAnimationFrame(() => {
      detailSlot.scrollTop = detailSlot.scrollHeight;
      const thread = this.adminPromptDetail?.querySelector('[data-admin-prompt-thread]');
      const latestTurn = thread?.lastElementChild ?? null;
      latestTurn?.scrollIntoView?.({ block: 'end' });
      detailSlot.scrollTop = detailSlot.scrollHeight;
    });
  }

  renderAdminPromptPanel() {
    if (!this.adminPromptRoot) {
      return;
    }

    const {
      available,
      open,
      activeTab,
      tasks,
      selectedTaskId,
      loading,
      submitting,
      error,
      autoDeployAvailable,
      contextLabel
    } = this.adminPromptState;
    this.adminPromptRoot.hidden = !available || !open;
    this.adminPromptRoot.classList.toggle('is-visible', Boolean(available && open));
    this.adminPromptRoot.classList.toggle('is-loading', loading || submitting);
    if (!open || activeTab === 'new') {
      this.lastAdminPromptSelectedThreadId = '';
    }
    if (available && open) {
      this.ensureAdminPromptLayout();
    }
    if (this.adminPromptToggle) {
      this.adminPromptToggle.hidden = !available;
      this.adminPromptToggle.classList.toggle('is-active', Boolean(open));
      this.adminPromptToggle.setAttribute('aria-pressed', open ? 'true' : 'false');
    }
    if (this.adminPromptRefresh) {
      this.adminPromptRefresh.disabled = loading || submitting;
    }
    if (this.adminPromptSubmit) {
      this.adminPromptSubmit.disabled = submitting;
      this.adminPromptSubmit.textContent = submitting ? 'Submitting' : 'Submit';
    }
    if (this.adminPromptAutoOption) {
      this.adminPromptAutoOption.hidden = !autoDeployAvailable;
      this.adminPromptAutoOption.disabled = !autoDeployAvailable;
    }
    if (this.adminPromptMode && !autoDeployAvailable && this.adminPromptMode.value === 'auto') {
      this.adminPromptMode.value = 'preview';
    }
    if (this.adminPromptStatus) {
      const threadCount = filterAdminPromptTasksForTab(tasks).length;
      this.adminPromptStatus.textContent = error
        ? error
        : submitting
          ? 'Submitting task...'
          : loading
            ? 'Refreshing tasks...'
            : threadCount
              ? `${threadCount} prompt thread${threadCount === 1 ? '' : 's'}`
              : 'Codex worker ready';
      this.adminPromptStatus.classList.toggle('is-error', Boolean(error));
    }
    if (this.adminPromptContext) {
      this.adminPromptContext.textContent = `Context: ${contextLabel || 'Game'}`;
    }
    const tabsSignature = JSON.stringify(tasks.map((task) => [task.id, task.status]));
    if (this.adminPromptTabs && tabsSignature !== this.lastAdminPromptTabsSignature) {
      this.lastAdminPromptTabsSignature = tabsSignature;
      this.adminPromptTabs.innerHTML = createAdminPromptTabsMarkup(tasks);
    }
    for (const button of this.adminPromptTabs?.querySelectorAll('[data-admin-prompt-action^="tab:"]') ?? []) {
      const tabId = (button.getAttribute('data-admin-prompt-action') ?? '').slice(4);
      const isActive = tabId === 'threads';
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
    if (this.adminPromptNew) {
      this.adminPromptNew.hidden = activeTab !== 'new';
    }
    if (this.adminPromptTaskBrowser) {
      this.adminPromptTaskBrowser.hidden = false;
    }
    if (this.adminPromptDetail) {
      this.adminPromptDetail.hidden = activeTab === 'new';
    }
    const visibleTasks = filterAdminPromptTasksForTab(tasks);
    const durationTick = visibleTasks.some((task) => (
      isAgentTaskBusy(task.status)
      && getAgentTaskActiveStartedAt(task) > 0
    ))
      ? this.adminPromptDurationTick
      : 0;
    const taskListSignature = JSON.stringify({
      activeTab,
      selectedTaskId,
      durationTick,
      threadLimit: this.adminPromptThreadLimit,
      tasks: visibleTasks.map((task) => [
        task.id,
        task.status,
        task.updatedAt,
        task.workStartedAt,
        task.workCompletedAt,
        task.claimedAt,
        task.deployStartedAt,
        task.deployedAt,
        task.rollbackStartedAt,
        task.rolledBackAt,
        task.deployApprovedAt,
        task.rollbackApprovedAt,
        task.contextLabel,
        task.gameId,
        task.contextType,
        task.scope,
        task.prompt
      ])
    });
    if (this.adminPromptTasks && taskListSignature !== this.lastAdminPromptTaskListSignature) {
      this.lastAdminPromptTaskListSignature = taskListSignature;
      this.adminPromptTasks.innerHTML = createAgentTaskListMarkup(
        tasks,
        selectedTaskId,
        activeTab,
        this.adminPromptThreadLimit
      );
    }
    if (this.adminPromptDetail) {
      const selectedTask = activeTab === 'new'
        ? null
        : visibleTasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0] ?? null;
      const selectedThreadTasks = selectedTask ? getAgentThreadTasks(tasks, selectedTask) : [];
      const selectedThreadId = selectedTask ? getAgentTaskThreadId(selectedTask) : '';
      const detailSignature = JSON.stringify({
        activeTab,
        selectedTaskId: selectedTask?.id ?? '',
        threadId: selectedThreadId,
        threadTasks: selectedThreadTasks.map((task) => [
          task.id,
          task.status,
          task.updatedAt,
          task.prompt,
          task.summary,
          task.agentMessage,
          task.error,
          task.branch,
          task.commitSha,
          task.deployApprovedAt ?? 0,
          task.rollbackApprovedAt ?? 0
        ]),
        status: selectedTask?.status ?? '',
        durationTick: selectedTask && isAgentTaskBusy(selectedTask.status) ? durationTick : 0,
        branch: selectedTask?.branch ?? '',
        commitSha: selectedTask?.commitSha ?? '',
        updatedAt: selectedTask?.updatedAt ?? 0,
        workStartedAt: selectedTask?.workStartedAt ?? 0,
        workCompletedAt: selectedTask?.workCompletedAt ?? 0,
        claimedAt: selectedTask?.claimedAt ?? 0,
        deployStartedAt: selectedTask?.deployStartedAt ?? 0,
        deployedAt: selectedTask?.deployedAt ?? 0,
        rollbackStartedAt: selectedTask?.rollbackStartedAt ?? 0,
        rolledBackAt: selectedTask?.rolledBackAt ?? 0,
        deployApprovedAt: selectedTask?.deployApprovedAt ?? 0,
        rollbackApprovedAt: selectedTask?.rollbackApprovedAt ?? 0,
        rollbackCommitSha: selectedTask?.rollbackCommitSha ?? '',
        deployTargets: selectedTask?.deployTargets ?? [],
        changedFilesLength: Array.isArray(selectedTask?.changedFiles) ? selectedTask.changedFiles.length : 0,
        summary: selectedTask?.summary ?? '',
        error: selectedTask?.error ?? '',
        prompt: selectedTask?.prompt ?? ''
      });
      const shouldScrollSelectedThread = Boolean(
        selectedThreadId
        && selectedThreadId !== this.lastAdminPromptSelectedThreadId
      );
      if (detailSignature === this.lastAdminPromptDetailSignature) {
        if (shouldScrollSelectedThread) {
          this.scrollAdminPromptThreadToBottom();
          this.lastAdminPromptSelectedThreadId = selectedThreadId;
        }
        return;
      }
      this.lastAdminPromptDetailSignature = detailSignature;
      this.adminPromptDetail.innerHTML = createAgentTaskDetailMarkup(
        selectedTask,
        selectedThreadTasks
      );
      if (shouldScrollSelectedThread) {
        this.scrollAdminPromptThreadToBottom();
      }
      this.lastAdminPromptSelectedThreadId = selectedThreadId;
    }
  }

  setSchoolMicrogameState({
    visible = this.schoolMicrogameVisible,
    game = this.schoolMicrogameState.game,
    loading = this.schoolMicrogameState.loading,
    error = this.schoolMicrogameState.error
  } = {}) {
    this.schoolMicrogameState = {
      game,
      loading: Boolean(loading),
      error: String(error ?? '')
    };
    this.setSchoolMicrogameVisible(visible);
    this.renderSchoolMicrogame();
  }

  renderSchoolMicrogame() {
    if (!this.schoolMicrogameRoot) {
      return;
    }

    const { game, loading, error } = this.schoolMicrogameState;
    const round = game?.round ?? {};
    const phase = String(game?.phase ?? 'ready');
    this.schoolMicrogameRoot.classList.toggle('is-playing', phase === 'playing');
    this.schoolMicrogameRoot.classList.toggle('is-countdown', phase === 'countdown');
    this.schoolMicrogameRoot.classList.toggle('is-success', phase === 'success');
    this.schoolMicrogameRoot.classList.toggle('is-failure', phase === 'failure');
    this.schoolMicrogameRoot.style.setProperty('--school-accent', round.accent ?? '#5bd7ff');
    this.schoolMicrogameRoot.style.setProperty('--school-secondary', round.secondaryAccent ?? '#ffce5b');

    if (this.schoolMicrogameTitle) {
      this.schoolMicrogameTitle.textContent = round.title ?? 'School Microgame';
    }

    if (this.schoolMicrogameEyebrow) {
      this.schoolMicrogameEyebrow.textContent = round.eyebrow ?? 'School';
    }

    if (this.schoolMicrogameStatus) {
      this.schoolMicrogameStatus.textContent = loading
        ? 'Saving result...'
        : error
          ? error
          : getSchoolMicrogameStatusText(game);
      this.schoolMicrogameStatus.classList.toggle('is-error', Boolean(error));
    }

    if (this.schoolMicrogameTimer) {
      this.schoolMicrogameTimer.innerHTML = phase === 'playing'
        ? createSchoolTimerMarkup(game)
        : '';
    }

    if (!this.schoolMicrogameVisible) {
      this.schoolMicrogameBodyRenderKey = '';
    }

    const bodyRenderKey = getSchoolMicrogameBodyRenderKey(game, error);
    if (this.schoolMicrogameBody && this.schoolMicrogameBodyRenderKey !== bodyRenderKey) {
      this.schoolMicrogameBody.innerHTML = createSchoolMicrogameBodyMarkup({
        ...game,
        message: error || game?.message || ''
      });
      this.schoolMicrogameBodyRenderKey = bodyRenderKey;
    }
    updateSchoolMicrogameLiveMarkup(this.schoolMicrogameBody, game);

    if (this.schoolMicrogameMessage) {
      this.schoolMicrogameMessage.textContent = error || game?.message || round.description || 'Play fast.';
      this.schoolMicrogameMessage.classList.toggle('is-error', Boolean(error));
    }
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

  setSpeechAudioVolume(volume = 1) {
    this.npcSpeechPlayback?.setMasterVolume(volume);
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

  rebuildAmmoBullets(clipSize) {
    if (!this.ammoBullets) {
      return;
    }

    const safeClipSize = Math.max(0, Math.trunc(Number(clipSize) || 0));
    this.ammoBullets.replaceChildren();
    for (let index = 0; index < safeClipSize; index += 1) {
      const bullet = document.createElement('span');
      const angle = safeClipSize > 0 ? ((index / safeClipSize) * Math.PI * 2) - (Math.PI * 0.5) : 0;
      const angleDegrees = ((angle * 180) / Math.PI) + 90;
      bullet.className = 'hud__ammo-bullet';
      bullet.setAttribute('aria-hidden', 'true');
      bullet.style.setProperty('--ammo-x', `${Math.cos(angle) * AMMO_BULLET_RING_RADIUS_PERCENT}%`);
      bullet.style.setProperty('--ammo-y', `${Math.sin(angle) * AMMO_BULLET_RING_RADIUS_PERCENT}%`);
      bullet.style.setProperty('--ammo-tilt', `${angleDegrees}deg`);
      bullet.style.setProperty(
        '--ammo-delay',
        `${Math.min(index * AMMO_BULLET_STAGGER_MS, AMMO_BULLET_MAX_STAGGER_MS)}ms`
      );
      this.ammoBullets.append(bullet);
    }

    this.lastAmmoClipSize = safeClipSize;
  }

  setAmmoState({
    visible = false,
    ammoInClip = 0,
    reserveAmmo = 0,
    clipSize = WEAPON_CLIP_SIZE,
    isReloading = false
  } = {}) {
    if (!this.ammoRoot) {
      return;
    }

    const safeClipSize = Math.max(0, Math.trunc(Number(clipSize) || WEAPON_CLIP_SIZE));
    if (!visible || safeClipSize <= 0) {
      this.ammoRoot.hidden = true;
      this.ammoRoot.classList.remove('is-empty', 'is-low', 'is-reloading');
      this.lastAmmoSignature = '';
      return;
    }

    const loadedAmmo = Math.max(
      0,
      Math.min(safeClipSize, Math.trunc(Number(ammoInClip) || 0))
    );
    const reserve = Math.max(0, Math.trunc(Number(reserveAmmo) || 0));
    const loadedRatio = safeClipSize > 0 ? loadedAmmo / safeClipSize : 0;
    const isReloadingNow = Boolean(isReloading);
    const signature = [
      safeClipSize,
      loadedAmmo,
      reserve,
      isReloadingNow ? 1 : 0
    ].join('|');

    if (this.lastAmmoSignature === signature && this.ammoRoot.hidden === false) {
      return;
    }

    if (this.lastAmmoClipSize !== safeClipSize) {
      this.rebuildAmmoBullets(safeClipSize);
    }

    this.ammoRoot.hidden = false;
    this.ammoRoot.classList.toggle('is-empty', loadedAmmo <= 0);
    this.ammoRoot.classList.toggle('is-low', loadedAmmo > 0 && loadedRatio <= AMMO_LOW_CLIP_RATIO);
    this.ammoRoot.classList.toggle('is-reloading', isReloadingNow);
    this.ammoRoot.setAttribute(
      'aria-label',
      `Pistol ammo: ${loadedAmmo} in magazine, ${reserve} reserve`
    );
    this.ammoRoot.title = `${loadedAmmo}/${safeClipSize} in magazine, ${reserve} reserve`;

    if (this.ammoReserveValue) {
      this.ammoReserveValue.textContent = formatHudCount(reserve);
    }
    if (this.ammoReserveLabel) {
      this.ammoReserveLabel.textContent = isReloadingNow ? 'Reload' : 'Reserve';
    }

    const bullets = Array.from(this.ammoBullets?.children ?? []);
    bullets.forEach((bullet, index) => {
      const loaded = index < loadedAmmo;
      bullet.classList.toggle('is-loaded', loaded);
      bullet.classList.toggle('is-spent', !loaded);
      bullet.classList.toggle('is-next', loaded && index === loadedAmmo - 1);
    });
    this.lastAmmoSignature = signature;
  }

  setHotbarState({
    visible = true,
    slots = [],
    selectedIndex = 0,
    disabled = false
  } = {}) {
    if (!this.hotbarRoot || !this.hotbarSlotsRoot) {
      return;
    }

    const safeSlots = Array.isArray(slots) ? slots : [];
    const maxSelectedIndex = Math.max(0, safeSlots.length - 1);
    const normalizedSelectedIndex = Math.max(0, Math.min(maxSelectedIndex, Math.trunc(Number(selectedIndex) || 0)));
    this.hotbarRoot.hidden = !visible;
    this.hotbarRoot.classList.toggle('is-disabled', Boolean(disabled));

    const signature = JSON.stringify({
      slots: safeSlots.map((slot) => ({
        index: Number(slot?.index) || 0,
        key: slot?.key ?? '',
        itemId: slot?.itemId ?? '',
        quantity: Number(slot?.quantity) || 0,
        label: slot?.label ?? '',
        kind: slot?.kind ?? '',
        count: Number(slot?.count) || 0,
        hotbarIconId: slot?.hotbarIconId ?? '',
        equippedWeaponId: slot?.equippedWeaponId ?? ''
      }))
    });
    if (signature !== this.lastHotbarSignature) {
      this.lastHotbarSignature = signature;
      this.hotbarSlotsRoot.innerHTML = safeSlots
        .map((slot) => getHotbarSlotMarkup(slot, normalizedSelectedIndex))
        .join('');
    }

    for (const button of this.hotbarSlotsRoot.querySelectorAll('[data-hotbar-slot]')) {
      const slotIndex = Number(button.dataset.hotbarSlot);
      const isSelected = slotIndex === normalizedSelectedIndex;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      button.disabled = Boolean(disabled);
    }
  }

  setPlayerBoundItemsState({
    skateboardOwned = false,
    skating = false,
    vehicleItemId = '',
    vehicleLabel = ''
  } = {}) {
    if (!this.boundItemsRoot || !this.boundVehicleRoot) {
      return;
    }

    const hasSkateboard = skateboardOwned === true;
    const hasVehicle = String(vehicleItemId ?? '').trim() !== '';
    const visible = hasSkateboard || hasVehicle;
    const label = hasVehicle
      ? (String(vehicleLabel || 'Car').trim() || 'Car')
      : 'Skateboard';
    this.boundItemsRoot.hidden = !visible;
    this.boundVehicleRoot.hidden = !visible;
    this.boundVehicleRoot.classList.toggle('is-active', hasSkateboard && skating === true);
    this.boundVehicleRoot.dataset.vehicleItemId = hasVehicle ? String(vehicleItemId ?? '') : '';
    if (this.boundVehicleSkateboardIcon) {
      this.boundVehicleSkateboardIcon.hidden = hasVehicle;
    }
    if (this.boundVehicleCarIcon) {
      this.boundVehicleCarIcon.hidden = !hasVehicle;
    }
    if (this.boundVehicleLabel) {
      this.boundVehicleLabel.textContent = label;
    }
    this.boundVehicleRoot.setAttribute(
      'aria-label',
      visible && hasSkateboard && skating === true ? `${label} active` : `${label} owned`
    );
    this.boundVehicleRoot.setAttribute('aria-haspopup', visible ? 'dialog' : 'false');
    this.boundVehicleRoot.setAttribute('title', 'Choose vehicle');
  }

  setDrunknessState({ level = 0 } = {}) {
    if (!this.drunknessRoot || !this.drunknessFill) {
      return;
    }

    const normalizedLevel = normalizeHudDrunknessLevel(level);
    const visible = normalizedLevel > 0;
    const ratio = visible ? normalizedLevel / DRUNKNESS_MAX_LEVEL : 0;
    const label = getDrunknessLevelLabel(normalizedLevel);
    const hue = getHudDrunknessHue(normalizedLevel);

    this.drunknessRoot.hidden = !visible;
    this.drunknessRoot.style.setProperty('--drunkness-ratio', `${ratio}`);
    this.drunknessRoot.style.setProperty('--drunkness-fill', `${Math.round(ratio * 100)}%`);
    this.drunknessRoot.style.setProperty('--drunkness-hue', `${hue}`);
    this.drunknessRoot.setAttribute('aria-valuenow', `${normalizedLevel}`);
    this.drunknessRoot.setAttribute('aria-valuetext', visible ? `Drunkness: ${label}` : 'Sober');
    this.drunknessRoot.title = visible ? `Drunkness: ${label}` : 'Sober';

    for (const labelNode of this.drunknessLabels) {
      const labelLevel = Number(labelNode.dataset.drunknessLabelLevel) || 0;
      labelNode.classList.toggle('is-filled', visible && labelLevel <= normalizedLevel);
      labelNode.classList.toggle('is-active', visible && labelLevel === normalizedLevel);
    }
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
      this.setAmmoState({ visible: false });
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
    this.setAmmoState({
      visible: Boolean(alive && armed),
      ammoInClip,
      reserveAmmo,
      clipSize: WEAPON_CLIP_SIZE,
      isReloading
    });

    if (!alive) {
      const seconds = Math.max(0, Math.ceil((respawnAt - Date.now()) / 1000));
      if (this.respawnLine) {
        this.respawnLine.textContent = getRespawnDeathLine(deaths);
      }
      if (this.respawnDetail) {
        const countdownText = seconds > 0 ? `Respawning in ${seconds}s` : 'Respawning...';
        this.respawnDetail.textContent = `${countdownText} - hospital bill: ${formatMoneyAmount(PLAYER_RESPAWN_COST)}`;
      }
      this.respawnText.classList.add('is-visible');
      return;
    }

    this.respawnText.classList.remove('is-visible');
  }

  setHitMarkerVisible(visible) {
    this.hitMarker.classList.toggle('is-visible', visible);
  }

  setMoneyState({ amount = 0, netWorth = amount, stockProfit = 0 } = {}) {
    if (!this.moneyRoot || !this.moneyValue) {
      return;
    }

    const numeric = Number(amount ?? 0);
    const money = Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
    const netWorthNumeric = Number(netWorth ?? money);
    const displayedNetWorth = Number.isFinite(netWorthNumeric) ? Math.trunc(netWorthNumeric) : money;
    const profitNumeric = Number(stockProfit ?? 0);
    const displayedProfit = Number.isFinite(profitNumeric) ? Math.trunc(profitNumeric) : 0;
    const trendClass = getStockTrendClass(displayedProfit);
    this.moneyValue.textContent = formatMoneyAmount(money);
    this.moneyRoot.classList.toggle('is-negative', money < 0);
    this.moneyRoot.classList.toggle('has-net-worth', true);
    this.moneyRoot.setAttribute(
      'aria-label',
      `Cash ${formatMoneyAmount(money)}. Net worth ${formatMoneyAmount(displayedNetWorth)}.`
    );

    if (this.moneyNetWorth) {
      this.moneyNetWorth.textContent = `(${formatMoneyAmount(displayedNetWorth)})`;
      this.moneyNetWorth.classList.toggle('is-up', trendClass === 'is-up');
      this.moneyNetWorth.classList.toggle('is-down', trendClass === 'is-down');
      this.moneyNetWorth.classList.toggle('is-flat', trendClass === 'is-flat');
    }
  }

  setTaskState({ visible = false, title = '' } = {}) {
    if (!this.taskRoot || !this.taskTitle) {
      return;
    }

    const nextTitle = String(title ?? '').trim();
    const nextVisible = Boolean(visible && nextTitle);
    if (this.taskTransitioning) {
      this.pendingTaskState = { visible: nextVisible, title: nextTitle };
      return;
    }

    this.taskRoot.hidden = !nextVisible;
    if (this.taskTitle.textContent !== nextTitle) {
      this.taskTitle.textContent = nextTitle;
    }
  }

  playTaskCompletion({ visible = true, nextTitle = '', withConfetti = true } = {}) {
    if (!this.taskRoot || !this.taskTitle) {
      return;
    }

    const queuedTitle = String(nextTitle ?? '').trim();
    const queuedState = {
      visible: Boolean(visible && queuedTitle),
      title: queuedTitle
    };
    const currentTitle = String(this.taskTitle.textContent ?? '').trim();
    if (!currentTitle) {
      this.setTaskState(queuedState);
      return;
    }

    window.clearTimeout(this.taskCompleteTimeout);
    this.taskTransitioning = true;
    this.pendingTaskState = queuedState;
    this.taskRoot.hidden = false;
    this.taskRoot.classList.remove('is-completing');
    if (withConfetti) {
      this.spawnTaskConfetti();
    }
    void this.taskRoot.offsetWidth;
    this.taskRoot.classList.add('is-completing');

    this.taskCompleteTimeout = window.setTimeout(() => {
      const finalState = this.pendingTaskState ?? queuedState;
      this.taskTransitioning = false;
      this.pendingTaskState = null;
      this.taskRoot.classList.remove('is-completing');
      this.setTaskState(finalState);
    }, 760);
  }

  playTaskConfetti() {
    this.spawnTaskConfetti();
  }

  spawnTaskConfetti({
    originElement = this.taskRoot,
    originYRatio = 0.54,
    originSpread = null,
    particleCount = TASK_CONFETTI_PARTICLE_COUNT,
    colors = TASK_CONFETTI_COLORS
  } = {}) {
    if (!this.taskConfetti?.getContext) {
      return;
    }

    const originRect = originElement?.getBoundingClientRect?.();
    const originX = originRect ? originRect.left + (originRect.width * 0.5) : window.innerWidth * 0.5;
    const originY = originRect ? originRect.top + (originRect.height * originYRatio) : TASK_CONFETTI_DEFAULT_ORIGIN_Y;
    const resolvedOriginSpread = Math.min(
      Number(originSpread ?? originRect?.width ?? 220) || 220,
      TASK_CONFETTI_ORIGIN_SPREAD_MAX
    );
    const now = performance.now();

    this.ensureTaskConfettiCanvasSize();
    for (let index = 0; index < particleCount; index += 1) {
      this.taskConfettiParticles.push(createTaskConfettiParticle({
        index,
        now,
        originX,
        originY,
        originSpread: resolvedOriginSpread,
        colors
      }));
    }

    if (!this.taskConfettiFrame) {
      this.taskConfettiLastFrameAt = now;
      this.taskConfettiFrame = window.requestAnimationFrame((time) => this.updateTaskConfetti(time));
    }
  }

  ensureTaskConfettiCanvasSize() {
    const canvas = this.taskConfetti;
    if (!canvas?.getContext) {
      return null;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, TASK_CONFETTI_DPR_CAP);
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const pixelWidth = Math.ceil(width * dpr);
    const pixelHeight = Math.ceil(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { context, width, height };
  }

  updateTaskConfetti(frameAt = performance.now()) {
    const canvasState = this.ensureTaskConfettiCanvasSize();
    if (!canvasState) {
      this.taskConfettiFrame = 0;
      this.taskConfettiParticles = [];
      return;
    }

    const { context, width, height } = canvasState;
    const deltaSeconds = Math.min(
      TASK_CONFETTI_MAX_DELTA_SECONDS,
      Math.max(0.001, (frameAt - this.taskConfettiLastFrameAt) / 1000 || 0.016)
    );
    this.taskConfettiLastFrameAt = frameAt;
    context.clearRect(0, 0, width, height);

    const activeParticles = [];
    for (const particle of this.taskConfettiParticles) {
      const age = frameAt - particle.bornAt;
      if (age >= particle.lifetime || particle.y > height + TASK_CONFETTI_CANVAS_BOTTOM_PADDING) {
        continue;
      }

      const drag = Math.pow(particle.drag, deltaSeconds * 60);
      particle.vx *= drag;
      particle.vy = (particle.vy * drag) + (particle.gravity * deltaSeconds);
      const flutter = Math.sin(particle.flutterPhase + (age * particle.flutterSpeed * 0.01)) * particle.sway;
      particle.x += (particle.vx + flutter) * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.rotation += particle.rotationSpeed * deltaSeconds;

      const fadeIn = Math.min(1, age / TASK_CONFETTI_FADE_IN_MS);
      const fadeOut = Math.min(1, (particle.lifetime - age) / TASK_CONFETTI_FADE_OUT_MS);
      const alpha = particle.opacity * fadeIn * fadeOut;
      const flip = Math.max(0.16, Math.abs(Math.cos(age * particle.flipSpeed * 0.006)));

      context.save();
      context.globalAlpha = alpha;
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.scale(flip, 1);
      context.fillStyle = particle.color;
      if (particle.shape === 'circle') {
        context.beginPath();
        context.arc(0, 0, particle.width * 0.58, 0, Math.PI * 2);
        context.fill();
      } else if (particle.shape === 'streamer') {
        context.fillRect(-particle.width * 0.35, -particle.height * 1.05, particle.width * 0.7, particle.height * 2.1);
      } else {
        context.fillRect(-particle.width * 0.5, -particle.height * 0.5, particle.width, particle.height);
      }
      context.restore();

      activeParticles.push(particle);
    }

    this.taskConfettiParticles = activeParticles;
    if (activeParticles.length) {
      this.taskConfettiFrame = window.requestAnimationFrame((time) => this.updateTaskConfetti(time));
    } else {
      context.clearRect(0, 0, width, height);
      this.taskConfettiFrame = 0;
    }
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

  setMapCaptureState({
    visible = false,
    busy = false
  } = {}) {
    if (!this.mapCaptureToggle) {
      return;
    }

    this.mapCaptureToggle.hidden = !visible;
    this.mapCaptureToggle.disabled = Boolean(busy);
    this.mapCaptureToggle.classList.toggle('is-active', Boolean(busy));
    const label = busy ? 'Capturing phone map image' : 'Capture phone map image';
    this.mapCaptureToggle.setAttribute('aria-label', label);
    this.mapCaptureToggle.setAttribute('title', label);
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

  getCharacterSelectorPreviewMount() {
    return this.characterSelectorPreview ?? null;
  }

  getCarSelectorPreviewMount() {
    return this.carSelectorPreview ?? null;
  }

  getCarSelectorCardPreviewMount(itemId = '') {
    const selectorId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(String(itemId ?? ''))
      : String(itemId ?? '').replace(/["\\]/gu, '\\$&');
    return this.carSelectorGrid?.querySelector(`[data-car-preview-card="${selectorId}"]`) ?? null;
  }

  getCarDealerPreviewMount(itemId = '') {
    const selectorId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(String(itemId ?? ''))
      : String(itemId ?? '').replace(/["\\]/gu, '\\$&');
    return this.interactionActions?.querySelector(`[data-car-dealer-preview="${selectorId}"]`) ?? null;
  }

  getPhoneCharacterPreviewMount() {
    return this.phoneScreenContent?.querySelector('[data-phone-character-preview]') ?? null;
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

  setCarSelectorState({
    available = false,
    visible = false,
    selectedId = '',
    statusText = 'Currently selected',
    entries = [],
    loading = false
  } = {}) {
    if (!this.carSelectorRoot) {
      return;
    }

    const safeEntries = Array.isArray(entries) ? entries : [];
    const selectedEntry = safeEntries.find((entry) => entry.id === selectedId) ?? safeEntries[0] ?? null;
    const panelVisible = Boolean(available && visible);

    if (this.boundVehicleRoot) {
      this.boundVehicleRoot.classList.toggle('is-selector-open', panelVisible);
      this.boundVehicleRoot.setAttribute('aria-expanded', panelVisible ? 'true' : 'false');
      if (available) {
        this.boundVehicleRoot.title = panelVisible ? 'Hide vehicle selector' : 'Choose vehicle';
      }
    }

    this.carSelectorRoot.hidden = !panelVisible;
    this.carSelectorRoot.classList.toggle('is-visible', panelVisible);
    this.carSelectorRoot.classList.toggle('is-loading', Boolean(loading));

    if (this.carSelectorName) {
      this.carSelectorName.textContent = selectedEntry?.label ?? 'No Vehicle';
    }

    if (this.carSelectorSubtitle) {
      const count = safeEntries.length;
      this.carSelectorSubtitle.textContent = count === 1 ? '1 owned vehicle' : `${count} owned vehicles`;
    }

    if (this.carSelectorStatus) {
      this.carSelectorStatus.textContent = statusText;
    }

    if (this.carSelectorPreview && !selectedEntry) {
      this.carSelectorPreview.replaceChildren();
      this.carSelectorPreview.innerHTML = '<span class="hud__car-selector-empty">No vehicle</span>';
    }

    const signature = JSON.stringify(safeEntries.map((entry) => ({
      id: entry.id,
      label: entry.label,
      accent: entry.accent ?? '',
      selected: entry.id === selectedId
    })));
    if (this.carSelectorGrid && signature !== this.lastCarSelectorSignature) {
      this.lastCarSelectorSignature = signature;
      this.carSelectorGrid.innerHTML = safeEntries.length
        ? safeEntries.map((entry) => getCarSelectorCardMarkup({
            ...entry,
            selected: entry.id === selectedId
          })).join('')
        : '<p class="hud__body">No owned vehicles yet.</p>';
    }

    for (const button of this.carSelectorGrid?.querySelectorAll('[data-car-item-id]') ?? []) {
      const selected = button.dataset.carItemId === selectedId;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.disabled = Boolean(loading);
    }

    if (this.carSelectorPrev) {
      this.carSelectorPrev.disabled = Boolean(loading || safeEntries.length <= 1);
    }
    if (this.carSelectorNext) {
      this.carSelectorNext.disabled = Boolean(loading || safeEntries.length <= 1);
    }
  }

  setPhoneCharacterState({
    selectedId = '',
    entries = []
  } = {}) {
    const root = this.phoneScreenContent?.querySelector('[data-phone-character-app]');
    if (!root) {
      return;
    }

    const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;
    const status = root.querySelector('[data-phone-character-status]');

    if (status) {
      status.textContent = selectedEntry?.label ?? 'Character';
    }
  }

  getPhoneMissionIconMarkup(icon = '') {
    return PHONE_MISSION_ICON_ENTITIES[icon] ?? '&#9679;';
  }

  getPhoneMissionStatusMarkup(mission = {}) {
    if (mission.selected) {
      return '<span class="hud__phone-mission-status is-selected">Selected</span>';
    }

    if (mission.status === 'completed') {
      return '<span class="hud__phone-mission-status is-completed"><span aria-hidden="true">&#10003;</span> Done</span>';
    }

    if (mission.status === 'locked') {
      return '<span class="hud__phone-mission-status is-locked"><span aria-hidden="true">&#128274;</span> Locked</span>';
    }

    return `<span class="hud__phone-mission-status">${escapeHtml(PHONE_MISSION_STATUS_LABELS[mission.status] ?? 'Available')}</span>`;
  }

  getPhoneMissionRowMarkup(mission = {}, { current = false } = {}) {
    const status = String(mission.status ?? 'locked');
    const selectedClass = mission.selected ? ' is-selected' : '';
    const currentClass = current ? ' is-current' : '';
    const disabled = mission.selectable && !mission.selected ? '' : ' disabled';
    const title = mission.label || mission.title || 'Mission';
    const detail = mission.status === 'locked'
      ? (mission.requirement || 'Locked')
      : (mission.description || '');

    return `
      <button
        class="hud__phone-mission-row is-${escapeHtml(status)}${selectedClass}${currentClass}"
        type="button"
        data-phone-mission-id="${escapeHtml(mission.id ?? '')}"
        ${disabled}
      >
        <span class="hud__phone-mission-icon" aria-hidden="true">${this.getPhoneMissionIconMarkup(mission.icon)}</span>
        <span class="hud__phone-mission-copy">
          <span class="hud__phone-mission-title">${escapeHtml(title)}</span>
          <span class="hud__phone-mission-detail">${escapeHtml(detail)}</span>
        </span>
        ${this.getPhoneMissionStatusMarkup(mission)}
      </button>
    `;
  }

  setPhoneMissionsState({
    missions = [],
    selectedMissionId = ''
  } = {}) {
    const root = this.phoneScreenContent?.querySelector('[data-phone-missions-app]');
    if (!root) {
      return;
    }

    const safeMissions = Array.isArray(missions) ? missions : [];
    const signature = JSON.stringify(safeMissions.map((mission) => ({
      id: mission.id,
      title: mission.title,
      description: mission.description,
      requirement: mission.requirement,
      status: mission.status,
      selected: mission.selected,
      selectable: mission.selectable,
      icon: mission.icon
    })).concat([{ selectedMissionId }]));
    if (signature === this.lastPhoneMissionsSignature) {
      return;
    }
    this.lastPhoneMissionsSignature = signature;

    const selectedMission = safeMissions.find((mission) => mission.selected || mission.id === selectedMissionId) ?? null;
    const current = root.querySelector('[data-phone-missions-current]');
    const list = root.querySelector('[data-phone-missions-list]');
    const count = root.querySelector('[data-phone-missions-count]');

    const completedCount = safeMissions.filter((mission) => mission.status === 'completed').length;
    const availableCount = safeMissions.filter((mission) => (
      mission.status === 'available'
      || mission.status === 'inProgress'
    )).length;
    if (count) {
      count.textContent = `${completedCount}/${safeMissions.length} complete; ${availableCount} open`;
    }

    if (current) {
      current.innerHTML = selectedMission
        ? `
          <div class="hud__phone-missions-section-label">Current</div>
          ${this.getPhoneMissionRowMarkup(selectedMission, { current: true })}
        `
        : `
          <div class="hud__phone-missions-empty">
            <strong>No active mission</strong>
            <span>New objectives will appear here.</span>
          </div>
        `;
    }

    if (list) {
      list.innerHTML = `
        <div class="hud__phone-missions-section-label">All Missions</div>
        <div class="hud__phone-missions-scroll">
          ${safeMissions.map((mission) => this.getPhoneMissionRowMarkup(mission)).join('')}
        </div>
      `;
    }
  }

  getVibeRadioSelectedTrack(state = this.vibeRadioState) {
    const tracks = Array.isArray(state?.tracks) ? state.tracks : [];
    return tracks.find((track) => track.id === state?.selectedTrackId) ?? tracks[0] ?? null;
  }

  getVibeRadioStatusText(state = this.vibeRadioState) {
    if (state?.error) {
      return state.error;
    }

    const tracks = Array.isArray(state?.tracks) ? state.tracks : [];
    if (!tracks.length) {
      return 'No tracks';
    }

    return state?.playing ? 'Playing' : 'Paused';
  }

  updateVibeRadioWidget() {
    if (!this.vibeRadioWidget) {
      return;
    }

    const state = this.vibeRadioState;
    const tracks = Array.isArray(state.tracks) ? state.tracks : [];
    const selected = this.getVibeRadioSelectedTrack(state);
    const disabled = tracks.length === 0;
    const title = selected?.title ?? 'No track selected';
    const statusText = this.getVibeRadioStatusText(state);

    this.vibeRadioWidget.classList.toggle('is-playing', Boolean(state.playing));
    this.vibeRadioWidget.classList.toggle('is-empty', disabled);
    this.vibeRadioWidget.classList.toggle('has-error', Boolean(state.error));
    if (this.vibeRadioStatus) {
      this.vibeRadioStatus.textContent = statusText;
    }
    if (this.vibeRadioTitle) {
      this.vibeRadioTitle.textContent = title;
    }

    const controls = this.vibeRadioWidget.querySelector('.hud__vibe-radio-controls');
    if (controls) {
      const controlOptions = {
        context: 'main',
        playing: Boolean(state.playing),
        volume: state.volume,
        disabled
      };
      const controlsSignature = getVibeRadioControlsSignature(controlOptions);
      if (controls.dataset.vibeRadioControlsSignature !== controlsSignature) {
        controls.outerHTML = getVibeRadioControlsMarkup(controlOptions);
      } else {
        syncVibeRadioControlsElement(controls, controlOptions);
      }
    }
  }

  getPhoneVibeRadioTrackMarkup(track = {}, state = this.vibeRadioState) {
    const selected = track.id === state.selectedTrackId;
    const activeClass = selected ? ' is-active' : '';
    const playingClass = selected && state.playing ? ' is-playing' : '';
    const source = String(track.sourceUrl ?? '');
    const detail = source ? 'MP3 file' : 'No source';
    return `
      <button
        class="hud__phone-vibe-radio-track${activeClass}${playingClass}"
        type="button"
        data-phone-vibe-radio-track="${escapeHtml(track.id ?? '')}"
      >
        <span class="hud__phone-vibe-radio-art" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M9 18.5a2.5 2.5 0 1 1-1.5-2.3V6.75L17 5v11a2.5 2.5 0 1 1-1.5-2.3V8.15l-6 1.1v9.25Z" />
          </svg>
        </span>
        <span class="hud__phone-vibe-radio-track-copy">
          <strong>${escapeHtml(track.title ?? 'Untitled track')}</strong>
          <span>${escapeHtml(detail)}</span>
        </span>
        <span class="hud__phone-vibe-radio-track-state">${selected ? (state.playing ? 'On Air' : 'Selected') : 'Play'}</span>
      </button>
    `;
  }

  setPhoneVibeRadioState(state = this.vibeRadioState) {
    const root = this.phoneScreenContent?.querySelector('[data-phone-vibe-radio-app]');
    if (!root) {
      return;
    }

    const tracks = Array.isArray(state.tracks) ? state.tracks : [];
    const selected = this.getVibeRadioSelectedTrack(state);
    const disabled = tracks.length === 0;
    const status = root.querySelector('[data-phone-vibe-radio-status]');
    const now = root.querySelector('[data-phone-vibe-radio-now]');
    const list = root.querySelector('[data-phone-vibe-radio-list]');
    const controls = root.querySelector('[data-phone-vibe-radio-controls]');
    const safeCurrentTime = Math.max(0, Number(state.currentTime) || 0);
    const safeDuration = Math.max(0, Number(state.duration) || 0);
    const progress = safeDuration > 0 ? Math.min(1, safeCurrentTime / safeDuration) : 0;

    if (status) {
      status.textContent = this.getVibeRadioStatusText(state);
      status.classList.toggle('is-error', Boolean(state.error));
    }

    if (now) {
      now.innerHTML = selected
        ? `
          <div class="hud__phone-vibe-radio-cover" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 4.25a7.75 7.75 0 1 0 0 15.5 7.75 7.75 0 0 0 0-15.5Z" />
              <path d="M12 9.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" />
            </svg>
          </div>
          <div class="hud__phone-vibe-radio-now-copy">
            <span>${state.playing ? 'Now playing' : 'Selected'}</span>
            <strong>${escapeHtml(selected.title ?? 'Untitled track')}</strong>
            <div class="hud__phone-vibe-radio-progress" aria-label="${formatMediaTime(safeCurrentTime)} of ${safeDuration ? formatMediaTime(safeDuration) : 'unknown'}">
              <span style="--radio-progress:${(progress * 100).toFixed(1)}%"></span>
            </div>
            <em>${formatMediaTime(safeCurrentTime)} / ${safeDuration ? formatMediaTime(safeDuration) : '--:--'}</em>
          </div>
        `
        : `
          <div class="hud__phone-empty-state">Add tracks in the world builder.</div>
        `;
    }

    if (list) {
      const listSignature = JSON.stringify({
        tracks: tracks.map((track) => [
          track.id,
          track.title,
          track.sourceUrl
        ]),
        selectedTrackId: state.selectedTrackId,
        playing: Boolean(state.playing)
      });
      if (listSignature !== this.lastPhoneVibeRadioTrackListSignature) {
        this.lastPhoneVibeRadioTrackListSignature = listSignature;
        list.innerHTML = tracks.length
          ? tracks.map((track) => this.getPhoneVibeRadioTrackMarkup(track, state)).join('')
          : '<div class="hud__phone-empty-state">No songs in Vibe Radio.</div>';
      }
    }

    if (controls) {
      const controlOptions = {
        context: 'phone',
        playing: Boolean(state.playing),
        volume: state.volume,
        disabled
      };
      const controlsSignature = getVibeRadioControlsSignature(controlOptions);
      if (controls.dataset.vibeRadioControlsSignature !== controlsSignature) {
        controls.dataset.vibeRadioControlsSignature = controlsSignature;
        controls.innerHTML = getVibeRadioControlsMarkup(controlOptions);
      } else {
        syncVibeRadioControlsElement(controls, controlOptions);
      }
    }
  }

  setVibeRadioState({
    tracks = this.vibeRadioState.tracks,
    selectedTrackId = this.vibeRadioState.selectedTrackId,
    playing = this.vibeRadioState.playing,
    volume = this.vibeRadioState.volume,
    currentTime = this.vibeRadioState.currentTime,
    duration = this.vibeRadioState.duration,
    error = this.vibeRadioState.error
  } = {}) {
    this.vibeRadioState = {
      tracks: Array.isArray(tracks) ? tracks : [],
      selectedTrackId: String(selectedTrackId ?? ''),
      playing: Boolean(playing),
      volume: Math.max(0, Math.min(1, Number(volume) || 0)),
      currentTime: Math.max(0, Number(currentTime) || 0),
      duration: Math.max(0, Number(duration) || 0),
      error: String(error ?? '')
    };
    this.updateVibeRadioWidget();
    this.setPhoneVibeRadioState(this.vibeRadioState);
  }

  getPhoneSkillIconMarkup(icon = '') {
    return PHONE_SKILL_ICON_ENTITIES[icon] ?? '&#9679;';
  }

  setPhoneSkillsState({
    skills = [],
    recentAward = null
  } = {}) {
    const root = this.phoneScreenContent?.querySelector('[data-phone-skills-app]');
    if (!root) {
      return;
    }

    const safeSkills = Array.isArray(skills) ? skills : [];
    const signature = JSON.stringify({
      skills: safeSkills.map((skill) => ({
        id: skill.id,
        xp: skill.xp,
        level: skill.level,
        progress: skill.progress
      })),
      recentAwardSeq: recentAward?.seq ?? 0
    });
    if (signature === this.lastPhoneSkillsSignature) {
      return;
    }
    this.lastPhoneSkillsSignature = signature;

    const summary = root.querySelector('[data-phone-skills-summary]');
    const list = root.querySelector('[data-phone-skills-list]');
    const totalLevel = safeSkills.reduce((total, skill) => total + (Number(skill.level) || 1), 0);
    if (summary) {
      summary.textContent = `${safeSkills.length} skills | total ${totalLevel || safeSkills.length}`;
    }

    if (!list) {
      return;
    }

    list.innerHTML = safeSkills.length
      ? safeSkills.map((skill) => {
          const progress = Math.max(0, Math.min(1, Number(skill.progress ?? 0)));
          const maxed = Number(skill.level ?? 1) >= Number(skill.maxLevel ?? 99);
          const recent = recentAward?.skillId === skill.id ? ' is-recent' : '';
          return `
            <article class="hud__phone-skill-card${maxed ? ' is-maxed' : ''}${recent}" style="--skill-accent:${escapeHtml(skill.accent ?? '#68e08f')}">
              <div class="hud__phone-skill-icon" aria-hidden="true">${this.getPhoneSkillIconMarkup(skill.icon)}</div>
              <div class="hud__phone-skill-copy">
                <div class="hud__phone-skill-title">
                  <strong>${escapeHtml(skill.label ?? 'Skill')}</strong>
                  <span>${escapeHtml(String(skill.level ?? 1))}/${escapeHtml(String(skill.maxLevel ?? 99))}</span>
                </div>
                <div class="hud__phone-skill-progress" aria-hidden="true">
                  <span style="--skill-progress:${(progress * 100).toFixed(1)}%"></span>
                </div>
                <p>${maxed
                  ? 'Max level reached'
                  : `${formatHudCount(skill.xpToNextLevel ?? 0)} XP to next`}</p>
              </div>
            </article>
          `;
        }).join('')
      : '<div class="hud__phone-empty-state">Skills are syncing.</div>';
  }

  setPhoneStocksState({
    market = null,
    selectedSymbol = '',
    quantity = 1,
    loading = false,
    error = ''
  } = {}) {
    const root = this.phoneScreenContent?.querySelector('[data-phone-stocks-app]');
    if (!root) {
      return;
    }

    const safeMarket = market && typeof market === 'object' ? market : null;
    const stocks = Array.isArray(safeMarket?.stocks) ? safeMarket.stocks : [];
    const safeQuantity = normalizeStockTradeQuantity(quantity);
    const selected = stocks.find((stock) => stock.symbol === selectedSymbol) ?? stocks[0] ?? null;
    const resolvedSelectedSymbol = selected?.symbol ?? '';
    const signature = JSON.stringify({
      selectedSymbol: resolvedSelectedSymbol,
      quantity: safeQuantity,
      loading: Boolean(loading),
      error,
      updatedAt: safeMarket?.updatedAt ?? 0,
      cash: safeMarket?.cash ?? 0,
      portfolioValue: safeMarket?.portfolioValue ?? 0,
      netWorth: safeMarket?.netWorth ?? 0,
      stocks: stocks.map((stock) => [
        stock.symbol,
        stock.price,
        stock.delta,
        stock.deltaPercent,
        stock.shares,
        stock.marketValue,
        stock.unrealizedProfit
      ])
    });
    if (signature === this.lastPhoneStocksSignature) {
      return;
    }
    this.lastPhoneStocksSignature = signature;

    const status = root.querySelector('[data-phone-stocks-status]');
    const summary = root.querySelector('[data-phone-stocks-summary]');
    const chart = root.querySelector('[data-phone-stocks-chart]');
    const list = root.querySelector('[data-phone-stocks-list]');
    const detail = root.querySelector('[data-phone-stocks-detail]');
    const quantityInput = root.querySelector('[data-phone-stock-quantity]');
    const buyButton = root.querySelector('[data-phone-stock-trade="buy"]');
    const sellButton = root.querySelector('[data-phone-stock-trade="sell"]');
    const refreshButton = root.querySelector('[data-phone-stocks-refresh]');
    const updatedAt = Number(safeMarket?.updatedAt ?? 0);
    const updatedLabel = updatedAt
      ? new Date(updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : '';
    const statusText = loading
      ? 'Syncing tape'
      : error
        ? error
        : `${safeMarket?.marketMood ?? 'Market open'}${updatedLabel ? ` | ${updatedLabel}` : ''}`;

    if (status) {
      status.textContent = statusText;
      status.classList.toggle('is-error', Boolean(error));
    }
    if (refreshButton) {
      refreshButton.disabled = Boolean(loading);
    }
    if (summary) {
      summary.innerHTML = `
        <div>
          <span>Cash</span>
          <strong>${formatMoneyAmount(safeMarket?.cash ?? 0)}</strong>
        </div>
        <div>
          <span>Holdings</span>
          <strong>${formatMoneyAmount(safeMarket?.portfolioValue ?? 0)}</strong>
        </div>
        <div>
          <span>Net Worth</span>
          <strong>${formatMoneyAmount(safeMarket?.netWorth ?? safeMarket?.cash ?? 0)}</strong>
        </div>
      `;
    }
    if (chart) {
      chart.innerHTML = stocks.length
        ? createAllStockChartMarkup(stocks, resolvedSelectedSymbol, { layout: 'phone' })
        : '<div class="hud__phone-empty-state">Market tape is syncing.</div>';
    }
    if (list) {
      list.innerHTML = stocks.length
        ? stocks.map((stock) => {
            const trendClass = getStockTrendClass(stock.delta);
            const activeClass = stock.symbol === resolvedSelectedSymbol ? ' is-active' : '';
            return `
              <button
                class="hud__phone-stock-chip ${trendClass}${activeClass}"
                type="button"
                data-phone-stock-symbol="${escapeHtml(stock.symbol)}"
                style="--stock-accent:${escapeHtml(stock.accent ?? '#f2c871')}"
              >
                ${createStockIconMarkup(stock, 'is-mini')}
                <span>
                  <strong>${escapeHtml(stock.symbol)}</strong>
                  <em>${formatStockMoney(stock.price)}</em>
                </span>
              </button>
            `;
          }).join('')
        : '<div class="hud__phone-empty-state">No stocks listed.</div>';
    }

    if (quantityInput instanceof HTMLInputElement && document.activeElement !== quantityInput) {
      quantityInput.value = String(safeQuantity);
    }

    if (!selected) {
      if (detail) {
        detail.innerHTML = '<div class="hud__phone-empty-state">Pick a stock.</div>';
      }
      if (buyButton) {
        buyButton.disabled = true;
        buyButton.textContent = 'Buy';
      }
      if (sellButton) {
        sellButton.disabled = true;
        sellButton.textContent = 'Sell';
      }
      return;
    }

    const trendClass = getStockTrendClass(selected.delta);
    const tradeValue = getStockTradeValue(selected.price, safeQuantity);
    const buyDisabled = loading || Number(safeMarket?.cash ?? 0) < tradeValue;
    const sellDisabled = loading || Number(selected.shares ?? 0) < safeQuantity;
    if (buyButton) {
      buyButton.disabled = buyDisabled;
      buyButton.textContent = `Buy ${formatMoneyAmount(tradeValue)}`;
    }
    if (sellButton) {
      sellButton.disabled = sellDisabled;
      sellButton.textContent = `Sell ${formatMoneyAmount(tradeValue)}`;
    }
    if (detail) {
      detail.innerHTML = `
        <div class="hud__phone-stock-detail-head" style="--stock-accent:${escapeHtml(selected.accent ?? '#f2c871')}">
          ${createStockIconMarkup(selected, 'is-row')}
          <div>
            <span>${escapeHtml(selected.symbol)}</span>
            <strong>${escapeHtml(selected.name)}</strong>
            <em>${escapeHtml(selected.sector)} | ${escapeHtml(selected.modeLabel ?? 'Sideways')}</em>
          </div>
          <div class="hud__phone-stock-price ${trendClass}">
            <strong>${formatStockMoney(selected.price)}</strong>
            <span>${formatStockPercent(selected.deltaPercent)}</span>
          </div>
        </div>
        <div class="hud__phone-stock-position">
          <div>
            <span>Owned</span>
            <strong>${formatHudCount(selected.shares)}</strong>
          </div>
          <div>
            <span>Average</span>
            <strong>${formatStockMoney(selected.averageCost)}</strong>
          </div>
          <div>
            <span>Value</span>
            <strong>${formatMoneyAmount(selected.marketValue)}</strong>
          </div>
          <div class="${getStockTrendClass(selected.unrealizedProfit)}">
            <span>P/L</span>
            <strong>${formatSignedStockMoney(selected.unrealizedProfit)}</strong>
          </div>
        </div>
      `;
    }
  }

  setPhoneWalletState({
    wallet = null,
    cash = 0,
    loading = false,
    error = ''
  } = {}) {
    const root = this.phoneScreenContent?.querySelector('[data-phone-wallet-app]');
    if (!root) {
      return;
    }

    const safeWallet = wallet && typeof wallet === 'object' ? wallet : null;
    const holdings = (safeWallet?.stocks ?? []).filter((stock) => Number(stock.shares ?? 0) > 0);
    const signature = JSON.stringify({
      cash,
      loading,
      error,
      portfolioValue: safeWallet?.portfolioValue ?? 0,
      netWorth: safeWallet?.netWorth ?? cash,
      holdings: holdings.map((stock) => [stock.symbol, stock.shares, stock.marketValue, stock.unrealizedProfit])
    });
    if (signature === this.lastPhoneWalletSignature) {
      return;
    }
    this.lastPhoneWalletSignature = signature;

    const status = root.querySelector('[data-phone-wallet-status]');
    const cashNode = root.querySelector('[data-phone-wallet-cash]');
    const stats = root.querySelector('[data-phone-wallet-stats]');
    const holdingsNode = root.querySelector('[data-phone-wallet-holdings]');
    const stocksButton = root.querySelector('[data-phone-wallet-stocks]');

    if (status) {
      status.textContent = loading
        ? 'Syncing'
        : error
          ? error
          : 'Wallet synced';
      status.classList.toggle('is-error', Boolean(error));
    }
    if (cashNode) {
      cashNode.textContent = formatMoneyAmount(safeWallet?.cash ?? cash);
    }
    if (stats) {
      stats.innerHTML = `
        <div><span>Portfolio</span><strong>${formatMoneyAmount(safeWallet?.portfolioValue ?? 0)}</strong></div>
        <div><span>Net Worth</span><strong>${formatMoneyAmount(safeWallet?.netWorth ?? cash)}</strong></div>
      `;
    }
    if (holdingsNode) {
      holdingsNode.innerHTML = `
        <div class="hud__phone-wallet-section-label">Holdings</div>
        <div class="hud__phone-wallet-holding-list">
          ${holdings.length
            ? holdings.map((stock) => `
              <div class="hud__phone-wallet-holding" style="--stock-accent:${escapeHtml(stock.accent ?? '#f2c871')}">
                ${createStockIconMarkup(stock, 'is-mini')}
                <div>
                  <strong>${escapeHtml(stock.symbol)}</strong>
                  <span>${formatHudCount(stock.shares)} shares</span>
                </div>
                <div class="${getStockTrendClass(stock.unrealizedProfit)}">
                  <strong>${formatMoneyAmount(stock.marketValue)}</strong>
                  <span>${formatSignedStockMoney(stock.unrealizedProfit)}</span>
                </div>
              </div>
            `).join('')
            : '<div class="hud__phone-empty-state">No holdings yet.</div>'}
        </div>
      `;
    }
    if (stocksButton) {
      stocksButton.disabled = loading;
      stocksButton.textContent = loading
        ? 'Syncing'
        : 'Stocks';
    }
  }

  setPhoneSettingsState({
    masterVolume = 0.82
  } = {}) {
    const root = this.phoneScreenContent?.querySelector('[data-phone-settings-app]');
    if (!root) {
      return;
    }

    const volume = Math.max(0, Math.min(1, Number(masterVolume) || 0));
    const slider = root.querySelector('[data-phone-setting-audio]');
    const value = root.querySelector('[data-phone-setting-audio-value]');
    if (slider && document.activeElement !== slider) {
      slider.value = String(Math.round(volume * 100));
    }
    if (value) {
      value.textContent = `${Math.round(volume * 100)}%`;
    }
  }

  setPhoneMapState({
    player = null,
    features = [],
    image = null,
    zoom = 1,
    minZoom = 1,
    maxZoom = 4,
    pan = { x: 0, z: 0 }
  } = {}) {
    const root = this.phoneScreenContent?.querySelector('[data-phone-map-app]');
    if (!root) {
      return;
    }

    const safeFeatures = Array.isArray(features) ? features : [];
    const imageBounds = image?.bounds ?? null;
    const hasImage = Boolean(
      image?.src
      && Number.isFinite(Number(imageBounds?.minX))
      && Number.isFinite(Number(imageBounds?.maxX))
      && Number.isFinite(Number(imageBounds?.minZ))
      && Number.isFinite(Number(imageBounds?.maxZ))
      && Number(imageBounds.maxX) > Number(imageBounds.minX)
      && Number(imageBounds.maxZ) > Number(imageBounds.minZ)
    );
    const signature = JSON.stringify({
      player,
      zoom,
      pan: [pan?.x ?? 0, pan?.z ?? 0],
      image: hasImage ? [image.src, imageBounds.minX, imageBounds.maxX, imageBounds.minZ, imageBounds.maxZ] : null,
      features: safeFeatures.map((feature) => [feature.id, feature.kind, feature.label, feature.x, feature.z, feature.width, feature.depth])
    });
    if (signature === this.lastPhoneMapSignature) {
      return;
    }
    this.lastPhoneMapSignature = signature;

    const status = root.querySelector('[data-phone-map-status]');
    const canvas = root.querySelector('[data-phone-map-canvas]');
    const zoomLabel = root.querySelector('[data-phone-map-zoom-label]');
    const zoomInButton = root.querySelector('[data-phone-map-zoom-in]');
    const zoomOutButton = root.querySelector('[data-phone-map-zoom-out]');
    const safeMinZoom = Math.max(1, Number(minZoom) || 1);
    const safeMaxZoom = Math.max(safeMinZoom, Number(maxZoom) || safeMinZoom);
    const safeZoom = Math.max(safeMinZoom, Math.min(safeMaxZoom, Number(zoom) || safeMinZoom));
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round((safeZoom / safeMinZoom) * 100)}%`;
    }
    if (zoomInButton) {
      zoomInButton.disabled = safeZoom >= safeMaxZoom - 0.001;
    }
    if (zoomOutButton) {
      zoomOutButton.disabled = safeZoom <= safeMinZoom + 0.001;
    }
    if (status) {
      status.textContent = hasImage
        ? (player ? 'Satellite map' : 'Satellite cached')
        : (player ? 'Live location' : 'Locating');
    }
    if (!canvas) {
      return;
    }

    const points = [
      ...safeFeatures.map((feature) => ({ x: Number(feature.x), z: Number(feature.z) })),
      player ? { x: Number(player.x), z: Number(player.z) } : null
    ].filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.z));

    if (!points.length && !hasImage) {
      canvas.innerHTML = '<div class="hud__phone-empty-state">Map data is syncing.</div>';
      return;
    }

    const width = 280;
    const height = 430;
    const minX = hasImage ? Number(imageBounds.minX) : Math.min(...points.map((point) => point.x)) - 8;
    const maxX = hasImage ? Number(imageBounds.maxX) : Math.max(...points.map((point) => point.x)) + 8;
    const minZ = hasImage ? Number(imageBounds.minZ) : Math.min(...points.map((point) => point.z)) - 8;
    const maxZ = hasImage ? Number(imageBounds.maxZ) : Math.max(...points.map((point) => point.z)) + 8;
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);
    const viewSpanX = spanX / safeZoom;
    const viewSpanZ = spanZ / safeZoom;
    const preferredCenterX = (Number.isFinite(Number(player?.x)) ? Number(player.x) : (minX + maxX) * 0.5) + (Number(pan?.x) || 0);
    const preferredCenterZ = (Number.isFinite(Number(player?.z)) ? Number(player.z) : (minZ + maxZ) * 0.5) + (Number(pan?.z) || 0);
    const clampCenter = (value, min, max, viewSpan) => {
      if (viewSpan >= max - min) {
        return (min + max) * 0.5;
      }
      const halfSpan = viewSpan * 0.5;
      return Math.max(min + halfSpan, Math.min(max - halfSpan, value));
    };
    const viewCenterX = clampCenter(preferredCenterX, minX, maxX, viewSpanX);
    const viewCenterZ = clampCenter(preferredCenterZ, minZ, maxZ, viewSpanZ);
    const viewMinX = viewCenterX - viewSpanX * 0.5;
    const viewMinZ = viewCenterZ - viewSpanZ * 0.5;
    const toX = (x) => ((x - viewMinX) / viewSpanX) * width;
    const toY = (z) => ((z - viewMinZ) / viewSpanZ) * height;
    const rasterMarkup = hasImage
      ? `<image class="hud__phone-map-raster" href="${escapeHtml(image.src)}" x="${(((minX - viewMinX) / viewSpanX) * width).toFixed(1)}" y="${(((minZ - viewMinZ) / viewSpanZ) * height).toFixed(1)}" width="${((spanX / viewSpanX) * width).toFixed(1)}" height="${((spanZ / viewSpanZ) * height).toFixed(1)}" preserveAspectRatio="none"></image>`
      : '';
    const featureMarkup = safeFeatures.map((feature) => {
      const kind = escapeHtml(feature.kind ?? 'building');
      const x = toX(Number(feature.x));
      const y = toY(Number(feature.z));
      if (['shady', 'stock', 'blackjack', 'workout'].includes(feature.kind)) {
        const label = String(feature.label ?? '').trim();
        const tooltip = feature.kind === 'stock'
          ? 'Stock broker'
          : feature.kind === 'blackjack'
            ? 'Blackjack dealer'
            : feature.kind === 'workout'
              ? `Workout station${label ? `: ${label}` : ''}`
              : 'Shady Figure';
        const markerIcon = feature.kind === 'stock'
          ? '$'
          : feature.kind === 'blackjack'
            ? 'J'
            : feature.kind === 'workout'
              ? 'S'
              : '?';
        return `
          <g class="hud__phone-map-marker is-${kind}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" tabindex="0" role="button" aria-label="${escapeHtml(tooltip)}" data-phone-map-tooltip="${escapeHtml(tooltip)}" data-phone-map-tooltip-icon="${escapeHtml(markerIcon)}" data-phone-map-tooltip-kind="${kind}">
            <circle r="6"></circle>
            <text y="-9">${escapeHtml(markerIcon)}</text>
          </g>
        `;
      }
      if (hasImage) {
        return '';
      }
      const w = Math.max(3, (Number(feature.width ?? 1) / viewSpanX) * width);
      const h = Math.max(3, (Number(feature.depth ?? 1) / viewSpanZ) * height);
      return `<rect class="hud__phone-map-feature is-${kind}" x="${(x - w / 2).toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2"></rect>`;
    }).join('');

    const playerMarkup = player
      ? `
        <g class="hud__phone-map-player" transform="translate(${toX(Number(player.x)).toFixed(1)} ${toY(Number(player.z)).toFixed(1)}) rotate(${((Number(player.rotationY) || 0) * 180 / Math.PI).toFixed(1)})" tabindex="0" role="button" aria-label="You" data-phone-map-tooltip="You" data-phone-map-tooltip-icon="YOU" data-phone-map-tooltip-kind="player">
          <circle r="8"></circle>
          <path d="M0 -15 5 -3 -5 -3Z"></path>
        </g>
      `
      : '';

    canvas.innerHTML = `
      <svg class="hud__phone-map-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="City map">
        <rect class="hud__phone-map-bg" width="${width}" height="${height}" rx="18"></rect>
        ${rasterMarkup}
        ${featureMarkup}
        ${playerMarkup}
      </svg>
    `;
  }

  showSkillLevelUp({
    skill = {},
    oldLevel = 1,
    newLevel = 1
  } = {}) {
    if (!this.skillLevelUpRoot) {
      return;
    }

    window.clearTimeout(this.skillLevelUpTimeout);
    this.skillLevelUpRoot.hidden = false;
    this.skillLevelUpRoot.style.setProperty('--skill-accent', skill.accent ?? '#68e08f');
    if (this.skillLevelUpIcon) {
      this.skillLevelUpIcon.innerHTML = this.getPhoneSkillIconMarkup(skill.icon);
    }
    if (this.skillLevelUpTitle) {
      this.skillLevelUpTitle.textContent = `${skill.label ?? 'Skill'} Level ${newLevel}`;
    }
    if (this.skillLevelUpSubtitle) {
      this.skillLevelUpSubtitle.textContent = `Level ${oldLevel} -> ${newLevel}`;
    }
    this.skillLevelUpRoot.classList.remove('is-active');
    void this.skillLevelUpRoot.offsetWidth;
    this.skillLevelUpRoot.classList.add('is-active');
    this.spawnTaskConfetti({
      originElement: this.skillLevelUpRoot,
      originYRatio: 0.42,
      originSpread: 320,
      particleCount: 240,
      colors: [
        skill.accent ?? '#58b8ff',
        '#58b8ff',
        '#9ce9ff',
        '#ffffff',
        '#f7d86a'
      ]
    });
    this.skillLevelUpTimeout = window.setTimeout(() => {
      this.skillLevelUpRoot?.classList.remove('is-active');
      if (this.skillLevelUpRoot) {
        this.skillLevelUpRoot.hidden = true;
      }
    }, 3000);
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
    phoneGripValues = {},
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

    for (const field of PHONE_GRIP_DEBUG_FIELDS) {
      const value = Number(phoneGripValues?.[field.key] ?? 0);
      const precision = Number.isInteger(field.precision) ? field.precision : 3;
      const fallbackValue = (0).toFixed(precision);
      const formattedValue = Number.isFinite(value) ? value.toFixed(precision) : fallbackValue;
      const inputs = this.phoneGripDebugInputs.get(field.key);
      setFieldValue(inputs?.range, formattedValue);
      setFieldValue(inputs?.number, formattedValue);
    }
  }

  setShaderDebugState({
    available = false,
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

    const panelVisible = Boolean(available && visible);
    this.shaderDebugRoot.hidden = !panelVisible;
    this.shaderDebugRoot.classList.toggle('is-visible', panelVisible);
    this.shaderDebugStatus.textContent = statusText;

    if (this.shaderDebugToggle) {
      this.shaderDebugToggle.hidden = !available;
      const highlightToggle = panelVisible || (available && intensityEnabled);
      this.shaderDebugToggle.classList.toggle('is-active', highlightToggle);
      this.shaderDebugToggle.setAttribute('aria-pressed', panelVisible ? 'true' : 'false');
      this.shaderDebugToggle.title = panelVisible ? 'Hide shader vibe menu' : 'Show shader vibe menu';
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
    const activeIds = this.speechBubbleActiveIds;
    activeIds.clear();

    for (const bubble of bubbles) {
      if (!bubble?.id || !bubble.visible) {
        continue;
      }

      activeIds.add(bubble.id);
      let node = this.speechBubbleNodes.get(bubble.id);
      let labelNode = this.speechBubbleLabelNodes.get(bubble.id) ?? null;
      let textNode = this.speechBubbleTextNodes.get(bubble.id) ?? null;
      if (!node || !labelNode || !textNode) {
        node?.remove();
        node = document.createElement('article');
        node.className = 'hud__speech-bubble';

        labelNode = document.createElement('p');
        labelNode.className = 'hud__speech-label';

        textNode = document.createElement('p');
        textNode.className = 'hud__speech-text';

        node.append(labelNode, textNode);
        this.speechLayer.append(node);
        this.speechBubbleNodes.set(bubble.id, node);
        this.speechBubbleLabelNodes.set(bubble.id, labelNode);
        this.speechBubbleTextNodes.set(bubble.id, textNode);
      }

      node.classList.toggle('is-self', bubble.variant === 'self');
      node.classList.toggle('is-npc', bubble.variant === 'npc');
      node.classList.toggle('is-player', bubble.variant === 'player');
      node.classList.toggle('is-interaction', bubble.variant === 'interaction');
      node.classList.toggle('is-money', bubble.variant === 'money');
      node.classList.toggle('is-money-positive', bubble.variant === 'money' && bubble.tone === 'positive');
      node.classList.toggle('is-money-negative', bubble.variant === 'money' && bubble.tone === 'negative');
      node.classList.toggle('is-xp', bubble.variant === 'xp');
      node.classList.toggle('is-thinking', bubble.status === 'thinking');
      node.style.left = `${bubble.screenX}px`;
      node.style.top = `${bubble.screenY}px`;
      node.style.opacity = Number.isFinite(Number(bubble.opacity)) ? String(bubble.opacity) : '';

      if (labelNode) {
        labelNode.textContent = bubble.label ?? '';
        labelNode.hidden = !bubble.label;
      }
      if (textNode) {
        const bubbleText = bubble.status === 'thinking' ? '' : (bubble.text ?? '');
        textNode.textContent = bubble.chirp === true
          ? this.npcSpeechPlayback.updateBubble({
              id: bubble.id,
              text: bubbleText,
              status: bubble.status,
              voice: bubble.voice,
              speakerKey: bubble.speakerKey ?? bubble.modelId ?? bubble.label ?? bubble.id,
              volumeScale: bubble.voiceVolumeScale
            })
          : bubbleText;
      }
    }

    for (const [id, node] of this.speechBubbleNodes.entries()) {
      if (activeIds.has(id)) {
        continue;
      }

      node.remove();
      this.speechBubbleNodes.delete(id);
      this.speechBubbleLabelNodes.delete(id);
      this.speechBubbleTextNodes.delete(id);
    }
    this.npcSpeechPlayback.disposeMissing(activeIds);
  }

  setOverheadHealthBars(bars = []) {
    const activeIds = this.overheadHealthBarActiveIds;
    activeIds.clear();

    for (const bar of bars) {
      if (!bar?.id || !bar.visible) {
        continue;
      }

      activeIds.add(bar.id);
      let node = this.overheadHealthBarNodes.get(bar.id);
      let fillNode = this.overheadHealthBarFillNodes.get(bar.id) ?? null;
      if (!node || !fillNode) {
        node?.remove();
        node = document.createElement('div');
        node.className = 'hud__overhead-health';
        node.setAttribute('aria-hidden', 'true');

        const track = document.createElement('div');
        track.className = 'hud__overhead-health-track';

        fillNode = document.createElement('div');
        fillNode.className = 'hud__overhead-health-fill';

        track.append(fillNode);
        node.append(track);
        this.overheadHealthLayer?.append(node);
        this.overheadHealthBarNodes.set(bar.id, node);
        this.overheadHealthBarFillNodes.set(bar.id, fillNode);
      }

      const healthRatio = Math.max(0, Math.min(1, Number(bar.healthRatio) || 0));
      const healthPercent = Math.round(healthRatio * 100);
      const fillHue = Math.round(healthRatio * 120);

      node.classList.toggle('is-self', bar.variant === 'self');
      node.classList.toggle('is-player', bar.variant === 'player');
      node.classList.toggle('is-npc', bar.variant === 'npc');
      node.classList.toggle('is-critical', healthRatio <= 0.25);
      node.style.left = `${bar.screenX}px`;
      node.style.top = `${bar.screenY}px`;
      node.title = `${bar.health} / ${bar.maxHealth}`;
      fillNode.style.width = `${healthPercent}%`;
      fillNode.style.background = `linear-gradient(90deg, hsl(${fillHue} 82% 44%), hsl(${Math.min(120, fillHue + 12)} 96% 58%))`;
    }

    for (const [id, node] of this.overheadHealthBarNodes.entries()) {
      if (activeIds.has(id)) {
        continue;
      }

      node.remove();
      this.overheadHealthBarNodes.delete(id);
      this.overheadHealthBarFillNodes.delete(id);
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
