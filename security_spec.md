# Security Specification - RBAC & Data Integrity

## Data Invariants
1. **User Identity Invariant**: A user's `role` and `permissions` can ONLY be modified by a `super_admin`.
2. **Relational Invariant**: A `Voter` must reference a valid `boothId`.
3. **Hierarchy Invariant**: A `Booth` must belong to a valid `constituencyId`, which in turn belongs to a `districtId`, which belongs to a `stateId`.
4. **Action Invariant**: Operations (Create, Update, Delete) are only permitted if the user has translated rights in their `permissions` object for the relevant module:
   - `demographics` for States, Districts, Constituencies, Booths.
   - `voters` for Voter records.
   - `users` for User Management.

## The "Dirty Dozen" Payloads (Vulnerability Test Cases)

1. **Self-Promotion**: Authenticated user attempts to update their own `role` to 'super_admin'.
2. **Permission Escalation**: Authenticated user attempts to grant themselves 'vcud' permissions for 'users' module.
3. **Shadow Field Injection**: User adds an `isVerified: true` field to a `Voter` document during creation.
4. **Orphaned Voter**: Creating a `Voter` with a `boothId` that does not exist.
5. **ID Poisoning**: Creating a booth with a 1MB string as the document ID.
6. **Cross-Tenant Write**: User A attempts to delete a `Voter` that belongs to a booth they don't have update rights for (indirectly via permissions).
7. **Temporal Spoof**: User provides a client-side `createdAt` timestamp from 2010.
8. **PII Leak**: A `guest` user without `v` permission for `users` module attempts to list all user emails.
9. **Relational Short-circuit**: Updating a `District` and changing its `stateId` to a state that doesn't exist.
10. **Admin Lockdown**: Attempting to delete the `OWNER_EMAIL` user profile (the root super_admin).
11. **Type Poisoning**: Sending a `population` field as a string instead of a number.
12. **Blanket Read Scam**: Attaching a listener to `/users` without specifically querying for self, hoping rules allow blanket reads.

## Penetration Test Plan (Draft)
The `firestore.rules` will be evaluated against:
- Identity Integrity helper (`isSuperAdmin()`)
- Granular Permission helper (`hasRight(module, right)`)
- Path Hardening (`isValidId()`)
- Size constraints on all strings.
- Immutability checks for critical fields (`uid`, `email` in User).
