# CLAUDE.md

## Repository Overview

A static single-page web app for Georgian small business owners to track
foreign currency income and convert it to GEL using official National Bank
of Georgia exchange rates. Pure HTML/CSS/JS, no backend — all data lives in
`localStorage`. See `README.md` for a feature summary and dev/deployment
commands.

## Core Rules (Docs-Driven Development)

This project follows **Documentation → Tests → Code**, and `docs/FRD.md`
(+ `docs/features/`) is the source of truth — it wins on conflict. Full
methodology, directory layout, and workflow: `docs/DDD.md`.

- Keep docs short, precise, and HOW-focused (WHY is at most one sentence).
  Don't rewrite doc sections that didn't change. Omit template sections
  that don't apply rather than filling them with "None"/"N/A".

## Critical Constraints

- **Module boundaries**: `src/utils.js` must stay free of `document`/`window`
  usage (pure, Node-testable); DOM-touching helpers belong in `src/dom.js`.
  `script.js` should stay DOM wiring only — business logic belongs in
  `src/*.js` so it's unit-testable. Full component map: `docs/ARCHITECTURE.md`.
- **`index.html`** loads `script.js` with `type="module"` — don't drop that.
- **Coverage is enforced by CI**, not just advisory: `npm run test:coverage`
  fails the build below 80% statements/lines, 75% branches, 80% functions
  (`vitest.config.js`, `.github/workflows/test.yml`). Details: `docs/TESTING.md`.
- **Date validation**: years must be 2000-2100, never in the future.
- **Amount validation**: capped at `MAX_AMOUNT` (1,000,000,000).
  Both: `docs/features/T4G-0016-input-validation.md`.

## Docs

- `docs/DDD.md` — the Docs-Driven Development methodology this project follows
- `docs/ARCHITECTURE.md` — components, data flow, storage schemas, gotchas
- `docs/TESTING.md` — test structure, coverage rules, writing new tests
- `docs/CONTRIBUTING.md` — prerequisites, code rules, deployment
- `docs/FRD.md` — index of all features, with a tag cross-reference
- `docs/features/T4G-NNNN-*.md` — one doc per feature (HOW it works,
  Testing, Status)
- `docs/CHANGELOG.md` — reverse-chronological log of shipped changes
- `docs/todo.md` — flat backlog of unpromoted ideas
