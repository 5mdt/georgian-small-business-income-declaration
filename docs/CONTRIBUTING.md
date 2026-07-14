# Contributing

## Prerequisites

- Docker and Docker Compose (for containerized deployment)
- Node.js and npm (for linting and tests)
- Python 3 with pre-commit (for code quality checks)

## Code Quality

```bash
# Run pre-commit hooks (includes tests)
pre-commit run --all-files

# Run ESLint
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Check JavaScript syntax
node --check script.js
```

`pre-commit` (`.pre-commit-config.yaml`) also runs generic hygiene checks
(trailing whitespace, merge conflicts, large files, JSON/YAML validity,
detect-private-key/aws-credentials) plus the unit test suite before every
commit.

## Code Rules

- **Module boundaries**: `src/utils.js` must stay free of `document`/`window`
  usage (pure, Node-testable); DOM-touching helpers belong in `src/dom.js`.
  `script.js` should stay DOM wiring only — business logic belongs in
  `src/*.js` so it's unit-testable. Full component map: `ARCHITECTURE.md`.
- **`index.html`** loads `script.js` with `type="module"` — don't drop that.
- **Style** (`eslint.config.cjs`): semicolons required, single quotes.
  `no-unused-vars` is an error in `src/**/*.js` and `tests/**/*.js`, but only
  a warning in `script.js` (which exposes functions via `window.*` for HTML
  `onclick` attributes, so some exports look "unused" to the linter).
  Unused args/vars prefixed `_` are exempt.
- **Coverage is enforced by CI**, not just advisory: `npm run test:coverage`
  fails the build below 80% statements/lines, 75% branches, 80% functions.
  Details: `TESTING.md`.
- **Date/amount validation caps**: years 2000-2100 (never in the future),
  amounts capped at `MAX_AMOUNT` (1,000,000,000). Full rules:
  `features/T4G-0016-input-validation.md`.
- This project follows [Docs-Driven Development](DDD.md). New or changed
  behavior needs a `docs/features/T4G-NNNN-*.md` entry before/alongside the
  code.

## Deployment

- **GitHub Pages**: Automatically deploys on push to `main` branch
- **Self-hosted**: Configure via `.env` file for Traefik reverse proxy:
  ```bash
  SERVICE_NAME_OVERRIDE=your-subdomain
  DOMAIN_NAME=example.com
  TRAEFIK_CERT_RESOLVER=letsencrypt-cloudflare-dns-challenge
  ```
