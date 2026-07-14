# Testing

Uses [Vitest](https://vitest.dev/) with a jsdom environment (configured in
`vitest.config.js`). `tests/setup.js` mocks `localStorage`/`sessionStorage`
globally and spies on `console.error`/`warn`/`log` before every test.

## Structure

- `tests/unit/` — one file per `src/*.js` module (`storage`, `dom`, `users`,
  `transactions`, `currency`, `filters`, `csv`/`csv-workflow`, `validation`,
  `formatting`, `calculations`, `utils`), each exercising real exported
  functions with feature-level assertions (not implementation mocks).
- `tests/integration/app.test.js` — loads the *actual* `index.html` markup
  into jsdom, imports the real `script.js` against it, and drives the app
  like a user would (fill inputs, dispatch click/change events, read the
  rendered DOM). This is what covers the DOM-wiring layer in `script.js`
  that the unit tests deliberately don't reach.

## Commands

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:ui        # interactive UI
npm run test:coverage # coverage report, enforces thresholds below
```

## Coverage

Thresholds enforced in `vitest.config.js` and by CI
(`.github/workflows/test.yml`, which runs `npm run test:coverage` — a
failing threshold fails the build):
- Statements: 80% · Branches: 75% · Functions: 80% · Lines: 80%

## Writing New Tests

When adding a function to any `src/*.js` module:
1. Export it, import it in the matching test file (or add a new one)
2. Cover: happy path, edge cases (empty/null/undefined/boundary values),
   error conditions, and interaction with other functions if relevant
3. Test *behavior*, not internals — assert on return values / rendered DOM /
   storage contents, not on whether a particular internal helper was called
4. If the function touches DOM rendering or wires up an event handler, add
   or extend a case in `tests/integration/app.test.js` instead of trying to
   unit-test it in isolation

If the feature being tested has a `docs/features/T4G-NNNN-*.md` doc, write
its Testing section first (Human/Unit/Integration) and let the test cases
follow from that.

### Integration test gotchas (jsdom)

- `script.js` has top-level side effects (`initTheme()`, event listener
  registration) that run once at import — build the DOM fixture *before*
  importing it (dynamic `import()` inside the test, not a static import)
- `window.onload` is assigned as a plain property, not via
  `addEventListener('load', ...)` — call `window.onload()` directly
- jsdom doesn't implement `URL.createObjectURL` or `Blob.prototype.text()` —
  stub the former with `vi.fn()` and read blob contents via `FileReader`
  instead
- `filterState` lives at module scope in `script.js` and is shared across
  every test in the file (only one import happens) — reset it with
  `window.clearFilters()` in an `afterEach` so one test's leftover filter
  can't silently break a later one
