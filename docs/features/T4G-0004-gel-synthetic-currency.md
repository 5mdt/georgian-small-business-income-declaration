# T4G-0004. GEL synthetic currency

**Tags:** #currency

## Description

GEL is the target currency, so it needs no exchange rate lookup — it's
handled as a synthetic 1:1 "currency" rather than an NBG API entry.

## Implementation

`src/currency.js` `createGELCurrencyObject()` returns
`{ code: 'GEL', name: 'Georgian Lari', rate: 1, quantity: 1, rateFormated: '1.0000' }`.
`findCurrencyInData()` returns this object immediately for `currencyCode === 'GEL'`,
without inspecting the NBG response. `convertToGEL()` ([[T4G-0001]]) also
special-cases `currency.code === 'GEL'` to return the amount unchanged.
`script.js` always lists GEL first in the currency dropdown
(`populateCurrencySelect`) and defaults to it on initial page load.

## Testing

### Human Testing

- Select GEL as the currency and convert — the result shows the amount
  unchanged, with no exchange rate or quantity factor displayed.

### Unit Testing

`tests/unit/currency.test.js` (`createGELCurrencyObject`,
`findCurrencyInData`): synthetic object shape; GEL returned without
inspecting the response.
`tests/unit/calculations.test.js`: GEL passthrough in `convertToGEL`.

### Integration Testing

`tests/integration/app.test.js` (`currency conversion`): GEL treated as 1:1
passthrough with no exchange rate details shown.

## Status

Implemented.
