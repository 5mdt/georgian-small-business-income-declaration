import { describe, it, expect } from 'vitest';
import {
    validateDateString,
    validateAmount,
    validateCurrencyCode,
    validateUser,
    validateTransaction,
    MIN_YEAR,
    MAX_AMOUNT
} from '../../src/utils.js';

describe('Date Validation', () => {
    it('should validate correct date strings', () => {
        expect(validateDateString('2025-01-15')).toBe(true);
        expect(validateDateString('2000-01-01')).toBe(true);
        expect(validateDateString('2100-12-31')).toBe(true);
    });

    it('should reject invalid date formats', () => {
        expect(validateDateString('')).toBe(false);
        expect(validateDateString(null)).toBe(false);
        expect(validateDateString(undefined)).toBe(false);
        expect(validateDateString('invalid')).toBe(false);
        expect(validateDateString('2025-13-01')).toBe(false);
        expect(validateDateString('2025-01-32')).toBe(false);
    });

    it('should reject dates outside allowed year range', () => {
        expect(validateDateString('1999-12-31')).toBe(false);
        expect(validateDateString('2101-01-01')).toBe(false);
    });

    it('should accept dates at year boundaries', () => {
        expect(validateDateString(`${MIN_YEAR}-01-01`)).toBe(true);
        expect(validateDateString('2100-12-31')).toBe(true);
    });
});

describe('Amount Validation', () => {
    it('should validate positive numbers', () => {
        expect(validateAmount(1)).toBe(true);
        expect(validateAmount(100.50)).toBe(true);
        expect(validateAmount(1000000)).toBe(true);
    });

    it('should reject zero and negative numbers', () => {
        expect(validateAmount(0)).toBe(false);
        expect(validateAmount(-1)).toBe(false);
        expect(validateAmount(-100.50)).toBe(false);
    });

    it('should reject non-numeric values', () => {
        expect(validateAmount('100')).toBe(false);
        expect(validateAmount(null)).toBe(false);
        expect(validateAmount(undefined)).toBe(false);
        expect(validateAmount(NaN)).toBe(false);
        expect(validateAmount(Infinity)).toBe(false);
        expect(validateAmount(-Infinity)).toBe(false);
    });

    it('should reject amounts exceeding MAX_AMOUNT', () => {
        expect(validateAmount(MAX_AMOUNT + 1)).toBe(false);
        expect(validateAmount(MAX_AMOUNT)).toBe(true);
        expect(validateAmount(MAX_AMOUNT - 1)).toBe(true);
    });

    it('should handle decimal precision', () => {
        expect(validateAmount(0.01)).toBe(true);
        expect(validateAmount(99.99)).toBe(true);
        expect(validateAmount(1.123456789)).toBe(true);
    });
});

describe('Currency Code Validation', () => {
    it('should validate 3-letter uppercase codes', () => {
        expect(validateCurrencyCode('USD')).toBe(true);
        expect(validateCurrencyCode('EUR')).toBe(true);
        expect(validateCurrencyCode('GEL')).toBe(true);
        expect(validateCurrencyCode('GBP')).toBe(true);
    });

    it('should reject invalid formats', () => {
        expect(validateCurrencyCode('')).toBe(false);
        expect(validateCurrencyCode('US')).toBe(false);
        expect(validateCurrencyCode('USDT')).toBe(false);
        expect(validateCurrencyCode('usd')).toBe(false);
        expect(validateCurrencyCode('Usd')).toBe(false);
        expect(validateCurrencyCode('123')).toBe(false);
        expect(validateCurrencyCode('U$D')).toBe(false);
    });

    it('should reject non-string values', () => {
        expect(validateCurrencyCode(null)).toBe(false);
        expect(validateCurrencyCode(undefined)).toBe(false);
        expect(validateCurrencyCode(123)).toBe(false);
        expect(validateCurrencyCode({})).toBe(false);
    });
});

describe('User Validation', () => {
    it('should validate correct user objects', () => {
        expect(validateUser({
            id: 'user_123',
            name: 'John Doe',
            taxpayerId: '123456789'
        })).toBe(true);

        expect(validateUser({
            id: 'user',
            name: 'user',
            taxpayerId: ''
        })).toBe(true);
    });

    it('should reject objects missing required fields', () => {
        expect(validateUser({})).toBe(false);
        expect(validateUser({ id: 'user_123' })).toBe(false);
        expect(validateUser({ name: 'John Doe' })).toBe(false);
        expect(validateUser({ id: 'user_123', name: '' })).toBe(false);
        expect(validateUser({ id: '', name: 'John Doe' })).toBe(false);
    });

    it('should reject non-object values', () => {
        expect(validateUser(null)).toBe(false);
        expect(validateUser(undefined)).toBe(false);
        expect(validateUser('user')).toBe(false);
        expect(validateUser(123)).toBe(false);
    });

    it('should reject objects with wrong types', () => {
        expect(validateUser({ id: 123, name: 'John' })).toBe(false);
        expect(validateUser({ id: 'user_123', name: 123 })).toBe(false);
    });
});

describe('Transaction Validation', () => {
    const validTransaction = {
        id: 'tx_123',
        userId: 'user_456',
        date: '2025-01-15',
        currencyCode: 'USD',
        amount: 100.50,
        convertedGEL: 288.75,
        rate: 2.875,
        quantity: 1
    };

    it('should validate correct transaction objects', () => {
        expect(validateTransaction(validTransaction)).toBe(true);
    });

    it('should reject transactions missing required fields', () => {
        expect(validateTransaction({})).toBe(false);
        expect(validateTransaction({ ...validTransaction, id: undefined })).toBe(false);
        expect(validateTransaction({ ...validTransaction, userId: undefined })).toBe(false);
        expect(validateTransaction({ ...validTransaction, date: undefined })).toBe(false);
        expect(validateTransaction({ ...validTransaction, currencyCode: undefined })).toBe(false);
        expect(validateTransaction({ ...validTransaction, amount: undefined })).toBe(false);
        expect(validateTransaction({ ...validTransaction, convertedGEL: undefined })).toBe(false);
    });

    it('should reject transactions with invalid date', () => {
        expect(validateTransaction({
            ...validTransaction,
            date: 'invalid'
        })).toBe(false);

        expect(validateTransaction({
            ...validTransaction,
            date: '1999-01-01'
        })).toBe(false);
    });

    it('should reject transactions with invalid currency code', () => {
        expect(validateTransaction({
            ...validTransaction,
            currencyCode: 'US'
        })).toBe(false);

        expect(validateTransaction({
            ...validTransaction,
            currencyCode: 'usd'
        })).toBe(false);
    });

    it('should reject transactions with invalid amounts', () => {
        expect(validateTransaction({
            ...validTransaction,
            amount: 0
        })).toBe(false);

        expect(validateTransaction({
            ...validTransaction,
            amount: -100
        })).toBe(false);

        expect(validateTransaction({
            ...validTransaction,
            convertedGEL: 0
        })).toBe(false);

        expect(validateTransaction({
            ...validTransaction,
            convertedGEL: -100
        })).toBe(false);
    });

    it('should reject non-object values', () => {
        expect(validateTransaction(null)).toBe(false);
        expect(validateTransaction(undefined)).toBe(false);
        expect(validateTransaction('transaction')).toBe(false);
    });
});
