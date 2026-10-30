# AGENTS.md

Guidance for AI coding agents (and people) working in this repository. Read it before changing anything.

## What this is

**Jax** is an independent, local-first iOS app (bare React Native 0.88, TypeScript, no Expo) for managing your own Neo4j Aura
instances: browse, pause, resume, edit, create and delete. The device calls Aura's public API directly. There is no server, no
analytics and no federation. It is not affiliated with Neo4j and falls under the Neo4j Labs terms (https://neo4j.com/labs/#disclaimer).
iOS comes first. **Do not start Android work until the iOS app has been submitted.**

The Xcode project, scheme and target are called `JaxMobile`; the app's display name is `Jax`; the bundle ID is
`io.github.lackofmorals.jax`.

## Rules that are not negotiable

1. **Never read, print, copy or commit `.env`.** It may hold Aura credentials and tokens. It is git-ignored. If you need to know whether a
   value leaked, search for it without echoing it.
2. **Aura credentials go into the app's Setup screen only**, never into chat, code, tests, logs or issues.
3. **Ask the human before anything that changes an account or is public or hard to undo:** creating signing certificates or provisioning
   profiles, uploading to App Store Connect or TestFlight, changing GitHub repository visibility or name, publishing packages.
4. **Commit and push only when asked.** Never use `--no-verify`, never force-push, never add secrets to history.
5. **Planning never contacts Aura.** Only a confirmed change is sent. Do not add a code path that sends a change without a recorded,
   reviewed plan.
6. **Do not weaken a guard to make a test pass.** If a test guards a rule below, fix the code, or ask.

## Commands

```sh
npm install
cd ios && bundle install && bundle exec pod install && cd ..   # after changing native dependencies or the Podfile

npm test                  # Jest, all unit tests
npx tsc --noEmit          # types
npm run lint              # eslint .
npm start                 # Metro, for Debug builds
npm run screenshots       # the app on seven simulators, light/dark/largest text, compared with a baseline (see scripts/screenshots.mjs)
node scripts/generate-licenses.mjs   # after adding or removing a dependency: regenerates src/legal/licenses.json
```

Run `npx tsc --noEmit`, `npm run lint` and `npm test` before you say a change is done.

Build for a device or simulator with `xcodebuild -workspace ios/JaxMobile.xcworkspace -scheme JaxMobile ...`. **Release builds embed the
JavaScript bundle (no Metro). Debug builds need Metro.** After installing on a device, check the installed build
(`xcrun devicectl device info apps --device <id>`): `react-native run-ios` has reported "Installed" when it had not.

The simulator cannot be tapped from a script. Use `npm run screenshots`: Debug builds accept launch switches
(`-JaxSkipLock 1 -JaxDemo 1 -JaxScreen <Home|Instances|Detail|Create|Edit|Account|Operations|Licenses>`, in `src/dev/launchArgs.ts`).
They do nothing in a Release build. Do not edit project files while a screenshot run is going: Metro refreshes the app and a
"Refreshing…" strip appears in the pictures.

## Where things are

| Path | What it holds |
| --- | --- |
| `App.tsx` | Navigation, the lock gate, the Debug-only screenshot switches |
| `src/aura/` | Aura API client (`client.ts`), the demo data source (`mock.ts`), the User-Agent |
| `src/services/operations/` | The change engine: plan, review, confirm, run, recover. `plan.ts` holds the guards, `run.ts` talks to Aura and polls |
| `src/services/sync.ts` | Reading the account into the local store |
| `src/db/` | SQLite via op-sqlite and Drizzle (`schema.ts`, `migrations.ts`, repositories, `queries.ts`) |
| `src/security/` | Face ID / passcode lock, Keychain for credentials and instance passwords |
| `src/state/` | Zustand stores (session, filters, lock) |
| `src/lib/` | Pure logic with colocated tests: filters, sorting, create wizard, change rules, formatting |
| `src/screens/`, `src/ui/`, `src/navigation/` | Screens and shared components |
| `src/theme/` | Colours (`colors.ts`), layout and columns (`layout.ts`), heading scale (`typography.ts`) |
| `src/legal/` | Generated licence list and the public privacy and support addresses |
| `ios/JaxMobile/` | Native iOS app: Info.plist, launch screen, privacy cover (`SceneDelegate.swift`) |
| `scripts/` | Screenshot runner, pixel comparison, licence generator |
| `docs/` | `app-store.md` (listing, review notes, upload steps), `accessibility.md` (rules and audit), `security.md` (what is stored where and the known limits) |

## Domain rules the tests enforce

- **Live accounts are read-only** until "Allow changes" is switched on in Account. Demo mode is always writable.
- **Every change is planned, reviewed, confirmed and run.** Confirm is a store-level compare-and-set, so two services cannot both send. A plan
  is refused as stale if the instance changed after planning. After a restart, a change that may have been sent is checked against Aura and
  never re-sent. Deleting needs the instance name typed.
- **AuraDB Free** is not in a tenant's configurations. It is a built-in offer: GCP europe-west1, 1 GB, no storage, version 5, one per
  account. A Free instance can only be **deleted**.
- **Vector optimisation** needs 8 GB or more of memory. It can only be turned on when the instance has 8 GB or more **now**; Aura rejects
  turning it on in the same change as a resize from under 8 GB, so resize first, then enable it. Choosing a size under 8 GB with vector on is
  refused.
- **User-Agent** is `Jax/<ios|android>/<version>`. The version comes from `package.json`; the iOS and Android projects must match (a test checks).
- **Secrets outlive a deleted app** (iOS keeps Keychain items). `src/security/freshInstall.ts` clears the client secret and instance passwords on the first launch of a fresh install, and must never clear an install that is already in use. Do not remove that guard.
- Sort and filter options never use "attention" wording or grouping.

## Conventions

- Files adapted from grandstack-web-aura (Apache-2.0) keep their `// Copyright (c) "Neo4j"` header. Keep `LICENSE` and `NOTICE` accurate.
- Tests sit beside the code as `*.test.ts`. When a test is meant to prove a guard works, **break the guard on purpose and confirm the
  test fails**, then restore it.
- Import `Text` from `src/ui/Text`, not from `react-native`: it defaults to 17 pt and caps heading growth with Dynamic Type.
- Take colours from `useColors()`. Do not hard-code them. `src/theme/contrast.test.ts` checks text at 4.5:1 and control edges at 3:1.
- Never use colour as the only signal (status has an icon and a label, tier is written out beside its stripe). Touch targets are at least 44 pt.
- Plain language in the UI. No jargon in error messages: say what happened and what to do.

## Things that look wrong but are deliberate

- The database file is `auramobile.db` (`src/db/index.ts`). Renaming it would start every existing install with an empty database.
- Android's application ID is `com.jaxmobile` and is a placeholder. Decide it (matching the iOS bundle ID is the usual choice) before the first
  Android release; it is permanent once published.
- The bundle ID `io.github.lackofmorals.jax` is permanent once the App Store Connect record exists.
- The app name is "Jax" because "Aura" is Neo4j's trademark. Keep "Neo4j" and "Aura" out of the App Store name, subtitle and keywords.

## Shipping

The version lives in three places: `package.json`, `MARKETING_VERSION` in `ios/JaxMobile.xcodeproj/project.pbxproj` (two spots) and `versionName`
in `android/app/build.gradle`. Raise `CURRENT_PROJECT_VERSION` for every upload. `docs/app-store.md` has the listing text, review notes and the
steps that only the Apple account holder can do.

## Platform gotchas

- macOS `sed` ignores GNU-only forms such as `0,/re/` and does so silently. Prefer Python for multi-line edits.
- In zsh an unquoted multi-line variable is not split into words: loop with `while read`.
- In Metro's dev mode, a module that throws while loading is reported first; later `require`s of it return `undefined`. Look for the first error.
- Face ID and the Keychain's biometric protection are only enforced on a real device. The simulator does not show the lock.
