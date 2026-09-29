# In-App Events (App Store Connect drafts, en-US)

Limits: event name ≤ 30 chars, short description ≤ 50, long description ≤ 120.
Create each event in App Store Connect → Distribution → In-App Events, then add localisations for the same locales as the store listing: en-US, es-MX, pt-BR, de-DE, tr, ja (event names such as "Blood Moon" match the English in-game UI and can stay untranslated; translate the descriptions). Event cards need a 1920x1080 (16:9) and 1080x1920 (9:16) image with no text overlaid near the edges.

Deep link for every event: open the app to the main menu (events are active automatically while live).

| # | Event name | Chars | Badge | Suggested duration |
|---|---|---|---|---|
| 1 | Season 1: Black Harvest | 23 | Major Update | Launch day, run 14 days (publish 7 days early) |
| 2 | Ranked Weekly | 13 | Competition | Recurring, Mon 00:00 UTC → Sun 23:59 UTC |
| 3 | Blood Moon | 10 | Special Event | Weekend: Fri 00:00 → Mon 00:00 UTC |
| 4 | Scrap Rush | 10 | Special Event | Weekend: Fri 00:00 → Mon 00:00 UTC |
| 5 | Headhunter | 10 | Challenge | Weekend: Fri 00:00 → Mon 00:00 UTC |
| 6 | Horde Night | 11 | Challenge | Weekend: Fri 00:00 → Mon 00:00 UTC |

---

## 1. Season 1: Black Harvest
- **Badge:** Major Update
- **Short description:** New season, new rewards and an exclusive outfit
- **Long description:** Season 1 is here. Earn Season XP every run, climb 30 reward tiers and get the Hollow Jack outfit with the pass.
- **Duration:** first 14 days of the season. Publish up to 7 days before start so it shows as "Coming soon".
- **Purchase note:** the Season Pass is an optional cosmetic purchase; mention "cosmetic only" in any localisation where space allows.

## 2. Ranked Weekly
- **Badge:** Competition
- **Short description:** Climb from Bronze to Legend in weekly leagues
- **Long description:** Get promoted, dodge relegation and earn league rewards every week. Reach Diamond to unlock an exclusive weapon skin.
- **Duration:** 7 days, Monday 00:00 UTC to Sunday 23:59 UTC. Create one event per week (or a 4-week block) — Apple allows at most 10 approved events live or scheduled at once.

## 3. Blood Moon
- **Badge:** Special Event
- **Short description:** Elites everywhere, +50% scrap all weekend
- **Long description:** Elite zombies flood every wave and pay out 50% more scrap. Clear wave 10 to earn an event-only weapon skin.
- **Duration:** weekend (Fri 00:00 → Mon 00:00 UTC).

## 4. Scrap Rush
- **Badge:** Special Event
- **Short description:** Double scrap from every run this weekend
- **Long description:** Every run pays double scrap. Stock up for outfits and weapon skins, and clear wave 10 for an event-only skin.
- **Duration:** weekend (Fri 00:00 → Mon 00:00 UTC).

## 5. Headhunter
- **Badge:** Challenge
- **Short description:** Headshot kills score double, +50% XP
- **Long description:** Aim high: headshot kills score double and every run earns 50% more XP. Clear wave 10 for an event-only skin.
- **Duration:** weekend (Fri 00:00 → Mon 00:00 UTC).

## 6. Horde Night
- **Badge:** Challenge
- **Short description:** Bigger waves and double Season XP
- **Long description:** Waves are 30% bigger and every run earns double Season XP. Squad up in co-op and clear wave 10 for an event-only skin.
- **Duration:** weekend (Fri 00:00 → Mon 00:00 UTC).

---

Weekend events rotate weekly in the order above (Blood Moon → Scrap Rush → Headhunter → Horde Night), starting Fri 25 Sep 2026 00:00 UTC and lasting 3 days (`EVENT_EPOCH` / `EVENTS` in `features/events.js`). Only schedule the event that is actually live that weekend. The copy matches the modifiers in `features/events.js`; if those change, update this file. Event modifiers don't apply to the Daily Challenge, and score modifiers don't apply to Ranked.
