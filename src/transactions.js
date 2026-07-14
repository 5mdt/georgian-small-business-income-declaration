// ===========================
// Transaction Management (storage layer)
// ===========================
//
// Extracted from script.js. Deliberately excludes any DOM
// rendering/refresh calls - script.js wraps these with
// renderTransactionList() after calling them, so this module can be
// tested without a DOM fixture.

import { getFromStorage, saveToStorage } from './storage.js';
import { validateTransaction } from './utils.js';
import { sanitizeInput } from './dom.js';
import { STORAGE_KEYS } from './keys.js';

/**
 * Loads valid transactions from storage.
 * @returns {Array<Object>}
 */
export function loadTransactions() {
    const transactions = getFromStorage(STORAGE_KEYS.transactions, []);
    if (!Array.isArray(transactions)) return [];
    return transactions.filter(validateTransaction);
}

/**
 * Appends a transaction to storage.
 * @param {Object} transactionData
 * @returns {boolean} True on success
 */
export function addTransactionToStorage(transactionData) {
    if (!validateTransaction(transactionData)) {
        console.error('Invalid transaction data', transactionData);
        return false;
    }

    const transactions = loadTransactions();
    transactions.push(transactionData);
    return saveToStorage(STORAGE_KEYS.transactions, transactions);
}

/**
 * Removes a single transaction by id.
 * @param {string} id
 * @returns {boolean} True on success
 */
export function removeTransactionFromStorage(id) {
    const transactions = loadTransactions();
    const filtered = transactions.filter(t => t.id !== id);
    return saveToStorage(STORAGE_KEYS.transactions, filtered);
}

/**
 * Updates (sanitized) the comment on a transaction.
 * @param {string} id
 * @param {string} newComment
 * @returns {boolean} True on success, false if the transaction wasn't found
 */
export function updateTransactionCommentInStorage(id, newComment) {
    const transactions = loadTransactions();
    const transaction = transactions.find(t => t.id === id);

    if (!transaction) return false;

    transaction.comment = sanitizeInput(newComment);
    return saveToStorage(STORAGE_KEYS.transactions, transactions);
}

/**
 * Removes all transactions belonging to a user (used for cascading user
 * deletion).
 * @param {string} userId
 * @returns {boolean} True on success
 */
export function removeUserTransactions(userId) {
    const transactions = loadTransactions();
    const filteredTransactions = transactions.filter(t => t.userId !== userId);
    return saveToStorage(STORAGE_KEYS.transactions, filteredTransactions);
}
