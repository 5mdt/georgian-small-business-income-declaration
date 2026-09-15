# T4G-0017. Amount formatting

**Tags:** #currency #ui

## User Story

As a small business owner, I want monetary amounts shown with clear grouping and
the right currency symbol, so that large figures are easy to read at a glance.

## Behavior

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
rows/footer ([T4G-0007](T4G-0007-transaction-management.md)), user-facing
amounts generally.

## Quirks & Decisions

- Quirk: the two decimal digits render with the same weight as the integer
  part, so `1,234.00` reads no differently at a glance from `1,234.56`.
  Proposed: `formatCurrency` wraps the decimal portion in a `<span>` with a
  new CSS class (e.g. `.amount-decimals`) styled in a muted color, so the
  integer part stands out. Callers that need plain text (CSV export,
  `title` attributes) keep using the existing unwrapped return value or a
  new `formatCurrencyPlain` alias.

## Testing

### Unit

`tests/unit/formatting.test.js` (`Currency Formatting`,
`Currency Symbol Lookup`): decimal places, thousand separators (incl. with
decimals), zero, small decimals, `Infinity`/`NaN`, negative numbers,
rounding, known-symbol lookup, unknown-code fallback, full symbol table
coverage.

## Status

Implemented
