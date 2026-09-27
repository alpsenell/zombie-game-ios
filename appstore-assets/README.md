# App Store assets

Screenshots captured from build 1.0 (2) in the iOS Simulator (iOS 26.5), portrait. StoreKit prices come from `ios/App/App/Products.storekit`, which matches the App Store Connect prices. All files are PNG.

## screenshots/

- `iphone-6.9-inch/` — 1320×2868 (iPhone 17 Pro Max simulator). App Store Connect 6.9" slot; the 6.5" slot is not needed when 6.9" is provided.
- `ipad-13-inch/` — 2064×2752 (iPad Pro 13-inch (M5) simulator). App Store Connect 13" iPad slot.

| File | Screen |
| --- | --- |
| `01-title.png` | Title screen |
| `02-gameplay.png` | Gameplay, Dead Mall (iPhone) / Street (iPad), zombies in close |
| `03-armory.png` | Armory (Tesla Arc on iPhone, M4A1 with iOS-exclusive prices on iPad) |
| `04-locker.png` | Locker, ★ EXCLUSIVE tab with an outfit try-on and its price |
| `05-upgrades.png` | iPhone only: wave cleared, choose an upgrade |
| `06-season.png` | iPhone only: Season 1 reward track |

## iap-review/

One 1320×2868 screenshot per In-App Purchase, named after the product ID, showing the item in the Armory (weapons), the Locker (outfits) or the SEASON screen (passes). Upload each as the product's review screenshot in App Store Connect → Monetization → In-App Purchases.

## achievements/

25 images, 1024×1024, opaque PNG, one per Game Center achievement, named after the achievement ID (`deadzone.ach.<slug>.png`). Upload under Services → Game Center → Achievements. Titles and point values match the table in `RELEASE.md`; the ring color reflects the point tier (bronze < 30, silver 30–49, gold 50–79, legendary 80+).
