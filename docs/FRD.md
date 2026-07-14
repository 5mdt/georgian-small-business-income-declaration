# Feature Requirements Document

## Available Features

- [T4G-0001. Currency conversion](features/T4G-0001-currency-conversion.md) - `#currency` `#conversion`
- [T4G-0002. NBG exchange rate fetch + cache](features/T4G-0002-nbg-rate-fetch-cache.md) - `#currency` `#rates` `#storage`
- [T4G-0003. Historical rate by date](features/T4G-0003-historical-rate-by-date.md) - `#currency` `#rates` `#validation`
- [T4G-0004. GEL synthetic currency](features/T4G-0004-gel-synthetic-currency.md) - `#currency`
- [T4G-0005. User management](features/T4G-0005-user-management.md) - `#users`
- [T4G-0006. User delete protection](features/T4G-0006-user-delete-protection.md) - `#users` `#transactions`
- [T4G-0007. Transaction management](features/T4G-0007-transaction-management.md) - `#transactions`
- [T4G-0008. Year-to-date income calculation](features/T4G-0008-ytd-income-calculation.md) - `#ytd` `#transactions`
- [T4G-0009. Transaction filter and sort](features/T4G-0009-filter-and-sort.md) - `#transactions` `#ui`
- [T4G-0010. CSV export](features/T4G-0010-csv-export.md) - `#csv` `#transactions`
- [T4G-0011. CSV import](features/T4G-0011-csv-import.md) - `#csv` `#transactions` `#users`
- [T4G-0012. Demo data](features/T4G-0012-demo-data.md) - `#demo` `#csv`
- [T4G-0013. Local storage persistence](features/T4G-0013-local-storage-persistence.md) - `#storage` `#offline`
- [T4G-0014. Data and cache clearing](features/T4G-0014-data-and-cache-clearing.md) - `#storage` `#transactions` `#users`
- [T4G-0015. Theme switcher](features/T4G-0015-theme-switcher.md) - `#theme` `#ui`
- [T4G-0016. Input validation](features/T4G-0016-input-validation.md) - `#validation`
- [T4G-0017. Amount formatting](features/T4G-0017-amount-formatting.md) - `#currency` `#ui`

## Tags

- `#currency`: T4G-0001, T4G-0002, T4G-0003, T4G-0004, T4G-0017
- `#rates`: T4G-0002, T4G-0003
- `#conversion`: T4G-0001
- `#storage`: T4G-0002, T4G-0013, T4G-0014
- `#validation`: T4G-0003, T4G-0016
- `#users`: T4G-0005, T4G-0006, T4G-0011, T4G-0014
- `#transactions`: T4G-0006, T4G-0007, T4G-0008, T4G-0009, T4G-0010, T4G-0011, T4G-0014
- `#ytd`: T4G-0008
- `#ui`: T4G-0009, T4G-0015, T4G-0017
- `#csv`: T4G-0010, T4G-0011, T4G-0012
- `#demo`: T4G-0012
- `#offline`: T4G-0013
- `#theme`: T4G-0015
