# Roadmap

Prioritized view over `TODO.md` and `BUGS.md`. Three tiers: **Next** (small/
clear, promoted to feature docs this pass), **Later** (worth doing, not yet
promoted), **Someday** (vague, large, or low-value — revisit before
promoting). An item's home for its actual requirements/design is the linked
feature doc, not this file — this file only tracks sequencing and priority.

## Next

Promoted to `docs/features/` this pass. New behavior got a new `T4G-NNNN`
doc; changes to already-shipped behavior were folded into the existing
doc's `Quirks & Decisions` instead (per `docs/DOCS-DRIVEN-DEVELOPMENT.md`:
"Changed behavior edits the existing document. New behavior gets a new
ID.").

- [T4G-0022](features/T4G-0022-per-user-and-supertotal.md) — per-user
  totals + supertotal in the transaction table footer (new doc).
- [T4G-0023](features/T4G-0023-changelog-modal.md) — in-app changelog
  modal, resolves [#BUG-0001](BUGS.md) (new doc).
- [T4G-0007](features/T4G-0007-transaction-management.md) — currency
  column shows code only, full name in a tooltip.
- [T4G-0012](features/T4G-0012-demo-data.md) — grey out "Load Demo Data"
  once transactions exist, instead of alerting on click.
- [T4G-0017](features/T4G-0017-amount-formatting.md) — grey out the
  decimal digits of formatted amounts.
- [T4G-0002](features/T4G-0002-nbg-rate-fetch-cache.md) — persistent
  banner when the NBG API is unavailable, instead of a transient error.
- [T4G-0020](features/T4G-0020-backup-and-restore.md) /
  [T4G-0014](features/T4G-0014-data-and-cache-clearing.md) — Export,
  Import, and Clear Data modals close on backdrop click / `Escape` /
  Android back. (The update and migration modals —
  [T4G-0018](features/T4G-0018-update-notification.md),
  [T4G-0019](features/T4G-0019-data-schema-version.md) — deliberately stay
  non-dismissible; they require explicit acknowledgment, so they're out of
  scope for this change.)

## Later

Still flat ideas in `TODO.md` — worth doing, not promoted yet.

- Update version modal: show which version the app upgraded from/to.
- Add version info in the UI.
- Make "Toggle user list" collapsible like Disclaimer/How It Works,
  collapsed by default.
- Move the user management block to the sidebar.
- Import full backup: validate before writing anything.
- Import full backup: dry-run mode.
- Safer localStorage data — HTML-encode quotes/special characters; add
  unsafe characters to the demo dataset to exercise it.
- Replace the transaction comment input with a multiline label + edit-modal.
- Option to save a transaction even if the exchange rate couldn't be
  retrieved.

## Someday / needs scoping

Too vague, too large, or low-value as stated — needs a concrete shape
before it can become a feature doc.

- "Rework the UI" — no concrete scope; break into specific changes before
  promoting any of it.
- Add a donate button.
- Add a version-to-version diff view inside the update modal — depends on
  [T4G-0023](features/T4G-0023-changelog-modal.md) shipping first, and on
  deciding how much of the changelog diff is worth surfacing vs. just
  linking to it.
- "Add pop-up hints on buttons" — needs a decision on which buttons and
  what the hints should say before it's actionable.
