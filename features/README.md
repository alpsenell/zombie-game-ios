# Feature modules

Each feature lives in `features/<name>.js`, exports `{ id, init(api) }`, and is listed in `features/index.js`.
`game.js` calls `init(api)` once at startup, after the profile, Game Center and StoreKit are ready.

## Events (`api.bus.on(name, fn)`)
- `app:ready` — after all features initialised
- `run:start` `{ type, difficultyId, seed, slots, opts }`
- `wave:start` `{ wave, mod, boss }` · `wave:clear` `{ wave, bonus, hp }`
- `kill` `{ kind, head, elite, boss, points, weapon, combo, burning }`
- `shot` `{ weapon }` · `perk` `{ name, rare, wave }`
- `run:end` — `api.runSummary()`: `{ type, seed, difficultyId, score, wave, kills, heads, shots, hits, accuracy, bestCombo, time, bosses, slots, weapon }`
- `purchase` `{ kind: 'iap' | 'scrap', productId | item, cost }`
- `screen` `{ id }`
- `run:submitted` `{ type, board, result }` — after a Game Center submit; `result` is `{ rank, score, total, ... }`, `{ rejected: reason }` or `null`
- `rival:passed` `{ name, rank, score, count, board }` (competitive)

## Runs
`api.startGame({ type, seed, difficulty, slots })` — `type` is `normal | daily | ranked | coop`; `seed` makes wave composition,
spawns, modifiers, perks, drops and zombie speed deterministic via `api.R()` (use `api.R()` for any new gameplay randomness).
`opts.replay()` (optional) returns the options REDEPLOY uses to start the next run of the same mode.
Leaderboards: `api.gameCenter.boards(type)` routes submits (`daily` → `deadzone.daily`, `ranked` → `deadzone.weekly` + all-time, else all-time);
`api.gameCenter.guard(run)` returns a rejection reason to block a submit; `api.boardView = { id, filter }` picks the board and local-run filter the RANKS screen shows (`api.renderBoard()`).

## UI slots
`#menu-modes`, `#menu-extras`, `#hud-rival`, `#hud-extras`, `#over-extras`, `#pause-extras`. New full screens: create a
`<section class="screen">`, append it to `document.body`, and call `api.registerScreen(el)`; show with `api.showScreen(el)`.

## Persistence
Feature state lives on `api.profile.<featureId>` and is saved with `api.saveProfile()`. Rewards: `api.grantScrap(n)`, `api.grantXP(n)`.

## Testing
`npm run prepare:web && node tools/smoke.mjs` plays a headless run. `tools/smoke.mjs` also exports `serve`, `launch` and
`openGame` for feature tests; the page is opened with `?debug`, which exposes `window.__game = { api, update, scene, setFiring, gameOver, ... }`.
Native code cannot be compiled in this environment; mock `window.Capacitor` (`PluginHeaders` + `nativePromise`) to test plugin calls.
