# Feature Requirements Document

## Available Features

- [X] [T4G-0001. Currency conversion](features/T4G-0001-currency-conversion.md) - `#currency` `#conversion`
- [X] [T4G-0002. NBG exchange rate fetch + cache](features/T4G-0002-nbg-rate-fetch-cache.md) - `#currency` `#rates` `#storage`
- [X] [T4G-0003. Historical rate by date](features/T4G-0003-historical-rate-by-date.md) - `#currency` `#rates` `#validation`
- [X] [T4G-0004. GEL synthetic currency](features/T4G-0004-gel-synthetic-currency.md) - `#currency`
- [X] [T4G-0005. User management](features/T4G-0005-user-management.md) - `#users`
- [X] [T4G-0006. User delete protection](features/T4G-0006-user-delete-protection.md) - `#users` `#transactions`
- [X] [T4G-0007. Transaction management](features/T4G-0007-transaction-management.md) - `#transactions`
- [X] [T4G-0008. Year-to-date income calculation](features/T4G-0008-ytd-income-calculation.md) - `#ytd` `#transactions`
- [X] [T4G-0009. Transaction filter and sort](features/T4G-0009-filter-and-sort.md) - `#transactions` `#ui`

T4G-0010 and T4G-0011 (transaction CSV export/import) were folded into
[T4G-0020](features/T4G-0020-backup-and-restore.md) and their IDs retired —
this is why the sequence skips from 0009 to 0012.

- [X] [T4G-0012. Demo data](features/T4G-0012-demo-data.md) - `#demo` `#csv`
- [X] [T4G-0013. Local storage persistence](features/T4G-0013-local-storage-persistence.md) - `#storage` `#offline`
- [X] [T4G-0014. Data and cache clearing](features/T4G-0014-data-and-cache-clearing.md) - `#storage` `#transactions` `#users`
- [X] [T4G-0015. Theme switcher](features/T4G-0015-theme-switcher.md) - `#theme` `#ui`
- [X] [T4G-0016. Input validation](features/T4G-0016-input-validation.md) - `#validation`
- [X] [T4G-0017. Amount formatting](features/T4G-0017-amount-formatting.md) - `#currency` `#ui`
- [X] [T4G-0018. Update notification](features/T4G-0018-update-notification.md) - `#updates` `#ui` `#storage`
- [X] [T4G-0019. Data schema version](features/T4G-0019-data-schema-version.md) - `#storage` `#migration` `#ui` `#csv`
- [X] [T4G-0020. Backup & Restore](features/T4G-0020-backup-and-restore.md) - `#csv` `#storage` `#users` `#transactions` `#ui` `#migration`
- [X] [T4G-0021. Schema migration: key namespacing](features/T4G-0021-schema-migration-key-namespacing.md) - `#storage` `#migration`
- [ ] [T4G-0022. Per-user totals & supertotal](features/T4G-0022-per-user-and-supertotal.md) - `#transactions` `#ytd` `#ui`
- [ ] [T4G-0023. In-app changelog modal](features/T4G-0023-changelog-modal.md) - `#ui` `#updates`

## Tags

- `#currency`: T4G-0001, T4G-0002, T4G-0003, T4G-0004, T4G-0017
- `#rates`: T4G-0002, T4G-0003
- `#conversion`: T4G-0001
- `#storage`: T4G-0002, T4G-0013, T4G-0014, T4G-0018, T4G-0019, T4G-0020, T4G-0021
- `#validation`: T4G-0003, T4G-0016
- `#users`: T4G-0005, T4G-0006, T4G-0014, T4G-0020
- `#transactions`: T4G-0006, T4G-0007, T4G-0008, T4G-0009, T4G-0014, T4G-0020, T4G-0022
- `#ytd`: T4G-0008, T4G-0022
- `#ui`: T4G-0009, T4G-0015, T4G-0017, T4G-0018, T4G-0019, T4G-0020, T4G-0022, T4G-0023
- `#csv`: T4G-0012, T4G-0019, T4G-0020
- `#demo`: T4G-0012
- `#offline`: T4G-0013
- `#theme`: T4G-0015
- `#updates`: T4G-0018, T4G-0023
- `#migration`: T4G-0019, T4G-0020, T4G-0021
