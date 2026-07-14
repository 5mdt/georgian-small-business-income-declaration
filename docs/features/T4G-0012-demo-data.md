# T4G-0012. Demo data

**Tags:** #demo #csv

## Description

Loads a bundled sample dataset so a new user can explore the app before
entering real transactions.

## Implementation

`demo-data.csv` — 4 users, 14 transactions across 7 currencies, including a
quantity-factor currency (JPY, quoted per 100 units) and one prior-year
transaction to demonstrate YTD ([[T4G-0008]]) resetting per calendar year.

`script.js` `loadDemoData()`:
- Refuses (with an explanatory `alert()`) if any transactions already exist
  — a safety measure so demo data never merges with or overwrites real
  data.
- Otherwise `fetch`es `demo-data.csv`, wraps the response as a `File`, and
  reuses `importFromCSV()` ([[T4G-0011]]) to load it.

The "📊 Load Demo Data" button is only meant to be used while the
transaction list is empty (see `docs/todo.md` for hiding it once
transactions exist).

## Testing

### Human Testing

- On a fresh install (no transactions), click "📊 Load Demo Data" — 4 users
  and 14 transactions appear.
- With existing transactions, click "📊 Load Demo Data" — an alert explains
  it can't load and suggests clearing data or importing instead.

### Unit Testing

Covered indirectly via `buildImportResult` tests in
`tests/unit/csv-workflow.test.js`, since `loadDemoData` delegates to the
same import path as [[T4G-0011]].

## Status

Implemented.
