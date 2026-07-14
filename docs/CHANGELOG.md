# Changelog

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
