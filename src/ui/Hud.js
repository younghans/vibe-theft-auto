import { EMOTE_SLOTS } from '../player/emotes.js';
import { WEAPON_CLIP_SIZE } from '../shared/combatConstants.js';
import { HELD_ITEM_AIM_POSE_FIELDS } from '../shared/heldItemDefinitions.js';
import { BLACKJACK_DEFAULT_WAGER } from '../shared/blackjack.js';
import { escapeHtml } from '../shared/htmlEscape.js';
import { getStockTradeValue } from '../shared/stockMarket.js';

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

const PHONE_APPS = Object.freeze([
  ['messages', 'Messages', 'messages', '#30d66a', 'Story texts will appear here.'],
  ['map', 'Map', 'map', '#3aa4ff', 'A portable city map and waypoint list will live here.'],
  ['missions', 'Missions', 'missions', '#f2ba45', 'Active objectives, rewards, and progress will be grouped here.'],
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
  wallet: '<path d="M4 7.5h13.75A2.25 2.25 0 0 1 20 9.75v7A2.25 2.25 0 0 1 17.75 19H5.25A2.25 2.25 0 0 1 3 16.75v-8A1.25 1.25 0 0 1 4.25 7.5Z"/><path d="M4.75 7.5 15.5 4.85a1.7 1.7 0 0 1 2.1 1.65v1"/><path d="M16.5 12.25h3.5v3.5h-3.5a1.75 1.75 0 1 1 0-3.5Z"/>',
  stocks: '<path d="M4.5 19.25h15"/><path d="M5.75 16.5l4.1-4.1 3.25 2.7 5.6-7.35"/><path d="M16.25 7.75h2.45v2.45"/><path d="M6 7.75h2.2M6 10.8h2.2M6 13.85h1.1"/>',
  skills: '<path d="M5.5 18.75h13"/><path d="M7 17V9.8M12 17V5.25M17 17v-4.7"/><path d="M7 9.8l2.3 1.55L12 5.25l2.6 7.05L17 12.3"/><path d="M4.7 6.2 6 4.9l1.3 1.3M17.1 7.1l1.5-1.5 1.5 1.5"/>',
  character: '<path d="M8.35 9.15a3.65 3.65 0 1 0 7.3 0 3.65 3.65 0 0 0-7.3 0Z"/><path d="M5.25 19.25c.95-2.75 3.45-4.55 6.75-4.55s5.8 1.8 6.75 4.55"/><path d="M4.5 6.25 6.25 4.5 8 6.25"/><path d="M6.25 4.5v4.25"/><path d="m19.5 17.75-1.75 1.75-1.75-1.75"/><path d="M17.75 15.25v4.25"/>',
  settings: '<path d="M10.25 4.75h3.5l.45 2.1c.5.18.98.44 1.42.75l2.02-.68 1.75 3.03-1.58 1.42c.04.26.06.53.06.8s-.02.54-.06.8l1.58 1.42-1.75 3.03-2.02-.68c-.44.31-.92.57-1.42.75l-.45 2.1h-3.5l-.45-2.1a6.18 6.18 0 0 1-1.42-.75l-2.02.68-1.75-3.03 1.58-1.42a5.58 5.58 0 0 1-.06-.8c0-.27.02-.54.06-.8L4.61 9.95l1.75-3.03 2.02.68c.44-.31.92-.57 1.42-.75l.45-2.1Z"/><path d="M9.5 12.17a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z"/>'
});

const PHONE_SKILL_ICON_ENTITIES = Object.freeze({
  strength: '&#127947;',
  agility: '&#127939;',
  intelligence: '&#129504;'
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
  muscle: '&#128170;',
  chart: '&#128200;',
  'playing-card': '&#127183;'
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
          <input type="number" min="1" max="999" step="1" value="1" data-phone-stock-quantity />
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

function createBlackjackCardMarkup(card = {}, index = 0) {
  if (card?.hidden) {
    return `
      <span class="hud__blackjack-card is-hidden-card" style="--card-index:${index}">
        <span class="hud__blackjack-card-back"></span>
      </span>
    `;
  }

  const rank = escapeHtml(card?.rank ?? '?');
  const suit = String(card?.suit ?? '');
  const redClass = suit === 'H' || suit === 'D' ? ' is-red' : '';
  const suitSymbol = getBlackjackSuitSymbol(suit);
  return `
    <span
      class="hud__blackjack-card${redClass}"
      style="--card-index:${index}"
      aria-label="${rank} of ${escapeHtml(getBlackjackSuitLabel(suit))}"
    >
      <span class="hud__blackjack-card-corner">${rank}</span>
      <span class="hud__blackjack-card-suit">${suitSymbol}</span>
      <span class="hud__blackjack-card-corner is-bottom">${rank}</span>
    </span>
  `;
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
    this.loadingTargetProgress = 0;
    this.loadingRequestedProgress = 0;
    this.loadingDisplayedProgress = 0;
    this.loadingProgressFrame = 0;
    this.loadingProgressDelayTimeout = 0;
    this.loadingProgressLastFrameAt = 0;
    this.loadingProgressUnlockAt = performance.now() + 900;
    this.setLoadingProgress(0);
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
    this.moneyRoot = this.overlay.querySelector('[data-money]');
    this.moneyValue = this.overlay.querySelector('[data-money-value]');
    this.taskRoot = this.overlay.querySelector('[data-task]');
    this.taskTitle = this.overlay.querySelector('[data-task-title]');
    this.taskConfetti = this.overlay.querySelector('[data-task-confetti]');
    this.skillLevelUpRoot = this.overlay.querySelector('[data-skill-level-up]');
    this.skillLevelUpIcon = this.overlay.querySelector('[data-skill-level-up-icon]');
    this.skillLevelUpTitle = this.overlay.querySelector('[data-skill-level-up-title]');
    this.skillLevelUpSubtitle = this.overlay.querySelector('[data-skill-level-up-subtitle]');
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
    this.builderNpcRotate = this.overlay.querySelector('[data-builder-npc-rotate]');
    this.builderNpcMove = this.overlay.querySelector('[data-builder-npc-move]');
    this.builderNpcDelete = this.overlay.querySelector('[data-builder-npc-delete]');
    this.builderNpcDone = this.overlay.querySelector('[data-builder-npc-done]');
    this.builderNpcModel = this.overlay.querySelector('[data-builder-npc-model]');
    this.builderNpcModelOptions = this.overlay.querySelector('[data-builder-npc-model-options]');
    this.builderNpcName = this.overlay.querySelector('[data-builder-npc-name]');
    this.builderNpcRadius = this.overlay.querySelector('[data-builder-npc-radius]');
    this.builderNpcSpeed = this.overlay.querySelector('[data-builder-npc-speed]');
    this.builderNpcRespawnDelay = this.overlay.querySelector('[data-builder-npc-respawn-delay]');
    this.builderNpcDeliveryQuest = this.overlay.querySelector('[data-builder-npc-delivery-quest]');
    this.builderNpcGymCheckIn = this.overlay.querySelector('[data-builder-npc-gym-check-in]');
    this.builderNpcRentCollector = this.overlay.querySelector('[data-builder-npc-rent-collector]');
    this.builderNpcStockMarket = this.overlay.querySelector('[data-builder-npc-stock-market]');
    this.builderNpcBlackjackDealer = this.overlay.querySelector('[data-builder-npc-blackjack-dealer]');
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
    this.blackjackWagerChips = this.overlay.querySelector('[data-blackjack-wager-chips]');
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
    this.emoteSliceNodes = [];
    this.overheadHealthBarNodes = new Map();
    this.speechBubbleNodes = new Map();
    this.aimDebugInputs = new Map();
    this.poseDebugExtraInputs = new Map();
    this.joinTitleTimeout = 0;
    this.loadingHideTimeout = 0;
    this.toastTimeout = 0;
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
      <section class="hud__money" data-money aria-label="Money" aria-live="polite">
        <span class="hud__money-value" data-money-value>$0</span>
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
        <section class="hud__toast">
          <p class="hud__toast-text" data-toast></p>
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
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
                <path d="M18.5 13.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" />
                <path d="M5.5 14.5l1.1 2.4 2.4 1.1-2.4 1.1L5.5 21l-1.1-2.4L2 17.5l2.4-1.1 1.1-2.4z" />
              </svg>
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
                <input class="hud__checkbox-control" type="checkbox" data-builder-npc-blackjack-dealer />
                <span class="hud__checkbox-copy">
                  <span class="hud__field-label hud__checkbox-title">Blackjack Dealer</span>
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
            <input class="hud__field-control" type="number" min="1" max="999" step="1" value="1" data-stock-market-quantity />
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
            <div class="hud__blackjack-shoe" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
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
            <input class="hud__field-control" type="number" min="0" max="500" step="5" value="${BLACKJACK_DEFAULT_WAGER}" data-blackjack-wager />
          </label>
          <div class="hud__blackjack-chips" data-blackjack-wager-chips aria-hidden="true"></div>
          <div class="hud__blackjack-actions">
            <button class="hud__blackjack-action is-deal" type="button" data-blackjack-deal>Deal</button>
            <button class="hud__blackjack-action" type="button" data-blackjack-hit>Hit</button>
            <button class="hud__blackjack-action" type="button" data-blackjack-stand>Stand</button>
            <button class="hud__blackjack-action" type="button" data-blackjack-double>Double</button>
          </div>
        </footer>
      </section>
      <form class="hud__quick-chat" data-quick-chat data-quick-chat-form>
        <span class="hud__key">Enter</span>
        <input class="hud__field-control hud__quick-chat-input" type="text" maxlength="280" data-quick-chat-input placeholder="Say something..." />
        <p class="hud__quick-chat-hint" data-quick-chat-hint>Enter to send. Escape to cancel.</p>
      </form>
      <section class="hud__overhead-health-layer" data-overhead-health-layer></section>
      <section class="hud__speech-layer" data-speech-layer></section>
      <p class="hud__respawn" data-respawn></p>
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

  setMobileControlsState({ visible = true, armed = false } = {}) {
    if (!this.mobileControls) {
      return;
    }

    const nextVisible = Boolean(visible);
    this.mobileControls.classList.toggle('is-hidden', !nextVisible);
    this.mobileControls.setAttribute('aria-hidden', nextVisible ? 'false' : 'true');
    if (this.mobileFireLabel) {
      this.mobileFireLabel.textContent = armed ? 'Fire' : 'Hit';
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
    this.phoneScreenContent.innerHTML = getPhoneScreenMarkup(this.phoneActiveAppId);
  }

  setPhoneState({ visible = this.phoneVisible, activeAppId = this.phoneActiveAppId } = {}) {
    if (!this.phoneStage) {
      return;
    }

    const nextVisible = Boolean(visible);
    this.phoneVisible = nextVisible;
    this.phoneActiveAppId = nextVisible && getPhoneAppById(activeAppId) ? activeAppId : '';
    this.renderPhoneScreen();

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
    onNpcSpeedChange,
    onNpcRespawnDelayChange,
    onNpcDeliveryQuestChange,
    onNpcGymCheckInChange,
    onNpcRentCollectorChange,
    onNpcStockMarketChange,
    onNpcBlackjackDealerChange,
    onNpcModelChange,
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

    this.builderNpcBlackjackDealer?.addEventListener('change', () => {
      onNpcBlackjackDealerChange?.(this.builderNpcBlackjackDealer.checked === true);
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
    onMasterVolumeChange
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
    onDouble
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
    if (this.builderNpcBlackjackDealer && document.activeElement !== this.builderNpcBlackjackDealer) {
      this.builderNpcBlackjackDealer.checked = editorState.blackjackDealerEnabled === true;
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
      quantity: Math.max(1, Math.min(999, Math.floor(Number(quantity) || 1))),
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
      wager: Number.isFinite(numericWager) ? Math.max(0, Math.min(500, Math.trunc(numericWager))) : BLACKJACK_DEFAULT_WAGER,
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

    if (this.blackjackStatus) {
      this.blackjackStatus.textContent = loading
        ? 'The dealer is shuffling...'
        : error
          ? error
          : handActive
            ? 'Player action'
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

    const dealerHand = Array.isArray(game?.dealerHand) ? game.dealerHand : [];
    const playerHand = Array.isArray(game?.playerHand) ? game.playerHand : [];
    if (this.blackjackDealerHand) {
      this.blackjackDealerHand.innerHTML = dealerHand.length
        ? dealerHand.map(createBlackjackCardMarkup).join('')
        : '<span class="hud__blackjack-card-slot"></span><span class="hud__blackjack-card-slot"></span>';
    }
    if (this.blackjackPlayerHand) {
      this.blackjackPlayerHand.innerHTML = playerHand.length
        ? playerHand.map(createBlackjackCardMarkup).join('')
        : '<span class="hud__blackjack-card-slot"></span><span class="hud__blackjack-card-slot"></span>';
    }
    if (this.blackjackDealerValue) {
      this.blackjackDealerValue.textContent = dealerHand.length ? String(game?.dealerValue ?? 0) : '-';
    }
    if (this.blackjackPlayerValue) {
      this.blackjackPlayerValue.textContent = playerHand.length ? String(game?.playerValue ?? 0) : '-';
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
      this.respawnText.textContent = seconds > 0 ? `Respawning in ${seconds}s` : 'Respawning...';
      this.respawnText.classList.add('is-visible');
      return;
    }

    this.respawnText.classList.remove('is-visible');
  }

  setHitMarkerVisible(visible) {
    this.hitMarker.classList.toggle('is-visible', visible);
  }

  setMoneyState({ amount = 0 } = {}) {
    if (!this.moneyRoot || !this.moneyValue) {
      return;
    }

    const numeric = Number(amount ?? 0);
    const money = Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
    this.moneyValue.textContent = formatMoneyAmount(money);
    this.moneyRoot.classList.toggle('is-negative', money < 0);
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
    const safeQuantity = Math.max(1, Math.min(999, Math.floor(Number(quantity) || 1)));
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
      node.classList.toggle('is-interaction', bubble.variant === 'interaction');
      node.classList.toggle('is-money', bubble.variant === 'money');
      node.classList.toggle('is-money-positive', bubble.variant === 'money' && bubble.tone === 'positive');
      node.classList.toggle('is-money-negative', bubble.variant === 'money' && bubble.tone === 'negative');
      node.classList.toggle('is-xp', bubble.variant === 'xp');
      node.classList.toggle('is-thinking', bubble.status === 'thinking');
      node.style.left = `${bubble.screenX}px`;
      node.style.top = `${bubble.screenY}px`;
      node.style.opacity = Number.isFinite(Number(bubble.opacity)) ? String(bubble.opacity) : '';

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

  setOverheadHealthBars(bars = []) {
    const activeIds = new Set();

    for (const bar of bars) {
      if (!bar?.id || !bar.visible) {
        continue;
      }

      activeIds.add(bar.id);
      let node = this.overheadHealthBarNodes.get(bar.id);
      let fillNode = node?.querySelector('.hud__overhead-health-fill') ?? null;
      if (!node || !fillNode) {
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
