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

function drawToCards(session, cards = []) {
  const card = drawCard(session);
  cards.push(card);
  return card;
}

function drawToHand(session, handKey) {
  if (!Array.isArray(session?.[handKey])) {
    session[handKey] = [];
  }
  return drawToCards(session, session[handKey]);
}

function isSplitBlackjackSession(session = null) {
  return Array.isArray(session?.playerHands) && session.playerHands.length > 1;
}

function getActiveHandIndex(session = null) {
  if (!isSplitBlackjackSession(session)) {
    return 0;
  }
  const index = Math.trunc(Number(session.activeHandIndex ?? 0) || 0);
  return Math.max(0, Math.min(session.playerHands.length - 1, index));
}

function getActivePlayerHand(session = null) {
  if (isSplitBlackjackSession(session)) {
    return session.playerHands[getActiveHandIndex(session)] ?? session.playerHands[0] ?? null;
  }
  return session
    ? {
      cards: session.playerHand,
      wager: session.wager,
      outcome: session.outcome,
      payout: session.payout
    }
    : null;
}

function getActivePlayerCards(session = null) {
  const activeHand = getActivePlayerHand(session);
  return Array.isArray(activeHand?.cards) ? activeHand.cards : [];
}

function syncActivePlayerHand(session = null) {
  if (isSplitBlackjackSession(session)) {
    session.activeHandIndex = getActiveHandIndex(session);
    session.playerHand = getActivePlayerCards(session);
  }
  return session;
}

function syncSplitWager(session = null) {
  if (isSplitBlackjackSession(session)) {
    session.wager = session.playerHands.reduce((total, hand) =>
      total + Math.max(0, Math.trunc(Number(hand?.wager ?? 0) || 0)), 0);
  }
  return session;
}

function createSplitHand(cards = [], wager = 0, index = 0) {
  return {
    id: `hand_${index + 1}`,
    cards,
    wager: Math.max(0, Math.trunc(Number(wager ?? 0) || 0)),
    outcome: '',
    payout: 0
  };
}

function getSplitTurnMessage(session = null) {
  const activeIndex = getActiveHandIndex(session);
  const handCount = Math.max(1, session?.playerHands?.length ?? 1);
  return `Hand ${activeIndex + 1} of ${handCount}: hit, stand, or double.`;
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

export function isBlackjackPair(cards = []) {
  return cards.length === 2
    && String(cards[0]?.rank ?? '') !== ''
    && String(cards[0]?.rank ?? '') === String(cards[1]?.rank ?? '');
}

export function getBlackjackSplitWager(session = null) {
  if (!session || isSplitBlackjackSession(session)) {
    return 0;
  }
  return Math.max(0, Math.trunc(Number(session.wager ?? 0) || 0));
}

export function getBlackjackDoubleWager(session = null) {
  const activeHand = getActivePlayerHand(session);
  return Math.max(0, Math.trunc(Number(activeHand?.wager ?? session?.wager ?? 0) || 0));
}

export function canSplitBlackjackSession(session = null, money = Infinity) {
  if (!session || session.phase !== 'playerTurn' || isSplitBlackjackSession(session)) {
    return false;
  }
  const splitWager = getBlackjackSplitWager(session);
  return isBlackjackPair(session.playerHand)
    && Number(money) >= splitWager;
}

export function canDoubleBlackjackSession(session = null, money = Infinity) {
  if (!session || session.phase !== 'playerTurn') {
    return false;
  }
  const activeCards = getActivePlayerCards(session);
  return activeCards.length === 2
    && Number(money) >= getBlackjackDoubleWager(session);
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

function getHandComparisonOutcome(cards = [], dealerValue = 0) {
  const playerValue = getBlackjackHandValue(cards);
  if (playerValue > 21) {
    return 'bust';
  }
  if (dealerValue > 21) {
    return 'win';
  }
  if (playerValue > dealerValue) {
    return 'win';
  }
  if (playerValue === dealerValue) {
    return 'push';
  }
  return 'dealer_win';
}

function getSplitAggregateOutcome(session) {
  const hands = Array.isArray(session?.playerHands) ? session.playerHands : [];
  const totalWager = Math.max(0, Math.trunc(Number(session?.wager ?? 0) || 0));
  const totalPayout = Math.max(0, Math.trunc(Number(session?.payout ?? 0) || 0));
  if (totalWager > 0) {
    if (totalPayout > totalWager) {
      return 'win';
    }
    if (totalPayout === totalWager) {
      return 'push';
    }
  }
  if (hands.every((hand) => hand?.outcome === 'bust')) {
    return 'bust';
  }
  if (hands.some((hand) => hand?.outcome === 'win')) {
    return 'win';
  }
  if (hands.every((hand) => hand?.outcome === 'push')) {
    return 'push';
  }
  return 'dealer_win';
}

function getSplitHandOutcomeLabel(outcome = '') {
  if (outcome === 'win') {
    return 'wins';
  }
  if (outcome === 'push') {
    return 'pushes';
  }
  if (outcome === 'bust') {
    return 'busts';
  }
  return 'loses';
}

function getSplitResultMessage(session) {
  const summaries = session.playerHands
    .map((hand, index) => `Hand ${index + 1} ${getSplitHandOutcomeLabel(hand?.outcome)}`)
    .join(', ');
  return `Split settled: ${summaries}.`;
}

function finishSplitSession(session) {
  if (!isSplitBlackjackSession(session)) {
    return session;
  }

  const dealerValue = getBlackjackHandValue(session.dealerHand);
  for (const hand of session.playerHands) {
    if (hand.outcome !== 'bust') {
      hand.outcome = getHandComparisonOutcome(hand.cards, dealerValue);
    }
    hand.payout = calculatePayout(hand.outcome, hand.wager);
  }
  syncSplitWager(session);
  session.phase = 'complete';
  session.payout = session.playerHands.reduce((total, hand) =>
    total + Math.max(0, Math.trunc(Number(hand?.payout ?? 0) || 0)), 0);
  session.outcome = getSplitAggregateOutcome(session);
  session.message = getSplitResultMessage(session);
  return syncActivePlayerHand(session);
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
  if (isSplitBlackjackSession(session)) {
    const hasLiveHand = session.playerHands.some((hand) => hand?.outcome !== 'bust');
    if (hasLiveHand) {
      while (getBlackjackHandValue(session.dealerHand) < BLACKJACK_DEALER_STAND_VALUE) {
        drawToHand(session, 'dealerHand');
      }
    }
    return finishSplitSession(session);
  }

  while (getBlackjackHandValue(session.dealerHand) < BLACKJACK_DEALER_STAND_VALUE) {
    drawToHand(session, 'dealerHand');
  }
  return compareHands(session);
}

function advanceSplitHand(session) {
  if (!isSplitBlackjackSession(session)) {
    return session;
  }

  const nextIndex = session.playerHands.findIndex((hand) => !hand?.outcome);
  if (nextIndex >= 0) {
    session.activeHandIndex = nextIndex;
    syncActivePlayerHand(session);
    session.message = getSplitTurnMessage(session);
    return session;
  }

  session.phase = 'dealerTurn';
  return playDealerHand(session);
}

function resolveSplitTwentyOne(session) {
  while (isSplitBlackjackSession(session) && session.phase === 'playerTurn') {
    const activeHand = getActivePlayerHand(session);
    if (!activeHand || activeHand.outcome) {
      advanceSplitHand(session);
      continue;
    }
    if (getBlackjackHandValue(activeHand.cards) !== 21) {
      session.message = getSplitTurnMessage(session);
      return syncActivePlayerHand(session);
    }
    activeHand.outcome = 'stand';
    advanceSplitHand(session);
  }
  return syncActivePlayerHand(session);
}

function finishActiveSplitHand(session, outcome = 'stand') {
  const activeHand = getActivePlayerHand(session);
  if (!activeHand || activeHand.outcome) {
    return advanceSplitHand(session);
  }
  activeHand.outcome = outcome;
  return resolveSplitTwentyOne(advanceSplitHand(session));
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

  if (isSplitBlackjackSession(session)) {
    const activeHand = getActivePlayerHand(session);
    if (!activeHand || activeHand.outcome) {
      return advanceSplitHand(session);
    }
    drawToCards(session, activeHand.cards);
    const playerValue = getBlackjackHandValue(activeHand.cards);
    if (playerValue > 21) {
      return finishActiveSplitHand(session, 'bust');
    }
    if (playerValue === 21) {
      return finishActiveSplitHand(session, 'stand');
    }
    session.message = getSplitTurnMessage(session);
    return syncActivePlayerHand(session);
  }

  drawToCards(session, session.playerHand);
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
  if (isSplitBlackjackSession(session)) {
    return finishActiveSplitHand(session, 'stand');
  }
  session.phase = 'dealerTurn';
  return playDealerHand(session);
}

export function doubleBlackjackSession(session) {
  if (!canDoubleBlackjackSession(session)) {
    return session;
  }

  if (isSplitBlackjackSession(session)) {
    const activeHand = getActivePlayerHand(session);
    activeHand.wager *= 2;
    syncSplitWager(session);
    drawToCards(session, activeHand.cards);
    if (getBlackjackHandValue(activeHand.cards) > 21) {
      return finishActiveSplitHand(session, 'bust');
    }
    return finishActiveSplitHand(session, 'stand');
  }

  session.wager *= 2;
  drawToCards(session, session.playerHand);
  if (getBlackjackHandValue(session.playerHand) > 21) {
    return finishSession(session, 'bust');
  }
  return standBlackjackSession(session);
}

export function splitBlackjackSession(session) {
  if (!canSplitBlackjackSession(session)) {
    return session;
  }

  const splitWager = getBlackjackSplitWager(session);
  const [firstCard, secondCard] = session.playerHand;
  session.playerHands = [
    createSplitHand([firstCard], splitWager, 0),
    createSplitHand([secondCard], splitWager, 1)
  ];
  session.activeHandIndex = 0;
  session.outcome = '';
  session.payout = 0;
  session.message = getSplitTurnMessage(session);
  syncSplitWager(session);
  syncActivePlayerHand(session);
  drawToCards(session, session.playerHands[0].cards);
  drawToCards(session, session.playerHands[1].cards);
  return resolveSplitTwentyOne(session);
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
      canDouble: false,
      canSplit: false,
      split: false,
      activeHandIndex: 0,
      playerHands: []
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
  syncActivePlayerHand(session);
  syncSplitWager(session);
  const split = isSplitBlackjackSession(session);
  const activeHandIndex = getActiveHandIndex(session);
  const activeHand = getActivePlayerHand(session);
  const activeCards = getActivePlayerCards(session);
  const playerHands = split
    ? session.playerHands.map((hand, index) => ({
      id: hand.id ?? `hand_${index + 1}`,
      label: `Hand ${index + 1}`,
      cards: Array.isArray(hand.cards) ? hand.cards.map((card) => ({ ...card })) : [],
      value: getBlackjackHandValue(hand.cards),
      wager: hand.wager,
      outcome: hand.outcome,
      payout: hand.payout,
      active: canAct && index === activeHandIndex
    }))
    : [{
      id: 'hand_1',
      label: 'Your Hand',
      cards: session.playerHand.map((card) => ({ ...card })),
      value: getBlackjackHandValue(session.playerHand),
      wager: session.wager,
      outcome: session.outcome,
      payout: session.payout,
      active: canAct
    }];

  return {
    id: session.id,
    npcId: session.npcId,
    phase: session.phase,
    outcome: session.outcome,
    wager: session.wager,
    payout: session.payout,
    money,
    split,
    activeHandIndex,
    playerHands,
    playerHand: activeCards.map((card) => ({ ...card })),
    dealerHand,
    playerValue: getBlackjackHandValue(activeCards),
    dealerValue: getBlackjackHandValue(dealerVisibleCards),
    message: session.message,
    canHit: canAct && !activeHand?.outcome,
    canStand: canAct && !activeHand?.outcome,
    canDouble: canDoubleBlackjackSession(session, Number(money)),
    canSplit: canSplitBlackjackSession(session, Number(money))
  };
}
