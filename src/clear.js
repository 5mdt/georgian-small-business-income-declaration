// ===========================
// Granular Data Clearing
// ===========================
//
// Pure orchestrator behind the "Clear data" modal (script.js wires the
// checkboxes/DOM). Reuses the same storage primitives as the rest of the
// app (src/storage.js) rather than introducing new ones.

import { getStorage, getAllStorageKeys, removeFromStorage, saveToStorage } from './storage.js';
import { STORAGE_KEYS, CURRENCY_RATE_KEY_PREFIX } from './keys.js';
import { createDefaultUser } from './utils.js';

const T4G_PREFIX = 't4g_';
const CONFIG_PREFIX = 't4g_config_';

/**
 * Removes every key matching a prefix from a storage backend.
 * @param {string} prefix
 * @param {Storage} storageBackend
 */
function removeByPrefix(prefix, storageBackend) {
    getAllStorageKeys(storageBackend)
        .filter(key => key.startsWith(prefix))
        .forEach(key => removeFromStorage(key, storageBackend));
}

/**
 * Clears app data per the modal's checkbox selection.
 * @param {Object} selection
 * @param {boolean} [selection.everything] - Wipes every t4g_ key in the
 *   active storage backend, plus sessionStorage (factory reset - see the
 *   sessionStorage note on `settings`). Takes precedence over every other
 *   flag.
 * @param {boolean} [selection.users] - Resets users to a single default
 *   user and cascades to remove transactions (transactions belong to users).
 * @param {boolean} [selection.transactions] - Removes the transactions
 *   table. Ignored if `users` is also set (already cascades).
 * @param {boolean} [selection.rateCache] - Removes every cached exchange
 *   rate entry.
 * @param {boolean} [selection.settings] - Resets UI preferences: theme and
 *   add-transaction checkbox (active backend), plus collapsible-section
 *   state, which `toggleCollapsible` (script.js) always writes to
 *   `sessionStorage` directly regardless of the active backend - so this
 *   also sweeps sessionStorage for `t4g_config_` keys.
 * @returns {{cleared: Array<string>}} Which categories were actually cleared
 */
export function clearData(selection) {
    const storage = getStorage();

    if (selection.everything) {
        removeByPrefix(T4G_PREFIX, storage);
        removeByPrefix(T4G_PREFIX, sessionStorage);
        return { cleared: ['everything'] };
    }

    const cleared = [];

    if (selection.users) {
        saveToStorage(STORAGE_KEYS.users, [createDefaultUser()]);
        removeFromStorage(STORAGE_KEYS.transactions);
        cleared.push('users', 'transactions');
    } else if (selection.transactions) {
        removeFromStorage(STORAGE_KEYS.transactions);
        cleared.push('transactions');
    }

    if (selection.rateCache) {
        removeByPrefix(CURRENCY_RATE_KEY_PREFIX, storage);
        cleared.push('rateCache');
    }

    if (selection.settings) {
        removeByPrefix(CONFIG_PREFIX, storage);
        removeByPrefix(CONFIG_PREFIX, sessionStorage);
        cleared.push('settings');
    }

    return { cleared };
}
