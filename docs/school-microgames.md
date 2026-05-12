# School Microgames

These microgames are designed for the school building as 5-10 second HUD popups, similar in spirit to the existing stock market and blackjack overlays. Each one should be readable at a glance, use one or two simple inputs, and resolve quickly into a pass/fail result.

Current game systems these fit with:

- Interact prompts through `E`
- 2D HUD popup overlays
- Mouse, keyboard, and mobile action buttons
- Money rewards and money floaters
- Toasts and task-confetti feedback
- Existing school building and blank school interior

The current player state does not appear to have school stats like grades, intelligence, or popularity yet. For the first pass, these can reward small cash amounts, simple completion flags, or a future-ready "school points" field.

## 1. Pop Quiz Panic

The popup shows a short question with three large answer buttons. The player must choose the correct answer before the timer expires.

- Duration: 5-8 seconds
- Inputs: click or tap one answer button
- Win condition: correct answer selected before time runs out
- Fail condition: wrong answer or timeout
- Reward hook: small cash reward, school points, or teacher favor

## 2. Locker Combo

A three-number locker combo flashes briefly, then disappears. The player must click the numbers in the correct order.

- Duration: 6-8 seconds
- Inputs: click or tap number buttons
- Win condition: full combo entered correctly
- Fail condition: wrong number or timeout
- Reward hook: school points or a chance at a small found-cash reward

## 3. Hall Pass Check

A hall monitor asks for the right pass. The player sees several pass options, such as Math, Gym, Cafeteria, or Library, and must pick the one matching the prompt.

- Duration: 5-7 seconds
- Inputs: click or tap one pass card
- Win condition: correct pass selected
- Fail condition: wrong pass or timeout
- Reward hook: avoid detention, earn school points, or unlock a small streak bonus

## 4. Copy The Notes

A short sequence appears, such as `A B C D` or `W A S D`. The player must repeat it before the timer ends.

- Duration: 6-10 seconds
- Inputs: keyboard sequence, or popup buttons for mobile
- Win condition: sequence entered correctly
- Fail condition: wrong input or timeout
- Reward hook: school points or a study streak

## 5. Teacher Is Looking

The player holds a "Write" or "Copy" button while the teacher is looking away, then releases before the teacher turns around.

- Duration: 5-8 seconds
- Inputs: hold and release one button
- Win condition: enough progress made without getting caught
- Fail condition: button held while the teacher is watching
- Reward hook: school points, risky bonus payout, or detention risk

## 6. Cafeteria Tray Save

A cafeteria tray tilts left and right. The player taps left/right controls to keep it balanced until the timer ends.

- Duration: 7-10 seconds
- Inputs: `A/D`, left/right buttons, or touch controls
- Win condition: tray balance stays inside the safe zone
- Fail condition: tray tilts too far and spills
- Reward hook: small cash, food item later, or cafeteria reputation

## 7. Dodge The Chalk

A tiny 2D stick figure stands in three lanes while chalk drops from above. The player moves left and right to dodge.

- Duration: 6-10 seconds
- Inputs: `A/D`, left/right buttons, or touch controls
- Win condition: survive until the timer ends
- Fail condition: get hit too many times
- Reward hook: school points or a tiny health-preserving bonus

## 8. Sort The Backpack

Items pop out of a messy backpack and must be sorted into simple bins, such as Book, Snack, and Contraband.

- Duration: 7-10 seconds
- Inputs: click/tap item, then click/tap bin
- Win condition: sort enough items correctly
- Fail condition: too many wrong bins or timeout
- Reward hook: school points, item discovery later, or detention avoidance

## 9. Bell Sprint

A marker races along a hallway meter. The player must hit the button when the marker lands inside the green classroom-door zone.

- Duration: 5-6 seconds
- Inputs: one button press
- Win condition: stop marker inside the target zone
- Fail condition: stop outside the target zone or timeout
- Reward hook: attendance streak, school points, or task-confetti feedback

## 10. Scantron Speedrun

The popup shows a short answer key, such as `B A D C`, and the player must fill the matching bubbles as fast as possible.

- Duration: 7-10 seconds
- Inputs: click/tap answer bubbles
- Win condition: enough bubbles filled correctly
- Fail condition: wrong bubbles or timeout
- Reward hook: Intelligence XP, school points, or a quiz streak
