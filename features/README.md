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
- `player:death` `{ from, amount }` (before `run:end`; `from` is the attacker's position or `null`) · `tutorial:done` `{}`
- `armory:render` `{ grid, weapon }` — after the Armory grid/detail is rebuilt (decorate cards in `grid`)
- `mission:complete` `{ id, period: 'daily' | 'weekly', xp, scrap }` — a mission reward was claimed (progression)
- `run:submitted` `{ type, board, result }` — after a Game Center submit; `result` is `{ rank, score, total, ... }`, `{ rejected: reason }` or `null`
- `rival:passed` `{ name, rank, score, count, board }` (competitive)
- `streak:claim` `{ count, total }` — the daily streak reward was claimed (progression) · `streak:repair` `{ count, cost }` — a broken streak was bought back

## Runs
`api.startGame({ type, seed, difficulty, slots })` — `type` is `normal | daily | ranked | coop`; `seed` makes wave composition,
spawns, modifiers, perks, drops and zombie speed deterministic via `api.R()` (use `api.R()` for any new gameplay randomness).
`opts.replay()` (optional) returns the options REDEPLOY uses to start the next run of the same mode.
`opts.startWave` (normal runs only; others always start at 1) starts at that wave with score 0 and a starting kit: full grenades and reserve ammo plus
`min(10, ceil((startWave - 1) / 2))` perk picks. `runSummary()`, `run:start` and `saveRun` carry `startWave`; the first `wave:start` has `checkpoint: true`
and starting-kit `perk` events have `kit: true`. `features/checkpoint.js` stores the highest wave cleared per difficulty (`profile.checkpoint.cleared`),
adds the START WAVE stepper next to DEPLOY and sets `api.deployOpts()` (used by DEPLOY and the map sheet).
Leaderboards: `api.gameCenter.boards(type)` routes submits (`daily` → `deadzone.daily`, `ranked` → `deadzone.weekly` + all-time, else all-time);
`api.gameCenter.guard(run)` returns a rejection reason to block a submit; `api.boardView = { id, filter }` picks the board and local-run filter the RANKS screen shows (`api.renderBoard()`).

## Maps
`maps.js` exports `MAPS = [{ id, name, desc, bounds, start, fog, sky, env, menu, spawns, build(ctx) }]`: `street`, `mall`, `overpass`, `base`.
`api.MAPS` is `[{ id, name, desc }]`; `api.currentMap` is the loaded map id. `api.startGame({ map })` rebuilds the world when the map
differs (old meshes, lights, textures, obstacles, solids and fires are disposed; nav grid is recomputed from the map bounds) and
remembers it as the menu map. Omitting `map` keeps the current one. `api.loadMap(id)` switches the menu backdrop and emits `map` `{ id }`.
`run:start` and `runSummary()` include `map`; `runSummary()` also lists picked `perks`.

## Perks and revive
Perks are `{ icon, name, desc, apply, when?, rare?, legendary? }` in `api.PERKS` (`features/perks.js` adds the new ones and the HUD strip).
Offers are drawn from a per-wave stream derived from the run seed, so a seeded run always offers the same cards. Regular waves offer
only minor cards (optional `max` caps how often one can be picked). Every 10th cleared wave (`MAJOR_EVERY`) is a major offer: only `rare`
and `legendary` cards, with one legendary guaranteed while any is still available. A checkpoint kit gets one major pick per 10 skipped waves.
`perk` events carry `{ name, icon, rare, legendary, wave }`.
`api.deathGuards` is a list of functions called when the player dies; returning `true` takes over (the revive feature sets
`state.mode = 'revive'` and later calls `api.gameOver()` or resumes). Revive costs scrap only, once per normal run (never `daily`/`ranked`),
and emits `revive` `{ cost, wave }`. `api.nova(radius)` clears nearby non-boss infected and grants 1.5 s of invulnerability.

## UI slots
`#menu-modes`, `#menu-extras`, `#hud-rival`, `#hud-extras`, `#over-extras`, `#pause-extras`. New full screens: create a
`<section class="screen">`, append it to `document.body`, and call `api.registerScreen(el)`; show with `api.showScreen(el)`.

## Persistence
Feature state lives on `api.profile.<featureId>` and is saved with `api.saveProfile()`. Rewards: `api.grantScrap(n)`, `api.grantXP(n)`.
`features/cloudsave.js` backs up `profile`, `runs` and `records` to iCloud key-value storage through the native `CloudSave` plugin
(`ios/App/App/CloudSavePlugin.swift`): every `api.store.set` of those keys schedules a debounced push, `app:ready`, foregrounding and the
plugin's `changed` event pull the cloud copy, and `mergeProfile` / `mergeRuns` / `mergeRecords` combine the two (higher `runs` is the base,
ownership and claims are unioned, counters take the max). A merged copy is applied in place with `assignDeep`, so keep holding references
to `profile.<featureId>` objects rather than replacing them. A change that arrives mid-run waits for the next `screen` `menu`.
Events: `cloud:pushed` `{ at }`, `cloud:restored` `{ at, device }`. `api.cloud = { pull, push, schedule, available, meta, status }`.

## Testing
`npm run prepare:web && node tools/smoke.mjs` plays a headless run. `tools/smoke.mjs` also exports `serve`, `launch` and
`openGame` for feature tests; the page is opened with `?debug`, which exposes `window.__game = { api, update, scene, setFiring, gameOver, ... }`.
Native code cannot be compiled in this environment; mock `window.Capacitor` (`PluginHeaders` + `nativePromise`) to test plugin calls.

## Cosmetics
Slots in `SLOTS` and encoded `EXTRA_SLOTS` are bit-packed into the 64-bit Game Center context, and every bit is taken. Items past a slot's
bit range (`2 ** bits`) must declare `like`, the index of a lower item they encode as, so other players see the closest look while the
owner sees the real one. Suits can reuse another suit's geometry with `parts` plus colour overrides (`iron`, `cloth`, `fur`, `hood`).
Season rewards: premium tier 1 is the season suit (claimed automatically on purchase), tier 20 the season weapon skin (`req: 'seasonskin:n'`).

## Streak
`streakVisit(s, today, now)` in `features/progression/data.js` counts one visit per UTC day. Reaching a multiple of `SHIELD_EVERY` (7) days earns a
streak shield (`s.shields`, at most `SHIELD_MAX`); a missed day is covered by a shield automatically (`s.shielded`), otherwise the streak breaks and
`s.repair = { was, day, until, cost }` offers to buy it back for `repairCost(was)` scrap until `until` (24 h). `repairOffer(s, now)` returns the live
offer with the restored `count`; `repairStreak(s, now)` applies it. The modal shows shields held, the next shield day and the RESTORE button;
`api.progression.repairStreak()` performs the purchase.

## Level rewards
`features/levels.js` pays every player level once: `levelScrap(level)` scrap (100 × level, capped at 1,500) and, every `CRATE_EVERY` (5) levels, a
level crate holding a random scrap cosmetic the player does not own (`cratePool`, marked NEW in the locker; 1,000 scrap when the pool is empty).
`profile.levels.paid` is the highest level already rewarded; a profile that predates the feature starts paid up to its current level. Rewards are
checked after `run:end` (chips on the game-over screen), on `mission:complete`, `season:claim` and every screen change (reward card). Event:
`level:reward` `{ levels: [{ level, rewards }] }`. `api.levels = { check, rewardsFor, cratePool, state }`.

## Next up
`features/nextup.js` adds a 🎯 NEXT UP chip to the menu dock showing the closest unmet unlock and opens a sheet with the nearest goals.
`goals(api)` scans every locker item and weapon with a requirement or a scrap price, `progress(api, req)` turns a requirement into
`{ cur, need, pct }` (level uses the XP fraction, boss requirements count up to the boss's first wave, league uses held rank; event, recruit and
season requirements have their own surfaces and are skipped). Goals sort by completion, then by size; a weapon the player can already afford
shows READY and opens the Armory, a cosmetic opens the Locker. Refreshes on every return to the menu, `run:end`, `purchase` and `level:reward`.
`api.nextup = { goals, progress, open, close, render }`.

## First deploy
`features/firstdeploy.js` turns a fresh install's first DEPLOY into a training run (`type: 'tutorial'`, Recruit, fixed seed, Street): three short
fixed waves (`WAVES`, applied by overriding `state.queue` on `wave:start`), contextual hints (reload, grenade, supply drop, radar, low health) and a
victory after wave 3 that ends the run with TRAINING COMPLETE and unlocks the MP7 as primary. A training run pays scrap and XP but sets no records,
saves no run and submits nothing (`game.js` guards on `runType === 'tutorial'`). SKIP TRAINING is always available; the first normal run to reach
wave 3 still grants the MP7 once (`profile.tutorial.reward`). The menu is staged for new profiles (`profile.tutorial.staged`): until wave 5 only
DEPLOY, ARMORY, LOCKER, the streak and NEXT UP show; wave 5 reveals the Daily, missions and events; wave 10 reveals ranked, co-op and the season.
Profiles that predate the feature (any run, any best wave, or the old `deadzone.tutorial` flag) are marked done and unstaged. The streak popup now
waits for the first run (`profile.runs > 0`). Events: `tutorial:skip`, `tutorial:reward` `{ weapon }`. `api.firstdeploy = { pending, stage, applyStage, renderMenu, tutorialOpts, waveList, state }`.

## Live ops
- `api.reqs[kind] = { met(v), text(v) }` adds unlock requirements (`req: 'kind:v'`). Used by `league:`, `prestige:`, `event:`, `recruit:`.
- `api.live` holds per-run multipliers `{ count, elite, headScore, scrap, xp, seasonXp, comebackXp, label }`; `features/events.js` sets them on `run:start` (daily runs are never boosted, ranked only gets scrap/xp/season XP).
- Weekend events (`events.js`): Fri 00:00 → Mon 00:00 UTC, rotating BLOOD MOON / SCRAP RUSH / HEADHUNTER / HORDE NIGHT. Clearing wave 10 (8+ waves played) during an event unlocks its weapon skin.
- League rewards (`competitive.js`): when a new week starts, last week's league pays scrap once (`paidWeek`) and shows promotion/relegation. `league:diamond` is met only while last week's or this week's league is Diamond+, so the skin is lost after dropping.
- SPRINT 20: time to clear wave 20 from wave 1 (normal/ranked), stored in `profile.competitive.sprint` and submitted to `deadzone.sprint20`. `api.boardView.format/local/empty` let a board show times and custom local rows.
- Prestige (`progression.js`): a mastered weapon can prestige up to 5 times (mastery reset, +1,500 scrap, ✦ marks). Skins with `anim: 'pulse' | 'cycle'` animate through `animateGunMaterials`.
- Comeback (`comeback.js`): 7+ days away gives a crate (scrap + XP) and `comebackXp = 2` for the next 3 runs.
- Invite reward (`coop.js`): in a session from INVITE FRIENDS, an accepted invite or a shared room code, clearing wave 5 grants BLOOD BROTHERS + 500 scrap once.
- Tests: `node tools/test-live.mjs`.

## Notifications
`features/notify.js` schedules local reminders through the native `Notify` plugin (`ios/App/App/NotifyPlugin.swift`, `UNUserNotificationCenter`;
no server, no push entitlement). `planFor(state, now, tz)` is pure: it builds candidates (streak deadline, Daily closing, league settlement,
weekend event start, lapse on day 3 and 7), moves anything outside 08:00–22:00 local to 09:00 (the Daily reminder is dropped instead) and
keeps at most one per local day, highest priority first. The plan is rebuilt on `app:ready`, every return to the menu, `run:submitted` and when the
app goes to the background; identical plans are not resent. Permission is requested once, after the first `streak:claim`; Settings has a
Reminders toggle. Device state lives in `store` under `notify` (not on the profile, so it is never cloud-synced). Events: `notify:planned` `{ list }`.
`api.notify = { planFor, plan, request, refreshStatus, stateFor, allowed, available, state }`.
