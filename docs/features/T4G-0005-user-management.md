# T4G-0005. User management

**Tags:** #users

## Description

Tracks multiple individuals or business entities, each with a name and
taxpayer ID, so transactions can be attributed per user.

## Implementation

`src/users.js`:
- `loadUsers()` reads `localStorage` key `users` ([[T4G-0013]]), seeding a
  single default user (`createDefaultUser()`, `id: 'user'`) if none exist or
  none pass `validateUser`.
- `updateUserInStorage(userData)` validates then upserts by `id`.
- `getUserById(userId)` looks up a user.

`script.js`:
- `addNewUser()` prompts for name/taxpayer ID and calls `saveUser` →
  `updateUserInStorage`.
- `saveUserFromInputs(userId)` reads the inline-edited name/taxpayer ID
  fields and saves.
- `renderUserList()` renders the user table with inline edit/delete
  controls; `populateUserSelectors()` keeps the transaction-form and
  filter user `<select>` elements in sync.
- User Management section is collapsible via `toggleUserManagement()`.

## Testing

### Human Testing

- Click "User Management" → "Toggle User List" — the user table appears.
- "+ Add User" — prompts for name and taxpayer ID, adds a row.
- Edit a name/taxpayer ID inline, click "💾 Save" — the change persists and
  the user selectors update.

### Unit Testing

`tests/unit/users.test.js` (`loadUsers`, `updateUserInStorage`,
`getUserById`): default-user seeding, stored/invalid users, add vs. update.

### Integration Testing

`tests/integration/app.test.js` (`bootstrap`, `user management`): seeds and
renders the default user; creates a new user via `addNewUser` and lists it.

## Status

Implemented.
