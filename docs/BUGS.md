# Bugs & debt

Next free ID: **BUG-0003**.

Each entry ends with a `[P#/D#]` marker:

Priority:   P1 = high     P2 = medium   P3 = low
Difficulty: D1 = trivial  D2 = small    D3 = medium   D4 = large

## Bugs & quirks

- #BUG-0001 "View changelog" link in the update-notification modal
  ([T4G-0018](features/T4G-0018-update-notification.md)) downloads
  `docs/CHANGELOG.md` as a file instead of opening it for viewing —
  browsers serve a raw `.md` file as `text/markdown` (or via GitHub's
  raw-content headers when hosted there), which triggers a download
  rather than rendering. Resolution:
  [T4G-0023](features/T4G-0023-changelog-modal.md) (Planned) — an in-app
  changelog modal. [P3/D2]

## Tech debt

## Chores
