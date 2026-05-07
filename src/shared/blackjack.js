export const BLACKJACK_MIN_WAGER = 0;
export const BLACKJACK_DEFAULT_WAGER = 10;
export const BLACKJACK_MAX_WAGER = 500;
export const BLACKJACK_DEALER_STAND_VALUE = 17;
export const BLACKJACK_PROMPT_RADIUS = 5.2;

const SUITS = Object.freeze(['S', 'H', 'D', 'C']);
const RANKS = Object.freeze(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
const HIGH_CARD_RANKS = new Set(['10', 'J', 'Q', 'K']);

function clampWholeNumber(value, fallback, min, max) {
  const numeric = Number(value);
  const whole = Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
  return Math.max(min, Math.min(max, whole));
}

function createDeck() {
  const cards = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        rank,
        suit,
        code: `${rank}${suit}`
      });
    }
  }
  return cards;
}

function shuffleDeck(deck, rng = Math.random) {
  const cards = [...deck];
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(rng() * (index + 1));
    [cards[index], cards[randomIndex]] = [cards[randomIndex], cards[index]];
  }
  return cards;
}

function drawCard(session) {
  if (!session.deck?.length) {
    session.deck = shuffleDeck(createDeck(), session.rng);
  }
  return session.deck.pop();
}

function drawToHand(session, handKey) {
  const card = drawCard(session);
  session[handKey].push(card);
  return card;
}

export function normalizeBlackjackWager(value, { allowPractice = true } = {}) {
  const min = allowPractice ? BLACKJACK_MIN_WAGER : 1;
  return clampWholeNumber(value, BLACKJACK_DEFAULT_WAGER, min, BLACKJACK_MAX_WAGER);
}

export function isBlackjackDealerNpc(npc = null) {
  return npc?.blackjackDealerEnabled === true;
}

export function getBlackjackPromptRadius(npc = null, fallbackRadius = BLACKJACK_PROMPT_RADIUS) {
  const radius = Number(npc?.interactRadius ?? fallbackRadius);
  return Math.max(1.5, Number.isFinite(radius) ? radius : fallbackRadius);
}

export function getCardValue(rank = '') {
  if (rank === 'A') {
    return 11;
  }
  if (HIGH_CARD_RANKS.has(rank)) {
    return 10;
  }
  const numeric = Number(rank);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function getBlackjackHandValue(cards = []) {
  let value = 0;
  let aces = 0;
  for (const card of cards) {
    value += getCardValue(card?.rank);
    if (card?.rank === 'A') {
      aces += 1;
    }
  }
  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }
  return value;
}

export function isSoftBlackjackHand(cards = []) {
  let value = 0;
  let aces = 0;
  for (const card of cards) {
    value += getCardValue(card?.rank);
    if (card?.rank === 'A') {
      aces += 1;
    }
  }
  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }
  return aces > 0 && value <= 21;
}

export function isNaturalBlackjack(cards = []) {
  return cards.length === 2 && getBlackjackHandValue(cards) === 21;
}

function getResultMessage(outcome, payout = 0, wager = 0) {
  if (outcome === 'blackjack') {
    return `Blackjack pays ${payout}.`;
  }
  if (outcome === 'win') {
    return `You win ${Math.max(0, payout - wager)}.`;
  }
  if (outcome === 'push') {
    return 'Push. Your wager comes back.';
  }
  if (outcome === 'dealer_blackjack') {
    return 'Dealer has blackjack.';
  }
  if (outcome === 'bust') {
    return 'Bust. Dealer takes the hand.';
  }
  if (outcome === 'dealer_win') {
    return 'Dealer wins the hand.';
  }
  return 'Place a wager and deal.';
}

function calculatePayout(outcome, wager) {
  if (wager <= 0) {
    return 0;
  }
  if (outcome === 'blackjack') {
    return Math.floor(wager * 2.5);
  }
  if (outcome === 'win') {
    return wager * 2;
  }
  if (outcome === 'push') {
    return wager;
  }
  return 0;
}

function finishSession(session, outcome) {
  const payout = calculatePayout(outcome, session.wager);
  session.phase = 'complete';
  session.outcome = outcome;
  session.payout = payout;
  session.message = getResultMessage(outcome, payout, session.wager);
  return session;
}

function compareHands(session) {
  const playerValue = getBlackjackHandValue(session.playerHand);
  const dealerValue = getBlackjackHandValue(session.dealerHand);
  if (dealerValue > 21) {
    return finishSession(session, 'win');
  }
  if (playerValue > dealerValue) {
    return finishSession(session, 'win');
  }
  if (playerValue === dealerValue) {
    return finishSession(session, 'push');
  }
  return finishSession(session, 'dealer_win');
}

function playDealerHand(session) {
  while (getBlackjackHandValue(session.dealerHand) < BLACKJACK_DEALER_STAND_VALUE) {
    drawToHand(session, 'dealerHand');
  }
  return compareHands(session);
}

export function createBlackjackSession({
  npcId = '',
  wager = BLACKJACK_DEFAULT_WAGER,
  rng = Math.random,
  now = Date.now()
} = {}) {
  const session = {
    id: `blackjack_${Math.max(0, Math.floor(now))}_${Math.floor(rng() * 100000)}`,
    npcId: String(npcId ?? ''),
    wager: normalizeBlackjackWager(wager),
    deck: shuffleDeck(createDeck(), rng),
    playerHand: [],
    dealerHand: [],
    phase: 'playerTurn',
    outcome: '',
    payout: 0,
    message: 'Hit, stand, or double.',
    startedAt: Math.max(0, Math.floor(now)),
    completedAt: 0,
    rng
  };

  drawToHand(session, 'playerHand');
  drawToHand(session, 'dealerHand');
  drawToHand(session, 'playerHand');
  drawToHand(session, 'dealerHand');

  const playerBlackjack = isNaturalBlackjack(session.playerHand);
  const dealerBlackjack = isNaturalBlackjack(session.dealerHand);
  if (playerBlackjack && dealerBlackjack) {
    return finishSession(session, 'push');
  }
  if (playerBlackjack) {
    return finishSession(session, 'blackjack');
  }
  if (dealerBlackjack) {
    return finishSession(session, 'dealer_blackjack');
  }

  return session;
}

export function hitBlackjackSession(session) {
  if (!session || session.phase !== 'playerTurn') {
    return session;
  }
  drawToHand(session, 'playerHand');
  const playerValue = getBlackjackHandValue(session.playerHand);
  if (playerValue > 21) {
    return finishSession(session, 'bust');
  }
  if (playerValue === 21) {
    return playDealerHand(session);
  }
  session.message = 'Hit, stand, or double.';
  return session;
}

export function standBlackjackSession(session) {
  if (!session || session.phase !== 'playerTurn') {
    return session;
  }
  session.phase = 'dealerTurn';
  return playDealerHand(session);
}

export function doubleBlackjackSession(session) {
  if (!session || session.phase !== 'playerTurn' || session.playerHand.length !== 2) {
    return session;
  }
  session.wager *= 2;
  drawToHand(session, 'playerHand');
  if (getBlackjackHandValue(session.playerHand) > 21) {
    return finishSession(session, 'bust');
  }
  return standBlackjackSession(session);
}

export function serializeBlackjackSession(session = null, {
  hideDealerHole = true,
  money = 0
} = {}) {
  if (!session) {
    return {
      phase: 'idle',
      outcome: '',
      wager: BLACKJACK_DEFAULT_WAGER,
      payout: 0,
      money,
      playerHand: [],
      dealerHand: [],
      playerValue: 0,
      dealerValue: 0,
      message: 'Place a wager and deal.',
      canHit: false,
      canStand: false,
      canDouble: false
    };
  }

  const concealDealer = hideDealerHole && session.phase === 'playerTurn';
  const dealerHand = session.dealerHand.map((card, index) =>
    concealDealer && index === 1
      ? { hidden: true, code: '??' }
      : { ...card }
  );
  const dealerVisibleCards = concealDealer
    ? session.dealerHand.slice(0, 1)
    : session.dealerHand;
  const canAct = session.phase === 'playerTurn';

  return {
    id: session.id,
    npcId: session.npcId,
    phase: session.phase,
    outcome: session.outcome,
    wager: session.wager,
    payout: session.payout,
    money,
    playerHand: session.playerHand.map((card) => ({ ...card })),
    dealerHand,
    playerValue: getBlackjackHandValue(session.playerHand),
    dealerValue: getBlackjackHandValue(dealerVisibleCards),
    message: session.message,
    canHit: canAct,
    canStand: canAct,
    canDouble: canAct && session.playerHand.length === 2 && Number(money) >= session.wager
  };
}
