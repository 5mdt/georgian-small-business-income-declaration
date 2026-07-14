# T4G-0019. Data schema version

**Tags:** #storage #migration #ui #csv

## Description

Tracks the shape/version of the data stored in `localStorage`, separately
from the app version ([[T4G-0018]]). When the running code's data schema is
newer than the user's stored data, shows a modal recommending a CSV backup
before the data is treated as migrated.

## Implementation

`src/version.js`: `DATA_SCHEMA_VERSION` — a monotonic integer (`1, 2, 3…`),
not semver. A data shape has no meaningful "major/minor/patch" split, so
this follows the conventional DB-migration numbering instead (Rails/Django
style). Bumped by hand whenever a stored data shape actually changes.

`script.js` (Data Schema Migration section):
- `DATA_SCHEMA_STORAGE_KEY = 't4g_dataSchemaVersion'`.
- `checkForSchemaMigration()`:
  - Stored key present and numerically less than `DATA_SCHEMA_VERSION` →
    shows the migration modal.
  - Stored key missing but transactions exist ([[T4G-0013]]) → treated as
    schema `1` (the baseline before this feature existed), then compared as
    above.
  - Stored key missing and no transactions (fresh install), or stored
    version already current/newer → silently persists
    `DATA_SCHEMA_VERSION`, no modal.
- The modal (`#migrationModal` in `index.html`, same `.modal-overlay`/
  `.modal` styling as [[T4G-0018]]'s update modal) has two controls:
  - "Download backup (CSV)" → `exportBackupCSV()`, a full, **unfiltered**
    export of every transaction (ignores `filterState`, unlike
    `exportToCSV()` — a backup must not silently omit filtered-out rows).
    Sets in-memory `migrationBackupDownloaded = true`. Both this and
    `exportToCSV()` share a `downloadCSV(csvContent, filename)` helper for
    the blob/anchor download mechanics ([[T4G-0010]]).
  - "Continue" → `dismissMigrationModal()`. If no backup was downloaded
    this session, `confirm()`s first; canceling leaves the modal open. On
    confirm (or if a backup was already downloaded), persists
    `DATA_SCHEMA_VERSION` and hides the modal. No backdrop/Escape
    dismissal.

**Load ordering with T4G-0018**: `checkForSchemaMigration()` only runs
after the update modal is resolved — chained from `checkForAppUpdate()`
(when no update is pending) and from `dismissUpdateModal()` (once the
update modal closes) — so the two modals never stack.

**CSV self-description**: `buildExportCSVContent` ([[T4G-0010]]) appends
trailing `#`-prefixed comment lines to every export (both the regular
"Export CSV" button and this feature's backup button): a file description,
the project's GitHub URL, the app's own URL at export time (if provided —
`script.js` passes `window.location.href`), and the data schema version.
Any CSV file can later be matched back to the schema and instance that
produced it. Trailing, not leading — none of these lines has 12+
comma-separated values, so `validateCSVRow` silently drops all of them on
re-import ([[T4G-0011]]) with no parser changes needed.

## Configuration

`DATA_SCHEMA_VERSION` in `src/version.js` must be bumped by hand whenever a
stored data shape changes, alongside whatever migration/transform logic
that change requires (none exists yet — this feature only ships the
version-tracking and backup-prompt infrastructure).

## Testing

### Human Testing

- Fresh install (clear site data) — no modal; `t4g_dataSchemaVersion` is
  set to the current schema version.
- In devtools, set `localStorage['t4g_dataSchemaVersion']` to `0` and
  ensure at least one transaction exists, then reload — migration modal
  appears (after any pending update modal).
- Click "Continue" without exporting — a confirm dialog warns no backup was
  downloaded; canceling keeps the modal open.
- Click "Download backup (CSV)", then "Continue" — no confirm prompt; modal
  closes immediately, and the downloaded CSV contains every transaction
  regardless of active filters, ending with the file-description/GitHub/
  instance-URL/schema-version comment lines.
- Reload again — modal does not reappear.
- Import that same backup file back in — it's accepted normally; the
  trailing comment line is silently ignored, not counted as skipped.

### Integration Testing

`tests/integration/app.test.js` (`data schema migration`): key missing +
no transactions (silent baseline); key missing + transactions (treated as
schema 1, no modal); stored version below current (modal shows); Continue
without backup (confirm-gated); Download backup then Continue (no confirm,
unfiltered CSV); modal ordering relative to the update-notification modal.

## Status

Implemented.
