# Docs-Driven Development

This project is documented and built spec-first: **Documentation → Tests →
Code**, in that order. `docs/FRD.md` and its children under
`docs/features/` are the source of truth for feature behavior — if the
docs and the code/an assumption disagree, the FRD wins.

## Directory layout

```
docs/
  FRD.md                    # index of all features, with a tag cross-reference
  ARCHITECTURE.md           # cross-cutting components, data flow, gotchas
  TESTING.md                # test structure, coverage rules
  CONTRIBUTING.md           # prerequisites, code rules, deployment
  DDD.md                    # this file
  todo.md                   # flat backlog of unpromoted ideas
  CHANGELOG.md              # flat, reverse-chronological log of shipped changes
  features/
    TEMPLATE.md              # empty skeleton for new feature docs
    T4G-NNNN-slug.md          # one file per feature
```

`T4G` is this project's feature-ID prefix (Georgian small business income
declaration → **T**ax **4** **G**eorgia). `NNNN` is a zero-padded sequential
ID. IDs are never reused or renumbered. One feature = one file; a feature is
a user- or operator-visible behavior, not a code module.

## Workflow

1. **Write the doc first.** Copy `docs/features/TEMPLATE.md` to
   `docs/features/T4G-NNNN-slug.md`, fill in Description and planned
   Implementation/Configuration. Add the entry (with tags) to
   `docs/FRD.md`.
2. **Write tests against the doc's Testing section** (Human / Unit /
   Integration) before or alongside implementation.
3. **Implement** until tests pass and behavior matches the doc.
4. **Update Status** to `Implemented` (or `Planned` / `Deprecated`), and add
   a one-line entry to `docs/CHANGELOG.md` under `## Unreleased`,
   referencing the feature ID.
5. If a feature's behavior changes, **edit its doc in place** — don't
   create a new numbered doc for the same feature — and add a new
   changelog entry under `## Unreleased` for the change.
6. Ideas not yet worth a numbered feature go in `docs/todo.md` as one line
   each; promote to a full doc when work starts.
7. On release/tag, rename `## Unreleased` to the release date/version and
   start a fresh `## Unreleased` section above it.

See `docs/features/TEMPLATE.md` for the empty skeleton, and
`docs/features/T4G-0001-currency-conversion.md` (or any other feature doc)
for a worked example.

## Known trade-offs

- The FRD index and tag table in `docs/FRD.md` are hand-maintained —
  nothing enforces they stay in sync with the per-feature docs.
- Sequential IDs give no thematic grouping; tags are the only cross-cutting
  navigation.
- Works well up to roughly a few dozen features; a flat tag index gets
  unwieldy well beyond that.
- Relies on discipline (docs → tests → code) rather than tooling to
  enforce ordering.
