# T4G-0022. Per-user totals & supertotal

**Tags:** #transactions #ytd #ui

## User Story

As a small business owner with multiple users, I want to see each user's
total income and the combined total for everyone at a glance, so that I
don't have to add up their monthly summary rows by hand.

## Behavior

The transaction table footer, currently a single "Total GEL" row summing
every visible transaction ([T4G-0007](T4G-0007-transaction-management.md)),
gains one subtotal line per user (over the same currently filtered/sorted
transactions as the table) above the existing grand-total ("supertotal")
line, which is relabeled to make clear it's the sum across all users.

```
┌────────────┬───────┬──────────┬──────────┬──────┬────────────┬─────────┬─────────┐
│  ...transaction rows...                                                          │
├────────────┴───────┴──────────┴──────────┴──────┴────────────┴─────────┴─────────┤
│                                    Alice total:                       ₾ 45,320.00 │
│                                    Bob total:                         ₾ 12,050.00 │
│                                    Supertotal (all users):            ₾ 57,370.00 │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Per-user subtotals respect active filters the same way the existing total
does — filtering to one user collapses the breakdown to that user's own
line plus a supertotal equal to it.

## Implementation

`src/utils.js`: new `calculateTotalsByUser(transactions)` — returns a
`Map<userId, totalGEL>` summing `convertedGEL` per user over the given
transaction list (no month/year grouping, unlike
`calculateMonthlyIncomeByUser`/`calculateMonthlyYTDByUser`,
[T4G-0008](T4G-0008-ytd-income-calculation.md)).

`script.js`: `buildTransactionTableFooter(transactions, userMap)` replaces
the current `buildTransactionTableFooter(totalGEL)` signature — computes
per-user totals via `calculateTotalsByUser`, renders one row per user
(sorted the same way the user list is elsewhere), then the existing
supertotal row.

## Testing

### Human

- With transactions from two or more users, open the transaction table —
  each user's total appears above the supertotal, and the supertotal
  equals their sum.
- Filter to one user — only that user's line and a matching supertotal
  show.

### Unit

`tests/unit/utils.test.js`: `calculateTotalsByUser` — empty list, single
user, multiple users, a user with zero matching transactions is omitted.

### Integration

`tests/integration/app.test.js`: transaction table footer shows per-user
totals summing to the supertotal for a multi-user fixture.

## Status

Planned
