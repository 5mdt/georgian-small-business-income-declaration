import { describe, it, expect, beforeEach } from 'vitest';
import {
    convertToGEL,
    calculateYTDForTransaction,
    precalculateAllYTD
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
