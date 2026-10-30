# App Store submission: Jue

Everything App Store Connect asks for, with answers that match what the app does. Items marked **YOU** need your Apple account or a
decision only you can make. The rest is ready.

## 0. Before you start: two decisions

1. **The name.** The app is called "Jue", which does not use Neo4j's mark. Keep "Neo4j" and "Aura" out of the name, subtitle and keywords
   (guideline 5.2). Describing what it does in the description is fine ("manage Neo4j Aura databases"), and the app says it is unofficial.
   Check that "Jue" is free in App Store Connect when you create the record, since names are unique across the store.
2. **The version number.** The app is `0.1.0`. A store release is usually `1.0.0`. To change it, edit `version` in `package.json` and
   `MARKETING_VERSION` (two places in `ios/AuraMobile.xcodeproj/project.pbxproj`) and `versionName` in `android/app/build.gradle`. A test fails
   if they disagree.

## 1. Privacy policy and support page (done once the repository is public)

- The privacy policy is `PRIVACY.md` in this repository. Once the repository is public it is served at
  `https://github.com/LackOfMorals/AuraMobile/blob/main/PRIVACY.md`. Use that as the **Privacy Policy URL** in App Store Connect.
- The **Support URL** is the repository's Issues page: `https://github.com/LackOfMorals/AuraMobile/issues`.
- Both addresses are in `src/legal/links.ts`, so the app links to the policy from Account. If the repository is renamed, update them before the next release.
- The contact in the policy is GitHub Issues, so no personal email address is published.

## 2. Create the app (YOU)

App Store Connect, Apps, **+ New App**:

| Field | Value |
| --- | --- |
| Platform | iOS |
| Name | Jue (see decision 1; must be available in App Store Connect) |
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
- **Save to Files** is started by the user and writes to storage the user chooses. It is not collection by the developer, so the answer stays "Data Not Collected".
- **Tracking: No.**
- **Privacy policy URL:** from step 1.
- The app's privacy manifest (`ios/AuraMobile/PrivacyInfo.xcprivacy`) already declares no tracking and no collected data types.

## 5. Version page

**Promotional text (170 characters)**

> See and manage your Neo4j Aura instances from your phone: check status, pause, resume, resize, create and delete, with Face ID protection.

**Description**

> Jue is an independent app for looking after your own Neo4j Aura databases from your phone.
>
> • Find any instance fast: search by name, filter by tenant, cloud, tier and status, and sort the way you like.
> • See each instance at a glance: its status, size, region, tier and connection URL, with one tap to copy.
> • Make changes safely: pause, resume, rename, resize, create and delete. Every change is reviewed before anything is sent, and deleting needs you to type the instance's name.
> • Save an instance's connection details to Files, after Face ID, to pick them up on your Mac. A warning comes first.
> • Watch it happen: the app checks with Aura while a change runs and updates by itself.
> • Create AuraDB Free and paid instances. The password Aura shows once is kept in your iPhone's Keychain and revealed only after Face ID.
> • Private by design: your API credentials stay in the Keychain, the app locks with Face ID or your passcode, and there is no analytics, advertising or tracking. The app talks only to Aura's own API.
> • Try it first: demo mode has sample data and needs no account.
>
> You need Aura API credentials (created in the Aura console) to connect your account.
>
> Jue is not affiliated with, or endorsed by, Neo4j. Neo4j and Aura are trademarks of Neo4j, Inc.
> Jue falls under the same terms as Neo4j Labs projects (https://neo4j.com/labs/#disclaimer): it is experimental and provided without warranties or support.

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

Take each with the side button and volume up together, then AirDrop them to your Mac. The app also runs natively on iPad, so App Store Connect asks for **iPad screenshots** too: 13-inch iPad, 2064 x 2752 (portrait). `npm run screenshots` captures the iPad Pro 13-inch simulator at exactly that size (the `ipad-pro-13` device, `standard` variant), but its screens are the Debug app with the demo data, so use them as a check, and take the store set the same way you take the iPhone ones.

## 7. App Review information

**Sign-in required:** No. **Contact:** your name, phone and email (YOU).

**Notes for the reviewer**

> No account is needed to review this app. On the first screen, tap "Try the demo". It is filled with sample data, and every feature works against
> it without contacting any service: browsing and filtering instances, viewing details, and pausing, resuming, editing, creating and deleting
> instances (the demo's "Allow changes" is always on).
>
> Live mode needs a Neo4j Aura API client ID and secret, which reviewers do not need. It connects only to Neo4j's own API at api.neo4j.io.
>
> To try "Save to Files": in the demo, create an instance (the demo returns a password, which the app stores), open it, and in the Connection card tap "Save to Files". After a
> warning and Face ID or the passcode, the standard iOS save sheet opens so you can choose where to put a text file with that instance's connection details. It is a
> user-started export of the user's own database credentials, like the download Aura's console offers. The app never sends the file anywhere or keeps a copy.
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
- App switcher: the card for the app shows "Jue" and no instance names.
- Demo: Try the demo, then pause, resume, rename, create a Free instance and delete it.
- Live (read-only first): connect, sync, browse. Then switch on "Allow changes" and pause and resume a disposable instance.
- Save to Files: in the demo, create an instance, open it, Save to Files. The warning shows first, then Face ID, then the iOS save sheet. Save to iCloud Drive and check the file on a Mac. Cancel at each step and check nothing is saved.
- Disconnect and clear data returns to the first screen, and a stored instance password is gone.

## What is already done in the project

App icon (placeholder, replaceable), launch screen, iPhone and iPad (all iPad orientations, as multitasking requires), phone portrait only, privacy manifest, export-compliance flag, no unused permissions,
no Metro dependency in release builds, error screen, native app-switcher cover, open-source licence screen and `LICENSE`/`NOTICE` files, and a
version that the User-Agent, iOS and Android all read from one place.
