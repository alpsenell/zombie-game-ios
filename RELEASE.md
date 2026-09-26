# App Store release checklist

The local iOS project is generated from `index.html` through Capacitor. The game contains no third-party gameplay assets or advertising SDKs.

## Before uploading

1. Enroll the account that will publish the game in the Apple Developer Program.
2. In `capacitor.config.json`, change `appId` if `com.alpsenel.laststanddeadzone` is not an identifier owned by that account. Once an app is uploaded, do not change it.
3. Run `npm run sync:ios`, then `npm run open:ios`.
4. In Xcode, select the publishing Team under **Signing & Capabilities**, set the deployment target, then choose **Product → Archive** and upload the archive to App Store Connect.
5. In App Store Connect, open the app → **Services → Game Center**, enable Game Center, and create two **Classic leaderboards** (score format *Integer*, sort *High to Low*, submission *Best score*):
   - `deadzone.highscore` — "Top Survivors" (run score; harder difficulties multiply score)
   - `deadzone.bestwave` — "Deepest Wave"
   Also create two **Recurring leaderboards** (same format: *Integer*, *High to Low*, *Best score*) for competitive play:
   - `deadzone.daily` — "Daily Challenge": duration **1 day**, restarts every **1 day**, start date at **00:00 UTC** (the in-game daily seed rolls over at 00:00 UTC; App Store Connect shows times in your local zone, so convert).
   - `deadzone.weekly` — "Ranked Weekly": duration **1 week**, restarts every **1 week**, start date on a **Monday at 00:00 UTC** (leagues and the in-game countdown assume Monday resets; the app reads the real next start date from Game Center when signed in).
   Routing: DAILY runs submit only to `deadzone.daily`; RANKED runs (no premium weapons) submit to `deadzone.weekly` plus the all-time boards; normal runs submit to `deadzone.highscore`/`deadzone.bestwave` only. Leagues (Bronze → Legend) are computed on the device from the player's rank / total players on `deadzone.weekly`.
   Add all four leaderboards to the app version before submitting. The IDs must match `LEADERBOARDS` in `game.js` (and `BOARDS` in `features/competitive.js`).
   Each submitted score carries the player's character loadout packed into the Game Center score *context* (see `encodeLoadout` in `character.js`). This is how other players' outfits appear in the leaderboard without a server. Keep the order and bit widths of `SLOTS` stable; append new items to the end of an existing slot instead of reordering.
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
   The IDs are derived from `STORE_PREFIX` + `premium` in `weapons.js` / `SUITS` in `character.js`; if `appId` changes, update `STORE_PREFIX` to match. Prices shown in the Armory come from StoreKit (localized), never hardcoded. Submit the products together with the app version for review. The Armory has the required **RESTORE** button. To test before release, use a Sandbox tester account on a device, or add a StoreKit Configuration file in Xcode with the same product IDs and select it in the scheme's Run options.
7. The Xcode target already includes the Game Center entitlement (`App/App.entitlements`). If Xcode reports a provisioning mismatch, add **Game Center** under **Signing & Capabilities** so the profile is regenerated.
8. In App Store Connect, complete store listing metadata, the privacy questionnaire, age rating, screenshots, and App Review notes. This game should generally be described as containing frequent cartoon/fantasy violence; use Apple’s current rating questionnaire to make the final selection.

## Cheaters and leaderboard moderation

Before submitting, the game runs a conservative plausibility check (`plausible()` in `features/competitive.js`): score against the maximum a run of that wave, kill count, difficulty and boss count could earn, kills per wave and per second, minimum time per wave, and for DAILY/RANKED runs that no premium weapon was used and the daily seed/loadout/difficulty match. Impossible runs are not submitted and the game-over screen says so. The limits are deliberately loose, so a modified client can still post a high-but-possible score; remove those by hand:

1. In App Store Connect open **Apps → (the app) → Services → Game Center → Leaderboards** and select the leaderboard (`deadzone.highscore`, `deadzone.bestwave`, `deadzone.weekly` or `deadzone.daily`; for recurring boards pick the current occurrence).
2. In the leaderboard's scores list, find the player (the list shows the Game Center alias and player ID) and choose **Remove score** / remove the player from the leaderboard. Apple lets you either delete that single score or hide the player from the leaderboard permanently; use the permanent option for repeat offenders and remove them from every board they appear on.
3. Removal is immediate for new score loads; cached ranks on devices refresh on the next leaderboard load. League badges recompute from the weekly board, so a removed cheater also stops pushing honest players down a league.

Menu labels move occasionally; if the option is not on the leaderboard page, search the App Store Connect help for "remove leaderboard scores".

## Privacy draft

This build does not collect data, use analytics, show ads or require an account. It offers optional non-consumable In-App Purchases (four weapons and four outfits), processed entirely by Apple through StoreKit; the game stores only which products the player owns, on the device. Global leaderboards use Apple Game Center: scores are sent to Apple through GameKit, and the game itself runs no servers. Players who are not signed in to Game Center can still play; their runs are kept only on the device. Check Apple's current guidance on declaring Game Center use in the App Privacy answers. If other data features are added, update the App Privacy answers and privacy policy before submission.

## Test notes for App Review

The game starts immediately from the title screen. It is single player and needs no special hardware. An account is optional: signing in to Game Center only enables the global and friends leaderboards (🏆 RANKS on the title and game-over screens), the daily/weekly boards, league badges and live rivals. 📅 DAILY and ⚔ RANKED on the title screen are playable without an account (rivals then come from the player's own past runs). The four iOS exclusive weapons in the ARMORY and the four outfits in the LOCKER's ★ EXCLUSIVE tab are non-consumable In-App Purchases; RESTORE in the Armory restores all of them. Outfits are cosmetic only. Scrap weapons are bought with in-game currency earned by playing and cannot be bought with money.
