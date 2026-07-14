import { describe, it, expect } from 'vitest';
import {
    extractTransactionFromCSVRow,
    ensureUserExistsFromCSV,
    buildImportResult,
    buildExportCSVContent,
    buildExportFilename,
    buildUsersCSVContent,
    buildUsersImportResult,
    detectCSVKind
} from '../../src/csv.js';
import { DATA_SCHEMA_VERSION } from '../../src/version.js';

const USERS_HEADER = 'User ID,User Name,Taxpayer ID';

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

    describe('overwrite', () => {
        const existingUsers = [{ id: 'user_old', name: 'Old User', taxpayerId: '' }];
        const existingTransactions = [{
            id: 'existing_tx', userId: 'user_old', date: '2025-01-01', currencyCode: 'USD',
            amount: 1, convertedGEL: 1, timestamp: '1'
        }];

        it('ignores existing data entirely and builds the result purely from the file', () => {
            const content = [HEADER, csvRow({ timestamp: '9999' })].join('\n');
            const result = buildImportResult(content, existingTransactions, existingUsers, true);

            expect(result.transactions).toHaveLength(1);
            expect(result.transactions[0].timestamp).toBe('9999');
            expect(result.users.map(u => u.id)).toEqual(['user_1']);
        });

        it('defaults to merge (overwrite=false) when the argument is omitted', () => {
            const content = [HEADER, csvRow({ timestamp: '9999' })].join('\n');
            const result = buildImportResult(content, existingTransactions, existingUsers);

            expect(result.transactions.map(t => t.id)).toContain('existing_tx');
            expect(result.users.map(u => u.id)).toContain('user_old');
        });

        it('still dedups within the same file when overwriting', () => {
            const content = [HEADER, csvRow({ timestamp: '5000' }), csvRow({ timestamp: '5000', userId: 'user_2' })].join('\n');
            const result = buildImportResult(content, existingTransactions, existingUsers, true);

            expect(result.stats).toEqual({ imported: 1, skipped: 1, usersCreated: 1 });
        });
    });
});

describe('buildUsersCSVContent', () => {
    it('builds a header + one row per user, ending with the shared comment tail', () => {
        const users = [{ id: 'user_1', name: 'John "JD" Doe', taxpayerId: '123456' }];
        const csvContent = buildUsersCSVContent(users, DATA_SCHEMA_VERSION, 'https://example.com/');

        const lines = csvContent.trim().split('\n');
        expect(lines[0]).toBe('User ID,User Name,Taxpayer ID');
        expect(lines[1]).toBe('user_1,"John ""JD"" Doe","123456"');
        expect(lines.slice(2)).toEqual([
            '# Currency to GEL Converter - CSV export',
            '# https://github.com/5mdt/georgian-small-business-income-declaration',
            '# Instance: https://example.com/',
            `# Data schema version: ${DATA_SCHEMA_VERSION}`
        ]);
    });

    it('tags the export with the injected schema version', () => {
        const csvContent = buildUsersCSVContent([], 0);
        expect(csvContent).toContain('# Data schema version: 0');
    });
});

describe('buildUsersImportResult', () => {
    it('rejects a CSV with a malformed header', () => {
        const content = 'Not,The,Right,Header\nuser_1,John,123456';
        expect(() => buildUsersImportResult(content, [])).toThrow(/Invalid CSV/i);
    });

    it('merges new users by default, adding missing ones', () => {
        const content = [USERS_HEADER, 'user_2,Bob,999'].join('\n');
        const result = buildUsersImportResult(content, [{ id: 'user_1', name: 'John', taxpayerId: '' }]);

        expect(result.stats).toEqual({ imported: 1, skipped: 0 });
        expect(result.users.map(u => u.id)).toEqual(['user_1', 'user_2']);
    });

    it('skips a row whose id already exists when not overwriting', () => {
        const content = [USERS_HEADER, 'user_1,Different Name,000'].join('\n');
        const result = buildUsersImportResult(content, [{ id: 'user_1', name: 'John', taxpayerId: '' }]);

        expect(result.stats).toEqual({ imported: 0, skipped: 1 });
        expect(result.users[0].name).toBe('John');
    });

    it('ignores existing users entirely when overwrite is true', () => {
        const content = [USERS_HEADER, 'user_2,Bob,999'].join('\n');
        const result = buildUsersImportResult(content, [{ id: 'user_1', name: 'John', taxpayerId: '' }], true);

        expect(result.users).toEqual([{ id: 'user_2', name: 'Bob', taxpayerId: '999' }]);
    });

    it('drops rows with invalid user data (empty id)', () => {
        const content = [USERS_HEADER, ',No Id,123'].join('\n');
        const result = buildUsersImportResult(content, []);

        expect(result.stats).toEqual({ imported: 0, skipped: 0 });
        expect(result.users).toEqual([]);
    });

    it('skips blank lines', () => {
        const content = [USERS_HEADER, '', 'user_1,John,123', ''].join('\n');
        const result = buildUsersImportResult(content, []);

        expect(result.stats.imported).toBe(1);
    });

    it('silently ignores the trailing comment tail lines from a users export', () => {
        const csvContent = buildUsersCSVContent([{ id: 'user_1', name: 'John', taxpayerId: '123' }], DATA_SCHEMA_VERSION, 'https://example.com/');
        const result = buildUsersImportResult(csvContent, []);

        expect(result.stats).toEqual({ imported: 1, skipped: 0 });
    });
});

describe('detectCSVKind', () => {
    it('detects a transactions header', () => {
        expect(detectCSVKind(HEADER)).toBe('transactions');
        expect(detectCSVKind(HEADER_WITH_YTD)).toBe('transactions');
    });

    it('detects a users header', () => {
        expect(detectCSVKind(USERS_HEADER)).toBe('users');
    });

    it('returns null for an unrecognized header', () => {
        expect(detectCSVKind('Foo,Bar,Baz')).toBeNull();
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
        const csvContent = buildExportCSVContent(transactions, () => 287.5, getUserById, DATA_SCHEMA_VERSION);

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

        const csvContent = buildExportCSVContent(transactions, () => 287.5, (id) => users.find(u => u.id === id), DATA_SCHEMA_VERSION);
        const result = buildImportResult(csvContent, [], []);

        expect(result.transactions[0].comment).toBe('Contract #123, final payment');
        expect(result.users[0].name).toBe('John "JD" Doe');
    });

    it('ends the export with info/schema-version comments that re-import silently ignores', () => {
        const users = [{ id: 'user_1', name: 'John Doe', taxpayerId: '123456' }];
        const transactions = [{
            id: 'tx_1', userId: 'user_1', date: '2025-01-15', currencyCode: 'USD',
            currencyName: 'US Dollar', amount: 100, rate: 2.875, quantity: 1,
            convertedGEL: 287.5, comment: 'Test', timestamp: '1000'
        }];

        const csvContent = buildExportCSVContent(
            transactions, () => 287.5, (id) => users.find(u => u.id === id),
            DATA_SCHEMA_VERSION, 'https://example.com/gel-converter/'
        );
        const trailingLines = csvContent.trim().split('\n').slice(2); // drop header + data row
        expect(trailingLines).toEqual([
            '# Currency to GEL Converter - CSV export',
            '# https://github.com/5mdt/georgian-small-business-income-declaration',
            '# Instance: https://example.com/gel-converter/',
            `# Data schema version: ${DATA_SCHEMA_VERSION}`
        ]);

        const result = buildImportResult(csvContent, [], users);
        expect(result.stats).toEqual({ imported: 1, skipped: 0, usersCreated: 0 });
    });

    it('omits the instance line when no instance URL is provided', () => {
        const transactions = [];
        const csvContent = buildExportCSVContent(transactions, () => 0, () => undefined, DATA_SCHEMA_VERSION);

        expect(csvContent).not.toContain('# Instance:');
        expect(csvContent).toContain(`# Data schema version: ${DATA_SCHEMA_VERSION}`);
    });

    it('tags the export with the injected schema version, not the code constant', () => {
        const transactions = [];
        const csvContent = buildExportCSVContent(transactions, () => 0, () => undefined, 0);

        expect(csvContent).toContain('# Data schema version: 0');
        expect(csvContent).not.toContain(`# Data schema version: ${DATA_SCHEMA_VERSION}`);
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
