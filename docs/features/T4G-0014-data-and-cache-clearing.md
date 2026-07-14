# T4G-0014. Data and cache clearing

**Tags:** #storage #transactions #users

## Description

Lets a user wipe transactions, users, cached exchange rates, or UI
settings independently — or everything at once — from a single "Clear
data…" modal with one checkbox per category, behind one confirmation.
Previously this was two toolbar buttons ("Clear All" / "Clear Cache")
that were misleadingly named: "Clear All" only ever removed transactions.

## Implementation

`src/clear.js` `clearData(selection)` — the pure orchestrator (no DOM),
given `{ transactions, users, rateCache, settings, everything }` booleans:
- `everything` — wipes every `t4g_`-prefixed key in both the active
  storage backend and `sessionStorage` (see the `settings` note below),
  ignoring every other flag. A true factory reset, including the version
  metadata keys ([[T4G-0018]], [[T4G-0019]]).
- `users` — resets `users` to `[createDefaultUser()]` and removes
  `transactions` (cascades, since every transaction belongs to a user —
  same effect as `deleteAllUsers()`, see below). `transactions` alone is
  ignored when `users` is also set.
- `transactions` — `removeFromStorage(STORAGE_KEYS.transactions)`
  ([[T4G-0013]]); keeps users intact.
- `rateCache` — removes every key starting with `CURRENCY_RATE_KEY_PREFIX`
  (`t4g_cache_currencyRates_`), forcing fresh NBG fetches ([[T4G-0002]]).
- `settings` — removes every `t4g_config_` key (theme, add-transaction
  checkbox) from the active backend. Also explicitly sweeps
  `sessionStorage` for the same prefix, since `toggleCollapsible`
  (script.js) always writes collapsible-section state there directly,
  regardless of which backend `getStorage()` picked.

The modal groups its checkboxes into three risk tiers, each introduced
by a colored `<h4 class="zone-header zone-header-*">` heading
(`style.css`, green/yellow/red via `--success-text`/`--warning-text`/
`--error-text` — per-theme, WCAG-AA-contrast-checked (≥4.5:1) darkened
variants of the `--success`/`--warning`/`--error` Nord aurora hues used
for button backgrounds elsewhere; those raw hues are too low-contrast as
text on a card background, e.g. 1.6:1 for the raw warning yellow on
white. `.modal-warning` — also used by the Import modal's overwrite
warning — uses `--warning-text` for the same reason). The heading color
alone separates the tiers - there's no `<hr>` divider between them:
"Green zone" (cached exchange rates, settings & preferences — both
freely re-derived/re-defaulted), "Warning zone" (just the disabled
recalculate placeholder, since it's not a real option yet), and
"Critical zone!" (transactions, users, reset everything — anything that
destroys data with no automatic replacement). A "💾 Make a backup" button
lives in the modal's bottom button row, pinned to the opposite (left)
corner from Clear selected/Cancel via the `.btn-push-left` CSS utility
(`style.css`,
`margin-right: auto` inside the `.modal .btn-group`'s `flex-end` row) —
so it reads as a distinct, non-destructive action rather than a third
option alongside the confirm/cancel pair. It calls `exportBackupJSON()`
(`script.js`, already used by the Export modal — see [[T4G-0020]])
directly, without opening the Export modal itself: two
`.modal-overlay-top` modals would share a z-index and the later one in
the DOM (`clearDataModal`) would always render on top, so this reuses
the export function rather than stacking modals.

`script.js` "Clear Data Modal" section wires the `#clearDataModal`
checkboxes (`clearTransactionsCheckbox`, `clearUsersCheckbox`,
`clearRateCacheCheckbox`, `clearSettingsCheckbox`, `clearEverythingCheckbox`,
plus a `clearRecalculateCheckbox` rendered permanently `disabled` as a
"not yet implemented" placeholder for a future rate-refresh-and-recompute
option) to `clearData`:
- `openClearDataModal()` / `closeClearDataModal()` — standard show/hide,
  resetting every checkbox and re-enabling them on open.
- `onClearSelectionChange()` — enables the confirm button once any
  checkbox is checked; shows a warning when `users` or `everything` is
  checked (the transactions-cascade note).
- `toggleClearEverything()` — checking "Reset everything" auto-checks and
  disables the four real checkboxes (they're implied); unchecking restores
  them.
- `confirmClearData()` — reads the checkboxes into a `selection` object,
  confirms, calls `clearData`, re-applies the (now-default) theme and
  add-transaction checkbox state immediately if `settings`/`everything`
  was cleared (storage is cleared but the DOM isn't, unlike the list
  re-renders `triggerDataRefresh()` already handles), then refreshes and
  alerts a summary of what was cleared.

`deleteAllUsers()` remains a separate, unchanged control in the user
management panel (confirms, message includes transaction count if any
exist, then resets `users`/`transactions` the same way `clearData({users:
true})` does), bypassing the per-user delete checks in [[T4G-0006]].

Every modal function is exposed on `window.*` for the HTML `onclick`/
`onchange` handlers.

## Testing

### Human Testing

- "🧹 Clear data…" opens the modal; the confirm button starts disabled and
  enables once a checkbox is checked.
- "💾 Make a backup" downloads a full JSON backup without closing the
  modal, so it can be used right before clearing anything.
- Check "Transactions" only — confirms, empties the transaction table,
  users remain.
- Check "Users" — confirms, resets to a single default user, transactions
  are also gone (warning explains the cascade beforehand).
- Check "Cached exchange rates" — confirms, clears cached rates; next date
  selection re-fetches from the NBG API.
- Check "Settings & preferences" — confirms, theme resets to System and
  the add-transaction checkbox resets to unchecked immediately.
- Check "Reset everything" — auto-checks and disables the other four
  boxes; confirms; wipes all app data (a reload shows a fresh install).
- The "Clear exchange rates and recalculate conversion" checkbox is
  visibly greyed out and cannot be checked.
- "🗑️ Delete All Users" (user panel) — unchanged: confirms, resets to a
  single default user with no transactions.

### Unit Testing

`tests/unit/clear.test.js` (`clearData`): transactions-only removes only
that key; users cascades to also remove transactions; rateCache removes
only rate-cache keys; settings removes config keys from both storage
backends; everything wipes every `t4g_` key in both backends and ignores
other flags; combining categories in one call; no-op when nothing is
selected.

### Integration Testing

`tests/integration/app.test.js` (`clear data modal`): modal opens reset
and disabled; the recalculate checkbox is disabled; the confirm button
enables on selection; "Reset everything" checks/disables the individual
boxes and restores them when unchecked; confirmation is asked and
"cancel" is honored; transactions-only / users-cascade / rate-cache-only /
reset-everything each clear exactly their scope.

## Status

Implemented.
