import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createInitialStockMarketState,
  executeStockTrade,
  normalizeStockMarketSnapshot,
  normalizeStockPortfolioSnapshot,
  normalizeStockTradeQuantity,
  serializeStockMarket
} from '../src/shared/stockMarket.js';
import {
  appendVibeRadioTrack,
  createDefaultVibeRadioTracks,
  getVibeRadioViewModel,
  normalizeVibeRadioTracks
} from '../src/shared/vibeRadio.js';
import {
  ATTACHMENT_SLOTS,
  HELD_ITEM_IDS,
  getHeldItemDefinition
} from '../src/shared/heldItemDefinitions.js';
import { EMOTES_BY_ID, TEXTING_EMOTE_ID } from '../src/player/emotes.js';
import { assets } from '../src/world/assetManifest.js';

const root = process.cwd();
const hudSource = fs.readFileSync(path.join(root, 'src/ui/Hud.js'), 'utf8');
const gameSource = fs.readFileSync(path.join(root, 'src/game/Game.js'), 'utf8');
const playerSource = fs.readFileSync(path.join(root, 'src/player/createPlayer.js'), 'utf8');
const humanoidSource = fs.readFileSync(path.join(root, 'src/animation/humanoid.js'), 'utf8');
const npcActorSource = fs.readFileSync(path.join(root, 'src/npc/NpcActor.js'), 'utf8');
const characterPreviewSource = fs.readFileSync(path.join(root, 'src/ui/CharacterPreviewRenderer.js'), 'utf8');
const schoolTeacherPreviewSource = fs.readFileSync(path.join(root, 'src/ui/SchoolTeacherPreviewRenderer.js'), 'utf8');
const worldBuilderSource = fs.readFileSync(path.join(root, 'src/world/WorldBuilder.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const colyseusNpcSource = fs.readFileSync(path.join(root, 'src/npc/NpcServiceColyseus.js'), 'utf8');
const mockNpcSource = fs.readFileSync(path.join(root, 'src/npc/NpcServiceMock.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'server/src/WorldRoom.js'), 'utf8');

assert.match(hudSource, /\['skills', 'Skills'/, 'Skills app is registered on the phone home screen');
assert.match(hudSource, /\['stocks', 'Stocks'/, 'Stocks app is registered on the phone home screen');
assert.match(hudSource, /\['vibe-radio', 'Vibe Radio'/, 'Vibe Radio app is registered on the phone home screen');
assert.doesNotMatch(hudSource, /\['casino', 'Casino'/, 'Casino app is removed from the phone home screen');
assert.match(hudSource, /data-phone-wallet-app/, 'Wallet app has dedicated phone markup');
assert.match(hudSource, /data-phone-wallet-stocks/, 'Wallet app exposes a Stocks action');
assert.match(hudSource, /data-phone-vibe-radio-app/, 'Vibe Radio app has dedicated phone markup');
assert.match(hudSource, /data-phone-vibe-radio-action/, 'Vibe Radio app exposes playback controls');
assert.match(hudSource, /data-phone-vibe-radio-volume/, 'Vibe Radio app exposes a player-specific volume control');
assert.match(hudSource, /data-vibe-radio-widget/, 'Main HUD has the Vibe Radio mini player');
assert.match(hudSource, /hud__vibe-radio-volume-slider/, 'Vibe Radio uses a normal range slider for volume');
assert.doesNotMatch(hudSource, /hud__vibe-radio-volume-knob/, 'Vibe Radio should not render the old volume knob');
assert.doesNotMatch(gameSource, /Playback blocked/, 'Vibe Radio should not surface playback blocked as a player-facing error');
assert.match(hudSource, /getVibeRadioControlsSignature/, 'Vibe Radio controls should avoid unnecessary re-renders');
assert.match(hudSource, /lastPhoneVibeRadioTrackListSignature/, 'Vibe Radio phone list should avoid refresh flicker while playing');
assert.match(worldBuilderSource, /BUILDER_VIBE_RADIO_CATEGORY/, 'World builder registers a Vibe Radio tab');
assert.match(worldBuilderSource, /updateVibeRadioTracks/, 'World builder can persist Vibe Radio playlist edits');
assert.match(hudSource, /data-phone-stocks-app/, 'Stocks app has dedicated phone markup');
assert.match(hudSource, /data-phone-stock-trade/, 'Stocks app exposes buy and sell actions');
assert.doesNotMatch(hudSource, /max="999"/, 'Stock share inputs do not cap trades at 999 shares');
assert.doesNotMatch(hudSource, /Math\.min\(999/, 'Stock HUD state does not clamp trades to 999 shares');
assert.match(hudSource, /data-money-net-worth/, 'Main cash HUD displays net worth beside cash');
assert.match(hudSource, /setMoneyState\(\{ amount = 0, netWorth = amount, stockProfit = 0 \}/, 'Main cash HUD accepts stock-aware net worth state');
assert.match(hudSource, /data-phone-skills-app/, 'Skills app has dedicated phone markup');
assert.match(hudSource, /data-phone-map-app/, 'Map app has dedicated phone markup');
assert.match(hudSource, /data-phone-map-zoom-in/, 'Map app exposes zoom in control');
assert.match(hudSource, /data-phone-map-zoom-out/, 'Map app exposes zoom out control');
assert.match(hudSource, /addEventListener\('wheel'/, 'Map app handles mouse wheel zoom');
assert.match(hudSource, /addEventListener\('pointerdown'/, 'Map app handles drag panning');
assert.match(hudSource, /data-phone-map-tooltip-popover/, 'Map app renders a custom waypoint tooltip');
assert.match(hudSource, /showPhoneMapTooltip/, 'Map app shows instant waypoint tooltips');
assert.match(hudSource, /data-map-capture-toggle/, 'Admin map capture button is present');
assert.match(hudSource, /setMapCaptureState/, 'HUD can show admin map capture state');
assert.match(stylesSource, /\.hud__top-right-stack\s*{\s*display:\s*contents;/, 'Mobile HUD keeps fixed admin prompt panel renderable');
assert.match(stylesSource, /\.hud__top-right-stack > \.hud__admin-position,[\s\S]*\.hud__top-right-stack > \.hud__panel\s*{\s*display:\s*none;/, 'Mobile HUD only hides passive top-right admin controls');
assert.match(stylesSource, /\.hud__money-net-worth\.is-up/, 'Main HUD net worth turns green when stocks are up');
assert.match(stylesSource, /\.hud__money-net-worth\.is-down/, 'Main HUD net worth turns red when stocks are down');
assert.match(hudSource, /data-phone-settings-app/, 'Settings app has dedicated phone markup');
assert.match(hudSource, /data-phone-setting-audio/, 'Settings app has an audio slider');
assert.match(hudSource, /WASD \/ left touch stick/, 'Settings controls list includes movement binding');
assert.match(hudSource, /Tab \/ phone button/, 'Settings controls list includes phone binding');

assert.match(gameSource, /getWalletSnapshot/, 'Game requests authoritative wallet snapshots');
assert.match(gameSource, /refreshWalletSnapshot\(\{ passive: true \}\)/, 'Game passively refreshes wallet snapshots for the main HUD');
assert.match(gameSource, /scheduleWalletSnapshotRefresh\(result\.wallet, STOCK_MARKET_TICK_MS\)/, 'Wallet HUD refresh follows stock market ticks');
assert.match(gameSource, /stockMarketSnapshotCharacterId/, 'Wallet market snapshots are scoped to the active character');
assert.match(gameSource, /getStockUnrealizedProfit/, 'Game derives main HUD stock gain/loss coloring from unrealized profit');
assert.match(gameSource, /openWalletStocks/, 'Game wires Wallet Stocks action');
assert.match(gameSource, /handlePhoneStockTrade/, 'Game wires phone stock trading');
assert.match(gameSource, /source:\s*'phone'/, 'Phone stock trades identify the phone as the trade source');
assert.match(gameSource, /setPhoneStocksState/, 'Game syncs the phone Stocks app state');
assert.match(gameSource, /createPhoneMapState/, 'Game creates map state from live game data');
assert.match(gameSource, /setPhoneMapZoom/, 'Game owns phone map zoom state');
assert.match(gameSource, /panPhoneMapByScreenDelta/, 'Game owns phone map pan state');
assert.match(gameSource, /handlePhoneMapKeyboardInput/, 'Game maps WASD input to phone map panning');
assert.match(gameSource, /phoneUnlockSound/, 'Game registers the phone unlock sound');
assert.match(gameSource, /playSoundEffect\(this\.phoneUnlockSound\)/, 'Game plays the unlock sound when opening the phone');
assert.match(gameSource, /TEXTING_EMOTE_ID/, 'Game references the texting emote for phone mode');
assert.match(gameSource, /setPhoneTextingMode/, 'Game owns phone texting mode state');
assert.match(gameSource, /openPhoneMenu\(\)[\s\S]*setPhoneTextingMode\(true\)/, 'Opening the phone enables texting mode');
assert.match(gameSource, /closePhoneMenu\(\)[\s\S]*setPhoneTextingMode\(false\)/, 'Closing the phone disables texting mode');
assert.match(gameSource, /phoneTextingAnimationFrame[\s\S]*requestAnimationFrame/, 'Phone texting animation starts outside the Tab key handler');
assert.match(hudSource, /data-aim-debug-section="phoneGrip"/, 'Pose debug exposes a phone grip tuning section');
assert.match(hudSource, /PHONE_GRIP_DEBUG_FIELDS/, 'Phone grip debug fields are rendered in the pose debug menu');
assert.match(gameSource, /setPhoneGripDebugField/, 'Game can apply live phone grip debug changes');
assert.match(gameSource, /startPhoneGripDebugPreview/, 'Phone grip debug previews the texting pose while tuning');
assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/main.js'), 'utf8'), /phoneVisualQa/, 'Temporary phone visual QA boot hook is not shipped');
assert.match(playerSource, /setPhoneTextingActive/, 'Player can attach or detach the phone held item');
assert.match(playerSource, /remoteTextingActive/, 'Remote players show phone texting state from synced emotes');
assert.match(playerSource, /syncPhoneEquipment/, 'Phone texting owns the right-hand phone equipment state');
assert.match(playerSource, /phoneTextingActive[\s\S]*setWeaponState/, 'Weapon equip yields to phone texting while preserving selected weapons');
assert.doesNotMatch(playerSource, /clipNamesToPreload\.add\(getEmoteConfig\(TEXTING_EMOTE_ID\)/, 'Texting clip is not on the critical avatar boot preload path');
assert.match(humanoidSource, /createTargetFilteredClip/, 'Animation clips can be filtered to bindable rig targets');
assert.match(npcActorSource, /createTargetFilteredClip/, 'NPC animations are filtered before binding to actor rigs');
assert.match(characterPreviewSource, /createTargetFilteredClip/, 'Character preview animations are filtered before binding');
assert.match(schoolTeacherPreviewSource, /createTargetFilteredClip/, 'Teacher preview animations are filtered before binding');
assert.match(gameSource, /captureAndSaveWorldMap/, 'Game can manually capture the world map');
assert.match(gameSource, /WORLD_MAP_IMAGE_METADATA_URL/, 'Game loads cached map image metadata');
assert.match(gameSource, /setMasterVolume/, 'Game owns persisted master volume setting');
assert.match(gameSource, /syncVibeRadioTracksFromLayout/, 'Game syncs Vibe Radio tracks from world layout');
assert.match(gameSource, /handleVibeRadioAction/, 'Game owns Vibe Radio playback actions');
assert.match(gameSource, /VIBE_RADIO_VOLUME_STORAGE_KEY/, 'Game stores radio volume locally per player');
assert.match(gameSource, /raw == null \|\| raw === ''/, 'Vibe Radio defaults volume when no player-specific volume is stored');
assert.match(gameSource, /showSkillLevelUp/, 'Game triggers skill level-up feedback');

assert.ok(assets.audio.phoneUnlock, 'Phone unlock audio should be registered.');
assert.equal(TEXTING_EMOTE_ID, 'texting', 'Texting emote id remains stable for multiplayer sync.');
assert.equal(EMOTES_BY_ID[TEXTING_EMOTE_ID]?.clipName, 'texting', 'Texting emote uses the Mixamo texting clip.');
assert.equal(EMOTES_BY_ID[TEXTING_EMOTE_ID]?.upperBodyOnly, true, 'Texting emote stays upper-body only.');
const phoneHeldItem = getHeldItemDefinition(HELD_ITEM_IDS.phone);
assert.ok(phoneHeldItem, 'Phone held item should be registered.');
assert.equal(phoneHeldItem.attachmentSlot, ATTACHMENT_SLOTS.handRight, 'Phone is held in the animation-facing hand for texting.');
assert.equal(typeof phoneHeldItem.createModel, 'function', 'Phone held item uses a procedural 3D model.');
const phoneUnlockAudio = fs.readFileSync(new URL(assets.audio.phoneUnlock));
assert.ok(phoneUnlockAudio.length > 12, 'Phone unlock audio should not be empty.');
const phoneUnlockHasId3Header = phoneUnlockAudio.subarray(0, 3).toString('ascii') === 'ID3';
const phoneUnlockHasFrameSync = phoneUnlockAudio[0] === 0xff && (phoneUnlockAudio[1] & 0xe0) === 0xe0;
assert.ok(phoneUnlockHasId3Header || phoneUnlockHasFrameSync, 'Phone unlock audio should be an MP3 file.');

for (const [label, url] of Object.entries(assets.audio.vibeHero ?? {})) {
  const audio = fs.readFileSync(new URL(url));
  assert.ok(audio.length > 1024, `${label} Vibe Hero audio should not be empty.`);
  const hasId3Header = audio.subarray(0, 3).toString('ascii') === 'ID3';
  const hasFrameSync = audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0;
  assert.ok(hasId3Header || hasFrameSync, `${label} Vibe Hero audio should be an MP3 file.`);
}

for (const [label, url] of Object.entries(assets.audio.vibeRadio ?? {})) {
  const audio = fs.readFileSync(new URL(url));
  assert.ok(audio.length > 1024, `${label} Vibe Radio audio should not be empty.`);
  const hasId3Header = audio.subarray(0, 3).toString('ascii') === 'ID3';
  const hasFrameSync = audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0;
  assert.ok(hasId3Header || hasFrameSync, `${label} Vibe Radio audio should be an MP3 file.`);
}

assert.match(serverSource, /wallet:getSnapshot/, 'Server exposes wallet snapshot RPC');
assert.match(serverSource, /updateVibeRadioTracks/, 'Server accepts Vibe Radio world-builder updates');
assert.match(serverSource, /handleWalletSnapshotRequest/, 'Server handles wallet snapshot request');
assert.match(serverSource, /getStockTradeAccess/, 'Server has a stock trade access path for phone trading');
assert.match(serverSource, /message\?\.source[\s\S]*phone/, 'Server permits stock trades from the phone source');
assert.match(serverSource, /stockPortfolios:/, 'Server snapshots persist character-specific stock portfolios');
assert.match(serverSource, /getStockMarketPersistence/, 'Server loads persistent stock market state');
assert.match(serverSource, /persistStockMarket\('wallet-snapshot'\)/, 'Server persists market tape after wallet/phone refreshes');
assert.match(serverSource, /persistStockMarket\('stock-trade'\)/, 'Server persists market tape after stock trades');
assert.match(serverSource, /async handleStockTradeRequest[\s\S]*queuePlayerSnapshotSave\(client\.sessionId\)/, 'Server queues a snapshot save after stock trades');
assert.match(serverSource, /async handleStockTradeRequest[\s\S]*await this\.savePlayerSnapshot\(client\.sessionId\)/, 'Server persists stock trades before confirming them');
assert.match(colyseusNpcSource, /source:\s*options\?\.source/, 'Colyseus stock trades forward source metadata');
assert.match(mockNpcSource, /phoneTrade[\s\S]*source[\s\S]*phone/, 'Mock stock trades support phone source metadata');
assert.match(mockNpcSource, /MOCK_STOCK_PORTFOLIOS_STORAGE_KEY/, 'Mock transport persists stock portfolios locally');
assert.match(mockNpcSource, /MOCK_STOCK_MARKET_STORAGE_KEY/, 'Mock transport persists stock market tape locally');
assert.match(mockNpcSource, /updateVibeRadioTracks/, 'Mock world edit transport accepts Vibe Radio updates');

const defaultRadioPlaylist = createDefaultVibeRadioTracks();
assert.deepEqual(
  defaultRadioPlaylist.map((track) => track.title),
  ['Bright Light and Spacious', 'Kiss of Life'],
  'Vibe Radio starts with the bundled MP3 playlist'
);
assert.deepEqual(
  defaultRadioPlaylist.map((track) => track.sourceUrl),
  [
    'assets/audio/vibe-radio/bright-light-and-spacious.mp3',
    'assets/audio/vibe-radio/kiss-of-life.mp3'
  ],
  'Vibe Radio starter songs use local MP3 files'
);

const radioPlaylist = appendVibeRadioTrack([], {
  title: 'Admin Test Song',
  sourceUrl: 'assets/audio/vibe-radio/admin-test.mp3'
});
assert.equal(radioPlaylist.length, 1, 'Vibe Radio can append a playlist track');
assert.equal(radioPlaylist[0].title, 'Admin Test Song', 'Vibe Radio preserves normalized song title');
assert.equal(
  normalizeVibeRadioTracks(radioPlaylist)[0].sourceUrl,
  'assets/audio/vibe-radio/admin-test.mp3',
  'Vibe Radio preserves normalized MP3 paths'
);
assert.equal(
  normalizeVibeRadioTracks([{ title: 'Remote Stream', sourceUrl: 'https://example.com/song.mp3' }]).length,
  0,
  'Vibe Radio rejects remote music links'
);
assert.equal(getVibeRadioViewModel(radioPlaylist)[0].trackNumber, 1, 'Vibe Radio view model exposes track order');

const market = createInitialStockMarketState(1000);
const portfolio = {};
const before = serializeStockMarket(market, portfolio, 5000, 1000);
assert.equal(before.cash, 5000, 'wallet snapshot reflects cash');
assert.equal(before.portfolioValue, 0, 'empty portfolio starts at zero value');
assert.equal(before.netWorth, 5000, 'net worth starts as cash when no holdings exist');

const trade = executeStockTrade({
  state: market,
  portfolio,
  cash: 5000,
  symbol: before.stocks[0].symbol,
  side: 'buy',
  quantity: 1,
  now: 1000
});
assert.equal(trade.ok, true, 'stock buy can create a wallet holding');
const after = trade.market;
assert.ok(after.stocks.some((stock) => stock.shares > 0), 'wallet market snapshot includes owned stock');
assert.equal(after.netWorth, after.cash + after.portfolioValue, 'wallet net worth is cash plus portfolio value');

const persistedPortfolio = normalizeStockPortfolioSnapshot(portfolio);
assert.equal(
  persistedPortfolio[before.stocks[0].symbol]?.shares,
  1,
  'stock portfolio snapshots preserve owned shares'
);
assert.equal(
  typeof persistedPortfolio[before.stocks[0].symbol]?.averageCost,
  'number',
  'stock portfolio snapshots preserve average cost'
);

assert.equal(normalizeStockTradeQuantity(1200), 1200, 'stock trades support quantities above 999');
const largePortfolio = {};
const largeTrade = executeStockTrade({
  state: market,
  portfolio: largePortfolio,
  cash: 1000000,
  symbol: before.stocks[0].symbol,
  side: 'buy',
  quantity: 1200,
  now: 1000
});
assert.equal(largeTrade.ok, true, 'stock buys over 999 shares are accepted when cash is available');
assert.equal(largeTrade.trade.quantity, 1200, 'stock buys over 999 shares preserve requested quantity');
const persistedMarket = normalizeStockMarketSnapshot(market, 1000);
assert.ok(persistedMarket?.stocks?.[before.stocks[0].symbol], 'stock market snapshots preserve listed stock tape');

console.log('Phone apps validation passed.');
