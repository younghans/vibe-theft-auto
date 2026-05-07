export const STOCK_MARKET_TICK_MS = 5200;
export const STOCK_MARKET_HISTORY_LIMIT = 56;
export const STOCK_MARKET_MAX_CATCH_UP_TICKS = 96;
export const STOCK_MARKET_FEE_RATE = 0;
export const STOCK_MARKET_MAX_QUANTITY = 999;

export const STOCK_MARKET_MODES = Object.freeze({
  steady: Object.freeze({
    id: 'steady',
    label: 'Sideways',
    drift: 0,
    volatilityMultiplier: 0.72,
    minTicks: 5,
    maxTicks: 12
  }),
  climb: Object.freeze({
    id: 'climb',
    label: 'Green Run',
    drift: 0.018,
    volatilityMultiplier: 0.9,
    minTicks: 4,
    maxTicks: 11
  }),
  slide: Object.freeze({
    id: 'slide',
    label: 'Red Run',
    drift: -0.018,
    volatilityMultiplier: 0.9,
    minTicks: 4,
    maxTicks: 11
  }),
  chop: Object.freeze({
    id: 'chop',
    label: 'Chop',
    drift: 0,
    volatilityMultiplier: 1.75,
    minTicks: 3,
    maxTicks: 8
  }),
  squeeze: Object.freeze({
    id: 'squeeze',
    label: 'Squeeze',
    drift: 0.032,
    volatilityMultiplier: 1.2,
    minTicks: 2,
    maxTicks: 6
  })
});

export const STOCK_MARKET_ITEMS = Object.freeze([
  Object.freeze({
    symbol: 'BURG',
    name: 'Burger Futures',
    sector: 'Food',
    icon: 'burger',
    accent: '#ffcf57',
    basePrice: 17,
    minPrice: 3,
    maxPrice: 82,
    volatility: 0.026
  }),
  Object.freeze({
    symbol: 'COLA',
    name: 'Cola Syrup',
    sector: 'Food',
    icon: 'cola',
    accent: '#f05f4f',
    basePrice: 11,
    minPrice: 2,
    maxPrice: 56,
    volatility: 0.031
  }),
  Object.freeze({
    symbol: 'GYM',
    name: 'Gym Passes',
    sector: 'Lifestyle',
    icon: 'gym',
    accent: '#70e3a2',
    basePrice: 29,
    minPrice: 6,
    maxPrice: 138,
    volatility: 0.022
  }),
  Object.freeze({
    symbol: 'MED',
    name: 'Med Kits',
    sector: 'Street',
    icon: 'medical',
    accent: '#55c7ff',
    basePrice: 42,
    minPrice: 9,
    maxPrice: 210,
    volatility: 0.024
  }),
  Object.freeze({
    symbol: 'CAB',
    name: 'Cab Medallions',
    sector: 'Transit',
    icon: 'cab',
    accent: '#ffd23f',
    basePrice: 64,
    minPrice: 12,
    maxPrice: 330,
    volatility: 0.02
  }),
  Object.freeze({
    symbol: 'TOKN',
    name: 'Arcade Tokens',
    sector: 'Leisure',
    icon: 'token',
    accent: '#9ad8ff',
    basePrice: 8,
    minPrice: 1,
    maxPrice: 44,
    volatility: 0.038
  }),
  Object.freeze({
    symbol: 'TOOL',
    name: 'Toolboxes',
    sector: 'Hardware',
    icon: 'tool',
    accent: '#d8b56d',
    basePrice: 36,
    minPrice: 7,
    maxPrice: 168,
    volatility: 0.023
  }),
  Object.freeze({
    symbol: 'RENT',
    name: 'Rent Notes',
    sector: 'Property',
    icon: 'rent',
    accent: '#d08cff',
    basePrice: 51,
    minPrice: 10,
    maxPrice: 250,
    volatility: 0.027
  })
]);

const STOCK_MARKET_ITEMS_BY_SYMBOL = new Map(
  STOCK_MARKET_ITEMS.map((item) => [item.symbol, item])
);
const MODE_WEIGHTS = Object.freeze([
  ['steady', 42],
  ['climb', 21],
  ['slide', 21],
  ['chop', 12],
  ['squeeze', 4]
]);

function roundCents(value) {
  const numeric = Number(value);
  return Number((Number.isFinite(numeric) ? numeric : 0).toFixed(2));
}

function roundWholeMoney(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
}

function roundTradeMoney(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return min + (Math.random() * (max - min));
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function chooseWeightedMode() {
  const total = MODE_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = Math.random() * total;
  for (const [modeId, weight] of MODE_WEIGHTS) {
    cursor -= weight;
    if (cursor <= 0) {
      return STOCK_MARKET_MODES[modeId] ?? STOCK_MARKET_MODES.steady;
    }
  }

  return STOCK_MARKET_MODES.steady;
}

function createModeDuration(mode) {
  return randomInt(mode.minTicks, mode.maxTicks);
}

function normalizeHistory(history = [], fallbackPrice = 0) {
  const values = Array.isArray(history)
    ? history.map((value) => roundCents(value)).filter((value) => value > 0)
    : [];
  return values.length
    ? values.slice(-STOCK_MARKET_HISTORY_LIMIT)
    : [roundCents(fallbackPrice)];
}

function createInitialStock(item) {
  const mode = chooseWeightedMode();
  const price = roundCents(item.basePrice * randomBetween(0.82, 1.18));
  return {
    symbol: item.symbol,
    price: clamp(price, item.minPrice, item.maxPrice),
    velocity: randomBetween(-0.018, 0.018),
    mode: mode.id,
    modeTicksRemaining: createModeDuration(mode),
    history: [price]
  };
}

function normalizeStockState(item, stock = null) {
  const price = roundCents(stock?.price ?? item.basePrice);
  const mode = STOCK_MARKET_MODES[stock?.mode] ?? STOCK_MARKET_MODES.steady;
  return {
    symbol: item.symbol,
    price: clamp(price, item.minPrice, item.maxPrice),
    velocity: Number.isFinite(Number(stock?.velocity)) ? Number(stock.velocity) : 0,
    mode: mode.id,
    modeTicksRemaining: Math.max(0, Math.floor(Number(stock?.modeTicksRemaining ?? 0) || 0)),
    history: normalizeHistory(stock?.history, price)
  };
}

function tickStock(item, stock) {
  let mode = STOCK_MARKET_MODES[stock.mode] ?? STOCK_MARKET_MODES.steady;
  if (stock.modeTicksRemaining <= 0) {
    mode = chooseWeightedMode();
    stock.mode = mode.id;
    stock.modeTicksRemaining = createModeDuration(mode);
  }

  const distanceFromBase = (item.basePrice - stock.price) / item.basePrice;
  const meanReversion = clamp(distanceFromBase * 0.028, -0.024, 0.024);
  const noise = randomBetween(-1, 1) * item.volatility * mode.volatilityMultiplier;
  const nextVelocity = clamp(
    (stock.velocity * 0.62) + mode.drift + meanReversion + noise,
    -0.16,
    0.18
  );
  let nextPrice = stock.price * (1 + nextVelocity);
  let nextVelocityAfterBounds = nextVelocity;

  if (nextPrice <= item.minPrice) {
    nextPrice = item.minPrice;
    nextVelocityAfterBounds = Math.abs(nextVelocity) * 0.35;
  } else if (nextPrice >= item.maxPrice) {
    nextPrice = item.maxPrice;
    nextVelocityAfterBounds = -Math.abs(nextVelocity) * 0.35;
  }

  stock.velocity = roundCents(nextVelocityAfterBounds);
  stock.price = roundCents(nextPrice);
  stock.modeTicksRemaining -= 1;
  stock.history = normalizeHistory([...stock.history, stock.price], stock.price);
}

export function normalizeStockMarketEnabled(value = false) {
  return value === true;
}

export function isStockMarketNpc(npc = null) {
  return normalizeStockMarketEnabled(npc?.stockMarketEnabled);
}

export function getStockMarketPromptRadius(npc = null, fallback = 4.2) {
  const numeric = Number(npc?.interactRadius ?? fallback);
  return Math.max(1.5, Number.isFinite(numeric) ? numeric : fallback);
}

export function normalizeStockSymbol(value = '') {
  const symbol = String(value ?? '').trim().toUpperCase();
  return STOCK_MARKET_ITEMS_BY_SYMBOL.has(symbol) ? symbol : '';
}

export function getStockMarketItem(symbol = '') {
  return STOCK_MARKET_ITEMS_BY_SYMBOL.get(normalizeStockSymbol(symbol)) ?? null;
}

export function normalizeStockTradeSide(value = '') {
  const side = String(value ?? '').trim().toLowerCase();
  return side === 'buy' || side === 'sell' ? side : '';
}

export function normalizeStockTradeQuantity(value = 1) {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return clamp(numeric, 1, STOCK_MARKET_MAX_QUANTITY);
}

export function getStockTradeValue(price = 0, quantity = 1) {
  return roundTradeMoney(roundCents(price) * normalizeStockTradeQuantity(quantity));
}

export function createInitialStockMarketState(now = Date.now()) {
  const stocks = {};
  for (const item of STOCK_MARKET_ITEMS) {
    stocks[item.symbol] = createInitialStock(item);
  }

  return {
    createdAt: Math.max(0, Math.floor(Number(now) || Date.now())),
    lastUpdatedAt: Math.max(0, Math.floor(Number(now) || Date.now())),
    nextTickAt: Math.max(0, Math.floor(Number(now) || Date.now())) + STOCK_MARKET_TICK_MS,
    stocks
  };
}

export function advanceStockMarket(state = null, now = Date.now()) {
  const market = state && typeof state === 'object'
    ? state
    : createInitialStockMarketState(now);
  if (!market.stocks || typeof market.stocks !== 'object') {
    market.stocks = {};
  }
  for (const item of STOCK_MARKET_ITEMS) {
    market.stocks[item.symbol] = normalizeStockState(item, market.stocks[item.symbol]);
  }

  const safeNow = Math.max(0, Math.floor(Number(now) || Date.now()));
  let nextTickAt = Math.max(
    Number(market.nextTickAt ?? 0) || 0,
    (Number(market.lastUpdatedAt ?? safeNow) || safeNow) + STOCK_MARKET_TICK_MS
  );
  let tickCount = 0;

  while (safeNow >= nextTickAt && tickCount < STOCK_MARKET_MAX_CATCH_UP_TICKS) {
    for (const item of STOCK_MARKET_ITEMS) {
      tickStock(item, market.stocks[item.symbol]);
    }
    market.lastUpdatedAt = nextTickAt;
    nextTickAt += STOCK_MARKET_TICK_MS;
    tickCount += 1;
  }

  market.nextTickAt = nextTickAt;
  return market;
}

function getPortfolioEntry(portfolio, symbol) {
  if (!portfolio) {
    return { shares: 0, averageCost: 0 };
  }

  const entry = portfolio instanceof Map
    ? portfolio.get(symbol)
    : portfolio[symbol];
  return {
    shares: Math.max(0, Math.floor(Number(entry?.shares ?? 0) || 0)),
    averageCost: roundCents(entry?.averageCost ?? entry?.avgCost ?? 0)
  };
}

function setPortfolioEntry(portfolio, symbol, entry) {
  const nextEntry = {
    shares: Math.max(0, Math.floor(Number(entry?.shares ?? 0) || 0)),
    averageCost: roundCents(entry?.averageCost ?? 0)
  };

  if (nextEntry.shares <= 0) {
    if (portfolio instanceof Map) {
      portfolio.delete(symbol);
    } else if (portfolio && typeof portfolio === 'object') {
      delete portfolio[symbol];
    }
    return;
  }

  if (portfolio instanceof Map) {
    portfolio.set(symbol, nextEntry);
  } else if (portfolio && typeof portfolio === 'object') {
    portfolio[symbol] = nextEntry;
  }
}

export function serializeStockMarket(state, portfolio = {}, cash = 0, now = Date.now()) {
  const market = advanceStockMarket(state, now);
  let portfolioValue = 0;
  let sessionChangePercent = 0;

  const stocks = STOCK_MARKET_ITEMS.map((item) => {
    const stock = normalizeStockState(item, market.stocks[item.symbol]);
    const history = normalizeHistory(stock.history, stock.price);
    const previousPrice = history.length > 1 ? history[history.length - 2] : stock.price;
    const delta = roundCents(stock.price - previousPrice);
    const deltaPercent = previousPrice > 0 ? roundCents((delta / previousPrice) * 100) : 0;
    const owned = getPortfolioEntry(portfolio, item.symbol);
    const marketValue = roundWholeMoney(stock.price * owned.shares);
    const costBasis = owned.averageCost * owned.shares;
    const unrealizedProfit = Math.trunc(marketValue - costBasis);
    portfolioValue += marketValue;
    sessionChangePercent += deltaPercent;

    return {
      symbol: item.symbol,
      name: item.name,
      sector: item.sector,
      icon: item.icon,
      accent: item.accent,
      basePrice: item.basePrice,
      minPrice: item.minPrice,
      maxPrice: item.maxPrice,
      price: stock.price,
      previousPrice,
      delta,
      deltaPercent,
      velocity: stock.velocity,
      mode: stock.mode,
      modeLabel: STOCK_MARKET_MODES[stock.mode]?.label ?? 'Sideways',
      history,
      shares: owned.shares,
      averageCost: owned.averageCost,
      marketValue,
      unrealizedProfit
    };
  });

  const averageChange = stocks.length ? sessionChangePercent / stocks.length : 0;
  const marketMood = averageChange > 1.25
    ? 'Risk On'
    : averageChange < -1.25
      ? 'Risk Off'
      : 'Mixed Tape';

  return {
    ok: true,
    cash: Math.trunc(Number(cash ?? 0) || 0),
    portfolioValue,
    netWorth: Math.trunc(Number(cash ?? 0) || 0) + portfolioValue,
    feeRate: STOCK_MARKET_FEE_RATE,
    tickMs: STOCK_MARKET_TICK_MS,
    updatedAt: market.lastUpdatedAt ?? now,
    nextTickAt: market.nextTickAt ?? (now + STOCK_MARKET_TICK_MS),
    marketMood,
    stocks
  };
}

export function executeStockTrade({
  state,
  portfolio = {},
  cash = 0,
  symbol = '',
  side = '',
  quantity = 1,
  now = Date.now()
} = {}) {
  const market = advanceStockMarket(state, now);
  const normalizedSymbol = normalizeStockSymbol(symbol);
  const normalizedSide = normalizeStockTradeSide(side);
  const normalizedQuantity = normalizeStockTradeQuantity(quantity);
  const item = getStockMarketItem(normalizedSymbol);

  if (!item || !normalizedSymbol) {
    return { ok: false, error: 'That stock is not listed.' };
  }

  if (!normalizedSide) {
    return { ok: false, error: 'Choose buy or sell.' };
  }

  const stock = normalizeStockState(item, market.stocks[normalizedSymbol]);
  market.stocks[normalizedSymbol] = stock;
  const entry = getPortfolioEntry(portfolio, normalizedSymbol);
  let nextCash = Math.trunc(Number(cash ?? 0) || 0);
  const gross = getStockTradeValue(stock.price, normalizedQuantity);
  const fee = Math.ceil(gross * STOCK_MARKET_FEE_RATE);

  if (normalizedSide === 'buy') {
    const total = gross + fee;
    if (nextCash < total) {
      return {
        ok: false,
        error: `You need $${total.toLocaleString('en-US')} to buy ${normalizedQuantity} ${normalizedSymbol}.`
      };
    }

    const nextShares = entry.shares + normalizedQuantity;
    const nextAverageCost = nextShares > 0
      ? ((entry.shares * entry.averageCost) + gross) / nextShares
      : 0;
    nextCash -= total;
    setPortfolioEntry(portfolio, normalizedSymbol, {
      shares: nextShares,
      averageCost: nextAverageCost
    });

    return {
      ok: true,
      cash: nextCash,
      trade: {
        side: normalizedSide,
        symbol: normalizedSymbol,
        quantity: normalizedQuantity,
        price: stock.price,
        gross,
        fee,
        total,
        cashDelta: -total
      },
      market: serializeStockMarket(market, portfolio, nextCash, now)
    };
  }

  if (entry.shares < normalizedQuantity) {
    return {
      ok: false,
      error: `You only own ${entry.shares.toLocaleString('en-US')} ${normalizedSymbol}.`
    };
  }

  const proceeds = Math.max(0, gross - fee);
  nextCash += proceeds;
  setPortfolioEntry(portfolio, normalizedSymbol, {
    shares: entry.shares - normalizedQuantity,
    averageCost: entry.averageCost
  });

  return {
    ok: true,
    cash: nextCash,
    trade: {
      side: normalizedSide,
      symbol: normalizedSymbol,
      quantity: normalizedQuantity,
      price: stock.price,
      gross,
      fee,
      proceeds,
      cashDelta: proceeds
    },
    market: serializeStockMarket(market, portfolio, nextCash, now)
  };
}
