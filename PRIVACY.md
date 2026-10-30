# Jax privacy policy

_Last updated: 30 October 2026_

Jax is an independent app for viewing and managing your own Neo4j Aura account from your phone. It is not affiliated
with, or endorsed by, Neo4j. Neo4j and Aura are trademarks of Neo4j, Inc.

Jax falls under the same terms as [Neo4j Labs projects](https://neo4j.com/labs/#disclaimer).

**In short: the app has no server of its own, collects nothing about you, and has no analytics, advertising or tracking.**

## What the app keeps on your device

| What | Where | Notes |
| --- | --- | --- |
| Your Aura API client ID and secret | iOS Keychain | Only on this device. Not included in backups or iCloud Keychain. |
| Passwords of instances you create in the app | iOS Keychain | Aura shows a new instance's password once, so the app keeps it. It is shown only after Face ID or your passcode. |
| A copy of your account's details: project names, instance names, status, size, region, connection URLs, and the history of changes you made in the app | The app's own storage | Contains no passwords or secrets. It may be included in backups you make of your device. |
| Preferences (for example, whether changes are switched on) | The app's own storage | |

You can remove all of it at any time: **Account, then Disconnect and clear data**. Deleting the app removes it too.

## What the app sends, and to whom

The app talks to one service only: **Aura's own API at `api.neo4j.io`**. It sends:

- your client ID and secret, to obtain a short-lived access token;
- requests to read your projects and instances, and, only when you confirm a change, to pause, resume, edit, create or delete an instance;
- a `User-Agent` header naming the app, the operating system and the app version (for example `Jax/ios/0.1.0`).

Neo4j handles that data under its own terms and privacy policy. **Nothing is sent to the developer of Jax or to any other party.**
The app contains no analytics, crash-reporting, advertising or other third-party services.

## Demo mode

Demo mode uses sample data held in the app. It contacts no service and needs no account.

## The app lock

The app asks for Face ID or your device passcode when it opens and when you return to it after a while. Face ID is handled by iOS: the app never
receives your face data. The app needs a device passcode to be set.

## Your choices and rights

Because the app collects no personal data about you, there is nothing for the developer to access, correct or delete on your behalf. Your data
is on your device and in your Aura account, and you control both.

## Children

The app is a tool for managing a cloud database account and is not directed at children.

## Changes to this policy

If this changes, the new version will be published at the same address with a new date.

## Contact

Questions or concerns: open an issue at <https://github.com/LackOfMorals/JaxMobile/issues>. Issues are public, so please do not include credentials,
passwords or anything else private in one.
