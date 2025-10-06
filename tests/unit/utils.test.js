import { describe, it, expect, vi } from 'vitest';
import {
    generateUserId,
    generateTransactionId,
    buildUserLookupMap,
    createDefaultUser,
    debounce
} from '../../src/utils.js';

describe('ID Generation', () => {
    describe('User ID', () => {
        it('should generate unique IDs', () => {
            const id1 = generateUserId();
            const id2 = generateUserId();

            expect(id1).not.toBe(id2);
        });

        it('should start with "user_" prefix', () => {
            const id = generateUserId();
            expect(id).toMatch(/^user_/);
        });

        it('should be a string', () => {
            const id = generateUserId();
            expect(typeof id).toBe('string');
        });

        it('should generate different IDs on consecutive calls', () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                ids.add(generateUserId());
            }
            expect(ids.size).toBe(100);
        });
    });

    describe('Transaction ID', () => {
        it('should generate unique IDs', () => {
            const id1 = generateTransactionId();
            const id2 = generateTransactionId();

            expect(id1).not.toBe(id2);
        });

        it('should be a string', () => {
            const id = generateTransactionId();
            expect(typeof id).toBe('string');
        });

        it('should generate different IDs on consecutive calls', () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                ids.add(generateTransactionId());
            }
            expect(ids.size).toBe(100);
        });
    });
});

describe('User Lookup Map', () => {
    it('should create Map from users array', () => {
        const users = [
            { id: 'user1', name: 'John', taxpayerId: '123' },
            { id: 'user2', name: 'Jane', taxpayerId: '456' }
        ];

        const map = buildUserLookupMap(users);

        expect(map).toBeInstanceOf(Map);
        expect(map.size).toBe(2);
    });

    it('should map user ID to user object', () => {
        const users = [
            { id: 'user1', name: 'John', taxpayerId: '123' },
            { id: 'user2', name: 'Jane', taxpayerId: '456' }
        ];

        const map = buildUserLookupMap(users);

        expect(map.get('user1')).toEqual(users[0]);
        expect(map.get('user2')).toEqual(users[1]);
    });

    it('should handle empty array', () => {
        const map = buildUserLookupMap([]);
        expect(map.size).toBe(0);
    });

    it('should handle single user', () => {
        const users = [{ id: 'user1', name: 'John', taxpayerId: '123' }];
        const map = buildUserLookupMap(users);

        expect(map.size).toBe(1);
        expect(map.get('user1')).toEqual(users[0]);
    });
});

describe('Default User Creation', () => {
    it('should create user with id "user"', () => {
        const user = createDefaultUser();
        expect(user.id).toBe('user');
    });

    it('should create user with name "user"', () => {
        const user = createDefaultUser();
        expect(user.name).toBe('user');
    });

    it('should create user with empty taxpayerId', () => {
        const user = createDefaultUser();
        expect(user.taxpayerId).toBe('');
    });

    it('should return new object on each call', () => {
        const user1 = createDefaultUser();
        const user2 = createDefaultUser();

        expect(user1).not.toBe(user2); // Different object references
        expect(user1).toEqual(user2); // But equal values
    });
});

describe('Debounce Function', () => {
    it('should delay function execution', async () => {
        vi.useFakeTimers();

        const mockFn = vi.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn();
        expect(mockFn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(mockFn).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });

    it('should call function only once for multiple rapid calls', async () => {
        vi.useFakeTimers();

        const mockFn = vi.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn();
        debouncedFn();
        debouncedFn();

        expect(mockFn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(mockFn).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });

    it('should pass arguments to debounced function', async () => {
        vi.useFakeTimers();

        const mockFn = vi.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn('arg1', 'arg2', 123);

        vi.advanceTimersByTime(100);
        expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 123);

        vi.useRealTimers();
    });

    it('should reset timer on each call', async () => {
        vi.useFakeTimers();

        const mockFn = vi.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn();
        vi.advanceTimersByTime(50);

        debouncedFn();
        vi.advanceTimersByTime(50);

        expect(mockFn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(mockFn).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
    });

    it('should allow multiple calls after wait period', async () => {
        vi.useFakeTimers();

        const mockFn = vi.fn();
        const debouncedFn = debounce(mockFn, 100);

        debouncedFn();
        vi.advanceTimersByTime(100);
        expect(mockFn).toHaveBeenCalledTimes(1);

        debouncedFn();
        vi.advanceTimersByTime(100);
        expect(mockFn).toHaveBeenCalledTimes(2);

        vi.useRealTimers();
    });
});
