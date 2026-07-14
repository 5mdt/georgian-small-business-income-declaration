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
  transaction version used during CSV export ([[T4G-0020]]), since export
  may run over a filtered/re-sorted subset. Filters `allTransactions` to the
  same user + calendar year + date ≤ target date, sorts by
  `date` → `timestamp`, and sums until it reaches the target transaction
  **by id** (not by re-comparing date+timestamp, which misattributes totals
  when two transactions share both).

Both are consumed by `script.js` (`renderTransactionList`, `exportToCSV`).

### Month-end bolding

Only the YTD Income value of each user's **last transaction in a
calendar month** is rendered as `<strong>₾ {ytd}</strong>`; every other
row's YTD value is plain text. `findLastMonthTransactionIds(transactions)`
(`src/utils.js`) returns a `Set` of transaction ids — one per
`${userId}_${YYYY-MM}` group, the transaction with the latest `date` in
that group. Ties are broken by `timestamp` then `id`, matching
`sortTransactions`'s tie-break (`src/filters.js`) so the bolded row
agrees with the table's own sort order. Computed in `renderTransactionList`
over **all** transactions (not the filtered/sorted subset), so it reflects
the true month-end transaction regardless of active filters.
`buildTransactionTableRow` wraps the YTD cell in `<strong>` only when the
row's id is in the set.

## Testing

### Human Testing

- Add several transactions for the same user across different dates in one
  year — YTD Income increases cumulatively per row.
- Add a transaction in a different calendar year — YTD resets for that
  year.
- Add transactions for two different users — each user's YTD is independent.
- Add multiple transactions for a user within the same month — only the
  one with the latest date has a bold YTD Income value; adding a later
  transaction in that month moves the bolding to it.

### Unit Testing

`tests/unit/calculations.test.js` (`YTD Calculation - Single Transaction`,
`YTD Precalculation - Optimized`): first/middle/last transaction, per-user
and per-year isolation, same-date-different-timestamp ordering, invalid
transactions, tie-breaking by id when date+timestamp collide, empty list.

`Last-of-month highlight - findLastMonthTransactionIds`: single
transaction in a month, only the latest date flagged, same-date tie-break
by timestamp then id, per-user and per-month (including cross-year)
isolation, invalid transactions skipped, empty list.

## Status

Implemented.
