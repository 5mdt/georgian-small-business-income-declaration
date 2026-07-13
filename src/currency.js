// ===========================
// NBG Currency Rate Fetching + Caching
// ===========================
//
// Extracted from script.js. fetchCurrencyRates takes an injectable fetch
// implementation so it can be tested without hitting the real NBG API.

import { ERROR_MESSAGES, API_TIMEOUT } from './utils.js';
import { getFromStorage, saveToStorage } from './storage.js';

/**
 * Builds the synthetic GEL "currency" (rate 1, no API lookup needed).
 * @returns {Object}
 */
export function createGELCurrencyObject() {
    return {
        code: 'GEL',
        name: 'Georgian Lari',
        rate: 1,
        quantity: 1,
        rateFormated: '1.0000'
    };
}

/**
 * Throws if the NBG API response doesn't have the expected shape.
 * @param {*} data
 * @throws {Error}
 */
export function validateCurrencyResponse(data) {
    if (!Array.isArray(data) || data.length === 0 || !data[0].currencies) {
        throw new Error(ERROR_MESSAGES.NO_CURRENCY_DATA);
    }
}

/**
 * Finds a currency by code in an NBG API response (or synthesizes GEL).
 * @param {Array} data - NBG API response
 * @param {string} currencyCode
 * @returns {Object} Currency object
 * @throws {Error} If the response is malformed or the currency isn't found
 */
export function findCurrencyInData(data, currencyCode) {
    if (currencyCode === 'GEL') {
        return createGELCurrencyObject();
    }

    validateCurrencyResponse(data);
    const currencies = data[0].currencies;
    const selectedCurrency = currencies.find(c => c.code === currencyCode);

    if (!selectedCurrency) {
        throw new Error(ERROR_MESSAGES.CURRENCY_NOT_FOUND);
    }

    return selectedCurrency;
}

/**
 * Reads cached NBG rates for a date.
 * @param {string} date - YYYY-MM-DD
 * @returns {*} Cached response, or null
 */
export function getCurrencyRatesFromCache(date) {
    return getFromStorage(`currencyRates_${date}`);
}

/**
 * Caches NBG rates for a date.
 * @param {string} date - YYYY-MM-DD
 * @param {*} data - NBG API response to cache
 */
export function saveCurrencyRatesToCache(date, data) {
    saveToStorage(`currencyRates_${date}`, data);
}

/**
 * Fetches NBG currency rates for a date and caches the result.
 * @param {string} date - YYYY-MM-DD
 * @param {Function} [fetchImpl] - fetch implementation (defaults to global fetch; injectable for tests)
 * @returns {Promise<*>} The NBG API response
 */
export function fetchCurrencyRates(date, fetchImpl = fetch) {
    const apiUrl = `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=${date}`;

    return fetchImpl(apiUrl, { timeout: API_TIMEOUT })
        .then(response => {
            if (!response.ok) {
                throw new Error(ERROR_MESSAGES.API_ERROR);
            }
            return response.json();
        })
        .then(data => {
            saveCurrencyRatesToCache(date, data);
            return data;
        });
}
