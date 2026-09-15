# T4G-0012. Demo data

**Tags:** #demo #csv

## User Story

As a new user, I want to load a sample dataset, so that I can explore the app
before entering my own real transactions.

## Behavior

Loads a bundled sample dataset so a new user can explore the app before
entering real transactions.

## Implementation

`assets/demo-data.csv` — 4 users, 15 transactions across 7 currencies, including a
quantity-factor currency (JPY, quoted per 100 units), one prior-year
transaction to demonstrate YTD ([T4G-0008](T4G-0008-ytd-income-calculation.md))
resetting per calendar year, and two same-date transactions for the same user
(2025-01-15, Nino Beridze) to demonstrate the deterministic same-date sort
tie-break ([T4G-0009](T4G-0009-filter-and-sort.md)).

`script.js` `loadDemoData()`:
- Refuses (with an explanatory `alert()`) if any transactions already exist
  — a safety measure so demo data never merges with or overwrites real
  data.
- Otherwise `fetch`es `assets/demo-data.csv`, wraps the response as a `File`, and
  reuses `importFromCSV()` ([T4G-0020](T4G-0020-backup-and-restore.md)) to
  load it.

## Quirks & Decisions

- Quirk: the "📊 Load Demo Data" button stays visible and enabled even once
  transactions exist, only rejecting the click with an `alert()`.
  Proposed: disable (grey out) the button once any transaction exists,
  rather than letting it be clicked and rejected. Keep the `alert()` guard
  in `loadDemoData()` itself as defense in depth.

## Testing

### Human

- On a fresh install (no transactions), click "📊 Load Demo Data" — 4 users
  and 15 transactions appear.
- With existing transactions, click "📊 Load Demo Data" — an alert explains
  it can't load and suggests clearing data or importing instead.

### Unit

Covered indirectly via `buildImportResult` tests in
`tests/unit/csv-workflow.test.js`, since `loadDemoData` delegates to the
same import path as [T4G-0020](T4G-0020-backup-and-restore.md).

## Status

Implemented
