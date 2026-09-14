# T4G-0008. Year-to-date income calculation

**Tags:** #ytd #transactions

## Description

Tracks each user's running total of GEL income for the current calendar year.
Rather than repeating that figure on every transaction row, the transaction
table is grouped by month then by user, with one highlighted summary row per
user per month showing their YTD income as of that month's end.

### Example table layout

```
┌────────────┬───────┬──────────┬──────────┬──────┬────────────┬─────────┬─────────┐
│ Date       │ User  │ Currency │ Amount   │ Rate │ GEL Amount │ Comment │ Actions │
├────────────┴───────┴──────────┴──────────┴──────┴────────────┴─────────┴─────────┤
│  September 2026                                              (month group row)   │
│  Alice — YTD as of Sep 2026: ₾ 45,320.00                     (user summary row)  │
│ 2026-09-03 │ Alice │ USD      │ 1,000.00 │ 2.70 │ 2,700.00   │         │   🗑️    │
│ 2026-09-12 │ Alice │ USD      │ 2,000.00 │ 2.71 │ 5,420.00   │         │   🗑️    │
│  Bob — YTD as of Sep 2026: ₾ 12,050.00                       (user summary row)  │
│ 2026-09-08 │ Bob   │ EUR      │   500.00 │ 2.95 │ 1,475.00   │         │   🗑️    │
│  August 2026                                                 (month group row)   │
│  Alice — YTD as of Aug 2026: ₾ 37,200.00                                         │
│ 2026-08-15 │ Alice │ USD      │ 3,000.00 │ 2.69 │ 8,070.00   │         │   🗑️    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Transaction rows no longer carry a per-row YTD cell — only the summary row
shows the figure, computed as of that month's end.

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

### Monthly per-user summary rows

`calculateMonthlyYTDByUser(transactions)` (`src/utils.js`) returns a
`Map<'${userId}_${YYYY-MM}', ytdValue>` — one entry per user/month group,
whose value is that user's running YTD total including **every**
transaction dated in or before that month within the calendar year. Sorts
only by `userId` → `date` (no timestamp/id tie-break needed, unlike
`precalculateAllYTD`) since a month-end total sums every transaction in the
month regardless of same-day order. Computed in `renderTransactionList` over
**all** transactions (not the filtered/sorted subset), so a summary row
always reflects the true month-end total regardless of active filters.

`groupTransactionsByMonthAndUser(transactions, userMap, sortDirection)`
(`src/utils.js`) turns the filtered/sorted transaction list into
`[{ month, users: [{ userId, userName, transactions }] }]`: months ordered
by `YYYY-MM` (honouring `sortDirection`), users ordered by display name
within a month, and each user's transactions kept in their incoming order.
`buildTransactionTable` (`script.js`) walks this structure, emitting a
month-group row, then one highlighted user-summary row (reading the YTD
value from `calculateMonthlyYTDByUser`) before that user's transaction rows.
Transaction rows carry no YTD cell.

## Testing

### Human Testing

- Add several transactions for the same user across different dates in one
  year — the month's summary row shows the cumulative YTD through that
  month's end, and later months show a higher total.
- Add a transaction in a different calendar year — YTD resets for that
  year.
- Add transactions for two different users in the same month — each gets
  its own summary row with an independent YTD figure, users ordered by
  name.
- Add multiple transactions for a user within the same month — the
  summary row's figure reflects the running total through the latest
  transaction in that month; adding a later transaction in that month
  updates it.
- Transaction rows show no YTD value; only the summary row above them does.

### Unit Testing

`tests/unit/calculations.test.js` (`YTD Calculation - Single Transaction`,
`YTD Precalculation - Optimized`): first/middle/last transaction, per-user
and per-year isolation, same-date-different-timestamp ordering, invalid
transactions, tie-breaking by id when date+timestamp collide, empty list.

`Monthly YTD by user - calculateMonthlyYTDByUser`: single transaction in a
month, value reflects the latest transaction in the group, same-date
tie-break by timestamp then id, per-user and per-month (including
cross-year) isolation, invalid transactions skipped, empty list.

`Grouping - groupTransactionsByMonthAndUser`: months ordered per sort
direction, users ordered by display name within a month, transactions
keep their incoming order within a user group, empty list.

## Status

Implemented.
