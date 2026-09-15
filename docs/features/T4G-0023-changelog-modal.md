# T4G-0023. In-app changelog modal

**Tags:** #ui #updates

## User Story

As a small business owner, I want to view what changed in an update inside
the app, so that a click on "View changelog" doesn't just download a raw
Markdown file I have to open elsewhere.

## Behavior

Replaces the update-notification modal's ([T4G-0018](T4G-0018-update-notification.md))
"View changelog" link — which currently downloads `docs/CHANGELOG.md` as a
file (`#BUG-0001`) — with a modal that fetches and renders it in place.
Opens on top of the update modal without closing it; closing the changelog
modal returns to the update modal, whose own "Got it" acknowledgment flow
is unchanged.

## Implementation

`script.js`:
- `openChangelogModal()` fetches `docs/CHANGELOG.md`, parses it with a
  minimal Markdown-to-HTML pass (headings, list items — the format
  `CHANGELOG.md` actually uses, not a general parser), and renders it into
  `#changelogModal`.
- `closeChangelogModal()` hides it, leaving the update modal (if open)
  untouched.

`index.html`: new `#changelogModal` (`.modal-overlay.modal-overlay-top`,
layered above the update modal the same way the export/import modals layer
above the migration modal — [T4G-0020](T4G-0020-backup-and-restore.md)).
The update modal's "View changelog" `<a>` becomes a button calling
`openChangelogModal()` instead of linking directly to the file.

## Quirks & Decisions

- Quirk: `docs/CHANGELOG.md` must ship alongside `index.html`/`script.js`
  at the same relative path in production (`dist/docs/CHANGELOG.md`, per
  the `build:docs` npm script) for the `fetch` to succeed.
  Proposed: keep as-is — `build:docs` already copies it there.

## Testing

### Human

- Open the update-notification modal on a version bump, click "View
  changelog" — a modal shows the changelog's content, not a file download.
- Close the changelog modal — the update modal is still open underneath.

### Unit

`tests/unit/*.test.js`: the Markdown-to-HTML conversion for headings and
list items, given a fixture string shaped like `CHANGELOG.md`.

### Integration

`tests/integration/app.test.js`: clicking "View changelog" renders fetched
changelog content instead of navigating away.

## Status

Planned
