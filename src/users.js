// ===========================
// User Management (storage layer)
// ===========================
//
// Extracted from script.js. Deliberately excludes any DOM
// rendering/refresh calls - script.js wraps these with
// renderUserList()/populateUserSelectors() after calling them, so this
// module can be tested without a DOM fixture.

import { getFromStorage, saveToStorage } from './storage.js';
import { validateUser, createDefaultUser } from './utils.js';

/**
 * Loads users from storage, seeding a default user if none exist or none
 * are valid.
 * @returns {Array<Object>} Array of user objects
 */
export function loadUsers() {
    const users = getFromStorage('users');

    if (!users || !Array.isArray(users) || users.length === 0) {
        const defaultUser = createDefaultUser();
        saveToStorage('users', [defaultUser]);
        return [defaultUser];
    }

    const validUsers = users.filter(validateUser);
    if (validUsers.length === 0) {
        const defaultUser = createDefaultUser();
        saveToStorage('users', [defaultUser]);
        return [defaultUser];
    }

    return validUsers;
}

/**
 * Creates or updates a user in storage.
 * @param {Object} userData
 * @returns {boolean} True on success
 */
export function updateUserInStorage(userData) {
    if (!validateUser(userData)) {
        console.error('Invalid user data', userData);
        return false;
    }

    const users = loadUsers();
    const existingIndex = users.findIndex(u => u.id === userData.id);

    if (existingIndex >= 0) {
        users[existingIndex] = userData;
    } else {
        users.push(userData);
    }

    return saveToStorage('users', users);
}

/**
 * Determines whether a user can be deleted, and confirms cascading
 * transaction deletion with the user if needed.
 * @param {string} userId
 * @param {Array<Object>} users - Current users
 * @param {Array<Object>} transactions - Current transactions
 * @returns {{allowed: boolean, reason?: string}}
 */
export function canDeleteUser(userId, users, transactions) {
    if (userId === 'user') {
        return { allowed: false, reason: 'Cannot delete the default user. Please create another user first.' };
    }

    if (users.length <= 1) {
        return { allowed: false, reason: 'Cannot delete the last user.' };
    }

    const userTransactions = transactions.filter(t => t.userId === userId);
    if (userTransactions.length > 0) {
        const confirmed = confirm(
            `This user has ${userTransactions.length} transaction(s). Delete user and all associated transactions?`
        );
        if (!confirmed) {
            return { allowed: false, reason: 'User cancelled operation.' };
        }
    }

    return { allowed: true };
}

/**
 * Removes a user from storage (does not touch their transactions - see
 * removeUserTransactions in transactions.js).
 * @param {string} userId
 * @returns {boolean} True on success
 */
export function removeUserFromStorage(userId) {
    const users = loadUsers();
    const filteredUsers = users.filter(u => u.id !== userId);
    return saveToStorage('users', filteredUsers);
}

/**
 * Looks up a user by id.
 * @param {string} userId
 * @returns {Object|undefined}
 */
export function getUserById(userId) {
    const users = loadUsers();
    return users.find(u => u.id === userId);
}
