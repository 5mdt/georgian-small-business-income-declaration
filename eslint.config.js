/** @type {import('eslint').Linter.FlatConfig} */
module.exports = [
  {
    files: ['*.js'], // Specify the files you want to lint
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2021, // Specify ECMAScript version or other parser options
      },
    },
    rules: {
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
    },
  },
];
