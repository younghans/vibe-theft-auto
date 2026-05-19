# Missions App Design

## Goal

Build a phone app where players can review their mission progression, see the current selected mission, switch to another available mission when allowed, and understand why future missions are locked.

The current game has a lightweight task system in `src/game/TaskTracker.js`. It resolves one task at a time from player progress and feeds that task into the top HUD text and task arrow. The Missions app should keep that HUD behavior, but add a richer mission list and a player-selected mission concept.

## Player Experience

The Missions app should open inside the phone like the other apps. It should show three groups:

1. Current Mission
2. Available Missions
3. Completed and Locked Missions

The currently selected mission should be visually highlighted. It should include the mission icon, title, short objective copy, and a clear "selected" state. If the selected mission has a world target, the player arrow and top HUD should point to that mission.

Available missions should be clickable. Clicking one selects it as the player's active mission and immediately updates the top HUD and task arrow.

Completed missions should show a green checkmark and strikethrough text. They should not be selectable unless we later decide a mission is repeatable.

Locked missions should show a lock state and a short requirement such as "Help the Shady Figure first" or "Complete: Lift at the gym or take a shot at the basketball hoop." Locked missions should not be selectable.

## Initial Mission Progression

The first version can use the existing progression already tracked on the player:

| Mission ID | Title | Icon | Locked Until | Completion Signal |
| --- | --- | --- | --- | --- |
| `make-money` | Make some money. Maybe the Shady Figure can help? | `money` | Always available at start | Player accepts/completes the first delivery path |
| `delivery` | Deliver the package | `package` | Shady Figure delivery accepted | `deliveryQuestCompletionCount > 0` for first completion |
| `gym-pump` | Lift at the gym or take a shot at the basketball hoop. | `muscle` | First delivery complete | `gymPumpCompletedAt > 0` |
| `stock-buy` | Buy a stock at the bank. | `chart` | First delivery complete | `stockBoughtAt > 0` |
| `blackjack-hand` | Play a hand of blackjack at the casino. | `playing-card` | First delivery complete | `blackjackHandPlayedAt > 0` |

Important rule: future progression missions stay locked until the player has helped the Shady Figure. In practice, that means missions after the intro cash/delivery step should require `deliveryQuestCompletionCount > 0`.

After the first delivery is complete, `gym-pump`, `stock-buy`, and `blackjack-hand` should all be available. The default fallback order should still guide players through Lift or Shoot, then First Stock, then Blackjack Hand, but players can manually switch to any unlocked incomplete mission.

## Mission States

Each mission should resolve to one of these states for the local player:

| State | Meaning | UI Treatment |
| --- | --- | --- |
| `selected` | The player has chosen this mission as their current objective | Highlighted row/card, "Selected" badge |
| `available` | The mission is unlocked and incomplete | Clickable row/card |
| `completed` | The mission is finished | Green checkmark, strikethrough title, not clickable |
| `locked` | Requirements are not met | Lock icon, dimmed row/card, requirement text |
| `inProgress` | A mission has a live sub-state, such as an accepted delivery | Highlight as active/available; usually auto-selected |

`selected` is not a separate progression state. It is a display overlay on top of `available` or `inProgress`.

## Data Model

Add a mission catalog that defines static mission metadata separately from player progress:

```js
{
  id: 'stock-buy',
  title: 'Buy a stock at the bank.',
  icon: 'chart',
  description: 'Visit the bank and buy any stock from the street exchange.',
  prerequisiteIds: ['gym-pump'],
  targetResolver: getStockBuyTaskTarget,
  completionResolver: (player) => Number(player.stockBoughtAt ?? 0) > 0
}
```

Add player state for mission selection:

```js
selectedMissionId: 'stock-buy'
```

This should live server-side on the player schema, not only in local storage. The selected mission affects gameplay guidance, so the server should validate mission selection requests and sync the chosen mission back to the client.

## Selection Rules

When the player clicks a mission in the app:

1. Client sends a mission selection request with the mission ID.
2. Server verifies the mission exists.
3. Server verifies the mission is unlocked.
4. Server verifies the mission is not completed unless it is explicitly repeatable.
5. Server writes `player.selectedMissionId`.
6. Client receives synced player state and updates the Missions app, top HUD, and task arrow.

If the selected mission becomes invalid, use a deterministic fallback:

1. Any live delivery mission currently in progress.
2. The first available incomplete mission in progression order.
3. A repeatable/evergreen mission, such as making money through the Shady Figure.
4. No visible mission if nothing is available.

This fallback order should be explicit in shared mission rules rather than inferred from UI order. Multiple missions can be available at once, but automatic guidance should prefer Delivery if active, then Lift or Shoot, then First Stock, then Blackjack Hand, then Make Money.

## Active Delivery Behavior

Delivery needs special handling because it can be generated dynamically after talking to the Shady Figure.

When no delivery is accepted, the intro mission should point players toward the Shady Figure. Once a delivery is accepted, the `delivery` mission should become `inProgress`, show the target NPC name, and likely auto-select itself so the arrow points to the delivery target.

After the first delivery is completed, downstream missions unlock. Later delivery jobs can be treated as repeatable side missions, but they should not block the main progression chain.

## UI Layout

The Missions app should use the full phone app surface. Suggested layout:

- A compact header with a back button and title.
- A "Current" section pinned at the top.
- A scrollable mission list underneath.
- Rows/cards with icon, title, one-line description or requirement, and status marker.

Visual treatments:

- Selected: brighter border/background, small "Selected" badge.
- Available: normal contrast, hover/press feedback.
- Completed: green checkmark, title strikethrough, lower contrast.
- Locked: lock icon, muted text, requirement line.

Avoid long tutorial copy in the app. The row states should make the mission status obvious.

## Integration Points

`src/game/TaskTracker.js` should evolve from "resolve the next task" into "resolve mission list plus selected mission." It can still expose a current task object for the existing HUD and arrow code.

`src/game/Game.js` currently calls `syncTaskHud()` and uses `task.target` for the player arrow. That path should continue to work, but the current task should come from `selectedMissionId` when valid.

`src/ui/Hud.js` already has the phone app registry and a placeholder `missions` app. Replace that placeholder with mission-specific markup and add methods for rendering mission state and handling mission clicks.

`server/src/WorldRoom.js` should own `selectedMissionId` validation and sync it through player state. This prevents clients from selecting locked missions locally.

## Implementation Plan

1. Create a shared mission catalog with IDs, display metadata, prerequisite rules, completion rules, and target resolvers.
2. Add `selectedMissionId` to server player state and initial defaults.
3. Add a `selectMission` client/server message, validated server-side.
4. Update `TaskTracker` to return `{ missions, selectedMission, task, completedTask }`.
5. Update `Game.syncTaskHud()` to use the selected mission task for HUD text and arrow target.
6. Replace the Missions phone placeholder in `Hud.js` with a full Missions app view.
7. Add click handling for available mission rows.
8. Add focused validation for locked/completed/selected mission state transitions.

## Acceptance Criteria

- The Missions app lists completed, available, selected, and locked missions.
- Completed missions show a green checkmark and strikethrough.
- Locked missions are visible but not selectable.
- Missions after the Shady Figure intro remain locked until the first delivery is complete.
- Clicking an available mission makes it the current mission.
- The top HUD text updates to the selected mission.
- The player task arrow updates to the selected mission target.
- A selected locked/completed mission falls back to the next valid mission.
- Mission selection is server-validated and persists through the synced player state.

## Open Decisions

- Should completed main missions remain visible forever, or should the app allow filtering?
- Should repeatable Shady Figure delivery jobs appear as side missions after the first completion?
- Should active delivery always auto-select itself, or should players be able to select another available mission while carrying a package?
- Should locked missions reveal full titles, or show partial mystery copy until the prerequisite is complete?
