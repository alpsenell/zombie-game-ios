# Analytics

Opt-in product analytics sent to [TelemetryDeck](https://telemetrydeck.com) (EU-hosted, no IDFA, no cross-app tracking).
Code: `features/analytics.js` (client + instrumentation), `features/analytics-config.js` (configuration).
Tests: `npm run prepare:web && node tools/test-analytics.mjs`.

## Setup

1. Create an app in the TelemetryDeck dashboard and copy its **App ID**.
2. Set `APP_ID` in `features/analytics-config.js`. Optionally set `NAMESPACE` to your organisation's namespace (then signals go to
   `https://nom.telemetrydeck.com/v2/namespace/<NAMESPACE>/`, the endpoint the ingest docs recommend) and a `SALT` for the user hash.
   Keep `APP_VERSION` in step with the App Store version.
3. `npm run sync:ios`.

While `APP_ID` is empty, nothing leaves the device: signals are only written to the local DEV STATS log.

## How it works

- **Consent.** Off until the player opts in. On first launch a sheet (HELP IMPROVE THE GAME?) appears over the title screen;
  the choice is stored as `settings.analytics` in `deadzone.settings`. SETTINGS → *Anonymous analytics* changes it anytime.
  Turning it off drops the queue and forgets the install id, so opting in again starts a fresh anonymous user.
  Nothing is built, queued or sent while consent is not `true`.
- **Identity.** `clientUser` = SHA-256 (`crypto.subtle`) of a random install id (+ `SALT`), created at opt-in and kept only
  in `deadzone.analytics.install`. `sessionID` is a random UUID per session. No Game Center names or IDs, player codes, seeds or free text are sent.
- **Test mode.** `isTestMode: true` in a browser (no `Capacitor.isNativePlatform()`) or with `?debug`. Those signals only show in the dashboard's Test Mode.
- **Transport.** `POST` a JSON array of signals, `Content-Type: application/json; charset=utf-8`, to `https://nom.telemetrydeck.com/v2/`
  (the default target of the official `@telemetrydeck/sdk` 2.0.4), or the namespaced endpoint. Signal shape:
  `{ appID, clientUser, sessionID, type, receivedAt, isTestMode?, floatValue?, telemetryClientVersion, payload: { key: "string" } }`.
  Payload values are strings (as the official SDK does). Numeric measurements go in top-level `floatValue`.
- **Batching.** Queued in `deadzone.analytics.queue` (cap 300, oldest dropped). Flushed every 10 s, at run end, and with
  `keepalive` when the app is hidden. Up to 100 signals per request.
- **Retry.** Network errors, 408, 429 and 5xx keep the batch and back off 5 s → 10 s → … → 5 min (±20 % jitter). Other 4xx drop the
  batch (counted as *dropped*). `online` events retry immediately. The queue survives relaunches. Failures never throw into gameplay.
- **Sessions.** A session starts at launch or when returning after more than 5 minutes in the background. Every time the app is
  hidden a `Session.ended` segment is sent; session length = sum of `floatValue` per `sessionID`.
- **Other features.** `api.analytics.track(type, payload)` sends a custom signal (payload is sanitised like forwarded events).
  Bus events matching the allowlist (`mission:complete`, `share`, `revive`, `season:*`, `coop:*`, `daily:*`, `ranked:*`) are forwarded
  automatically as `Mission.complete`, `Share`, `Season.<name>`…; only booleans, numbers and short id-like strings (`[\w.:-]{1,48}`) are kept,
  at most 8 keys, and keys containing *name, alias, player, user, gc, text, msg, message, code, mail, nick, seed* are dropped.
- **DEV STATS.** Triple-tap the LAST STAND logo on the title screen: consent, App ID state, mode, queued / sent / failed / dropped counts,
  next retry, endpoint, and the last 20 signals (even when `APP_ID` is empty). FLUSH forces a send, CLEAR QUEUE empties it.
- **Automated tests.** Under WebDriver the consent sheet is not shown automatically (so other feature tests are not blocked) unless
  `?debug` is present and `localStorage['deadzone.analytics.test'] = '{"appId":"…","namespace":"…"}'`, which also overrides the config.

## Event catalog

Every signal also carries `TelemetryDeck.AppInfo.version`, `TelemetryDeck.Device.platform` (`iOS` / `Web`) and
`TelemetryDeck.Acquisition.firstSessionDate` (install day, `YYYY-MM-DD`). Buckets are labelled like `1000-2499` or `1000000+`.
`runInfo` = `type` (`normal | daily | ranked | coop`), `difficulty` (`recruit | survivor | veteran | nightmare`), `map` (if the run has one).

| Signal | Payload | floatValue | Why |
| --- | --- | --- | --- |
| `TelemetryDeck.Acquisition.newInstallDetected` | `daysSinceInstall` | — | Once per install, on first opt-in. Feeds TelemetryDeck's built-in acquisition charts. |
| `TelemetryDeck.Session.started` | — | — | Built-in sessions / retention / DAU. |
| `App.opened` | `daysSinceInstall`, `runs` (bucket of finished runs) | days since install | One per launch. Retention by install age, funnel step 1. |
| `Session.ended` | `duration` (bucket, s), `runs` (runs this session) | seconds in foreground | Session length, runs per session. |
| `Tutorial.completed` | `runs` | — | Funnel step 2 (player moved + aimed on their first run). |
| `Run.started` | runInfo, `primary`, `secondary`, `firstRun`, `runs`, `sessionRun` | — | Funnel step 3, mode / difficulty / loadout mix, daily participation. |
| `Run.waveReached` | runInfo, `wave`, `boss`, `mod` | wave | Waves 1–10 then every 5th. Funnel wave 5 / wave 10, difficulty curve. |
| `Run.waveCleared` | runInfo, `wave`, `duration` (bucket, s), `hp` (% bucket) | seconds | Same waves. Balance: how long and how hurt per wave. |
| `Boss.encountered` | runInfo, `boss`, `wave` | — | Boss reach rate. |
| `Boss.killed` | runInfo, `boss`, `wave`, `weapon` | — | Boss kill rate vs encounters, weapon used. |
| `Perk.picked` | `perk`, `rare`, `wave`, `difficulty` | — | Perk pick rates. |
| `Run.ended` | runInfo, `wave`, `score`, `kills`, `accuracy` (10 % bucket), `duration`, `cause`, `perks` (comma list, ≤12), `perkCount`, `bosses`, `weapon`, `reachedWave10` | wave | Wave-of-death, cause of death (zombie kind, `acid`, `explosion`, `quit`, `unknown`), balance. |
| `Weapon.used` | `weapon`, `slot` (`primary / secondary / other`), `difficulty`, `shots`, `kills`, `heads` (buckets), `wave`, `reachedWave10` | kills | One per weapon per run (not per shot). Weapon pick and win rates. |
| `Purchase.completed` | `kind` (`iap / scrap`), `product` (IAP product id or scrap item key) | — | Conversion per product. No prices, no receipts. |
| `Screen.viewed` | `screen` (element id) | — | Navigation; the same screen at most once per 30 s, gameplay excluded. |
| `Mission.complete`, `Share`, `Revive`, `Season.*`, `Coop.*`, `Daily.*`, `Ranked.*` | sanitised event data | — | Forwarded from other features' bus events. |

A "win" in an endless game is defined as reaching wave 10 (`reachedWave10`).

## Dashboard insights to create

Filter everything on production (Test Mode off). Suggested groups and insights:

**Retention & engagement**
- *D1 / D7 / D30 retention*: the built-in Retention view (uses `clientUser` + `TelemetryDeck.Session.started`). Cross-check with
  a breakdown of `App.opened` by `daysSinceInstall` for users whose `TelemetryDeck.Acquisition.firstSessionDate` falls in a cohort week.
- *DAU / WAU / MAU*: built-in Users chart, or `TelemetryDeck.Session.started`, count unique users, daily / weekly.
- *Session length*: `Session.ended`, sum of `floatValue` grouped by `sessionID`, median; breakdown by `duration`.
- *Runs per session*: count `Run.started` ÷ count `TelemetryDeck.Session.started`, or breakdown of `Session.ended` by `runs`.

**First-run funnel** (Funnel insight, unique users, 7-day window)
1. `App.opened` where `runs = 0`
2. `Tutorial.completed`
3. `Run.started` where `firstRun = true`
4. `Run.waveReached` where `wave = 5`
5. `Run.waveReached` where `wave = 10`

**Balance**
- *Wave of death by difficulty*: `Run.ended`, breakdown by `wave` (histogram), filter / split by `difficulty`.
- *Cause of death*: `Run.ended` breakdown by `cause`, split by `difficulty`.
- *Wave clear time and HP*: `Run.waveCleared`, average `floatValue` by `wave`; breakdown by `hp`.
- *Boss conversion*: `Boss.killed` ÷ `Boss.encountered` by `boss`.
- *Weapon pick rate*: `Weapon.used` where `slot = primary`, breakdown by `weapon`.
- *Weapon win rate*: `Weapon.used` where `slot = primary`, share with `reachedWave10 = true` per `weapon`; kills per weapon = sum `floatValue`.
- *Perk pick rates*: `Perk.picked` breakdown by `perk` (split `rare`).

**Monetisation & modes**
- *IAP conversion*: unique users with `Purchase.completed` `kind = iap` ÷ unique users, breakdown by `product`.
- *Scrap economy*: `Purchase.completed` `kind = scrap` by `product`.
- *Daily challenge participation*: unique users with `Run.started` `type = daily` ÷ DAU; same for `ranked` and `coop`.
