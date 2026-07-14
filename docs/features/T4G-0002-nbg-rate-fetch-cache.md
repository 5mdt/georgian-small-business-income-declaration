# T4G-0002. NBG exchange rate fetch + cache

**Tags:** #currency #rates #storage

## Description

Fetches official daily exchange rates from the National Bank of Georgia's
public API and caches the response per date, so repeated conversions for the
same date don't re-fetch.

## Implementation

`src/currency.js`:
- `fetchCurrencyRates(date, fetchImpl = fetch)` calls
  `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=YYYY-MM-DD`,
  throws `ERROR_MESSAGES.API_ERROR` on a non-ok response, and caches the
  parsed body via `saveCurrencyRatesToCache` on success. `fetchImpl` is
  injectable for testing.
- `getCurrencyRatesFromCache(date)` / `saveCurrencyRatesToCache(date, data)`
  read/write `localStorage` key `currencyRates_${date}` (via
  [[T4G-0013]]).
- `findCurrencyInData(data, currencyCode)` returns the synthetic GEL object
  ([[T4G-0004]]) for `GEL`, otherwise validates the response shape
  (`validateCurrencyResponse`) and finds the matching currency, throwing
  `CURRENCY_NOT_FOUND` if absent.

Response schema is documented in `docs/currency-rates-schema.json`. `quantity`
matters: some currencies (e.g. JPY) are quoted per 100 units, so conversion
divides by `quantity` ([[T4G-0001]]).

`script.js` `loadCurrencies()` checks the cache before fetching, and
populates the currency `<select>` (GEL always listed first).

## Configuration

None — API endpoint is not configurable.

## Testing

### Human Testing

- Select a date with no prior cache — the currency dropdown shows a
  "Loading..." state, then populates.
- Re-select the same date — the dropdown populates without a network
  request (cached).
- Use "Clear Cache" (see [[T4G-0014]]) then re-select the date — a fresh
  fetch happens.

### Unit Testing

`tests/unit/currency.test.js`: `validateCurrencyResponse`,
`findCurrencyInData` (GEL shortcut, found, not-found, malformed response),
cache read/write/independence per date, `fetchCurrencyRates` success/
non-ok/network-rejection paths.

### Integration Testing

`tests/integration/app.test.js` (`bootstrap`): populates the currency
dropdown from a mocked NBG response with GEL first.

## Status

Implemented.
