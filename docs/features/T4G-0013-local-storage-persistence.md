# T4G-0013. Local storage persistence

**Tags:** #storage #offline

## Description

Persists all app data in the browser (`localStorage`, with a
`sessionStorage` fallback) so the app works offline after initial load and
without a backend.

## Implementation

`src/storage.js`:
- `getStorage()` prefers `localStorage`, probing with a throwaway
  `setItem`/`removeItem`; falls back to `sessionStorage` if that throws
  (e.g. Safari private mode, storage blocked by policy). Re-checked on every
  call rather than cached, so a backend that becomes unavailable — or a test
  swapping `global.localStorage` — is picked up immediately.
- `getFromStorage(key, defaultValue, storageBackend)` — JSON-parses a
  stored value, returning `defaultValue` on a missing key or parse error.
- `saveToStorage(key, value, storageBackend)` — JSON-serializes and writes;
  on `QuotaExceededError` it `alert()`s `ERROR_MESSAGES.QUOTA_EXCEEDED`
  rather than failing silently (localStorage has a ~5-10MB limit); other
  errors are logged only.
- `removeFromStorage(key, storageBackend)`.
- `getAllStorageKeys(storageBackend)` — enumerates every key via the
  standard `Storage.length`/`Storage.key(i)` interface (not `Object.keys`,
  which doesn't reflect a `Storage` object's actual entries). Used by the
  full JSON backup ([[T4G-0020]]) to snapshot and, on a wholesale restore,
  wipe every key the app has written.

Keys in use: `users`, `transactions`, `currencyRates_${date}` per date
([[T4G-0002]]), `themePreference` ([[T4G-0015]]), `addTransaction`
(checkbox state), `t4g_appVersion` ([[T4G-0018]]), `t4g_dataSchemaVersion`
([[T4G-0019]]) — the latter two are the first prefixed keys in the app.
`sessionStorage` additionally holds `collapsible_<sectionId>` state (not
persisted across browser sessions by design). The full JSON backup
([[T4G-0020]]) does **not** snapshot every key unconditionally — its scope
depends on the stored data schema version (`users`/`transactions`/`t4g_*`
at schema `1`; only `t4g_*` otherwise), so `currencyRates_*`/
`themePreference`/`addTransaction` are excluded in both cases today.

## Testing

### Human Testing

- Add data, reload the page — users and transactions persist.
- Go offline (after initial load) — the app still functions against
  cached data; only fetching new NBG rates requires connectivity.

### Unit Testing

`tests/unit/storage.test.js`: localStorage-writable vs. sessionStorage-
fallback, read (existing/missing/corrupted JSON/explicit backend), save
(success/quota-exceeded/other error), remove (existing/missing/throwing
backend).

## Status

Implemented.
