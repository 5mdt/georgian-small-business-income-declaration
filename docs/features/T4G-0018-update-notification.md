# T4G-0018. Update notification

**Tags:** #updates #ui #storage

## Description

Tells a returning user their browser has an older version of the app cached
than what just loaded, with a link to the changelog. First-ever visit does
not show it — there's nothing to "update" from.

## Implementation

`src/version.js`: `APP_VERSION` constant, the single source of truth for
the app's current version (no build step, so it can't be read from
`package.json` at runtime). Bumped by hand alongside `docs/CHANGELOG.md`
entries.

`src/utils.js`: `compareVersions(a, b)` — pure dotted-numeric version
comparison (`'1.2.0'` vs `'1.10.0'`), returns negative/zero/positive.
Missing segments are treated as `0`.

`script.js` (Update Notification section):
- `VERSION_STORAGE_KEY = 't4g_appVersion'` — first prefixed storage key in
  the app ([[T4G-0013]] lists the rest, unprefixed).
- `checkForAppUpdate()`, called from `window.onload`:
  - No stored version (first-ever visit) → silently `saveToStorage`s
    `APP_VERSION`, no popup.
  - Stored version present and `compareVersions(stored, APP_VERSION) < 0`
    → shows the update modal.
  - Stored version present and >= current → no-op.
- The modal (`#updateModal` in `index.html`, toggled via
  `showElement`/`hideElement` from `src/dom.js`) has exactly one
  interactive control: a "Got it" button. Clicking it is the only thing
  that persists `APP_VERSION` to storage and hides the modal — there is no
  backdrop-click or Escape dismissal, so an update the user hasn't
  acknowledged keeps reappearing on reload. A separate "View changelog"
  link opens `docs/CHANGELOG.md` in a new tab and does not close the modal.

## Configuration

`APP_VERSION` in `src/version.js` must be bumped by hand whenever a
`docs/CHANGELOG.md` entry is added — nothing enforces they stay in sync.

## Testing

### Human Testing

- Clear site data, load the app — no popup; `localStorage['t4g_appVersion']`
  is set to the current version.
- In devtools, set `localStorage['t4g_appVersion']` to `"0.0.1"` and reload
  — popup appears with a working changelog link.
- Click "Got it" — popup closes; reload again — popup does not reappear.
- Set the stored version below current, reload, but close the tab without
  clicking "Got it" — reload again — popup still appears.

### Unit Testing

`tests/unit/utils.test.js` (`compareVersions`): equal versions, older,
newer, differing segment counts (`'1.2'` vs `'1.2.0'`), multi-digit
segments (`'1.10.0'` > `'1.2.0'`).

### Integration Testing

`tests/integration/app.test.js` (`update notification`): first visit
stores the version without showing the modal; an older stored version
shows the modal; clicking "Got it" hides it and persists the current
version; a newer-or-equal stored version shows nothing.

## Status

Implemented.
