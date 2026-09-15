# T4G-0002. NBG exchange rate fetch + cache

**Tags:** #currency #rates #storage

## User Story

As a small business owner, I want conversions to use the National Bank of Georgia's
official daily rate, so that my declared income matches the rate the tax authority
recognizes.

## Behavior

Fetches official daily exchange rates from the National Bank of Georgia's
public API and caches the response per date, so repeated conversions for the
same date don't re-fetch.

## Implementation

`src/currency.js`:
- `fetchCurrencyRates(date, fetchImpl = fetch)` calls
  `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=YYYY-MM-DD`,
  throws `ERROR_MESSAGES.API_ERROR` on a non-ok response, and caches the
  parsed body via `saveCurrencyRatesToCache` on success. `fetchImpl` is
  injectable for testing. The request is bounded by `API_TIMEOUT` (10s) via
  an `AbortController`: a `setTimeout` aborts the signal passed to
  `fetchImpl`, and an `AbortError` is rethrown as
  `ERROR_MESSAGES.API_TIMEOUT_ERROR`. The timeout is always cleared
  (`.finally`) so it never outlives the request.
- `getCurrencyRatesFromCache(date)` / `saveCurrencyRatesToCache(date, data)`
  read/write `STORAGE_KEYS`-namespaced `localStorage` key
  `t4g_cache_currencyRates_${date}` (`CURRENCY_RATE_KEY_PREFIX`, `src/keys.js`;
  via [T4G-0013](T4G-0013-local-storage-persistence.md)).
- `findCurrencyInData(data, currencyCode)` returns the synthetic GEL object
  ([T4G-0004](T4G-0004-gel-synthetic-currency.md)) for `GEL`, otherwise
  validates the response shape (`validateCurrencyResponse`) and finds the
  matching currency, throwing `CURRENCY_NOT_FOUND` if absent.

Response schema is documented in `docs/currency-rates-schema.json`. `quantity`
matters: some currencies (e.g. JPY) are quoted per 100 units, so conversion
divides by `quantity` ([T4G-0001](T4G-0001-currency-conversion.md)).

`script.js` `loadCurrencies()` checks the cache before fetching, and
populates the currency `<select>` (GEL always listed first). The API
endpoint is not configurable.

## Quirks & Decisions

- Quirk: a fetch failure (including the `#BUG-0002` timeout above) only
  surfaces as a transient `errorMessage` text set at the point of the
  failed call — there's no persistent, glanceable indicator that the NBG
  API is currently unreachable, so a user who navigates away from that
  error text has no way to tell rates are unavailable until they try again.
  Proposed: track a `currencyApiUnavailable` flag, set on a failed
  `fetchCurrencyRates`/`loadCurrencies` call and cleared on the next
  success, and render a persistent (not auto-dismissing) banner near the
  converter while it's set.

## Testing

### Human

- Select a date with no prior cache — the currency dropdown shows a
  "Loading..." state, then populates.
- Re-select the same date — the dropdown populates without a network
  request (cached).
- Use "Clear Cache" (see [T4G-0014](T4G-0014-data-and-cache-clearing.md))
  then re-select the date — a fresh fetch happens.

### Unit

`tests/unit/currency.test.js`: `validateCurrencyResponse`,
`findCurrencyInData` (GEL shortcut, found, not-found, malformed response),
cache read/write/independence per date, `fetchCurrencyRates` success/
non-ok/network-rejection/timeout paths, and that an `AbortSignal` (not the
unsupported `timeout` option) is passed to `fetchImpl`.

### Integration

`tests/integration/app.test.js` (`bootstrap`): populates the currency
dropdown from a mocked NBG response with GEL first.

## Status

Implemented
