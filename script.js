// ===========================
// User Management
// ===========================

// Function to load all users from localStorage
function loadUsers() {
    const stored = localStorage.getItem('users');
    if (!stored) {
        // Create default user
        const defaultUser = { id: 'user', name: 'user', taxpayerId: '' };
        localStorage.setItem('users', JSON.stringify([defaultUser]));
        return [defaultUser];
    }
    return JSON.parse(stored);
}

// Function to save a user to localStorage
function saveUser(userData) {
    const users = loadUsers();
    const existingIndex = users.findIndex(u => u.id === userData.id);

    if (existingIndex >= 0) {
        users[existingIndex] = userData;
    } else {
        users.push(userData);
    }

    localStorage.setItem('users', JSON.stringify(users));
    renderUserList();
    populateUserSelectors();
}

// Function to delete a user by ID
function deleteUser(userId) {
    const users = loadUsers();
    const transactions = loadTransactions();

    // Check if user has transactions
    const userTransactions = transactions.filter(t => t.userId === userId);
    if (userTransactions.length > 0) {
        if (!confirm(`This user has ${userTransactions.length} transaction(s). Delete anyway?`)) {
            return;
        }
    }

    // Prevent deleting last user
    if (users.length <= 1) {
        alert('Cannot delete the last user.');
        return;
    }

    const filtered = users.filter(u => u.id !== userId);
    localStorage.setItem('users', JSON.stringify(filtered));

    renderUserList();
    populateUserSelectors();
}

// Function to get user by ID
function getUserById(userId) {
    const users = loadUsers();
    return users.find(u => u.id === userId);
}

// Function to generate unique user ID
function generateUserId() {
    return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ===========================
// Transaction Management
// ===========================

// Function to generate unique transaction ID
function generateTransactionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Function to format currency with thousand separators
function formatCurrency(value) {
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Function to get currency symbol
function getCurrencySymbol(currencyCode) {
    const symbols = {
        'GEL': '₾',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'RUB': '₽',
        'TRY': '₺',
        'JPY': '¥',
        'CNY': '¥',
        'CHF': 'CHF',
        'AUD': 'A$',
        'CAD': 'C$',
        'INR': '₹',
        'KRW': '₩',
        'BRL': 'R$',
        'ZAR': 'R',
        'SEK': 'kr',
        'NOK': 'kr',
        'DKK': 'kr',
        'PLN': 'zł',
        'ILS': '₪',
        'AED': 'د.إ',
        'SAR': '﷼',
        'THB': '฿'
    };
    return symbols[currencyCode] || currencyCode;
}

// Function to calculate Year-to-Date income for a specific transaction
function calculateYTDForTransaction(transaction, allTransactions) {
    const year = new Date(transaction.date).getFullYear();

    // Filter transactions for same user and year, up to and including current date
    const ytdTransactions = allTransactions.filter(t => {
        const tYear = new Date(t.date).getFullYear();
        return t.userId === transaction.userId &&
            tYear === year &&
            t.date <= transaction.date;
    });

    // Sort by date and calculate running total
    ytdTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningTotal = 0;
    for (const t of ytdTransactions) {
        runningTotal += t.convertedGEL;
        if (t.id === transaction.id || (t.date === transaction.date && t.timestamp === transaction.timestamp)) {
            return runningTotal;
        }
    }

    return runningTotal;
}

// Function to save a transaction to localStorage
function saveTransaction(transactionData) {
    const transactions = loadTransactions();
    transactions.push(transactionData);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    renderTransactionList();
}

// Function to load all transactions from localStorage
function loadTransactions() {
    const stored = localStorage.getItem('transactions');
    return stored ? JSON.parse(stored) : [];
}

// Function to delete a transaction by ID
function deleteTransaction(id) {
    const transactions = loadTransactions();
    const filtered = transactions.filter(t => t.id !== id);
    localStorage.setItem('transactions', JSON.stringify(filtered));
    renderTransactionList();
}

// Function to update transaction comment
function updateTransactionComment(id, newComment) {
    const transactions = loadTransactions();
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
        transaction.comment = newComment;
        localStorage.setItem('transactions', JSON.stringify(transactions));
        renderTransactionList();
    }
}

// Function to clear all transactions
function clearAllTransactions() {
    if (confirm('Are you sure you want to delete all transactions?')) {
        localStorage.removeItem('transactions');
        renderTransactionList();
    }
}

// Function to clear all cached currency rates
function clearRateCache() {
    if (confirm('Are you sure you want to clear all cached exchange rates?')) {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('currencyRates_')) {
                localStorage.removeItem(key);
            }
        });
        alert('Exchange rate cache cleared successfully.');
    }
}

// Function to save checkbox state
function saveCheckboxState() {
    const checkbox = document.getElementById('addTransactionCheckbox');
    localStorage.setItem('addTransaction', checkbox.checked);
}

// Function to load checkbox state
function loadCheckboxState() {
    const checkbox = document.getElementById('addTransactionCheckbox');
    const storedState = localStorage.getItem('addTransaction');
    if (storedState === 'true') {
        checkbox.checked = true;
    } else {
        checkbox.checked = false;
    }
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

// Load checkbox state on page load
window.onload = function () {
    loadCheckboxState();
    document.getElementById('datePicker').value = new Date().toISOString().split('T')[0];
    loadCurrencies();

    // Save checkbox state when changed
    document.getElementById('addTransactionCheckbox').addEventListener('change', saveCheckboxState);
};

// Modify button behavior based on checkbox state
document.getElementById('fetchButton').addEventListener('click', function () {
    const date = document.getElementById('datePicker').value;
    const currencyCode = document.getElementById('currencySelect').value;
    const amount = parseFloat(document.getElementById('amountInput').value);
    const errorMessage = document.getElementById('errorMessage');
    const resultDiv = document.getElementById('result');
    const loadingMessage = document.getElementById('loadingMessage');
    const checkbox = document.getElementById('addTransactionCheckbox');

    // Clear previous results
    resultDiv.innerHTML = '';
    resultDiv.classList.add('hidden');
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
    loadingMessage.classList.add('hidden');

    // Input validation
    if (!date) {
        errorMessage.textContent = 'Please select a date.';
        return;
    }
    if (!currencyCode) {
        errorMessage.textContent = 'Please select a currency.';
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        errorMessage.textContent = 'Please enter a valid amount.';
        return;
    }

    // Show loading message
    loadingMessage.classList.remove('hidden');

    // Check if data is cached in localStorage
    const cachedData = localStorage.getItem(`currencyRates_${date}`);
    if (cachedData) {
        // Use cached data
        handleCurrencyData(JSON.parse(cachedData), amount, currencyCode, resultDiv, loadingMessage, errorMessage, checkbox.checked);
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

                handleCurrencyData(data, amount, currencyCode, resultDiv, loadingMessage, errorMessage, checkbox.checked);
            })
            .catch(error => {
                loadingMessage.classList.add('hidden');
                errorMessage.textContent = `Error: ${error.message}`;
                errorMessage.classList.remove('hidden');
            });
    }
});

// Function to handle currency data
function handleCurrencyData(data, amount, currencyCode, resultDiv, loadingMessage, errorMessage, addAsTransaction) {
    loadingMessage.classList.add('hidden');

    let selectedCurrency;
    let convertedAmount;

    // Handle GEL (no conversion needed)
    if (currencyCode === 'GEL') {
        selectedCurrency = {
            code: 'GEL',
            name: 'Georgian Lari',
            rate: 1,
            quantity: 1,
            rateFormated: '1.0000'
        };
        convertedAmount = amount.toFixed(2);
    } else {
        if (!Array.isArray(data) || data.length === 0 || !data[0].currencies) {
            throw new Error('No valid currency data available.');
        }

        // Extract currency data
        const currencies = data[0].currencies;
        selectedCurrency = currencies.find(c => c.code === currencyCode);

        if (!selectedCurrency) {
            throw new Error('Selected currency not found.');
        }

        // Perform conversion to GEL using the correct formula: rate / quantity
        convertedAmount = (amount * selectedCurrency.rate / selectedCurrency.quantity).toFixed(2);
    }

    const transactionDate = document.getElementById('datePicker').value;

    // Display result
    if (addAsTransaction) {
        // Get selected user
        const userSelect = document.getElementById('userSelect');
        const selectedUserId = userSelect ? userSelect.value : 'user';

        // Create transaction object
        const transaction = {
            id: generateTransactionId(),
            userId: selectedUserId,
            date: transactionDate,
            currencyCode: currencyCode,
            currencyName: selectedCurrency.name,
            amount: amount,
            rate: selectedCurrency.rate,
            quantity: selectedCurrency.quantity,
            convertedGEL: parseFloat(convertedAmount),
            comment: '',
            timestamp: new Date().toISOString()
        };

        // Save transaction to localStorage
        saveTransaction(transaction);

        resultDiv.innerHTML = `
            <p><strong>Transaction Added:</strong> ${formatCurrency(amount)} ${currencyCode} = ${formatCurrency(parseFloat(convertedAmount))} GEL</p>
        `;
    } else {
        if (currencyCode === 'GEL') {
            resultDiv.innerHTML = `
                <p><strong>${formatCurrency(amount)} GEL</strong></p>
            `;
        } else {
            resultDiv.innerHTML = `
                <p><strong>${formatCurrency(amount)} ${currencyCode}</strong> = <strong>${formatCurrency(parseFloat(convertedAmount))} GEL</strong></p>
                <p>Exchange Rate: <strong>${selectedCurrency.rateFormated}</strong></p>
                <p>Quantity Factor: <strong>${selectedCurrency.quantity}</strong></p>
            `;
        }
    }
    resultDiv.classList.remove('hidden');
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

// Function to sort transactions
function sortTransactions(transactions) {
    const sorted = [...transactions];
    const direction = filterState.sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
        let aVal, bVal;

        switch (filterState.sortColumn) {
            case 'date':
                aVal = new Date(a.date);
                bVal = new Date(b.date);
                break;
            case 'user':
                const userA = getUserById(a.userId);
                const userB = getUserById(b.userId);
                aVal = userA ? userA.name : '';
                bVal = userB ? userB.name : '';
                return aVal.localeCompare(bVal) * direction;
            case 'currency':
                aVal = a.currencyCode;
                bVal = b.currencyCode;
                return aVal.localeCompare(bVal) * direction;
            case 'amount':
                aVal = a.amount;
                bVal = b.amount;
                break;
            case 'gel':
                aVal = a.convertedGEL;
                bVal = b.convertedGEL;
                break;
            case 'ytd':
                aVal = calculateYTDForTransaction(a, transactions);
                bVal = calculateYTDForTransaction(b, transactions);
                break;
            default:
                return 0;
        }

        if (aVal < bVal) return -1 * direction;
        if (aVal > bVal) return 1 * direction;
        return 0;
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

// Function to render transaction list
function renderTransactionList() {
    const allTransactions = loadTransactions();
    const transactionListDiv = document.getElementById('transactionList');

    if (!transactionListDiv) return;

    if (allTransactions.length === 0) {
        transactionListDiv.innerHTML = '<p class="no-data">No transactions recorded yet.</p>';
        return;
    }

    // Apply filters and sort
    let transactions = applyFilters(allTransactions);
    transactions = sortTransactions(transactions);

    // Calculate total GEL for filtered results
    const totalGEL = transactions.reduce((sum, t) => sum + t.convertedGEL, 0).toFixed(2);

    // Show filter status
    const filterStatus = `Showing ${transactions.length} of ${allTransactions.length} transactions`;

    // Get sort indicators
    const getSortIndicator = (column) => {
        if (filterState.sortColumn !== column) return '';
        return filterState.sortDirection === 'asc' ? ' ▲' : ' ▼';
    };

    let tableHTML = `
        <p class="filter-status">${filterStatus}</p>
        <table>
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
            <tbody>
    `;

    transactions.forEach(t => {
        const commentId = `comment-${t.id}`;
        const user = getUserById(t.userId);
        const userName = user ? user.name : 'Unknown';
        const ytdIncome = calculateYTDForTransaction(t, allTransactions);
        const currencySymbol = getCurrencySymbol(t.currencyCode);

        tableHTML += `
            <tr>
                <td>${t.date}</td>
                <td>${userName}</td>
                <td>${t.currencyCode} - ${t.currencyName}</td>
                <td>${currencySymbol} ${formatCurrency(t.amount)}</td>
                <td>${(t.rate / t.quantity).toFixed(4)}</td>
                <td>₾ ${formatCurrency(t.convertedGEL)}</td>
                <td><strong>₾ ${formatCurrency(ytdIncome)}</strong></td>
                <td>
                    <input type="text"
                            id="${commentId}"
                            value="${t.comment || ''}"
                            placeholder="Add comment..."
                            class="input-inline"
                            onblur="updateTransactionComment('${t.id}', this.value)">
                </td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${t.id}')">🗑️</button>
                </td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="5"><strong>Total GEL:</strong></td>
                    <td colspan="4"><strong>₾ ${formatCurrency(parseFloat(totalGEL))}</strong></td>
                </tr>
            </tfoot>
        </table>
    `;

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
function importFromCSV(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const content = e.target.result;
            const lines = content.split('\n');

            // Validate header
            const header = lines[0].trim();

            if (!header.includes('Date') || !header.includes('Currency Code') || !header.includes('Converted GEL')) {
                throw new Error('Invalid CSV format. Missing required columns.');
            }

            const existingTransactions = loadTransactions();
            const existingTimestamps = new Set(existingTransactions.map(t => t.timestamp));
            const users = loadUsers();
            let imported = 0;
            let skipped = 0;
            let usersCreated = 0;

            // Parse data rows
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Parse CSV line (handle quoted values)
                const regex = /("([^"]|"")*"|[^,]+)/g;
                const values = [];
                let match;
                while ((match = regex.exec(line)) !== null) {
                    let value = match[0];
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1).replace(/""/g, '"');
                    }
                    values.push(value);
                }

                // Support both old format (12 cols) and new format (13 cols with YTD)
                if (values.length < 12) continue;

                const hasYTD = values.length >= 13;
                const timestamp = hasYTD ? values[12] : values[11];

                // Skip duplicates
                if (existingTimestamps.has(timestamp)) {
                    skipped++;
                    continue;
                }

                // Check if user exists, create if not
                const userId = values[1];
                const userName = values[2];
                const taxpayerId = values[3];

                if (!getUserById(userId)) {
                    const newUser = { id: userId, name: userName, taxpayerId: taxpayerId };
                    users.push(newUser);
                    usersCreated++;
                }

                const transaction = {
                    id: generateTransactionId(),
                    userId: userId,
                    date: values[0],
                    currencyCode: values[4],
                    currencyName: values[5],
                    amount: parseFloat(values[6]),
                    rate: parseFloat(values[7]),
                    quantity: parseFloat(values[8]),
                    convertedGEL: parseFloat(values[9]),
                    comment: hasYTD ? values[11] : values[10],
                    timestamp: timestamp
                };

                existingTransactions.push(transaction);
                imported++;
            }

            localStorage.setItem('users', JSON.stringify(users));
            localStorage.setItem('transactions', JSON.stringify(existingTransactions));
            renderTransactionList();
            renderUserList();
            populateUserSelectors();

            alert(`Import completed!\nImported: ${imported}\nSkipped (duplicates): ${skipped}\nNew users created: ${usersCreated}`);
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
                           class="input-inline"
                           onblur="updateUserField('${u.id}', 'name', this.value)">
                </td>
                <td>
                    <input type="text"
                           id="${taxpayerId}"
                           value="${u.taxpayerId}"
                           class="input-inline"
                           onblur="updateUserField('${u.id}', 'taxpayerId', this.value)">
                </td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">🗑️</button>
                </td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    userListDiv.innerHTML = tableHTML;
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

// Set default date to today and load currencies
window.onload = function () {
    loadCheckboxState();
    restoreCollapsibleStates(); // Restore collapsible section states
    const today = getTodayDate();
    document.getElementById('datePicker').value = today;
    setMaxDates();
    loadCurrencies(true); // Pass true for initial load to set GEL as default
    renderTransactionList();
    renderUserList();
    populateUserSelectors();

    // Save checkbox state when changed
    document.getElementById('addTransactionCheckbox').addEventListener('change', saveCheckboxState);

    // Allow Enter key in amount field to trigger convert button
    document.getElementById('amountInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('fetchButton').click();
        }
    });
};
