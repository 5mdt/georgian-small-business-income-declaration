# T4G-0020. Backup & Restore

**Tags:** #csv #storage #users #transactions #ui #migration

## Description

Export and import go through two modals instead of one-shot toolbar
buttons: an Export modal offering transactions CSV, users CSV, or a full
JSON backup (whose contents depend on the data schema version — see Full
JSON backup below); and an Import modal with a single file picker
(auto-detects CSV vs. JSON, and which CSV kind), an "Overwrite data" toggle
that switches import from merge to wholesale replace, and a "Start Import"
button — choosing a file only stages it, so the import doesn't start until
the user confirms. Supersedes the old single-purpose transaction CSV
export/import (previously T4G-0010/T4G-0011, folded into this doc).

## Implementation

### Schema-of-data tagging

Every export (CSV or JSON) is tagged with the schema version of the *data
being exported*, not the running code's `DATA_SCHEMA_VERSION`. `script.js`
computes this once per export via `currentDataSchemaVersion()` — reads
`t4g_dataSchemaVersion` from storage, falling back to `1` when the key is
absent but transactions exist (same baseline as
[[T4G-0019]]'s `checkForSchemaMigration`), else the code's current version
— and passes it into the pure builders below as an explicit parameter. This
prevents a backup taken before a pending migration from being mislabeled as
already-migrated data. `buildExportCSVContent`/`buildUsersCSVContent` no
longer import `DATA_SCHEMA_VERSION` themselves.

### Transactions CSV (export/import)

`src/csv.js`, unchanged in shape from the original T4G-0010/T4G-0011:
- `buildExportCSVContent(transactions, calculateYTDFn, getUserByIdFn, dataSchemaVersion, instanceUrl)` —
  header `Date,User ID,User Name,Taxpayer ID,Currency Code,Currency Name,Amount,Exchange Rate,Quantity,Converted GEL,YTD Income,Comment,Timestamp`,
  one row per transaction, quoting/escaping user name, currency name, and
  comment. YTD is recomputed per row via `calculateYTDFn` rather than reused
  from a batch cache, since export operates on a filtered subset. Ends with
  trailing `#`-prefixed comment lines (file description, GitHub URL,
  instance URL if provided, data schema version) built by a shared
  `buildCommentTail(dataSchemaVersion, instanceUrl)` helper, also used by
  the users CSV export below.
- `buildExportFilename(filterState, getUserByIdFn, todayISODate)` —
  `gel-transactions-all-<date>.csv`, or
  `gel-transactions-<sanitized-user-name>-<date>.csv` when a user filter is
  active.
- `buildImportResult(content, existingTransactions, existingUsers, overwrite = false)` —
  validates the header (`validateCSVHeader`, requires `Date`,
  `Currency Code`, `Converted GEL`), parses each line
  (`parseCSVLine`)/row (`validateCSVRow`), auto-creates any user referenced
  by ID that doesn't already exist (`ensureUserExistsFromCSV`). Comment
  tail lines are silently dropped like any malformed row (none has 12+
  comma-separated values). `overwrite` (new): `false` (default) merges into
  `existingTransactions`/`existingUsers` and skips rows whose `Timestamp`
  matches an existing transaction or an earlier row in the same file, same
  as before this feature. `true` ignores `existingTransactions`/
  `existingUsers` entirely — the result is built purely from the file (plus
  any users it references), so the import becomes the whole transactions +
  referenced-users dataset. Existing callers that don't pass `overwrite`
  are unaffected.

### Users CSV (export/import) — new

`src/csv.js`:
- `buildUsersCSVContent(users, dataSchemaVersion, instanceUrl)` — header
  `User ID,User Name,Taxpayer ID`, one escaped row per user, same trailing
  comment tail as the transaction export (via `buildCommentTail`). A
  3-column users row can't satisfy `validateCSVRow`'s 12-column minimum, so
  a users export is inert if mistakenly fed to the transactions importer,
  and vice versa.
- `buildUsersImportResult(content, existingUsers, overwrite = false)` —
  validates the header (`validateUsersCSVHeader` in `src/utils.js`, requires
  `User ID`, `User Name`, `Taxpayer ID`), parses each row
  (`parseCSVLine`), builds a candidate `{id, name, taxpayerId}` (name/
  taxpayerId sanitized) and keeps it if `validateUser` accepts it.
  `overwrite = false` (default): starts from `existingUsers`, skips a row
  whose `id` already exists (as a duplicate, mirroring the transaction
  importer's dedup). `overwrite = true`: starts empty, so the result is
  exactly the users in the file. Returns `{ users, stats: { imported,
  skipped } }`.
- `detectCSVKind(header)` — returns `'transactions'` if the header has
  `Date`, `Currency Code`, and `Converted GEL`; `'users'` if it has
  `User ID`, `User Name`, and `Taxpayer ID`; `null` otherwise. Used by the
  Import modal to route a `.csv` file to the right importer without asking
  the user to pick a type.

### Full JSON backup — new

The backup's contents depend on the schema version of the data being
exported (`currentDataSchemaVersion()`, same value used for the
schema-of-data tag above) — **not a snapshot of every `localStorage` key
unconditionally**:

- **Schema version `1`** (or the "key missing" baseline, which
  `currentDataSchemaVersion()` already resolves to `1`) — **legacy
  scope**: `users`, `transactions`, and every `t4g_`-prefixed key
  (`t4g_appVersion`, `t4g_dataSchemaVersion`). Exchange-rate cache
  (`currencyRates_<date>`) and UI settings (`themePreference`,
  `addTransaction`) are excluded.
- **Any other version** (`0`, `2`, `3`, …) — **`t4g_`-only scope**: only
  keys starting with `t4g_`. Anticipates a future schema bump relocating
  the actual data tables under `t4g_`-prefixed keys, at which point the
  legacy `users`/`transactions` keys are no longer part of the current
  shape. Today `DATA_SCHEMA_VERSION` is `1` and no migration logic exists
  (same forward-looking-infra-ahead-of-need pattern as [[T4G-0019]]), so in
  practice this only matters for a devtools-forced version like `0`
  (the [[T4G-0019]] migration-modal test scenario) — real installs always
  hit the legacy scope above.

`src/backup.js`:
- `selectBackupKeys(allKeys, dataSchemaVersion)` — pure filter implementing
  the two scopes above, given every currently-stored key
  (`getAllStorageKeys()`, `src/storage.js`) and the schema version.
- `buildBackupJSON(storageSnapshot, dataSchemaVersion, instanceUrl)` — takes
  a plain `{ key: value }` object (already-parsed values for the keys
  `selectBackupKeys` selected) and wraps it in an envelope:
  `{ app, dataSchemaVersion, exportedAt, instanceUrl?, data }`.
  `exportedAt` is an ISO timestamp. Reuses the `APP_NAME`/`GITHUB_URL`
  constants exported from `src/csv.js`.
- `parseBackupJSON(jsonString)` — parses the string and checks it has a
  `data` object; throws `ERROR_MESSAGES.INVALID_BACKUP` if the JSON is
  malformed or isn't a backup envelope. Returns `{ data, meta }` where
  `meta` is every envelope field except `data`.
- `mergeBackupData(existingUsers, existingTransactions, backupData)` — for
  a non-overwrite JSON restore: adds each user in `backupData.users` that
  passes `validateUser` and isn't already present by `id`; adds each
  transaction in `backupData.transactions` that passes `validateTransaction`
  and isn't already present by `timestamp`. Returns `{ users, transactions }`.
  Settings keys (theme, versions, rate cache) are left untouched on a
  non-overwrite restore — only users/transactions are merged.

`src/storage.js`:
- `getAllStorageKeys(storageBackend = getStorage())` — enumerates every key
  in the active storage backend via the standard `.length`/`.key(i)`
  `Storage` interface (not `Object.keys`, which doesn't reflect a `Storage`
  object's actual entries). Used by `script.js` to build the full snapshot
  and to wipe existing keys before a wholesale JSON restore.

`script.js`:
- `exportBackupJSON()` — computes `currentDataSchemaVersion()`, filters
  `getAllStorageKeys()` through `selectBackupKeys`, snapshots only the
  selected keys via `getFromStorage`, builds the JSON with
  `window.location.href`, downloads `gel-backup-<date>.json`. Reads
  storage directly (not through `filterState`), so — unlike `exportToCSV`
  — it's inherently unfiltered within whatever scope applies, with no
  separate "ignore filters" logic needed.
- On import, a `.json` file is restored via `parseBackupJSON`: `overwrite`
  false calls `mergeBackupData` and saves the merged `users`/`transactions`
  only; `overwrite` true removes every currently-tracked key
  (`getAllStorageKeys` + `removeFromStorage`) then writes every key from
  the file's `data` object as-is (a true wholesale restore — but only of
  whichever keys the backup actually contains, per the scope it was
  exported under).

### Modals

`index.html`: two new modals, `#exportModal` and `#importModal`, styled
like [[T4G-0019]]'s `.modal-overlay`/`.modal` (a higher `z-index` than the
update/migration modals so they can layer on top when opened from the
migration flow).

- **Export modal**: three buttons — Transactions (CSV), Users (CSV), Full
  backup (JSON) — each calling its respective `script.js` function
  directly and closing over nothing else. The JSON option is styled as the
  primary action. Only it sets `migrationBackupDownloaded = true` (shared
  with [[T4G-0019]]) — the transactions CSV can be filtered to a subset and
  the users CSV omits transactions entirely, so neither is guaranteed to be
  a *complete* backup the way the JSON snapshot is.
- **Import modal**: a "Choose file…" button triggering a hidden
  `<input type="file" accept=".csv,.json">`, an "Overwrite data" checkbox
  (default unchecked), a warning paragraph — shown only while the checkbox
  is checked — recommending a full backup first, and a "Start Import"
  button. Choosing a file only *stages* it: `onImportFileChosen()` shows
  the picked filename and enables "Start Import" (disabled until then) —
  it does not import immediately, so the user can review/toggle "Overwrite
  data" first. Clicking "Start Import" (`startImport()`) reads the staged
  file off the input and calls `handleImportFile(file)`, which reads the
  overwrite checkbox, reads the file via `FileReader`, and for `.json`
  calls the JSON restore path above; for `.csv` reads the header, routes
  via `detectCSVKind` to `buildImportResult` or `buildUsersImportResult`
  with the overwrite flag, then saves and refreshes the UI. An
  unrecognized `.csv` header or invalid `.json` alerts with the failure and
  makes no partial write; the modal stays open (with the file still
  staged) so the user can pick a different file. `openImportModal()` resets
  the checkbox, warning, staged filename, and disables "Start Import" again
  each time the modal opens.

The toolbar's old "⬇ Export CSV" / "⬆ Import CSV" buttons become "⬇
Export" (`openExportModal()`) / "⬆ Import" (`openImportModal()`). The
transaction-only `exportToCSV()`/`importFromCSV()`/`processCSVContent()`
functions (used directly by the toolbar's CSV path, and by "Load Demo
Data") are unchanged in behavior — the modals call `exportToCSV()` for the
"Transactions (CSV)" export option, and demo data continues to use
`importFromCSV()` directly (merge, not overwrite) rather than going
through the Import modal.

**Migration modal reuse** ([[T4G-0019]]): the migration modal's "Download
backup" button now calls `openExportModal()` instead of downloading a CSV
directly, so a schema migration can produce a complete JSON restore point
(or either of the other two formats) rather than being locked to CSV.
`migrationBackupDownloaded` is set only by a successful `exportBackupJSON()`
call, however the Export modal was opened — the other two export options
aren't guaranteed to be complete (see above), so they don't satisfy the
"you have a backup" check.

## Configuration

None.

## Testing

### Human Testing

- Click "⬆ Export" — modal shows three export options; each downloads the
  expected file type with the correct extension and content.
- Click "⬆ Import", pick a file — "Start Import" is disabled until a file
  is chosen, then shows the picked filename and enables; nothing imports
  yet. Click "Start Import" with a transactions CSV, "Overwrite data"
  unchecked — merges in, reports imported/skipped/created counts, same as
  before this feature.
- Pick a users CSV, click "Start Import" — new users are added by ID; an
  ID that already exists is skipped, not overwritten.
- Check "Overwrite data" — a warning appears recommending a backup first;
  importing a transactions or users CSV now replaces the whole
  table/dataset with the file's contents instead of merging.
- On a normal install (schema version `1`), export a full JSON backup,
  clear all data, re-import it with "Overwrite data" checked — `users` and
  `transactions` are restored exactly; theme/add-transaction-checkbox/rate
  cache are *not* part of this backup and stay at their defaults after
  restore (see Full JSON backup above for why).
- Import that same JSON backup again without "Overwrite data" — users and
  transactions merge in without duplicating; nothing changes if it's
  already fully present.
- In devtools, set `t4g_dataSchemaVersion` to `2` (simulating a future
  schema) and export a full JSON backup — the file contains only
  `t4g_appVersion`/`t4g_dataSchemaVersion`, no `users`/`transactions`.
- In devtools, set `t4g_dataSchemaVersion` below `DATA_SCHEMA_VERSION` with
  a transaction present, reload to trigger the migration modal, click
  "Download backup" — the shared Export modal opens; downloading the full
  JSON backup lets "Continue" proceed without the no-backup confirmation
  (the other two formats don't, since neither is guaranteed complete).

### Unit Testing

`tests/unit/csv.test.js`/`csv-workflow.test.js`: `detectCSVKind` for both
header kinds and an unrecognized header; `buildUsersCSVContent` escaping
and comment tail; `buildUsersImportResult` merge vs. overwrite, dedup by
id, invalid rows dropped; `buildImportResult` overwrite vs. default merge
(existing behavior unchanged); `buildExportCSVContent` writes the injected
`dataSchemaVersion`, not the code constant.

`tests/unit/backup.test.js`: `buildBackupJSON` envelope shape; round-trip
through `parseBackupJSON`; throws on malformed/non-backup JSON;
`mergeBackupData` adds only new users/transactions by id/timestamp;
`selectBackupKeys` — schema `1` keeps `users`/`transactions`/`t4g_*` and
drops settings/rate-cache keys, schema `0`/`2`/other keep only `t4g_*`,
empty key lists and lists with no `t4g_*` keys behave sanely.

`tests/unit/storage.test.js`: `getAllStorageKeys` reflects every key
written via `saveToStorage`.

### Integration Testing

`tests/integration/app.test.js`: Export modal buttons produce the right
file per option; a full JSON backup at schema `1` includes
`users`/`transactions`/`t4g_*` but not settings/rate-cache (and ignores
active filters), while a backup at another schema version includes only
`t4g_*` keys; choosing a file stages it (`onImportFileChosen()` enables
"Start Import" without importing) and only `startImport()` actually runs
it; Import modal auto-detects `.json` vs. each `.csv` kind; overwrite
checked replaces existing data, unchecked merges; migration modal's
"Download backup" opens the Export modal and marks
`migrationBackupDownloaded` on a successful JSON export from it (tagged
with whatever mismatched schema version triggered the modal).

## Status

Implemented.
