# Werewolf Assistant Architecture

The app uses ordered classic browser scripts rather than ES modules so it can
still run when published as a simple static folder. Script order is defined in
`index.html` and mirrored by `tests/continuity.test.js`.

## Directory map

```text
Werewolf/js/
├── descriptions/
│   ├── role-descriptions.js  Moderator-facing role text
│   └── role-settings.js      Rule defaults and declarative role options
├── core/
│   ├── state.js              Shared state and the gameState facade
│   ├── persistence.js        Save, restore, migration, and undo
│   ├── role-logic.js         Role identity and appearance helpers
│   └── utilities.js          Shared formatting/browser helpers
├── setup/
│   └── role-filters.js       Role search and filtering
├── ui/
│   ├── chrome.js             Phase header and shared screen chrome
│   ├── events.js             Delegated data-click/data-change/data-input events
│   ├── modals.js             Accessible modal primitives
│   └── settings.js           Guide, game, role, and design settings
├── game/
│   ├── night.js              Night setup, wakes, and actions
│   ├── day.js                Day screen, corrections, and voting
│   ├── eliminations.js       Death chains and triggered role abilities
│   ├── summary.js            Results, summaries, and reset flow
│   └── win-conditions.js     Victory and parity rules
├── actions.js                Action execution engine
├── players.js                Player/role setup screens
├── app.js                    Bootstrap, migration, and wake lock
└── bindings.js               Explicit public UI action registry
```

## Shared state

Existing game code still uses the original variables for saved-game
compatibility. New code should use `gameState`, grouped into `phase`, `setup`,
`night`, `history`, and `settings`. Its accessors update the legacy variables,
allowing gradual migration without maintaining two copies of state.

## UI events

Rendered markup uses `data-click`, `data-change`, and `data-input`. The delegated
dispatcher in `ui/events.js` accepts named public handlers and simple literal or
control-derived arguments. Add public handlers to `bindings.js`; do not add new
inline `onclick`, `onchange`, or `oninput` attributes.

## Adding a role

1. Add its gameplay definition to `Data/roles.json`.
2. Add its moderator description to `descriptions/role-descriptions.js`.
3. If it has configurable rules, add one entry to `roleSettingsByRole` and add
   defaults to `defaultRoleRuleSettings` in `descriptions/role-settings.js`.
4. Add or update action behavior in `actions.js` and the appropriate game-phase
   file.
5. Run both Node test files in `Werewolf/tests/`.

## Dependency rule

Files may call functions declared by later scripts, but they must not execute
those functions during initial script evaluation. Initialization is deferred
until every script has loaded.
