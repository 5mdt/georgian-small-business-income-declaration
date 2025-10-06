// Import utility functions
import {
    ERROR_MESSAGES,
    API_TIMEOUT,
    FILTER_DEBOUNCE_MS,
    validateUser,
    validateTransaction,
    formatCurrency,
    getCurrencySymbol,
    generateUserId,
    generateTransactionId,
    convertToGEL,
    precalculateAllYTD,
    calculateYTDForTransaction,
    validateCSVHeader,
    parseCSVLine,
    validateCSVRow,
    buildUserLookupMap,
    createDefaultUser,
    debounce
} from './src/utils.js';

// ===========================
// Storage Utilities
// ===========================

function getFromStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        if (!item) return defaultValue;
        return JSON.parse(item);
    } catch (error) {
        console.error(`Error reading from storage: ${key}`, error);
        return defaultValue;
    }
}

function saveToStorage(key, value) {
    try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            alert(ERROR_MESSAGES.QUOTA_EXCEEDED);
        } else {
            console.error(`Error saving to storage: ${key}`, error);
        }
        return false;
    }
}

function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`Error removing from storage: ${key}`, error);
        return false;
    }
}

// ===========================
// DOM Utilities
// ===========================

function sanitizeInput(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showElement(element) {
    if (element) element.classList.remove('hidden');
}

function hideElement(element) {
    if (element) element.classList.add('hidden');
}

function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = message;
    showElement(element);
}

function hideError(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = '';
    hideElement(element);
}

// ===========================
// User Management
// ===========================

function loadUsers() {
    const users = getFromStorage('users');

    if (!users || !Array.isArray(users) || users.length === 0) {
        const defaultUser = createDefaultUser();
        saveToStorage('users', [defaultUser]);
        return [defaultUser];
    }

    const validUsers = users.filter(validateUser);
    if (validUsers.length === 0) {
        const defaultUser = createDefaultUser();
        saveToStorage('users', [defaultUser]);
        return [defaultUser];
    }

    return validUsers;
}

function updateUserInStorage(userData) {
    if (!validateUser(userData)) {
        console.error('Invalid user data', userData);
        return false;
    }

    const users = loadUsers();
    const existingIndex = users.findIndex(u => u.id === userData.id);

    if (existingIndex >= 0) {
        users[existingIndex] = userData;
    } else {
        users.push(userData);
    }

    return saveToStorage('users', users);
}

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

function canDeleteUser(userId, users, transactions) {
    if (userId === 'user') {
        return { allowed: false, reason: 'Cannot delete the default user. Please create another user first.' };
    }

    if (users.length <= 1) {
        return { allowed: false, reason: 'Cannot delete the last user.' };
    }

    const userTransactions = transactions.filter(t => t.userId === userId);
    if (userTransactions.length > 0) {
        const confirmed = confirm(
            `This user has ${userTransactions.length} transaction(s). Delete user and all associated transactions?`
        );
        if (!confirmed) {
            return { allowed: false, reason: 'User cancelled operation.' };
        }
    }

    return { allowed: true };
}

function removeUserFromStorage(userId) {
    const users = loadUsers();
    const filteredUsers = users.filter(u => u.id !== userId);
    return saveToStorage('users', filteredUsers);
}

function removeUserTransactions(userId) {
    const transactions = loadTransactions();
    const filteredTransactions = transactions.filter(t => t.userId !== userId);
    return saveToStorage('transactions', filteredTransactions);
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

// Function to get user by ID
function getUserById(userId) {
    const users = loadUsers();
    return users.find(u => u.id === userId);
}

// ===========================
// Transaction Management
// ===========================

function loadTransactions() {
    const transactions = getFromStorage('transactions', []);
    if (!Array.isArray(transactions)) return [];
    return transactions.filter(validateTransaction);
}

function addTransactionToStorage(transactionData) {
    if (!validateTransaction(transactionData)) {
        console.error('Invalid transaction data', transactionData);
        return false;
    }

    const transactions = loadTransactions();
    transactions.push(transactionData);
    return saveToStorage('transactions', transactions);
}

function saveTransaction(transactionData) {
    const success = addTransactionToStorage(transactionData);
    if (success) {
        renderTransactionList();
    }
    return success;
}

function deleteTransaction(id) {
    const transactions = loadTransactions();
    const filtered = transactions.filter(t => t.id !== id);
    const success = saveToStorage('transactions', filtered);
    if (success) {
        renderTransactionList();
    }
    return success;
}

function updateTransactionComment(id, newComment) {
    const transactions = loadTransactions();
    const transaction = transactions.find(t => t.id === id);

    if (!transaction) return false;

    transaction.comment = sanitizeInput(newComment);
    const success = saveToStorage('transactions', transactions);

    if (success) {
        renderTransactionList();
    }
    return success;
}

function clearAllTransactions() {
    if (!confirm('Are you sure you want to delete all transactions?')) return false;

    const success = removeFromStorage('transactions');
    if (success) {
        renderTransactionList();
    }
    return success;
}

function clearRateCache() {
    if (!confirm('Are you sure you want to clear all cached exchange rates?')) return false;

    const keys = Object.keys(localStorage);
    const rateKeys = keys.filter(key => key.startsWith('currencyRates_'));

    rateKeys.forEach(key => removeFromStorage(key));
    alert('Exchange rate cache cleared successfully.');
    return true;
}

function saveCheckboxState() {
    const checkbox = document.getElementById('addTransactionCheckbox');
    if (!checkbox) return;
    saveToStorage('addTransaction', checkbox.checked);
}

function loadCheckboxState() {
    const checkbox = document.getElementById('addTransactionCheckbox');
    if (!checkbox) return;

    const storedState = getFromStorage('addTransaction', false);
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
        sessionStorage.setItem(`collapsible_${sectionId}`, 'expanded');
    } else {
        // Collapse
        content.classList.add('collapsed');
        icon.classList.add('collapsed');
        sessionStorage.setItem(`collapsible_${sectionId}`, 'collapsed');
    }
}

// Function to restore collapsible states from sessionStorage
function restoreCollapsibleStates() {
    const sections = ['disclaimer', 'howItWorks'];

    sections.forEach(sectionId => {
        const state = sessionStorage.getItem(`collapsible_${sectionId}`);
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

function getCurrencyRatesFromCache(date) {
    return getFromStorage(`currencyRates_${date}`);
}

function saveCurrencyRatesToCache(date, data) {
    saveToStorage(`currencyRates_${date}`, data);
}

function fetchCurrencyRates(date) {
    const apiUrl = `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=${date}`;

    return fetch(apiUrl, { timeout: API_TIMEOUT })
        .then(response => {
            if (!response.ok) {
                throw new Error(ERROR_MESSAGES.API_ERROR);
            }
            return response.json();
        })
        .then(data => {
            saveCurrencyRatesToCache(date, data);
            return data;
        });
}

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

// Function to handle currency data
function createGELCurrencyObject() {
    return {
        code: 'GEL',
        name: 'Georgian Lari',
        rate: 1,
        quantity: 1,
        rateFormated: '1.0000'
    };
}

function validateCurrencyResponse(data) {
    if (!Array.isArray(data) || data.length === 0 || !data[0].currencies) {
        throw new Error(ERROR_MESSAGES.NO_CURRENCY_DATA);
    }
}

function findCurrencyInData(data, currencyCode) {
    if (currencyCode === 'GEL') {
        return createGELCurrencyObject();
    }

    validateCurrencyResponse(data);
    const currencies = data[0].currencies;
    const selectedCurrency = currencies.find(c => c.code === currencyCode);

    if (!selectedCurrency) {
        throw new Error(ERROR_MESSAGES.CURRENCY_NOT_FOUND);
    }

    return selectedCurrency;
}

// convertToGEL is imported from utils.js

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

    // Check if data is cached in localStorage
    const cachedData = localStorage.getItem(`currencyRates_${date}`);
    if (cachedData) {
        // Use cached data
        populateCurrencySelect(JSON.parse(cachedData), currencySelect, isInitialLoad, savedCurrency);
    } else {
        // Fetch data
        const apiUrl = `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=${date}`;
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API error: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // Cache data in localStorage
                localStorage.setItem(`currencyRates_${date}`, JSON.stringify(data));

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

let filterState = {
    userId: 'all',
    currencyCode: 'all',
    dateFrom: '',
    dateTo: '',
    sortColumn: 'date',
    sortDirection: 'desc'
};

// Function to apply filters to transactions
function applyFilters(transactions) {
    let filtered = [...transactions];

    // Filter by user
    if (filterState.userId !== 'all') {
        filtered = filtered.filter(t => t.userId === filterState.userId);
    }

    // Filter by currency
    if (filterState.currencyCode !== 'all') {
        filtered = filtered.filter(t => t.currencyCode === filterState.currencyCode);
    }

    // Filter by date range
    if (filterState.dateFrom) {
        filtered = filtered.filter(t => t.date >= filterState.dateFrom);
    }
    if (filterState.dateTo) {
        filtered = filtered.filter(t => t.date <= filterState.dateTo);
    }

    return filtered;
}

const SORT_STRATEGIES = {
    date: (a, b) => new Date(a.date) - new Date(b.date),
    user: (a, b, userMap) => {
        const userA = userMap.get(a.userId);
        const userB = userMap.get(b.userId);
        const nameA = userA ? userA.name : '';
        const nameB = userB ? userB.name : '';
        return nameA.localeCompare(nameB);
    },
    currency: (a, b) => a.currencyCode.localeCompare(b.currencyCode),
    amount: (a, b) => a.amount - b.amount,
    gel: (a, b) => a.convertedGEL - b.convertedGEL,
    ytd: (a, b, userMap, ytdCache) => {
        const ytdA = ytdCache.get(a.id) || 0;
        const ytdB = ytdCache.get(b.id) || 0;
        return ytdA - ytdB;
    }
};

function sortTransactions(transactions, userMap, ytdCache) {
    const sortStrategy = SORT_STRATEGIES[filterState.sortColumn];
    if (!sortStrategy) return [...transactions];

    const direction = filterState.sortDirection === 'asc' ? 1 : -1;
    const sorted = [...transactions];

    sorted.sort((a, b) => {
        const result = sortStrategy(a, b, userMap, ytdCache);
        return result * direction;
    });

    return sorted;
}

// Function to toggle sort
function toggleSort(column) {
    if (filterState.sortColumn === column) {
        filterState.sortDirection = filterState.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        filterState.sortColumn = column;
        filterState.sortDirection = 'desc';
    }
    renderTransactionList();
}

// Function to clear all filters
function clearFilters() {
    filterState = {
        userId: 'all',
        currencyCode: 'all',
        dateFrom: '',
        dateTo: '',
        sortColumn: 'date',
        sortDirection: 'desc'
    };

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

    let transactions = applyFilters(allTransactions);
    transactions = sortTransactions(transactions, userMap, ytdCache);

    const filterStatus = `Showing ${transactions.length} of ${allTransactions.length} transactions`;
    const tableHTML = buildTransactionTable(transactions, userMap, ytdCache, filterStatus);

    transactionListDiv.innerHTML = tableHTML;
}

// ===========================
// CSV Export/Import
// ===========================

// Function to export transactions to CSV
function exportToCSV() {
    const allTransactions = loadTransactions();

    if (allTransactions.length === 0) {
        alert('No transactions to export.');
        return;
    }

    // Apply current filters
    let transactions = applyFilters(allTransactions);
    transactions = sortTransactions(transactions);

    if (transactions.length === 0) {
        alert('No transactions to export with current filters.');
        return;
    }

    // CSV header
    let csvContent = 'Date,User ID,User Name,Taxpayer ID,Currency Code,Currency Name,Amount,Exchange Rate,Quantity,Converted GEL,YTD Income,Comment,Timestamp\n';

    // Add rows
    transactions.forEach(t => {
        const user = getUserById(t.userId);
        const userName = user ? user.name : '';
        const taxpayerId = user ? user.taxpayerId : '';
        const escapedUserName = `"${userName.replace(/"/g, '""')}"`;
        const escapedCurrencyName = `"${t.currencyName.replace(/"/g, '""')}"`;
        const escapedComment = `"${(t.comment || '').replace(/"/g, '""')}"`;
        const ytdIncome = calculateYTDForTransaction(t, allTransactions);

        csvContent += `${t.date},${t.userId},${escapedUserName},${taxpayerId},${t.currencyCode},${escapedCurrencyName},${t.amount},${t.rate},${t.quantity},${t.convertedGEL},${ytdIncome},${escapedComment},${t.timestamp}\n`;
    });

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    // Filename based on filter
    let filename;
    if (filterState.userId !== 'all') {
        const user = getUserById(filterState.userId);
        const userName = user ? user.name.replace(/[^a-z0-9]/gi, '_') : 'user';
        filename = `gel-transactions-${userName}-${new Date().toISOString().split('T')[0]}.csv`;
    } else {
        filename = `gel-transactions-all-${new Date().toISOString().split('T')[0]}.csv`;
    }

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Function to import transactions from CSV
// validateCSVHeader, parseCSVLine, validateCSVRow are imported from utils.js

function extractTransactionFromCSVRow(values) {
    const hasYTD = values.length >= 13;

    return {
        id: generateTransactionId(),
        userId: values[1],
        date: values[0],
        currencyCode: values[4],
        currencyName: values[5],
        amount: parseFloat(values[6]),
        rate: parseFloat(values[7]),
        quantity: parseFloat(values[8]),
        convertedGEL: parseFloat(values[9]),
        comment: sanitizeInput(hasYTD ? values[11] : values[10]),
        timestamp: hasYTD ? values[12] : values[11]
    };
}

function ensureUserExistsFromCSV(userId, userName, taxpayerId, users, userIds) {
    if (userIds.has(userId)) {
        return { created: false };
    }

    const newUser = {
        id: userId,
        name: sanitizeInput(userName),
        taxpayerId: sanitizeInput(taxpayerId)
    };

    if (validateUser(newUser)) {
        users.push(newUser);
        userIds.add(userId);
        return { created: true, user: newUser };
    }

    return { created: false, error: 'Invalid user data' };
}

function processCSVContent(content) {
    const lines = content.split('\n');
    const header = lines[0].trim();

    validateCSVHeader(header);

    const existingTransactions = loadTransactions();
    const existingTimestamps = new Set(existingTransactions.map(t => t.timestamp));
    const users = loadUsers();
    const userIds = new Set(users.map(u => u.id));

    const stats = { imported: 0, skipped: 0, usersCreated: 0 };

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        if (!validateCSVRow(values)) continue;

        const hasYTD = values.length >= 13;
        const timestamp = hasYTD ? values[12] : values[11];

        if (existingTimestamps.has(timestamp)) {
            stats.skipped++;
            continue;
        }

        const userResult = ensureUserExistsFromCSV(
            values[1],
            values[2],
            values[3],
            users,
            userIds
        );

        if (userResult.created) {
            stats.usersCreated++;
        }

        const transaction = extractTransactionFromCSVRow(values);
        existingTransactions.push(transaction);
        stats.imported++;
    }

    saveToStorage('users', users);
    saveToStorage('transactions', existingTransactions);

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

// Function to load demo data
function loadDemoData() {
    // Check if transactions already exist
    const existingTransactions = loadTransactions();
    if (existingTransactions.length > 0) {
        alert('Error: Cannot load demo data. You already have saved transactions.\n\nPlease use "Clear All" to remove existing transactions first, or use "Import CSV" to add more data.');
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
    const usersSuccess = saveToStorage('users', [defaultUser]);
    const transactionsSuccess = saveToStorage('transactions', []);

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
