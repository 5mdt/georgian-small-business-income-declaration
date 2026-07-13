import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    createGELCurrencyObject,
    validateCurrencyResponse,
    findCurrencyInData,
    getCurrencyRatesFromCache,
    saveCurrencyRatesToCache,
    fetchCurrencyRates
} from '../../src/currency.js';

const sampleResponse = [{
    date: '2025-03-29T00:00:00',
    currencies: [
        { code: 'USD', name: 'US Dollar', rate: 2.875, quantity: 1, rateFormated: '2.8750' },
        { code: 'EUR', name: 'Euro', rate: 3.1, quantity: 1, rateFormated: '3.1000' }
    ]
}];

describe('createGELCurrencyObject', () => {
    it('returns a synthetic GEL currency with rate 1', () => {
        expect(createGELCurrencyObject()).toEqual({
            code: 'GEL',
            name: 'Georgian Lari',
            rate: 1,
            quantity: 1,
            rateFormated: '1.0000'
        });
    });
});

describe('validateCurrencyResponse', () => {
    it('accepts a well-formed response', () => {
        expect(() => validateCurrencyResponse(sampleResponse)).not.toThrow();
    });

    it('rejects a non-array response', () => {
        expect(() => validateCurrencyResponse({})).toThrow();
    });

    it('rejects an empty array', () => {
        expect(() => validateCurrencyResponse([])).toThrow();
    });

    it('rejects a response missing the currencies field', () => {
        expect(() => validateCurrencyResponse([{ date: '2025-01-01' }])).toThrow();
    });
});

describe('findCurrencyInData', () => {
    it('returns the synthetic GEL currency without inspecting the response', () => {
        // Even malformed/empty data should not matter for GEL
        expect(findCurrencyInData(null, 'GEL')).toEqual(createGELCurrencyObject());
    });

    it('finds a currency present in the response', () => {
        expect(findCurrencyInData(sampleResponse, 'USD')).toEqual(sampleResponse[0].currencies[0]);
    });

    it('throws when the currency is not present', () => {
        expect(() => findCurrencyInData(sampleResponse, 'XXX')).toThrow(/not found/i);
    });

    it('throws when the response itself is malformed', () => {
        expect(() => findCurrencyInData([], 'USD')).toThrow(/No valid currency data/i);
    });
});

describe('currency rate caching', () => {
    beforeEach(() => {
        global.localStorage.clear();
    });

    it('returns null for an uncached date', () => {
        expect(getCurrencyRatesFromCache('2025-01-15')).toBeNull();
    });

    it('caches and retrieves rates for a date', () => {
        saveCurrencyRatesToCache('2025-01-15', sampleResponse);
        expect(getCurrencyRatesFromCache('2025-01-15')).toEqual(sampleResponse);
    });

    it('keeps caches for different dates independent', () => {
        saveCurrencyRatesToCache('2025-01-15', sampleResponse);
        expect(getCurrencyRatesFromCache('2025-01-16')).toBeNull();
    });
});

describe('fetchCurrencyRates', () => {
    beforeEach(() => {
        global.localStorage.clear();
    });

    it('resolves with the response body and caches it on success', async () => {
        const fakeFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(sampleResponse)
        });

        const data = await fetchCurrencyRates('2025-01-15', fakeFetch);

        expect(data).toEqual(sampleResponse);
        expect(getCurrencyRatesFromCache('2025-01-15')).toEqual(sampleResponse);
        expect(fakeFetch).toHaveBeenCalledWith(
            expect.stringContaining('date=2025-01-15'),
            expect.any(Object)
        );
    });

    it('rejects with a friendly error and does not cache on a non-ok response', async () => {
        const fakeFetch = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

        await expect(fetchCurrencyRates('2025-01-15', fakeFetch)).rejects.toThrow(/Failed to fetch exchange rates/i);
        expect(getCurrencyRatesFromCache('2025-01-15')).toBeNull();
    });

    it('propagates network-level rejections without caching', async () => {
        const fakeFetch = vi.fn().mockRejectedValue(new Error('network down'));

        await expect(fetchCurrencyRates('2025-01-15', fakeFetch)).rejects.toThrow('network down');
        expect(getCurrencyRatesFromCache('2025-01-15')).toBeNull();
    });
});
