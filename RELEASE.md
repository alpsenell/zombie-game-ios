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
   The IDs are derived from `STORE_PREFIX` + `premium` in `weapons.js` / `SUITS` in `character.js`; if `appId` changes, update `STORE_PREFIX` to match. Prices shown in the Armory come from StoreKit (localized), never hardcoded. Submit the products together with the app version for review. The Armory has the required **RESTORE** button. To test before release, use a Sandbox tester account on a device, or add a StoreKit Configuration file in Xcode with the same product IDs and select it in the scheme's Run options.
7. **Share plugin.** `ios/App/App/SharePlugin.swift` (jsName `Share`) presents the iOS share sheet for the game-over run card. Add the file to the App target and register it in `MainViewController.capacitorDidLoad()` with `bridge?.registerPluginInstance(SharePlugin())`. `Info.plist` carries `NSPhotoLibraryAddUsageDescription`, which the share sheet's *Save Image* action requires.
8. The Xcode target already includes the Game Center entitlement (`App/App.entitlements`). If Xcode reports a provisioning mismatch, add **Game Center** under **Signing & Capabilities** so the profile is regenerated.
9. In App Store Connect, complete store listing metadata, the privacy questionnaire, age rating, screenshots, and App Review notes. This game should generally be described as containing frequent cartoon/fantasy violence; use Apple’s current rating questionnaire to make the final selection.

## Privacy draft

This build does not collect data, use analytics, show ads or require an account. It offers optional non-consumable In-App Purchases (four weapons, four outfits and a Season Pass per season), processed entirely by Apple through StoreKit; the game stores only which products the player owns, on the device. Global leaderboards use Apple Game Center: scores are sent to Apple through GameKit, and the game itself runs no servers. Players who are not signed in to Game Center can still play; their runs are kept only on the device. Check Apple's current guidance on declaring Game Center use in the App Privacy answers. If other data features are added, update the App Privacy answers and privacy policy before submission.

## Test notes for App Review

The game starts immediately from the title screen. It is single player and needs no special hardware. An account is optional: signing in to Game Center only enables the global and friends leaderboards (🏆 RANKS on the title and game-over screens). The four iOS exclusive weapons in the ARMORY and the four outfits in the LOCKER's ★ EXCLUSIVE tab are non-consumable In-App Purchases; RESTORE in the Armory restores all of them. Outfits are cosmetic only. SEASON on the title screen shows the season reward track; the premium row is unlocked by that season's non-consumable Season Pass (cosmetics and scrap only), and RESTORE in the Armory restores it too. SHARE on the game-over screen opens the iOS share sheet with an image of the run. Scrap weapons are bought with in-game currency earned by playing and cannot be bought with money.
