# T4G-0014. Data and cache clearing

**Tags:** #storage #transactions #users

## Description

Lets a user wipe transactions, users, or cached exchange rates
independently, each behind a confirmation.

## Implementation

`script.js`:
- `clearAllTransactions()` — confirms, then `removeFromStorage('transactions')`
  ([[T4G-0013]]) and re-renders; keeps users intact.
- `deleteAllUsers()` — confirms (message includes transaction count if any
  exist), then resets `users` to `[createDefaultUser()]` and `transactions`
  to `[]`, bypassing the per-user delete checks in [[T4G-0006]].
- `clearRateCache()` — confirms, then removes every `localStorage` key
  starting with `currencyRates_` (forcing fresh NBG fetches, see
  [[T4G-0002]]), and alerts on completion.

Each of these is exposed on `window.*` for the corresponding HTML button's
`onclick`.

## Testing

### Human Testing

- "Clear All Transactions" — confirms, then empties the transaction table
  while users remain.
- "🗑️ Delete All Users" — confirms, then resets to a single default user
  with no transactions.
- "Clear Cache" — confirms, clears cached rates; next date selection
  re-fetches from the NBG API.

### Unit Testing

Underlying storage primitives are covered by `tests/unit/storage.test.js`
(`removeFromStorage`); user/transaction reset behavior overlaps
`tests/unit/users.test.js` and `tests/unit/transactions.test.js`.

### Integration Testing

`tests/integration/app.test.js` (`transaction list rendering + actions`):
asks for confirmation before clearing all transactions and honors "cancel";
clears all transactions on confirmation.

## Status

Implemented.
