# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

A static single-page web application for Georgian small business owners to track foreign currency income and convert it to Georgian Lari (GEL) using official National Bank of Georgia exchange rates. The application runs entirely in the browser with no backend - all data is stored in `localStorage`.

## Development Commands

### Local Development
```bash
# Simply open index.html in a web browser
# No build process required - pure HTML/CSS/JS

# Or run with Docker Compose (uses nginx:stable-alpine)
docker-compose up
```

### Code Quality & Linting
```bash
# Run pre-commit hooks (includes tests, JSON formatting, YAML sorting, security checks)
pre-commit run --all-files

# Run ESLint (enforces semicolons and single quotes)
npm run lint

# HTML linting uses HTMLHint with .htmlhintrc config
```

### Testing
```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode (useful during development)
npm run test:watch

# Run tests with interactive UI
npm run test:ui

# Generate coverage report (target: 80%+)
npm run test:coverage
```

### Deployment
- **GitHub Pages**: Auto-deploys on push to `main` branch via `.github/workflows/static.yml`
- **Self-hosted**: Uses Traefik reverse proxy with configurable domain via `.env` variables:
  - `SERVICE_NAME_OVERRIDE`: Subdomain (default: small-business-income-declaration)
  - `DOMAIN_NAME`: Base domain (default: local)
  - `TRAEFIK_CERT_RESOLVER`: TLS cert resolver (default: letsencrypt-cloudflare-dns-challenge)

## Architecture

### Core Components

**index.html**: Single-page UI with two-column layout (on desktop):
- Left column: Converter form, disclaimer, how-it-works sections
- Right column: User management, transaction history with filters
- **Important**: Loads `script.js` as ES6 module (`type="module"`)

**src/utils.js**: Pure utility functions (NEW - extracted for testability):
- Constants (currency symbols, error messages, limits)
- Validation utilities (date, amount, currency code, user, transaction)
- Formatting functions (currency formatting, symbol lookup)
- Calculation functions (currency conversion, YTD calculations)
- CSV utilities (parsing, validation)
- Helper functions (ID generation, debouncing, map building)

**script.js**: DOM-dependent application logic (~1000+ lines):
- Imports pure functions from `src/utils.js`
- Storage layer with localStorage wrappers
- User CRUD operations
- Transaction CRUD operations
- NBG API integration with caching
- Filtering/sorting system
- CSV import/export workflows
- UI rendering and event handlers

**style.css**: Nord-themed responsive design:
- CSS custom properties for theming
- Automatic dark mode via `@media (prefers-color-scheme: dark)`
- **Important**: `.disclaimer-card` and `.info-card` use `var(--bg-card)` for proper dark mode support

### Test Structure

**tests/setup.js**: Global test configuration
- localStorage/sessionStorage mocks
- Console spy setup
- Vitest global hooks

**tests/unit/**: Unit tests for pure functions
- `validation.test.js` - 40+ tests for all validation functions
- `formatting.test.js` - Currency formatting and symbol lookup tests
- `calculations.test.js` - Currency conversion and YTD calculation tests
- `csv.test.js` - CSV parsing and validation tests
- `utils.test.js` - ID generation, debouncing, utility functions

### Data Flow

1. User selects date → triggers `loadCurrencies()`
2. Fetches from NBG API: `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=YYYY-MM-DD`
3. Response cached in `localStorage` with key pattern: `currencyRates_${date}`
4. User enters amount and clicks convert → performs calculation
5. If "Add as Transaction" checked, appends to dynamically created `#transactionList` div

### API Response Schema

The NBG API returns an array with structure defined in `currency-rates-schema.json`:
```javascript
[{
  "date": "2025-03-29T00:00:00",
  "currencies": [{
    "code": "USD",
    "name": "US Dollar",
    "rate": 2.8750,
    "quantity": 1,
    "rateFormated": "2.8750",
    "diff": 0.0050,
    "diffFormated": "0.0050",
    "validFromDate": "2025-03-29T00:00:00"
  }]
}]
```

### User and Transaction Management

**Multi-User Support**:
- Users stored in `localStorage` with structure: `{ id, name, taxpayerId }`
- Default user "user" created on first load
- User CRUD operations: `loadUsers()`, `saveUser()`, `deleteUser()`, `getUserById()`
- Unique ID generation via `generateUserId()` using timestamp and random string

**Transaction Tracking**:
- Transactions stored in `localStorage` with structure:
  ```javascript
  {
    id, userId, date, currencyCode, currencyName,
    amount, rate, quantity, convertedGEL, comment, timestamp
  }
  ```
- YTD (Year-to-Date) calculation: `calculateYTDForTransaction()` computes running total per user per calendar year
- Filter and sort capabilities: filter by user, currency, date range; sort by any column
- CSV export/import with duplicate detection based on timestamp

### Caching Strategy
- **localStorage**: Stores API responses per date (key: `currencyRates_${date}`), users, transactions, checkbox state, and collapsible section states
- Cache can be cleared via "Clear Cache" button to force fresh API calls

### Key Features
- Multi-user transaction tracking with taxpayer ID support
- Year-to-Date income calculation per user per calendar year
- Sortable transaction table (click column headers)
- Filter transactions by user, currency, date range
- CSV export/import with user auto-creation on import
- Exchange rate cache management
- Collapsible disclaimer and help sections
- Future date validation (cannot select dates beyond today)
- Currency symbol display for common currencies
- Inline comment editing for transactions
- Enter key support in amount field

## Code Quality Rules

**ESLint** (`eslint.config.js`):
- Requires semicolons (`semi: error`)
- Enforces single quotes (`quotes: error`)
- ECMAScript 2021 support

**Pre-commit hooks** (`.pre-commit-config.yaml`):
- Auto-fixes: trailing whitespace, end-of-file, JSON formatting
- Security checks: AWS credentials, private keys detection
- Format validation: JSON, YAML, TOML, XML

**HTMLHint** (`.htmlhintrc`):
- Enforces lowercase tags/attributes, double-quoted attributes
- Requires DOCTYPE, unique IDs, proper tag pairing

## Testing

### Automated Testing

The project has a comprehensive unit test suite using Vitest:

1. **Unit Tests**: All pure functions in `src/utils.js` have tests in `tests/unit/`
   - 150+ test cases covering validation, formatting, calculations, CSV parsing
   - Run with `npm test` or `npm run test:watch`
   - Coverage reports: `npm run test:coverage`

2. **Manual Testing**: Open `index.html` and use "📊 Load Demo Data" to populate with sample data
3. **API Testing**: Convert currencies with various dates to verify NBG API integration
4. **Storage Testing**: Use browser DevTools → Application → Local Storage to inspect data
5. **Export/Import Testing**: Export CSV, clear all data, re-import to verify data integrity

## Important Implementation Details

### Year-to-Date (YTD) Calculation
The YTD income calculation is critical for tax threshold tracking:
- Transactions are sorted by date, then timestamp
- For each transaction, sum all prior transactions for the same user in the same calendar year
- Results are cached in a Map during rendering to avoid O(n²) recalculation
- See `precalculateAllYTD()` and `calculateYTDForTransaction()` functions

### User Deletion Protection
- Default 'user' account cannot be deleted if it's the only user
- Deleting a user also deletes all associated transactions (cascading delete)
- See `canDeleteUser()` for deletion validation logic

### CSV Import/Export
- **Export**: Generates CSV with all transaction fields plus user name and taxpayer ID
- **Import**:
  - Automatically creates missing users during import
  - Skips duplicate transactions based on matching timestamp
  - Validates all required columns before processing
  - Prevents duplicate user creation by checking existing user IDs

### Demo Data
- Demo data can only be loaded when no transactions exist (safety measure)
- Located in `demo-data.csv` with 3 sample users and 10 transactions
- Uses `loadDemoData()` which internally calls CSV import logic

### GEL Currency Handling
- GEL currency has special handling (rate always 1.0, no API call needed)
- See `createGELCurrencyObject()` for the synthetic GEL currency object

## Common Gotchas

- **Date Validation**: Dates must be between year 2000 and 2100, cannot be in the future
- **Amount Limits**: Maximum amount is 1,000,000,000 (see `MAX_AMOUNT` constant)
- **Storage Quota**: LocalStorage has ~5-10MB limit; app shows error if quota exceeded
- **API Timeout**: Currency fetches timeout after 10 seconds (see `API_TIMEOUT`)
- **Filter Debouncing**: Filter changes use 300ms debounce to reduce render calls
- **Sort Toggle**: Click column headers to toggle sort direction; supports multiple columns
- **Module System**: Script.js now uses ES6 modules; ensure `type="module"` in index.html

## Testing Strategy

### Unit Tests
All pure functions in `src/utils.js` have comprehensive unit tests:
- **100% coverage target** for validation, calculations, formatting
- Tests use Vitest with JSDOM for DOM APIs
- localStorage/sessionStorage are mocked globally in `tests/setup.js`

### Running Tests During Development
```bash
npm run test:watch  # Auto-runs tests on file changes
npm run test:ui     # Visual test runner in browser
```

### CI/CD Integration
- GitHub Actions workflow runs tests on every push/PR (`.github/workflows/test.yml`)
- Tests run on Node.js 18.x and 20.x
- Coverage reports uploaded to Codecov
- Pre-commit hook ensures tests pass before committing

### Writing New Tests
When adding new utility functions to `src/utils.js`:
1. Export the function from `src/utils.js`
2. Import it in the appropriate test file (or create new one)
3. Write tests covering:
   - Happy path with valid inputs
   - Edge cases (empty, null, undefined, boundary values)
   - Error conditions
   - Integration with other functions if applicable

### Test Coverage Requirements
Coverage thresholds (enforced in `vitest.config.js`):
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%
