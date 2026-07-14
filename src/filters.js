// ===========================
// Transaction Filtering & Sorting
// ===========================
//
// Extracted from script.js. The original functions closed over a
// module-level `filterState` variable, which made them impossible to unit
// test without reaching into script.js's private state. Here filterState is
// an explicit parameter instead - same behavior, but testable in isolation.

/**
 * Creates a fresh default filter/sort state.
 * @returns {Object}
 */
export function createDefaultFilterState() {
    return {
        userId: 'all',
        currencyCode: 'all',
        dateFrom: '',
        dateTo: '',
        sortColumn: 'date',
        sortDirection: 'desc'
    };
}

/**
 * Filters transactions by user, currency, and date range.
 * @param {Array<Object>} transactions
 * @param {Object} filterState - { userId, currencyCode, dateFrom, dateTo }
 * @returns {Array<Object>} Filtered transactions (new array)
 */
export function applyFilters(transactions, filterState) {
    let filtered = [...transactions];

    if (filterState.userId !== 'all') {
        filtered = filtered.filter(t => t.userId === filterState.userId);
    }

    if (filterState.currencyCode !== 'all') {
        filtered = filtered.filter(t => t.currencyCode === filterState.currencyCode);
    }

    if (filterState.dateFrom) {
        filtered = filtered.filter(t => t.date >= filterState.dateFrom);
    }
    if (filterState.dateTo) {
        filtered = filtered.filter(t => t.date <= filterState.dateTo);
    }

    return filtered;
}

export const SORT_STRATEGIES = {
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

/**
 * Sorts transactions per the current filter state's sortColumn/sortDirection.
 * @param {Array<Object>} transactions
 * @param {Map} userMap - user id -> user object
 * @param {Map} ytdCache - transaction id -> YTD total
 * @param {Object} filterState - { sortColumn, sortDirection }
 * @returns {Array<Object>} Sorted transactions (new array)
 */
export function sortTransactions(transactions, userMap, ytdCache, filterState) {
    const sortStrategy = SORT_STRATEGIES[filterState.sortColumn];
    if (!sortStrategy) return [...transactions];

    const direction = filterState.sortDirection === 'asc' ? 1 : -1;
    const sorted = [...transactions];

    sorted.sort((a, b) => {
        const primary = sortStrategy(a, b, userMap, ytdCache);
        if (primary !== 0) return primary * direction;
        // Deterministic tie-break for equal primary values (e.g. multiple
        // transactions on the same date) so the order is stable and matches
        // the YTD accumulation order (see precalculateAllYTD in utils.js).
        // Follows sortDirection, same as the primary comparison.
        const byTimestamp = (a.timestamp || '').localeCompare(b.timestamp || '');
        const tie = byTimestamp !== 0 ? byTimestamp : a.id.localeCompare(b.id);
        return tie * direction;
    });

    return sorted;
}

/**
 * Computes the next sortColumn/sortDirection when a column header is
 * clicked: toggles direction if the same column is clicked again, otherwise
 * switches to the new column defaulting to descending.
 * @param {{sortColumn: string, sortDirection: string}} currentState
 * @param {string} column - Column that was clicked
 * @returns {{sortColumn: string, sortDirection: string}}
 */
export function computeNextSortState(currentState, column) {
    if (currentState.sortColumn === column) {
        return {
            sortColumn: column,
            sortDirection: currentState.sortDirection === 'asc' ? 'desc' : 'asc'
        };
    }
    return { sortColumn: column, sortDirection: 'desc' };
}
