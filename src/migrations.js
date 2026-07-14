// ===========================
// Data Schema Migrations
// ===========================
//
// Pure functions over a plain localStorage snapshot ({key: value}, values
// already JSON-parsed) - same pattern as src/backup.js, so this is
// unit-testable without a DOM/localStorage fixture. script.js wraps
// runMigrations with the actual storage read/diff/write.

import { STORAGE_KEYS, CURRENCY_RATE_KEY_PREFIX } from './keys.js';

const LEGACY_CURRENCY_RATE_KEY_PREFIX = 'currencyRates_';

const LEGACY_KEY_MAP = {
    transactions: STORAGE_KEYS.transactions,
    users: STORAGE_KEYS.users,
    themePreference: STORAGE_KEYS.themePreference,
    addTransaction: STORAGE_KEYS.addTransaction
};

/**
 * Schema 1 -> 2: renames the legacy unprefixed keys (transactions, users,
 * themePreference, addTransaction, currencyRates_<date>) to their
 * t4g_<category>_ namespaced equivalents (see src/keys.js). Keys not part
 * of this rename (already t4g_-prefixed, or unrecognized) pass through
 * untouched, so running this on already-migrated data is a no-op.
 *
 * Renamed keys always win over an identically-named passthrough key already
 * present in the snapshot: script.js reads via the canonical key at every
 * render, so a canonical key (e.g. t4g_data_users) can already hold an
 * auto-seeded default value by the time this runs - the app renders (and
 * loadUsers() seeds a default user if the canonical key is still empty)
 * before the user acts on the migration modal. That incidental value must
 * not clobber the real data being renamed out of the legacy key.
 * @param {Object} snapshot - Plain {key: value} localStorage snapshot
 * @returns {Object} New snapshot with renamed keys
 */
export function migrateV1toV2(snapshot) {
    const result = {};
    const renamedTargets = new Set();

    Object.entries(LEGACY_KEY_MAP).forEach(([legacyKey, canonicalKey]) => {
        if (legacyKey in snapshot) {
            result[canonicalKey] = snapshot[legacyKey];
            renamedTargets.add(canonicalKey);
        }
    });

    Object.entries(snapshot).forEach(([key, value]) => {
        if (key.startsWith(LEGACY_CURRENCY_RATE_KEY_PREFIX)) {
            const date = key.slice(LEGACY_CURRENCY_RATE_KEY_PREFIX.length);
            const canonicalKey = `${CURRENCY_RATE_KEY_PREFIX}${date}`;
            result[canonicalKey] = value;
            renamedTargets.add(canonicalKey);
        }
    });

    Object.entries(snapshot).forEach(([key, value]) => {
        if (key in LEGACY_KEY_MAP || key.startsWith(LEGACY_CURRENCY_RATE_KEY_PREFIX)) return;
        if (renamedTargets.has(key)) return;
        result[key] = value;
    });

    return result;
}

// Ordered registry of migrations. Each entry transforms a snapshot from
// schema `from` to schema `to`; append new entries here as
// DATA_SCHEMA_VERSION (src/version.js) is bumped. Never reorder or remove
// past entries - a user's stored version may be arbitrarily old.
export const MIGRATIONS = [
    { from: 1, to: 2, migrate: migrateV1toV2 }
];

/**
 * Applies every registered migration step between fromVersion (exclusive)
 * and toVersion (inclusive), in order, to a localStorage snapshot.
 * @param {Object} snapshot - Plain {key: value} localStorage snapshot
 * @param {number} fromVersion - The snapshot's current schema version
 * @param {number} toVersion - The schema version to migrate up to
 * @returns {Object} New snapshot, migrated to toVersion
 */
export function runMigrations(snapshot, fromVersion, toVersion) {
    return MIGRATIONS
        .filter(step => step.from >= fromVersion && step.to <= toVersion)
        .reduce((current, step) => step.migrate(current), snapshot);
}
