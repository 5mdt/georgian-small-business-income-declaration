import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_VERSION } from '../../src/version.js';

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

            const transactions = JSON.parse(global.localStorage.getItem('transactions'));
            const txId = transactions[transactions.length - 1].id;

            window.updateTransactionComment(txId, '<img src=x onerror=alert(1)>');

            const updatedInputValue = document.getElementById(`comment-${txId}`).value;
            expect(updatedInputValue).not.toContain('<img');

            const storedComment = JSON.parse(global.localStorage.getItem('transactions'))
                .find(t => t.id === txId).comment;
            expect(storedComment).toBe('&lt;img src=x onerror=alert(1)&gt;');
        });

        it('removes a transaction from the table when deleted', async () => {
            fillConversionForm({ amount: '10', addAsTransaction: true });
            await clickConvert();

            const transactions = JSON.parse(global.localStorage.getItem('transactions'));
            const txId = transactions[transactions.length - 1].id;

            window.deleteTransaction(txId);

            const remaining = JSON.parse(global.localStorage.getItem('transactions'));
            expect(remaining.find(t => t.id === txId)).toBeUndefined();
        });

        it('asks for confirmation before clearing all transactions, and honors "cancel"', async () => {
            fillConversionForm({ amount: '10', addAsTransaction: true });
            await clickConvert();

            global.confirm.mockReturnValue(false);
            window.clearAllTransactions();

            expect(JSON.parse(global.localStorage.getItem('transactions')).length).toBeGreaterThan(0);
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

            const users = JSON.parse(global.localStorage.getItem('users'));
            const bob = users.find(u => u.name === 'Bob');

            fillConversionForm({ amount: '10', addAsTransaction: true, userId: bob.id });
            await clickConvert();

            expect(JSON.parse(global.localStorage.getItem('transactions')).some(t => t.userId === bob.id)).toBe(true);

            global.confirm.mockReturnValue(true); // confirm cascading delete
            window.deleteUser(bob.id);

            expect(JSON.parse(global.localStorage.getItem('users')).some(u => u.id === bob.id)).toBe(false);
            expect(JSON.parse(global.localStorage.getItem('transactions')).some(t => t.userId === bob.id)).toBe(false);
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

        it('persists the current schema version without a modal when there are no transactions', () => {
            global.localStorage.removeItem('t4g_dataSchemaVersion');
            global.localStorage.removeItem('transactions');

            window.checkForSchemaMigration();

            expect(isModalHidden()).toBe(true);
            expect(JSON.parse(global.localStorage.getItem('t4g_dataSchemaVersion'))).toBe(1);
        });

        it('treats a missing key with existing transactions as schema 1 (no modal today)', () => {
            global.localStorage.removeItem('t4g_dataSchemaVersion');
            global.localStorage.setItem('transactions', JSON.stringify([{
                id: 't1', userId: 'user', date: '2025-01-15', currencyCode: 'USD',
                currencyName: 'US Dollar', amount: 10, rate: 2.875, quantity: 1,
                convertedGEL: 28.75, comment: '', timestamp: Date.now()
            }]));

            window.checkForSchemaMigration();

            // DATA_SCHEMA_VERSION is currently 1, same as the assumed baseline,
            // so this is a no-op today - it only shows the modal once the
            // schema is actually bumped past 1.
            expect(isModalHidden()).toBe(true);
            expect(JSON.parse(global.localStorage.getItem('t4g_dataSchemaVersion'))).toBe(1);
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
            expect(JSON.parse(global.localStorage.getItem('t4g_dataSchemaVersion'))).toBe(1);
        });

        it('downloading a backup skips the confirmation and exports every transaction, ignoring filters', async () => {
            fillConversionForm({ amount: '10', currency: 'USD', addAsTransaction: true });
            await clickConvert();

            // Set a filter that would exclude the transaction just added, to
            // prove the backup export ignores filterState entirely.
            document.getElementById('filterUser').value = 'nonexistent-user';
            document.getElementById('filterUser').dispatchEvent(new window.Event('change'));

            global.localStorage.setItem('t4g_dataSchemaVersion', JSON.stringify(0));
            window.checkForSchemaMigration();
            expect(isModalHidden()).toBe(false);

            let capturedBlob;
            global.URL.createObjectURL = vi.fn((blob) => {
                capturedBlob = blob;
                return 'blob:mock-url';
            });
            global.URL.revokeObjectURL = vi.fn();

            window.exportBackupCSV();
            expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);

            const csvText = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsText(capturedBlob);
            });
            expect(csvText).toContain('USD');

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
});
