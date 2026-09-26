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
   Add both leaderboards to the app version before submitting. The IDs must match `LEADERBOARDS` in `game.js`.
   Each submitted score carries the player's character loadout packed into the Game Center score *context* (see `encodeLoadout` in `character.js`). This is how other players' outfits appear in the leaderboard without a server. Keep the order and bit widths of `SLOTS` stable; append new items to the end of an existing slot instead of reordering.
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
   | `deadzone.ach.wave_20` | Last Stand | 40 | Reach wave 20 |
   | `deadzone.ach.wave_30` | Unbreakable | 60 | Reach wave 30 |
   | `deadzone.ach.wave_50` | Deadzone Legend | 100 | Reach wave 50 |
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
   The IDs are derived from `STORE_PREFIX` + `premium` in `weapons.js` / `SUITS` in `character.js`; if `appId` changes, update `STORE_PREFIX` to match. Prices shown in the Armory come from StoreKit (localized), never hardcoded. Submit the products together with the app version for review. The Armory has the required **RESTORE** button. To test before release, use a Sandbox tester account on a device, or add a StoreKit Configuration file in Xcode with the same product IDs and select it in the scheme's Run options.
7. The Xcode target already includes the Game Center entitlement (`App/App.entitlements`). If Xcode reports a provisioning mismatch, add **Game Center** under **Signing & Capabilities** so the profile is regenerated.
8. In App Store Connect, complete store listing metadata, the privacy questionnaire, age rating, screenshots, and App Review notes. This game should generally be described as containing frequent cartoon/fantasy violence; use Apple’s current rating questionnaire to make the final selection.

## Privacy draft

This build does not collect data, use analytics, show ads or require an account. It offers optional non-consumable In-App Purchases (four weapons and four outfits), processed entirely by Apple through StoreKit; the game stores only which products the player owns, on the device. Global leaderboards use Apple Game Center: scores are sent to Apple through GameKit, and the game itself runs no servers. Players who are not signed in to Game Center can still play; their runs are kept only on the device. Check Apple's current guidance on declaring Game Center use in the App Privacy answers. If other data features are added, update the App Privacy answers and privacy policy before submission.

## Test notes for App Review

The game starts immediately from the title screen. It is single player and needs no special hardware. An account is optional: signing in to Game Center only enables the global and friends leaderboards (🏆 RANKS on the title and game-over screens). The four iOS exclusive weapons in the ARMORY and the four outfits in the LOCKER's ★ EXCLUSIVE tab are non-consumable In-App Purchases; RESTORE in the Armory restores all of them. Outfits are cosmetic only. MISSIONS on the title screen lists daily and weekly missions and achievements; the 🔥 DAY button shows the daily login streak. All of their rewards are in-game scrap and XP and none can be bought. Scrap weapons are bought with in-game currency earned by playing and cannot be bought with money.
