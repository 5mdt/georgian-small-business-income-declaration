# T4G-0007. Transaction management

**Tags:** #transactions

## Description

Add, remove, and comment on individual currency-conversion transactions,
each attributed to a user and rendered in the transaction table.

## Implementation

`src/transactions.js`:
- `loadTransactions()` reads `localStorage` key `transactions`
  ([[T4G-0013]]), filtering out any entry that fails `validateTransaction`
  ([[T4G-0016]]).
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

### Human Testing

- Convert an amount with "Add as Transaction" checked — it appears as a new
  row in the transaction table.
- Click a comment field, type a note, click away (blur) — the comment
  persists.
- Click "🗑️" on a row — the transaction is removed from the table.

### Unit Testing

`tests/unit/transactions.test.js`: load (empty/valid/invalid-filtered/
non-array), add (valid/invalid/accumulate), remove (targeted/no-op),
update comment (found/not-found).

### Integration Testing

`tests/integration/app.test.js` (`transaction list rendering + actions`):
HTML-escapes a malicious comment, removes a transaction from the table,
confirms before/after clearing all transactions.

## Status

Implemented.
