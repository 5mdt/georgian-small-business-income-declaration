import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_VERSION, DATA_SCHEMA_VERSION } from '../../src/version.js';
import { STORAGE_KEYS, CURRENCY_RATE_KEY_PREFIX } from '../../src/keys.js';

// DOM-integration tests: load the *real* index.html markup into jsdom and
// import the real script.js against it, driving the app the way a user
// would (fill inputs, click buttons, read rendered tables) instead of
// calling internal functions directly. This is what actually exercises the
// feature layer (script.js) that the unit tests around src/*.js cannot
// reach, since that logic is deliberately DOM-free.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtmlPath = path.resolve(__dirname, '../../index.html');
const fullHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
const bodyMatch = fullHtml.match(/<body>([\s\S]*)<\/body>/);
if (!bodyMatch) {
    throw new Error('Could not find <body> in index.html - fixture is out of sync with the app');
}
// Drop the <script type="module" src="script.js"> tag - we import script.js
// ourselves so we can control timing and inject a fake fetch first.
const bodyHTML = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '');

const sampleNbgResponse = [{
    date: '2025-01-15T00:00:00',
    currencies: [
        { code: 'USD', name: 'US Dollar', rate: 2.875, quantity: 1, rateFormated: '2.8750' },
        { code: 'EUR', name: 'Euro', rate: 3.1, quantity: 1, rateFormated: '3.1000' }
    ]
}];

function flushPromises() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

function fillConversionForm({ date = '2025-01-15', currency = 'USD', amount = '100', addAsTransaction = false, userId } = {}) {
    document.getElementById('datePicker').value = date;
    document.getElementById('currencySelect').value = currency;
    document.getElementById('amountInput').value = amount;
    document.getElementById('addTransactionCheckbox').checked = addAsTransaction;
    if (userId) {
        document.getElementById('userSelect').value = userId;
    }
}

async function clickConvert() {
    document.getElementById('fetchButton').dispatchEvent(new window.Event('click'));
    await flushPromises();
}

describe('App integration (real index.html + script.js)', () => {
    beforeAll(async () => {
        document.body.innerHTML = bodyHTML;

        global.alert = vi.fn();
        global.confirm = vi.fn(() => true);
        global.prompt = vi.fn(() => 'New User');
        global.fetch = vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(sampleNbgResponse)
        }));

        await import('../../script.js');
        window.onload();
        await flushPromises();
    });

    beforeEach(() => {
        global.alert.mockClear();
        global.confirm.mockClear();
        global.confirm.mockReturnValue(true);
        global.prompt.mockClear();
    });

    // script.js's filterState is shared module-level mutable state across
    // every test in this file (there's only one import). Reset it after
    // every test so a failing assertion mid-test can't leave a stale
    // filter (e.g. currencyCode: '') that silently breaks later tests.
    afterEach(() => {
        window.clearFilters();
    });

    describe('bootstrap', () => {
        it('populates the currency dropdown from the (mocked) NBG response, with GEL first', () => {
            const options = Array.from(document.getElementById('currencySelect').options).map(o => o.value);
            expect(options[0]).toBe(''); // "Select a currency" placeholder... actually GEL is added right after
            expect(options).toContain('GEL');
            expect(options).toContain('USD');
            expect(options).toContain('EUR');
        });

        it('shows "no transactions" when storage is empty', () => {
            window.toggleSort('date'); // any exposed action re-renders the transaction list
            window.toggleSort('date'); // toggle back to not disturb sort state
            expect(document.getElementById('transactionList').textContent).toMatch(/No transactions recorded yet/i);
        });

        it('seeds and renders the default "user" account', () => {
            // renderUserList puts the name in an <input value="..."> - not
            // part of textContent - so check the input's value directly.
            const nameInputs = document.querySelectorAll('#userList input.input-inline');
            const names = Array.from(nameInputs).map(i => i.value);
            expect(names).toContain('user');
        });
    });

    describe('currency conversion', () => {
        it('displays a converted amount without adding a transaction when the checkbox is unchecked', async () => {
            fillConversionForm({ amount: '100', addAsTransaction: false });
            await clickConvert();

            const resultText = document.getElementById('result').textContent;
            expect(resultText).toContain('287.50');
            expect(resultText).not.toMatch(/Transaction Added/i);
        });

        it('adds a transaction and renders it in the transaction table when the checkbox is checked', async () => {
            fillConversionForm({ amount: '100', addAsTransaction: true });
            await clickConvert();

            const resultText = document.getElementById('result').textContent;
            expect(resultText).toMatch(/Transaction Added/i);

            const tableText = document.getElementById('transactionList').textContent;
            expect(tableText).toContain('USD');
            expect(tableText).toContain('287.50');
        });

        it('shows a validation error when amount is missing', async () => {
            fillConversionForm({ amount: '' });
            await clickConvert();

            expect(document.getElementById('errorMessage').textContent).toMatch(/valid amount/i);
        });

        it('treats GEL as a 1:1 passthrough with no exchange rate fetch details shown', async () => {
            fillConversionForm({ currency: 'GEL', amount: '50' });
            await clickConvert();

            expect(document.getElementById('result').textContent).toContain('50.00 GEL');
        });
    });

    describe('transaction list rendering + actions', () => {
        it('HTML-escapes a malicious comment instead of injecting it', async () => {
            fillConversionForm({ amount: '10', addAsTransaction: true });
            await clickConvert();

            const commentInput = document.querySelector('#transactionList input.input-inline');
            expect(commentInput).toBeTruthy();

            const transactions = JSON.parse(global.localStorage.getItem(STORAGE_KEYS.transactions));
            const txId = transactions[transactions.length - 1].id;

            window.updateTransactionComment(txId, '<img src=x onerror=alert(1)>');

            const updatedInputValue = document.getElementById(`comment-${txId}`).value;
            expect(updatedInputValue).not.toContain('<img');

            const storedComment = JSON.parse(global.localStorage.getItem(STORAGE_KEYS.transactions))
                .find(t => t.id === txId).comment;
            expect(storedComment).toBe('&lt;img src=x onerror=alert(1)&gt;');
        });

        it('removes a transaction from the table when deleted', async () => {
            fillConversionForm({ amount: '10', addAsTransaction: true });
            await clickConvert();

            const transactions = JSON.parse(global.localStorage.getItem(STORAGE_KEYS.transactions));
            const txId = transactions[transactions.length - 1].id;

            window.deleteTransaction(txId);

            const remaining = JSON.parse(global.localStorage.getItem(STORAGE_KEYS.transactions));
            expect(remaining.find(t => t.id === txId)).toBeUndefined();
        });

        it('asks for confirmation before clearing all transactions, and honors "cancel"', async () => {
            fillConversionForm({ amount: '10', addAsTransaction: true });
            await clickConvert();

            global.confirm.mockReturnValue(false);
            window.clearAllTransactions();

            expect(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.transactions)).length).toBeGreaterThan(0);
        });

        it('clears all transactions on confirmation', async () => {
            fillConversionForm({ amount: '10', addAsTransaction: true });
            await clickConvert();

            global.confirm.mockReturnValue(true);
            window.clearAllTransactions();

            expect(document.getElementById('transactionList').textContent).toMatch(/No transactions recorded yet/i);
        });
    });

    describe('sorting', () => {
        beforeEach(async () => {
            await clickConvertFor('50', '2025-01-01');
            await clickConvertFor('200', '2025-03-01');
        });

        async function clickConvertFor(amount, date) {
            fillConversionForm({ amount, addAsTransaction: true, date });
            await clickConvert();
        }

        it('sorts newest-first by default (date desc)', () => {
            const dates = Array.from(document.querySelectorAll('#transactionList tbody tr td:first-child'))
                .map(td => td.textContent);
            expect(dates[0]).toBe('2025-03-01');
        });

        it('toggles to oldest-first when the Date header is clicked twice', () => {
            window.toggleSort('date'); // still 'date' column -> flips asc/desc from current 'desc' -> asc
            const dates = Array.from(document.querySelectorAll('#transactionList tbody tr td:first-child'))
                .map(td => td.textContent);
            expect(dates[0]).toBe('2025-01-01');
        });
    });

    describe('filters', () => {
        it('filters the visible list by currency', async () => {
            fillConversionForm({ amount: '10', currency: 'USD', addAsTransaction: true });
            await clickConvert();
            fillConversionForm({ amount: '10', currency: 'EUR', addAsTransaction: true });
            await clickConvert();

            document.getElementById('filterCurrency').value = 'EUR';
            document.getElementById('filterCurrency').dispatchEvent(new window.Event('change'));

            const statusText = document.querySelector('#transactionList .filter-status').textContent;
            expect(statusText).toMatch(/Showing 1 of 2/);
        });
    });

    describe('user management', () => {
        it('refuses to delete the default user with only one account', () => {
            window.deleteUser('user');
            expect(global.alert).toHaveBeenCalledWith(expect.stringMatching(/default user/i));
        });

        it('creates a new user via addNewUser and lists it', () => {
            global.prompt
                .mockReturnValueOnce('Alice') // name
                .mockReturnValueOnce('999'); // taxpayer id

            window.addNewUser();

            const names = Array.from(document.querySelectorAll('#userList input.input-inline'))
                .map(i => i.value);
            expect(names).toContain('Alice');
        });

        it('cascades transaction deletion when a user with transactions is removed', async () => {
            global.prompt.mockReturnValueOnce('Bob').mockReturnValueOnce('');
            window.addNewUser();

            const users = JSON.parse(global.localStorage.getItem(STORAGE_KEYS.users));
            const bob = users.find(u => u.name === 'Bob');

            fillConversionForm({ amount: '10', addAsTransaction: true, userId: bob.id });
            await clickConvert();

            expect(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.transactions)).some(t => t.userId === bob.id)).toBe(true);

            global.confirm.mockReturnValue(true); // confirm cascading delete
            window.deleteUser(bob.id);

            expect(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.users)).some(u => u.id === bob.id)).toBe(false);
            expect(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.transactions)).some(t => t.userId === bob.id)).toBe(false);
        });
    });

    describe('theme toggle', () => {
        it('cycles system -> light -> dark -> system and updates the DOM', () => {
            const html = document.documentElement;

            html.removeAttribute('data-theme');
            window.toggleTheme();
            expect(html.getAttribute('data-theme')).toBe('light');

            window.toggleTheme();
            expect(html.getAttribute('data-theme')).toBe('dark');

            window.toggleTheme();
            expect(html.hasAttribute('data-theme')).toBe(false); // back to 'system'
        });
    });

    describe('collapsible sections', () => {
        it('toggles the disclaimer section collapsed state', () => {
            const content = document.getElementById('disclaimer-content');
            const wasCollapsed = content.classList.contains('collapsed');

            window.toggleCollapsible('disclaimer');
            expect(content.classList.contains('collapsed')).toBe(!wasCollapsed);

            window.toggleCollapsible('disclaimer'); // restore
        });
    });

    describe('CSV import', () => {
        it('imports transactions from a CSV file and refreshes the UI', async () => {
            const csv = [
                'Date,User ID,User Name,Taxpayer ID,Currency Code,Currency Name,Amount,Rate,Quantity,Converted GEL,Comment,Timestamp',
                '2025-05-01,user,user,,USD,US Dollar,100,2.875,1,287.5,Imported row,999999'
            ].join('\n');

            const file = new File([csv], 'import.csv', { type: 'text/csv' });
            window.importFromCSV(file);

            // FileReader.onload fires asynchronously even in jsdom
            await flushPromises();
            await flushPromises();

            const statusText = document.querySelector('#transactionList .filter-status').textContent;
            expect(statusText).toMatch(/Showing 1 of 1/);

            const commentValues = Array.from(document.querySelectorAll('#transactionList input.input-inline'))
                .map(i => i.value);
            expect(commentValues).toContain('Imported row');
            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Imported: 1'));
        });
    });

    describe('CSV export', () => {
        // jsdom doesn't implement URL.createObjectURL - stub it so
        // exportToCSV's Blob/download plumbing doesn't throw, and capture
        // the Blob it builds so we can assert on the actual CSV content.
        it('builds a CSV blob containing the exported transaction data', async () => {
            let capturedBlob;
            global.URL.createObjectURL = vi.fn((blob) => {
                capturedBlob = blob;
                return 'blob:mock-url';
            });
            global.URL.revokeObjectURL = vi.fn();

            fillConversionForm({ amount: '10', currency: 'USD', addAsTransaction: true });
            await clickConvert();

            window.exportToCSV();

            expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
            // jsdom's Blob has no .text() method - read it via FileReader instead.
            const csvText = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsText(capturedBlob);
            });
            expect(csvText).toContain('Converted GEL');
            expect(csvText).toContain('USD');
            expect(csvText).toContain('28.75'); // 10 USD * 2.875
        });

        it('alerts instead of exporting when there are no transactions', () => {
            window.exportToCSV();
            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('No transactions to export'));
        });

        it('alerts when the current filters exclude every transaction', async () => {
            fillConversionForm({ amount: '10', currency: 'USD', addAsTransaction: true });
            await clickConvert();

            document.getElementById('filterUser').value = 'nonexistent-user';
            document.getElementById('filterUser').dispatchEvent(new window.Event('change'));

            window.exportToCSV();

            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('No transactions to export with current filters'));
        });
    });


    describe('update notification', () => {
        const isModalHidden = () => document.getElementById('updateModal').classList.contains('hidden');

        // Simulate a fresh page load: the modal starts hidden in index.html,
        // but checkForAppUpdate() only ever shows it, never re-hides it.
        beforeEach(() => {
            document.getElementById('updateModal').classList.add('hidden');
        });

        it('stores the current version without showing the modal on first visit', () => {
            global.localStorage.removeItem('t4g_appVersion');

            window.checkForAppUpdate();

            expect(isModalHidden()).toBe(true);
            expect(JSON.parse(global.localStorage.getItem('t4g_appVersion'))).toBe(APP_VERSION);
        });

        it('shows the modal when the stored version is older than the current version', () => {
            global.localStorage.setItem('t4g_appVersion', JSON.stringify('0.0.1'));

            window.checkForAppUpdate();

            expect(isModalHidden()).toBe(false);
            expect(document.getElementById('updateModalVersion').textContent).toBe(APP_VERSION);
        });

        it('does not show the modal when the stored version is current or newer', () => {
            global.localStorage.setItem('t4g_appVersion', JSON.stringify(APP_VERSION));

            window.checkForAppUpdate();

            expect(isModalHidden()).toBe(true);
        });

        it('hides the modal and persists the current version only once "Got it" is clicked', () => {
            global.localStorage.setItem('t4g_appVersion', JSON.stringify('0.0.1'));
            window.checkForAppUpdate();
            expect(isModalHidden()).toBe(false);

            window.dismissUpdateModal();

            expect(isModalHidden()).toBe(true);
            expect(JSON.parse(global.localStorage.getItem('t4g_appVersion'))).toBe(APP_VERSION);
        });
    });

    describe('data schema migration', () => {
        const isModalHidden = () => document.getElementById('migrationModal').classList.contains('hidden');

        // Simulate a fresh page load: the modal starts hidden in index.html,
        // but checkForSchemaMigration() only ever shows it, never re-hides it.
        beforeEach(() => {
            document.getElementById('migrationModal').classList.add('hidden');
        });

        it('persists the current schema version without a modal on a fresh install (no legacy keys)', () => {
            global.localStorage.removeItem('t4g_dataSchemaVersion');
            // No raw (unprefixed) legacy key is present - the app only ever
            // writes canonical t4g_-prefixed keys - so this is the "nothing
            // to migrate from" baseline.

            window.checkForSchemaMigration();

            expect(isModalHidden()).toBe(true);
            expect(JSON.parse(global.localStorage.getItem('t4g_dataSchemaVersion'))).toBe(DATA_SCHEMA_VERSION);
        });

        it('treats a missing key with existing legacy transactions as schema 1 and shows the migration modal', () => {
            global.localStorage.removeItem('t4g_dataSchemaVersion');
            // Raw 'transactions' simulates data written by pre-T4G-0021 code
            // - detectBaselineSchemaVersion() (script.js) can't rely on
            // loadTransactions() here since that reads the canonical
            // t4g_data_transactions key, which is empty for this data.
            global.localStorage.setItem('transactions', JSON.stringify([{
                id: 't1', userId: 'user', date: '2025-01-15', currencyCode: 'USD',
                currencyName: 'US Dollar', amount: 10, rate: 2.875, quantity: 1,
                convertedGEL: 28.75, comment: '', timestamp: Date.now()
            }]));

            window.checkForSchemaMigration();

            // Baseline resolves to schema 1, below the current
            // DATA_SCHEMA_VERSION (2), so the migration modal appears and
            // nothing is stamped until it's dismissed.
            expect(isModalHidden()).toBe(false);
            expect(global.localStorage.getItem('t4g_dataSchemaVersion')).toBeNull();

            global.localStorage.removeItem('transactions');
        });

        it('shows the modal when the stored schema version is older than current', () => {
            global.localStorage.setItem('t4g_dataSchemaVersion', JSON.stringify(0));

            window.checkForSchemaMigration();

            expect(isModalHidden()).toBe(false);
        });

        it('requires confirmation to continue without downloading a backup, and honors cancel', () => {
            global.localStorage.setItem('t4g_dataSchemaVersion', JSON.stringify(0));
            window.checkForSchemaMigration();
            expect(isModalHidden()).toBe(false);

            global.confirm.mockReturnValueOnce(false);
            window.dismissMigrationModal();
            expect(global.confirm).toHaveBeenCalledTimes(1);
            expect(isModalHidden()).toBe(false); // cancel keeps it open

            window.dismissMigrationModal(); // default mock: confirm() -> true
            expect(isModalHidden()).toBe(true);
            expect(JSON.parse(global.localStorage.getItem('t4g_dataSchemaVersion'))).toBe(DATA_SCHEMA_VERSION);
        });

        it('downloading a backup skips the confirmation, tagged with the mismatched schema version', async () => {
            fillConversionForm({ amount: '10', currency: 'USD', addAsTransaction: true });
            await clickConvert();

            global.localStorage.setItem('t4g_dataSchemaVersion', JSON.stringify(0));
            window.checkForSchemaMigration();
            expect(isModalHidden()).toBe(false);

            window.openExportModal();
            expect(document.getElementById('exportModal').classList.contains('hidden')).toBe(false);

            let capturedBlob;
            global.URL.createObjectURL = vi.fn((blob) => {
                capturedBlob = blob;
                return 'blob:mock-url';
            });
            global.URL.revokeObjectURL = vi.fn();

            window.exportBackupJSON();
            expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);

            const jsonText = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsText(capturedBlob);
            });
            const backup = JSON.parse(jsonText);
            // Schema 0 isn't the legacy (===1) scope, so the backup is
            // t4g_*-only here - see selectBackupKeys (src/backup.js).
            expect(backup.dataSchemaVersion).toBe(0);
            expect(backup.data).not.toHaveProperty('transactions');

            window.dismissMigrationModal();

            expect(global.confirm).not.toHaveBeenCalled();
            expect(isModalHidden()).toBe(true);
        });

        it('shows the update modal before the migration modal when both are pending', () => {
            document.getElementById('updateModal').classList.add('hidden');
            global.localStorage.setItem('t4g_appVersion', JSON.stringify('0.0.1'));
            global.localStorage.setItem('t4g_dataSchemaVersion', JSON.stringify(0));

            window.checkForAppUpdate();

            expect(document.getElementById('updateModal').classList.contains('hidden')).toBe(false);
            expect(isModalHidden()).toBe(true); // migration modal not shown yet

            window.dismissUpdateModal();

            expect(document.getElementById('updateModal').classList.contains('hidden')).toBe(true);
            expect(isModalHidden()).toBe(false); // now the migration modal appears
        });
    });

    describe('Backup & Restore modals', () => {
        async function readBlobAsText(capturedBlob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsText(capturedBlob);
            });
        }

        function stubDownload() {
            let capturedBlob;
            global.URL.createObjectURL = vi.fn((blob) => {
                capturedBlob = blob;
                return 'blob:mock-url';
            });
            global.URL.revokeObjectURL = vi.fn();
            return () => capturedBlob;
        }

        beforeEach(() => {
            document.getElementById('importOverwriteCheckbox').checked = false;
            document.getElementById('exportModal').classList.add('hidden');
            document.getElementById('importModal').classList.add('hidden');
        });

        it('opens and closes the export modal', () => {
            const modal = document.getElementById('exportModal');
            expect(modal.classList.contains('hidden')).toBe(true);

            window.openExportModal();
            expect(modal.classList.contains('hidden')).toBe(false);

            window.closeExportModal();
            expect(modal.classList.contains('hidden')).toBe(true);
        });

        it('opens the import modal with the overwrite checkbox reset and the warning hidden', () => {
            document.getElementById('importOverwriteCheckbox').checked = true;
            document.getElementById('importOverwriteWarning').classList.remove('hidden');

            window.openImportModal();

            expect(document.getElementById('importModal').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('importOverwriteCheckbox').checked).toBe(false);
            expect(document.getElementById('importOverwriteWarning').classList.contains('hidden')).toBe(true);

            window.closeImportModal();
            expect(document.getElementById('importModal').classList.contains('hidden')).toBe(true);
        });

        function stageFile(file) {
            const input = document.getElementById('importFileInput');
            // jsdom can't construct a real FileList; override the property
            // for the test the same way real browsers populate it on a
            // user's file-picker selection.
            Object.defineProperty(input, 'files', { value: [file], configurable: true });
            window.onImportFileChosen();
        }

        it('choosing a file only stages it - Start Import stays disabled until a file is picked, then enables without importing', () => {
            const startButton = document.getElementById('startImportButton');
            expect(startButton.disabled).toBe(true);

            const file = new File(['User ID,User Name,Taxpayer ID\nuser_x,X,1'], 'users.csv', { type: 'text/csv' });
            stageFile(file);

            expect(startButton.disabled).toBe(false);
            const nameLabel = document.getElementById('importSelectedFileName');
            expect(nameLabel.classList.contains('hidden')).toBe(false);
            expect(nameLabel.textContent).toContain('users.csv');
            expect(global.alert).not.toHaveBeenCalled(); // nothing imported yet
        });

        it('startImport reads the staged file and runs the import', async () => {
            const file = new File(['User ID,User Name,Taxpayer ID\nuser_staged,Staged User,1'], 'users.csv', { type: 'text/csv' });
            stageFile(file);

            window.startImport();
            await flushPromises();
            await flushPromises();

            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Imported: 1'));
            const names = Array.from(document.querySelectorAll('#userList input[id^="userName-"]')).map(i => i.value);
            expect(names).toContain('Staged User');

            window.deleteUser('user_staged');
        });

        it('reopening the import modal resets the staged file and disables Start Import again', () => {
            const file = new File(['User ID,User Name,Taxpayer ID\nuser_y,Y,1'], 'users.csv', { type: 'text/csv' });
            stageFile(file);
            expect(document.getElementById('startImportButton').disabled).toBe(false);

            window.openImportModal();

            expect(document.getElementById('startImportButton').disabled).toBe(true);
            expect(document.getElementById('importSelectedFileName').classList.contains('hidden')).toBe(true);
        });

        it('toggles the overwrite warning with the checkbox', () => {
            const warning = document.getElementById('importOverwriteWarning');
            const checkbox = document.getElementById('importOverwriteCheckbox');

            checkbox.checked = true;
            window.toggleImportOverwriteWarning();
            expect(warning.classList.contains('hidden')).toBe(false);

            checkbox.checked = false;
            window.toggleImportOverwriteWarning();
            expect(warning.classList.contains('hidden')).toBe(true);
        });

        it('exports a users CSV', () => {
            const getBlob = stubDownload();
            window.exportUsersCSV();

            expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
            return readBlobAsText(getBlob()).then(csvText => {
                expect(csvText).toContain('User ID,User Name,Taxpayer ID');
                expect(csvText).toContain('user');
            });
        });

        it('exports a full JSON backup in legacy scope (schema 1): raw users/transactions/t4g_* only, no settings or rate cache', async () => {
            fillConversionForm({ amount: '10', currency: 'USD', addAsTransaction: true });
            await clickConvert();

            // tests/setup.js clears localStorage before every test, so the
            // only keys present now are the canonical ones clickConvert()
            // just wrote. Genuine schema-1 data predates the t4g_ prefix
            // entirely, so move those canonical keys back to their
            // pre-migration (raw, unprefixed) names, and seed the rest, to
            // demonstrate the legacy-scope exclusion rather than leaving it
            // coincidentally absent.
            const users = global.localStorage.getItem(STORAGE_KEYS.users);
            const transactions = global.localStorage.getItem(STORAGE_KEYS.transactions);
            expect(global.localStorage.getItem(`${CURRENCY_RATE_KEY_PREFIX}2025-01-15`)).not.toBeNull();

            global.localStorage.clear();
            global.localStorage.setItem('users', users);
            global.localStorage.setItem('transactions', transactions);
            global.localStorage.setItem('themePreference', JSON.stringify('dark'));
            global.localStorage.setItem('t4g_appVersion', JSON.stringify(APP_VERSION));
            global.localStorage.setItem('t4g_dataSchemaVersion', JSON.stringify(1));

            // Apply a filter that would exclude the transaction just added,
            // to prove the backup reads storage directly and ignores
            // filterState entirely (unlike the filtered exportToCSV()).
            document.getElementById('filterUser').value = 'nonexistent-user';
            document.getElementById('filterUser').dispatchEvent(new window.Event('change'));

            const getBlob = stubDownload();
            window.exportBackupJSON();

            expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
            const jsonText = await readBlobAsText(getBlob());
            const backup = JSON.parse(jsonText);

            expect(backup.data.transactions.some(t => t.currencyCode === 'USD')).toBe(true);
            expect(backup.data.users.some(u => u.id === 'user')).toBe(true);
            expect(backup.dataSchemaVersion).toBe(1);
            expect(Object.keys(backup.data).sort()).toEqual(['t4g_appVersion', 't4g_dataSchemaVersion', 'transactions', 'users'].sort());
            expect(backup.data).not.toHaveProperty('themePreference');
            expect(backup.data).not.toHaveProperty(`${CURRENCY_RATE_KEY_PREFIX}2025-01-15`);
        });

        it('exports a full JSON backup in t4g_*-only scope, which now includes the migrated data tables', async () => {
            fillConversionForm({ amount: '10', currency: 'USD', addAsTransaction: true });
            await clickConvert();

            window.checkForAppUpdate(); // seeds t4g_appVersion/t4g_dataSchemaVersion (now 2, post-migration)

            const getBlob = stubDownload();
            window.exportBackupJSON();

            const jsonText = await readBlobAsText(getBlob());
            const backup = JSON.parse(jsonText);

            expect(backup.dataSchemaVersion).toBe(DATA_SCHEMA_VERSION);
            // Every key in the backup is t4g_-prefixed - including the data
            // tables, now that they live under t4g_data_* (see src/keys.js).
            expect(Object.keys(backup.data).every(key => key.startsWith('t4g_'))).toBe(true);
            expect(backup.data).toHaveProperty(STORAGE_KEYS.transactions);
            expect(backup.data).toHaveProperty(STORAGE_KEYS.users);
            expect(backup.data).not.toHaveProperty('users');
            expect(backup.data).not.toHaveProperty('transactions');
        });

        it('handleImportFile alerts when no file is given', () => {
            window.handleImportFile(null);
            expect(global.alert).toHaveBeenCalledWith('No file selected.');
        });

        it('imports a transactions CSV via auto-detection and merges by default', async () => {
            const csv = [
                'Date,User ID,User Name,Taxpayer ID,Currency Code,Currency Name,Amount,Rate,Quantity,Converted GEL,Comment,Timestamp',
                '2025-05-01,user,user,,USD,US Dollar,100,2.875,1,287.5,Auto-detected row,888888'
            ].join('\n');
            const file = new File([csv], 'import.csv', { type: 'text/csv' });

            window.handleImportFile(file);
            await flushPromises();
            await flushPromises();

            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Imported: 1'));
            const commentValues = Array.from(document.querySelectorAll('#transactionList input.input-inline')).map(i => i.value);
            expect(commentValues).toContain('Auto-detected row');
        });

        it('imports a users CSV via auto-detection', async () => {
            const csv = ['User ID,User Name,Taxpayer ID', 'user_extra,Extra Person,555'].join('\n');
            const file = new File([csv], 'users.csv', { type: 'text/csv' });

            window.handleImportFile(file);
            await flushPromises();
            await flushPromises();

            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Imported: 1'));
            const names = Array.from(document.querySelectorAll('#userList input.input-inline')).map(i => i.value);
            expect(names).toContain('Extra Person');

            window.deleteUser('user_extra');
        });

        it('rejects a CSV with an unrecognized header', async () => {
            const file = new File(['Foo,Bar,Baz\n1,2,3'], 'mystery.csv', { type: 'text/csv' });

            window.handleImportFile(file);
            await flushPromises();
            await flushPromises();

            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Import failed'));
        });

        it('overwrite=true replaces the transactions table wholesale via the import modal', async () => {
            fillConversionForm({ amount: '10', currency: 'USD', addAsTransaction: true });
            await clickConvert();

            document.getElementById('importOverwriteCheckbox').checked = true;
            const csv = [
                'Date,User ID,User Name,Taxpayer ID,Currency Code,Currency Name,Amount,Rate,Quantity,Converted GEL,Comment,Timestamp',
                '2025-06-01,user,user,,EUR,Euro,50,3.1,1,155,Replacement row,777777'
            ].join('\n');
            const file = new File([csv], 'import.csv', { type: 'text/csv' });

            window.handleImportFile(file);
            await flushPromises();
            await flushPromises();

            const commentValues = Array.from(document.querySelectorAll('#transactionList input.input-inline')).map(i => i.value);
            expect(commentValues).toEqual(['Replacement row']);
        });

        it('restores a JSON backup with overwrite=false (merge)', async () => {
            const backupJson = JSON.stringify({
                app: 'Currency to GEL Converter',
                dataSchemaVersion: 1,
                data: {
                    users: [{ id: 'user_json', name: 'From Backup', taxpayerId: '' }],
                    transactions: []
                }
            });
            const file = new File([backupJson], 'backup.json', { type: 'application/json' });

            window.handleImportFile(file);
            await flushPromises();
            await flushPromises();

            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Backup merged'));
            const names = Array.from(document.querySelectorAll('#userList input.input-inline')).map(i => i.value);
            expect(names).toContain('From Backup');
            expect(names).toContain('user'); // merge keeps the pre-existing default user

            window.deleteUser('user_json');
        });

        it('restores a JSON backup with overwrite=true (wholesale replace)', async () => {
            document.getElementById('importOverwriteCheckbox').checked = true;
            const backupJson = JSON.stringify({
                app: 'Currency to GEL Converter',
                dataSchemaVersion: 1,
                data: {
                    users: [{ id: 'user_restored', name: 'Restored User', taxpayerId: '' }],
                    transactions: [],
                    themePreference: 'dark'
                }
            });
            const file = new File([backupJson], 'backup.json', { type: 'application/json' });

            window.handleImportFile(file);
            await flushPromises();
            await flushPromises();

            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Backup restored'));
            const names = Array.from(document.querySelectorAll('#userList input[id^="userName-"]')).map(i => i.value);
            expect(names).toEqual(['Restored User']); // the pre-existing default user is gone
            // The restored backup is schema 1 (raw themePreference key) -
            // processJSONImport migrates it before applying, so it lands
            // under the canonical t4g_config_themePreference key.
            expect(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.themePreference))).toBe('dark');
        });

        it('alerts when the JSON file is malformed', async () => {
            const file = new File(['not valid json{'], 'backup.json', { type: 'application/json' });

            window.handleImportFile(file);
            await flushPromises();
            await flushPromises();

            expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Import failed'));
        });
    });
});
