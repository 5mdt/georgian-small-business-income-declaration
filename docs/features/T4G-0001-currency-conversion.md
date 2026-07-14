# T4G-0001. Currency conversion

**Tags:** #currency #conversion

## Description

Converts an entered amount in a foreign currency to GEL using the exchange
rate for the selected date, and displays the result. Optionally records the
conversion as a transaction.

## Implementation

`src/utils.js` `convertToGEL(amount, currency)`:
- Returns `amount` unchanged if `currency.code === 'GEL'`.
- Otherwise computes `amount * currency.rate / currency.quantity` (see
  [[T4G-0002]] for why `quantity` matters).
- Returns `0` if `currency` is missing, or `rate`/`quantity` are non-finite,
  or `quantity <= 0`, or the result is non-finite — instead of surfacing
  `Infinity`/`NaN`.

`script.js`:
- `fetchButton` click handler reads date/currency/amount/user inputs,
  validates them (`validateConversionInputs`), resolves the currency via
  `findCurrencyInData` ([[T4G-0002]]), calls `convertToGEL`, and displays the
  result (`displayConversionResult`).
- If "Add as Transaction" is checked, wraps the result into a transaction
  object (`createTransactionFromConversion`) and saves it (see
  [[T4G-0007]]).

## Testing

### Human Testing

- Select a date, choose a currency (or GEL), enter an amount, click
  "Convert" — the converted GEL amount, exchange rate, and quantity factor
  are shown.
- Check "Add as Transaction" before converting — the result is added to the
  transaction table.
- Leave date, currency, or amount empty and click "Convert" — a validation
  error is shown instead of a result.

### Unit Testing

`tests/unit/calculations.test.js` (`Currency Conversion`): GEL passthrough,
normal conversion, quantity-factor conversion, decimals, zero/negative
quantity, non-finite rate/quantity, missing currency.

### Integration Testing

`tests/integration/app.test.js` (`currency conversion`): converts without
adding a transaction, converts and adds a transaction, shows a validation
error for a missing amount, treats GEL as 1:1 with no rate details shown.

## Status

Implemented.
