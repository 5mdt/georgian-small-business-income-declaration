/** @type {import('eslint').Linter.FlatConfig} */
module.exports = [
  {
    files: ['script.js'], // Main application code (has global functions for HTML)
    languageOptions: {
      sourceType: 'module',
      parserOptions: {
        ecmaVersion: 2021,
      },
    },
    rules: {
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'no-unused-vars': ['warn', { // Warn instead of error for script.js
        'vars': 'all',
        'args': 'after-used',
        'ignoreRestSiblings': false,
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
    },
  },
  {
    files: ['src/**/*.js'], // Pure utility modules
    languageOptions: {
      sourceType: 'module',
      parserOptions: {
        ecmaVersion: 2021,
      },
    },
    rules: {
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'no-unused-vars': ['error', { // Error for utilities
        'vars': 'all',
        'args': 'after-used',
        'ignoreRestSiblings': false,
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
    },
  },
  {
    files: ['tests/**/*.js'], // Test files
    languageOptions: {
      sourceType: 'module',
      parserOptions: {
        ecmaVersion: 2021,
      },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'no-unused-vars': ['error', {
        'vars': 'all',
        'args': 'after-used',
        'ignoreRestSiblings': false,
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
    },
  },
];
