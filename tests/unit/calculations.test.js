import { describe, it, expect, beforeEach } from 'vitest';
import {
    convertToGEL,
    calculateYTDForTransaction,
    precalculateAllYTD,
    findLastMonthTransactionIds
} from '../../src/utils.js';

describe('Currency Conversion', () => {
    it('should return amount unchanged for GEL currency', () => {
        const currency = { code: 'GEL', rate: 1, quantity: 1 };
        expect(convertToGEL(100, currency)).toBe(100);
        expect(convertToGEL(1234.56, currency)).toBe(1234.56);
    });

    it('should convert foreign currency to GEL correctly', () => {
        const currency = { code: 'USD', rate: 2.875, quantity: 1 };
        expect(convertToGEL(100, currency)).toBe(287.5);
    });

    it('should handle quantity factor in conversion', () => {
        const currency = { code: 'JPY', rate: 2.50, quantity: 100 };
        expect(convertToGEL(10000, currency)).toBe(250);
    });

    it('should handle decimal amounts', () => {
        const currency = { code: 'EUR', rate: 3.10, quantity: 1 };
        expect(convertToGEL(50.75, currency)).toBeCloseTo(157.325, 2);
    });

    it('should handle edge cases', () => {
        const currency = { code: 'USD', rate: 2.875, quantity: 1 };
        expect(convertToGEL(0.01, currency)).toBeCloseTo(0.02875, 4);
        expect(convertToGEL(1, currency)).toBe(2.875);
    });

    it('should return 0 instead of Infinity/NaN for a zero or negative quantity', () => {
        expect(convertToGEL(100, { code: 'JPY', rate: 2.5, quantity: 0 })).toBe(0);
        expect(convertToGEL(100, { code: 'JPY', rate: 2.5, quantity: -100 })).toBe(0);
    });

    it('should return 0 for non-finite rate or quantity', () => {
        expect(convertToGEL(100, { code: 'USD', rate: NaN, quantity: 1 })).toBe(0);
        expect(convertToGEL(100, { code: 'USD', rate: Infinity, quantity: 1 })).toBe(0);
        expect(convertToGEL(100, { code: 'USD', rate: 2.875, quantity: NaN })).toBe(0);
    });

    it('should return 0 for missing/null currency', () => {
        expect(convertToGEL(100, null)).toBe(0);
        expect(convertToGEL(100, undefined)).toBe(0);
    });
});

describe('YTD Calculation - Single Transaction', () => {
    let transactions;

    beforeEach(() => {
        transactions = [
            {
                id: 'tx1',
                userId: 'user1',
                date: '2025-01-15',
                currencyCode: 'USD',
                amount: 100,
                convertedGEL: 287.5,
                timestamp: '1000'
            },
            {
                id: 'tx2',
                userId: 'user1',
                date: '2025-02-10',
                currencyCode: 'EUR',
                amount: 200,
                convertedGEL: 620,
                timestamp: '2000'
            },
            {
                id: 'tx3',
                userId: 'user1',
                date: '2025-03-05',
                currencyCode: 'GBP',
                amount: 150,
                convertedGEL: 525,
                timestamp: '3000'
            }
        ];
    });

    it('should calculate YTD for first transaction', () => {
        const ytd = calculateYTDForTransaction(transactions[0], transactions);
        expect(ytd).toBe(287.5);
    });

    it('should calculate YTD for middle transaction', () => {
        const ytd = calculateYTDForTransaction(transactions[1], transactions);
        expect(ytd).toBe(287.5 + 620);
    });

    it('should calculate YTD for last transaction', () => {
        const ytd = calculateYTDForTransaction(transactions[2], transactions);
        expect(ytd).toBe(287.5 + 620 + 525);
    });

    it('should only include same user transactions', () => {
        const otherUserTx = {
            id: 'tx4',
            userId: 'user2',
            date: '2025-01-10',
            currencyCode: 'USD',
            amount: 500,
            convertedGEL: 1437.5,
            timestamp: '4000'
        };

        const allTx = [...transactions, otherUserTx];
        const ytd = calculateYTDForTransaction(transactions[0], allTx);
        expect(ytd).toBe(287.5); // Should not include user2's transaction
    });

    it('should only include same calendar year transactions', () => {
        const nextYearTx = {
            id: 'tx5',
            userId: 'user1',
            date: '2026-01-01',
            currencyCode: 'USD',
            amount: 100,
            convertedGEL: 287.5,
            timestamp: '5000'
        };

        const allTx = [...transactions, nextYearTx];
        const ytd = calculateYTDForTransaction(nextYearTx, allTx);
        expect(ytd).toBe(287.5); // Should only include 2026 transactions
    });

    it('should handle transactions on same date with different timestamps', () => {
        const sameDayTx = [
            {
                id: 'tx1',
                userId: 'user1',
                date: '2025-01-15',
                currencyCode: 'USD',
                amount: 100,
                convertedGEL: 287.5,
                timestamp: '1000'
            },
            {
                id: 'tx2',
                userId: 'user1',
                date: '2025-01-15',
                currencyCode: 'EUR',
                amount: 200,
                convertedGEL: 620,
                timestamp: '2000'
            }
        ];

        expect(calculateYTDForTransaction(sameDayTx[0], sameDayTx)).toBe(287.5);
        expect(calculateYTDForTransaction(sameDayTx[1], sameDayTx)).toBe(287.5 + 620);
    });

    it('should return 0 for invalid transaction', () => {
        const invalidTx = { id: 'invalid' };
        expect(calculateYTDForTransaction(invalidTx, transactions)).toBe(0);
    });

    it('should order transactions with missing timestamps before ones that have them', () => {
        const noTimestampTx = {
            id: 'tx-no-ts',
            userId: 'user1',
            date: '2025-01-15',
            currencyCode: 'EUR',
            amount: 50,
            convertedGEL: 155,
            timestamp: undefined
        };

        const withTimestampTx = {
            id: 'tx-with-ts',
            userId: 'user1',
            date: '2025-01-15',
            currencyCode: 'USD',
            amount: 100,
            convertedGEL: 287.5,
            timestamp: '1000'
        };

        const allTx = [noTimestampTx, withTimestampTx];

        // '' (missing timestamp) sorts before '1000' lexicographically
        expect(calculateYTDForTransaction(noTimestampTx, allTx)).toBe(155);
        expect(calculateYTDForTransaction(withTimestampTx, allTx)).toBe(155 + 287.5);
    });

    it('should break ties by id (not date+timestamp) when two transactions collide', () => {
        // Regression test: matching by date+timestamp instead of id caused the
        // loop to stop at whichever colliding transaction it reached first,
        // returning the wrong (too-low) running total for the other one.
        const txA = {
            id: 'tx-a',
            userId: 'user1',
            date: '2025-01-15',
            currencyCode: 'USD',
            amount: 100,
            convertedGEL: 100,
            timestamp: '1000'
        };
        const txB = {
            id: 'tx-b',
            userId: 'user1',
            date: '2025-01-15',
            currencyCode: 'EUR',
            amount: 50,
            convertedGEL: 50,
            timestamp: '1000'
        };

        const allTx = [txA, txB];

        expect(calculateYTDForTransaction(txA, allTx)).toBe(100);
        expect(calculateYTDForTransaction(txB, allTx)).toBe(150);
    });
});

describe('YTD Precalculation - Optimized', () => {
    let transactions;

    beforeEach(() => {
        transactions = [
            {
                id: 'tx1',
                userId: 'user1',
                date: '2025-01-15',
                currencyCode: 'USD',
                amount: 100,
                convertedGEL: 287.5,
                timestamp: '1000'
            },
            {
                id: 'tx2',
                userId: 'user1',
                date: '2025-02-10',
                currencyCode: 'EUR',
                amount: 200,
                convertedGEL: 620,
                timestamp: '2000'
            },
            {
                id: 'tx3',
                userId: 'user2',
                date: '2025-01-20',
                currencyCode: 'GBP',
                amount: 150,
                convertedGEL: 525,
                timestamp: '3000'
            }
        ];
    });

    it('should create YTD cache for all transactions', () => {
        const ytdCache = precalculateAllYTD(transactions);

        expect(ytdCache).toBeInstanceOf(Map);
        expect(ytdCache.size).toBe(3);
    });

    it('should calculate correct YTD values', () => {
        const ytdCache = precalculateAllYTD(transactions);

        expect(ytdCache.get('tx1')).toBe(287.5);
        expect(ytdCache.get('tx2')).toBe(287.5 + 620);
        expect(ytdCache.get('tx3')).toBe(525);
    });

    it('should handle multiple users correctly', () => {
        const multiUserTx = [
            {
                id: 'tx1',
                userId: 'user1',
                date: '2025-01-15',
                currencyCode: 'USD',
                amount: 100,
                convertedGEL: 100,
                timestamp: '1000'
            },
            {
                id: 'tx2',
                userId: 'user2',
                date: '2025-01-15',
                currencyCode: 'USD',
                amount: 200,
                convertedGEL: 200,
                timestamp: '2000'
            },
            {
                id: 'tx3',
                userId: 'user1',
                date: '2025-02-01',
                currencyCode: 'USD',
                amount: 50,
                convertedGEL: 50,
                timestamp: '3000'
            }
        ];

        const ytdCache = precalculateAllYTD(multiUserTx);

        expect(ytdCache.get('tx1')).toBe(100);
        expect(ytdCache.get('tx2')).toBe(200);
        expect(ytdCache.get('tx3')).toBe(150);
    });

    it('should handle multiple years correctly', () => {
        const multiYearTx = [
            {
                id: 'tx1',
                userId: 'user1',
                date: '2024-12-31',
                currencyCode: 'USD',
                amount: 100,
                convertedGEL: 100,
                timestamp: '1000'
            },
            {
                id: 'tx2',
                userId: 'user1',
                date: '2025-01-01',
                currencyCode: 'USD',
                amount: 200,
                convertedGEL: 200,
                timestamp: '2000'
            },
            {
                id: 'tx3',
                userId: 'user1',
                date: '2025-06-15',
                currencyCode: 'USD',
                amount: 50,
                convertedGEL: 50,
                timestamp: '3000'
            }
        ];

        const ytdCache = precalculateAllYTD(multiYearTx);

        expect(ytdCache.get('tx1')).toBe(100);
        expect(ytdCache.get('tx2')).toBe(200); // Reset for new year
        expect(ytdCache.get('tx3')).toBe(250); // Cumulative for 2025
    });

    it('should skip invalid transactions', () => {
        const mixedTx = [
            ...transactions,
            { id: 'invalid', userId: 'user1' }, // Invalid transaction
        ];

        const ytdCache = precalculateAllYTD(mixedTx);
        expect(ytdCache.size).toBe(3); // Should only have valid transactions
    });

    it('should return empty map for empty transaction list', () => {
        const ytdCache = precalculateAllYTD([]);
        expect(ytdCache).toBeInstanceOf(Map);
        expect(ytdCache.size).toBe(0);
    });
});

describe('Last-of-month highlight - findLastMonthTransactionIds', () => {
    it('flags the only transaction in a month', () => {
        const transactions = [
            { id: 'tx1', userId: 'user1', date: '2025-01-15', currencyCode: 'USD', amount: 100, convertedGEL: 287.5, timestamp: '1000' }
        ];

        const ids = findLastMonthTransactionIds(transactions);

        expect(ids).toBeInstanceOf(Set);
        expect(ids.has('tx1')).toBe(true);
        expect(ids.size).toBe(1);
    });

    it('flags only the latest date within a month, not earlier ones', () => {
        const transactions = [
            { id: 'tx1', userId: 'user1', date: '2025-01-05', currencyCode: 'USD', amount: 100, convertedGEL: 100, timestamp: '1000' },
            { id: 'tx2', userId: 'user1', date: '2025-01-15', currencyCode: 'USD', amount: 100, convertedGEL: 100, timestamp: '2000' },
            { id: 'tx3', userId: 'user1', date: '2025-01-28', currencyCode: 'USD', amount: 100, convertedGEL: 100, timestamp: '3000' }
        ];

        const ids = findLastMonthTransactionIds(transactions);

        expect([...ids]).toEqual(['tx3']);
    });

    // Same tie-break as sortTransactions (src/filters.js): date, then
    // timestamp, then id - see the "fix sorting bug" commit.
    it('breaks a same-date tie by timestamp', () => {
        const transactions = [
            { id: 'tx1', userId: 'user1', date: '2025-01-15', currencyCode: 'USD', amount: 100, convertedGEL: 100, timestamp: '2025-01-15T09:00:00.000Z' },
            { id: 'tx2', userId: 'user1', date: '2025-01-15', currencyCode: 'EUR', amount: 50, convertedGEL: 155, timestamp: '2025-01-15T16:45:00.000Z' }
        ];

        const ids = findLastMonthTransactionIds(transactions);

        expect([...ids]).toEqual(['tx2']);
    });

    it('falls back to id when timestamps are equal or missing', () => {
        const transactions = [
            { id: 'tb', userId: 'user1', date: '2025-01-15', currencyCode: 'USD', amount: 100, convertedGEL: 100 },
            { id: 'ta', userId: 'user1', date: '2025-01-15', currencyCode: 'EUR', amount: 50, convertedGEL: 155 }
        ];

        const ids = findLastMonthTransactionIds(transactions);

        expect([...ids]).toEqual(['tb']);
    });

    it('tracks each user independently within the same month', () => {
        const transactions = [
            { id: 'tx1', userId: 'user1', date: '2025-01-05', currencyCode: 'USD', amount: 100, convertedGEL: 100, timestamp: '1000' },
            { id: 'tx2', userId: 'user1', date: '2025-01-20', currencyCode: 'USD', amount: 100, convertedGEL: 100, timestamp: '2000' },
            { id: 'tx3', userId: 'user2', date: '2025-01-10', currencyCode: 'USD', amount: 100, convertedGEL: 100, timestamp: '3000' }
        ];

        const ids = findLastMonthTransactionIds(transactions);

        expect(ids.has('tx2')).toBe(true); // user1's last in January
        expect(ids.has('tx3')).toBe(true); // user2's only transaction in January
        expect(ids.has('tx1')).toBe(false);
        expect(ids.size).toBe(2);
    });

    it('tracks each calendar month independently, including across years', () => {
        const transactions = [
            { id: 'tx1', userId: 'user1', date: '2024-01-10', currencyCode: 'USD', amount: 100, convertedGEL: 100, timestamp: '1000' },
            { id: 'tx2', userId: 'user1', date: '2025-01-10', currencyCode: 'USD', amount: 100, convertedGEL: 100, timestamp: '2000' },
            { id: 'tx3', userId: 'user1', date: '2025-02-10', currencyCode: 'USD', amount: 100, convertedGEL: 100, timestamp: '3000' }
        ];

        const ids = findLastMonthTransactionIds(transactions);

        // Same month number (January) in two different years is two groups.
        expect(ids.has('tx1')).toBe(true);
        expect(ids.has('tx2')).toBe(true);
        expect(ids.has('tx3')).toBe(true);
        expect(ids.size).toBe(3);
    });

    it('skips invalid transactions', () => {
        const transactions = [
            { id: 'tx1', userId: 'user1', date: '2025-01-15', currencyCode: 'USD', amount: 100, convertedGEL: 100, timestamp: '1000' },
            { id: 'invalid', userId: 'user1' }
        ];

        const ids = findLastMonthTransactionIds(transactions);

        expect([...ids]).toEqual(['tx1']);
    });

    it('returns an empty set for an empty transaction list', () => {
        const ids = findLastMonthTransactionIds([]);
        expect(ids).toBeInstanceOf(Set);
        expect(ids.size).toBe(0);
    });
});
