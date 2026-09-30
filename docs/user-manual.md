# MeepleMark user manual

## Getting started

Open MeepleMark and continue as a guest to begin immediately. Guest data stays
in this browser. The main areas are:

- **Plays** — start a game, resume drafts, and review or delete history.
- **Collection** — manage games and their reusable score sheets.
- **Players** — save frequently used player names and optional metadata.
- **Account** — sign in, synchronize, and review synchronization status.

<p>
  <img src="images/play-history.png" alt="The Plays screen on desktop" width="720">
  <img src="images/play-history-mobile.png" alt="The Plays screen on mobile" width="168">
</p>

## Recording a play

1. Select **Add Play**.
2. Enter or select a game and at least one player.
3. Choose the win direction and result type. If the game has a saved score
   sheet, select **Use score sheet** to use its categories and rules.
4. Select **Start play**, enter scores, and select **Complete** when finished.

Drafts remain editable. Ranked games calculate ranks automatically, including
ties. Win/loss games show an explicit outcome for each player. In a category
score sheet, totals update as values are entered; typing a total manually makes
it an override until **Recompute** is selected.

### Phone scorepad

On phones, **Single player** keeps one player's categories and controls within
easy reach. Use **Previous** and **Next** to move between players.

![A category score sheet in the phone single-player layout](images/mobile-scorepad.png)

### Desktop scorepad

On wider screens, **Grid** shows every player and category together. The layout
can be changed at any time without losing partially entered scores.

![A category score sheet in the desktop grid layout and dark theme](images/desktop-scorepad-dark.png)

## Games and score sheets

Add games from **Collection**. A game can have one saved score sheet containing
one to ten ordered categories, a high- or low-score win direction, and either
ranked or win/loss outcomes.

From a game's page:

- Select **Add a score sheet** or **Edit score sheet** to change its categories
  and rules.
- Use **Move up** and **Move down** to reorder categories.
- Select **Export score sheet** to download the saved sheet as JSON.
- In the editor, select **Choose file** to import JSON. Import fills the form for
  review; select **Save** to apply it to the current game.

Changing or deleting a game's sheet never rewrites an existing play. Each play
keeps the score-sheet snapshot with which it was created.

## Score-sheet JSON format

An exported file contains one JSON object:

```json
{
  "slug": "terraforming-mars",
  "version": 1,
  "winDirection": "high",
  "defaultOutcome": "ranked",
  "categories": [
    { "key": "terraform-rating", "label": "Terraform Rating" },
    { "key": "awards", "label": "Awards" }
  ]
}
```

| Field | Format |
|---|---|
| `slug` | Non-empty string identifying the source sheet. |
| `version` | Integer of 1 or greater. |
| `winDirection` | `"high"` or `"low"`. |
| `defaultOutcome` | `"ranked"` or `"flagged"`; `flagged` means explicit win/loss. |
| `categories` | Ordered array of 1–10 category objects. |
| `categories[].key` | Unique, non-empty machine-readable string. |
| `categories[].label` | Non-empty label shown to the user. |

The format is strict: unknown fields, duplicate category keys, invalid values,
or files larger than 64 KiB are rejected. Import transfers category labels and
rules. When saved, MeepleMark assigns the destination game's local slug and
version, rather than trusting those values from the imported file.

## Exporting a workspace

Open **Account** and select **Export workspace** to download the active browser
workspace. Export works for guests and signed-in accounts, including read-only
accounts, and does not require a connection. The file contains private
collection, player, and play data, including locally saved changes that have not
yet synchronized. Each account can export only its own active workspace;
administrators cannot export another account's content. Store the file
accordingly.

The filename is `meeplemark-workspace-YYYY-MM-DD.json`. Its versioned envelope
has this shape:

```json
{
  "format": "meeplemark-workspace",
  "version": 1,
  "exportedAt": "2026-09-30T12:34:56.000Z",
  "games": [],
  "players": [],
  "plays": []
}
```

`games` includes both collection and history-linked games; each game's
`ownedAt` records collection membership and `localTemplate` contains its saved
score sheet. `plays` contains canonical play documents with historical names,
relationships, exact decimal strings, and embedded score-sheet snapshots. The
export deliberately excludes account identity, credentials, synchronization
state, and administrative data. Importing a workspace is not yet supported.

This personal, browser-local export is not a whole-installation backup.
Self-hosting operators must continue to back up and restore PostgreSQL as
described in the self-hosting guide.

## Players and history

The player directory avoids retyping regular players. Renaming or deleting a
saved player does not change names recorded in older plays. The **Plays** screen
lists drafts and completed games most-recent-first; deleting a play does not
delete its game, players, or score sheet.

## Offline use and accounts

MeepleMark saves changes on the device first. After the application has loaded
successfully once, guest scoring and previously loaded account workspaces remain
usable offline.

An account is optional and belongs to one self-hosted installation. Every
account has a separate private workspace containing its own collection, player
directory, score sheets, and play history. The `admin` role adds installation
management permissions but does not grant access to other accounts' workspace
content. When signed in, the Account screen distinguishes local saves from
pending, synchronized, or conflicted changes. If a conflict is reported, open
**Review conflicts** and choose the local or server version. Do not clear
browser storage before pending changes have synchronized.

On a fresh self-hosted installation, open **Account**, then select **Create
first administrator**. Choose a username and a password of at least 12
characters. This one-time setup is only available before any account exists and
is separate from normal registration. Afterward, administrators can use
**Administration** to keep registration closed or allow new `user` or
`readonly` accounts. Until setup is complete, the app also shows a setup
reminder once per browser; follow its link or dismiss it.

## When a page cannot open

MeepleMark shows a recovery page when an address is unknown, a requested game
is missing, or an unexpected display error occurs. Use the offered **Home**,
**Collection**, or **Reload** action to continue. Signed-out visitors opening
administration are sent to **Account** to sign in; signed-in accounts without
administrator permission see an access-forbidden page instead. Form, sync, and
connection errors stay with the current workflow so they can be retried there.
