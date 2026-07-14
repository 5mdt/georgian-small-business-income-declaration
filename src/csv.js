// ===========================
// CSV Import/Export
// ===========================
//
// Extracted from script.js. The import/export "business logic" is kept
// pure - it takes existing users/transactions as plain data and returns
// new data plus stats/CSV text, rather than reading/writing storage or the
// DOM itself. script.js wraps these with storage + FileReader/Blob/download
// plumbing.

import { validateCSVHeader, validateUsersCSVHeader, parseCSVLine, validateCSVRow, validateUser, generateTransactionId } from './utils.js';
import { sanitizeInput } from './dom.js';

/**
 * Builds a transaction object from a parsed CSV row.
 * @param {Array<string>} values - Parsed CSV row (see validateCSVRow for column layout)
 * @returns {Object} Transaction
 */
export function extractTransactionFromCSVRow(values) {
    const hasYTD = values.length >= 13;

    return {
        id: generateTransactionId(),
        userId: values[1],
        date: values[0],
        currencyCode: values[4],
        currencyName: values[5],
        amount: parseFloat(values[6]),
        rate: parseFloat(values[7]),
        quantity: parseFloat(values[8]),
        convertedGEL: parseFloat(values[9]),
        comment: sanitizeInput(hasYTD ? values[11] : values[10]),
        timestamp: hasYTD ? values[12] : values[11]
    };
}

/**
 * Adds a user parsed from a CSV row to `users`/`userIds` if it doesn't
 * already exist. Mutates both collections in place (called from a tight
 * import loop where every row may introduce a new user).
 * @param {string} userId
 * @param {string} userName
 * @param {string} taxpayerId
 * @param {Array<Object>} users
 * @param {Set<string>} userIds
 * @returns {{created: boolean, user?: Object, error?: string}}
 */
export function ensureUserExistsFromCSV(userId, userName, taxpayerId, users, userIds) {
    if (userIds.has(userId)) {
        return { created: false };
    }

    const newUser = {
        id: userId,
        name: sanitizeInput(userName),
        taxpayerId: sanitizeInput(taxpayerId)
    };

    if (validateUser(newUser)) {
        users.push(newUser);
        userIds.add(userId);
        return { created: true, user: newUser };
    }

    return { created: false, error: 'Invalid user data' };
}

/**
 * Parses CSV content and computes the resulting users/transactions after
 * import, without touching storage. Duplicate transactions are detected by
 * timestamp - both against `existingTransactions` and against other rows
 * already processed earlier in the same file.
 * @param {string} content - Raw CSV file content
 * @param {Array<Object>} existingTransactions
 * @param {Array<Object>} existingUsers
 * @param {boolean} [overwrite] - false (default): merge into existing data,
 *   skipping duplicate timestamps. true: ignore existing data entirely -
 *   the result is built purely from the file (plus any users it
 *   references), i.e. a wholesale replace.
 * @returns {{users: Array<Object>, transactions: Array<Object>, stats: {imported: number, skipped: number, usersCreated: number}}}
 * @throws {Error} If the CSV header is missing required columns
 */
export function buildImportResult(content, existingTransactions, existingUsers, overwrite = false) {
    const lines = content.split('\n');
    const header = lines[0].trim();

    validateCSVHeader(header);

    const transactions = overwrite ? [] : [...existingTransactions];
    const users = overwrite ? [] : [...existingUsers];
    const existingTimestamps = overwrite ? new Set() : new Set(existingTransactions.map(t => t.timestamp));
    const userIds = new Set(users.map(u => u.id));

    const stats = { imported: 0, skipped: 0, usersCreated: 0 };

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        if (!validateCSVRow(values)) continue;

        const hasYTD = values.length >= 13;
        const timestamp = hasYTD ? values[12] : values[11];

        if (existingTimestamps.has(timestamp)) {
            stats.skipped++;
            continue;
        }

        const userResult = ensureUserExistsFromCSV(values[1], values[2], values[3], users, userIds);
        if (userResult.created) {
            stats.usersCreated++;
        }

        const transaction = extractTransactionFromCSVRow(values);
        transactions.push(transaction);
        // Also guard against duplicate timestamps within this same file,
        // not just against transactions that existed before the import.
        existingTimestamps.add(timestamp);
        stats.imported++;
    }

    return { users, transactions, stats };
}

const EXPORT_CSV_HEADER = 'Date,User ID,User Name,Taxpayer ID,Currency Code,Currency Name,Amount,Exchange Rate,Quantity,Converted GEL,YTD Income,Comment,Timestamp\n';
const USERS_CSV_HEADER = 'User ID,User Name,Taxpayer ID\n';

export const APP_NAME = 'Currency to GEL Converter';
export const GITHUB_URL = 'https://github.com/5mdt/georgian-small-business-income-declaration';

/**
 * Builds the trailing `#`-prefixed comment lines shared by every export
 * format (file description, GitHub link, the instance URL if provided, and
 * the data schema version). None has 12+ (or 3+) comma-separated values, so
 * validateCSVRow()/a users CSV row parser silently skips all of them on
 * re-import without needing any parser changes.
 * @param {number} dataSchemaVersion - Schema version of the data being
 *   exported (the *stored* schema, not necessarily the running code's
 *   DATA_SCHEMA_VERSION - see script.js's currentDataSchemaVersion()).
 * @param {string} [instanceUrl] - The app's own URL at export time (e.g.
 *   `window.location.href`), if known. src/csv.js has no `window` access of
 *   its own, so script.js injects this - same pattern as currency.js's
 *   injectable fetch.
 * @returns {string} Comment tail text
 */
function buildCommentTail(dataSchemaVersion, instanceUrl) {
    let tail = `# ${APP_NAME} - CSV export\n`;
    tail += `# ${GITHUB_URL}\n`;
    if (instanceUrl) {
        tail += `# Instance: ${instanceUrl}\n`;
    }
    tail += `# Data schema version: ${dataSchemaVersion}\n`;
    return tail;
}

/**
 * Builds the CSV text for a set of (already filtered/sorted) transactions.
 * Ends with the shared comment tail (see buildCommentTail).
 * @param {Array<Object>} transactions - Transactions to export
 * @param {Function} calculateYTDFn - (transaction) => number, YTD for that transaction
 * @param {Function} getUserByIdFn - (userId) => user object | undefined
 * @param {number} dataSchemaVersion - Schema version of the data being exported
 * @param {string} [instanceUrl] - The app's own URL at export time, if known
 * @returns {string} CSV content, including header
 */
export function buildExportCSVContent(transactions, calculateYTDFn, getUserByIdFn, dataSchemaVersion, instanceUrl) {
    let csvContent = EXPORT_CSV_HEADER;

    transactions.forEach(t => {
        const user = getUserByIdFn(t.userId);
        const userName = user ? user.name : '';
        const taxpayerId = user ? user.taxpayerId : '';
        const escapedUserName = `"${userName.replace(/"/g, '""')}"`;
        const escapedCurrencyName = `"${t.currencyName.replace(/"/g, '""')}"`;
        const escapedComment = `"${(t.comment || '').replace(/"/g, '""')}"`;
        const ytdIncome = calculateYTDFn(t);

        csvContent += `${t.date},${t.userId},${escapedUserName},${taxpayerId},${t.currencyCode},${escapedCurrencyName},${t.amount},${t.rate},${t.quantity},${t.convertedGEL},${ytdIncome},${escapedComment},${t.timestamp}\n`;
    });

    csvContent += buildCommentTail(dataSchemaVersion, instanceUrl);

    return csvContent;
}

/**
 * Builds the download filename for an export, based on the active user filter.
 * @param {Object} filterState - { userId }
 * @param {Function} getUserByIdFn - (userId) => user object | undefined
 * @param {string} todayISODate - YYYY-MM-DD to embed in the filename
 * @returns {string} Filename
 */
export function buildExportFilename(filterState, getUserByIdFn, todayISODate) {
    if (filterState.userId !== 'all') {
        const user = getUserByIdFn(filterState.userId);
        const userName = user ? user.name.replace(/[^a-z0-9]/gi, '_') : 'user';
        return `gel-transactions-${userName}-${todayISODate}.csv`;
    }
    return `gel-transactions-all-${todayISODate}.csv`;
}

/**
 * Builds the CSV text for a set of users. Ends with the same shared comment
 * tail as buildExportCSVContent (see buildCommentTail).
 * @param {Array<Object>} users - Users to export
 * @param {number} dataSchemaVersion - Schema version of the data being exported
 * @param {string} [instanceUrl] - The app's own URL at export time, if known
 * @returns {string} CSV content, including header
 */
export function buildUsersCSVContent(users, dataSchemaVersion, instanceUrl) {
    let csvContent = USERS_CSV_HEADER;

    users.forEach(u => {
        const escapedName = `"${(u.name || '').replace(/"/g, '""')}"`;
        const escapedTaxpayerId = `"${(u.taxpayerId || '').replace(/"/g, '""')}"`;
        csvContent += `${u.id},${escapedName},${escapedTaxpayerId}\n`;
    });

    csvContent += buildCommentTail(dataSchemaVersion, instanceUrl);

    return csvContent;
}

/**
 * Parses users CSV content and computes the resulting users after import,
 * without touching storage.
 * @param {string} content - Raw CSV file content
 * @param {Array<Object>} existingUsers
 * @param {boolean} [overwrite] - false (default): merge into
 *   existingUsers, skipping a row whose id already exists. true: ignore
 *   existingUsers entirely - the result is exactly the users in the file.
 * @returns {{users: Array<Object>, stats: {imported: number, skipped: number}}}
 * @throws {Error} If the CSV header is missing required columns
 */
export function buildUsersImportResult(content, existingUsers, overwrite = false) {
    const lines = content.split('\n');
    const header = lines[0].trim();

    validateUsersCSVHeader(header);

    const users = overwrite ? [] : [...existingUsers];
    const userIds = new Set(users.map(u => u.id));
    const stats = { imported: 0, skipped: 0 };

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        if (values.length < 3) continue;

        const candidate = {
            id: values[0],
            name: sanitizeInput(values[1]),
            taxpayerId: sanitizeInput(values[2])
        };
        if (!validateUser(candidate)) continue;

        if (userIds.has(candidate.id)) {
            stats.skipped++;
            continue;
        }

        users.push(candidate);
        userIds.add(candidate.id);
        stats.imported++;
    }

    return { users, stats };
}

/**
 * Detects which importer a CSV header belongs to, so the Import modal can
 * route a file without asking the user to pick a type.
 * @param {string} header - CSV header line
 * @returns {'transactions'|'users'|null}
 */
export function detectCSVKind(header) {
    const transactionColumns = ['Date', 'Currency Code', 'Converted GEL'];
    const usersColumns = ['User ID', 'User Name', 'Taxpayer ID'];

    if (transactionColumns.every(col => header.includes(col))) return 'transactions';
    if (usersColumns.every(col => header.includes(col))) return 'users';
    return null;
}
