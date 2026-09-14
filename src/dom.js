// ===========================
// Small DOM Helpers
// ===========================
//
// Thin DOM helpers, kept separate from src/utils.js so utils.js stays free
// of any `document` usage and testable outside jsdom. These are still
// straightforward to test under jsdom (configured as the vitest environment).

/**
 * Escapes text for safe insertion as HTML by round-tripping it through
 * textContent/innerHTML.
 * @param {string} text - Raw text
 * @returns {string} HTML-escaped text
 */
// #T4G-0007
export function sanitizeInput(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Removes the 'hidden' class from an element, if present.
 * @param {Element|null} element
 */
// #T4G-0018
export function showElement(element) {
    if (element) element.classList.remove('hidden');
}

/**
 * Adds the 'hidden' class to an element, if present.
 * @param {Element|null} element
 */
// #T4G-0018
export function hideElement(element) {
    if (element) element.classList.add('hidden');
}

/**
 * Displays an error message in the element with the given id.
 * @param {string} elementId
 * @param {string} message
 */
// #T4G-0001
export function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = message;
    showElement(element);
}

/**
 * Clears and hides the error message element with the given id.
 * @param {string} elementId
 */
// #T4G-0001
export function hideError(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = '';
    hideElement(element);
}
