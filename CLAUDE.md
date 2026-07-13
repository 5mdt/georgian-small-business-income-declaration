# CLAUDE.md

## Repository Overview

A static single-page web app for Georgian small business owners to track
foreign currency income and convert it to GEL using official National Bank
of Georgia exchange rates. Pure HTML/CSS/JS, no backend — all data lives in
`localStorage`. See `README.md` for features, usage, and dev/deployment
commands.

## Critical Constraints

- **Module boundaries**: `src/utils.js` must stay free of `document`/`window`
  usage (pure, Node-testable); DOM-touching helpers belong in `src/dom.js`.
  `script.js` should stay DOM wiring only — business logic belongs in
  `src/*.js` so it's unit-testable.
- **`index.html`** loads `script.js` with `type="module"` — don't drop that.
- **Coverage is enforced by CI**, not just advisory: `npm run test:coverage`
  fails the build below 80% statements/lines, 75% branches, 80% functions
  (`vitest.config.js`, `.github/workflows/test.yml`).
- **Date validation**: years must be 2000-2100, never in the future.
- **Amount validation**: capped at `MAX_AMOUNT` (1,000,000,000).

## Docs

- `docs/ARCHITECTURE.md` — components, data flow, storage schemas, gotchas
- `docs/TESTING.md` — test structure, coverage rules, writing new tests
