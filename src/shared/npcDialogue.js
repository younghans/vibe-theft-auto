const CAPABILITIES = Object.freeze([
  ['deliveryQuestEnabled', 'delivery jobs'],
  ['gymCheckInEnabled', 'gym check-ins'],
  ['rentCollectorEnabled', 'rent collection'],
  ['stockMarketEnabled', 'stock trading'],
  ['bartenderEnabled', 'bar orders'],
  ['pawnShopOwnerEnabled', 'pawn shop sales'],
  ['carDealerEnabled', 'car sales'],
  ['marthaEnabled', "Martha's Grille food"],
  ['blackjackDealerEnabled', 'blackjack'],
  ['schoolMicrogameEnabled', 'school challenges']
]);

const PROFILES = Object.freeze({
  pawn: ['pawnShopOwnerEnabled', 'roth|pawn|cigarette|pistol', 'pawn shop prices', 'Cash first.'],
  carDealer: ['carDealerEnabled', 'car dealer|dealership|toyota|ae86|fiat|duna|car', 'car prices', 'Pick your keys, then hold Shift.'],
  martha: ['marthaEnabled', 'martha|grille|burger|glizzy|soda', "Martha's Grille menu", 'Eat up, sugar.'],
  bartender: ['bartenderEnabled', 'bartender|bar|beer|shot|drink', 'bar orders', 'Sip slower than you talk.'],
  teacher: ['schoolMicrogameEnabled', 'professor|teacher|school|quiz', 'school challenge', 'Show your work.'],
  gym: ['gymCheckInEnabled', 'bruno|gym|training|workout|barbell', 'gym training', 'Keep your form tight.'],
  broker: ['stockMarketEnabled', 'stock|market|shares|portfolio|trading', 'market read', 'Patience beats panic.'],
  fixer: ['deliveryQuestEnabled', 'shady|fixer|delivery|package|quick cash', 'package and payout', 'Keep it quiet.'],
  android: ['', 'sketch|android|prototype|robot|game level', 'quest logic', 'Chaos logged.'],
  hustler: ['', 'maya|hustler|rumor|rumour|sarcastic', 'hustle lead', 'Timing beats noise.'],
  officer: ['', 'gary|police|chief|cop|badge', 'straight answer', 'Facts, not theater.'],
  dealer: ['blackjackDealerEnabled', 'blackjack|casino|cards|dealer', 'blackjack table', 'Cards answer cleanly.'],
  local: ['', '', 'local lead', 'Keep your head up.']
});

const SERVICE_INTENTS = Object.freeze({
  delivery: ['deliveryQuestEnabled', 'fixer'],
  gym: ['gymCheckInEnabled', 'gym'],
  school: ['schoolMicrogameEnabled', 'teacher'],
  blackjack: ['blackjackDealerEnabled', 'dealer'],
  stock: ['stockMarketEnabled', 'broker'],
  drink: ['bartenderEnabled', 'bartender'],
  shop: ['pawnShopOwnerEnabled', 'pawn'],
  car: ['carDealerEnabled', 'carDealer'],
  food: ['marthaEnabled', 'martha']
});

const INTENTS = Object.freeze([
  ['delivery', 'deliver|delivery|package|dropoff|drop off|courier'],
  ['gym', 'gym|train|training|workout|lift|membership|snatch|exercise'],
  ['school', 'school|quiz|class|teacher|test|study|learn|microgame'],
  ['blackjack', 'blackjack|cards|dealer|bet|wager|casino'],
  ['stock', 'stock|market|share|shares|portfolio|invest|trade|trading'],
  ['drink', 'bar|beer|shot|drink|drunk|bartender'],
  ['food', 'martha|grille|burger|glizzy|soda|food|eat|hungry'],
  ['car', 'car|vehicle|drive|toyota|ae86|fiat|duna|dealership'],
  ['shop', 'price|buy|sell|shop|cost|weapon|gun|pistol|cigarette'],
  ['work', 'job|work|mission|task|quest|hustle'],
  ['money', 'money|cash|paid|payout|rich|earn'],
  ['trouble', 'fight|punch|shoot|kill|trouble|danger|heat|police|cop'],
  ['identity', 'who are you|your name|what are you|what do you do'],
  ['location', 'where|map|find|location|place']
]);

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function lowerText(value) {
  return normalizeText(value).toLowerCase();
}

function hasAny(text, terms) {
  return terms.split('|').some((term) => term && text.includes(term));
}

function chooseFreshLine(lines, transcript = []) {
  const recent = new Set(
    (Array.isArray(transcript) ? transcript.slice(-8) : [])
      .filter((entry) => String(entry?.speaker ?? '').toLowerCase() === 'npc')
      .map((entry) => normalizeText(entry?.text))
  );
  return lines.find((line) => line && !recent.has(line)) || lines.find(Boolean) || 'I hear you. Keep moving.';
}

function getServiceReply(profileKey, profile) {
  if (profileKey === 'pawn') {
    return 'Cigarettes $20, pistol $50. Cash first.';
  }
  if (profileKey === 'carDealer') {
    return 'Toyota AE86 $10000, Fiat Duna $5000. Hold Shift to drive.';
  }
  if (profileKey === 'martha') {
    return 'Burger $20, glizzy $10, soda $10. They patch you right up.';
  }
  if (profileKey === 'dealer') {
    return 'Blackjack: hit, stand, double, or split without busting.';
  }
  if (profileKey === 'fixer') {
    return 'Package and payout. Keep it quiet.';
  }
  if (profileKey === 'gym') {
    return 'Membership starts at the barbell.';
  }
  if (profileKey === 'teacher') {
    return 'School challenge ready; focus beats panic.';
  }
  if (profileKey === 'bartender') {
    return 'Beer is easy, shots hit quicker.';
  }
  if (profileKey === 'broker') {
    return 'Watch market mood before you buy.';
  }
  return `I can help with ${profile[2]}. ${profile[3]}`;
}

export function describeNpcCapabilities(npc = {}) {
  const labels = CAPABILITIES.filter(([flag]) => npc?.[flag] === true).map(([, label]) => label);
  return labels.length ? labels.join(', ') : 'ambient conversation only';
}

export function getNpcDialogueProfileKey(npc = {}) {
  const haystack = `${lowerText(npc?.name)} ${lowerText(npc?.prompt)}`;
  for (const [key, profile] of Object.entries(PROFILES)) {
    if (key !== 'local' && ((profile[0] && npc?.[profile[0]] === true) || hasAny(haystack, profile[1]))) {
      return key;
    }
  }
  return 'local';
}

export function detectNpcChatIntent(message = '') {
  const text = lowerText(message);
  for (const [intent, terms] of INTENTS) {
    if (hasAny(text, terms)) {
      return intent;
    }
  }
  if (/\b(thanks|thank you|appreciate|cheers)\b/u.test(text)) {
    return 'thanks';
  }
  if (/^(hi|hello|hey|yo|sup)\b/u.test(text)) {
    return 'greeting';
  }
  return /\?$|^(what|why|how|when|where|can|do|does|did|are|is|should|could|would)\b/u.test(text)
    ? 'question'
    : 'fallback';
}

function getProfileLines(profile, intent) {
  if (intent === 'identity') {
    return [profile[3]];
  }
  if (intent === 'money') {
    return [`${profile[3]} Cash needs a plan.`];
  }
  if (intent === 'trouble') {
    return [`${profile[3]} Trouble gets expensive fast.`];
  }
  if (intent === 'question' || intent === 'location' || intent === 'fallback' || intent === 'greeting' || intent === 'thanks') {
    return [profile[3]];
  }
  return [`I can help with ${profile[2]}. ${profile[3]}`, profile[3]];
}

export function buildNpcFallbackReply({ npc = {}, playerMessage = '', transcript = [] } = {}) {
  const profileKey = getNpcDialogueProfileKey(npc);
  const profile = PROFILES[profileKey] ?? PROFILES.local;
  const intent = detectNpcChatIntent(playerMessage);
  const service = SERVICE_INTENTS[intent];
  const serviceKey = profileKey === 'martha' && intent === 'shop'
    ? 'martha'
    : (service && (npc?.[service[0]] === true || profileKey === service[1]) ? service[1] : '');
  const lines = serviceKey
    ? [getServiceReply(serviceKey, PROFILES[serviceKey]), `I can help with ${profile[2]}. ${profile[3]}`]
    : getProfileLines(profile, intent);
  return chooseFreshLine(lines, transcript);
}
