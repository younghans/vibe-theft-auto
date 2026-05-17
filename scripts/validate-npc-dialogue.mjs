import assert from 'node:assert/strict';
import {
  buildNpcFallbackReply,
  describeNpcCapabilities,
  detectNpcChatIntent,
  getNpcDialogueProfileKey
} from '../src/shared/npcDialogue.js';

const shady = {
  id: 'npc_shady_figure',
  name: 'Shady Figure',
  prompt: 'You are Shady Figure, a quiet fixer working the edge of the quick cash block. Keep answers short, wary, and transactional. You offer small delivery work without explaining too much.',
  deliveryQuestEnabled: true
};

const bruno = {
  id: 'npc_bruno',
  name: 'Bruno',
  prompt: 'You are Bruno, a broad-shouldered neighborhood regular who treats the gym like a second home. Speak like a streetwise local, keep answers short, and steer people toward training, discipline, and city gossip.'
};

const roth = {
  id: 'npc_roth',
  name: 'Roth',
  prompt: 'You are Roth, the pawn shop owner in Vibe Theft Auto. Keep answers short, guarded, and transactional. You sell cigarettes for twenty bucks and pistols for fifty.',
  pawnShopOwnerEnabled: true
};

const sketch = {
  id: 'npc_sketch',
  name: 'Sketch',
  prompt: 'You are Sketch, an eccentric prototype android who narrates the city like it is an unfinished game level. You are curious, earnest, and lightly comedic.',
  blackjackDealerEnabled: true
};

assert.equal(detectNpcChatIntent('can I play blackjack?'), 'blackjack', 'blackjack requests should be detected');
assert.equal(detectNpcChatIntent('got any work for me?'), 'work', 'work requests should be detected');
assert.equal(getNpcDialogueProfileKey(shady), 'fixer', 'Shady Figure should use the fixer voice');
assert.equal(getNpcDialogueProfileKey(bruno), 'gym', 'Bruno should use the gym voice');
assert.equal(getNpcDialogueProfileKey(roth), 'pawn', 'Roth should use the pawn shop voice');
assert.equal(getNpcDialogueProfileKey(sketch), 'android', 'Sketch should keep the android voice even when he deals blackjack');
assert.match(describeNpcCapabilities(roth), /pawn shop sales/, 'capabilities should expose pawn shop service context');

const workMessage = 'got any work for me?';
const shadyWork = buildNpcFallbackReply({ npc: shady, playerMessage: workMessage });
const brunoTraining = buildNpcFallbackReply({ npc: bruno, playerMessage: 'can you train me?' });
const rothPrice = buildNpcFallbackReply({ npc: roth, playerMessage: 'how much is a pistol?' });
const sketchCards = buildNpcFallbackReply({ npc: sketch, playerMessage: 'can I play blackjack?' });

assert(!shadyWork.toLowerCase().startsWith(`${workMessage.toLowerCase()}?`), 'fallback should not echo the player message');
assert.match(shadyWork, /package|payout|drop|route|cash|delivery/i, 'fixer response should answer work requests in character');
assert.match(brunoTraining, /membership|barbell|gym|train|training|form|lift/i, 'gym response should answer training requests in character');
assert.match(rothPrice, /pistol|fifty|50|cash|cigarettes|skateboard/i, 'pawn response should answer item price requests in character');
assert.match(sketchCards, /card|wager|blackjack|hit|stand|double|split/i, 'blackjack dealer response should answer card requests');
assert.notEqual(shadyWork, brunoTraining, 'different NPC personas should not collapse to the same line');

const repeatedShadyWork = buildNpcFallbackReply({
  npc: shady,
  playerMessage: workMessage,
  transcript: [
    {
      speaker: 'npc',
      author: shady.name,
      text: shadyWork
    }
  ]
});
assert.notEqual(repeatedShadyWork, shadyWork, 'recent fallback replies should rotate away from exact repeats');

console.log('NPC dialogue validation passed.');
