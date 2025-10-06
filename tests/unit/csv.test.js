import { describe, it, expect } from 'vitest';
import {
    validateCSVHeader,
    parseCSVLine,
    validateCSVRow,
    ERROR_MESSAGES
} from '../../src/utils.js';

describe('CSV Header Validation', () => {
    it('should validate headers with all required columns', () => {
        const validHeader = 'Date,User ID,User Name,Taxpayer ID,Currency Code,Currency Name,Amount,Rate,Quantity,Converted GEL,Comment,Timestamp';
        expect(validateCSVHeader(validHeader)).toBe(true);
    });

    it('should validate headers with YTD column', () => {
        const validHeader = 'Date,User ID,User Name,Taxpayer ID,Currency Code,Currency Name,Amount,Rate,Quantity,Converted GEL,YTD Income,Comment,Timestamp';
        expect(validateCSVHeader(validHeader)).toBe(true);
    });

    it('should throw error if Date column is missing', () => {
        const invalidHeader = 'User ID,Currency Code,Converted GEL';
        expect(() => validateCSVHeader(invalidHeader)).toThrow(ERROR_MESSAGES.INVALID_CSV);
    });

    it('should throw error if Currency Code column is missing', () => {
        const invalidHeader = 'Date,User ID,Converted GEL';
        expect(() => validateCSVHeader(invalidHeader)).toThrow(ERROR_MESSAGES.INVALID_CSV);
    });

    it('should throw error if Converted GEL column is missing', () => {
        const invalidHeader = 'Date,Currency Code,User ID';
        expect(() => validateCSVHeader(invalidHeader)).toThrow(ERROR_MESSAGES.INVALID_CSV);
    });

    it('should accept additional columns', () => {
        const headerWithExtra = 'Date,Currency Code,Converted GEL,Extra Column 1,Extra Column 2';
        expect(validateCSVHeader(headerWithExtra)).toBe(true);
    });
});

describe('CSV Line Parsing', () => {
    it('should parse simple CSV line', () => {
        const line = '2025-01-15,user1,John Doe,123456,USD,US Dollar,100,2.875,1,287.5,Test,1000';
        const values = parseCSVLine(line);

        expect(values).toHaveLength(12);
        expect(values[0]).toBe('2025-01-15');
        expect(values[1]).toBe('user1');
        expect(values[6]).toBe('100');
    });

    it('should handle quoted values with commas', () => {
        const line = '2025-01-15,user1,"Doe, John",123456,USD,"US Dollar",100,2.875,1,287.5,"Test, value",1000';
        const values = parseCSVLine(line);

        expect(values[2]).toBe('Doe, John');
        expect(values[5]).toBe('US Dollar');
        expect(values[10]).toBe('Test, value');
    });

    it('should handle escaped quotes', () => {
        const line = '2025-01-15,user1,"John ""Johnny"" Doe",123456,USD,US Dollar,100,2.875,1,287.5,Test,1000';
        const values = parseCSVLine(line);

        expect(values[2]).toBe('John "Johnny" Doe');
    });

    it('should handle empty values', () => {
        const line = '2025-01-15,user1,"",123456,USD,US Dollar,100,2.875,1,287.5,"",1000';
        const values = parseCSVLine(line);

        expect(values[2]).toBe('');
        expect(values[10]).toBe('');
    });

    it('should handle values with only quotes', () => {
        const line = '"2025-01-15","user1","John Doe","123456","USD","US Dollar","100","2.875","1","287.5","Test","1000"';
        const values = parseCSVLine(line);

        expect(values).toHaveLength(12);
        expect(values[0]).toBe('2025-01-15');
        expect(values[1]).toBe('user1');
    });

    it('should handle complex quoted strings', () => {
        const line = '2025-01-15,user1,"Payment for ""Contract #123"", due on 01/15",123456,USD,US Dollar,100,2.875,1,287.5,Test,1000';
        const values = parseCSVLine(line);

        expect(values[2]).toBe('Payment for "Contract #123", due on 01/15');
    });
});

describe('CSV Row Validation', () => {
    it('should validate row with 12 columns (without YTD)', () => {
        const values = ['2025-01-15', 'user1', 'John Doe', '123456', 'USD', 'US Dollar', '100', '2.875', '1', '287.5', 'Test', '1000'];
        expect(validateCSVRow(values)).toBe(true);
    });

    it('should validate row with 13 columns (with YTD)', () => {
        const values = ['2025-01-15', 'user1', 'John Doe', '123456', 'USD', 'US Dollar', '100', '2.875', '1', '287.5', '287.5', 'Test', '1000'];
        expect(validateCSVRow(values)).toBe(true);
    });

    it('should reject row with less than 12 columns', () => {
        const values = ['2025-01-15', 'user1', 'USD', '100'];
        expect(validateCSVRow(values)).toBe(false);
    });

    it('should reject row with invalid date', () => {
        const values = ['invalid-date', 'user1', 'John Doe', '123456', 'USD', 'US Dollar', '100', '2.875', '1', '287.5', 'Test', '1000'];
        expect(validateCSVRow(values)).toBe(false);
    });

    it('should reject row with invalid currency code', () => {
        const values = ['2025-01-15', 'user1', 'John Doe', '123456', 'US', 'US Dollar', '100', '2.875', '1', '287.5', 'Test', '1000'];
        expect(validateCSVRow(values)).toBe(false);

        const values2 = ['2025-01-15', 'user1', 'John Doe', '123456', 'usd', 'US Dollar', '100', '2.875', '1', '287.5', 'Test', '1000'];
        expect(validateCSVRow(values2)).toBe(false);
    });

    it('should reject row with non-numeric amount', () => {
        const values = ['2025-01-15', 'user1', 'John Doe', '123456', 'USD', 'US Dollar', 'invalid', '2.875', '1', '287.5', 'Test', '1000'];
        expect(validateCSVRow(values)).toBe(false);
    });

    it('should reject row with non-numeric converted GEL', () => {
        const values = ['2025-01-15', 'user1', 'John Doe', '123456', 'USD', 'US Dollar', '100', '2.875', '1', 'invalid', 'Test', '1000'];
        expect(validateCSVRow(values)).toBe(false);
    });

    it('should accept numeric strings for amounts', () => {
        const values = ['2025-01-15', 'user1', 'John Doe', '123456', 'USD', 'US Dollar', '100.50', '2.875', '1', '287.5', 'Test', '1000'];
        expect(validateCSVRow(values)).toBe(true);
    });

    it('should handle edge cases for dates', () => {
        const values1 = ['1999-12-31', 'user1', 'John Doe', '123456', 'USD', 'US Dollar', '100', '2.875', '1', '287.5', 'Test', '1000'];
        expect(validateCSVRow(values1)).toBe(false); // Before MIN_YEAR

        const values2 = ['2101-01-01', 'user1', 'John Doe', '123456', 'USD', 'US Dollar', '100', '2.875', '1', '287.5', 'Test', '1000'];
        expect(validateCSVRow(values2)).toBe(false); // After MAX_YEAR
    });
});
