import { describe, it, expect } from 'vitest';
import {
    formatCurrency,
    getCurrencySymbol,
    CURRENCY_SYMBOLS
} from '../../src/utils.js';

describe('Currency Formatting', () => {
    it('should format numbers with 2 decimal places', () => {
        expect(formatCurrency(100)).toBe('100.00');
        expect(formatCurrency(100.5)).toBe('100.50');
        expect(formatCurrency(100.99)).toBe('100.99');
    });

    it('should add thousand separators', () => {
        expect(formatCurrency(1000)).toBe('1 000.00');
        expect(formatCurrency(10000)).toBe('10 000.00');
        expect(formatCurrency(100000)).toBe('100 000.00');
        expect(formatCurrency(1000000)).toBe('1 000 000.00');
    });

    it('should handle decimal values with thousand separators', () => {
        expect(formatCurrency(1234.56)).toBe('1 234.56');
        expect(formatCurrency(1234567.89)).toBe('1 234 567.89');
    });

    it('should handle zero', () => {
        expect(formatCurrency(0)).toBe('0.00');
    });

    it('should handle small decimals', () => {
        expect(formatCurrency(0.01)).toBe('0.01');
        expect(formatCurrency(0.99)).toBe('0.99');
    });

    it('should handle infinity and NaN', () => {
        expect(formatCurrency(Infinity)).toBe('0.00');
        expect(formatCurrency(-Infinity)).toBe('0.00');
        expect(formatCurrency(NaN)).toBe('0.00');
    });

    it('should handle negative numbers (edge case)', () => {
        expect(formatCurrency(-100)).toBe('-100.00');
        expect(formatCurrency(-1234.56)).toBe('-1 234.56');
    });

    it('should round to 2 decimal places', () => {
        expect(formatCurrency(100.123)).toBe('100.12');
        expect(formatCurrency(100.126)).toBe('100.13');
        expect(formatCurrency(100.994)).toBe('100.99');
        // Note: 100.995 rounds to 101.00 due to IEEE 754 floating point representation
        expect(formatCurrency(100.995)).toBe('101.00');
    });
});

describe('Currency Symbol Lookup', () => {
    it('should return correct symbols for known currencies', () => {
        expect(getCurrencySymbol('GEL')).toBe('₾');
        expect(getCurrencySymbol('USD')).toBe('$');
        expect(getCurrencySymbol('EUR')).toBe('€');
        expect(getCurrencySymbol('GBP')).toBe('£');
        expect(getCurrencySymbol('RUB')).toBe('₽');
        expect(getCurrencySymbol('JPY')).toBe('¥');
    });

    it('should return currency code for unknown currencies', () => {
        expect(getCurrencySymbol('XXX')).toBe('XXX');
        expect(getCurrencySymbol('BTC')).toBe('BTC');
        expect(getCurrencySymbol('UNKNOWN')).toBe('UNKNOWN');
    });

    it('should have all expected currency symbols defined', () => {
        const expectedCurrencies = [
            'GEL', 'USD', 'EUR', 'GBP', 'RUB', 'TRY', 'JPY', 'CNY',
            'CHF', 'AUD', 'CAD', 'INR', 'KRW', 'BRL', 'ZAR', 'SEK',
            'NOK', 'DKK', 'PLN', 'ILS', 'AED', 'SAR', 'THB'
        ];

        expectedCurrencies.forEach(code => {
            expect(CURRENCY_SYMBOLS[code]).toBeDefined();
            expect(typeof CURRENCY_SYMBOLS[code]).toBe('string');
        });
    });
});
