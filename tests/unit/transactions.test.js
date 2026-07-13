import { describe, it, expect, beforeEach } from 'vitest';
import {
    loadTransactions,
    addTransactionToStorage,
    removeTransactionFromStorage,
    updateTransactionCommentInStorage,
    removeUserTransactions
} from '../../src/transactions.js';

function makeTransaction(overrides = {}) {
    return {
        id: 'tx_1',
        userId: 'user',
        date: '2025-01-15',
        currencyCode: 'USD',
        currencyName: 'US Dollar',
        amount: 100,
        rate: 2.875,
        quantity: 1,
        convertedGEL: 287.5,
        comment: '',
        timestamp: '1000',
        ...overrides
    };
}

describe('loadTransactions', () => {
    beforeEach(() => {
        global.localStorage.clear();
    });

    it('returns an empty array when nothing is stored', () => {
        expect(loadTransactions()).toEqual([]);
    });

    it('returns stored valid transactions', () => {
        const tx = makeTransaction();
        global.localStorage.setItem('transactions', JSON.stringify([tx]));
        expect(loadTransactions()).toEqual([tx]);
    });

    it('filters out invalid transactions rather than throwing', () => {
        const valid = makeTransaction();
        const invalid = { id: 'broken' };
        global.localStorage.setItem('transactions', JSON.stringify([valid, invalid]));

        expect(loadTransactions()).toEqual([valid]);
    });

    it('returns an empty array if the stored value is not an array', () => {
        global.localStorage.setItem('transactions', JSON.stringify({ not: 'an array' }));
        expect(loadTransactions()).toEqual([]);
    });
});

describe('addTransactionToStorage', () => {
    beforeEach(() => {
        global.localStorage.clear();
    });

    it('appends a valid transaction', () => {
        const tx = makeTransaction();
        expect(addTransactionToStorage(tx)).toBe(true);
        expect(loadTransactions()).toEqual([tx]);
    });

    it('rejects an invalid transaction without touching storage', () => {
        expect(addTransactionToStorage({ id: 'bad' })).toBe(false);
        expect(loadTransactions()).toEqual([]);
    });

    it('accumulates multiple transactions', () => {
        addTransactionToStorage(makeTransaction({ id: 'tx_1' }));
        addTransactionToStorage(makeTransaction({ id: 'tx_2' }));
        expect(loadTransactions()).toHaveLength(2);
    });
});

describe('removeTransactionFromStorage', () => {
    beforeEach(() => {
        global.localStorage.clear();
        addTransactionToStorage(makeTransaction({ id: 'tx_1' }));
        addTransactionToStorage(makeTransaction({ id: 'tx_2' }));
    });

    it('removes only the targeted transaction', () => {
        removeTransactionFromStorage('tx_1');
        const remaining = loadTransactions();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].id).toBe('tx_2');
    });

    it('is a no-op when the id does not exist', () => {
        removeTransactionFromStorage('nonexistent');
        expect(loadTransactions()).toHaveLength(2);
    });
});

describe('updateTransactionCommentInStorage', () => {
    beforeEach(() => {
        global.localStorage.clear();
        addTransactionToStorage(makeTransaction({ id: 'tx_1', comment: '' }));
    });

    it('updates and sanitizes the comment', () => {
        const success = updateTransactionCommentInStorage('tx_1', '<b>note</b>');
        expect(success).toBe(true);
        expect(loadTransactions()[0].comment).toBe('&lt;b&gt;note&lt;/b&gt;');
    });

    it('returns false when the transaction id is not found', () => {
        expect(updateTransactionCommentInStorage('missing', 'text')).toBe(false);
    });
});

describe('removeUserTransactions', () => {
    beforeEach(() => {
        global.localStorage.clear();
        addTransactionToStorage(makeTransaction({ id: 'tx_1', userId: 'user_a' }));
        addTransactionToStorage(makeTransaction({ id: 'tx_2', userId: 'user_b' }));
        addTransactionToStorage(makeTransaction({ id: 'tx_3', userId: 'user_a' }));
    });

    it('removes only transactions belonging to the given user (cascading delete)', () => {
        removeUserTransactions('user_a');
        const remaining = loadTransactions();
        expect(remaining).toHaveLength(1);
        expect(remaining[0].userId).toBe('user_b');
    });

    it('leaves all transactions untouched if the user has none', () => {
        removeUserTransactions('user_c');
        expect(loadTransactions()).toHaveLength(3);
    });
});
