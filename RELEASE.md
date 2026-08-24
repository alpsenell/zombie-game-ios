# App Store release checklist

The local iOS project is generated from `index.html` through Capacitor. The game contains no third-party gameplay assets or advertising SDKs.

## Before uploading

1. Enroll the account that will publish the game in the Apple Developer Program.
2. In `capacitor.config.json`, change `appId` if `com.alpsenel.laststanddeadzone` is not an identifier owned by that account. Once an app is uploaded, do not change it.
3. Run `npm run sync:ios`, then `npm run open:ios`.
4. In Xcode, select the publishing Team under **Signing & Capabilities**, set the deployment target, then choose **Product → Archive** and upload the archive to App Store Connect.
5. In App Store Connect, complete store listing metadata, the privacy questionnaire, age rating, screenshots, and App Review notes. This game should generally be described as containing frequent cartoon/fantasy violence; use Apple’s current rating questionnaire to make the final selection.

## Privacy draft

This build does not collect data, use analytics, show ads, require an account, or make purchases. If any of those features are added, update the App Privacy answers and privacy policy before submission.

## Test notes for App Review

The game starts immediately from the title screen. It is entirely offline, single player, and needs no account or special hardware.
