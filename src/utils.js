// ===========================
// Constants
// ===========================

export const CURRENCY_SYMBOLS = {
    'GEL': '₾', 'USD': '$', 'EUR': '€', 'GBP': '£', 'RUB': '₽',
    'TRY': '₺', 'JPY': '¥', 'CNY': '¥', 'CHF': 'CHF', 'AUD': 'A$',
    'CAD': 'C$', 'INR': '₹', 'KRW': '₩', 'BRL': 'R$', 'ZAR': 'R',
    'SEK': 'kr', 'NOK': 'kr', 'DKK': 'kr', 'PLN': 'zł', 'ILS': '₪',
    'AED': 'د.إ', 'SAR': '﷼', 'THB': '฿'
};

export const ERROR_MESSAGES = {
    NO_DATE: 'Please select a date.',
    NO_CURRENCY: 'Please select a currency.',
    INVALID_AMOUNT: 'Please enter a valid amount.',
    FUTURE_DATE: 'Cannot select a future date. Please select today or an earlier date.',
    INVALID_DATE: 'Invalid date format.',
    CORRUPTED_DATA: 'Data storage corrupted. Resetting to defaults.',
    QUOTA_EXCEEDED: 'Storage quota exceeded. Please export and clear old data.',
    INVALID_CSV: 'Invalid CSV format. Missing required columns.',
    API_ERROR: 'Failed to fetch exchange rates. Please try again.',
    NO_CURRENCY_DATA: 'No valid currency data available.',
    CURRENCY_NOT_FOUND: 'Selected currency not found.'
};

export const MAX_AMOUNT = 1000000000;
export const MIN_YEAR = 2000;
export const API_TIMEOUT = 10000;
export const FILTER_DEBOUNCE_MS = 300;

// ===========================
// Validation Utilities
// ===========================

/**
 * Validates a date string
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 * @returns {boolean} True if valid
 */
export function validateDateString(dateString) {
    if (!dateString) return false;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;
    const year = date.getFullYear();
    if (year < MIN_YEAR || year > 2100) return false;
    return true;
}

/**
 * Validates an amount
 * @param {number} amount - Amount to validate
 * @returns {boolean} True if valid
 */
export function validateAmount(amount) {
    if (typeof amount !== 'number') return false;
    if (isNaN(amount) || !isFinite(amount)) return false;
    if (amount <= 0 || amount > MAX_AMOUNT) return false;
    return true;
}

/**
 * Validates a currency code
 * @param {string} code - 3-letter currency code
 * @returns {boolean} True if valid
 */
export function validateCurrencyCode(code) {
    if (!code || typeof code !== 'string') return false;
    return /^[A-Z]{3}$/.test(code);
}

/**
 * Validates a user object
 * @param {Object} user - User object
 * @returns {boolean} True if valid
 */
export function validateUser(user) {
    if (!user || typeof user !== 'object') return false;
    if (!user.id || typeof user.id !== 'string') return false;
    if (!user.name || typeof user.name !== 'string') return false;
    return true;
}

/**
 * Validates a transaction object
 * @param {Object} transaction - Transaction object
 * @returns {boolean} True if valid
 */
export function validateTransaction(transaction) {
    if (!transaction || typeof transaction !== 'object') return false;
    if (!transaction.id || !transaction.userId) return false;
    if (!validateDateString(transaction.date)) return false;
    if (!validateCurrencyCode(transaction.currencyCode)) return false;
    if (!validateAmount(transaction.amount)) return false;
    if (!validateAmount(transaction.convertedGEL)) return false;
    return true;
}

// ===========================
// Formatting Utilities
// ===========================

/**
 * Formats a number as currency with thousand separators
 * @param {number} value - Value to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value) {
    if (!isFinite(value)) return '0.00';
    return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Gets currency symbol for a currency code
 * @param {string} currencyCode - 3-letter currency code
 * @returns {string} Currency symbol or code if not found
 */
export function getCurrencySymbol(currencyCode) {
    return CURRENCY_SYMBOLS[currencyCode] || currencyCode;
}

// ===========================
// ID Generation
// ===========================

/**
 * Generates a unique user ID
 * @returns {string} Unique user ID
 */
export function generateUserId() {
    return 'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Generates a unique transaction ID
 * @returns {string} Unique transaction ID
 */
export function generateTransactionId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ===========================
// Calculation Utilities
// ===========================

/**
 * Converts amount to GEL using currency rate
 * @param {number} amount - Amount to convert
 * @param {Object} currency - Currency object with rate and quantity
 * @returns {number} Converted amount in GEL
 */
export function convertToGEL(amount, currency) {
    if (currency.code === 'GEL') {
        return amount;
    }
    return amount * currency.rate / currency.quantity;
}

/**
 * Precalculates YTD for all transactions (optimized)
 * @param {Array} transactions - Array of transaction objects
 * @returns {Map} Map of transaction ID to YTD value
 */
export function precalculateAllYTD(transactions) {
    const ytdCache = new Map();

    // Filter out invalid transactions first, then sort
    const validTransactions = transactions.filter(tx => validateTransaction(tx));
    const sorted = [...validTransactions].sort((a, b) => {
        if (a.userId !== b.userId) return a.userId.localeCompare(b.userId);
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.timestamp || '').localeCompare(b.timestamp || '');
    });

    const runningTotals = {};

    for (const tx of sorted) {
        const year = new Date(tx.date).getFullYear();
        const key = `${tx.userId}_${year}`;

        if (runningTotals[key] === undefined) {
            runningTotals[key] = 0;
        }

        runningTotals[key] += tx.convertedGEL;
        ytdCache.set(tx.id, runningTotals[key]);
    }

    return ytdCache;
}

/**
 * Calculates YTD for a single transaction
 * @param {Object} transaction - Transaction object
 * @param {Array} allTransactions - All transactions
 * @returns {number} YTD value
 */
export function calculateYTDForTransaction(transaction, allTransactions) {
    if (!validateTransaction(transaction)) return 0;

    const year = new Date(transaction.date).getFullYear();
    const ytdTransactions = allTransactions.filter(t => {
        if (!validateTransaction(t)) return false;
        const tYear = new Date(t.date).getFullYear();
        return t.userId === transaction.userId &&
            tYear === year &&
            t.date <= transaction.date;
    });

    ytdTransactions.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.timestamp || '').localeCompare(b.timestamp || '');
    });

    let runningTotal = 0;
    for (const t of ytdTransactions) {
        runningTotal += t.convertedGEL;
        if (t.id === transaction.id || (t.date === transaction.date && t.timestamp === transaction.timestamp)) {
            return runningTotal;
        }
    }

    return runningTotal;
}

// ===========================
// CSV Utilities
// ===========================

/**
 * Validates CSV header
 * @param {string} header - CSV header line
 * @returns {boolean} True if valid
 * @throws {Error} If required columns are missing
 */
export function validateCSVHeader(header) {
    const requiredColumns = ['Date', 'Currency Code', 'Converted GEL'];
    const missingColumns = requiredColumns.filter(col => !header.includes(col));

    if (missingColumns.length > 0) {
        throw new Error(ERROR_MESSAGES.INVALID_CSV);
    }
    return true;
}

/**
 * Parses a CSV line handling quoted values
 * @param {string} line - CSV line
 * @returns {Array<string>} Array of values
 */
export function parseCSVLine(line) {
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

    return values;
}

/**
 * Validates CSV row values
 * @param {Array<string>} values - CSV row values
 * @returns {boolean} True if valid
 */
export function validateCSVRow(values) {
    if (values.length < 12) return false;
    if (!validateDateString(values[0])) return false;
    if (!validateCurrencyCode(values[4])) return false;
    if (isNaN(parseFloat(values[6])) || isNaN(parseFloat(values[9]))) return false;
    return true;
}

// ===========================
// Utility Functions
// ===========================

/**
 * Builds a lookup map of users by ID
 * @param {Array} users - Array of user objects
 * @returns {Map} Map of user ID to user object
 */
export function buildUserLookupMap(users) {
    return new Map(users.map(u => [u.id, u]));
}

/**
 * Creates default user object
 * @returns {Object} Default user
 */
export function createDefaultUser() {
    return { id: 'user', name: 'user', taxpayerId: '' };
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
