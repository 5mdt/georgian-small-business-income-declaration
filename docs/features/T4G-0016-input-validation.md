# T4G-0016. Input validation

**Tags:** #validation

## Description

Rejects malformed dates, amounts, currency codes, users, and transactions
before they're stored or used in a calculation.

## Implementation

`src/utils.js`:
- `validateDateString(dateString)` — strict `YYYY-MM-DD`, year `MIN_YEAR`
  (2000) to 2100, never a rolled-over calendar date (see [[T4G-0003]]).
- `validateAmount(amount)` — finite number, `0 < amount <= MAX_AMOUNT`
  (1,000,000,000).
- `validateCurrencyCode(code)` — exactly 3 uppercase letters.
- `validateUser(user)` — object with non-empty string `id` and `name`.
- `validateTransaction(transaction)` — object with `id`/`userId`, and valid
  date, currency code, amount, and `convertedGEL` (via the checks above).

These gate every write path: `loadTransactions`/`addTransactionToStorage`
(`src/transactions.js`), `loadUsers`/`updateUserInStorage` (`src/users.js`),
and CSV row import (`validateCSVRow`, [[T4G-0020]]) all reject invalid data
rather than persisting it.

## Testing

### Human Testing

- Attempt to convert with no amount or a negative amount — a validation
  error is shown instead of a result.

### Unit Testing

`tests/unit/validation.test.js`: date (format/range/boundaries/rollover/
leap-year/type), amount (positive/zero/negative/non-numeric/over-cap/
decimal precision), currency code (format/type), user (valid/missing
fields/non-object/wrong types), transaction (valid/missing fields/invalid
sub-fields/non-object).

## Status

Implemented.
