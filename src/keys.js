// ===========================
// Storage Key Names
// ===========================
//
// Single source of truth for the localStorage/sessionStorage keys the app
// writes today (schema version 2 - see src/version.js's DATA_SCHEMA_VERSION
// and src/migrations.js). Every reader/writer imports from here instead of
// hardcoding a string, so a future rename only touches this file plus a
// migration entry.
//
// Keys are namespaced `t4g_<category>_<name>`:
// - data: the actual records (transactions, users)
// - config: user-set UI preferences
// - cache: re-fetchable derived data (exchange rates)
//
// t4g_appVersion and t4g_dataSchemaVersion (script.js) predate this
// category convention and are left as-is - they're version-tracking
// metadata, not app data/config/cache.

export const STORAGE_KEYS = {
    transactions: 't4g_data_transactions',
    users: 't4g_data_users',
    themePreference: 't4g_config_themePreference',
    addTransaction: 't4g_config_addTransaction'
};

// Currency rate cache keys are date-suffixed (one per YYYY-MM-DD), so they
// can't be a fixed entry in STORAGE_KEYS - callers build the full key as
// `${CURRENCY_RATE_KEY_PREFIX}${date}`.
export const CURRENCY_RATE_KEY_PREFIX = 't4g_cache_currencyRates_';

// Collapsible-section state (sessionStorage, not localStorage - not part of
// DATA_SCHEMA_VERSION/migrations.js, since sessionStorage doesn't persist
// across browser sessions and has nothing to migrate). One key per section
// id: `${COLLAPSIBLE_KEY_PREFIX}${sectionId}`.
export const COLLAPSIBLE_KEY_PREFIX = 't4g_config_collapsible_';
