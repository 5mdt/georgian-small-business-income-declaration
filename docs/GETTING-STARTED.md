# Getting Started

**Option 1: Load Demo Data**

- Click "📊 Load Demo Data" to explore the app with sample transactions
- Demo data includes 3 users and 10 sample transactions
- Note: Demo data can only be loaded if you have no existing transactions

**Option 2: Start Fresh**

1. The app creates a default "user" on first launch
2. Customize this user or create new ones via "User Management"

## Managing Users

1. Click "User Management" → "Toggle User List" to view all users
2. **Add User**: Click "+ Add User" to create new user profiles
3. **Edit User**: Change name or taxpayer ID, then click "💾 Save"
4. **Delete User**: Click "🗑️" to remove a user (also deletes all their transactions)
   - **Note**: The default 'user' account cannot be deleted individually - create other users first
5. **Delete All**: Use "🗑️ Delete All Users" to reset and start fresh

## Recording Transactions

1. **Convert Currency**:
   - Select the transaction date (uses official NBG rate for that date)
   - Choose the currency (GEL for local transactions, or foreign currency)
   - Enter the amount received
   - Select the user
   - Check "Add as Transaction" to save it to the history
2. **Review Transactions**: View all transactions with automatic YTD income calculation
3. **Filter & Sort**: Use filters to narrow down by user, currency, or date range; click column headers to sort
4. **Add Comments**: Click in the comment field to add notes to any transaction
5. **Export for Tax Filing**: Use "⬇ Export CSV" to download data for your accountant or tax records

## Data Management

### Storage & Privacy

All data is stored exclusively in your browser's local storage. No information is transmitted to any server except for fetching exchange rates from the National Bank of Georgia's public API. Clearing your browser data will delete all transactions.

### Import/Export

- **Export CSV**: Download all transactions (or filtered subset) as CSV file
- **Import CSV**: Upload previously exported CSV files to restore data
  - Automatically creates missing users
  - Skips duplicate transactions based on timestamp
  - Prevents creating duplicate users during import

### Deleting Data

- **Delete Transaction**: Individual transactions can be removed from the transaction list
- **Delete User**: Removes user AND all associated transactions (requires confirmation)
  - Protected: The default 'user' account cannot be deleted if it's the only user
- **Delete All Users**: Removes all users and transactions, creates fresh default user
- **Clear All Transactions**: Removes all transactions but keeps users
- **Clear Cache**: Clears cached exchange rates (forces fresh API calls)
