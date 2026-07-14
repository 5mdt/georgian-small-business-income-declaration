// ===========================
// Full JSON Backup/Restore
// ===========================
//
// Pure functions over a plain localStorage snapshot - script.js wraps
// these with the actual storage read/write and FileReader/Blob/download
// plumbing, same pattern as src/csv.js.

import { ERROR_MESSAGES, validateUser, validateTransaction } from './utils.js';
import { APP_NAME } from './csv.js';

// Keys predating the t4g_ prefixing convention (see src/storage.js's
// getAllStorageKeys) that still hold the actual data tables under schema
// version 1. A future schema bump is expected to relocate these under
// t4g_-prefixed keys, at which point they stop being backed up explicitly
// here - see selectBackupKeys below.
const LEGACY_BACKUP_KEYS = ['users', 'transactions'];

/**
 * Selects which localStorage keys a full backup should include, based on
 * the schema version of the data being exported (not necessarily the
 * running code's DATA_SCHEMA_VERSION - see script.js's
 * currentDataSchemaVersion()):
 * - Schema version 1 (or the "key missing" baseline, which
 *   currentDataSchemaVersion() already resolves to 1): legacy scope -
 *   `users`, `transactions`, and every `t4g_`-prefixed key. Exchange-rate
 *   cache and UI settings (theme, add-transaction checkbox) are excluded.
 * - Any other version (0, 2, 3...): only `t4g_`-prefixed keys. Anticipates
 *   a future schema bump relocating the actual data tables under
 *   `t4g_`-prefixed keys, at which point the legacy `users`/`transactions`
 *   keys are no longer part of the current shape. No migration exists yet
 *   (same forward-looking-infra-ahead-of-need pattern as T4G-0019), so in
 *   practice this only matters for a devtools-forced version like `0`.
 * @param {Array<string>} allKeys - Every key currently in storage (e.g. via getAllStorageKeys)
 * @param {number} dataSchemaVersion
 * @returns {Array<string>} The subset of allKeys to include in the backup
 */
export function selectBackupKeys(allKeys, dataSchemaVersion) {
    if (dataSchemaVersion === 1) {
        return allKeys.filter(key => LEGACY_BACKUP_KEYS.includes(key) || key.startsWith('t4g_'));
    }
    return allKeys.filter(key => key.startsWith('t4g_'));
}

/**
 * Builds the JSON text for a full backup of the selected localStorage keys
 * (see selectBackupKeys).
 * @param {Object} storageSnapshot - Plain {key: value} object of the
 *   selected localStorage entries, values already parsed (e.g. via getFromStorage)
 * @param {number} dataSchemaVersion - Schema version of the data being
 *   exported (the *stored* schema, not necessarily the running code's
 *   DATA_SCHEMA_VERSION - see script.js's currentDataSchemaVersion())
 * @param {string} [instanceUrl] - The app's own URL at export time, if known
 * @returns {string} Pretty-printed JSON backup envelope
 */
export function buildBackupJSON(storageSnapshot, dataSchemaVersion, instanceUrl) {
    const envelope = {
        app: APP_NAME,
        dataSchemaVersion,
        exportedAt: new Date().toISOString(),
        ...(instanceUrl ? { instanceUrl } : {}),
        data: storageSnapshot
    };

    return JSON.stringify(envelope, null, 2);
}

/**
 * Parses a full backup JSON string, validating it's a T4G backup envelope.
 * @param {string} jsonString - Raw file content
 * @returns {{data: Object, meta: Object}} The snapshot data, plus every
 *   envelope field except data (app, dataSchemaVersion, exportedAt, instanceUrl?)
 * @throws {Error} If the JSON is malformed or isn't a backup envelope
 */
export function parseBackupJSON(jsonString) {
    let parsed;
    try {
        parsed = JSON.parse(jsonString);
    } catch {
        throw new Error(ERROR_MESSAGES.INVALID_BACKUP);
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
        throw new Error(ERROR_MESSAGES.INVALID_BACKUP);
    }

    const { data, ...meta } = parsed;
    return { data, meta };
}

/**
 * Merges a restored backup's users/transactions into existing data, for a
 * non-overwrite JSON restore. Settings keys (theme, versions, rate cache)
 * are intentionally left untouched here - only users/transactions merge;
 * script.js only calls saveToStorage for those two keys in this path.
 * @param {Array<Object>} existingUsers
 * @param {Array<Object>} existingTransactions
 * @param {Object} backupData - The backup envelope's `data` object
 * @returns {{users: Array<Object>, transactions: Array<Object>}}
 */
export function mergeBackupData(existingUsers, existingTransactions, backupData) {
    const users = [...existingUsers];
    const userIds = new Set(users.map(u => u.id));

    (backupData.users || []).forEach(u => {
        if (validateUser(u) && !userIds.has(u.id)) {
            users.push(u);
            userIds.add(u.id);
        }
    });

    const transactions = [...existingTransactions];
    const timestamps = new Set(transactions.map(t => t.timestamp));

    (backupData.transactions || []).forEach(t => {
        if (validateTransaction(t) && !timestamps.has(t.timestamp)) {
            transactions.push(t);
            timestamps.add(t.timestamp);
        }
    });

    return { users, transactions };
}
