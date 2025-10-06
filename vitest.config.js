import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use jsdom environment for DOM APIs
    environment: 'jsdom',

    // Global test setup
    globals: true,

    // Test file patterns
    include: ['tests/**/*.test.js'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.js', 'script.js'],
      exclude: [
        'tests/**',
        '**/*.config.js',
        '**/node_modules/**'
      ],
      // Coverage thresholds
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80
      }
    },

    // Setup files
    setupFiles: ['./tests/setup.js']
  }
});
