# School Microgames

School microgames are quick HUD popups launched from school NPCs. They are designed to be readable at a glance, playable with mouse, keyboard, or touch, and resolved into fast pass/fail rounds.

Current school games:

- Pop Quiz Panic
- Geography Globe
- Teacher Is Looking
- Memory Card Flip
- Sketch Guessr

School NPC interactions start a random game immediately. There is no start button: the HUD shows a `3`, `2`, `1` countdown before the first round and before every following round. After each round resolves, the next random school game continues automatically until the player closes the school HUD.

School games only award Intelligence XP. They do not award cash.

## Pop Quiz Panic

The popup shows three quiz questions in a row with three large answer buttons per question. The player must answer every question correctly before time runs out.

- Duration: 18 seconds
- Inputs: click or tap one answer button
- Win condition: all three answers are correct
- Fail condition: wrong answer or timeout
- Reward hook: Intelligence XP

## Teacher Is Looking

The player types the target sentence while the teacher faces away, then stops before the teacher turns back around.

- Duration: 16 seconds
- Inputs: keyboard typing
- Win condition: finish the sentence without getting caught
- Fail condition: type while the teacher is looking or timeout
- Reward hook: Intelligence XP

## Memory Card Flip

The player flips two cards at a time, remembers the revealed labels, and clears every matching pair.

- Duration: 45 seconds
- Inputs: click or tap cards
- Win condition: match every pair
- Fail condition: timeout
- Reward hook: Intelligence XP

## Sketch Guessr

The player watches one of 23 premade black and white object sketches draw itself, types the object name, and submits a guess before the early bell. The drawing would naturally finish about five seconds after the guessing window, so timeouts and correct guesses both fast-forward the remaining strokes before revealing the answer.

- Duration: 14 seconds to guess, 19 seconds natural draw length
- Inputs: keyboard text input plus Guess button
- Win condition: submit the matching object name or alias
- Fail condition: timeout
- Reward hook: Intelligence XP
