import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getStorage, getFromStorage, saveToStorage, removeFromStorage, getAllStorageKeys } from '../../src/storage.js';

// Unlike the code it replaces, this file exercises the *real* storage
// module (src/storage.js) instead of re-implementing the fallback logic
// inline in the test - a test that only asserts a hand-rolled mock behaves
// like a hand-rolled mock provides no real coverage.

describe('getStorage', () => {
    it('returns localStorage when it is writable', () => {
        expect(getStorage()).toBe(global.localStorage);
    });

    it('falls back to sessionStorage when localStorage throws', () => {
        const originalSetItem = global.localStorage.setItem;
        global.localStorage.setItem = vi.fn(() => {
            throw new Error('blocked');
        });

        expect(getStorage()).toBe(global.sessionStorage);

        global.localStorage.setItem = originalSetItem;
    });
});

describe('getFromStorage', () => {
    beforeEach(() => {
        global.localStorage.clear();
    });

    it('returns the parsed value for an existing key', () => {
        global.localStorage.setItem('users', JSON.stringify([{ id: 'u1' }]));
        expect(getFromStorage('users')).toEqual([{ id: 'u1' }]);
    });

    it('returns the default value when the key is missing', () => {
        expect(getFromStorage('missing', 'fallback')).toBe('fallback');
        expect(getFromStorage('missing')).toBeNull();
    });

    it('returns the default value and logs when stored JSON is corrupted', () => {
        global.localStorage.setItem('broken', 'not valid json{');
        expect(getFromStorage('broken', [])).toEqual([]);
        expect(console.error).toHaveBeenCalled();
    });

    it('reads from an explicitly passed storage backend', () => {
        const fakeStorage = { getItem: vi.fn(() => JSON.stringify('from-fake')) };
        expect(getFromStorage('anything', null, fakeStorage)).toBe('from-fake');
    });
});

describe('saveToStorage', () => {
    beforeEach(() => {
        global.localStorage.clear();
    });

    it('serializes and stores the value, returning true on success', () => {
        const result = saveToStorage('users', [{ id: 'u1', name: 'John' }]);
        expect(result).toBe(true);
        expect(JSON.parse(global.localStorage.getItem('users'))).toEqual([{ id: 'u1', name: 'John' }]);
    });

    it('alerts and returns false on QuotaExceededError', () => {
        const alertSpy = vi.fn();
        global.alert = alertSpy;

        const fakeStorage = {
            setItem: vi.fn(() => {
                const err = new Error('quota exceeded');
                err.name = 'QuotaExceededError';
                throw err;
            })
        };

        const result = saveToStorage('big', 'x'.repeat(1000), fakeStorage);

        expect(result).toBe(false);
        expect(alertSpy).toHaveBeenCalledTimes(1);
    });

    it('logs and returns false on other storage errors without alerting', () => {
        const alertSpy = vi.fn();
        global.alert = alertSpy;

        const fakeStorage = {
            setItem: vi.fn(() => {
                throw new Error('some other error');
            })
        };

        const result = saveToStorage('key', 'value', fakeStorage);

        expect(result).toBe(false);
        expect(alertSpy).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
    });
});

describe('getAllStorageKeys', () => {
    beforeEach(() => {
        global.localStorage.clear();
    });

    it('returns every key written via saveToStorage', () => {
        saveToStorage('users', [{ id: 'u1' }]);
        saveToStorage('transactions', []);
        saveToStorage('themePreference', 'dark');

        expect(getAllStorageKeys().sort()).toEqual(['themePreference', 'transactions', 'users']);
    });

    it('returns an empty array when storage is empty', () => {
        expect(getAllStorageKeys()).toEqual([]);
    });

    it('reads from an explicitly passed storage backend', () => {
        const fakeStorage = { length: 2, key: (i) => ['a', 'b'][i] };
        expect(getAllStorageKeys(fakeStorage)).toEqual(['a', 'b']);
    });
});

describe('removeFromStorage', () => {
    beforeEach(() => {
        global.localStorage.clear();
    });

    it('removes an existing key and returns true', () => {
        global.localStorage.setItem('temp', '"value"');
        expect(removeFromStorage('temp')).toBe(true);
        expect(global.localStorage.getItem('temp')).toBeNull();
    });

    it('returns true even if the key did not exist', () => {
        expect(removeFromStorage('nonexistent')).toBe(true);
    });

    it('returns false and logs if the backend throws', () => {
        const fakeStorage = {
            removeItem: vi.fn(() => {
                throw new Error('remove failed');
            })
        };
        expect(removeFromStorage('key', fakeStorage)).toBe(false);
        expect(console.error).toHaveBeenCalled();
    });
});
