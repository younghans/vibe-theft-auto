import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createInitialStockMarketState,
  executeStockTrade,
  serializeStockMarket
} from '../src/shared/stockMarket.js';

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
assert.match(hudSource, /data-phone-settings-app/, 'Settings app has dedicated phone markup');
assert.match(hudSource, /data-phone-setting-audio/, 'Settings app has an audio slider');
assert.match(hudSource, /WASD \/ left touch stick/, 'Settings controls list includes movement binding');
assert.match(hudSource, /Tab \/ phone button/, 'Settings controls list includes phone binding');

assert.match(gameSource, /getWalletSnapshot/, 'Game requests authoritative wallet snapshots');
assert.match(gameSource, /openWalletStocks/, 'Game wires Wallet Stocks action');
assert.match(gameSource, /createPhoneMapState/, 'Game creates map state from live game data');
assert.match(gameSource, /setMasterVolume/, 'Game owns persisted master volume setting');
assert.match(gameSource, /showSkillLevelUp/, 'Game triggers skill level-up feedback');

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
