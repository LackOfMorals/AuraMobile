# App Store submission: Aura Mobile

Everything App Store Connect asks for, with answers that match what the app does. Items marked **YOU** need your Apple account or a
decision only you can make. The rest is ready.

## 0. Before you start: two decisions

1. **The name.** "Aura" is Neo4j's product name. Apple's review guideline 5.2 (intellectual property) lets Apple ask for proof that you may use
   another company's name or marks in an app's name, subtitle or keywords. If you have Neo4j's permission, keep "Aura Mobile" and say so in the
   review notes. If not, a name that does not use their mark, with a subtitle such as "Manage Neo4j Aura databases" (a plain description), is the
   safer route. The app itself already says it is unofficial.
2. **The version number.** The app is `0.1.0`. A store release is usually `1.0.0`. To change it, edit `version` in `package.json` and
   `MARKETING_VERSION` (two places in `ios/AuraMobile.xcodeproj/project.pbxproj`) and `versionName` in `android/app/build.gradle`. A test fails
   if they disagree.

## 1. Host the privacy policy and a support page (YOU)

- Publish `PRIVACY.md` at a public address (a GitHub Pages site or a public repository file both work) and add your contact email at the bottom.
- Set that address as `PRIVACY_URL` in `src/legal/links.ts`, so the app links to it from Account.
- You also need a **support URL**: a page or repository issues page where people can reach you.

## 2. Create the app (YOU)

App Store Connect, Apps, **+ New App**:

| Field | Value |
| --- | --- |
| Platform | iOS |
| Name | Aura Mobile (see decision 1) |
| Primary language | English (UK) or English (US) |
| Bundle ID | `io.github.lackofmorals.auramobile` (choose it from the list: it is registered by building with your team) |
| SKU | `auramobile` (any unique text) |

## 3. App information

| Field | Value |
| --- | --- |
| Subtitle (30 characters) | Manage Neo4j Aura databases |
| Category | Developer Tools (secondary: Utilities) |
| Content rights | Does not contain third-party content you do not have rights to. It does include open-source code, credited in the app. |
| Age rating | Answer "None" to every question: 4+ |
| Price | Free |
| Availability | All regions, or your choice |

## 4. App Privacy

- **Data collection: "Data Not Collected".** The app has no server of its own and no third-party SDKs. Everything it sends goes to Aura's own API on
  your behalf.
- **Tracking: No.**
- **Privacy policy URL:** from step 1.
- The app's privacy manifest (`ios/AuraMobile/PrivacyInfo.xcprivacy`) already declares no tracking and no collected data types.

## 5. Version page

**Promotional text (170 characters)**

> See and manage your Neo4j Aura instances from your phone: check status, pause, resume, resize, create and delete, with Face ID protection.

**Description**

> Aura Mobile is an independent app for looking after your own Neo4j Aura databases from your phone.
>
> • Find any instance fast: search by name, filter by tenant, cloud, tier and status, and sort the way you like.
> • See each instance at a glance: its status, size, region, tier and connection URL, with one tap to copy.
> • Make changes safely: pause, resume, rename, resize, create and delete. Every change is reviewed before anything is sent, and deleting needs you to type the instance's name.
> • Watch it happen: the app checks with Aura while a change runs and updates by itself.
> • Create AuraDB Free and paid instances. The password Aura shows once is kept in your iPhone's Keychain and revealed only after Face ID.
> • Private by design: your API credentials stay in the Keychain, the app locks with Face ID or your passcode, and there is no analytics, advertising or tracking. The app talks only to Aura's own API.
> • Try it first: demo mode has sample data and needs no account.
>
> You need Aura API credentials (created in the Aura console) to connect your account.
>
> Aura Mobile is not affiliated with, or endorsed by, Neo4j. Neo4j and Aura are trademarks of Neo4j, Inc.

**Keywords (100 characters, comma-separated):** `graph,database,cloud,instance,admin,devops,manager,cypher,knowledge graph,dba`
(Left out on purpose: the name "neo4j", because Apple may treat another company's mark in keywords as a problem. See decision 1.)

**Support URL:** from step 1. **Marketing URL:** optional. **Copyright:** `2026 <your name>`.

## 6. Screenshots (YOU)

Required: **6.9-inch iPhone**, 1320 x 2868. Your iPhone 17 Pro Max is exactly that size, so screenshots taken on it can be uploaded as they are.

Use **demo mode** (Account, Disconnect and clear data, Try the demo) so no real data appears. Suggested set of six, in this order:

1. Home (search, tags, the Running row)
2. Instances, with the filter button showing a badge
3. The filter sheet
4. An instance's Detail screen
5. The new-instance wizard on the tier step
6. An operation in progress, showing the steps

Take each with the side button and volume up together, then AirDrop them to your Mac. iPad screenshots are not needed: the app is iPhone only.

## 7. App Review information

**Sign-in required:** No. **Contact:** your name, phone and email (YOU).

**Notes for the reviewer**

> No account is needed to review this app. On the first screen, tap "Try the demo". It is filled with sample data, and every feature works against
> it without contacting any service: browsing and filtering instances, viewing details, and pausing, resuming, editing, creating and deleting
> instances (the demo's "Allow changes" is always on).
>
> Live mode needs a Neo4j Aura API client ID and secret, which reviewers do not need. It connects only to Neo4j's own API at api.neo4j.io.
>
> The app asks for Face ID or the device passcode when it opens. A device passcode must be set, because the app keeps API credentials in the
> Keychain behind it.
>
> This is an independent app, not affiliated with Neo4j. [If you have Neo4j's permission to use the name, say so here.]

## 8. Build and upload (YOU, or ask me once you agree to the account change below)

In Xcode (`xed -b ios`, with your team selected under Signing & Capabilities):

1. Choose **Any iOS Device (arm64)** as the destination.
2. **Product, Archive.** (From the command line this already succeeds: `xcodebuild -workspace ios/AuraMobile.xcworkspace -scheme AuraMobile -configuration Release -destination 'generic/platform=iOS' archive -allowProvisioningUpdates`.)
3. In the Organizer, **Distribute App, App Store Connect, Upload.** Xcode creates the distribution certificate and App Store profile in your
   developer account the first time. Leave automatic signing on.
4. Wait for the build to finish processing (a few minutes, and you get an email), then select it on the version page.

Each upload needs a new build number: raise `CURRENT_PROJECT_VERSION` in the project (it is `1` now).

## 9. Test, then submit

1. **TestFlight:** add yourself as an internal tester, install the processed build, and run the checks below on it.
2. On the version page choose the build, tick the export-compliance answer if asked (the app uses only standard HTTPS, and the build declares
   `ITSAppUsesNonExemptEncryption = NO`), and **Submit for Review.**

## Checks to run on the TestFlight build

- Lock: Face ID unlocks; cancelling leaves the app locked; failing Face ID offers the passcode; leaving the app for more than 30 seconds locks it.
- App switcher: the card for the app shows "Aura Mobile" and no instance names.
- Demo: Try the demo, then pause, resume, rename, create a Free instance and delete it.
- Live (read-only first): connect, sync, browse. Then switch on "Allow changes" and pause and resume a disposable instance.
- Disconnect and clear data returns to the first screen, and a stored instance password is gone.

## What is already done in the project

App icon (placeholder, replaceable), launch screen, iPhone-only and portrait, privacy manifest, export-compliance flag, no unused permissions,
no Metro dependency in release builds, error screen, native app-switcher cover, open-source licence screen and `LICENSE`/`NOTICE` files, and a
version that the User-Agent, iOS and Android all read from one place.
