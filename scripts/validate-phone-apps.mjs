import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createInitialStockMarketState,
  executeStockTrade,
  serializeStockMarket
} from '../src/shared/stockMarket.js';
import { assets } from '../src/world/assetManifest.js';

const root = process.cwd();
const hudSource = fs.readFileSync(path.join(root, 'src/ui/Hud.js'), 'utf8');
const gameSource = fs.readFileSync(path.join(root, 'src/game/Game.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'server/src/WorldRoom.js'), 'utf8');

assert.match(hudSource, /\['skills', 'Skills'/, 'Skills app is registered on the phone home screen');
assert.doesNotMatch(hudSource, /\['stocks', 'Stocks'/, 'Separate Stocks app is removed from the phone home screen');
assert.match(hudSource, /data-phone-wallet-app/, 'Wallet app has dedicated phone markup');
assert.match(hudSource, /data-phone-wallet-stocks/, 'Wallet app exposes a Stocks action');
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
assert.match(hudSource, /data-phone-settings-app/, 'Settings app has dedicated phone markup');
assert.match(hudSource, /data-phone-setting-audio/, 'Settings app has an audio slider');
assert.match(hudSource, /WASD \/ left touch stick/, 'Settings controls list includes movement binding');
assert.match(hudSource, /Tab \/ phone button/, 'Settings controls list includes phone binding');

assert.match(gameSource, /getWalletSnapshot/, 'Game requests authoritative wallet snapshots');
assert.match(gameSource, /openWalletStocks/, 'Game wires Wallet Stocks action');
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
assert.equal(phoneUnlockAudio.subarray(0, 4).toString('ascii'), 'RIFF', 'Phone unlock audio should be a WAV file.');
assert.equal(phoneUnlockAudio.subarray(8, 12).toString('ascii'), 'WAVE', 'Phone unlock audio should have a WAVE header.');

assert.match(serverSource, /wallet:getSnapshot/, 'Server exposes wallet snapshot RPC');
assert.match(serverSource, /handleWalletSnapshotRequest/, 'Server handles wallet snapshot request');

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

console.log('Phone apps validation passed.');
