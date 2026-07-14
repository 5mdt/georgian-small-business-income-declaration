# T4G-0003. Historical rate by date

**Tags:** #currency #rates #validation

## Description

Lets a user pick any past date to convert at that date's official NBG rate,
while rejecting future dates and out-of-range years.

## Implementation

`index.html` `datePicker` input triggers `script.js` `loadCurrencies()` on
`change`, which calls `isValidDate()` to reject dates after today
(`ERROR_MESSAGES.FUTURE_DATE`) before hitting the rate cache/API
([[T4G-0002]]). `setMaxDates()` sets the HTML `max` attribute on the date
picker and both filter date inputs to today, as a first line of defense in
the browser's native picker.

`src/utils.js` `validateDateString(dateString)` is the underlying reusable
check (used for transactions, not the date-picker UI directly): requires
strict `YYYY-MM-DD`, year between `MIN_YEAR` (2000) and 2100, and rejects
calendar dates that don't round-trip through `Date` (e.g. `2025-02-30`).

## Testing

### Human Testing

- Try to pick a date after today in the date picker — the browser's native
  `max` constraint prevents it.
- Manually set a future date value and trigger `change` — an error message
  is shown and the currency dropdown is cleared.

### Unit Testing

`tests/unit/validation.test.js` (`Date Validation`): valid strings, invalid
formats, year range, boundary years, calendar rollover rejection, leap-year
Feb 29, malformed padding, non-string input.

## Status

Implemented.
