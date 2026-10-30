# How Jue protects your data

_Reviewed against the code on 30 October 2026 (commit `3533ab5`, plus the fresh-install Keychain clean-up and Save to Files that followed it). iOS only; Android has not started._

Jue keeps secrets in the **iOS Keychain**, asks for **Face ID or your device passcode** to open and to reveal an instance password,
talks to **one service over HTTPS** (Aura's own API), and has no server, analytics or third-party services of its own. This document says
exactly what is stored where, what protects it, and, just as important, what does **not** protect it.

Jue falls under the [Neo4j Labs terms](https://neo4j.com/labs/#disclaimer): experimental, with no warranties or support. Read the
[limits](#7-known-limits-and-what-to-do-about-them) before you connect an account that matters.

## 1. What the app holds

| What | Where | Protected by | When it can be read | Backups and iCloud |
| --- | --- | --- | --- | --- |
| **Aura client ID and client secret** | iOS Keychain, one item | Keychain encryption; this device only | While the device is unlocked, with no prompt | **Not** in backups, **not** synced to iCloud Keychain |
| **Instance passwords** (instances you created in the app) | iOS Keychain, one item per instance | Keychain; **Face ID or passcode on every read** | Only after you authenticate | **Not** in backups, **not** synced |
| **App lock marker** | iOS Keychain, one item | Face ID or passcode | Only after you authenticate | **Not** in backups, **not** synced |
| Copy of your account: project and instance names, status, size, region, connection URLs, history of changes | SQLite file in the app | iOS file protection (default) | While the app runs | May be in device backups. Contains **no** secrets |
| Preferences: theme, demo or live mode, "Allow changes" | App settings store (MMKV) | iOS file protection (default) | While the app runs | May be in device backups. Contains **no** secrets |
| **A file you choose to save** with Save to Files | Wherever you choose, for example iCloud Drive | Plain text: protected only by where you put it. The app keeps **no copy** | Not applicable | iCloud Drive syncs it to your other devices |
| Access token from Aura | **Memory only** | The app's process | Until it expires or the app is closed | Never written to disk |

Nothing else is stored. There is no account with the developer and no server to hold anything.

## 2. The Aura client ID and client secret

These are the keys to your Aura account's API. The client secret is the sensitive one.

**How they get in.** You type them into the Setup screen only. The secret field hides what you type. The app first uses them to ask Aura
for a token. If Aura accepts them, they are saved. If not, nothing is saved. They are never sent anywhere except Aura's token endpoint.

**How they are stored.** As one Keychain "generic password" item (`src/security/credentials.ts`):

- **Service:** `io.github.lackofmorals.auramobile.aura-credentials`. **Account:** the client ID. **Password:** the client secret.
- **Accessibility:** `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. iOS releases the item only while the device is unlocked. The item stays on this
  device: it is excluded from iCloud and iTunes/Finder backups and is not carried to a new device. (The app does not mark it
  synchronisable, so iCloud Keychain does not take it.)
- **No access-control prompt on read.** The secret is **not** tied to Face ID. That is deliberate: the app needs the secret each time Aura's
  token expires and while a change is running, and a prompt each time would make the app unusable. The app lock (section 3) is what
  stands between a person holding your unlocked phone and the app.

**How they are used.** The Aura client reads the secret from the Keychain **only when it needs a new token**, sends it to Aura over HTTPS
as HTTP Basic credentials, and does not keep it. The resulting token is held in memory and refreshed when it expires. A rejected token is replaced once, then the error is shown.

**How they are removed.**

- **Account, then Disconnect and clear data** deletes the credentials item, every stored instance password, and the local copy of your account, and switches changes back off.
- **Deleting the app** removes the app's own storage but **iOS keeps Keychain items**. Jue therefore clears the credentials and instance-password items on the first launch of a fresh install
  (`src/security/freshInstall.ts`). It does this only when the install has never been used, so an update never removes what you rely on, and it never touches other apps' items. Until the app is installed and opened again the items stay on the phone, so **use Disconnect before you delete the app** if you want them gone at once.
- Neither path revokes the credential in Aura. To do that, delete it in the Aura console.

**What this does not protect against.** See section 7: the secret can be read by code running inside the app, by someone with a jailbroken
phone, and (see "Deleting the app" there) it can outlive the app.

## 3. The app lock

- When the app opens, and when you return to it after **30 seconds or more** away, it shows a lock screen and asks for **Face ID**, falling
  back to the **device passcode** (`src/security/appLock.ts`, `LockGate.tsx`).
- The lock works through the Keychain: the app reads a marker item that iOS only releases after Face ID or the passcode succeeds
  (`BIOMETRY_ANY_OR_DEVICE_PASSCODE`). The marker only exists while a device passcode is set, so **a phone with no passcode cannot use
  the app**; it shows a message instead. Jue never receives your face data or your passcode: iOS does the check.
- "Any" biometry means a face or finger enrolled later also works, like unlocking the phone itself.
- Cancelling or failing leaves the app locked.
- **The lock is a gate on the screen, not on the data.** The client secret (section 2) can be read without Face ID once the device is
  unlocked. The lock keeps another person from using the app on a phone you left unlocked or handed over, but it is not a second encryption layer around the secret.

## 4. Instance passwords

Aura shows a new instance's password **once**, in the answer to the create request. Jue stores it in the Keychain the moment it arrives, before
recording anything else (`src/services/operations/run.ts`, `src/security/instanceVault.ts`):

- One Keychain item per instance, service `io.github.lackofmorals.auramobile.instance-password.<instance id>`.
- Access control `BIOMETRY_ANY_OR_DEVICE_PASSCODE`, accessibility `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`: **every read asks iOS for Face ID or
  the passcode**; the item is deleted by iOS if you remove your passcode; it stays on this device and out of backups.
- The password is **never** written to the database, the logs or the change history. The database only records *whether* a password is stored,
  and a **count of how many times it was shown**.
- **Showing it:** "Show password" asks for Face ID or the passcode, then displays it for **30 seconds**. It hides immediately if the app leaves the
  foreground. The copy in memory is dropped when hidden.
- It is deleted when you delete the instance in the app, and by Disconnect and clear data.
- Instances you did not create in this app have no stored password: Aura never showed it to this app.
- **Saving to Files.** For an instance with a stored password you can save its connection details as a text file (`NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, the
  instance id and name, the names Aura's own console download uses), for example to iCloud Drive so a developer can pick it up on a Mac. The order is fixed
  (`src/services/exportConnection.ts`): a warning first; then Face ID or the passcode; only then is the password read and the file made. The file is written
  to a private temporary folder with **complete file protection**, handed to the **system save sheet** (not the share sheet, so no AirDrop, Messages or Mail is
  offered), and deleted when the sheet closes. A temporary folder left behind by a crash is removed the next time the app starts. The app never saves the Aura
  client ID or secret this way and records only a **count** of exports, never the file, its contents or where it went. Checked on a real iPhone and Mac: the
  temporary file reported `NSFileProtectionComplete`, and a file saved to iCloud Drive reached the Mac within seconds.

## 5. What the app sends over the network

- **One destination:** `https://api.neo4j.io` (Aura's API). Nothing else: no analytics, crash reporting, advertising or other
  third-party SDK. The app's own dependencies are listed in `package.json`; none is a telemetry or analytics library.
- **HTTPS only.** App Transport Security is on with no exceptions (`NSAllowsArbitraryLoads` is off). In **Release builds** there is no
  local-network exception at all. Only Debug builds, for developers, add one so the development server can be reached.
- **What it sends:** the client ID and secret to get a token; the token on every request; requests to read your projects and instances; and,
  only after you confirm a change, requests to pause, resume, edit, create or delete. Every request carries a `User-Agent` such as `Jue/ios/1.0.0`.
- **No certificate pinning.** The app trusts the system's certificate store, as most apps do. Pinning is a possible future hardening, with the
  cost that it must be updated when Aura's certificates change.
- **Sync and polling** happen only while the app is open. There is no background fetch and no push notification.

## 6. Protecting your changes and the screen

**Changes to your Aura account**

- A live account starts **read-only**. You switch on "Allow changes" in Account to create, edit, pause, resume or delete.
- Every change is **planned, reviewed and confirmed** before anything is sent. Planning never contacts Aura. Confirming is atomic, so the
  same change cannot be sent twice. If the instance changed after you planned, the plan is refused as stale. If the app is closed while a change is
  in flight, it checks with Aura on return and does not send it again.
- **Deleting needs the instance's name typed** and says it cannot be undone. AuraDB Free instances can only be deleted, never edited or paused.

**On screen**

- **App switcher:** when the app becomes inactive, a native cover (the name "Jue" on a plain background) hides the window before iOS takes its
  snapshot, so the switcher shows no instance names, URLs or passwords.
- **Revealed passwords** hide after 30 seconds and when you leave the app.
- **Release builds** have no developer menu. The launch switches used for screenshots (`-DevSkipLock`, `-DevDemo`, `-DevScreen`) work only in
  Debug builds: in a Release build they are ignored (checked in the simulator for `-DevDemo` and `-DevScreen`; the lock-skip switch reads through the
  same function, but has not been exercised on a real device).
- **Demo mode** uses sample data held in the app, contacts no service, and stores no secret.

## 7. Known limits, and what to do about them

These are real. Some are fixable; each is listed so you can decide.

| Limit | Why it matters | What to do |
| --- | --- | --- |
| **Deleting the app does not delete its Keychain items** straight away. iOS keeps them; Jue removes them the next time it is installed and opened (checked in the simulator: items survived deleting the app and were removed on reinstall). | Until then the credentials and any instance passwords stay on the phone. | **Use Disconnect and clear data before deleting the app** to remove them at once. |
| **The client secret is readable without Face ID** while the device is unlocked. | Anything running as the app, or an attacker on a jailbroken phone, can read it. The lock is a screen gate (section 3). | Create a **dedicated API credential** for Jue in the Aura console, with no more access than you need, and **delete it in the console** if the phone is lost or you stop using the app. |
| **A client secret is powerful.** It is a credential for your Aura account's API. | Whoever has it can do what that credential can do in Aura, until it is revoked. | As above: dedicate, limit and rotate it. Rotating means creating a new credential in the console, then Disconnect and reconnect in the app. |
| **The "Copy password" button uses the system clipboard.** | Other apps can read the clipboard, and with Universal Clipboard the text can appear on your other Apple devices. The app does not clear it. | Prefer showing the password and typing it, or clear the clipboard after pasting. A future change can mark the copy as local-only and expiring. |
| **A saved connection file is plain text.** | Once you save it, the app cannot protect it. In iCloud Drive it syncs to every device on your Apple ID and, unless Advanced Data Protection is on, Apple holds the keys; anyone who can read it can connect to the database. | Save it only where you mean to, delete it when you are done, never commit it to version control. If it may have been exposed, reset the instance's password in the Aura console. |
| **Revealed passwords can be screenshotted, screen-recorded or read over a shoulder.** | The app does not block screenshots; iOS does not allow that reliably. | Reveal in private. The 30-second hide limits the window. |
| **The local database is not encrypted by the app.** | It holds instance names, URLs and history, but **no secrets**. It is protected by iOS file protection and may be included in device backups. | Use an encrypted backup and a strong passcode. Disconnect clears it. |
| **The app lock is evaluated in the app.** | On a jailbroken or instrumented device, the lock screen can be bypassed. Instance passwords remain behind Face ID in the Keychain; the client secret does not. | Do not use Jue on a jailbroken device. |
| **No certificate pinning.** | A device with a malicious root certificate installed could intercept traffic. | Install only trusted profiles and certificates. |
| **Change safety depends on what Aura reports.** | The engine checks Aura's answers before it marks a change done. A wrong answer from Aura would be believed. | Check important changes in the Aura console. |

## 8. Supply chain and building

- **Dependencies** are pinned by `package-lock.json` and `ios/Podfile.lock`, and installed from the public npm and CocoaPods registries. The
  list of open-source components that are actually in the shipped app is generated from the production bundle (`src/legal/licenses.json`), and a test fails if a
  declared dependency is missing from it.
- `npm audit --omit=dev` reports **four low-severity** advisories, all in React Native's command-line tooling (`@react-native-community/cli-*`, through `deepmerge`).
  That is build tooling, not code in the app, and none of those packages appears in the app's licence list.
- **No secrets in the repository.** `.env` files are git-ignored, and the history was searched for credentials and common secret patterns before
  the repository was made public. **Aura credentials belong only in the app's Setup screen**, never in code, tests, chat or issues.
- Release builds embed the JavaScript bundle (no development server) and are code-signed with the developer's Apple team.

## 9. Reporting a problem

Open an issue at <https://github.com/LackOfMorals/AuraMobile/issues> to ask for a private way to report a vulnerability. **Issues are public:
do not put credentials, passwords or exploit details in one.** If you think a credential was exposed, delete it in the Aura console first.
