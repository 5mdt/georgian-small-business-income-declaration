# Architecture

## Core Components

**index.html**: Single-page UI, two-column layout on desktop (converter form
+ disclaimer/help on the left, user management + transaction history on the
right). Loads `script.js` as an ES6 module (`type="module"`).

**src/utils.js**: Pure, DOM-free utility functions — constants (currency
symbols, error messages, limits), validation (date, amount, currency code,
user, transaction), formatting (currency, symbol lookup), calculations
(currency conversion, YTD), CSV parsing/validation, and small helpers (ID
generation, debouncing, map building). No `document`/`window` usage, so these
run under plain Node as well as jsdom.

**src/dom.js**: Small DOM-touching helpers (`sanitizeInput`, `showElement`,
`hideElement`, `showError`, `hideError`). Split out from `utils.js` so that
file can stay DOM-free; these still test fine under jsdom.

**src/storage.js**, **src/users.js**, **src/transactions.js**,
**src/currency.js**, **src/filters.js**, **src/csv.js**: the storage-layer
and business-logic pieces extracted from `script.js` for testability. Each
is DOM-free (no rendering calls) — `script.js` wraps their return values with
the actual DOM rendering/refresh. Concretely:
- `storage.js`: localStorage wrapper with sessionStorage fallback
- `users.js` / `transactions.js`: CRUD against storage, cascading delete
- `currency.js`: NBG rate fetch + cache, GEL special-case, `fetchCurrencyRates`
  takes an injectable fetch impl for testing
- `filters.js`: filter/sort logic, taking `filterState` as an explicit
  argument rather than closing over module state
- `csv.js`: import (`buildImportResult`) and export (`buildExportCSVContent`,
  `buildExportFilename`) as pure functions over plain data

**script.js**: DOM wiring only — reads form inputs, calls the `src/*.js`
functions, renders results into the DOM, and registers event listeners.
Exposes the functions HTML `onclick` attributes need via `window.*`.

**style.css**: Nord-themed, responsive, dark mode via
`@media (prefers-color-scheme: dark)`. `.disclaimer-card` and `.info-card`
must keep using `var(--bg-card)` for dark mode to render correctly.

## Data Flow

1. User selects a date → `loadCurrencies()`
2. Fetches NBG API: `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=YYYY-MM-DD`
3. Response cached in `localStorage` as `currencyRates_${date}` (via `src/currency.js`)
4. User enters an amount and clicks Convert → `convertToGEL()` calculation
5. If "Add as Transaction" is checked, the result is persisted and the
   transaction table re-renders

## API Response Schema

Defined in `currency-rates-schema.json`:
```javascript
[{
  "date": "2025-03-29T00:00:00",
  "currencies": [{
    "code": "USD",
    "name": "US Dollar",
    "rate": 2.8750,
    "quantity": 1,
    "rateFormated": "2.8750",
    "diff": 0.0050,
    "diffFormated": "0.0050",
    "validFromDate": "2025-03-29T00:00:00"
  }]
}]
```
`quantity` matters: some currencies (e.g. JPY) are quoted per 100 units, so
conversion is `amount * rate / quantity`, not `amount * rate`.

## User and Transaction Management

**Users** (`localStorage` key `users`): `{ id, name, taxpayerId }`. A default
user (`id: 'user'`) is seeded on first load. See `src/users.js` for
`loadUsers()`, `updateUserInStorage()`, `canDeleteUser()`, `getUserById()`.

**Transactions** (`localStorage` key `transactions`):
```javascript
{ id, userId, date, currencyCode, currencyName, amount, rate, quantity, convertedGEL, comment, timestamp }
```

**YTD (Year-to-Date) calculation**: sum of a user's transactions within the
same calendar year, up to and including the current one. See
`precalculateAllYTD()` (batch, used for rendering) and
`calculateYTDForTransaction()` (single transaction, used for CSV export) in
`src/utils.js`. Both sort by date then `timestamp`, and tie-break by
transaction `id` — not by re-comparing date+timestamp, which misattributes
totals when two transactions share both.

**User deletion protection**: the default `'user'` account can't be deleted
while it's the only user; deleting any other user cascades to delete their
transactions too (with a confirmation prompt if they have any). See
`canDeleteUser()` in `src/users.js`.

## Caching Strategy

`localStorage` holds: NBG rate responses per date (`currencyRates_${date}`),
users, transactions, the "add as transaction" checkbox state, and collapsible
section open/closed state. "Clear Cache" removes only the rate-cache keys,
forcing fresh API calls.

## CSV Import/Export

- **Export** (`src/csv.js` `buildExportCSVContent`): includes all
  transaction fields plus the owning user's name and taxpayer ID, and a
  freshly recomputed YTD column.
- **Import** (`src/csv.js` `buildImportResult`): auto-creates any user
  referenced by ID that doesn't exist yet; skips rows whose `Timestamp`
  matches an existing transaction *or* an earlier row already processed in
  the same file; validates the header and every row before importing
  anything.

## Demo Data

`demo-data.csv` — loadable via "📊 Load Demo Data" only when no transactions
exist yet (safety measure, via `loadDemoData()` → `importFromCSV()`). 4 users,
14 transactions, covering 7 currencies including a quantity-factor currency
(JPY, quoted per 100 units) and one prior-year transaction to show YTD
resetting per calendar year.

## GEL Currency Handling

GEL is synthetic — rate is always `1.0`, no API lookup needed. See
`createGELCurrencyObject()` in `src/currency.js`.

## Gotchas

- **Storage quota**: localStorage has a ~5-10MB limit; the app surfaces a
  `QUOTA_EXCEEDED` message via `alert()` rather than failing silently.
- **API timeout**: `fetchCurrencyRates` passes `{ timeout: API_TIMEOUT }` to
  `fetch()`, but native `fetch` has no `timeout` option — this is currently a
  no-op, not an enforced timeout. If real timeout behavior is needed, this
  needs an `AbortController`.
- **Filter debouncing**: date-range filter changes are debounced 300ms;
  user/currency filter changes are not.
- **Currency filter freshness**: adding a transaction refreshes the currency
  filter dropdown (`populateCurrencyFilter()`) so a brand-new currency is
  immediately filterable.
