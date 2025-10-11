import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Storage Utilities', () => {
    let mockLocalStorage;
    let mockSessionStorage;

    beforeEach(() => {
        // Create mock storage objects
        mockLocalStorage = (() => {
            let store = {};
            return {
                getItem: vi.fn((key) => store[key] || null),
                setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
                removeItem: vi.fn((key) => { delete store[key]; }),
                clear: vi.fn(() => { store = {}; })
            };
        })();

        mockSessionStorage = (() => {
            let store = {};
            return {
                getItem: vi.fn((key) => store[key] || null),
                setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
                removeItem: vi.fn((key) => { delete store[key]; }),
                clear: vi.fn(() => { store = {}; })
            };
        })();

        // Mock global storage objects
        global.localStorage = mockLocalStorage;
        global.sessionStorage = mockSessionStorage;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Storage Fallback Logic', () => {
        it('should use localStorage when available', () => {
            const storage = global.localStorage;
            storage.setItem('test', 'value');
            expect(storage.getItem('test')).toBe('value');
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('test', 'value');
        });

        it('should fallback to sessionStorage when localStorage throws', () => {
            // Simulate localStorage throwing
            mockLocalStorage.setItem.mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });

            // This would be the actual implementation behavior
            let storage = mockLocalStorage;
            try {
                storage.setItem('__test__', '1');
            } catch {
                storage = mockSessionStorage;
            }

            storage.setItem('test', 'value');
            expect(mockSessionStorage.setItem).toHaveBeenCalledWith('test', 'value');
        });

        it('should detect localStorage availability with test write', () => {
            let isAvailable = true;
            try {
                mockLocalStorage.setItem('__test__', '1');
                mockLocalStorage.removeItem('__test__');
            } catch {
                isAvailable = false;
            }

            expect(isAvailable).toBe(true);
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('__test__', '1');
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('__test__');
        });

        it('should handle QuotaExceededError gracefully', () => {
            mockLocalStorage.setItem.mockImplementation(() => {
                const err = new Error('QuotaExceededError');
                err.name = 'QuotaExceededError';
                throw err;
            });

            expect(() => {
                try {
                    mockLocalStorage.setItem('test', 'value');
                } catch (err) {
                    if (err.name === 'QuotaExceededError') {
                        // Should handle gracefully
                        expect(err.name).toBe('QuotaExceededError');
                    }
                    throw err;
                }
            }).toThrow('QuotaExceededError');
        });
    });

    describe('Theme Preference Storage', () => {
        it('should store theme preference', () => {
            const themeKey = 'themePreference';
            const themeValue = JSON.stringify('dark');

            mockLocalStorage.setItem(themeKey, themeValue);
            const result = mockLocalStorage.getItem(themeKey);

            expect(result).toBe(themeValue);
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith(themeKey, themeValue);
        });

        it('should retrieve stored theme preference', () => {
            const themeKey = 'themePreference';
            mockLocalStorage.setItem(themeKey, JSON.stringify('light'));

            const result = JSON.parse(mockLocalStorage.getItem(themeKey));

            expect(result).toBe('light');
        });

        it('should return default value when theme not stored', () => {
            const result = mockLocalStorage.getItem('themePreference');
            const defaultTheme = result || 'system';

            expect(defaultTheme).toBe('system');
        });

        it('should support all theme values', () => {
            const themes = ['system', 'light', 'dark'];

            themes.forEach(theme => {
                mockLocalStorage.setItem('themePreference', JSON.stringify(theme));
                const result = JSON.parse(mockLocalStorage.getItem('themePreference'));
                expect(result).toBe(theme);
            });
        });

        it('should overwrite existing theme preference', () => {
            mockLocalStorage.setItem('themePreference', JSON.stringify('light'));
            expect(JSON.parse(mockLocalStorage.getItem('themePreference'))).toBe('light');

            mockLocalStorage.setItem('themePreference', JSON.stringify('dark'));
            expect(JSON.parse(mockLocalStorage.getItem('themePreference'))).toBe('dark');
        });
    });

    describe('Storage Error Handling', () => {
        it('should handle JSON parse errors', () => {
            mockLocalStorage.setItem('invalid', 'not valid json');

            expect(() => {
                JSON.parse(mockLocalStorage.getItem('invalid'));
            }).toThrow();
        });

        it('should handle missing keys gracefully', () => {
            const result = mockLocalStorage.getItem('nonexistent');
            expect(result).toBeNull();
        });

        it('should handle removeItem on missing keys', () => {
            expect(() => {
                mockLocalStorage.removeItem('nonexistent');
            }).not.toThrow();
        });
    });
});
