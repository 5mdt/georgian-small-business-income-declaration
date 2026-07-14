import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    loadUsers,
    updateUserInStorage,
    canDeleteUser,
    removeUserFromStorage,
    getUserById
} from '../../src/users.js';
import { STORAGE_KEYS } from '../../src/keys.js';

describe('loadUsers', () => {
    beforeEach(() => {
        global.localStorage.clear();
    });

    it('seeds a default user on first load (no stored data)', () => {
        const users = loadUsers();
        expect(users).toEqual([{ id: 'user', name: 'user', taxpayerId: '' }]);
        // The default user is persisted, not just returned
        expect(JSON.parse(global.localStorage.getItem(STORAGE_KEYS.users))).toEqual(users);
    });

    it('returns previously stored valid users', () => {
        const stored = [{ id: 'user_abc', name: 'Alice', taxpayerId: '123' }];
        global.localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(stored));

        expect(loadUsers()).toEqual(stored);
    });

    it('drops invalid entries and falls back to default when none are valid', () => {
        global.localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([{ name: 'no id' }, {}]));
        expect(loadUsers()).toEqual([{ id: 'user', name: 'user', taxpayerId: '' }]);
    });

    it('filters out invalid entries while keeping valid ones', () => {
        const mixed = [
            { id: 'user_1', name: 'Valid', taxpayerId: '' },
            { name: 'missing id' }
        ];
        global.localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(mixed));

        expect(loadUsers()).toEqual([mixed[0]]);
    });
});

describe('updateUserInStorage', () => {
    beforeEach(() => {
        global.localStorage.clear();
    });

    it('adds a new user', () => {
        loadUsers(); // seeds default user
        const newUser = { id: 'user_new', name: 'Bob', taxpayerId: '999' };

        expect(updateUserInStorage(newUser)).toBe(true);
        expect(loadUsers()).toContainEqual(newUser);
    });

    it('updates an existing user in place', () => {
        loadUsers();
        updateUserInStorage({ id: 'user', name: 'Renamed', taxpayerId: '111' });

        const users = loadUsers();
        expect(users).toHaveLength(1);
        expect(users[0]).toEqual({ id: 'user', name: 'Renamed', taxpayerId: '111' });
    });

    it('rejects invalid user data without touching storage', () => {
        loadUsers();
        const before = global.localStorage.getItem(STORAGE_KEYS.users);

        expect(updateUserInStorage({ name: 'no id' })).toBe(false);
        expect(global.localStorage.getItem(STORAGE_KEYS.users)).toBe(before);
    });
});

describe('canDeleteUser', () => {
    it('refuses to delete the default "user" account', () => {
        const result = canDeleteUser('user', [{ id: 'user' }, { id: 'user_2' }], []);
        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/default user/i);
    });

    it('refuses to delete the last remaining user', () => {
        const result = canDeleteUser('user_2', [{ id: 'user_2' }], []);
        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/last user/i);
    });

    it('allows deletion with no transactions and no confirmation needed', () => {
        const result = canDeleteUser('user_2', [{ id: 'user' }, { id: 'user_2' }], []);
        expect(result.allowed).toBe(true);
    });

    it('prompts for confirmation when the user has transactions, and honors "cancel"', () => {
        global.confirm = vi.fn(() => false);

        const transactions = [{ id: 't1', userId: 'user_2' }];
        const result = canDeleteUser('user_2', [{ id: 'user' }, { id: 'user_2' }], transactions);

        expect(global.confirm).toHaveBeenCalledWith(expect.stringContaining('1 transaction(s)'));
        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/cancelled/i);
    });

    it('allows cascading delete when the user confirms', () => {
        global.confirm = vi.fn(() => true);

        const transactions = [{ id: 't1', userId: 'user_2' }, { id: 't2', userId: 'user_2' }];
        const result = canDeleteUser('user_2', [{ id: 'user' }, { id: 'user_2' }], transactions);

        expect(result.allowed).toBe(true);
    });
});

describe('removeUserFromStorage', () => {
    beforeEach(() => {
        global.localStorage.clear();
    });

    it('removes only the targeted user', () => {
        global.localStorage.setItem(STORAGE_KEYS.users, JSON.stringify([
            { id: 'user', name: 'user', taxpayerId: '' },
            { id: 'user_2', name: 'Bob', taxpayerId: '' }
        ]));

        removeUserFromStorage('user_2');

        expect(loadUsers()).toEqual([{ id: 'user', name: 'user', taxpayerId: '' }]);
    });
});

describe('getUserById', () => {
    beforeEach(() => {
        global.localStorage.clear();
    });

    it('finds an existing user', () => {
        loadUsers();
        expect(getUserById('user')).toEqual({ id: 'user', name: 'user', taxpayerId: '' });
    });

    it('returns undefined for an unknown id', () => {
        loadUsers();
        expect(getUserById('nope')).toBeUndefined();
    });
});
