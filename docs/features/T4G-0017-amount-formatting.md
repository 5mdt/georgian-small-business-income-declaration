# T4G-0017. Amount formatting

**Tags:** #currency #ui

## Description

Displays monetary amounts with two decimal places, thousand separators, and
the correct currency symbol.

## Implementation

`src/utils.js`:
- `formatCurrency(value)` — `value.toFixed(2)` with a space-separated
  thousands grouping regex; returns `'0.00'` for non-finite input
  (`Infinity`/`NaN`) instead of throwing or rendering garbage.
- `getCurrencySymbol(currencyCode)` — looks up `CURRENCY_SYMBOLS` (GEL ₾,
  USD $, EUR €, and 19 more), falling back to the raw currency code for
  anything not in the map.

Used throughout `script.js` rendering: conversion result, transaction table
rows/footer ([[T4G-0007]]), user-facing amounts generally.

## Testing

### Unit Testing

`tests/unit/formatting.test.js` (`Currency Formatting`,
`Currency Symbol Lookup`): decimal places, thousand separators (incl. with
decimals), zero, small decimals, `Infinity`/`NaN`, negative numbers,
rounding, known-symbol lookup, unknown-code fallback, full symbol table
coverage.

## Status

Implemented.
