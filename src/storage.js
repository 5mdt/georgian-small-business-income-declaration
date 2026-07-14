// ===========================
// Storage Utilities
// ===========================
//
// Thin wrapper around localStorage with a sessionStorage fallback (some
// browser configurations - e.g. Safari private mode, or cookies/storage
// blocked by policy - throw on any localStorage access). Extracted from
// script.js so it can be exercised by tests without a real browser.

import { ERROR_MESSAGES } from './utils.js';

/**
 * Detects a working storage backend, preferring localStorage.
 * Re-checked on every call (rather than cached once at module load) so a
 * backend that becomes unavailable - or a test that swaps out
 * global.localStorage - is picked up on the next call.
 * @returns {Storage} localStorage or sessionStorage
 */
export function getStorage() {
    try {
        localStorage.setItem('__test__', '1');
        localStorage.removeItem('__test__');
        return localStorage;
    } catch {
        console.warn('localStorage unavailable, using sessionStorage fallback');
        return sessionStorage;
    }
}

/**
 * Reads and JSON-parses a value from storage.
 * @param {string} key - Storage key
 * @param {*} [defaultValue] - Value to return if the key is missing or unreadable
 * @param {Storage} [storageBackend] - Storage backend to use (defaults to getStorage())
 * @returns {*} Parsed value, or defaultValue
 */
export function getFromStorage(key, defaultValue = null, storageBackend = getStorage()) {
    try {
        const item = storageBackend.getItem(key);
        if (!item) return defaultValue;
        return JSON.parse(item);
    } catch (error) {
        console.error(`Error reading from storage: ${key}`, error);
        return defaultValue;
    }
}

/**
 * JSON-serializes and writes a value to storage.
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @param {Storage} [storageBackend] - Storage backend to use (defaults to getStorage())
 * @returns {boolean} True on success
 */
export function saveToStorage(key, value, storageBackend = getStorage()) {
    try {
        const serialized = JSON.stringify(value);
        storageBackend.setItem(key, serialized);
        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            alert(ERROR_MESSAGES.QUOTA_EXCEEDED);
        } else {
            console.error(`Error saving to storage: ${key}`, error);
        }
        return false;
    }
}

/**
 * Removes a key from storage.
 * @param {string} key - Storage key
 * @param {Storage} [storageBackend] - Storage backend to use (defaults to getStorage())
 * @returns {boolean} True on success
 */
export function removeFromStorage(key, storageBackend = getStorage()) {
    try {
        storageBackend.removeItem(key);
        return true;
    } catch (error) {
        console.error(`Error removing from storage: ${key}`, error);
        return false;
    }
}

/**
 * Enumerates every key currently in a storage backend, via the standard
 * Storage.length/Storage.key(i) interface - Object.keys() doesn't reflect a
 * Storage object's actual entries.
 * @param {Storage} [storageBackend] - Storage backend to use (defaults to getStorage())
 * @returns {Array<string>} All keys currently stored
 */
export function getAllStorageKeys(storageBackend = getStorage()) {
    const keys = [];
    for (let i = 0; i < storageBackend.length; i++) {
        keys.push(storageBackend.key(i));
    }
    return keys;
}
