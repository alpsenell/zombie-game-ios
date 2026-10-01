# Last Stand: Deadzone — retention and competitive roadmap

Date: 1 Oct 2026 · Build analysed: `main` at `b630cb9` (Season 1 launch build)

This document is a product-side analysis of the game as it exists in the code, followed by a prioritised backlog of ideas aimed at one goal: losing as few players as possible between install and the end of Season 1, and keeping the competitive modes alive after that. Every finding points at the code that causes it, and every idea names where it would hook in, so each one can be turned into a ticket.

Method: full read of `game.js`, `features/*`, `weapons.js`, `character.js`, the store listing and the release checklist, plus headless bot runs through `tools/smoke.mjs` to measure wave pacing, session length and rewards. Numbers in this document come from those runs and from the formulas in the code, not from live players (the game ships no analytics by design).

---

## 1. Where the game stands

The meta layer is already unusually complete for an indie launch. In the current build a player has:

- **Core loop:** endless waves, four maps, 15 weapons (11 scrap, 4 IAP), 15 infected types, four bosses on every 5th wave with a +60% HP tier every 20 waves, a perk after every wave and a legendary offer every 10th.
- **Daily hooks:** Daily Challenge (seeded, fixed loadout, Veteran), 3 daily missions with one free reroll, 7-day streak calendar with milestone bonuses, first-run-of-the-day double scrap.
- **Weekly hooks:** 3 weekly missions, Ranked Weekly with six percentile leagues and scrap payouts, weekend events (Blood Moon, Scrap Rush, Headhunter, Horde Night) with an event skin each.
- **Long-term:** 30-tier season pass over 42 days, player level with ~30 level-gated cosmetics, weapon mastery with five prestige ranks, 25 Game Center achievements, Sprint 20 speedrun board, checkpoint starts every 5 cleared waves.
- **Social:** 2–4 player co-op over GameKit, invite reward (Blood Brothers outfit), shareable run card, live rival ticker in the HUD.
- **Safety nets:** scrap revive once per run, comeback crate after 7 days away.

So the problem is not "missing systems". The risk sits in six places: the first ten minutes, the shape of a session (long, all-or-nothing), hard streak loss with no channel to call the player back, competitive modes that are expensive to enter, progress that is not safe across devices, and a top-10% who will run out of goals three weeks into the season.

---

## 2. Measured pacing

Bot runs on Survivor, M4A1 + R-870, perfect aim, simple kiting. A human with imperfect aim will be 20–40% slower per wave; treat these as lower bounds.

| Wave | Horde size | Clock at clear | Notes |
| --- | --- | --- | --- |
| 1 | 6 | 0:13 | |
| 2 | 8 | 0:37 | |
| 3 | 11 | 1:02 | |
| 4 | 14 | 1:32 | |
| 5 | 11 + boss | 2:10 | Abomination. A bot that only aims and never moves dies here on every difficulty. |
| 6 | 20 | 2:40 | |
| 10 | 36 | ≈ 5:30 (est.) | |
| 15 | ≈ 60 + boss | 2.5 min for this wave alone (measured from a checkpoint start) | |
| 20 | 90 (cap) | ≈ 18–22 min (est.) | Horde size is capped at 90 from here on; waves get longer only through HP scaling (+12%/wave). |
| 25 | 90 + boss | ≈ 30–40 min (est.) | |

Rewards for a representative early run (death on wave 7, Survivor, 100 kills, 37.6k score):

| | Amount | Where it comes from |
| --- | --- | --- |
| Scrap | 353 (706 on the first run of the day) | `grantRewards()` in `game.js` |
| XP | 4,114 | same |
| Season XP | 537 of a 600 cap | `runXP()` in `features/season.js` |

Derived pacing from the formulas:

| Goal | Cost | Time at the pace above |
| --- | --- | --- |
| First scrap weapon (MP7) | 800 scrap | 2–3 runs plus missions; usually day 2, not session 1 |
| Every scrap weapon | 20,100 scrap | ~3–4 weeks of daily play |
| Level 10 / 20 / 50 | 77k / 403k / 3.4M XP | ~19 / ~100 / ~850 wave-7 runs |
| Master one weapon | 14,620 mastery XP | ~975 kills |
| Season pass tier 30 | 30,000 season XP, 600 per run cap | 49 capped runs; an engaged player is done in 7–10 days of a 42-day season |
| Streak, first week | 1,100 scrap total | 7 consecutive days |

Two things stand out. The first skill wall (a boss) arrives at minute two with the starting weapons and no perks of note, and everything the game wants a player to care about competitively needs a 30-minute uninterrupted mobile session.

---

## 3. Churn points found in the code

Ordered by estimated impact on retention. Each has a what, a why, the evidence, and the fix.

### A. Progress is not safe across devices or reinstalls
`profile`, `runs`, `records` and `settings` live only in WKWebView `localStorage` (`store` in `game.js`). Delete the app, switch phones, or hit an iOS storage purge and the player loses level, scrap, outfits, mastery, streak and season progress. Purchases restore through StoreKit, nothing else does. This is the single most common reason for one-star reviews and permanent churn in games without an account.

Fix: a `CloudSavePlugin.swift` wrapping `NSUbiquitousKeyValueStore` (1 MB limit, the profile is a few KB). Sync on `app:ready`, after `saveProfile()` (debounced) and on `visibilitychange`. Merge rule: take the record with the higher `profile.runs`, union `owned`, `iap`, `arsenal.owned`, achievements and season claims, keep the max of every stat. It uses Apple's infrastructure only, so the "no data collected" declaration can stay (verify against Apple's current App Privacy guidance for iCloud KVS).

### B. There is no channel to bring a lapsed player back
The game has zero notifications. The streak, the daily reset, league settlement and weekend events all run on timers the player has to remember. Local notifications need no server and no data collection.

Fix: `@capacitor/local-notifications`, scheduled from JS on every return to the menu, with at most one notification a day:

| Trigger | When | Copy |
| --- | --- | --- |
| Streak at risk | 20:00 local if no run today and streak ≥ 2 | "Your 12-day streak ends at midnight. One run keeps it." |
| Daily closing | 2 h before 00:00 UTC if ranked today | "You're #42 on today's Daily. 2 hours left." |
| Event start | Friday 00:00 UTC | "Blood Moon is live until Monday. Elite skin up for grabs." |
| League settled | Monday 00:00 UTC | "Gold League week complete. Collect 800 scrap." |
| Lapse | day 3 and day 7 of no play | "The horde moved on. Your comeback crate is waiting." (day 7 only) |

Ask for permission after the first streak claim, not at launch, so the prompt has context.

### C. The streak resets to zero, and says so
`streakVisit()` in `features/progression/data.js` sets `count = 1` after a single missed day and the modal says "YOU MISSED A DAY — STREAK RESET TO DAY 1 (WAS 29)". Losing a 29-day streak is a documented quit trigger; the player who sees this message is the most engaged player you have.

Fix (any of these, cheapest first):
1. **Streak shield:** one free shield earned every 7 days of streak, consumed automatically on a missed day; show the shield count on the calendar.
2. **Repair:** for 24 h after a miss, offer "RESTORE STREAK — 🔩 n" where n scales with the streak (a scrap sink the economy needs anyway, see J).
3. **Soft reset:** drop to the start of the current 7-day cycle rather than day 1, so a 29-day streak falls to 22, not 1.

### D. The first session front-loads the meta and hides the fun
Observed sequence for a brand-new player, from `game.js` and `features/progression.js`:
1. The menu shows DAILY, RANKED, CO-OP, MAP, a league badge, four difficulties, DEPLOY, ARMORY, LOCKER, MISSIONS, a streak button, SEASON and the event chip at once.
2. Within half a second a streak modal appears asking the player to claim 50 scrap before they have fired a shot (`streakCheck()` → `openStreak()` on `app:ready`).
3. The tutorial is two hints: move, then aim. Nothing explains reload, grenades, sprint, the radar, pickups, the boss ring or the perk screen.
4. Daily is locked to Veteran (`DAILY_DIFFICULTY`), so a day-one player who taps the most prominent mode gets 1.3× HP, 1.35× damage hordes with weapons they have never held.
5. Wave 5 puts a 3,400 HP boss with a 5.6 m slam in front of a player holding an M4 and two grenades.
6. The first purchase (MP7, 800) is out of reach in session one.

Fix:
- **Guided first deploy:** a scripted three-wave run (fixed small spawns, hint cards for reload at first empty mag, grenade at first group of four, pickup glow, the boss ring explained by a harmless telegraph on wave 3) that ends with a guaranteed unlock. Reuse the seeded run path (`startGame({ seed, slots })`) so it needs no new engine code.
- **Guaranteed first unlock in session one:** grant the MP7 or a weapon skin at the end of the first run that reaches wave 3. First-unlock-in-session-one is the strongest D1 lever in this genre.
- **Staged menu:** show only DEPLOY, ARMORY, LOCKER until the player has cleared wave 5 once; reveal DAILY and MISSIONS next, RANKED, CO-OP and SEASON after wave 10. Use `api.reqs` and the `screen` event; everything already exists, it only needs gating.
- **Move the streak modal** to after the first `run:end`.
- **Daily for new players:** see F.

### E. Runs are long and all-or-nothing
A competitive run to wave 25 is a 30–40 minute session. Death ends it; the only mitigation is checkpoint starts, which are refused in Daily, Ranked and Sprint (`plausible()` rejects `startWave > 1`). An interrupted session (phone call, iOS killing the app in the background) loses the run entirely because nothing is persisted mid-run. Every run ends in a death screen, so the emotional ending of every session is a loss.

Fix:
1. **Short-format competitive modes.** Make the Daily a fixed 10-wave format (score at the end of wave 10, ~6 minutes) and add a 5-minute **Blitz** score attack (fixed timer, infinite spawns, score counts). Sprint 20 already exists but is buried in a leaderboard tab; promote it to the mode row. Short formats are what let a player compete on a commute.
2. **Extraction mode with a win condition.** After waves 10, 20 and 30 offer "EXTRACT NOW" for a banked bonus (for example +25% of score and a guaranteed supply crate) versus "HOLD THE LINE". Extracting ends the run with a victory screen; dying forfeits the bonus. This gives the player a positive ending to choose and makes the moment-to-moment decision interesting. Implement as `type: 'extract'` on `startGame` with its own leaderboard.
3. **Resume after interruption.** Snapshot `state`, `player`, `stats`, perks and the zombie list on `visibilitychange` and offer "RESUME RUN" on launch within 10 minutes (normal and extract modes only; competitive modes stay strict).

### F. Ranked mixes difficulties, so the ladder belongs to Nightmare
`rankedOpts()` uses whatever difficulty the player has selected and the score multiplier runs from 0.5× (Recruit) to 3× (Nightmare). The weekly board therefore sorts almost entirely by difficulty, and a Survivor player can never reach Gold whatever they do. New players sit at UNRANKED with no idea what a league means. With a small population, percentile leagues also swing wildly week to week.

Fix:
- **Tie difficulty to league:** Bronze and Silver play Ranked on Survivor, Gold and Platinum on Veteran, Diamond and Legend on Nightmare. The multiplier stays, promotions mean something, and nobody is punished for being new.
- **Placement runs:** the first three ranked runs of a season place the player; show "PLACEMENT 2/3" on the badge.
- **League-relative rank:** show "#14 in Gold" on the game-over screen, not "#1,284 weekly".
- **End-of-season league reward** (title + scrap) based on the best league held, which makes the six-week season matter to ranked players.

### G. Levelling up gives nothing
Level is only a gate for cosmetics. `grantRewards()` shows a "LEVEL UP" chip and nothing else. Levels get rare fast (level 10 after ~19 runs, level 20 after ~100), so the one universal progress bar in the game stops paying out exactly when the player needs encouragement.

Fix: scrap on every level (100 × level, capped at 1,500), a title every 5 levels, and a **level crate** every 10 levels containing a random cosmetic the player does not own. Hook: compare `levelInfo()` before and after in `grantRewards()`.

### H. The season pass is finished in a week and then goes quiet
49 capped runs reach tier 30. An engaged player finishes in 7–10 days, then has 32 days with no season progression and nothing new until Season 2. The free track is 26 scrap/XP drops and two flairs, which is not a reason to open the SEASON screen.

Fix:
- **Bonus tiers past 30:** repeatable tier (1,500 scrap + a random owned-skin recolour) every 2,000 season XP; show "TIER 30+7".
- **Weekly season challenges:** three per week worth 1,500 season XP each (e.g. "clear wave 15 on the Overpass", "kill 3 bosses with the Boomstick"). Mission infrastructure already supports this (`TEMPLATES` with `weekly`).
- **Mid-season drop:** one new cosmetic appears in the free track at week 3, announced on the menu chip.

### I. Weekend events are one-and-done
Each event's reward is a skin for clearing wave 10 once (`features/events.js`). After the four-week rotation a player owns all four skins and events become a scrap multiplier with a chip on the menu. Nothing about the event changes how the game plays except Horde Night.

Fix:
- **Event ladder:** three goals per event (clear wave 10 for the skin, 50k event score for 1,500 scrap, top 10% on an event leaderboard for an animated variant), tracked on the event card.
- **Mechanical twists:** Blood Moon elites drop health only on headshot, Headhunter removes aim assist for 2× score, Horde Night sets `alive` cap to 24, Scrap Rush adds a timed "scrap bag" pickup. Each is a few lines in `modsFor()` and `waveComposition()`.
- **Event missions:** one daily mission during an event that only counts event runs.

### J. Scrap has nothing to buy once the weapons are owned
All scrap weapons cost 20,100 combined, prestige injects 1,500 per prestige, league rewards up to 4,000 a week, and cosmetics are static one-time purchases. A veteran accumulates scrap with no reason to spend it, which quietly removes the reward loop.

Fix:
- **Black Market:** a daily rotating shop (seeded from the day key, like missions) with three items: one discounted cosmetic, one exclusive recolour that only ever appears in the shop, one consumable (streak shield, revive token, mission reroll).
- **Supply crate** for 1,000 scrap with a visible pity counter: cosmetic or skin shard, never a duplicate until the pool is empty.
- **In-run reroll** of a perk offer for 100 × wave scrap, once per wave, normal and extract modes only.
- Streak repair (C) and extraction insurance (E) are additional sinks.

### K. There is no "what should I do next" surface
Unlock requirements exist for ~45 items (`reqMet()` / `api.reqs`), but the only place a player sees them is a locked card in the Locker. There is no stats page, no "nearest unlock", no per-map or per-weapon record.

Fix:
- **Next up widget** on the menu: the three closest unmet requirements with progress bars ("GAS MASK · wave 12/15", "KATANA · 211/250 headshots"). Everything needed is already in `profile`.
- **Dossier screen:** best wave per map and difficulty, per-weapon kills and mastery, bosses killed, run history (the 25 saved runs), personal records. Cheap to build, high perceived depth.

### L. Co-op is hard to find and rewards once
Co-op lives behind Game Center matchmaking, the invite reward is a single outfit, and the game-over screen of a co-op run offers only "SQUAD LOBBY". There is no reason to play with the same people twice.

Fix:
- **Squad bonds:** play 3, 10 and 25 runs with the same squad for shared titles and a squad banner on the run card.
- **Co-op weekly mission** ("revive 5 teammates", "clear wave 10 with a full squad").
- **Quick-join from game over** of a solo run ("3 squads looking for a fourth"). GameKit's automatch supports this.
- **Squad Daily:** the Daily seed is playable in co-op with a separate co-op board.

### M. Veterans run out of novelty
The boss order repeats every 20 waves with a flat HP bump, maps differ in layout only, and wave modifiers are three random flags. By wave 30 the player has seen every mechanic.

Fix:
- **Boss variants** from the second cycle on: Abomination that splits, Butcher that charges twice, Plague King that spawns a screamer, Goliath with a destroyable helmet.
- **Map events:** the Mall's fountain floods (crawlers slow), Fort Hollow searchlights expose stalkers, Overpass car pile-ups collapse and change the nav grid mid-wave.
- **Mutator deck** for normal runs: the player picks up to three mutators before deploying (no radar, double runners, no pickups) for a score multiplier, shown on the run card. It reuses `MUTATIONS` and `api.live`.
- **Featured map of the week** with 1.5× XP.

---

## 4. Idea backlog, prioritised

Effort: S = a day, M = a few days, L = a sprint. Impact is an estimate of effect on D1/D7/D30 retention.

### Tier 1 — ship before Season 1 ends

| # | Idea | Covers | Effort | Impact |
| --- | --- | --- | --- | --- |
| 1 | iCloud key-value progress sync | A | M | D30, reviews |
| 2 | Local notifications, five triggers, one a day max | B | M | D7, D30 |
| 3 | Streak shield + 24 h scrap repair | C | S | D7, D30 |
| 4 | Guided first deploy + guaranteed unlock in session one + staged menu | D | M | D1 |
| 5 | Level rewards: scrap per level, title every 5, crate every 10 | G | S | D7 |
| 6 | Daily Challenge as a fixed 10-wave format with a Survivor bracket for players below level 10 | D, E, F | M | D1, D7, daily participation |
| 7 | Next up widget on the menu | K | S | D7 |

### Tier 2 — first content update of Season 1

| # | Idea | Covers | Effort | Impact |
| --- | --- | --- | --- | --- |
| 8 | Extraction mode with banked bonus and victory screen | E | L | D7, session satisfaction |
| 9 | Ranked: league-tied difficulty, placements, league-relative rank, end-of-season reward | F | M | competitive retention |
| 10 | Season bonus tiers + weekly season challenges + mid-season drop | H | M | D30 |
| 11 | Event ladders, event leaderboard, one mechanical twist per event | I | M | weekend DAU |
| 12 | Black Market rotating shop + supply crate with pity | J | M | D30, scrap sink |
| 13 | Blitz 5-minute score attack, promote Sprint 20 to the mode row | E | S | daily participation |

### Tier 3 — Season 2

| # | Idea | Covers | Effort | Impact |
| --- | --- | --- | --- | --- |
| 14 | Resume an interrupted run | E | M | session completion |
| 15 | Dossier screen | K | M | perceived depth |
| 16 | Squad bonds, co-op weekly mission, quick-join, Squad Daily | L | L | social retention |
| 17 | Boss variants, map events, mutator deck, featured map | M | L | veteran retention |
| 18 | Ghost pace: show the Daily #1's wave-clear times in the rival ticker | competitive | S | daily engagement |
| 19 | Friends-first game over: "you passed 2 friends" line and friends board tab by default when signed in | competitive | S | social |

---

## 5. Competitive-specific notes

The rival ticker (`features/competitive.js`) and the Daily are the strongest competitive pieces; both suffer from the long format. Beyond the ranked changes in F:

- **Attempt counter on the Daily.** Today the rule is "retry as often as you like". With a 10-wave format, show attempts used ("ATTEMPT 2") and the best of the day. Unlimited retries at 30 minutes each turn the Daily into a grind for the top 1% and discourage everyone else; a visible count turns it into a story.
- **Daily board by level bracket.** Game Center allows one board per bracket; a `deadzone.daily.rookie` board for players under level 10 gives new players a ladder they can see themselves on. `plausible()` can carry the bracket in the submitted context.
- **Legend visibility.** Legend is "top 100 and top 3%". Show the current Legend cut-off score on the Ranked sheet so chasing it has a number.
- **Anti-cheat follow-up.** `plausible()` is a sensible floor. Add a per-device daily submission cap (e.g. 20) and reject scores whose `time` is below the measured bot pace per wave (the table in section 2 is a usable lower bound).

---

## 6. Measuring success without analytics

The game collects no data, and the roadmap keeps it that way. What is still measurable:

- **App Store Connect:** D1/D7/D30 retention, sessions per active device, crashes. Benchmarks for a mid-core mobile shooter: D1 ≥ 40%, D7 ≥ 20%, D30 ≥ 10%. Compare cohorts per build version when a Tier 1 item ships.
- **Game Center totals:** the app already reads `total` for the daily, weekly, all-time and sprint boards. The daily total is a proxy for signed-in DAU, the weekly total for WAU, and their ratio for daily participation. Log them in the console during testing; they are also visible in App Store Connect → Game Center.
- **Reviews:** track mentions of "lost progress", "too hard", "streak" before and after Tier 1.

If on-device metrics are ever wanted, an opt-in, aggregate-only counter (runs, best wave, tier reached) shown to the player and never uploaded keeps the privacy stance intact.

---

## 7. Hook points in the code

| Idea | Where it attaches |
| --- | --- |
| Cloud sync | new `ios/App/App/CloudSavePlugin.swift`, called from `saveProfile()` and `app:ready` |
| Notifications | new feature module `features/notify.js` on `screen:menu` and `run:end`; native via `@capacitor/local-notifications` |
| Streak shield / repair | `streakVisit()` and `openStreak()` in `features/progression` |
| Guided first deploy | `startGame({ seed, slots, type: 'tutorial' })`, a fixed `waveComposition` override for `type === 'tutorial'`, hints through `api.hint()` |
| Staged menu | `api.reqs` + toggling `#menu-modes` / `#menu-extras` children on the `screen` event |
| Level rewards | `grantRewards()` level diff, `profile.levelClaimed` |
| Daily 10-wave format | `dailyOpts()` with `maxWave: 10`; `waveCleared()` ends the run when `state.wave === maxWave`; `plausible()` learns the cap |
| Extraction | `type: 'extract'`, a modal from `waveCleared()` at waves 10/20/30, bank in `state.bank`, new board `deadzone.extract` |
| Ranked brackets | `rankedOpts()` reads difficulty from `heldRank()`; `openRanked()` shows it |
| Season bonus tiers | `tierOf()` / `reward()` in `features/season.js` for `t > TIERS` |
| Event ladder | `features/events.js` `E().won[id]` becomes `{ skin, score, board }` |
| Black Market | new `features/market.js`, seeded from `dayKey()`, items from `SLOTS` with `cost` |
| Next up widget | new `features/nextup.js` scanning `ALL_SLOTS` with `reqMet()` and progress from `profile` |
| Mutator deck | `MUTATIONS` exposed on `startGame` opts, multiplier through `api.live` |

---

## 8. Suggested order of work

1. Cloud sync and notifications first: they protect the players already acquired and cost nothing in design time.
2. Streak shield, level rewards and the next-up widget are each a day and change the daily feel immediately.
3. The guided first deploy and the 10-wave Daily are the D1 bet; ship them together so a new player's first competitive run is six minutes long and winnable.
4. Extraction mode and ranked brackets are the Season 1 mid-point update, announced through an In-App Event.
5. Everything in Tier 3 is Season 2 material and can be scoped against what the Game Center totals show.
