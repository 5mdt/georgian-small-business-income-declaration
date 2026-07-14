import { describe, it, expect } from 'vitest';
import {
    createDefaultFilterState,
    applyFilters,
    SORT_STRATEGIES,
    sortTransactions,
    computeNextSortState
} from '../../src/filters.js';

const transactions = [
    { id: 't1', userId: 'u1', currencyCode: 'USD', date: '2025-01-10', amount: 100, convertedGEL: 287.5 },
    { id: 't2', userId: 'u2', currencyCode: 'EUR', date: '2025-02-05', amount: 50, convertedGEL: 155 },
    { id: 't3', userId: 'u1', currencyCode: 'EUR', date: '2025-03-01', amount: 200, convertedGEL: 620 }
];

describe('createDefaultFilterState', () => {
    it('returns the "no filters, newest first" default', () => {
        expect(createDefaultFilterState()).toEqual({
            userId: 'all',
            currencyCode: 'all',
            dateFrom: '',
            dateTo: '',
            sortColumn: 'date',
            sortDirection: 'desc'
        });
    });

    it('returns a fresh object each call', () => {
        expect(createDefaultFilterState()).not.toBe(createDefaultFilterState());
    });
});

describe('applyFilters', () => {
    it('returns everything when all filters are "all"/empty', () => {
        expect(applyFilters(transactions, createDefaultFilterState())).toHaveLength(3);
    });

    it('filters by user', () => {
        const result = applyFilters(transactions, { ...createDefaultFilterState(), userId: 'u1' });
        expect(result.map(t => t.id)).toEqual(['t1', 't3']);
    });

    it('filters by currency', () => {
        const result = applyFilters(transactions, { ...createDefaultFilterState(), currencyCode: 'EUR' });
        expect(result.map(t => t.id)).toEqual(['t2', 't3']);
    });

    it('filters by date range (inclusive)', () => {
        const result = applyFilters(transactions, {
            ...createDefaultFilterState(),
            dateFrom: '2025-02-01',
            dateTo: '2025-02-28'
        });
        expect(result.map(t => t.id)).toEqual(['t2']);
    });

    it('combines multiple filters', () => {
        const result = applyFilters(transactions, {
            ...createDefaultFilterState(),
            userId: 'u1',
            currencyCode: 'EUR'
        });
        expect(result.map(t => t.id)).toEqual(['t3']);
    });

    it('returns an empty array when nothing matches', () => {
        const result = applyFilters(transactions, { ...createDefaultFilterState(), userId: 'nobody' });
        expect(result).toEqual([]);
    });

    it('does not mutate the input array', () => {
        const copy = [...transactions];
        applyFilters(transactions, { ...createDefaultFilterState(), userId: 'u1' });
        expect(transactions).toEqual(copy);
    });
});

describe('sortTransactions', () => {
    const userMap = new Map([
        ['u1', { id: 'u1', name: 'Zoe' }],
        ['u2', { id: 'u2', name: 'Alice' }]
    ]);
    const ytdCache = new Map([['t1', 287.5], ['t2', 155], ['t3', 907.5]]);

    it('sorts by date descending by default', () => {
        const sorted = sortTransactions(transactions, userMap, ytdCache, createDefaultFilterState());
        expect(sorted.map(t => t.id)).toEqual(['t3', 't2', 't1']);
    });

    it('sorts by date ascending when direction is asc', () => {
        const sorted = sortTransactions(transactions, userMap, ytdCache, {
            ...createDefaultFilterState(),
            sortDirection: 'asc'
        });
        expect(sorted.map(t => t.id)).toEqual(['t1', 't2', 't3']);
    });

    it('sorts by user name via the user strategy', () => {
        const sorted = sortTransactions(transactions, userMap, ytdCache, {
            ...createDefaultFilterState(),
            sortColumn: 'user',
            sortDirection: 'asc'
        });
        // Alice (u2) before Zoe (u1)
        expect(sorted.map(t => t.userId)).toEqual(['u2', 'u1', 'u1']);
    });

    it('sorts by amount', () => {
        const sorted = sortTransactions(transactions, userMap, ytdCache, {
            ...createDefaultFilterState(),
            sortColumn: 'amount',
            sortDirection: 'asc'
        });
        expect(sorted.map(t => t.amount)).toEqual([50, 100, 200]);
    });

    it('sorts by GEL amount', () => {
        const sorted = sortTransactions(transactions, userMap, ytdCache, {
            ...createDefaultFilterState(),
            sortColumn: 'gel',
            sortDirection: 'desc'
        });
        expect(sorted.map(t => t.id)).toEqual(['t3', 't1', 't2']);
    });

    it('sorts by currency code', () => {
        const sorted = sortTransactions(transactions, userMap, ytdCache, {
            ...createDefaultFilterState(),
            sortColumn: 'currency',
            sortDirection: 'asc'
        });
        expect(sorted.map(t => t.currencyCode)).toEqual(['EUR', 'EUR', 'USD']);
    });

    it('sorts by YTD income', () => {
        const sorted = sortTransactions(transactions, userMap, ytdCache, {
            ...createDefaultFilterState(),
            sortColumn: 'ytd',
            sortDirection: 'asc'
        });
        expect(sorted.map(t => t.id)).toEqual(['t2', 't1', 't3']);
    });

    it('falls back to input order for an unknown sort column', () => {
        const sorted = sortTransactions(transactions, userMap, ytdCache, {
            ...createDefaultFilterState(),
            sortColumn: 'nonexistent'
        });
        expect(sorted.map(t => t.id)).toEqual(['t1', 't2', 't3']);
    });

    it('does not mutate the input array', () => {
        const copy = [...transactions];
        sortTransactions(transactions, userMap, ytdCache, createDefaultFilterState());
        expect(transactions).toEqual(copy);
    });

    describe('same-date tie-break', () => {
        // Same date and same user (t1/t2), different timestamps; t3 is on a
        // different date entirely and should always sort by date first.
        const tied = [
            { id: 't1', userId: 'u1', currencyCode: 'USD', date: '2025-01-10', amount: 100, convertedGEL: 287.5, timestamp: '2025-01-10T09:00:00.000Z' },
            { id: 't2', userId: 'u1', currencyCode: 'EUR', date: '2025-01-10', amount: 50, convertedGEL: 155, timestamp: '2025-01-10T15:00:00.000Z' },
            { id: 't3', userId: 'u1', currencyCode: 'EUR', date: '2025-03-01', amount: 200, convertedGEL: 620, timestamp: '2025-03-01T10:00:00.000Z' }
        ];
        const tiedUserMap = new Map([['u1', { id: 'u1', name: 'Zoe' }]]);
        const tiedYtdCache = new Map([['t1', 287.5], ['t2', 442.5], ['t3', 1062.5]]);

        it('breaks same-date ties by timestamp ascending when sorting asc', () => {
            const sorted = sortTransactions(tied, tiedUserMap, tiedYtdCache, {
                ...createDefaultFilterState(),
                sortDirection: 'asc'
            });
            expect(sorted.map(t => t.id)).toEqual(['t1', 't2', 't3']);
        });

        it('breaks same-date ties by timestamp descending when sorting desc', () => {
            const sorted = sortTransactions(tied, tiedUserMap, tiedYtdCache, {
                ...createDefaultFilterState(),
                sortDirection: 'desc'
            });
            expect(sorted.map(t => t.id)).toEqual(['t3', 't2', 't1']);
        });

        it('is stable and deterministic across repeated sorts (same input order)', () => {
            const first = sortTransactions(tied, tiedUserMap, tiedYtdCache, createDefaultFilterState());
            const second = sortTransactions([...tied].reverse(), tiedUserMap, tiedYtdCache, createDefaultFilterState());
            expect(second.map(t => t.id)).toEqual(first.map(t => t.id));
        });

        it('falls back to id when timestamps are equal or missing', () => {
            const noTimestamp = [
                { id: 'tb', userId: 'u1', currencyCode: 'USD', date: '2025-01-10', amount: 100, convertedGEL: 287.5 },
                { id: 'ta', userId: 'u1', currencyCode: 'EUR', date: '2025-01-10', amount: 50, convertedGEL: 155 }
            ];
            const cache = new Map([['ta', 155], ['tb', 442.5]]);
            const asc = sortTransactions(noTimestamp, tiedUserMap, cache, {
                ...createDefaultFilterState(),
                sortDirection: 'asc'
            });
            expect(asc.map(t => t.id)).toEqual(['ta', 'tb']);

            const desc = sortTransactions(noTimestamp, tiedUserMap, cache, {
                ...createDefaultFilterState(),
                sortDirection: 'desc'
            });
            expect(desc.map(t => t.id)).toEqual(['tb', 'ta']);
        });
    });
});

describe('SORT_STRATEGIES', () => {
    it('exposes a strategy for every sortable column', () => {
        expect(Object.keys(SORT_STRATEGIES).sort()).toEqual(
            ['amount', 'currency', 'date', 'gel', 'user', 'ytd'].sort()
        );
    });
});

describe('computeNextSortState', () => {
    it('defaults a newly clicked column to descending', () => {
        const next = computeNextSortState({ sortColumn: 'date', sortDirection: 'desc' }, 'amount');
        expect(next).toEqual({ sortColumn: 'amount', sortDirection: 'desc' });
    });

    it('toggles direction when the same column is clicked again', () => {
        const next = computeNextSortState({ sortColumn: 'date', sortDirection: 'desc' }, 'date');
        expect(next).toEqual({ sortColumn: 'date', sortDirection: 'asc' });

        const next2 = computeNextSortState(next, 'date');
        expect(next2).toEqual({ sortColumn: 'date', sortDirection: 'desc' });
    });
});
