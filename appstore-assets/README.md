# App Store assets

Captured from the iOS Simulator (iOS 26.5) on the release-prep branch. All files are PNG.

## screenshots/

- `iphone-6.9-inch/` — 1320×2868 (iPhone 17 Pro Max simulator), portrait. App Store Connect 6.9" slot.
- `iphone-6.5-inch/` — 1284×2778 (iPhone 14 Plus simulator), portrait. App Store Connect 6.5" slot.

Six shots per size, in suggested order:

| File | Screen |
| --- | --- |
| `01-title.png` | Title screen |
| `02-gameplay-boss.png` | Gameplay, wave 10+ with Goliath boss and boss health bar |
| `03-armory.png` | Armory (Singularity selected, localized StoreKit prices) |
| `04-locker.png` | Locker, ★ EXCLUSIVE tab (Infernal Knight try-on) |
| `05-game-over.png` | Game-over screen with rewards (scrap, XP, level up, mission, season XP, CLAIM) |
| `06-ranked-board.png` | Ranked weekly board / league ladder |

## iap-review/

One 1320×2868 screenshot per In-App Purchase, named after the product ID, showing the item in the Armory (weapons), the Locker (outfits) or the SEASON screen (passes). Upload each as the product's review screenshot in App Store Connect → Monetization → In-App Purchases.

## achievements/

25 images, 1024×1024, opaque PNG, one per Game Center achievement, named after the achievement ID (`deadzone.ach.<slug>.png`). Upload under Services → Game Center → Achievements. Titles and point values match the table in `RELEASE.md`; the ring color reflects the point tier (bronze < 30, silver 30–49, gold 50–79, legendary 80+).
