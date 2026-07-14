# T4G-0009. Transaction filter and sort

**Tags:** #transactions #ui

## Description

Narrows the transaction table by user, currency, and date range, and sorts
it by clicking any sortable column header.

## Implementation

`src/filters.js`:
- `createDefaultFilterState()` — `{ userId: 'all', currencyCode: 'all', dateFrom: '', dateTo: '', sortColumn: 'date', sortDirection: 'desc' }`.
- `applyFilters(transactions, filterState)` — applies each active filter in
  sequence (user, currency, inclusive date range), returning a new array.
- `SORT_STRATEGIES` — one comparator per sortable column (`date`, `user`,
  `currency`, `amount`, `gel`, `ytd`); `user` and `ytd` need `userMap`/
  `ytdCache` to resolve display values.
- `sortTransactions(transactions, userMap, ytdCache, filterState)` — applies
  the strategy for `filterState.sortColumn`, honoring `sortDirection`.
- `computeNextSortState(currentState, column)` — toggles direction if the
  same column is clicked again, otherwise switches column and defaults to
  descending.

`script.js` keeps `filterState` at module scope, wires filter `<select>`/
date inputs to `handleFilterChange` (user/currency filters direct; date
filters debounced via `debounce()`, `FILTER_DEBOUNCE_MS` = 300ms — see
`src/utils.js`), and calls `toggleSort(column)` from clickable `<th>`
headers.

## Testing

### Human Testing

- Filter by user, currency, or date range — the table and "Showing X of Y"
  status update; combining filters narrows further.
- Click "Date" header twice — sort direction toggles; click a different
  header — sorts by that column, descending by default.
- "Clear Filters" resets all filters and sort to defaults.

### Unit Testing

`tests/unit/filters.test.js`: default state, each filter individually and
combined, no-match case, non-mutation, every `SORT_STRATEGIES` column,
unknown-column fallback, `computeNextSortState` toggle/switch behavior.

### Integration Testing

`tests/integration/app.test.js` (`sorting`, `filters`): default newest-first
sort, toggling Date header twice, filtering the visible list by currency.

## Status

Implemented.
