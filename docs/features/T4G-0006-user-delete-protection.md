# T4G-0006. User delete protection

**Tags:** #users #transactions

## Description

Prevents deleting the only account, and confirms before deleting a user
that still has transactions, since deletion cascades to their data.

## Implementation

`src/users.js` `canDeleteUser(userId, users, transactions)`:
- Refuses if it's the last remaining user (`users.length <= 1`) — the
  message names "the default user" specifically when `userId === 'user'`,
  since that's the account a fresh install always seeds with, but the
  guard itself is about being the *only* account, not that specific id.
  Once a second user exists (including after a backup import/merge), the
  default `user` account is deletable like any other.
- If the user has transactions, calls `confirm()`; refusal is reported as
  `{ allowed: false, reason: 'User cancelled operation.' }` — `script.js`
  `deleteUser()` treats a reason containing `'cancelled'` as silent (no
  extra `alert()`).

`script.js` `deleteUser(userId)` calls `canDeleteUser`, then
`removeUserFromStorage` (`src/users.js`) and `removeUserTransactions`
(`src/transactions.js`, [[T4G-0007]]) together — both must succeed for the
UI to refresh.

`deleteAllUsers()` bypasses these per-user checks entirely (single bulk
confirmation instead) — see [[T4G-0014]].

## Testing

### Human Testing

- Try to delete the default `user` account while it's the only user — a
  message explains it can't be deleted.
- Create a second user, then delete the default `user` account — it's
  deletable once it's no longer the only account.
- Create a second user, delete a user with transactions — a confirmation
  prompt lists the transaction count; cancelling leaves everything intact.

### Unit Testing

`tests/unit/users.test.js` (`canDeleteUser`): refuses default user while
it's the only user, refuses last user, allows deleting the default user
once a second user exists, allows deletion with no transactions, prompts
and honors cancel, allows cascading delete on confirmation.
`tests/unit/transactions.test.js` (`removeUserTransactions`): cascading
delete removes only the target user's transactions.

### Integration Testing

`tests/integration/app.test.js` (`user management`): refuses to delete the
default user with only one account; cascades transaction deletion when a
user with transactions is removed.

## Status

Implemented.
