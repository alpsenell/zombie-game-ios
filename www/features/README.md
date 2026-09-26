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

## Runs
`api.startGame({ type, seed, difficulty, slots })` — `type` is `normal | daily | ranked | coop`; `seed` makes wave composition,
spawns, modifiers, perks, drops and zombie speed deterministic via `api.R()` (use `api.R()` for any new gameplay randomness).

## Maps
`maps.js` exports `MAPS = [{ id, name, desc, bounds, start, fog, sky, env, menu, spawns, build(ctx) }]`: `street`, `mall`, `overpass`, `base`.
`api.MAPS` is `[{ id, name, desc }]`; `api.currentMap` is the loaded map id. `api.startGame({ map })` rebuilds the world when the map
differs (old meshes, lights, textures, obstacles, solids and fires are disposed; nav grid is recomputed from the map bounds) and
remembers it as the menu map. Omitting `map` keeps the current one. `api.loadMap(id)` switches the menu backdrop and emits `map` `{ id }`.
`run:start` and `runSummary()` include `map`; `runSummary()` also lists picked `perks`.

## Perks and revive
Perks are `{ icon, name, desc, apply, when?, rare?, legendary? }` in `api.PERKS` (`features/perks.js` adds the new ones and the HUD strip).
Offers are drawn from a per-wave stream derived from the run seed, so a seeded run always offers the same cards. Legendary cards appear
from wave 10 with an 8% chance per offer. `perk` events carry `{ name, icon, rare, legendary, wave }`.
`api.deathGuards` is a list of functions called when the player dies; returning `true` takes over (the revive feature sets
`state.mode = 'revive'` and later calls `api.gameOver()` or resumes). Revive costs scrap only, once per normal run (never `daily`/`ranked`),
and emits `revive` `{ cost, wave }`. `api.nova(radius)` clears nearby non-boss infected and grants 1.5 s of invulnerability.

## UI slots
`#menu-modes`, `#menu-extras`, `#hud-rival`, `#hud-extras`, `#over-extras`, `#pause-extras`. New full screens: create a
`<section class="screen">`, append it to `document.body`, and call `api.registerScreen(el)`; show with `api.showScreen(el)`.

## Persistence
Feature state lives on `api.profile.<featureId>` and is saved with `api.saveProfile()`. Rewards: `api.grantScrap(n)`, `api.grantXP(n)`.

## Testing
`npm run prepare:web && node tools/smoke.mjs` plays a headless run. `tools/smoke.mjs` also exports `serve`, `launch` and
`openGame` for feature tests; the page is opened with `?debug`, which exposes `window.__game = { api, update, scene, setFiring, gameOver, ... }`.
Native code cannot be compiled in this environment; mock `window.Capacitor` (`PluginHeaders` + `nativePromise`) to test plugin calls.
