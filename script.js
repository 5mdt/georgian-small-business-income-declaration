// ===========================
// Transaction Management
// ===========================

// Function to generate unique transaction ID
function generateTransactionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
    errorMessage.textContent = '';
    loadingMessage.style.display = 'none';

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
    loadingMessage.style.display = 'block';

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
                loadingMessage.style.display = 'none';
                errorMessage.textContent = `Error: ${error.message}`;
            });
    }
});

// Function to handle currency data
function handleCurrencyData(data, amount, currencyCode, resultDiv, loadingMessage, errorMessage, addAsTransaction) {
    loadingMessage.style.display = 'none';

    if (!Array.isArray(data) || data.length === 0 || !data[0].currencies) {
        throw new Error('No valid currency data available.');
    }

    // Extract currency data
    const currencies = data[0].currencies;
    const selectedCurrency = currencies.find(c => c.code === currencyCode);

    if (!selectedCurrency) {
        throw new Error('Selected currency not found.');
    }

    // Perform conversion to GEL using the correct formula: rate / quantity
    const convertedAmount = (amount * selectedCurrency.rate / selectedCurrency.quantity).toFixed(2);
    const transactionDate = document.getElementById('datePicker').value;

    // Display result
    if (addAsTransaction) {
        // Create transaction object
        const transaction = {
            id: generateTransactionId(),
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
            <p><strong>Transaction Added:</strong> ${amount} ${currencyCode} = ${convertedAmount} GEL</p>
        `;
    } else {
        resultDiv.innerHTML = `
            <p><strong>${amount} ${currencyCode}</strong> = <strong>${convertedAmount} GEL</strong></p>
            <p>Exchange Rate: <strong>${selectedCurrency.rateFormated}</strong></p>
            <p>Quantity Factor: <strong>${selectedCurrency.quantity}</strong></p>
        `;
    }
    resultDiv.style.display = 'block';
}
// Load currencies when date is selected
document.getElementById('datePicker').addEventListener('change', function () {
  loadCurrencies();
});

function loadCurrencies() {
  const date = document.getElementById('datePicker').value;
  const currencySelect = document.getElementById('currencySelect');
  const errorMessage = document.getElementById('errorMessage');
  const loadingMessage = document.getElementById('loadingMessage');

  // Clear previous errors and loading message
  errorMessage.textContent = '';
  loadingMessage.style.display = 'none';

  if (!date) return;

  // Show loading
  currencySelect.innerHTML = '<option value="">Loading...</option>';

  // Check if data is cached in localStorage
  const cachedData = localStorage.getItem(`currencyRates_${date}`);
  if (cachedData) {
      // Use cached data
      populateCurrencySelect(JSON.parse(cachedData), currencySelect);
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

              populateCurrencySelect(data, currencySelect);
          })
          .catch(error => {
              errorMessage.textContent = `Error: ${error.message}`;
          });
  }
}

// Function to populate currency select
function populateCurrencySelect(data, currencySelect) {
  if (!Array.isArray(data) || data.length === 0 || !data[0].currencies) {
      throw new Error('No valid currency data available.');
  }

  // Populate dropdown
  currencySelect.innerHTML = '<option value="">Select a currency</option>';
  data[0].currencies.forEach(currency => {
      const option = document.createElement('option');
      option.value = currency.code;
      option.textContent = `${currency.code} - ${currency.name}`;
      currencySelect.appendChild(option);
  });
}

// ===========================
// Transaction List Display
// ===========================

// Function to render transaction list
function renderTransactionList() {
    const transactions = loadTransactions();
    const transactionListDiv = document.getElementById('transactionList');

    if (!transactionListDiv) return;

    if (transactions.length === 0) {
        transactionListDiv.innerHTML = '<p class="no-transactions">No transactions recorded yet.</p>';
        return;
    }

    // Calculate total GEL
    const totalGEL = transactions.reduce((sum, t) => sum + t.convertedGEL, 0).toFixed(2);

    // Sort transactions by date (newest first)
    transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    let tableHTML = `
        <table class="transaction-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Currency</th>
                    <th>Amount</th>
                    <th>Rate</th>
                    <th>GEL Amount</th>
                    <th>Comment</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    transactions.forEach(t => {
        const commentId = `comment-${t.id}`;
        tableHTML += `
            <tr>
                <td>${t.date}</td>
                <td>${t.currencyCode} - ${t.currencyName}</td>
                <td>${t.amount.toFixed(2)}</td>
                <td>${(t.rate / t.quantity).toFixed(4)}</td>
                <td>${t.convertedGEL.toFixed(2)}</td>
                <td class="comment-cell">
                    <input type="text"
                           id="${commentId}"
                           value="${t.comment || ''}"
                           placeholder="Add comment..."
                           class="comment-input"
                           onblur="updateTransactionComment('${t.id}', this.value)">
                </td>
                <td class="actions-cell">
                    <button class="delete-btn" onclick="deleteTransaction('${t.id}')">Delete</button>
                </td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="4"><strong>Total GEL:</strong></td>
                    <td colspan="3"><strong>${totalGEL}</strong></td>
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
    const transactions = loadTransactions();

    if (transactions.length === 0) {
        alert('No transactions to export.');
        return;
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // CSV header
    let csvContent = 'Date,Currency Code,Currency Name,Amount,Exchange Rate,Quantity,Converted GEL,Comment,Timestamp\n';

    // Add rows
    transactions.forEach(t => {
        const escapedComment = `"${(t.comment || '').replace(/"/g, '""')}"`;
        csvContent += `${t.date},${t.currencyCode},"${t.currencyName}",${t.amount},${t.rate},${t.quantity},${t.convertedGEL},${escapedComment},${t.timestamp}\n`;
    });

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const filename = `gel-transactions-${new Date().toISOString().split('T')[0]}.csv`;

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

    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const lines = content.split('\n');

            // Validate header
            const header = lines[0].trim();
            const expectedHeader = 'Date,Currency Code,Currency Name,Amount,Exchange Rate,Quantity,Converted GEL,Comment,Timestamp';

            if (!header.includes('Date') || !header.includes('Currency Code') || !header.includes('Converted GEL')) {
                throw new Error('Invalid CSV format. Missing required columns.');
            }

            const existingTransactions = loadTransactions();
            const existingTimestamps = new Set(existingTransactions.map(t => t.timestamp));
            let imported = 0;
            let skipped = 0;

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

                if (values.length < 9) continue;

                const timestamp = values[8];

                // Skip duplicates
                if (existingTimestamps.has(timestamp)) {
                    skipped++;
                    continue;
                }

                const transaction = {
                    id: generateTransactionId(),
                    date: values[0],
                    currencyCode: values[1],
                    currencyName: values[2],
                    amount: parseFloat(values[3]),
                    rate: parseFloat(values[4]),
                    quantity: parseFloat(values[5]),
                    convertedGEL: parseFloat(values[6]),
                    comment: values[7],
                    timestamp: timestamp
                };

                existingTransactions.push(transaction);
                imported++;
            }

            localStorage.setItem('transactions', JSON.stringify(existingTransactions));
            renderTransactionList();

            alert(`Import completed!\nImported: ${imported}\nSkipped (duplicates): ${skipped}`);
        } catch (error) {
            alert(`Import failed: ${error.message}`);
        }
    };

    reader.onerror = function() {
        alert('Failed to read file.');
    };

    reader.readAsText(file);
}

// Set default date to today and load currencies
window.onload = function () {
  document.getElementById('datePicker').value = new Date().toISOString().split('T')[0];
  loadCurrencies();
  renderTransactionList();
};
