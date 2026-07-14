# T4G-0012. Demo data

**Tags:** #demo #csv

## Description

Loads a bundled sample dataset so a new user can explore the app before
entering real transactions.

## Implementation

`demo-data.csv` — 4 users, 15 transactions across 7 currencies, including a
quantity-factor currency (JPY, quoted per 100 units), one prior-year
transaction to demonstrate YTD ([[T4G-0008]]) resetting per calendar year, and
two same-date transactions for the same user (2025-01-15, Nino Beridze) to
demonstrate the deterministic same-date sort tie-break ([[T4G-0009]]).

`script.js` `loadDemoData()`:
- Refuses (with an explanatory `alert()`) if any transactions already exist
  — a safety measure so demo data never merges with or overwrites real
  data.
- Otherwise `fetch`es `demo-data.csv`, wraps the response as a `File`, and
  reuses `importFromCSV()` ([[T4G-0020]]) to load it.

The "📊 Load Demo Data" button is only meant to be used while the
transaction list is empty (see `docs/todo.md` for hiding it once
transactions exist).

## Testing

### Human Testing

- On a fresh install (no transactions), click "📊 Load Demo Data" — 4 users
  and 15 transactions appear.
- With existing transactions, click "📊 Load Demo Data" — an alert explains
  it can't load and suggests clearing data or importing instead.

### Unit Testing

Covered indirectly via `buildImportResult` tests in
`tests/unit/csv-workflow.test.js`, since `loadDemoData` delegates to the
same import path as [[T4G-0020]].

## Status

Implemented.
