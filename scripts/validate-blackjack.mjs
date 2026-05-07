import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import {
  BLACKJACK_TABLE_FOOTPRINT,
  createBlackjackTableVisual
} from '../src/world/proceduralProps.js';
import { getBuilderItemById } from '../src/world/builderCatalog.js';
import { assets } from '../src/world/assetManifest.js';
import { defaultWorldLayout } from '../src/world/defaultWorldLayout.js';
import { normalizeNpcBehavior } from '../src/npc/npcBehavior.js';
import {
  createBlackjackSession,
  doubleBlackjackSession,
  getBlackjackHandValue,
  isBlackjackDealerNpc,
  isNaturalBlackjack,
  isSoftBlackjackHand,
  serializeBlackjackSession
} from '../src/shared/blackjack.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getObjectBounds(root, name) {
  const object = root.getObjectByName(name);
  assert(object, `Blackjack table missing node "${name}".`);
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

function validateSharedRules() {
  assert(getBlackjackHandValue([{ rank: 'A' }, { rank: '9' }, { rank: 'A' }]) === 21, 'Aces should be reduced without busting.');
  assert(isSoftBlackjackHand([{ rank: 'A' }, { rank: '9' }]), 'A+9 should be a soft hand.');
  assert(isSoftBlackjackHand([{ rank: 'A' }, { rank: 'A' }]), 'A+A should be a soft hand.');
  assert(isNaturalBlackjack([{ rank: 'A' }, { rank: 'K' }]), 'A+K should be a natural blackjack.');

  const session = createBlackjackSession({ npcId: 'npc_table', wager: 25, rng: () => 0.42, now: 1234 });
  const publicState = serializeBlackjackSession(session, { money: 75 });
  if (session.phase === 'playerTurn') {
    assert(publicState.dealerHand[1]?.hidden === true, 'Dealer hole card should be hidden during the player turn.');
    assert(publicState.canHit && publicState.canStand, 'Player should be able to hit or stand during the player turn.');
  }

  const doubleSession = {
    id: 'manual_double',
    npcId: 'npc_table',
    wager: 10,
    deck: [{ rank: '7', suit: 'C', code: '7C' }, { rank: '10', suit: 'D', code: '10D' }],
    playerHand: [{ rank: '6', suit: 'S', code: '6S' }, { rank: '5', suit: 'H', code: '5H' }],
    dealerHand: [{ rank: '9', suit: 'D', code: '9D' }, { rank: '8', suit: 'C', code: '8C' }],
    phase: 'playerTurn',
    outcome: '',
    payout: 0,
    message: '',
    rng: Math.random
  };
  doubleBlackjackSession(doubleSession);
  assert(doubleSession.wager === 20, 'Double should double the wager.');
  assert(doubleSession.phase === 'complete', 'Double should finish the hand after one card.');
}

function validateNpcFlag() {
  const npc = normalizeNpcBehavior({
    modelId: 'xBot',
    name: 'Dealer',
    blackjackDealerEnabled: true
  }, {
    position: [0, 0],
    rotationQuarterTurns: 0
  });

  assert(isBlackjackDealerNpc(npc), 'Normalized NPC should preserve blackjackDealerEnabled.');
}

function validateBuilderDefinition() {
  const item = getBuilderItemById('blackjack_table');
  assert(item, 'Blackjack table builder item is missing.');
  assert(item.layer === 'prop', 'Blackjack table should be a prop.');
  assert(item.groupId === 'casino', 'Blackjack table should live in the casino prop group.');
  assert(typeof item.createVisual === 'function', 'Blackjack table should use a procedural visual.');
  assert(item.size[0] === BLACKJACK_TABLE_FOOTPRINT[0], 'Blackjack table footprint width should match the procedural constant.');
  assert(item.size[1] === BLACKJACK_TABLE_FOOTPRINT[1], 'Blackjack table footprint depth should match the procedural constant.');
}

function validateTableModel() {
  const visual = createBlackjackTableVisual();
  visual.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(visual);
  const size = bounds.getSize(new THREE.Vector3());

  assert(size.x >= 5.2 && size.x <= BLACKJACK_TABLE_FOOTPRINT[0] + 0.25, 'Blackjack table width should fill its footprint.');
  assert(size.z >= 3.7 && size.z <= BLACKJACK_TABLE_FOOTPRINT[1] + 0.25, 'Blackjack table depth should fill its footprint.');
  assert(size.y >= 1.55 && size.y <= 1.9, 'Blackjack table height should match player scale.');

  const railBounds = getObjectBounds(visual, 'blackjackTablePaddedRail');
  const feltBounds = getObjectBounds(visual, 'blackjackTableFelt');
  const chipTrayBounds = getObjectBounds(visual, 'blackjackTableChipTray');
  const shoeBounds = getObjectBounds(visual, 'blackjackTableCardShoe');
  const dealerArcBounds = getObjectBounds(visual, 'blackjackTableDealerArc');

  assert(feltBounds.max.y > railBounds.max.y, 'Felt should sit above the padded rail.');
  assert(chipTrayBounds.min.y > feltBounds.min.y, 'Chip tray should sit on top of the table.');
  assert(shoeBounds.min.y > feltBounds.min.y, 'Card shoe should sit on top of the table.');
  assert(dealerArcBounds.min.y >= feltBounds.min.y, 'Dealer markings should sit on the felt.');
  assert(visual.getObjectByName('blackjackTableCard1'), 'Blackjack table should include visible cards.');
  assert(visual.getObjectByName('blackjackTableChipStack1_1'), 'Blackjack table should include chip stacks.');
}

async function validateCheckedInPlacements() {
  assert(
    defaultWorldLayout.props.some((placement) => placement.itemId === 'blackjack_table'),
    'Default world should include a blackjack table placement.'
  );
  assert(
    defaultWorldLayout.npcs.some((npc) => npc.blackjackDealerEnabled === true),
    'Default world should include a blackjack dealer NPC.'
  );

  const savedLayout = JSON.parse(await readFile(new URL('../server/data/world-layout.json', import.meta.url), 'utf8'));
  assert(
    savedLayout.props?.some((placement) => placement.itemId === 'blackjack_table'),
    'Fallback saved world layout should include a blackjack table placement.'
  );
  assert(
    savedLayout.npcs?.some((npc) => npc.blackjackDealerEnabled === true),
    'Fallback saved world layout should include a blackjack dealer NPC.'
  );
}

async function validateBlackjackAudio() {
  assert(assets.audio.playingCard, 'Blackjack card-deal audio should be registered.');
  const audioBuffer = await readFile(new URL(assets.audio.playingCard));
  assert(audioBuffer.length > 12, 'Blackjack card-deal audio should not be empty.');
  assert(audioBuffer.subarray(0, 4).toString('ascii') === 'RIFF', 'Blackjack card-deal audio should be a WAV file.');
  assert(audioBuffer.subarray(8, 12).toString('ascii') === 'WAVE', 'Blackjack card-deal audio should have a WAVE header.');
}

async function main() {
  validateSharedRules();
  validateNpcFlag();
  validateBuilderDefinition();
  validateTableModel();
  await validateBlackjackAudio();
  await validateCheckedInPlacements();
  console.log('Blackjack validation passed.');
}

await main();
