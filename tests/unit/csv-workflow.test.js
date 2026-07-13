import { describe, it, expect } from 'vitest';
import {
    extractTransactionFromCSVRow,
    ensureUserExistsFromCSV,
    buildImportResult,
    buildExportCSVContent,
    buildExportFilename
} from '../../src/csv.js';

const HEADER = 'Date,User ID,User Name,Taxpayer ID,Currency Code,Currency Name,Amount,Rate,Quantity,Converted GEL,Comment,Timestamp';
const HEADER_WITH_YTD = 'Date,User ID,User Name,Taxpayer ID,Currency Code,Currency Name,Amount,Rate,Quantity,Converted GEL,YTD Income,Comment,Timestamp';

function csvRow({
    date = '2025-01-15', userId = 'user_1', userName = 'John Doe', taxpayerId = '123456',
    currencyCode = 'USD', currencyName = 'US Dollar', amount = '100', rate = '2.875',
    quantity = '1', convertedGEL = '287.5', comment = 'Test', timestamp = '1000'
} = {}) {
    return `${date},${userId},${userName},${taxpayerId},${currencyCode},${currencyName},${amount},${rate},${quantity},${convertedGEL},${comment},${timestamp}`;
}

describe('extractTransactionFromCSVRow', () => {
    it('builds a transaction from a row without YTD', () => {
        const values = csvRow().split(',');
        const tx = extractTransactionFromCSVRow(values);

        expect(tx).toMatchObject({
            userId: 'user_1',
            date: '2025-01-15',
            currencyCode: 'USD',
            currencyName: 'US Dollar',
            amount: 100,
            rate: 2.875,
            quantity: 1,
            convertedGEL: 287.5,
            comment: 'Test',
            timestamp: '1000'
        });
        expect(tx.id).toBeTruthy();
    });

    it('reads comment/timestamp from the shifted columns when YTD is present', () => {
        const values = [
            '2025-01-15', 'user_1', 'John Doe', '123456', 'USD', 'US Dollar',
            '100', '2.875', '1', '287.5', '287.5', 'Test', '1000'
        ];
        const tx = extractTransactionFromCSVRow(values);
        expect(tx.comment).toBe('Test');
        expect(tx.timestamp).toBe('1000');
    });

    it('sanitizes the comment field', () => {
        const values = csvRow({ comment: '<b>note</b>' }).split(',');
        expect(extractTransactionFromCSVRow(values).comment).toBe('&lt;b&gt;note&lt;/b&gt;');
    });
});

describe('ensureUserExistsFromCSV', () => {
    it('creates a new user when the id is unseen', () => {
        const users = [];
        const userIds = new Set();

        const result = ensureUserExistsFromCSV('user_2', 'Bob', '999', users, userIds);

        expect(result.created).toBe(true);
        expect(users).toEqual([{ id: 'user_2', name: 'Bob', taxpayerId: '999' }]);
        expect(userIds.has('user_2')).toBe(true);
    });

    it('does not duplicate an already-known user id', () => {
        const users = [{ id: 'user_1', name: 'Existing', taxpayerId: '' }];
        const userIds = new Set(['user_1']);

        const result = ensureUserExistsFromCSV('user_1', 'Different Name', '', users, userIds);

        expect(result.created).toBe(false);
        expect(users).toHaveLength(1);
        expect(users[0].name).toBe('Existing');
    });

    it('rejects a would-be user with invalid data (empty name)', () => {
        const users = [];
        const userIds = new Set();

        const result = ensureUserExistsFromCSV('user_3', '', '', users, userIds);

        expect(result.created).toBe(false);
        expect(result.error).toBeTruthy();
        expect(users).toHaveLength(0);
    });
});

describe('buildImportResult', () => {
    it('rejects a CSV with a malformed header', () => {
        const content = 'Not,The,Right,Header\n' + csvRow();
        expect(() => buildImportResult(content, [], [])).toThrow(/Invalid CSV/i);
    });

    it('imports rows and reports accurate stats', () => {
        const content = [HEADER, csvRow({ timestamp: '1000' }), csvRow({ timestamp: '2000', userId: 'user_2', userName: 'Bob' })].join('\n');

        const result = buildImportResult(content, [], []);

        expect(result.stats).toEqual({ imported: 2, skipped: 0, usersCreated: 2 });
        expect(result.transactions).toHaveLength(2);
        expect(result.users.map(u => u.id)).toEqual(['user_1', 'user_2']);
    });

    it('auto-creates missing users referenced by transactions', () => {
        const content = [HEADER, csvRow({ userId: 'user_new', userName: 'New Person' })].join('\n');
        const result = buildImportResult(content, [], []);

        expect(result.users).toContainEqual({ id: 'user_new', name: 'New Person', taxpayerId: '123456' });
        expect(result.stats.usersCreated).toBe(1);
    });

    it('does not recreate a user that already exists', () => {
        const existingUsers = [{ id: 'user_1', name: 'Existing', taxpayerId: '' }];
        const content = [HEADER, csvRow({ userId: 'user_1' })].join('\n');

        const result = buildImportResult(content, [], existingUsers);

        expect(result.stats.usersCreated).toBe(0);
        expect(result.users).toHaveLength(1);
    });

    it('skips rows whose timestamp already exists in prior transactions', () => {
        const existingTransactions = [{
            id: 'existing_tx', userId: 'user_1', date: '2025-01-01', currencyCode: 'USD',
            amount: 1, convertedGEL: 1, timestamp: '1000'
        }];
        const content = [HEADER, csvRow({ timestamp: '1000' })].join('\n');

        const result = buildImportResult(content, existingTransactions, []);

        expect(result.stats).toEqual({ imported: 0, skipped: 1, usersCreated: 0 });
        expect(result.transactions).toHaveLength(1); // only the pre-existing one
    });

    it('skips duplicate timestamps within the same import file, not just against prior data', () => {
        // Regression: the original implementation only checked timestamps
        // that existed *before* the import started, so two rows sharing a
        // timestamp within the same CSV would both be imported.
        const content = [HEADER, csvRow({ timestamp: '5000' }), csvRow({ timestamp: '5000', userId: 'user_2' })].join('\n');

        const result = buildImportResult(content, [], []);

        expect(result.stats).toEqual({ imported: 1, skipped: 1, usersCreated: 1 });
        expect(result.transactions).toHaveLength(1);
    });

    it('drops malformed rows (bad currency code) without throwing', () => {
        const content = [HEADER, csvRow({ currencyCode: 'US' })].join('\n');
        const result = buildImportResult(content, [], []);

        expect(result.stats).toEqual({ imported: 0, skipped: 0, usersCreated: 0 });
        expect(result.transactions).toHaveLength(0);
    });

    it('skips blank lines in the file', () => {
        const content = [HEADER, '', csvRow(), ''].join('\n');
        const result = buildImportResult(content, [], []);
        expect(result.stats.imported).toBe(1);
    });

    it('accepts a header/rows that include the YTD column', () => {
        const rowWithYTD = csvRow().split(',');
        rowWithYTD.splice(10, 0, '287.5'); // insert YTD column before Comment
        const content = [HEADER_WITH_YTD, rowWithYTD.join(',')].join('\n');

        const result = buildImportResult(content, [], []);
        expect(result.stats.imported).toBe(1);
        expect(result.transactions[0].comment).toBe('Test');
        expect(result.transactions[0].timestamp).toBe('1000');
    });
});

describe('export/import round trip', () => {
    it('re-importing an exported CSV reproduces the same transaction data', () => {
        const users = [{ id: 'user_1', name: 'John Doe', taxpayerId: '123456' }];
        const transactions = [{
            id: 'tx_1', userId: 'user_1', date: '2025-01-15', currencyCode: 'USD',
            currencyName: 'US Dollar', amount: 100, rate: 2.875, quantity: 1,
            convertedGEL: 287.5, comment: 'Invoice #1, paid', timestamp: '1700000000000'
        }];

        const getUserById = (id) => users.find(u => u.id === id);
        const csvContent = buildExportCSVContent(transactions, () => 287.5, getUserById);

        const result = buildImportResult(csvContent, [], users);

        expect(result.stats).toEqual({ imported: 1, skipped: 0, usersCreated: 0 });
        expect(result.transactions[0]).toMatchObject({
            userId: 'user_1',
            date: '2025-01-15',
            currencyCode: 'USD',
            currencyName: 'US Dollar',
            amount: 100,
            rate: 2.875,
            quantity: 1,
            convertedGEL: 287.5,
            comment: 'Invoice #1, paid',
            timestamp: '1700000000000'
        });
    });

    it('preserves a comment containing a comma through export and re-import', () => {
        const users = [{ id: 'user_1', name: 'John "JD" Doe', taxpayerId: '' }];
        const transactions = [{
            id: 'tx_1', userId: 'user_1', date: '2025-01-15', currencyCode: 'USD',
            currencyName: 'US Dollar', amount: 100, rate: 2.875, quantity: 1,
            convertedGEL: 287.5, comment: 'Contract #123, final payment', timestamp: '999'
        }];

        const csvContent = buildExportCSVContent(transactions, () => 287.5, (id) => users.find(u => u.id === id));
        const result = buildImportResult(csvContent, [], []);

        expect(result.transactions[0].comment).toBe('Contract #123, final payment');
        expect(result.users[0].name).toBe('John "JD" Doe');
    });
});

describe('buildExportFilename', () => {
    const getUserById = (id) => ({ user_1: { id: 'user_1', name: 'John Doe' } }[id]);

    it('uses "all" when no user filter is active', () => {
        expect(buildExportFilename({ userId: 'all' }, getUserById, '2025-06-01'))
            .toBe('gel-transactions-all-2025-06-01.csv');
    });

    it('uses the sanitized user name when filtered by user', () => {
        expect(buildExportFilename({ userId: 'user_1' }, getUserById, '2025-06-01'))
            .toBe('gel-transactions-John_Doe-2025-06-01.csv');
    });

    it('falls back to "user" if the filtered user no longer exists', () => {
        expect(buildExportFilename({ userId: 'user_missing' }, getUserById, '2025-06-01'))
            .toBe('gel-transactions-user-2025-06-01.csv');
    });
});
