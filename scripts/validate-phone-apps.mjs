import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createInitialStockMarketState,
  executeStockTrade,
  normalizeStockPortfolioSnapshot,
  serializeStockMarket
} from '../src/shared/stockMarket.js';
import { assets } from '../src/world/assetManifest.js';

const root = process.cwd();
const hudSource = fs.readFileSync(path.join(root, 'src/ui/Hud.js'), 'utf8');
const gameSource = fs.readFileSync(path.join(root, 'src/game/Game.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const colyseusNpcSource = fs.readFileSync(path.join(root, 'src/npc/NpcServiceColyseus.js'), 'utf8');
const mockNpcSource = fs.readFileSync(path.join(root, 'src/npc/NpcServiceMock.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'server/src/WorldRoom.js'), 'utf8');

assert.match(hudSource, /\['skills', 'Skills'/, 'Skills app is registered on the phone home screen');
assert.match(hudSource, /\['stocks', 'Stocks'/, 'Stocks app is registered on the phone home screen');
assert.doesNotMatch(hudSource, /\['casino', 'Casino'/, 'Casino app is removed from the phone home screen');
assert.match(hudSource, /data-phone-wallet-app/, 'Wallet app has dedicated phone markup');
assert.match(hudSource, /data-phone-wallet-stocks/, 'Wallet app exposes a Stocks action');
assert.match(hudSource, /data-phone-stocks-app/, 'Stocks app has dedicated phone markup');
assert.match(hudSource, /data-phone-stock-trade/, 'Stocks app exposes buy and sell actions');
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
assert.match(gameSource, /captureAndSaveWorldMap/, 'Game can manually capture the world map');
assert.match(gameSource, /WORLD_MAP_IMAGE_METADATA_URL/, 'Game loads cached map image metadata');
assert.match(gameSource, /setMasterVolume/, 'Game owns persisted master volume setting');
assert.match(gameSource, /showSkillLevelUp/, 'Game triggers skill level-up feedback');

assert.ok(assets.audio.phoneUnlock, 'Phone unlock audio should be registered.');
const phoneUnlockAudio = fs.readFileSync(new URL(assets.audio.phoneUnlock));
assert.ok(phoneUnlockAudio.length > 12, 'Phone unlock audio should not be empty.');
const phoneUnlockHasId3Header = phoneUnlockAudio.subarray(0, 3).toString('ascii') === 'ID3';
const phoneUnlockHasFrameSync = phoneUnlockAudio[0] === 0xff && (phoneUnlockAudio[1] & 0xe0) === 0xe0;
assert.ok(phoneUnlockHasId3Header || phoneUnlockHasFrameSync, 'Phone unlock audio should be an MP3 file.');

assert.match(serverSource, /wallet:getSnapshot/, 'Server exposes wallet snapshot RPC');
assert.match(serverSource, /handleWalletSnapshotRequest/, 'Server handles wallet snapshot request');
assert.match(serverSource, /getStockTradeAccess/, 'Server has a stock trade access path for phone trading');
assert.match(serverSource, /message\?\.source[\s\S]*phone/, 'Server permits stock trades from the phone source');
assert.match(serverSource, /stockPortfolios:/, 'Server snapshots persist character-specific stock portfolios');
assert.match(serverSource, /async handleStockTradeRequest[\s\S]*queuePlayerSnapshotSave\(client\.sessionId\)/, 'Server queues a snapshot save after stock trades');
assert.match(serverSource, /async handleStockTradeRequest[\s\S]*await this\.savePlayerSnapshot\(client\.sessionId\)/, 'Server persists stock trades before confirming them');
assert.match(colyseusNpcSource, /source:\s*options\?\.source/, 'Colyseus stock trades forward source metadata');
assert.match(mockNpcSource, /phoneTrade[\s\S]*source[\s\S]*phone/, 'Mock stock trades support phone source metadata');
assert.match(mockNpcSource, /MOCK_STOCK_PORTFOLIOS_STORAGE_KEY/, 'Mock transport persists stock portfolios locally');

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

console.log('Phone apps validation passed.');
