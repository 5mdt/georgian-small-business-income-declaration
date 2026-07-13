import { describe, it, expect } from 'vitest';
import { sanitizeInput, showElement, hideElement, showError, hideError } from '../../src/dom.js';

describe('sanitizeInput', () => {
    it('escapes HTML-significant characters', () => {
        expect(sanitizeInput('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('leaves plain text unchanged', () => {
        expect(sanitizeInput('Payment for invoice #123')).toBe('Payment for invoice #123');
    });

    it('returns empty string for falsy input', () => {
        expect(sanitizeInput('')).toBe('');
        expect(sanitizeInput(null)).toBe('');
        expect(sanitizeInput(undefined)).toBe('');
    });
});

describe('showElement / hideElement', () => {
    it('removes the hidden class', () => {
        const el = document.createElement('div');
        el.classList.add('hidden');
        showElement(el);
        expect(el.classList.contains('hidden')).toBe(false);
    });

    it('adds the hidden class', () => {
        const el = document.createElement('div');
        hideElement(el);
        expect(el.classList.contains('hidden')).toBe(true);
    });

    it('does nothing for a null element', () => {
        expect(() => showElement(null)).not.toThrow();
        expect(() => hideElement(null)).not.toThrow();
    });
});

describe('showError / hideError', () => {
    it('sets text content and reveals the element', () => {
        document.body.innerHTML = '<div id="errorMessage" class="hidden"></div>';
        showError('errorMessage', 'Something went wrong');

        const el = document.getElementById('errorMessage');
        expect(el.textContent).toBe('Something went wrong');
        expect(el.classList.contains('hidden')).toBe(false);
    });

    it('clears text content and hides the element', () => {
        document.body.innerHTML = '<div id="errorMessage">Old error</div>';
        hideError('errorMessage');

        const el = document.getElementById('errorMessage');
        expect(el.textContent).toBe('');
        expect(el.classList.contains('hidden')).toBe(true);
    });

    it('does nothing when the element does not exist', () => {
        document.body.innerHTML = '';
        expect(() => showError('missing', 'x')).not.toThrow();
        expect(() => hideError('missing')).not.toThrow();
    });
});
