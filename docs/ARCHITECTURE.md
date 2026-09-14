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

**src/storage.js**, **src/keys.js**, **src/migrations.js**, **src/users.js**,
**src/transactions.js**, **src/currency.js**, **src/filters.js**,
**src/csv.js**, **src/backup.js**: the storage-layer and business-logic
pieces extracted from `script.js` for testability. Each is DOM-free (no
rendering calls) — `script.js` wraps their return values with the actual DOM
rendering/refresh. Concretely:
- `storage.js`: localStorage wrapper with sessionStorage fallback
- `keys.js`: canonical `t4g_<category>_`-namespaced key names (`STORAGE_KEYS`,
  `CURRENCY_RATE_KEY_PREFIX`) — every reader/writer imports from here
- `migrations.js`: pure schema-migration runner (`MIGRATIONS` registry,
  `runMigrations`) over a plain localStorage snapshot — see
  [T4G-0021](features/T4G-0021-schema-migration-key-namespacing.md)
- `users.js` / `transactions.js`: CRUD against storage, cascading delete
- `currency.js`: NBG rate fetch + cache, GEL special-case, `fetchCurrencyRates`
  takes an injectable fetch impl for testing
- `filters.js`: filter/sort logic, taking `filterState` as an explicit
  argument rather than closing over module state
- `csv.js`: import (`buildImportResult`) and export (`buildExportCSVContent`,
  `buildExportFilename`) as pure functions over plain data
- `backup.js`: full JSON backup/restore — key selection, envelope
  build/parse, merge — as pure functions over a plain storage snapshot

**script.js**: DOM wiring only — reads form inputs, calls the `src/*.js`
functions, renders results into the DOM, and registers event listeners.
Exposes the functions HTML `onclick` attributes need via `window.*`.

**style.css**: Nord-themed, responsive, dark mode via
`@media (prefers-color-scheme: dark)`. `.disclaimer-card` and `.info-card`
must keep using `var(--bg-card)` for dark mode to render correctly.

For the behavior each module implements, see the per-feature docs indexed
in `docs/FRD.md`.

## Data Flow

1. User selects a date → `loadCurrencies()`
   ([T4G-0002](features/T4G-0002-nbg-rate-fetch-cache.md),
   [T4G-0003](features/T4G-0003-historical-rate-by-date.md))
2. Fetches NBG API: `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=YYYY-MM-DD`
3. Response cached in `localStorage` as `t4g_cache_currencyRates_${date}`
   ([T4G-0021](features/T4G-0021-schema-migration-key-namespacing.md))
4. User enters an amount and clicks Convert → `convertToGEL()`
   ([T4G-0001](features/T4G-0001-currency-conversion.md))
5. If "Add as Transaction" is checked, the result is persisted
   ([T4G-0007](features/T4G-0007-transaction-management.md)) and the
   transaction table re-renders

## API Response Schema

Defined in `docs/currency-rates-schema.json`:
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
Why `quantity` matters to conversion:
[T4G-0002](features/T4G-0002-nbg-rate-fetch-cache.md). GEL isn't in this
response — it's synthesized instead:
[T4G-0004](features/T4G-0004-gel-synthetic-currency.md).

## Storage Schemas

**Users** (`localStorage` key `t4g_data_users`, `STORAGE_KEYS.users` in
`src/keys.js`): `{ id, name, taxpayerId }`.

**Transactions** (`localStorage` key `t4g_data_transactions`,
`STORAGE_KEYS.transactions`):
```javascript
{ id, userId, date, currencyCode, currencyName, amount, rate, quantity, convertedGEL, comment, timestamp }
```

Both keys were unprefixed (`users`, `transactions`) before the schema `1` →
`2` key-namespacing migration:
[T4G-0021](features/T4G-0021-schema-migration-key-namespacing.md).

Full key inventory and persistence behavior:
[T4G-0013](features/T4G-0013-local-storage-persistence.md). Rate caching:
[T4G-0002](features/T4G-0002-nbg-rate-fetch-cache.md). YTD calculation:
[T4G-0008](features/T4G-0008-ytd-income-calculation.md). User deletion
protection: [T4G-0006](features/T4G-0006-user-delete-protection.md).
Backup & restore (CSV/JSON import/export):
[T4G-0020](features/T4G-0020-backup-and-restore.md). Demo data:
[T4G-0012](features/T4G-0012-demo-data.md). Clearing/resetting data
("Clear data…" modal, `src/clear.js` owns the actual key-clearing logic):
[T4G-0014](features/T4G-0014-data-and-cache-clearing.md).

## Gotchas

- **API timeout** (`#BUG-0002`, see `docs/bugs.md`): `fetchCurrencyRates`
  passes `{ timeout: API_TIMEOUT }` to `fetch()`, but native `fetch` has no
  `timeout` option — this is currently a no-op, not an enforced timeout.
- Storage quota handling:
  [T4G-0013](features/T4G-0013-local-storage-persistence.md). Filter
  debouncing: [T4G-0009](features/T4G-0009-filter-and-sort.md). Currency
  filter refresh after adding a transaction:
  [T4G-0007](features/T4G-0007-transaction-management.md).
