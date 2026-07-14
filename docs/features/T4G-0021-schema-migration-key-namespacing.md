# T4G-0021. Schema migration: key namespacing

**Tags:** #storage #migration

## Description

The first real data migration to run through [[T4G-0019]]'s
version-tracking/backup-prompt infrastructure: schema `1` → `2` renames the
five legacy (unprefixed) `localStorage` keys to a `t4g_<category>_` namespace
— `data` for the actual records, `config` for UI preferences, `cache` for
re-fetchable derived data.

| category | v1 key | v2 key |
|---|---|---|
| data | `transactions` | `t4g_data_transactions` |
| data | `users` | `t4g_data_users` |
| config | `themePreference` | `t4g_config_themePreference` |
| config | `addTransaction` | `t4g_config_addTransaction` |
| cache | `currencyRates_<date>` | `t4g_cache_currencyRates_<date>` |

`t4g_appVersion` ([[T4G-0018]]) and `t4g_dataSchemaVersion` ([[T4G-0019]])
predate this category convention and are left as-is — they're
version-tracking metadata, not app data/config/cache.

## Implementation

`src/keys.js` — single source of truth for the v2 key names, imported by
every reader/writer instead of hardcoding a string: `STORAGE_KEYS.{transactions,
users, themePreference, addTransaction}` and `CURRENCY_RATE_KEY_PREFIX`
(the rate cache is date-suffixed, one key per day, so it can't be a fixed
`STORAGE_KEYS` entry).

`src/migrations.js` — pure functions over a plain `{key: value}` localStorage
snapshot, same pattern as `src/backup.js`:
- `migrateV1toV2(snapshot)` — renames each legacy key to its `STORAGE_KEYS`/
  `CURRENCY_RATE_KEY_PREFIX` equivalent; a `currencyRates_<date>` key maps to
  `${CURRENCY_RATE_KEY_PREFIX}<date>` for every date present. Keys not part
  of the rename (already `t4g_`-prefixed, or unrecognized) pass through
  unchanged, so it's idempotent on already-migrated data. Renamed keys always
  win over an identically-named key already present in the snapshot: the
  page renders (`window.onload`) before the user acts on the migration
  modal, and `loadUsers()` auto-seeds a default user under the canonical
  `t4g_data_users` key if it's still empty at that point — without this,
  that incidental single-user seed would silently clobber the real
  multi-user data being renamed out of the legacy `users` key.
- `MIGRATIONS` — ordered registry, `[{ from: 1, to: 2, migrate: migrateV1toV2 }]`.
  Future schema bumps append a new entry; past entries are never reordered
  or removed, since a user's stored version may be arbitrarily old.
- `runMigrations(snapshot, fromVersion, toVersion)` — applies every
  registered step whose `from`/`to` falls within `(fromVersion, toVersion]`,
  in order, returning the transformed snapshot.

`script.js` (Data Schema Migration section):
- `dismissMigrationModal()` now actually transforms data — previously it
  only stamped `DATA_SCHEMA_VERSION` and hid the modal. It calls
  `runSchemaMigration()` first: reads every key via `getAllStorageKeys()`
  into a snapshot, runs it through `runMigrations`, then reconciles storage
  — keys the migration renamed away from are removed
  (`removeFromStorage`), keys present in the result are (re)written
  (`saveToStorage`) — and finally stamps `DATA_SCHEMA_VERSION`. It then
  calls `triggerDataRefresh()` (same helper used after a JSON restore) —
  the page already rendered against the pre-migration data during
  `onload()`, so without this the user would see a stale/empty view even
  though their data was just correctly migrated underneath.
- `detectBaselineSchemaVersion()` (replaces the old
  `loadTransactions().length > 0` check in `currentDataSchemaVersion()` and
  `checkForSchemaMigration()`): once `loadTransactions()` reads the v2
  `t4g_data_transactions` key, it can no longer see v1 data written under
  the raw `transactions` key, so the "no stored schema version" baseline
  instead checks `getAllStorageKeys()` directly for the presence of any
  legacy key (`transactions`, `users`, `themePreference`, `addTransaction`,
  or a `currencyRates_`-prefixed key) → schema `1` if found, else
  `DATA_SCHEMA_VERSION` (a genuinely fresh install).
- `processJSONImport()` ([[T4G-0020]]) now migrates a restored backup before
  applying it: `runMigrations(data, meta.dataSchemaVersion, DATA_SCHEMA_VERSION)`.
  A backup taken pre-migration stores data under the old key names — without
  this, restoring it would write keys the v2 app can no longer read,
  silently losing the data. `overwrite=true` writes the migrated snapshot
  wholesale (and stamps `DATA_SCHEMA_VERSION` afterward); `overwrite=false`
  passes the migrated snapshot into `mergeBackupData`, which now reads
  `STORAGE_KEYS.users`/`STORAGE_KEYS.transactions` from it instead of raw
  `users`/`transactions`.

`src/backup.js`: `selectBackupKeys`'s schema-`2`+ scope (`t4g_`-only) now
legitimately captures the real data tables too, since they're `t4g_`-prefixed
as of this migration — see [[T4G-0020]] for the updated scope description.

## Configuration

`DATA_SCHEMA_VERSION` in `src/version.js`: `1` → `2`. `APP_VERSION`: `1.4.0`
→ `1.5.0`.

## Testing

### Human Testing

- In devtools, seed data under the legacy (v1) key names — `transactions`,
  `users`, `themePreference`, `addTransaction`, a `currencyRates_<date>`
  entry — and set `t4g_dataSchemaVersion` to `1`, then reload — the
  migration modal appears ([[T4G-0019]]). Click "Continue" — every legacy
  key is gone; each has a `t4g_<category>_`-prefixed counterpart holding the
  same value; transactions/users/theme still render correctly. Reload again
  — no modal.
- Restore an old (schema-1-shaped) JSON backup (raw `users`/`transactions`
  keys, `dataSchemaVersion: 1`) — both overwrite and merge land the data
  under the new `t4g_data_*` keys and it renders normally.
- Fresh install (clear site data) — no modal; the app writes `t4g_data_*`
  keys directly and stamps `t4g_dataSchemaVersion` as `2`.

### Unit Testing

`tests/unit/migrations.test.js`: `migrateV1toV2` renames each of the five
legacy keys (including multiple `currencyRates_<date>` entries, each mapped
independently), passes through unrelated/already-`t4g_`-prefixed keys
untouched, and is idempotent on an already-migrated snapshot.
`runMigrations` is a no-op when `fromVersion === toVersion`, applies the
registered step when migrating `1` → `2`, and the `MIGRATIONS` registry
contains exactly that one step today.

### Integration Testing

`tests/integration/app.test.js` (`data schema migration`,
`Backup & Restore modals`): a stored/detected schema-`1` baseline shows the
migration modal (not silently persisted, since the code is now schema `2`);
dismissing it renames every legacy key; a legacy-scope JSON backup still
reflects the pre-migration (raw) key shape it was taken from; a `t4g_`-only
scope backup now includes the migrated data tables; restoring an old
JSON backup (`overwrite=true`) migrates it before writing, landing settings
like `themePreference` under `t4g_config_themePreference`.

## Status

Implemented.
