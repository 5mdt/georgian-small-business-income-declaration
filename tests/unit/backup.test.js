import { describe, it, expect } from 'vitest';
import { buildBackupJSON, parseBackupJSON, mergeBackupData, selectBackupKeys } from '../../src/backup.js';
import { ERROR_MESSAGES } from '../../src/utils.js';

describe('buildBackupJSON', () => {
    it('wraps the snapshot in an envelope with the injected schema version', () => {
        const snapshot = { users: [{ id: 'u1', name: 'John' }], transactions: [] };
        const json = buildBackupJSON(snapshot, 2, 'https://example.com/');
        const parsed = JSON.parse(json);

        expect(parsed.app).toBe('Currency to GEL Converter');
        expect(parsed.dataSchemaVersion).toBe(2);
        expect(parsed.instanceUrl).toBe('https://example.com/');
        expect(parsed.exportedAt).toEqual(expect.any(String));
        expect(parsed.data).toEqual(snapshot);
    });

    it('omits instanceUrl when not provided', () => {
        const json = buildBackupJSON({}, 1);
        const parsed = JSON.parse(json);

        expect(parsed).not.toHaveProperty('instanceUrl');
    });

    it('tags the export with the injected schema version, not a hardcoded one', () => {
        const json = buildBackupJSON({}, 0);
        expect(JSON.parse(json).dataSchemaVersion).toBe(0);
    });
});

describe('parseBackupJSON', () => {
    it('round-trips a snapshot built by buildBackupJSON', () => {
        const snapshot = { users: [{ id: 'u1', name: 'John' }], transactions: [{ id: 't1' }] };
        const json = buildBackupJSON(snapshot, 1, 'https://example.com/');

        const { data, meta } = parseBackupJSON(json);

        expect(data).toEqual(snapshot);
        expect(meta.dataSchemaVersion).toBe(1);
        expect(meta.instanceUrl).toBe('https://example.com/');
        expect(meta).not.toHaveProperty('data');
    });

    it('throws INVALID_BACKUP on malformed JSON', () => {
        expect(() => parseBackupJSON('not valid json{')).toThrow(ERROR_MESSAGES.INVALID_BACKUP);
    });

    it('throws INVALID_BACKUP when the JSON has no data object', () => {
        expect(() => parseBackupJSON(JSON.stringify({ app: 'Something' }))).toThrow(ERROR_MESSAGES.INVALID_BACKUP);
    });

    it('throws INVALID_BACKUP for a non-object JSON value', () => {
        expect(() => parseBackupJSON(JSON.stringify('just a string'))).toThrow(ERROR_MESSAGES.INVALID_BACKUP);
        expect(() => parseBackupJSON(JSON.stringify(null))).toThrow(ERROR_MESSAGES.INVALID_BACKUP);
    });
});

describe('mergeBackupData', () => {
    it('adds new users and transactions that are not already present', () => {
        const existingUsers = [{ id: 'user_1', name: 'Existing' }];
        const existingTransactions = [{
            id: 'tx_1', userId: 'user_1', date: '2025-01-01', currencyCode: 'USD',
            amount: 1, convertedGEL: 1, timestamp: '1000'
        }];

        const backupData = {
            users: [{ id: 'user_1', name: 'Existing' }, { id: 'user_2', name: 'New' }],
            transactions: [
                { id: 'tx_1', userId: 'user_1', date: '2025-01-01', currencyCode: 'USD', amount: 1, convertedGEL: 1, timestamp: '1000' },
                { id: 'tx_2', userId: 'user_2', date: '2025-01-02', currencyCode: 'USD', amount: 2, convertedGEL: 2, timestamp: '2000' }
            ]
        };

        const result = mergeBackupData(existingUsers, existingTransactions, backupData);

        expect(result.users.map(u => u.id)).toEqual(['user_1', 'user_2']);
        expect(result.transactions.map(t => t.id)).toEqual(['tx_1', 'tx_2']);
    });

    it('does not duplicate a user already present by id', () => {
        const existingUsers = [{ id: 'user_1', name: 'Existing' }];
        const backupData = { users: [{ id: 'user_1', name: 'Different Name' }], transactions: [] };

        const result = mergeBackupData(existingUsers, [], backupData);

        expect(result.users).toHaveLength(1);
        expect(result.users[0].name).toBe('Existing');
    });

    it('does not duplicate a transaction already present by timestamp', () => {
        const existingTransactions = [{
            id: 'tx_1', userId: 'user_1', date: '2025-01-01', currencyCode: 'USD',
            amount: 1, convertedGEL: 1, timestamp: '1000'
        }];
        const backupData = {
            users: [],
            transactions: [{ id: 'tx_2', userId: 'user_1', date: '2025-01-01', currencyCode: 'USD', amount: 5, convertedGEL: 5, timestamp: '1000' }]
        };

        const result = mergeBackupData([], existingTransactions, backupData);

        expect(result.transactions).toHaveLength(1);
        expect(result.transactions[0].id).toBe('tx_1');
    });

    it('ignores invalid users/transactions in the backup data', () => {
        const backupData = { users: [{ id: '', name: '' }], transactions: [{ id: 'bad' }] };
        const result = mergeBackupData([], [], backupData);

        expect(result.users).toEqual([]);
        expect(result.transactions).toEqual([]);
    });

    it('handles a backup with no users or transactions arrays', () => {
        const result = mergeBackupData([{ id: 'u1', name: 'A' }], [], {});
        expect(result.users).toEqual([{ id: 'u1', name: 'A' }]);
        expect(result.transactions).toEqual([]);
    });
});

describe('selectBackupKeys', () => {
    const allKeys = ['users', 'transactions', 'themePreference', 'addTransaction', 't4g_appVersion', 't4g_dataSchemaVersion', 'currencyRates_2025-01-15'];

    it('schema version 1: keeps users/transactions and every t4g_ key, drops settings and rate cache', () => {
        expect(selectBackupKeys(allKeys, 1).sort()).toEqual(
            ['t4g_appVersion', 't4g_dataSchemaVersion', 'transactions', 'users'].sort()
        );
    });

    it('schema version 0: keeps only t4g_ keys (not treated as legacy)', () => {
        expect(selectBackupKeys(allKeys, 0).sort()).toEqual(['t4g_appVersion', 't4g_dataSchemaVersion'].sort());
    });

    it('schema version 2 (a future bump): keeps only t4g_ keys', () => {
        expect(selectBackupKeys(allKeys, 2).sort()).toEqual(['t4g_appVersion', 't4g_dataSchemaVersion'].sort());
    });

    it('returns an empty array when there are no t4g_ keys and the version is not 1', () => {
        expect(selectBackupKeys(['users', 'transactions', 'themePreference'], 3)).toEqual([]);
    });

    it('returns an empty array for an empty key list regardless of version', () => {
        expect(selectBackupKeys([], 1)).toEqual([]);
        expect(selectBackupKeys([], 2)).toEqual([]);
    });
});
