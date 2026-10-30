# Jue privacy policy

_Last updated: 30 October 2026_

Jue is an independent app for viewing and managing your own Neo4j Aura account from your phone. It is not affiliated
with, or endorsed by, Neo4j. Neo4j and Aura are trademarks of Neo4j, Inc.

Jue falls under the same terms as [Neo4j Labs projects](https://neo4j.com/labs/#disclaimer).

**In short: the app has no server of its own, collects nothing about you, and has no analytics, advertising or tracking.**

## What the app keeps on your device

| What | Where | Notes |
| --- | --- | --- |
| Your Aura API client ID and secret | iOS Keychain | Only on this device. Not included in backups or iCloud Keychain. |
| Passwords of instances you create in the app | iOS Keychain | Aura shows a new instance's password once, so the app keeps it. It is shown only after Face ID or your passcode. |
| A copy of your account's details: project names, instance names, status, size, region, connection URLs, the history of changes you made in the app, and how many times you used Save to Files | The app's own storage | Contains no passwords or secrets. It may be included in backups you make of your device. |
| Preferences (for example, whether changes are switched on) | The app's own storage | |

You can remove all of it at any time: **Account, then Disconnect and clear data**. Deleting the app removes the copy of your account and your preferences, but **iOS keeps Keychain items when an app is deleted**. Jue removes its saved Aura credentials and instance passwords the next time it is installed and opened. To remove them straight away, use Disconnect and clear data before you delete the app.

## What the app sends, and to whom

The app talks to one service only: **Aura's own API at `api.neo4j.io`**. It sends:

- your client ID and secret, to obtain a short-lived access token;
- requests to read your projects and instances, and, only when you confirm a change, to pause, resume, edit, create or delete an instance;
- a `User-Agent` header naming the app, the operating system and the app version (for example `Jue/ios/0.1.0`).

Neo4j handles that data under its own terms and privacy policy. **Nothing is sent to the developer of Jue or to any other party.**
The app contains no analytics, crash-reporting, advertising or other third-party services.

## Saving connection details to Files (optional)

For an instance you created in the app, you can choose **Save to Files**. After a warning, and Face ID or your passcode, the app makes a plain text file
with that instance's connection address, username and password and opens the standard iOS save sheet, so that **you** choose where it goes, for example iCloud Drive
so you can pick it up on a Mac. The app does not send the file anywhere, keeps no copy (its temporary copy is deleted as soon as the sheet closes), and records only
how many times you did this.

If you save it to iCloud Drive, the file is in your iCloud account, under Apple's terms, and syncs to your other devices. Anyone who can read the file can connect to
that database, so delete it when you no longer need it and never add it to version control. The app never saves your Aura API client ID or secret this way.

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

Questions or concerns: open an issue at <https://github.com/LackOfMorals/AuraMobile/issues>. Issues are public, so please do not include credentials,
passwords or anything else private in one.
