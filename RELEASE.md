# App Store release checklist

The local iOS project is generated from `index.html` through Capacitor. The game contains no third-party gameplay assets or advertising SDKs. The game collects no data: it contains no analytics, crash-reporting or tracking code.

## Before uploading

1. Enroll the account that will publish the game in the Apple Developer Program.
2. In `capacitor.config.json`, change `appId` if `com.alpsenel.laststanddeadzone` is not an identifier owned by that account. Once an app is uploaded, do not change it.
3. Run `npm run sync:ios`, then `npm run open:ios`.
4. In Xcode, select the publishing Team under **Signing & Capabilities**, set the deployment target, then choose **Product → Archive** and upload the archive to App Store Connect.
5. In App Store Connect, open the app → **Services → Game Center**, enable Game Center, and create two **Classic leaderboards** (score format *Integer*, sort *High to Low*, submission *Best score*):
   - `deadzone.highscore` — "Top Survivors" (run score; harder difficulties multiply score)
   - `deadzone.bestwave` — "Deepest Wave"
   Also create two **Recurring leaderboards** (same format: *Integer*, *High to Low*, *Best score*) for competitive play:
   - `deadzone.daily` — "Daily Challenge": duration **1 day**, restarts every **1 day**, start date at **00:00 UTC** (the in-game daily seed rolls over at 00:00 UTC; App Store Connect shows times in your local zone, so convert). The Daily is a fixed 10-wave format: clearing wave 10 ends the run with the score banked, a death counts too.
   - `deadzone.daily.rookie` — "Daily Challenge · Rookie": same settings as `deadzone.daily`. Players under level 10 play the same seed on Survivor and rank here; from level 10 the Daily is Veteran on `deadzone.daily`.
   - `deadzone.weekly` — "Ranked Weekly": duration **1 week**, restarts every **1 week**, start date on a **Monday at 00:00 UTC** (leagues and the in-game countdown assume Monday resets; the app reads the real next start date from Game Center when signed in).
   - `deadzone.weekly.veteran` — "Ranked Weekly · Veteran" and `deadzone.weekly.survivor` — "Ranked Weekly · Survivor": same settings as `deadzone.weekly`. Ranked is played in three brackets that set the difficulty: Bronze and Silver (and new players) play Survivor on the `.survivor` board, Gold and Platinum play Veteran on the `.veteran` board, Diamond and Legend play Nightmare on `deadzone.weekly`. Promotion and relegation are computed on the device from the player's percentile on their bracket's board (`BRACKETS` in `features/competitive.js`); the first three ranked runs of a season show as placements.
   Routing: DAILY runs submit only to `deadzone.daily` (Veteran) or `deadzone.daily.rookie` (Survivor, under level 10); RANKED runs (no premium weapons) submit to their bracket's weekly board (`deadzone.weekly`, `.veteran` or `.survivor` by the run's difficulty) plus the all-time boards; EXTRACTION runs submit only to `deadzone.extract`; BLITZ runs submit only to `deadzone.blitz`; normal runs submit to `deadzone.highscore`/`deadzone.bestwave` only. Leagues (Bronze → Legend) are computed on the device from the player's rank / total players on their bracket's weekly board; the best league held in a season pays a scrap reward when the next season starts.
   Also create a **Classic leaderboard** for Extraction mode:
   - `deadzone.extract` — "Extraction": score format *Integer*, sort *High to Low*, submission *Best score*. Extraction runs bank their score with a multiplier when the player extracts after wave 10, 20 or 30 (up to ×2); a death forfeits the bonus and submits the raw score.
   Also create one more **Classic leaderboard** for speedruns:
   - `deadzone.sprint20` — "Sprint 20": score format **Elapsed Time – To the Hundredth of a Second**, sort **Low to High**, submission *Best score*. The app submits the time to clear wave 20 in hundredths of a second (normal/ranked runs started at wave 1; co-op and checkpoint starts are excluded).
   - `deadzone.daily.squad` — "Squad Daily": same settings as `deadzone.daily`. Co-op squads can play the day's Daily seed together (SQUAD DAILY in the lobby); every member submits the squad's shared score here.
   Also create a **Classic leaderboard** for Blitz:
   - `deadzone.blitz` — "Blitz": score format *Integer*, sort *High to Low*, submission *Best score*. Blitz is a 5-minute score attack on Veteran with every weapon allowed; the score when the timer ends (or at death) is submitted.
   Also create a **Recurring leaderboard** for the weekend events:
   - `deadzone.event` — "Weekend Event": score format *Integer*, sort *High to Low*, submission *Best score*, start date **Friday 25 Sep 2026 00:00 UTC**, duration **3 days**, restarts every **1 week**. Normal deploys during a live weekend event submit here as well as to the all-time boards. The event ladder's third goal (an animated weapon skin) is awarded on the device to players in the top 10% of this board while at least 20 players are on it.
   Add all twelve leaderboards to the app version before submitting. The IDs must match `LEADERBOARDS` in `game.js` (and `BOARDS` in `features/competitive.js`).
   Each submitted score carries the player's character loadout packed into the Game Center score *context* (see `encodeLoadout` in `character.js`). This is how other players' outfits appear in the leaderboard without a server. Keep the order and bit widths of `SLOTS` stable; append new items to the end of an existing slot instead of reordering. The 53-bit context is full: the low two bits are a tag (`1` = male body, `3` = female body), so no new slot can be added.
   **Achievements.** Under **Services → Game Center → Achievements** create these 25 achievements (not hidden, *Achievable more than once* off; add a title, pre-earned/earned description and a 512×512 or 1024×1024 image for each). Points total 995 of Apple's 1,000 limit. The IDs must match `ACHIEVEMENTS` in `features/progression/data.js` (prefix `deadzone.ach.`); progress is reported as a percentage, so partial progress shows in Game Center.

   | ID | Title | Points | How to earn |
   | --- | --- | --- | --- |
   | `deadzone.ach.first_blood` | First Blood | 10 | Kill your first infected |
   | `deadzone.ach.kills_100` | Centurion | 15 | Kill 100 infected |
   | `deadzone.ach.kills_1000` | Horde Breaker | 40 | Kill 1,000 infected |
   | `deadzone.ach.kills_10000` | Extinction Event | 90 | Kill 10,000 infected |
   | `deadzone.ach.heads_100` | Headhunter | 20 | 100 headshot kills |
   | `deadzone.ach.heads_1000` | Deadeye | 60 | 1,000 headshot kills |
   | `deadzone.ach.wave_10` | Hold the Line | 20 | Reach wave 10 |
   | `deadzone.ach.wave_20` | Breaking Point | 40 | Reach wave 20 |
   | `deadzone.ach.wave_30` | Unbreakable | 60 | Reach wave 30 |
   | `deadzone.ach.wave_50` | Horde Legend | 100 | Reach wave 50 |
   | `deadzone.ach.boss_abomination` | Abomination Slain | 30 | Defeat the Abomination |
   | `deadzone.ach.boss_butcher` | Butchered | 30 | Defeat the Butcher |
   | `deadzone.ach.boss_plague` | Regicide | 30 | Defeat the Plague King |
   | `deadzone.ach.boss_goliath` | Giant Killer | 30 | Defeat Goliath |
   | `deadzone.ach.nightmare_10` | Nightmare Survivor | 80 | Clear wave 10 on Nightmare |
   | `deadzone.ach.arsenal_5` | Arms Dealer | 20 | Own 5 weapons |
   | `deadzone.ach.arsenal_scrap` | Full Arsenal | 50 | Own every scrap weapon (no purchase needed) |
   | `deadzone.ach.mastery_max` | Weapon Master | 50 | Reach mastery 10 with any weapon |
   | `deadzone.ach.streak_7` | Dedicated | 20 | Play 7 days in a row |
   | `deadzone.ach.streak_30` | Never Miss a Shift | 50 | Play 30 days in a row |
   | `deadzone.ach.missions_25` | On Duty | 30 | Complete 25 daily/weekly missions |
   | `deadzone.ach.combo_25` | Chain Reaction | 30 | Reach a 25 kill streak |
   | `deadzone.ach.burn_250` | Scorched Earth | 30 | 250 kills on burning infected |
   | `deadzone.ach.elites_50` | Elite Hunter | 30 | Kill 50 elites |
   | `deadzone.ach.sharpshooter` | Sharpshooter | 30 | Finish a run of wave 5+ with 70% accuracy |

   Achievements are reported by the native `AchievementsPlugin` (`ios/App/App/AchievementsPlugin.swift`, JS name `Achievements`); it must be registered with the Capacitor bridge alongside `GameCenterPlugin` and `StorePlugin`. Progress is also tracked on the device, so the in-game ACHIEVEMENTS list works without Game Center and is synced once the player signs in.
6. **In-App Purchases (iOS exclusive weapons).** Sign the *Paid Apps Agreement* in App Store Connect, then under the app's **Monetization → In-App Purchases** create four **Non-Consumable** products (a display name, description, price tier and review screenshot each):
   - `com.alpsenel.laststanddeadzone.weapon.tesla` — Tesla Arc
   - `com.alpsenel.laststanddeadzone.weapon.cryo` — Cryo Lance
   - `com.alpsenel.laststanddeadzone.weapon.singularity` — Singularity
   - `com.alpsenel.laststanddeadzone.weapon.dragon` — Dragon's Breath
   Also create four **Non-Consumable** exclusive outfits (Locker → ★ EXCLUSIVE tab):
   - `com.alpsenel.laststanddeadzone.outfit.ronin` — Cyber Ronin
   - `com.alpsenel.laststanddeadzone.outfit.knight` — Infernal Knight
   - `com.alpsenel.laststanddeadzone.outfit.spectre` — Spectre
   - `com.alpsenel.laststanddeadzone.outfit.wolf` — Arctic Wolf
   **Season Pass.** Seasons last 6 weeks, counted from `EPOCH` in `features/season.js` (season 1 starts 21 Sep 2026 UTC). Each season needs its own **Non-Consumable** product, created before that season starts:
   - `com.alpsenel.laststanddeadzone.season.1.pass` — Season 1 Pass (Black Harvest, 21 Sep – 2 Nov 2026)
   - `com.alpsenel.laststanddeadzone.season.2.pass` — Season 2 Pass (Deep Water, 2 Nov – 14 Dec 2026)
   - `com.alpsenel.laststanddeadzone.season.N.pass` for later seasons.
   The pass unlocks the premium reward track of that season only (scrap, card flair and, for seasons 1 and 2, the HOLLOW JACK / DEEP DIVER outfits). It gives no gameplay advantage. Rewards unlocked before buying can be claimed afterwards.
   The free track keeps paying past tier 30: every 2,000 season XP is a free bonus tier (1,500 scrap, every third one a crate with a random cosmetic). Free tier 25 is the mid-season drop (a random cosmetic) and only opens from day 14 of the season. Three weekly season challenges (SEASON tab in MISSIONS) each pay 1,500 season XP on top of the mission reward; none of this is purchasable.
   The IDs are derived from `STORE_PREFIX` + `premium` in `weapons.js` / `SUITS` in `character.js`; if `appId` changes, update `STORE_PREFIX` to match. Prices shown in the Armory come from StoreKit (localized), never hardcoded. Submit the products together with the app version for review. The Armory has the required **RESTORE** button. To test before release, use a Sandbox tester account on a device, or run from Xcode with the StoreKit Configuration file `ios/App/App/Products.storekit` (all ten product IDs above; it is selected in the shared *App* scheme's Run options, so purchases in the Simulator are local test transactions).
7. **Share plugin.** `ios/App/App/SharePlugin.swift` (jsName `Share`, methods `share` / `shareImage`) presents the iOS share sheet for the game-over run card. The file is in the App target and is already registered in `MainViewController.capacitorDidLoad()` with `bridge?.registerPluginInstance(SharePlugin())`, alongside `GameCenterPlugin`, `StorePlugin`, `AchievementsPlugin` and `MatchPlugin`. `Info.plist` carries `NSPhotoLibraryAddUsageDescription`, which the share sheet's *Save Image* action requires.
8. The Xcode target already includes the Game Center entitlement (`App/App.entitlements`). If Xcode reports a provisioning mismatch, add **Game Center** under **Signing & Capabilities** so the profile is regenerated.
9. **iCloud progress sync.** `App.entitlements` carries `com.apple.developer.ubiquity-kvstore-identifier` (`$(TeamIdentifierPrefix)$(CFBundleIdentifier)`). Under **Signing & Capabilities** add **iCloud** and tick only **Key-value storage** (no CloudKit container is needed), then make sure the App ID in the developer portal has iCloud enabled so the profile regenerates. The native `CloudSavePlugin` (`ios/App/App/CloudSavePlugin.swift`, JS name `CloudSave`, registered in `MainViewController.capacitorDidLoad()`) stores a single key, `deadzone.save`, in `NSUbiquitousKeyValueStore`: the player's profile, last 25 runs and records as JSON, well under the 1 MB store limit. `features/cloudsave.js` pushes after every save (debounced) and merges the iCloud copy on launch, on foregrounding and when another device writes; Settings shows the backup state and a SYNC NOW button. The data lives in the player's own iCloud account and is never sent to us, so the App Privacy answer stays *Data Not Collected*; confirm against Apple's current guidance for iCloud key-value storage when filling in the questionnaire. To test, run on two devices (or a device and the Simulator) signed in to the same Apple ID with iCloud Drive on; progress made on one appears on the other within a minute of returning to the menu.
9. In App Store Connect, complete store listing metadata, the privacy questionnaire, age rating, screenshots, and App Review notes. This game should generally be described as containing frequent cartoon/fantasy violence; use Apple’s current rating questionnaire to make the final selection.

## Cheaters and leaderboard moderation

Before submitting, the game runs a conservative plausibility check (`plausible()` in `features/competitive.js`): score against the maximum a run of that wave, kill count, difficulty and boss count could earn, kills per wave and per second, minimum time per wave, and for DAILY/RANKED runs that no premium weapon was used and the daily seed/loadout/difficulty match. Impossible runs are not submitted and the game-over screen says so. The limits are deliberately loose, so a modified client can still post a high-but-possible score; remove those by hand:

1. In App Store Connect open **Apps → (the app) → Services → Game Center → Leaderboards** and select the leaderboard (`deadzone.highscore`, `deadzone.bestwave`, `deadzone.weekly`, `deadzone.daily` or `deadzone.daily.rookie`; for recurring boards pick the current occurrence).
2. In the leaderboard's scores list, find the player (the list shows the Game Center alias and player ID) and choose **Remove score** / remove the player from the leaderboard. Apple lets you either delete that single score or hide the player from the leaderboard permanently; use the permanent option for repeat offenders and remove them from every board they appear on.
3. Removal is immediate for new score loads; cached ranks on devices refresh on the next leaderboard load. League badges recompute from the weekly board, so a removed cheater also stops pushing honest players down a league.

Menu labels move occasionally; if the option is not on the leaderboard page, search the App Store Connect help for "remove leaderboard scores".

## Privacy draft

The game shows no ads and requires no account. It offers optional non-consumable In-App Purchases (four weapons, four outfits and a Season Pass per season), processed entirely by Apple through StoreKit; the game stores only which products the player owns, on the device. Global leaderboards use Apple Game Center: scores are sent to Apple through GameKit, and the game itself runs no servers. Players who are not signed in to Game Center can still play; their runs are kept only on the device. Check Apple's current guidance on declaring Game Center use in the App Privacy answers.

### Data collection

The game collects no data. There is no analytics, crash-reporting or tracking code, and the game makes no network requests of its own besides Apple's GameKit and StoreKit.

App Store Connect → **App Privacy:** *Data Not Collected*.

**Privacy manifest.** `ios/App/App/PrivacyInfo.xcprivacy` is in the App target's *Copy Bundle Resources* phase and declares no tracking, no tracking domains and no collected data types (`NSPrivacyCollectedDataTypes` is an empty array). Web `localStorage` is not a required-reason API; if native code later reads `UserDefaults` or file timestamps directly, add the matching `NSPrivacyAccessedAPITypes` entries (Capacitor's own manifest covers the framework). If a data feature is ever added, update the App Privacy answers, this manifest and the privacy policy before submission.

## Test notes for App Review

The game starts immediately from the title screen. Optional MUTATORS next to DEPLOY make a normal run harder for a higher score; they are free and cosmetic-neutral. It is a single-player game with an optional online CO-OP mode (2–4 players) and needs no special hardware. An account is optional: signing in to Game Center only enables the global and friends leaderboards (🏆 RANKS on the title and game-over screens), the daily/weekly boards, league badges, live rivals and CO-OP. CO-OP on the title screen uses Game Center matchmaking (or invites) to put 2–4 players in the same survival run; it requires Game Center and is not needed to test the rest of the game. Co-op uses no servers of ours: all traffic goes peer-to-peer through GameKit. Playing repeatedly with the same squad unlocks titles (squad bonds); the host can switch the lobby to SQUAD DAILY to play the day's Daily seed together, ranked on its own leaderboard. 📅 DAILY and ⚔ RANKED on the title screen are playable without an account (rivals then come from the player's own past runs). The four iOS exclusive weapons in the ARMORY and the four outfits in the LOCKER's ★ EXCLUSIVE tab are non-consumable In-App Purchases; RESTORE in the Armory restores all of them. Outfits are cosmetic only. SEASON on the title screen shows the season reward track; the premium row is unlocked by that season's non-consumable Season Pass (cosmetics and scrap only), and RESTORE in the Armory restores it too. SHARE on the game-over screen opens the iOS share sheet with an image of the run. If the app is sent to the background during a normal or extraction run, the next launch within 10 minutes offers RESUME RUN (competitive modes always restart). DOSSIER on the title screen shows the player's statistics, records and run history and sells nothing. MISSIONS on the title screen lists daily and weekly missions and achievements; the 🔥 DAY button shows the daily login streak. All of their rewards are in-game scrap and XP and none can be bought. Scrap weapons are bought with in-game currency earned by playing and cannot be bought with money. BLACK MARKET on the title screen sells cosmetics, consumables (streak shield, revive token, mission reroll) and supply crates for in-game scrap only; its stock rotates daily and nothing in it is sold for money.

## Store listing localisation / In-App Events

1. **Localised listing.** In App Store Connect add the localisations en-US (primary), es-MX, pt-BR, de-DE, tr and ja. For each one paste `subtitle`, `promotionalText`, `description`, `keywords` and `whatsNew` from `appstore-assets/metadata/<locale>.json` (the name stays "Horde Breakers"). Run `node tools/store-shots.mjs --check` first; it fails if any field is over Apple's limits.
2. **Marketing screenshots.** Upload `appstore-assets/screenshots/marketing/<locale>/01…05.png` to that localisation's 6.9" iPhone screenshot set, in order (co-op first). Regenerate with `npm run prepare:web && node tools/store-shots.mjs` after UI changes.
3. **In-App Events.** Create the events in `appstore-assets/metadata/in-app-events.md` under **Distribution → In-App Events** (Season 1: Black Harvest a week before the season starts, Ranked Weekly, and the weekend event that is next up), translate their descriptions for the same locales, and submit them for review with or after the app version. At most 10 events can be approved/scheduled at a time.

## Local notifications

The game sends no push notifications and runs no server; reminders are local notifications scheduled on the device by the native `NotifyPlugin` (`ios/App/App/NotifyPlugin.swift`, JS name `Notify`, registered in `MainViewController.capacitorDidLoad()`). No push entitlement, APNs key or `Info.plist` usage string is needed. `features/notify.js` keeps at most one reminder a day, inside 08:00–22:00 local time: the streak deadline, today's Daily closing (only if the player ranked today), the weekly league settlement on Monday, the next weekend event, and a nudge 3 and 7 days after the last session. The permission prompt appears once, after the player claims their first daily streak reward; a Reminders toggle in Settings turns them off. Local notifications collect no data, so the App Privacy answer is unchanged. For App Review notes: "The game asks for notification permission after the first daily reward is claimed; all reminders are local and can be turned off in Settings → Reminders."
