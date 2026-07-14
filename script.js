// Import utility functions
import {
    ERROR_MESSAGES,
    FILTER_DEBOUNCE_MS,
    formatCurrency,
    getCurrencySymbol,
    generateUserId,
    generateTransactionId,
    convertToGEL,
    precalculateAllYTD,
    calculateYTDForTransaction,
    buildUserLookupMap,
    createDefaultUser,
    debounce,
    compareVersions
} from './src/utils.js';
import { APP_VERSION, DATA_SCHEMA_VERSION } from './src/version.js';
import { STORAGE_KEYS, CURRENCY_RATE_KEY_PREFIX, COLLAPSIBLE_KEY_PREFIX } from './src/keys.js';
import { runMigrations } from './src/migrations.js';

import { getFromStorage, saveToStorage, removeFromStorage, getAllStorageKeys } from './src/storage.js';
import { sanitizeInput, showElement, hideElement, showError, hideError } from './src/dom.js';
import {
    loadUsers,
    canDeleteUser,
    removeUserFromStorage,
    getUserById,
    updateUserInStorage
} from './src/users.js';
import {
    loadTransactions,
    addTransactionToStorage,
    removeTransactionFromStorage,
    updateTransactionCommentInStorage,
    removeUserTransactions
} from './src/transactions.js';
import {
    findCurrencyInData,
    getCurrencyRatesFromCache,
    fetchCurrencyRates
} from './src/currency.js';
import {
    createDefaultFilterState,
    applyFilters,
    sortTransactions,
    computeNextSortState
} from './src/filters.js';
import {
    buildImportResult,
    buildExportCSVContent,
    buildExportFilename,
    buildUsersCSVContent,
    buildUsersImportResult,
    detectCSVKind
} from './src/csv.js';
import {
    buildBackupJSON,
    parseBackupJSON,
    mergeBackupData,
    selectBackupKeys
} from './src/backup.js';

// ===========================
// Theme Management
// ===========================

const THEME_STORAGE_KEY = STORAGE_KEYS.themePreference;
const THEME_OPTIONS = ['system', 'light', 'dark'];
const THEME_ICONS = {
    system: '💡',
    light: '☀️',
    dark: '🌙'
};
const THEME_LABELS = {
    system: 'Theme',
    light: 'Light',
    dark: 'Dark'
};

function getThemePreference() {
    return getFromStorage(THEME_STORAGE_KEY, 'system');
}

function getCurrentEffectiveTheme() {
    const preference = getThemePreference();
    if (preference !== 'system') {
        return preference;
    }
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

function updateAriaLabel(theme) {
    const button = document.getElementById('themeToggle');
    if (!button) return;

    const effectiveTheme = theme === 'system' ? getCurrentEffectiveTheme() : theme;
    const nextTheme = THEME_OPTIONS[(THEME_OPTIONS.indexOf(theme) + 1) % THEME_OPTIONS.length];

    button.setAttribute(
        'aria-label',
        `Current theme: ${THEME_LABELS[theme]} (${effectiveTheme}). Click to switch to ${THEME_LABELS[nextTheme]}`
    );
}

function applyTheme(theme) {
    const htmlElement = document.documentElement;
    const themeIcon = document.getElementById('themeIcon');
    const themeLabel = document.getElementById('themeLabel');

    // Update data-theme attribute
    if (theme === 'system') {
        htmlElement.removeAttribute('data-theme');
    } else {
        htmlElement.setAttribute('data-theme', theme);
    }

    // Update button UI
    if (themeIcon) {
        themeIcon.textContent = THEME_ICONS[theme];
    }
    if (themeLabel) {
        themeLabel.textContent = THEME_LABELS[theme];
    }

    // Update accessibility label
    updateAriaLabel(theme);

    // Save preference
    saveToStorage(THEME_STORAGE_KEY, theme);
}

function toggleTheme() {
    const currentTheme = getThemePreference();
    const currentIndex = THEME_OPTIONS.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % THEME_OPTIONS.length;
    const nextTheme = THEME_OPTIONS[nextIndex];

    applyTheme(nextTheme);
}

function setupSystemThemeListener() {
    if (!window.matchMedia) return;

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Listen for system theme changes
    const listener = (_e) => {
        const currentTheme = getThemePreference();
        // Only react if user is using system theme
        if (currentTheme === 'system') {
            // Re-apply to update aria-label with new effective theme
            updateAriaLabel('system');
        }
    };

    // Modern API
    if (darkModeQuery.addEventListener) {
        darkModeQuery.addEventListener('change', listener);
    } else if (darkModeQuery.addListener) {
        // Legacy support
        darkModeQuery.addListener(listener);
    }
}

function initTheme() {
    const savedTheme = getThemePreference();
    applyTheme(savedTheme);
    setupSystemThemeListener();
}

// Initialize theme immediately (before DOM content loads to prevent flash)
initTheme();

// ===========================
// Update Notification
// ===========================

const VERSION_STORAGE_KEY = 't4g_appVersion';

function dismissUpdateModal() {
    hideElement(document.getElementById('updateModal'));
    saveToStorage(VERSION_STORAGE_KEY, APP_VERSION);
    // The migration modal only makes sense once the update modal is out of
    // the way - see the "Data Schema Migration" section below.
    checkForSchemaMigration();
}

function checkForAppUpdate() {
    const storedVersion = getFromStorage(VERSION_STORAGE_KEY, null);

    if (storedVersion === null) {
        // First-ever visit - nothing to update from.
        saveToStorage(VERSION_STORAGE_KEY, APP_VERSION);
        checkForSchemaMigration();
        return;
    }

    if (compareVersions(storedVersion, APP_VERSION) < 0) {
        const versionLabel = document.getElementById('updateModalVersion');
        if (versionLabel) versionLabel.textContent = APP_VERSION;
        showElement(document.getElementById('updateModal'));
        // dismissUpdateModal() chains into checkForSchemaMigration() once
        // this modal is acknowledged, so the two never stack.
        return;
    }

    checkForSchemaMigration();
}

// ===========================
// Data Schema Migration
// ===========================
//
// Tracks the shape of the data stored in localStorage, separately from
// APP_VERSION above (a UI-only release doesn't necessarily change the data
// shape, and vice versa). Runs only after the update-notification flow
// above has resolved, so at most one modal is visible at a time.

const DATA_SCHEMA_STORAGE_KEY = 't4g_dataSchemaVersion';
// Unprefixed keys written by schema-1 code (see src/migrations.js's
// migrateV1toV2). Legacy currency-rate keys are date-suffixed, so they're
// matched by prefix rather than listed individually.
const LEGACY_SCHEMA_1_KEYS = ['transactions', 'users', 'themePreference', 'addTransaction'];
const LEGACY_CURRENCY_RATE_KEY_PREFIX = 'currencyRates_';
// True once the user has downloaded a *complete* backup during this page
// load, so dismissMigrationModal() knows whether to confirm before
// closing. Only exportBackupJSON() sets this - unlike exportToCSV() (can
// be filtered to a subset) or exportUsersCSV() (users only, no
// transactions), the JSON backup is the only export guaranteed to capture
// everything, so it's the only one that counts as "a backup".
let migrationBackupDownloaded = false;

// Schema version of already-stored data when DATA_SCHEMA_STORAGE_KEY is
// absent - either a fresh install (nothing stored) or data written by
// pre-T4G-0019 code. Checks for the presence of any legacy (unprefixed,
// schema-1) key directly, rather than loadTransactions().length, since
// loadTransactions() reads from the schema-2 t4g_data_transactions key and
// can no longer see schema-1 data once that key exists.
function detectBaselineSchemaVersion() {
    const allKeys = getAllStorageKeys();
    const hasLegacyData = allKeys.some(key =>
        LEGACY_SCHEMA_1_KEYS.includes(key) || key.startsWith(LEGACY_CURRENCY_RATE_KEY_PREFIX)
    );
    return hasLegacyData ? 1 : DATA_SCHEMA_VERSION;
}

// The schema version of the data actually stored right now - not
// DATA_SCHEMA_VERSION (the running code's schema). Every export tags
// itself with this, so a backup taken before a pending migration is
// labeled with the shape it actually has, not the shape the code would
// produce after migrating. Same baseline as checkForSchemaMigration below.
function currentDataSchemaVersion() {
    const storedVersion = getFromStorage(DATA_SCHEMA_STORAGE_KEY, null);
    if (storedVersion !== null) return Number(storedVersion);
    return detectBaselineSchemaVersion();
}

// Migrates every localStorage key from its current schema up to
// DATA_SCHEMA_VERSION (see src/migrations.js's MIGRATIONS registry) and
// stamps the new version. Reads the whole storage into a plain snapshot,
// transforms it, then reconciles: keys the migration dropped (renamed away
// from) are removed, keys present in the result are (re)written.
function runSchemaMigration() {
    const storedVersion = getFromStorage(DATA_SCHEMA_STORAGE_KEY, null);
    const fromVersion = storedVersion !== null ? Number(storedVersion) : detectBaselineSchemaVersion();

    const allKeys = getAllStorageKeys();
    const snapshot = {};
    allKeys.forEach(key => {
        snapshot[key] = getFromStorage(key);
    });

    const migrated = runMigrations(snapshot, fromVersion, DATA_SCHEMA_VERSION);

    allKeys.forEach(key => {
        if (!(key in migrated)) removeFromStorage(key);
    });
    Object.entries(migrated).forEach(([key, value]) => saveToStorage(key, value));

    saveToStorage(DATA_SCHEMA_STORAGE_KEY, DATA_SCHEMA_VERSION);
}

function dismissMigrationModal() {
    if (!migrationBackupDownloaded) {
        const proceed = confirm(
            'You haven\'t downloaded a backup. Continue without one?'
        );
        if (!proceed) return;
    }

    runSchemaMigration();
    // The page already rendered against the pre-migration (canonical-key)
    // data during onload() - possibly just an auto-seeded default user, if
    // the real data was still sitting under the legacy keys at that point
    // (see migrateV1toV2's collision handling, src/migrations.js). Refresh
    // so the user doesn't see a stale/empty view after their data has
    // actually been migrated.
    triggerDataRefresh();
    hideElement(document.getElementById('migrationModal'));
}

function checkForSchemaMigration() {
    const storedVersion = getFromStorage(DATA_SCHEMA_STORAGE_KEY, null);

    if (storedVersion === null) {
        // Data predating this feature is schema 1 if any exists; a fresh
        // install with no data has nothing to migrate from.
        const baseline = detectBaselineSchemaVersion();
        if (baseline >= DATA_SCHEMA_VERSION) {
            saveToStorage(DATA_SCHEMA_STORAGE_KEY, DATA_SCHEMA_VERSION);
            return;
        }
        showElement(document.getElementById('migrationModal'));
        return;
    }

    if (Number(storedVersion) < DATA_SCHEMA_VERSION) {
        showElement(document.getElementById('migrationModal'));
    } else {
        saveToStorage(DATA_SCHEMA_STORAGE_KEY, DATA_SCHEMA_VERSION);
    }
}

// ===========================
// User Management
// ===========================
// loadUsers, canDeleteUser, removeUserFromStorage, getUserById, updateUserInStorage
// are imported from src/users.js

function triggerUserUIRefresh() {
    renderUserList();
    populateUserSelectors();
}

function saveUser(userData) {
    const success = updateUserInStorage(userData);
    if (success) {
        triggerUserUIRefresh();
    }
    return success;
}

function triggerDataRefresh() {
    renderUserList();
    populateUserSelectors();
    renderTransactionList();
}

function deleteUser(userId) {
    const users = loadUsers();
    const transactions = loadTransactions();

    const check = canDeleteUser(userId, users, transactions);
    if (!check.allowed) {
        if (check.reason && !check.reason.includes('cancelled')) {
            alert(check.reason);
        }
        return false;
    }

    const userDeleted = removeUserFromStorage(userId);
    const transactionsDeleted = removeUserTransactions(userId);

    if (userDeleted && transactionsDeleted) {
        triggerDataRefresh();
        return true;
    }

    return false;
}

// ===========================
// Transaction Management
// ===========================
// loadTransactions, addTransactionToStorage, removeTransactionFromStorage,
// updateTransactionCommentInStorage, removeUserTransactions are imported
// from src/transactions.js

function saveTransaction(transactionData) {
    const success = addTransactionToStorage(transactionData);
    if (success) {
        renderTransactionList();
        // A transaction may introduce a currency not yet in the filter
        // dropdown (e.g. the first EUR transaction) - refresh it so
        // "filter by currency" immediately works for the new entry.
        populateCurrencyFilter();
    }
    return success;
}

function deleteTransaction(id) {
    const success = removeTransactionFromStorage(id);
    if (success) {
        renderTransactionList();
    }
    return success;
}

function updateTransactionComment(id, newComment) {
    const success = updateTransactionCommentInStorage(id, newComment);
    if (success) {
        renderTransactionList();
    }
    return success;
}

function clearAllTransactions() {
    if (!confirm('Are you sure you want to delete all transactions?')) return false;

    const success = removeFromStorage(STORAGE_KEYS.transactions);
    if (success) {
        renderTransactionList();
    }
    return success;
}

function clearRateCache() {
    if (!confirm('Are you sure you want to clear all cached exchange rates?')) return false;

    const keys = Object.keys(localStorage);
    const rateKeys = keys.filter(key => key.startsWith(CURRENCY_RATE_KEY_PREFIX));

    rateKeys.forEach(key => removeFromStorage(key));
    alert('Exchange rate cache cleared successfully.');
    return true;
}

function saveCheckboxState() {
    const checkbox = document.getElementById('addTransactionCheckbox');
    if (!checkbox) return;
    saveToStorage(STORAGE_KEYS.addTransaction, checkbox.checked);
}

function loadCheckboxState() {
    const checkbox = document.getElementById('addTransactionCheckbox');
    if (!checkbox) return;

    const storedState = getFromStorage(STORAGE_KEYS.addTransaction, false);
    checkbox.checked = storedState === true;
}

// ===========================
// Collapsible Sections
// ===========================

// Function to toggle collapsible sections
function toggleCollapsible(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const icon = document.getElementById(`${sectionId}-icon`);

    if (!content || !icon) return;

    const isCollapsed = content.classList.contains('collapsed');

    if (isCollapsed) {
        // Expand
        content.classList.remove('collapsed');
        icon.classList.remove('collapsed');
        sessionStorage.setItem(`${COLLAPSIBLE_KEY_PREFIX}${sectionId}`, 'expanded');
    } else {
        // Collapse
        content.classList.add('collapsed');
        icon.classList.add('collapsed');
        sessionStorage.setItem(`${COLLAPSIBLE_KEY_PREFIX}${sectionId}`, 'collapsed');
    }
}

// Function to restore collapsible states from sessionStorage
function restoreCollapsibleStates() {
    const sections = ['disclaimer', 'howItWorks'];

    sections.forEach(sectionId => {
        const state = sessionStorage.getItem(`${COLLAPSIBLE_KEY_PREFIX}${sectionId}`);
        const content = document.getElementById(`${sectionId}-content`);
        const icon = document.getElementById(`${sectionId}-icon`);

        if (content && icon && state === 'collapsed') {
            content.classList.add('collapsed');
            icon.classList.add('collapsed');
        }
    });
}

function clearConversionUI() {
    const resultDiv = document.getElementById('result');
    const loadingMessage = document.getElementById('loadingMessage');

    if (resultDiv) {
        resultDiv.innerHTML = '';
        hideElement(resultDiv);
    }
    hideError('errorMessage');
    hideElement(loadingMessage);
}

function validateConversionInputs(date, currencyCode, amount) {
    if (!date) {
        showError('errorMessage', ERROR_MESSAGES.NO_DATE);
        return false;
    }
    if (!currencyCode) {
        showError('errorMessage', ERROR_MESSAGES.NO_CURRENCY);
        return false;
    }
    if (isNaN(amount) || amount <= 0) {
        showError('errorMessage', ERROR_MESSAGES.INVALID_AMOUNT);
        return false;
    }
    return true;
}

// getCurrencyRatesFromCache and fetchCurrencyRates are imported from src/currency.js

function handleConversionError(error) {
    const loadingMessage = document.getElementById('loadingMessage');
    hideElement(loadingMessage);
    showError('errorMessage', `Error: ${error.message}`);
}

document.getElementById('fetchButton').addEventListener('click', function () {
    const date = document.getElementById('datePicker').value;
    const currencyCode = document.getElementById('currencySelect').value;
    const amount = parseFloat(document.getElementById('amountInput').value);
    const checkbox = document.getElementById('addTransactionCheckbox');
    const resultDiv = document.getElementById('result');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');

    clearConversionUI();

    if (!validateConversionInputs(date, currencyCode, amount)) {
        return;
    }

    showElement(loadingMessage);

    const cachedData = getCurrencyRatesFromCache(date);
    if (cachedData) {
        handleCurrencyData(cachedData, amount, currencyCode, resultDiv, loadingMessage, errorMessage, checkbox.checked);
        return;
    }

    fetchCurrencyRates(date)
        .then(data => {
            handleCurrencyData(data, amount, currencyCode, resultDiv, loadingMessage, errorMessage, checkbox.checked);
        })
        .catch(handleConversionError);
});

// createGELCurrencyObject, validateCurrencyResponse, findCurrencyInData,
// convertToGEL are imported from src/currency.js / src/utils.js

function createTransactionFromConversion(currency, amount, convertedGEL, date, userId) {
    return {
        id: generateTransactionId(),
        userId: userId,
        date: date,
        currencyCode: currency.code,
        currencyName: currency.name,
        amount: amount,
        rate: currency.rate,
        quantity: currency.quantity,
        convertedGEL: convertedGEL,
        comment: '',
        timestamp: new Date().toISOString()
    };
}

function displayConversionResult(resultDiv, amount, currencyCode, convertedGEL, currency, isTransaction) {
    if (isTransaction) {
        resultDiv.innerHTML = `
            <p><strong>Transaction Added:</strong> ${formatCurrency(amount)} ${currencyCode} = ${formatCurrency(convertedGEL)} GEL</p>
        `;
    } else if (currencyCode === 'GEL') {
        resultDiv.innerHTML = `
            <p><strong>${formatCurrency(amount)} GEL</strong></p>
        `;
    } else {
        resultDiv.innerHTML = `
            <p><strong>${formatCurrency(amount)} ${currencyCode}</strong> = <strong>${formatCurrency(convertedGEL)} GEL</strong></p>
            <p>Exchange Rate: <strong>${currency.rateFormated}</strong></p>
            <p>Quantity Factor: <strong>${currency.quantity}</strong></p>
        `;
    }
    showElement(resultDiv);
}

function handleCurrencyData(data, amount, currencyCode, resultDiv, loadingMessage, errorMessage, addAsTransaction) {
    hideElement(loadingMessage);

    const selectedCurrency = findCurrencyInData(data, currencyCode);
    const convertedGEL = convertToGEL(amount, selectedCurrency);

    const transactionDate = document.getElementById('datePicker').value;

    if (addAsTransaction) {
        const userSelect = document.getElementById('userSelect');
        const selectedUserId = userSelect ? userSelect.value : 'user';

        const transaction = createTransactionFromConversion(
            selectedCurrency,
            amount,
            convertedGEL,
            transactionDate,
            selectedUserId
        );

        saveTransaction(transaction);
    }

    displayConversionResult(resultDiv, amount, currencyCode, convertedGEL, selectedCurrency, addAsTransaction);
}
// Load currencies when date is selected
document.getElementById('datePicker').addEventListener('change', function () {
    loadCurrencies();
});

function loadCurrencies(isInitialLoad = false) {
    const date = document.getElementById('datePicker').value;
    const currencySelect = document.getElementById('currencySelect');
    const errorMessage = document.getElementById('errorMessage');
    const loadingMessage = document.getElementById('loadingMessage');

    // Clear previous errors and loading message
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
    loadingMessage.classList.add('hidden');

    if (!date) return;

    // Validate date is not in future
    if (!isValidDate(date)) {
        errorMessage.textContent = 'Cannot select a future date. Please select today or an earlier date.';
        errorMessage.classList.remove('hidden');
        currencySelect.innerHTML = '<option value="">Select a currency</option>';
        return;
    }

    // Save the currently selected currency BEFORE showing loading
    const savedCurrency = currencySelect.value;

    // Show loading
    currencySelect.innerHTML = '<option value="">Loading...</option>';

    // Check the shared NBG rate cache (src/currency.js) before fetching
    const cachedData = getCurrencyRatesFromCache(date);
    if (cachedData) {
        populateCurrencySelect(cachedData, currencySelect, isInitialLoad, savedCurrency);
    } else {
        fetchCurrencyRates(date)
            .then(data => {
                populateCurrencySelect(data, currencySelect, isInitialLoad, savedCurrency);
            })
            .catch(error => {
                errorMessage.textContent = `Error: ${error.message}`;
                errorMessage.classList.remove('hidden');
            });
    }
}

// Function to populate currency select
function populateCurrencySelect(data, currencySelect, isInitialLoad = false, savedCurrency = null) {
    if (!Array.isArray(data) || data.length === 0 || !data[0].currencies) {
        throw new Error('No valid currency data available.');
    }

    // Use the saved currency value passed from loadCurrencies
    const currentValue = savedCurrency && savedCurrency !== '' ? savedCurrency : null;

    // Populate dropdown
    currencySelect.innerHTML = '<option value="">Select a currency</option>';

    // Add GEL as first option
    const gelOption = document.createElement('option');
    gelOption.value = 'GEL';
    gelOption.textContent = 'GEL - Georgian Lari';
    currencySelect.appendChild(gelOption);

    // Add all other currencies
    data[0].currencies.forEach(currency => {
        const option = document.createElement('option');
        option.value = currency.code;
        option.textContent = `${currency.code} - ${currency.name}`;
        currencySelect.appendChild(option);
    });

    // Restore previous selection if it exists in the new list
    if (currentValue) {
        const currencyExists = currentValue === 'GEL' || data[0].currencies.some(c => c.code === currentValue);
        if (currencyExists) {
            currencySelect.value = currentValue;
        }
    } else if (isInitialLoad) {
        // Only set GEL as default on initial page load
        currencySelect.value = 'GEL';
    }
}

// ===========================
// Filter and Sort State
// ===========================

let filterState = createDefaultFilterState();

// applyFilters, SORT_STRATEGIES, sortTransactions are imported from src/filters.js

// Function to toggle sort
function toggleSort(column) {
    const next = computeNextSortState(filterState, column);
    filterState.sortColumn = next.sortColumn;
    filterState.sortDirection = next.sortDirection;
    renderTransactionList();
}

// Function to clear all filters
function clearFilters() {
    filterState = createDefaultFilterState();

    // Reset filter UI
    const userFilter = document.getElementById('filterUser');
    const currencyFilter = document.getElementById('filterCurrency');
    const dateFromFilter = document.getElementById('filterDateFrom');
    const dateToFilter = document.getElementById('filterDateTo');

    if (userFilter) userFilter.value = 'all';
    if (currencyFilter) currencyFilter.value = 'all';
    if (dateFromFilter) dateFromFilter.value = '';
    if (dateToFilter) dateToFilter.value = '';

    renderTransactionList();
}

// ===========================
// Transaction List Display
// ===========================

function getSortIndicator(column) {
    if (filterState.sortColumn !== column) return '';
    return filterState.sortDirection === 'asc' ? ' ▲' : ' ▼';
}

function buildTransactionTableHeader() {
    return `
        <thead>
            <tr>
                <th onclick="toggleSort('date')" class="sortable">Date${getSortIndicator('date')}</th>
                <th onclick="toggleSort('user')" class="sortable">User${getSortIndicator('user')}</th>
                <th onclick="toggleSort('currency')" class="sortable">Currency${getSortIndicator('currency')}</th>
                <th onclick="toggleSort('amount')" class="sortable">Amount${getSortIndicator('amount')}</th>
                <th>Rate</th>
                <th onclick="toggleSort('gel')" class="sortable">GEL Amount${getSortIndicator('gel')}</th>
                <th onclick="toggleSort('ytd')" class="sortable">YTD Income${getSortIndicator('ytd')}</th>
                <th>Comment</th>
                <th>Actions</th>
            </tr>
        </thead>
    `;
}

function buildTransactionTableRow(transaction, userMap, ytdCache) {
    const user = userMap.get(transaction.userId);
    const userName = user ? user.name : 'Unknown';
    const ytdIncome = ytdCache.get(transaction.id) || 0;
    const currencySymbol = getCurrencySymbol(transaction.currencyCode);
    const commentId = `comment-${transaction.id}`;
    const rate = (transaction.rate / transaction.quantity).toFixed(4);

    return `
        <tr>
            <td>${sanitizeInput(transaction.date)}</td>
            <td>${sanitizeInput(userName)}</td>
            <td>${sanitizeInput(transaction.currencyCode)} - ${sanitizeInput(transaction.currencyName)}</td>
            <td>${currencySymbol} ${formatCurrency(transaction.amount)}</td>
            <td>${rate}</td>
            <td>₾ ${formatCurrency(transaction.convertedGEL)}</td>
            <td><strong>₾ ${formatCurrency(ytdIncome)}</strong></td>
            <td>
                <input type="text"
                        id="${commentId}"
                        value="${sanitizeInput(transaction.comment || '')}"
                        placeholder="Add comment..."
                        class="input-inline"
                        onblur="updateTransactionComment('${transaction.id}', this.value)">
            </td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${transaction.id}')">🗑️</button>
            </td>
        </tr>
    `;
}

function buildTransactionTableFooter(totalGEL) {
    return `
        <tfoot>
            <tr>
                <td colspan="5"><strong>Total GEL:</strong></td>
                <td colspan="4"><strong>₾ ${formatCurrency(totalGEL)}</strong></td>
            </tr>
        </tfoot>
    `;
}

function buildTransactionTable(transactions, userMap, ytdCache, filterStatus) {
    const header = buildTransactionTableHeader();
    const rows = transactions.map(t => buildTransactionTableRow(t, userMap, ytdCache)).join('');
    const totalGEL = transactions.reduce((sum, t) => sum + t.convertedGEL, 0);
    const footer = buildTransactionTableFooter(totalGEL);

    return `
        <p class="filter-status">${filterStatus}</p>
        <table>
            ${header}
            <tbody>${rows}</tbody>
            ${footer}
        </table>
    `;
}

function renderTransactionList() {
    const transactionListDiv = document.getElementById('transactionList');
    if (!transactionListDiv) return;

    const allTransactions = loadTransactions();

    if (allTransactions.length === 0) {
        transactionListDiv.innerHTML = '<p class="no-data">No transactions recorded yet.</p>';
        return;
    }

    const users = loadUsers();
    const userMap = buildUserLookupMap(users);
    const ytdCache = precalculateAllYTD(allTransactions);

    let transactions = applyFilters(allTransactions, filterState);
    transactions = sortTransactions(transactions, userMap, ytdCache, filterState);

    const filterStatus = `Showing ${transactions.length} of ${allTransactions.length} transactions`;
    const tableHTML = buildTransactionTable(transactions, userMap, ytdCache, filterStatus);

    transactionListDiv.innerHTML = tableHTML;
}

// ===========================
// Backup & Restore (Export/Import)
// ===========================
//
// See docs/features/T4G-0020-backup-and-restore.md.

// Creates a downloadable blob from file content and triggers the browser's
// save dialog via a throwaway anchor. Shared by every export path below.
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToCSV() {
    const allTransactions = loadTransactions();

    if (allTransactions.length === 0) {
        alert('No transactions to export.');
        return;
    }

    const users = loadUsers();
    const userMap = buildUserLookupMap(users);
    const ytdCache = precalculateAllYTD(allTransactions);

    // Apply current filters
    let transactions = applyFilters(allTransactions, filterState);
    transactions = sortTransactions(transactions, userMap, ytdCache, filterState);

    if (transactions.length === 0) {
        alert('No transactions to export with current filters.');
        return;
    }

    const csvContent = buildExportCSVContent(
        transactions,
        (t) => calculateYTDForTransaction(t, allTransactions),
        getUserById,
        currentDataSchemaVersion(),
        window.location.href
    );

    const todayISODate = new Date().toISOString().split('T')[0];
    const filename = buildExportFilename(filterState, getUserById, todayISODate);

    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

function exportUsersCSV() {
    const users = loadUsers();

    if (users.length === 0) {
        alert('No users to export.');
        return;
    }

    const csvContent = buildUsersCSVContent(users, currentDataSchemaVersion(), window.location.href);
    const todayISODate = new Date().toISOString().split('T')[0];

    downloadFile(csvContent, `gel-users-${todayISODate}.csv`, 'text/csv;charset=utf-8;');
}

function exportBackupJSON() {
    const schemaVersion = currentDataSchemaVersion();
    const keysToBackup = selectBackupKeys(getAllStorageKeys(), schemaVersion);

    const snapshot = {};
    keysToBackup.forEach(key => {
        snapshot[key] = getFromStorage(key);
    });

    const json = buildBackupJSON(snapshot, schemaVersion, window.location.href);
    const todayISODate = new Date().toISOString().split('T')[0];

    downloadFile(json, `gel-backup-${todayISODate}.json`, 'application/json;charset=utf-8;');
    migrationBackupDownloaded = true;
}

// Function to import transactions from CSV
// buildImportResult (parsing/validation/dedup/user-creation) is imported from src/csv.js

function processCSVContent(content) {
    const existingTransactions = loadTransactions();
    const existingUsers = loadUsers();

    const { users, transactions, stats } = buildImportResult(content, existingTransactions, existingUsers);

    saveToStorage(STORAGE_KEYS.users, users);
    saveToStorage(STORAGE_KEYS.transactions, transactions);

    return stats;
}

function importFromCSV(file) {
    if (!file) {
        alert('No file selected.');
        return;
    }

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const content = e.target.result;
            const stats = processCSVContent(content);

            triggerDataRefresh();

            alert(
                'Import completed!\n' +
                `Imported: ${stats.imported}\n` +
                `Skipped (duplicates): ${stats.skipped}\n` +
                `New users created: ${stats.usersCreated}`
            );
        } catch (error) {
            alert(`Import failed: ${error.message}`);
        }
    };

    reader.onerror = function () {
        alert('Failed to read file.');
    };

    reader.readAsText(file);
}

// ===========================
// Export/Import Modals
// ===========================

function openExportModal() {
    showElement(document.getElementById('exportModal'));
}

function closeExportModal() {
    hideElement(document.getElementById('exportModal'));
}

function openImportModal() {
    document.getElementById('importOverwriteCheckbox').checked = false;
    hideElement(document.getElementById('importOverwriteWarning'));
    resetImportFileSelection();
    showElement(document.getElementById('importModal'));
}

function closeImportModal() {
    hideElement(document.getElementById('importModal'));
}

function toggleImportOverwriteWarning() {
    const checked = document.getElementById('importOverwriteCheckbox').checked;
    const warning = document.getElementById('importOverwriteWarning');
    if (checked) {
        showElement(warning);
    } else {
        hideElement(warning);
    }
}

// Clears the chosen-file indicator and disables Start Import, so picking a
// file only stages it - the user reviews the overwrite checkbox/warning
// and clicks Start Import to actually run it.
function resetImportFileSelection() {
    document.getElementById('importFileInput').value = '';
    hideElement(document.getElementById('importSelectedFileName'));
    document.getElementById('startImportButton').disabled = true;
}

function onImportFileChosen() {
    const fileInput = document.getElementById('importFileInput');
    const file = fileInput.files[0];
    const nameLabel = document.getElementById('importSelectedFileName');

    if (!file) {
        resetImportFileSelection();
        return;
    }

    nameLabel.textContent = `Selected: ${file.name}`;
    showElement(nameLabel);
    document.getElementById('startImportButton').disabled = false;
}

function startImport() {
    const file = document.getElementById('importFileInput').files[0];
    handleImportFile(file);
}

// Routes a .csv file to the transactions or users importer based on its
// header (see detectCSVKind, src/csv.js).
function processCSVImportAuto(content, overwrite) {
    const header = content.split('\n')[0].trim();
    const kind = detectCSVKind(header);

    if (kind === 'users') {
        const existingUsers = loadUsers();
        const { users, stats } = buildUsersImportResult(content, existingUsers, overwrite);
        saveToStorage(STORAGE_KEYS.users, users);
        return `Users import completed!\nImported: ${stats.imported}\nSkipped (duplicates): ${stats.skipped}`;
    }

    if (kind === 'transactions') {
        const existingTransactions = loadTransactions();
        const existingUsers = loadUsers();
        const { users, transactions, stats } = buildImportResult(content, existingTransactions, existingUsers, overwrite);
        saveToStorage(STORAGE_KEYS.users, users);
        saveToStorage(STORAGE_KEYS.transactions, transactions);
        return 'Import completed!\n' +
            `Imported: ${stats.imported}\n` +
            `Skipped (duplicates): ${stats.skipped}\n` +
            `New users created: ${stats.usersCreated}`;
    }

    throw new Error(ERROR_MESSAGES.INVALID_CSV);
}

// Restores a full JSON backup, migrating its data up to DATA_SCHEMA_VERSION
// first (a backup taken pre-migration stores data under old key names - see
// src/migrations.js - so it can't be applied verbatim). overwrite=false
// merges users/transactions only, leaving settings (theme, versions, rate
// cache) untouched. overwrite=true wipes every currently-tracked key and
// writes the migrated data back, a true wholesale restore.
function processJSONImport(content, overwrite) {
    const { data, meta } = parseBackupJSON(content);
    const backupSchemaVersion = Number(meta.dataSchemaVersion) || 1;
    const migrated = runMigrations(data, backupSchemaVersion, DATA_SCHEMA_VERSION);

    if (overwrite) {
        getAllStorageKeys().forEach(key => removeFromStorage(key));
        Object.entries(migrated).forEach(([key, value]) => saveToStorage(key, value));
        saveToStorage(DATA_SCHEMA_STORAGE_KEY, DATA_SCHEMA_VERSION);
        return 'Backup restored! All existing data was replaced.';
    }

    const existingUsers = loadUsers();
    const existingTransactions = loadTransactions();
    const { users, transactions } = mergeBackupData(existingUsers, existingTransactions, migrated);

    saveToStorage(STORAGE_KEYS.users, users);
    saveToStorage(STORAGE_KEYS.transactions, transactions);
    return 'Backup merged! Users and transactions from the file were added without duplicating existing data.';
}

function handleImportFile(file) {
    if (!file) {
        alert('No file selected.');
        return;
    }

    const overwrite = document.getElementById('importOverwriteCheckbox').checked;
    const isJSON = file.name.toLowerCase().endsWith('.json');

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const content = e.target.result;
            const message = isJSON
                ? processJSONImport(content, overwrite)
                : processCSVImportAuto(content, overwrite);

            triggerDataRefresh();
            closeImportModal();
            alert(message);
        } catch (error) {
            alert(`Import failed: ${error.message}`);
        }
    };

    reader.onerror = function () {
        alert('Failed to read file.');
    };

    reader.readAsText(file);
}

// Function to load demo data
function loadDemoData() {
    // Check if transactions already exist
    const existingTransactions = loadTransactions();
    if (existingTransactions.length > 0) {
        alert('Error: Cannot load demo data. You already have saved transactions.\n\nPlease use "Clear All" to remove existing transactions first, or use "Import" to add more data.');
        return;
    }

    // Fetch and load demo-data.csv
    fetch('demo-data.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load demo data file');
            }
            return response.text();
        })
        .then(csvContent => {
            // Create a mock File object from the CSV content
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], 'demo-data.csv', { type: 'text/csv' });

            // Use existing importFromCSV function
            importFromCSV(file);
        })
        .catch(error => {
            alert(`Failed to load demo data: ${error.message}`);
        });
}

// ===========================
// User List Display
// ===========================

// Function to render user list
function renderUserList() {
    const users = loadUsers();
    const userListDiv = document.getElementById('userList');

    if (!userListDiv) return;

    if (users.length === 0) {
        userListDiv.innerHTML = '<p class="no-data">No users found.</p>';
        return;
    }

    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Taxpayer ID</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    users.forEach(u => {
        const nameId = `userName-${u.id}`;
        const taxpayerId = `userTaxpayerId-${u.id}`;

        tableHTML += `
            <tr>
                <td>
                    <input type="text"
                           id="${nameId}"
                           value="${u.name}"
                           class="input-inline">
                </td>
                <td>
                    <input type="text"
                           id="${taxpayerId}"
                           value="${u.taxpayerId}"
                           class="input-inline">
                </td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="saveUserFromInputs('${u.id}')">💾 Save</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">🗑️</button>
                </td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
        <div class="action-toolbar" style="margin-top: 16px;">
            <button class="btn btn-danger btn-sm" onclick="deleteAllUsers()">🗑️ Delete All Users</button>
        </div>
    `;

    userListDiv.innerHTML = tableHTML;
}

// Function to save user from input fields
function saveUserFromInputs(userId) {
    const nameInput = document.getElementById(`userName-${userId}`);
    const taxpayerIdInput = document.getElementById(`userTaxpayerId-${userId}`);

    if (!nameInput || !taxpayerIdInput) {
        alert('Error: Could not find input fields.');
        return;
    }

    const name = nameInput.value.trim();
    const taxpayerId = taxpayerIdInput.value.trim();

    if (!name) {
        alert('Error: User name cannot be empty.');
        return;
    }

    const user = getUserById(userId);
    if (user) {
        user.name = name;
        user.taxpayerId = taxpayerId;
        saveUser(user);
        alert('User updated successfully!');
    }
}

// Function to update user field
function updateUserField(userId, field, value) {
    const user = getUserById(userId);
    if (user) {
        user[field] = value;
        saveUser(user);
    }
}

// Function to populate user selectors
function populateUserSelectors() {
    const users = loadUsers();

    // Populate transaction user selector
    const userSelect = document.getElementById('userSelect');
    if (userSelect) {
        const currentValue = userSelect.value || 'user';
        userSelect.innerHTML = '';
        users.forEach(u => {
            const option = document.createElement('option');
            option.value = u.id;
            option.textContent = u.name;
            userSelect.appendChild(option);
        });
        userSelect.value = currentValue;
    }

    // Populate filter user selector
    const filterUser = document.getElementById('filterUser');
    if (filterUser) {
        const currentFilter = filterUser.value || 'all';
        filterUser.innerHTML = '<option value="all">All Users</option>';
        users.forEach(u => {
            const option = document.createElement('option');
            option.value = u.id;
            option.textContent = u.name;
            filterUser.appendChild(option);
        });
        filterUser.value = currentFilter;
    }

    // Populate filter currency selector
    populateCurrencyFilter();
}

// Function to populate currency filter
function populateCurrencyFilter() {
    const transactions = loadTransactions();
    const currencies = new Set();

    transactions.forEach(t => {
        currencies.add(t.currencyCode);
    });

    const filterCurrency = document.getElementById('filterCurrency');
    if (filterCurrency) {
        const currentFilter = filterCurrency.value || 'all';
        filterCurrency.innerHTML = '<option value="all">All Currencies</option>';

        Array.from(currencies).sort().forEach(code => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = code;
            filterCurrency.appendChild(option);
        });

        filterCurrency.value = currentFilter;
    }
}

// Function to delete all users
function deleteAllUsers() {
    const users = loadUsers();
    const transactions = loadTransactions();

    if (users.length === 0) {
        alert('No users to delete.');
        return false;
    }

    const totalTransactions = transactions.length;
    const confirmMessage = totalTransactions > 0
        ? `Are you sure you want to delete all ${users.length} user(s) and all ${totalTransactions} transaction(s)? This action cannot be undone.`
        : `Are you sure you want to delete all ${users.length} user(s)? This action cannot be undone.`;

    if (!confirm(confirmMessage)) {
        return false;
    }

    const defaultUser = createDefaultUser();
    const usersSuccess = saveToStorage(STORAGE_KEYS.users, [defaultUser]);
    const transactionsSuccess = saveToStorage(STORAGE_KEYS.transactions, []);

    if (usersSuccess && transactionsSuccess) {
        triggerDataRefresh();
        alert('All users and transactions have been deleted. A default user has been created.');
        return true;
    }

    alert('Failed to delete all users. Please try again.');
    return false;
}

// Function to add new user
function addNewUser() {
    const userName = prompt('Enter user name:');
    if (!userName) return;

    const taxpayerId = prompt('Enter taxpayer ID (optional):') || '';

    const newUser = {
        id: generateUserId(),
        name: userName,
        taxpayerId: taxpayerId
    };

    saveUser(newUser);
}

// Function to toggle user management section
function toggleUserManagement() {
    const userSection = document.getElementById('userManagementSection');
    if (userSection) {
        userSection.classList.toggle('hidden');
    }
}

// Function to get today's date in YYYY-MM-DD format
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// Function to set max date on date inputs
function setMaxDates() {
    const today = getTodayDate();
    const datePicker = document.getElementById('datePicker');
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');

    if (datePicker) datePicker.max = today;
    if (filterDateFrom) filterDateFrom.max = today;
    if (filterDateTo) filterDateTo.max = today;
}

// Function to validate date is not in future
function isValidDate(dateString) {
    if (!dateString) return false;
    const selectedDate = new Date(dateString);
    const today = new Date(getTodayDate());
    return selectedDate <= today;
}

function handleFilterChange(filterKey, value) {
    filterState[filterKey] = value;
    renderTransactionList();
    if (filterKey === 'userId') {
        populateCurrencyFilter();
    }
}

const debouncedFilterChange = debounce((filterKey, value) => {
    handleFilterChange(filterKey, value);
}, FILTER_DEBOUNCE_MS);

function setupFilterEventListeners() {
    const filterUser = document.getElementById('filterUser');
    const filterCurrency = document.getElementById('filterCurrency');
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');

    if (filterUser) {
        filterUser.addEventListener('change', function() {
            handleFilterChange('userId', this.value);
        });
    }

    if (filterCurrency) {
        filterCurrency.addEventListener('change', function() {
            handleFilterChange('currencyCode', this.value);
        });
    }

    if (filterDateFrom) {
        filterDateFrom.addEventListener('change', function() {
            debouncedFilterChange('dateFrom', this.value);
        });
    }

    if (filterDateTo) {
        filterDateTo.addEventListener('change', function() {
            debouncedFilterChange('dateTo', this.value);
        });
    }
}

window.onload = function () {
    loadCheckboxState();
    restoreCollapsibleStates();
    checkForAppUpdate();

    const today = getTodayDate();
    const datePicker = document.getElementById('datePicker');
    if (datePicker) datePicker.value = today;

    setMaxDates();
    loadCurrencies(true);
    renderTransactionList();
    renderUserList();
    populateUserSelectors();
    setupFilterEventListeners();

    const addTransactionCheckbox = document.getElementById('addTransactionCheckbox');
    if (addTransactionCheckbox) {
        addTransactionCheckbox.addEventListener('change', saveCheckboxState);
    }

    const amountInput = document.getElementById('amountInput');
    if (amountInput) {
        amountInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const fetchButton = document.getElementById('fetchButton');
                if (fetchButton) fetchButton.click();
            }
        });
    }
};

// Expose functions to global scope for HTML onclick handlers
window.toggleTheme = toggleTheme;
window.toggleCollapsible = toggleCollapsible;
window.toggleUserManagement = toggleUserManagement;
window.addNewUser = addNewUser;
window.clearFilters = clearFilters;
window.exportToCSV = exportToCSV;
window.loadDemoData = loadDemoData;
window.clearAllTransactions = clearAllTransactions;
window.clearRateCache = clearRateCache;
window.importFromCSV = importFromCSV;
window.deleteUser = deleteUser;
window.deleteTransaction = deleteTransaction;
window.updateTransactionComment = updateTransactionComment;
window.saveUserFromInputs = saveUserFromInputs;
window.updateUserField = updateUserField;
window.deleteAllUsers = deleteAllUsers;
window.toggleSort = toggleSort;
window.dismissUpdateModal = dismissUpdateModal;
window.checkForAppUpdate = checkForAppUpdate;
window.dismissMigrationModal = dismissMigrationModal;
window.checkForSchemaMigration = checkForSchemaMigration;
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;
window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.toggleImportOverwriteWarning = toggleImportOverwriteWarning;
window.exportUsersCSV = exportUsersCSV;
window.exportBackupJSON = exportBackupJSON;
window.handleImportFile = handleImportFile;
window.onImportFileChosen = onImportFileChosen;
window.startImport = startImport;
