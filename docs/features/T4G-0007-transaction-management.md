# T4G-0007. Transaction management

**Tags:** #transactions

## User Story

As a small business owner, I want to add, remove, and annotate individual income
records, so that my transaction table reflects exactly what I actually received.

## Behavior

Add, remove, and comment on individual currency-conversion transactions,
each attributed to a user and rendered in the transaction table.

## Implementation

`src/transactions.js`:
- `loadTransactions()` reads `localStorage` key `t4g_data_transactions`
  (`STORAGE_KEYS.transactions`, `src/keys.js`;
  [T4G-0013](T4G-0013-local-storage-persistence.md)), filtering out any
  entry that fails `validateTransaction`
  ([T4G-0016](T4G-0016-input-validation.md)).
- `addTransactionToStorage(transactionData)` validates then appends.
- `removeTransactionFromStorage(id)` filters out one transaction by id.
- `updateTransactionCommentInStorage(id, newComment)` sanitizes
  (`src/dom.js` `sanitizeInput`) and updates a transaction's `comment`.

`script.js`:
- `saveTransaction()` / `deleteTransaction()` / `updateTransactionComment()`
  wrap the above with a `renderTransactionList()` refresh; `saveTransaction`
  also refreshes the currency filter dropdown so a brand-new currency is
  immediately filterable.
- `renderTransactionList()` builds the table (`buildTransactionTable*`
  helpers): header with sort indicators, one row per transaction (date,
  user, currency, amount, rate, GEL amount, YTD, editable comment, delete
  button), and a total-GEL footer.
- Transaction shape:
  `{ id, userId, date, currencyCode, currencyName, amount, rate, quantity, convertedGEL, comment, timestamp }`.

## Testing

### Human

- Convert an amount with "Add as Transaction" checked — it appears as a new
  row in the transaction table.
- Click a comment field, type a note, click away (blur) — the comment
  persists.
- Click "🗑️" on a row — the transaction is removed from the table.

### Unit

`tests/unit/transactions.test.js`: load (empty/valid/invalid-filtered/
non-array), add (valid/invalid/accumulate), remove (targeted/no-op),
update comment (found/not-found).

### Integration

`tests/integration/app.test.js` (`transaction list rendering + actions`):
HTML-escapes a malicious comment, removes a transaction from the table,
confirms before/after clearing all transactions.

## Status

Implemented
