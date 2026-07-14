import { describe, it, expect } from 'vitest';
import { migrateV1toV2, MIGRATIONS, runMigrations } from '../../src/migrations.js';
import { STORAGE_KEYS, CURRENCY_RATE_KEY_PREFIX } from '../../src/keys.js';

describe('migrateV1toV2', () => {
    it('renames each of the five legacy keys to their canonical equivalent', () => {
        const snapshot = {
            transactions: [{ id: 'tx_1' }],
            users: [{ id: 'user' }],
            themePreference: 'dark',
            addTransaction: true,
            'currencyRates_2025-01-15': { rate: 2.875 }
        };

        const migrated = migrateV1toV2(snapshot);

        expect(migrated).toEqual({
            [STORAGE_KEYS.transactions]: [{ id: 'tx_1' }],
            [STORAGE_KEYS.users]: [{ id: 'user' }],
            [STORAGE_KEYS.themePreference]: 'dark',
            [STORAGE_KEYS.addTransaction]: true,
            [`${CURRENCY_RATE_KEY_PREFIX}2025-01-15`]: { rate: 2.875 }
        });
    });

    it('maps multiple currencyRates_<date> entries to their own canonical keys', () => {
        const snapshot = {
            'currencyRates_2025-01-15': { rate: 2.875 },
            'currencyRates_2025-02-20': { rate: 2.9 }
        };

        const migrated = migrateV1toV2(snapshot);

        expect(migrated).toEqual({
            [`${CURRENCY_RATE_KEY_PREFIX}2025-01-15`]: { rate: 2.875 },
            [`${CURRENCY_RATE_KEY_PREFIX}2025-02-20`]: { rate: 2.9 }
        });
    });

    it('passes through keys that are not part of the rename untouched', () => {
        const snapshot = {
            t4g_appVersion: '1.4.0',
            t4g_dataSchemaVersion: 1,
            someUnknownKey: 'value'
        };

        expect(migrateV1toV2(snapshot)).toEqual(snapshot);
    });

    it('is idempotent when run on an already-migrated (v2) snapshot', () => {
        const snapshot = {
            [STORAGE_KEYS.transactions]: [{ id: 'tx_1' }],
            [STORAGE_KEYS.users]: [{ id: 'user' }],
            [STORAGE_KEYS.themePreference]: 'dark',
            [STORAGE_KEYS.addTransaction]: false,
            [`${CURRENCY_RATE_KEY_PREFIX}2025-01-15`]: { rate: 2.875 }
        };

        expect(migrateV1toV2(snapshot)).toEqual(snapshot);
    });

    it('returns an empty object for an empty snapshot', () => {
        expect(migrateV1toV2({})).toEqual({});
    });

    it('prefers the renamed value over an incidental value already at the canonical key', () => {
        // Real-world scenario: script.js renders (via loadUsers(), which
        // auto-seeds a default user under the canonical key when it's
        // still empty) before the user dismisses the migration modal, so a
        // canonical key can already hold a throwaway value by the time
        // this migration runs. The legacy key's real data must win.
        const snapshot = {
            users: [{ id: 'user_a' }, { id: 'user_b' }],
            [STORAGE_KEYS.users]: [{ id: 'user' }] // auto-seeded default, written after 'users' already existed
        };

        expect(migrateV1toV2(snapshot)).toEqual({
            [STORAGE_KEYS.users]: [{ id: 'user_a' }, { id: 'user_b' }]
        });
    });
});

describe('runMigrations', () => {
    it('is a no-op when fromVersion equals toVersion', () => {
        const snapshot = { transactions: [{ id: 'tx_1' }] };
        expect(runMigrations(snapshot, 2, 2)).toEqual(snapshot);
    });

    it('applies the v1->v2 step when migrating from schema 1 to 2', () => {
        const snapshot = { transactions: [{ id: 'tx_1' }], users: [{ id: 'user' }] };

        const migrated = runMigrations(snapshot, 1, 2);

        expect(migrated).toEqual({
            [STORAGE_KEYS.transactions]: [{ id: 'tx_1' }],
            [STORAGE_KEYS.users]: [{ id: 'user' }]
        });
    });

    it('does not apply the v1->v2 step when already at or above schema 2', () => {
        const snapshot = { [STORAGE_KEYS.transactions]: [{ id: 'tx_1' }] };
        expect(runMigrations(snapshot, 2, 2)).toEqual(snapshot);
    });

    it('MIGRATIONS registry contains exactly the v1->v2 step today', () => {
        expect(MIGRATIONS).toHaveLength(1);
        expect(MIGRATIONS[0].from).toBe(1);
        expect(MIGRATIONS[0].to).toBe(2);
        expect(typeof MIGRATIONS[0].migrate).toBe('function');
    });
});
