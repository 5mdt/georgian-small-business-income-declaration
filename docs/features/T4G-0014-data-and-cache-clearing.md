# T4G-0014. Data and cache clearing

**Tags:** #storage #transactions #users

## User Story

As a small business owner, I want to wipe transactions, users, cached rates, or
settings independently (or everything at once) behind one confirmation, so that I
can reset exactly what I intend to and nothing else.

## Behavior

Lets a user wipe transactions, users, cached exchange rates, or UI
settings independently — or everything at once — from a single "Clear
data…" modal with one checkbox per category, behind one confirmation.

## Implementation

`src/clear.js` `clearData(selection)` — the pure orchestrator (no DOM),
given `{ transactions, users, rateCache, settings, everything }` booleans:
- `everything` — wipes every `t4g_`-prefixed key in both the active
  storage backend and `sessionStorage` (see the `settings` note below),
  ignoring every other flag. A true factory reset, including the version
  metadata keys ([T4G-0018](T4G-0018-update-notification.md),
  [T4G-0019](T4G-0019-data-schema-version.md)).
- `users` — resets `users` to `[createDefaultUser()]` and removes
  `transactions` (cascades, since every transaction belongs to a user —
  same effect as `deleteAllUsers()`, see below). `transactions` alone is
  ignored when `users` is also set.
- `transactions` — `removeFromStorage(STORAGE_KEYS.transactions)`
  ([T4G-0013](T4G-0013-local-storage-persistence.md)); keeps users intact.
- `rateCache` — removes every key starting with `CURRENCY_RATE_KEY_PREFIX`
  (`t4g_cache_currencyRates_`), forcing fresh NBG fetches
  ([T4G-0002](T4G-0002-nbg-rate-fetch-cache.md)).
- `settings` — removes every `t4g_config_` key (theme, add-transaction
  checkbox) from the active backend. Also explicitly sweeps
  `sessionStorage` for the same prefix, since `toggleCollapsible`
  (script.js) always writes collapsible-section state there directly,
  regardless of which backend `getStorage()` picked.

The modal groups its checkboxes into three risk tiers under colored headings
(`.zone-header-*`, `style.css` — see its comments for the WCAG-contrast
rationale): "Green zone" (cached exchange rates, settings & preferences —
both freely re-derived/re-defaulted), "Warning zone" (the disabled
recalculate placeholder, not yet implemented), and "Critical zone!"
(transactions, users, reset everything — anything that destroys data with
no automatic replacement). A "💾 Make a backup" button in the modal's
bottom row (`.btn-push-left`, `style.css`) calls `exportBackupJSON()`
(`script.js`, shared with the Export modal — see
[T4G-0020](T4G-0020-backup-and-restore.md)) directly rather than opening
the Export modal itself.

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
true})` does), bypassing the per-user delete checks in
[T4G-0006](T4G-0006-user-delete-protection.md).

## Quirks & Decisions

- Quirk: two `.modal-overlay-top` modals would share a z-index and the
  later one in the DOM (`clearDataModal`) would always render on top, so
  the "Make a backup" button reuses `exportBackupJSON()` directly instead
  of stacking the Export modal on top of the Clear Data modal.
  Proposed: keep as-is — reusing the function avoids a two-modal stack for
  one non-destructive action.

## Testing

### Human

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

### Unit

`tests/unit/clear.test.js` (`clearData`): transactions-only removes only
that key; users cascades to also remove transactions; rateCache removes
only rate-cache keys; settings removes config keys from both storage
backends; everything wipes every `t4g_` key in both backends and ignores
other flags; combining categories in one call; no-op when nothing is
selected.

### Integration

`tests/integration/app.test.js` (`clear data modal`): modal opens reset
and disabled; the recalculate checkbox is disabled; the confirm button
enables on selection; "Reset everything" checks/disables the individual
boxes and restores them when unchecked; confirmation is asked and
"cancel" is honored; transactions-only / users-cascade / rate-cache-only /
reset-everything each clear exactly their scope.

## Status

Implemented
