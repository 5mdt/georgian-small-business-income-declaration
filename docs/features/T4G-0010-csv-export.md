# T4G-0010. CSV export

**Tags:** #csv #transactions

## Description

Downloads the current (filtered/sorted) transaction list as a CSV file for
backup or handing to an accountant.

## Implementation

`src/csv.js`:
- `buildExportCSVContent(transactions, calculateYTDFn, getUserByIdFn)` —
  builds CSV text with header
  `Date,User ID,User Name,Taxpayer ID,Currency Code,Currency Name,Amount,Exchange Rate,Quantity,Converted GEL,YTD Income,Comment,Timestamp`,
  one row per transaction, quoting/escaping user name, currency name, and
  comment. YTD is recomputed per row via `calculateYTDFn`
  ([[T4G-0008]]'s `calculateYTDForTransaction`) rather than reused from a
  batch cache, since export operates on a filtered subset.
- `buildExportFilename(filterState, getUserByIdFn, todayISODate)` —
  `gel-transactions-all-<date>.csv`, or
  `gel-transactions-<sanitized-user-name>-<date>.csv` when a user filter is
  active.

`script.js` `exportToCSV()` applies the current filter/sort ([[T4G-0009]]),
alerts and aborts if there's nothing to export (no transactions at all, or
none matching the current filters), then builds a `Blob` and triggers a
download via a temporary `<a download>` link.

## Testing

### Human Testing

- Click "⬇ Export CSV" with transactions present — a `.csv` file downloads
  with all transaction fields plus user name/taxpayer ID and YTD.
- Apply a user or date filter, then export — only the filtered rows are
  included and the filename reflects the user filter.
- Export with no transactions, or a filter matching none — an alert
  explains nothing was exported.

### Unit Testing

`tests/unit/csv.test.js`, `tests/unit/csv-workflow.test.js`
(`buildExportFilename`, `export/import round trip`): filename with/without
user filter, filename fallback for a deleted user, comment/comma escaping
survives an export→import round trip.

### Integration Testing

`tests/integration/app.test.js` (`CSV export`): builds a CSV blob with the
exported data; alerts instead of exporting when there are no transactions
or the filters exclude everything.

## Status

Implemented.
