import { describe, it, expect, beforeEach } from 'vitest';
import { clearData } from '../../src/clear.js';
import { STORAGE_KEYS, CURRENCY_RATE_KEY_PREFIX } from '../../src/keys.js';

function seedAll() {
    global.localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([{ id: 't1', userId: 'user_2' }]));
    global.localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([{ id: 'user_2', name: 'Bob', taxpayerId: '' }]));
    global.localStorage.setItem(`${CURRENCY_RATE_KEY_PREFIX}2025-01-15`, JSON.stringify({ USD: 2.7 }));
    global.localStorage.setItem(STORAGE_KEYS.themePreference, JSON.stringify('dark'));
    global.localStorage.setItem(STORAGE_KEYS.addTransaction, JSON.stringify(true));
    global.sessionStorage.setItem('t4g_config_collapsible_disclaimer', 'collapsed');
    global.localStorage.setItem('t4g_appVersion', JSON.stringify('1.5.1'));
    global.localStorage.setItem('t4g_dataSchemaVersion', JSON.stringify(2));
}

describe('clearData', () => {
    beforeEach(() => {
        global.localStorage.clear();
        global.sessionStorage.clear();
        seedAll();
    });

    it('clears only transactions when just transactions is selected', () => {
        const result = clearData({ transactions: true });

        expect(result.cleared).toEqual(['transactions']);
        expect(global.localStorage.getItem(STORAGE_KEYS.transactions)).toBeNull();
        expect(global.localStorage.getItem(STORAGE_KEYS.users)).not.toBeNull();
        expect(global.localStorage.getItem(`${CURRENCY_RATE_KEY_PREFIX}2025-01-15`)).not.toBeNull();
    });

    it('resets users to a single default user and cascades to remove transactions', () => {
        const result = clearData({ users: true });

        expect(result.cleared).toEqual(['users', 'transactions']);
        expect(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.users))).toEqual([
            { id: 'user', name: 'user', taxpayerId: '' }
        ]);
        expect(global.localStorage.getItem(STORAGE_KEYS.transactions)).toBeNull();
    });

    it('ignores the transactions flag when users is also selected (already cascades)', () => {
        const result = clearData({ users: true, transactions: true });
        expect(result.cleared).toEqual(['users', 'transactions']);
    });

    it('clears only cached exchange rates when rateCache is selected', () => {
        const result = clearData({ rateCache: true });

        expect(result.cleared).toEqual(['rateCache']);
        expect(global.localStorage.getItem(`${CURRENCY_RATE_KEY_PREFIX}2025-01-15`)).toBeNull();
        expect(global.localStorage.getItem(STORAGE_KEYS.transactions)).not.toBeNull();
        expect(global.localStorage.getItem(STORAGE_KEYS.users)).not.toBeNull();
    });

    it('clears settings/preferences including sessionStorage collapsible state', () => {
        const result = clearData({ settings: true });

        expect(result.cleared).toEqual(['settings']);
        expect(global.localStorage.getItem(STORAGE_KEYS.themePreference)).toBeNull();
        expect(global.localStorage.getItem(STORAGE_KEYS.addTransaction)).toBeNull();
        expect(global.sessionStorage.getItem('t4g_config_collapsible_disclaimer')).toBeNull();
        // unrelated data untouched
        expect(global.localStorage.getItem(STORAGE_KEYS.transactions)).not.toBeNull();
        expect(global.localStorage.getItem(`${CURRENCY_RATE_KEY_PREFIX}2025-01-15`)).not.toBeNull();
    });

    it('wipes every t4g_ key in both storages when everything is selected, ignoring other flags', () => {
        const result = clearData({ everything: true, transactions: true, rateCache: true });

        expect(result.cleared).toEqual(['everything']);
        expect(global.localStorage.length).toBe(0);
        expect(global.sessionStorage.getItem('t4g_config_collapsible_disclaimer')).toBeNull();
    });

    it('combines multiple selected categories in one call', () => {
        const result = clearData({ rateCache: true, settings: true });

        expect(result.cleared).toEqual(['rateCache', 'settings']);
        expect(global.localStorage.getItem(`${CURRENCY_RATE_KEY_PREFIX}2025-01-15`)).toBeNull();
        expect(global.localStorage.getItem(STORAGE_KEYS.themePreference)).toBeNull();
        expect(global.localStorage.getItem(STORAGE_KEYS.transactions)).not.toBeNull();
    });

    it('is a no-op when nothing is selected', () => {
        const result = clearData({});

        expect(result.cleared).toEqual([]);
        expect(global.localStorage.getItem(STORAGE_KEYS.transactions)).not.toBeNull();
        expect(global.localStorage.getItem(STORAGE_KEYS.users)).not.toBeNull();
        expect(global.localStorage.getItem(`${CURRENCY_RATE_KEY_PREFIX}2025-01-15`)).not.toBeNull();
    });
});
