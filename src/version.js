// ===========================
// App Version
// ===========================
//
// Single source of truth for the app's current version. This is a static
// site with no build step, so it can't be read from package.json at
// runtime - bump this by hand alongside docs/CHANGELOG.md entries.

export const APP_VERSION = '1.4.0';

// ===========================
// Data Schema Version
// ===========================
//
// Tracks the shape of the data stored in localStorage, independently of
// APP_VERSION above - a UI-only release doesn't necessarily change the
// data shape, and vice versa. A monotonic integer (not semver): a data
// schema has no meaningful major/minor/patch split, so this follows the
// conventional DB-migration numbering (Rails/Django style) instead. Bump
// by hand whenever a stored data shape actually changes.

export const DATA_SCHEMA_VERSION = 1;
