# iPhone Apps and Skills Implementation Plan

## Goal

Upgrade the in-game iPhone from a mostly placeholder app launcher into a useful player hub, while adding a polished skills progression mechanic inspired by old school RuneScape.

The first pass should deliver four phone app changes:

1. Wallet combines cash, net worth, stock holdings, and a shortcut into the stock market.
2. Map shows a full-screen 2D top-down city map inside the phone with the player's current location.
3. Settings shows basic game settings with Audio and Controls sections.
4. Skills shows player skills, progress bars, and level-up feedback.

The first gameplay mechanic change should make snatching the barbell grant Strength XP, walking around grant Agility XP, level the player from 1 to 99 using a RuneScape-style curve that is about 20x faster, and play a satisfying level-up animation when a skill level increases.

## Design Principles

These features should feel like game systems, not admin panels. Each app should be compact, readable, responsive inside the phone frame, and visually distinct enough that players can recognize what it does at a glance.

Polish is part of the feature, not a final optional pass. Every app and mechanic should feel satisfying to interact with in a video game context: responsive touches/clicks, crisp motion, clear feedback, readable states, pleasing color contrast, and small moments of reward when the player does something meaningful.

The phone apps should avoid long explanatory copy. Use titles, icons, status numbers, progress bars, markers, and obvious controls. A player should be able to open an app for two seconds and learn something useful.

All progression-affecting data should be server-authoritative. The client can animate and preview, but skill XP, levels, stock holdings, money, and workout completion should be validated and synced through server state.

Do not mark the implementation complete just because the mechanics work. The work is complete only when the interaction loop has been checked repeatedly in-game and the result is visually engaging, polished, and excellent enough to show in a gameplay video.

## Quality Bar

The implementation loop should be:

1. Build the smallest complete version of the mechanic.
2. Verify it in the running game.
3. Watch for visual feel, timing, spacing, animation quality, empty states, loading states, and edge cases.
4. Improve the parts that feel flat, confusing, cramped, slow, or unfinished.
5. Repeat until the feature is both correct and delightful.

Each feature should have a clear moment of feedback. Wallet should make financial changes feel immediate. Map should make locating yourself feel effortless. Settings should feel tidy and game-native. Skills should make XP gain and level-ups feel rewarding.

The `.md` plan should not be considered satisfied until the verification loop confirms that each implemented app/mechanic feels excellent, not just acceptable.

## Functional Readiness and Test Verification

These apps must be ready for real game players to use. That means each app needs complete working behavior, not just static UI:

- Buttons and sliders perform their intended actions.
- Data shown in the phone matches authoritative game state.
- Empty, loading, disabled, error, and success states are handled.
- App state updates after relevant gameplay events without requiring a refresh.
- Closing and reopening the phone preserves expected state.
- Interactions work with mouse, keyboard where applicable, and narrow/mobile-sized layouts.

Every implemented mechanic should be backed by tests or validation scripts. If no existing test harness covers the new behavior, add focused validation scripts in the repo's existing style and wire them into `package.json` where useful.

Minimum verification coverage:

| Area | Required Verification |
| --- | --- |
| Skills XP curve | Unit or validation script confirms level thresholds, level 1, level 99, progress math, and 20x scaling. |
| Skill XP awards | Server-side validation confirms snatch completion grants Strength XP once per completed workout, walking grants Agility XP from accepted movement distance, and both return/sync level-up payloads correctly. |
| Skills app | Browser/UI verification confirms levels, XP bars, level 99 state, XP updates, and level-up animation render correctly. |
| Wallet app | Validation confirms cash, holdings, portfolio value, net worth, disabled bank access, and stock shortcut behavior. |
| Map app | Browser/UI verification confirms map features render, player marker position is correct, and marker updates while open. |
| Settings app | Validation confirms the audio slider updates, persists locally, and controls list matches current bindings. |
| Regression safety | Run `npm run build` and any relevant existing `npm run validate:*` scripts before marking complete. |

The final implementation should report which tests and validations were run, what passed, and any remaining risks. If a feature cannot be automatically tested, it still needs a manual browser verification note with exact player steps.

## Current Code Context

The phone app registry and app panel rendering live in `src/ui/Hud.js`. `PHONE_APPS` currently includes `wallet`, `stocks`, `map`, and `settings`, but those apps are placeholder panels. `missions` and `character` already have custom app markup, so new apps should follow that pattern.

The stock market already has a strong standalone overlay in `src/ui/Hud.js`, backed by `src/shared/stockMarket.js`, client methods in `src/game/Game.js`, and server RPC handlers in `server/src/WorldRoom.js`.

The snatch workout flow is already implemented through `src/game/workoutActivities.js`, `src/game/Game.js`, and `server/src/WorldRoom.js`. The server currently marks `gymPumpCompletedAt` when a `snatch` workout completes.

Player movement is already server-validated in `server/src/WorldRoom.js` through the transform update path. Agility XP should hook into accepted movement after validation, not raw client input.

The map can derive its first version from world placements already synced to the client. Default city layout data comes from `src/world/defaultWorldLayout.js`, while live placements are owned by `src/world/WorldState.js` and rendered by the world builder/renderer path.

## App Registry Changes

Remove the separate `stocks` app from the phone home screen and fold that functionality into `wallet`.

Add a new `skills` app to `PHONE_APPS`.

Suggested first home grid:

| App | Purpose |
| --- | --- |
| Messages | Placeholder for story texts |
| Map | Player location and city layout |
| Missions | Existing mission progression app |
| Wallet | Cash, net worth, portfolio, stock market shortcut |
| Skills | Skill levels and XP progress |
| Casino | Blackjack shortcut/placeholder |
| Character | Existing character selector app |
| Contacts | Placeholder for NPC relationships |
| Settings | Audio and controls |

## Wallet App

### Player Experience

The Wallet app should open inside the phone and show the player an immediate financial snapshot:

- Cash balance.
- Portfolio value.
- Net worth.
- A compact list of owned stocks.
- A `Stocks` button that opens live stock prices and trade controls when the player is near a bank or stock broker.

The button copy should make availability obvious:

| State | Button |
| --- | --- |
| Near broker and market loaded | `Stocks` enabled |
| Not near broker | `Stocks` disabled with subtle note: `Visit the bank` |
| Loading | `Syncing` disabled |

### Data

The existing stock market snapshot already includes:

- `cash`
- `portfolioValue`
- `netWorth`
- `marketMood`
- `stocks[]`
- per-stock `shares`, `averageCost`, `marketValue`, and `unrealizedProfit`

Wallet should reuse that shape where possible. If the player is not near a stock broker, it can still show the latest known wallet snapshot from local player state plus cached stock market data. Trading should still require the existing server-side broker proximity validation.

### UI Direction

Wallet should feel like a compact finance card stack, but not nested cards inside cards. Use:

- A large balance header.
- Two small stat blocks for portfolio and net worth.
- A holdings list with stock icons, shares, value, and P/L color.
- A single strong `Stocks` action.

### Integration Points

In `src/ui/Hud.js`:

- Remove the `stocks` entry from `PHONE_APPS`.
- Add custom `getPhoneWalletAppMarkup(app)`.
- Add `setPhoneWalletState(...)` and `renderPhoneWallet()`.
- Reuse `createStockIconMarkup`, money formatters, and trend classes.

In `src/game/Game.js`:

- Refresh wallet state when opening the phone, opening Wallet, after money changes, and after stock trades.
- Add a wallet app button handler for opening live stocks.
- Reuse `openStockMarket(...)` if the player is near a valid stock market NPC.

In `server/src/WorldRoom.js`:

- Keep stock trading authorization exactly server-side.
- Consider a lightweight `wallet:getSnapshot` RPC only if the client needs portfolio data without opening the full stock market overlay.

## Map App

### Player Experience

The Map app should fill the phone screen. It should show a clean 2D top-down map of the current city and a marker showing where the player is right now.

Minimum map contents:

- Roads.
- Buildings/lots.
- Major interactable props such as gym barbell, casino table, stock broker, and Shady Figure.
- Player marker with facing direction.
- Optional labels for major buildings when space allows.

### Visual Direction

Use a stylized map, not a screenshot. Roads can be dark gray bands, lots/buildings can be simple blocks, and interactables can use small icon markers. The player's marker should be the brightest element and should gently pulse so it is easy to find.

The map should not scroll in the first version unless needed. Fit the current city bounds into the phone screen with padding.

### Coordinate Mapping

Use world X/Z coordinates and map them into phone screen coordinates:

```js
const mapX = ((worldX - minX) / (maxX - minX)) * width;
const mapY = ((worldZ - minZ) / (maxZ - minZ)) * height;
```

Compute bounds from live placements plus the player position, with stable padding. For the default city, the useful bounds are roughly the placement extents around the road grid and building grid.

### Integration Points

In `src/ui/Hud.js`:

- Add custom `getPhoneMapAppMarkup(app)`.
- Add `setPhoneMapState({ player, placements, npcs })`.
- Render the map as SVG so it stays crisp in the phone.

In `src/game/Game.js`:

- Refresh map state when opening the Map app.
- Refresh the player marker while the Map app is visible, either in the normal update loop or on a throttled interval.
- Pull live player position from the local player state or local player object.

In world modules:

- Prefer existing world placement data over hardcoding the default map.
- Add a small helper if needed, such as `createPhoneMapFeatures(worldState)` or a shared map serializer, only if it keeps `Hud.js` from knowing too much about world placement internals.

## Settings App

### Player Experience

The Settings app should have two sections:

1. Audio
2. Controls

Audio should start with one master volume slider. The value should update immediately and persist locally.

Controls should list the current keyboard/mouse controls and mobile control equivalents where relevant.

Suggested controls list:

| Action | Control |
| --- | --- |
| Move | WASD / left touch stick |
| Interact | E / action button |
| Phone | Tab / phone button |
| Emotes | B |
| Aim | Right mouse / right touch stick |
| Fire | Left mouse |
| Reload | R |
| Zoom | Mouse wheel or plus/minus |
| Close menus | Escape |

### Integration Points

In `src/ui/Hud.js`:

- Add custom `getPhoneSettingsAppMarkup(app)`.
- Add a slider input with `data-phone-setting-audio`.
- Add event handling through `bindPhoneEvents`.
- Add `setPhoneSettingsState(...)` if needed.

In `src/game/Game.js`:

- Own settings defaults and local persistence.
- Apply volume to any existing audio sources.
- If no global audio manager exists yet, store the value and wire it to future sound effects.

In `src/game/Input.js`:

- Keep the controls list aligned with `ACTION_KEY_CODES` and `ACTION_POINTER_BUTTONS`.
- If controls become configurable later, this app can evolve from static list to rebinding UI.

## Skills Mechanic

### Initial Skill Catalog

Start with these skills:

| Skill | Icon Direction | First XP Source |
| --- | --- | --- |
| Strength | Dumbbell/barbell | Completing snatch workout |
| Agility | Running shoe/lightning bolt | Walking around the city |
| Intelligence | Brain/book/computer | No required XP source in this pass |

Keep the catalog extensible so more skills can be added without changing the save shape.

Suggested shared catalog file:

```js
export const SKILL_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'strength',
    label: 'Strength',
    icon: 'strength',
    accent: '#68e08f'
  }),
  Object.freeze({
    id: 'agility',
    label: 'Agility',
    icon: 'agility',
    accent: '#f0d85a'
  }),
  Object.freeze({
    id: 'intelligence',
    label: 'Intelligence',
    icon: 'intelligence',
    accent: '#58b8ff'
  })
]);
```

### XP Curve

Use the classic RuneScape cumulative XP curve, scaled to be about 20x faster.

Classic cumulative XP for a target level:

```js
function getClassicXpForLevel(level) {
  let points = 0;
  for (let i = 1; i < level; i += 1) {
    points += Math.floor(i + (300 * Math.pow(2, i / 7)));
  }
  return Math.floor(points / 4);
}
```

Game XP threshold:

```js
function getSkillXpForLevel(level) {
  if (level <= 1) {
    return 0;
  }
  return Math.max(1, Math.floor(getClassicXpForLevel(level) / 20));
}
```

This keeps the familiar accelerating curve while making level 99 require roughly `651,721` XP instead of `13,034,431` XP.

Track total XP per skill, not just level. Level is derived from XP.

### XP Awards

The first action award:

| Action | Skill | XP |
| --- | --- | --- |
| Complete snatch workout | Strength | 25 |
| Walk accepted movement distance | Agility | 1 XP per 18 world units |

This intentionally makes early levels pop quickly, then slows down as the player climbs. If early Strength levels feel too fast in testing, reduce snatch XP to 15. If workouts feel too unrewarding after level 20, raise to 35 or add streak bonuses.

Agility XP should feel like a pleasant background reward for exploring, not a spammy pop-up machine. Award it from server-accepted movement distance, accumulate partial distance between ticks, and cap XP gain per update so teleports, respawns, lag corrections, or rejected movement cannot grant huge bursts.

Suggested Agility tuning:

| Rule | Value |
| --- | --- |
| XP rate | 1 XP per 18 accepted world units |
| Minimum tracked movement | Ignore movement under 0.05 world units |
| Max XP per transform update | 3 XP |
| Feedback | Small Skills app progress animation only; level-up banner when a level is gained |

Future likely awards:

| Action | Skill | XP |
| --- | --- | --- |
| Complete typing/computer work session | Intelligence | 20 |
| Complete delivery | Charisma or another future skill | TBD |
| Win blackjack hand | Intelligence or Luck if added later | TBD |

### Server Data Model

Add skill XP to player state as a map-like synced field if Colyseus schema supports it cleanly in this project. Otherwise, start with explicit numeric fields and migrate later.

Preferred shape:

```js
skills: {
  strength: { xp: 0 },
  agility: { xp: 0 },
  intelligence: { xp: 0 }
}
```

Fallback first-pass schema:

```js
strengthXp: 'number',
agilityXp: 'number',
intelligenceXp: 'number'
```

The shared helper should normalize either shape into:

```js
{
  id: 'strength',
  label: 'Strength',
  xp: 125,
  level: 7,
  currentLevelXp: 112,
  nextLevelXp: 151,
  progress: 0.33
}
```

### Award Flow

When the server accepts a completed snatch workout:

1. Read the player's current Strength XP.
2. Resolve the old level.
3. Add Strength XP.
4. Resolve the new level.
5. Store XP.
6. Return an award payload such as `{ skillId, xpGained, oldLevel, newLevel }`.
7. If `newLevel > oldLevel`, let the client play level-up UI.

When the server accepts player movement:

1. Compare the accepted next position to the player's previous accepted position.
2. Ignore movement if the player is dead, teleporting, respawning, blocked, or outside normal accepted movement rules.
3. Add the accepted distance to an Agility distance accumulator.
4. Convert each full threshold of accumulated distance into Agility XP.
5. Cap XP per transform update.
6. Store the remaining partial distance for the next update.
7. If Agility level changes, sync enough information for the client to play level-up UI once.

The server should be the only place that grants progression XP. The client can optimistically animate after the RPC returns, but it should not mutate authoritative XP by itself.

### Skills App UI

The Skills app should use the full phone app surface with a scrollable skill list.

Each skill row/card should include:

- Skill icon.
- Skill name.
- `level/99`.
- Current XP or XP to next level in small text.
- Green progress bar to next level.

Visual states:

- Level 99 skill gets a gold or bright completed state and full bar.
- Recently leveled skill can briefly glow in the list.
- Progress bar should animate from old progress to new progress after XP awards if the app is open.

### Level-Up Animation

Level-up feedback should happen outside the phone too, because the reward is tied to the world action.

Suggested first animation:

- A centered toast/banner above the player HUD, such as `Strength Level 12` or `Agility Level 8`.
- A quick radial burst or rising spark particles using a small DOM overlay.
- The skill icon appears large for a beat, then settles.
- A short sound hook should be added later, controlled by the Settings audio slider.

Do not reuse the exact task confetti effect as-is. It can share infrastructure, but the visual language should feel like skill progression: green/gold sparks, a ring pulse, and a bold level number.

### Integration Points

Create `src/shared/skills.js`:

- Skill definitions.
- XP curve helpers.
- XP normalization.
- Level and progress resolvers.
- Award constants.

In `server/src/WorldRoom.js`:

- Add skill XP fields to `PlayerState`.
- Add an Agility distance accumulator to player state or server-side per-session metadata.
- Initialize skill XP on join.
- Add an `awardPlayerSkillXp(player, skillId, amount)` helper.
- Call the helper from `handleWorkoutComplete` when `target.workoutType === 'snatch'`.
- Award Agility XP from accepted movement inside the server movement path, likely near `updatePlayerTransform`, after movement validation has accepted the new position.
- Return skill award payload from `workout:complete`.
- Sync level-up information for passive movement awards without allowing repeated duplicate level-up banners.

In `src/npc/NpcServiceColyseus.js`:

- Preserve and return the `skillAward` payload from `completeWorkoutPlacement`.
- Include skill XP fields in player serialization.

In `src/game/Game.js`:

- Store the last seen levels to detect server-synced level-ups.
- Trigger `hud.showSkillLevelUp(...)` when a returned award or synced player state crosses a level boundary.
- Refresh Skills app state when player state changes or app opens.

In `src/ui/Hud.js`:

- Add `skills` to `PHONE_APP_ICON_PATHS`.
- Add custom `getPhoneSkillsAppMarkup(app)`.
- Add `setPhoneSkillsState(...)` and `renderPhoneSkills()`.
- Add `showSkillLevelUp(...)`.

In `styles.css`:

- Add phone skills layout.
- Add progress bar animations.
- Add level-up overlay animation.
- Keep responsive constraints tight inside the phone frame.

## Suggested Implementation Order

1. Add shared skills helpers and tests or a small validation script for the XP curve.
2. Add server skill XP state and award Strength XP from completed snatches.
3. Add client plumbing for skill award payloads and level-up animation.
4. Add Agility XP from accepted walking distance with anti-spike caps and validation.
5. Add the Skills phone app.
6. Merge Stocks into Wallet and remove the separate Stocks home icon.
7. Add Wallet snapshot rendering and stock market shortcut.
8. Add Map app SVG rendering and player marker updates.
9. Add Settings app with audio slider and controls list.
10. Run a visual polish pass on phone spacing, scroll areas, button states, and animations.
11. Verify the full loop in browser: snatch workout, walking around for Agility XP, XP gain, level-up, Skills app progress, Wallet stocks, Map marker, Settings slider.
12. Do at least one explicit "game feel" review pass for each app and mechanic, improving animation timing, button feedback, color, spacing, and state clarity.
13. Add or update focused tests/validation scripts for skills math, XP awards, wallet data, map marker behavior, settings persistence, and player-ready app flows.
14. Run `npm run build` plus the relevant validation scripts and fix failures.
15. Keep iterating until the features are functional, tested, video-ready, and excellent to interact with.

## Acceptance Criteria

These acceptance criteria include functionality, tests, and polish. A feature should not be checked off if it technically works but feels visually unfinished, sluggish, cramped, confusing, unrewarding, or insufficiently verified.

### Wallet

- The phone home screen no longer has a separate Stocks app.
- Wallet shows cash balance, portfolio value, net worth, and owned stocks.
- Wallet has a `Stocks` button.
- The `Stocks` button opens live stock prices/trading when near a stock broker.
- Trading remains server-validated and cannot happen from across the map.
- Wallet interactions have satisfying visual feedback for refreshed values, empty holdings, disabled stock access, and changed balances.
- Wallet behavior is covered by validation or browser test steps for player-ready use.

### Map

- Map app fills the iPhone screen area.
- Map renders roads, buildings/lots, and important interactables.
- Player marker appears at the correct map-relative location.
- Player marker updates while the app is open.
- Marker indicates facing direction.
- Map feels like a polished in-game map: readable shapes, clear landmarks, smooth marker updates, and no cluttered or dead-looking screen.
- Map rendering and marker updates are verified with browser/UI test steps or an automated browser check.

### Settings

- Settings app has `Audio` and `Controls` section headers.
- Audio has a working slider.
- Slider value persists locally.
- Controls list matches the actual input bindings.
- Settings feels intentionally designed, with clean slider feedback, scannable control rows, and no placeholder-panel feel.
- Settings behavior is verified for persistence, slider updates, and controls accuracy.

### Skills

- Skills app appears on the phone home screen.
- Strength, Agility, and Intelligence render as skill cards with icons, level, and green XP progress bars.
- Skills use levels 1 through 99.
- XP thresholds use a RuneScape-style curve scaled 20x faster.
- Completing a snatch workout grants Strength XP.
- Walking around grants Agility XP from server-accepted movement distance.
- Strength can level up from snatch XP.
- Agility can level up from walking XP.
- Level-up animation plays when the player gains a level.
- Skill XP is server-authoritative.
- Skill XP gain and level-up moments are visually rewarding enough that players notice and want to do another action.
- Skills math and XP award behavior are covered by focused automated validation.
- Skills app rendering and level-up feedback are verified in the running game.

### Completion Gate

- The implementation has been verified in the running game, not only by static inspection.
- The phone apps have been checked at normal desktop size and a narrow/mobile-sized viewport.
- The full skill loop has been played through: complete snatch, walk around for Agility XP, receive XP, update Skills app, and trigger level-up if applicable.
- Automated or scripted validation has been added/updated for the new functionality where practical.
- `npm run build` and relevant validation scripts pass.
- The final implementation notes list the exact tests, validation scripts, and browser checks that were run.
- Any rough-feeling interaction discovered during verification has been improved or explicitly logged as follow-up work.
- The plan is not marked complete until the finished features are functional, tested, player-ready, polished, visually engaging, and excellent enough for gameplay capture.

## Polish Checklist

- Phone apps have distinct silhouettes and colors without becoming a one-color UI.
- All text fits in the phone frame on desktop and mobile.
- Scrollable app bodies have clear top/bottom spacing and do not hide content under the phone home indicator.
- Buttons have hover, focus, pressed, disabled, and loading states.
- Progress bars animate smoothly but do not resize their parent rows.
- Level-up animation is noticeable without blocking gameplay for too long.
- XP gain has a smaller feedback moment even when the player does not level up.
- Important interactions have motion or state changes that feel responsive, but animations never make the app feel slow.
- Map marker remains visible even at map edges.
- Map landmarks are visually distinct enough to read quickly.
- Wallet numbers update after money rewards, gym purchases, and stock trades.
- Wallet value changes feel alive through subtle number motion, highlight, or row feedback.
- Settings controls feel native to the game UI rather than browser-default form controls.
- Empty, loading, disabled, and error states look intentionally designed.
- No app relies on placeholder explanatory paragraphs once its feature is implemented.
- Final verification includes a deliberate visual/game-feel review before completion.

## Open Decisions

- Should Wallet show portfolio values when the player is not near the bank, or only the last cached values?
- Should the Wallet `Stocks` button route into the existing stock overlay, or should trading eventually live directly inside the phone?
- Should Intelligence XP be awarded by the existing typing/computer workout in the same pass, or saved for a follow-up goal?
- Should Map show NPC live positions, or only the player and static points of interest?
- Should the audio slider be master volume only, or split into music and effects later?
- Should skill XP persist beyond the current multiplayer session immediately, or wait until broader player persistence is added?

## Suggested `/goal` Prompt

Implement the iPhone Apps and Skills plan from `docs/iphone-apps-and-skills-implementation.md`. Work iteratively, keeping each mechanic functional, tested, polished, visually engaging, and verified in the running game. Start with the shared skills XP curve, snatch-to-Strength-XP loop, and walking-to-Agility-XP loop, then build the Skills app and level-up animation before moving on to Wallet, Map, and Settings. Add or update tests/validation scripts for the new mechanics and run `npm run build` plus relevant validations. Do not mark the goal complete until each feature has been checked repeatedly, passes verification, is ready for game players to use, and feels excellent enough for gameplay capture, not merely functional.
