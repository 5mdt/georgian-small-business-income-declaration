# T4G-0008. Year-to-date income calculation

**Tags:** #ytd #transactions

## Description

Shows each transaction's running total of GEL income for that user within
the same calendar year, up to and including that transaction.

## Implementation

`src/utils.js`:
- `precalculateAllYTD(transactions)` — batch version used for rendering the
  transaction table. Filters to valid transactions, sorts by
  `userId` → `date` → `timestamp`, and accumulates a running total per
  `${userId}_${year}` key into a `Map` of transaction id → YTD value.
- `calculateYTDForTransaction(transaction, allTransactions)` — single-
  transaction version used during CSV export ([[T4G-0010]]), since export
  may run over a filtered/re-sorted subset. Filters `allTransactions` to the
  same user + calendar year + date ≤ target date, sorts by
  `date` → `timestamp`, and sums until it reaches the target transaction
  **by id** (not by re-comparing date+timestamp, which misattributes totals
  when two transactions share both).

Both are consumed by `script.js` (`renderTransactionList`, `exportToCSV`)
and rendered as `<strong>₾ {ytd}</strong>` in the transaction table.

## Testing

### Human Testing

- Add several transactions for the same user across different dates in one
  year — YTD Income increases cumulatively per row.
- Add a transaction in a different calendar year — YTD resets for that
  year.
- Add transactions for two different users — each user's YTD is independent.

### Unit Testing

`tests/unit/calculations.test.js` (`YTD Calculation - Single Transaction`,
`YTD Precalculation - Optimized`): first/middle/last transaction, per-user
and per-year isolation, same-date-different-timestamp ordering, invalid
transactions, tie-breaking by id when date+timestamp collide, empty list.

## Status

Implemented.
