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

## Marketing screenshots & localisation

### metadata/

One JSON file per App Store locale — `en-US`, `es-MX`, `pt-BR`, `de-DE`, `tr`, `ja` — with the store listing text: `name` (always "Last Stand: Deadzone"), `subtitle`, `promotionalText`, `description`, `keywords`, `whatsNew`, plus `screenshotCaptions` (5 captions, one per marketing screenshot, ≤ 40 chars). Paste each field into App Store Connect → the app version → the matching localisation. Keywords are comma-separated with no spaces and never repeat words from the app name. `node tools/store-shots.mjs --check` validates every file against Apple's limits (name/subtitle 30, promotional text 170, description and What's New 4000, keywords 100) and prints a table.

`metadata/in-app-events.md` has en-US drafts for the App Store In-App Events (Season 1: Black Harvest, Ranked Weekly and the four weekend events) with name/short/long description, badge and duration.

### screenshots/marketing/

`screenshots/marketing/<locale>/01-coop.png … 05-season.png`, 1320×2868 (iPhone 6.9" portrait), for every locale above:

| File | Screen |
|---|---|
| `01-coop.png` | Online co-op run on Street, squadmate BRAVO in view with the horde ahead |
| `02-daily.png` | Daily Challenge sheet with rank and best score |
| `03-action.png` | Wave 12 on Dead Mall, zombies closing in, firing |
| `04-locker.png` | Locker, ★ EXCLUSIVE outfit tab with an outfit try-on |
| `05-season.png` | Season 1: Black Harvest pass track |

Each image is a localised caption over a dark red gradient with the in-game screen below it in a rounded frame. Only the captions are localised; the game UI is English-only. Game Center and StoreKit are mocked (player "VIPER", made-up rivals, prices taken from `ios/App/App/Products.storekit` and shown in USD in every locale), and the profile is seeded to level 13.

Regenerate:

```
npm run prepare:web && node tools/store-shots.mjs            # all locales
node tools/store-shots.mjs de-DE ja                          # some locales
SHOT=coop node tools/store-shots.mjs en-US                   # one screen
```

The script serves `www/` and renders each screen once in headless Chromium (440×956 CSS px at 3×, SwiftShader WebGL; about 2 minutes), then writes the captioned frames for each locale. If a screen fails it logs `FAILED <name>` and keeps going. Captions use Liberation Sans for Latin scripts and IPAGothic for Japanese (with `word-break: auto-phrase` so lines break between phrases); on a machine without a Japanese font the `ja` captions would show empty boxes, so check `fc-list :lang=ja` first.
