# T4G-0011. CSV import

**Tags:** #csv #transactions #users

## Description

Restores transactions (and any users they reference) from a previously
exported CSV file, skipping duplicates.

## Implementation

`src/csv.js` `buildImportResult(content, existingTransactions, existingUsers)`
is pure — takes existing data as plain arrays and returns the post-import
state plus stats, without touching storage or the DOM:
- Validates the header via `validateCSVHeader` (requires `Date`,
  `Currency Code`, `Converted GEL` columns), throwing
  `ERROR_MESSAGES.INVALID_CSV` if missing.
- Parses each line with `parseCSVLine` (handles quoted values, escaped `""`,
  and preserves empty fields) and validates it with `validateCSVRow`.
- Skips a row if its `Timestamp` matches an existing transaction *or* an
  earlier row already processed in the same file (`existingTimestamps` set,
  updated as rows are processed).
- Silently ignores the trailing `#`-prefixed comment lines (file
  description, GitHub URL, instance URL, data schema version —
  [[T4G-0019]]) that exports now end with — none has 12+ comma-separated
  values, so `validateCSVRow` rejects each like any other malformed row,
  with no special-casing needed.
- Auto-creates any user referenced by ID that doesn't already exist
  (`ensureUserExistsFromCSV`), without duplicating known users.
- `extractTransactionFromCSVRow` builds the transaction object, reading
  comment/timestamp from a shifted column position when the optional YTD
  column is present (13 columns vs. 12).

`script.js`:
- `processCSVContent(content)` calls `buildImportResult` against
  `loadTransactions()`/`loadUsers()` and saves the results with
  `saveToStorage` ([[T4G-0013]]).
- `importFromCSV(file)` reads the file via `FileReader`, calls
  `processCSVContent`, refreshes the UI (`triggerDataRefresh`), and alerts
  with import/skip/user-creation counts.

## Testing

### Human Testing

- Export CSV, then import that same file back — an alert reports 0
  imported, all skipped as duplicates (by timestamp).
- Import a CSV referencing a user ID not currently in the app — the user is
  auto-created.
- Import a malformed CSV (missing required columns) — an alert reports the
  failure without partially importing.

### Unit Testing

`tests/unit/csv.test.js` (header/line/row validation),
`tests/unit/csv-workflow.test.js` (`extractTransactionFromCSVRow`,
`ensureUserExistsFromCSV`, `buildImportResult`): row extraction incl. YTD
column shift, comment sanitization, user auto-creation without duplication,
malformed-header rejection, accurate stats, timestamp dedup against prior
data and within the same file, malformed rows dropped without throwing,
blank lines skipped.

### Integration Testing

`tests/integration/app.test.js` (`CSV import`): imports transactions from a
CSV file and refreshes the UI.

## Status

Implemented.
