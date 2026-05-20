import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import {
  BLACKJACK_TABLE_FOOTPRINT,
  CASINO_SLOT_MACHINE_FOOTPRINT,
  createBlackjackTableVisual,
  createCasinoSlotMachineVisual
} from '../src/world/proceduralProps.js';
import { getBuilderItemById } from '../src/world/builderCatalog.js';
import { assets } from '../src/world/assetManifest.js';
import { defaultWorldLayout } from '../src/world/defaultWorldLayout.js';
import { normalizeNpcBehavior } from '../src/npc/npcBehavior.js';
import {
  BLACKJACK_MAX_WAGER,
  canSplitBlackjackSession,
  createBlackjackSession,
  doubleBlackjackSession,
  getBlackjackHandValue,
  isBlackjackDealerNpc,
  isNaturalBlackjack,
  isSoftBlackjackHand,
  normalizeBlackjackWager,
  serializeBlackjackSession,
  splitBlackjackSession,
  standBlackjackSession
} from '../src/shared/blackjack.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getObjectBounds(root, name, label = 'visual') {
  const object = root.getObjectByName(name);
  assert(object, `${label} missing node "${name}".`);
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

function placementWithItemId(placements, itemId) {
  if (!placements) {
    return null;
  }
  for (const placement of placements) {
    if (placement.itemId === itemId) {
      return placement;
    }
  }
  return null;
}

function placementsWithItemId(placements, itemId) {
  const matchingPlacements = [];
  if (!placements) {
    return matchingPlacements;
  }
  for (const placement of placements) {
    if (placement.itemId === itemId) {
      matchingPlacements.push(placement);
    }
  }
  return matchingPlacements;
}

function hasBlackjackDealerNpc(npcs) {
  if (!npcs) {
    return false;
  }
  for (const npc of npcs) {
    if (npc.blackjackDealerEnabled === true) {
      return true;
    }
  }
  return false;
}

function validateSharedRules() {
  assert(getBlackjackHandValue([{ rank: 'A' }, { rank: '9' }, { rank: 'A' }]) === 21, 'Aces should be reduced without busting.');
  assert(isSoftBlackjackHand([{ rank: 'A' }, { rank: '9' }]), 'A+9 should be a soft hand.');
  assert(isSoftBlackjackHand([{ rank: 'A' }, { rank: 'A' }]), 'A+A should be a soft hand.');
  assert(isNaturalBlackjack([{ rank: 'A' }, { rank: 'K' }]), 'A+K should be a natural blackjack.');
  assert(BLACKJACK_MAX_WAGER === 1000000, 'Blackjack max wager should be $1,000,000.');
  assert(normalizeBlackjackWager(1000000) === 1000000, 'A $1,000,000 blackjack wager should be allowed.');
  assert(normalizeBlackjackWager(1000001) === 1000000, 'Blackjack wagers above $1,000,000 should clamp to the max.');

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

  const splitSession = {
    id: 'manual_split',
    npcId: 'npc_table',
    wager: 15,
    deck: [{ rank: '4', suit: 'C', code: '4C' }, { rank: '3', suit: 'D', code: '3D' }],
    playerHand: [{ rank: '8', suit: 'S', code: '8S' }, { rank: '8', suit: 'H', code: '8H' }],
    dealerHand: [{ rank: '10', suit: 'D', code: '10D' }, { rank: '8', suit: 'C', code: '8C' }],
    phase: 'playerTurn',
    outcome: '',
    payout: 0,
    message: '',
    rng: Math.random
  };
  assert(canSplitBlackjackSession(splitSession, 15), 'Pair should be eligible to split with enough cash.');
  splitBlackjackSession(splitSession);
  assert(splitSession.playerHands.length === 2, 'Split should create two player hands.');
  assert(splitSession.wager === 30, 'Split should add an equal second wager.');
  for (const hand of splitSession.playerHands) {
    assert(hand.cards.length === 2, 'Each split hand should receive one card.');
  }
  const splitPublicState = serializeBlackjackSession(splitSession, { money: 0 });
  assert(splitPublicState.split === true, 'Public state should mark split hands.');
  assert(splitPublicState.playerHands.length === 2, 'Public state should include both split hands.');
  assert(splitPublicState.canSplit === false, 'A split hand should not be split again.');
  standBlackjackSession(splitSession);
  standBlackjackSession(splitSession);
  assert(splitSession.phase === 'complete', 'Standing both split hands should complete the round.');
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

  const slotMachine = getBuilderItemById('slot_machine');
  assert(slotMachine, 'Slot machine builder item is missing.');
  assert(slotMachine.layer === 'prop', 'Slot machine should be a moveable prop.');
  assert(slotMachine.groupId === 'casino', 'Slot machine should live in the casino prop group.');
  assert(typeof slotMachine.createVisual === 'function', 'Slot machine should use a procedural visual.');
  assert(slotMachine.size[0] === CASINO_SLOT_MACHINE_FOOTPRINT[0], 'Slot machine footprint width should match the procedural constant.');
  assert(slotMachine.size[1] === CASINO_SLOT_MACHINE_FOOTPRINT[1], 'Slot machine footprint depth should match the procedural constant.');
}

function validateTableModel() {
  const visual = createBlackjackTableVisual();
  visual.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(visual);
  const size = bounds.getSize(new THREE.Vector3());

  assert(size.x >= 5.2 && size.x <= BLACKJACK_TABLE_FOOTPRINT[0] + 0.25, 'Blackjack table width should fill its footprint.');
  assert(size.z >= 3.7 && size.z <= BLACKJACK_TABLE_FOOTPRINT[1] + 0.25, 'Blackjack table depth should fill its footprint.');
  assert(size.y >= 1.55 && size.y <= 1.9, 'Blackjack table height should match player scale.');

  const railBounds = getObjectBounds(visual, 'blackjackTablePaddedRail', 'Blackjack table');
  const feltBounds = getObjectBounds(visual, 'blackjackTableFelt', 'Blackjack table');
  const chipTrayBounds = getObjectBounds(visual, 'blackjackTableChipTray', 'Blackjack table');
  const shoeBounds = getObjectBounds(visual, 'blackjackTableCardShoe', 'Blackjack table');
  const dealerArcBounds = getObjectBounds(visual, 'blackjackTableDealerArc', 'Blackjack table');

  assert(feltBounds.max.y > railBounds.max.y, 'Felt should sit above the padded rail.');
  assert(chipTrayBounds.min.y > feltBounds.min.y, 'Chip tray should sit on top of the table.');
  assert(shoeBounds.min.y > feltBounds.min.y, 'Card shoe should sit on top of the table.');
  assert(dealerArcBounds.min.y >= feltBounds.min.y, 'Dealer markings should sit on the felt.');
  assert(visual.getObjectByName('blackjackTableCard1'), 'Blackjack table should include visible cards.');
  assert(visual.getObjectByName('blackjackTableChipStack1_1'), 'Blackjack table should include chip stacks.');
}

function validateSlotMachineModel() {
  const visual = createCasinoSlotMachineVisual();
  visual.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(visual);
  const size = bounds.getSize(new THREE.Vector3());

  assert(size.x >= 1.0 && size.x <= CASINO_SLOT_MACHINE_FOOTPRINT[0] + 0.35, 'Slot machine width should fill its footprint.');
  assert(size.z >= 0.75 && size.z <= CASINO_SLOT_MACHINE_FOOTPRINT[1] + 0.25, 'Slot machine depth should fill its footprint.');
  assert(size.y >= 2.2 && size.y <= 2.6, 'Slot machine height should match player scale.');

  const bodyBounds = getObjectBounds(visual, 'casinoSlotMachineBody', 'Slot machine');
  const screenBounds = getObjectBounds(visual, 'casinoSlotMachineScreen', 'Slot machine');
  const handleBounds = getObjectBounds(visual, 'casinoSlotMachinePullHandle', 'Slot machine');

  assert(screenBounds.min.z > bodyBounds.max.z - 0.12, 'Slot machine screen should sit on the front face.');
  assert(handleBounds.min.x > bodyBounds.max.x - 0.12, 'Slot machine handle should sit on the side.');
  assert(visual.userData.casinoSlotMachineProp === true, 'Slot machine should identify itself as a casino prop visual.');
}

function assertSlotMachinesLeftOfBlackjack(layout, label) {
  const blackjackTable = placementWithItemId(layout.props, 'blackjack_table');
  const slotMachines = placementsWithItemId(layout.props, 'slot_machine');

  assert(blackjackTable, `${label} should include a blackjack table placement.`);
  assert(slotMachines.length >= 4, `${label} should include moveable slot machine placements.`);
  for (const placement of slotMachines) {
    assert(
      Number(placement.position?.[0]) < Number(blackjackTable.position?.[0]),
      `${label} slot machines should be positioned to the left of the blackjack table.`
    );
    assert(
      placement.rotationQuarterTurns === 1,
      `${label} slot machines should face right from the left side.`
    );
  }
}

async function validateCheckedInPlacements() {
  assert(
    placementWithItemId(defaultWorldLayout.props, 'blackjack_table'),
    'Default world should include a blackjack table placement.'
  );
  assert(
    hasBlackjackDealerNpc(defaultWorldLayout.npcs),
    'Default world should include a blackjack dealer NPC.'
  );
  assertSlotMachinesLeftOfBlackjack(defaultWorldLayout, 'Default world');

  const savedLayout = JSON.parse(await readFile(new URL('../server/data/world-layout.json', import.meta.url), 'utf8'));
  assert(
    placementWithItemId(savedLayout.props, 'blackjack_table'),
    'Fallback saved world layout should include a blackjack table placement.'
  );
  assert(
    hasBlackjackDealerNpc(savedLayout.npcs),
    'Fallback saved world layout should include a blackjack dealer NPC.'
  );
  assertSlotMachinesLeftOfBlackjack(savedLayout, 'Fallback saved world');
}

async function validateCasinoBuildingGenerator() {
  const source = await readFile(new URL('./generate-district-buildings.mjs', import.meta.url), 'utf8');
  assert(
    /const CASINO_GREEN_TABLE_POSITIONS = Object\.freeze\(\[\s*\[\s*-5\.8,\s*0,\s*-2\.5\s*\],\s*\[\s*0,\s*0,\s*-0\.6\s*\],\s*\[\s*5\.8,\s*0,\s*-2\.5\s*\]\s*\]\);/m.test(source),
    'Casino green tables should be moved downward in the generated casino interior.'
  );
  assert(
    !/addSlotMachine\(groups\.interior/.test(source),
    'Casino slot machines should not be baked into the generated building; they should stay moveable props.'
  );
}

async function validateBlackjackAudio() {
  assert(assets.audio.playingCard, 'Blackjack card-deal audio should be registered.');
  const audioBuffer = await readFile(new URL(assets.audio.playingCard));
  assert(audioBuffer.length > 12, 'Blackjack card-deal audio should not be empty.');
  const hasId3Header = audioBuffer.subarray(0, 3).toString('ascii') === 'ID3';
  const hasFrameSync = audioBuffer[0] === 0xff && (audioBuffer[1] & 0xe0) === 0xe0;
  assert(hasId3Header || hasFrameSync, 'Blackjack card-deal audio should be an MP3 file.');
}

async function main() {
  validateSharedRules();
  validateNpcFlag();
  validateBuilderDefinition();
  validateTableModel();
  validateSlotMachineModel();
  await validateCasinoBuildingGenerator();
  await validateBlackjackAudio();
  await validateCheckedInPlacements();
  console.log('Blackjack validation passed.');
}

await main();
