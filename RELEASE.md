# App Store release checklist

The local iOS project is generated from `index.html` through Capacitor. The game contains no third-party gameplay assets or advertising SDKs. Optional, opt-in analytics are described below and in `ANALYTICS.md`.

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

The game shows no ads and requires no account. It offers optional non-consumable In-App Purchases (four weapons and four outfits), processed entirely by Apple through StoreKit; the game stores only which products the player owns, on the device. Global leaderboards use Apple Game Center: scores are sent to Apple through GameKit, and the game itself runs no servers. Players who are not signed in to Game Center can still play; their runs are kept only on the device. Check Apple's current guidance on declaring Game Center use in the App Privacy answers.

### Opt-in analytics (TelemetryDeck)

If `APP_ID` in `features/analytics-config.js` is set, the game can send anonymous gameplay statistics to TelemetryDeck (TelemetryDeck GmbH, EU-hosted) — **only after the player taps ALLOW** on the in-app consent sheet or enables SETTINGS → *Anonymous analytics*. Details and the event catalog: `ANALYTICS.md`. If `APP_ID` stays empty, nothing is collected and the previous "Data Not Collected" answer still applies.

App Store Connect → **App Privacy** answers when analytics ships:
- **Data types:** *Usage Data → Product Interaction* (runs, waves, perks, weapons, screens, purchases by product id). *Diagnostics* is **not** collected (no crash logs or performance data are sent); add it only if that changes.
- **Linked to the user?** No — the identifier is a SHA-256 hash of a random per-install id, not tied to Game Center, the Apple ID or any account, and it is reset when the player opts out.
- **Used for tracking?** No — no IDFA, no data brokers, no cross-app or cross-site linking. No App Tracking Transparency prompt is needed.
- **Purpose:** Analytics.
- Mention in App Review notes that collection only happens after in-app opt-in.

The privacy policy (required URL in App Store Connect) must disclose: that TelemetryDeck is used as a processor, what is sent (anonymous gameplay events, app version, platform, a hashed random install id, a session id), that it is opt-in and can be turned off in Settings, and a link to TelemetryDeck's privacy policy.

**Network / ATS.** Signals go to `https://nom.telemetrydeck.com` over HTTPS with CORS from the `capacitor://localhost` webview, so no App Transport Security exception is needed.

**Privacy manifest.** The app has no `PrivacyInfo.xcprivacy` yet. Because the analytics client is our own web code (not the TelemetryDeck Swift SDK, which ships its own manifest), the app target should declare the collected data type. Add `ios/App/App/PrivacyInfo.xcprivacy` in Xcode (File → New → App Privacy, target *App*) with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeProductInteraction</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAnalytics</string>
      </array>
    </dict>
  </array>
  <key>NSPrivacyAccessedAPITypes</key>
  <array/>
</dict>
</plist>
```

`nom.telemetrydeck.com` is not a tracking domain, so it does not belong in `NSPrivacyTrackingDomains`. Web `localStorage` is not a required-reason API; if native code later reads `UserDefaults` or file timestamps directly, add the matching `NSPrivacyAccessedAPITypes` entries (Capacitor's own manifest covers the framework). If other data features are added, update the App Privacy answers, this manifest and the privacy policy before submission.

## Test notes for App Review

The game starts immediately from the title screen. On first launch a small sheet asks whether to send anonymous gameplay stats (ALLOW / NO THANKS); nothing is sent unless the player allows it, and it can be changed in Settings. It is single player and needs no special hardware. An account is optional: signing in to Game Center only enables the global and friends leaderboards (🏆 RANKS on the title and game-over screens). The four iOS exclusive weapons in the ARMORY and the four outfits in the LOCKER's ★ EXCLUSIVE tab are non-consumable In-App Purchases; RESTORE in the Armory restores all of them. Outfits are cosmetic only. MISSIONS on the title screen lists daily and weekly missions and achievements; the 🔥 DAY button shows the daily login streak. All of their rewards are in-game scrap and XP and none can be bought. Scrap weapons are bought with in-game currency earned by playing and cannot be bought with money.
