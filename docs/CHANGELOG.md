# Changelog

## v1.4.0 2026-07-14

- T4G-0020: Export and import now go through modals instead of one-shot
  toolbar buttons — Export offers transactions CSV, users CSV, or a full
  JSON backup; Import auto-detects the file kind and adds an "Overwrite
  data" toggle (default off) that switches from merge to wholesale
  replace, with a warning recommending a backup first. Choosing a file
  only stages it (shows the filename, enables "Start Import") rather than
  importing immediately, so the user can review the overwrite toggle
  first. The JSON backup's
  contents depend on the stored data schema version: `users`/
  `transactions`/`t4g_*` keys at schema `1` (or missing, today's only real
  case), or just `t4g_*` keys at any other version — exchange-rate cache
  and UI settings (theme, add-transaction checkbox) are never included.
  Folds in and retires the old T4G-0010 (CSV export) and T4G-0011 (CSV
  import) docs. The T4G-0019 migration modal's "Download backup" now opens
  this shared Export modal instead of a direct CSV download. Every export
  is also now tagged with the schema version of the data being exported
  (read from stored `t4g_dataSchemaVersion`), not the running code's
  `DATA_SCHEMA_VERSION` — fixing a bug where a backup taken before a
  pending migration was mislabeled as already-migrated.

## v1.3.0 2026-07-14

- T4G-0019: Added a data schema version, tracked separately from the app
  version — when the stored data predates the running code's schema, a
  modal recommends downloading a full CSV backup before continuing, and
  requires confirmation to proceed without one. Runs after the T4G-0018
  update modal, never stacked with it. Every CSV export (T4G-0010) now
  ends with trailing comment lines — file description, GitHub link,
  instance URL (when known), and the data schema version — all silently
  ignored on re-import (T4G-0011).

## v1.2.0 2026-07-14

- T4G-0018: Added an in-app update notification — on load, compares the
  app version against the one stored in `localStorage` and shows a modal
  with a changelog link if the stored version is older. First-ever visit
  stores the current version silently; the modal only clears once "Got it"
  is clicked.

## v1.1.0 2026-07-14

- T4G-0009: Fixed inconsistent sort order for same-date transactions —
  `sortTransactions` now breaks ties deterministically by `timestamp` then
  `id` (following `sortDirection`), matching YTD accumulation order instead
  of arbitrary storage order.
- T4G-0012: Added a second same-date transaction to `demo-data.csv`
  (2025-01-15, Nino Beridze) so the same-date tie-break is demonstrable via
  "Load Demo Data".

## v1.0.0 2025-10-12

- T4G-0017: Amount formatting documented (`formatCurrency`, `getCurrencySymbol`).
- T4G-0016: Input validation documented (date, amount, currency code, user, transaction).
- T4G-0015: Theme switcher documented (System/Light/Dark toggle).
- T4G-0014: Data and cache clearing documented (clear transactions/users/rate cache).
- T4G-0013: Local storage persistence documented (localStorage with sessionStorage fallback).
- T4G-0012: Demo data documented (bundled sample dataset, empty-transactions guard).
- T4G-0011: CSV import documented (dedup, auto user creation, validation).
- T4G-0010: CSV export documented (filtered/sorted export, YTD recompute).
- T4G-0009: Transaction filter and sort documented (user/currency/date filters, sortable columns).
- T4G-0008: Year-to-date income calculation documented (batch + single-transaction YTD).
- T4G-0007: Transaction management documented (add/remove/comment).
- T4G-0006: User delete protection documented (default-user and last-user guards, cascading delete).
- T4G-0005: User management documented (multi-user, taxpayer ID).
- T4G-0004: GEL synthetic currency documented (1:1 passthrough, no API lookup).
- T4G-0003: Historical rate by date documented (date picker constraints, date validation).
- T4G-0002: NBG exchange rate fetch + cache documented (per-date cache in localStorage).
- T4G-0001: Currency conversion documented (amount → GEL conversion and display).
