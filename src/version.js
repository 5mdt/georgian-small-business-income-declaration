// ===========================
// App Version
// ===========================
//
// Single source of truth for the app's current version. This is a static
// site with no build step, so it can't be read from package.json at
// runtime - bump this by hand alongside docs/CHANGELOG.md entries.

export const APP_VERSION = '1.2.0';
