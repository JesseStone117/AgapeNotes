# AGENTS.md

## Prime Directive: User Data Must Not Be Lost

AgapeNotes stores sensitive ministry notes. User data must never be lost, corrupted, silently overwritten, exposed in plaintext, or made unrecoverable by an app update, schema change, migration, refactor, or admin command.

When data safety conflicts with speed, convenience, or code cleanliness, data safety wins.

## Current Data Model

- Google OAuth identity/session metadata lives in normal database tables.
- Actual user app data lives in the encrypted `vaults` table.
- `vaults.ciphertext` contains the encrypted JSON dataset for a user: staff, students, supporters, meetings, notes, prayer requests, personal tasks, growth plans, and related app state.
- `vaults.crypto_json` contains encryption metadata.
- `vaults.revision` is used for optimistic concurrency and collision protection.
- The server must not decrypt user vault contents.
- Admin SQL must not be used to inspect, infer, export, or mutate plaintext user app data.

## Non-Negotiable Rules

- Never drop, truncate, overwrite, or bulk-update user data tables without a verified backup and an explicit restore plan.
- Never change the encrypted vault format without backward-compatible read support and migration tests using old-format fixtures.
- Never replace `vaults.ciphertext` unless the write includes an expected revision check.
- Never bypass revision conflict handling to force a vault update.
- Never store decrypted user app data in localStorage, sessionStorage, logs, server tables, analytics, or error reports.
- Never log passphrases, DEKs, decrypted vault JSON, OAuth tokens, session tokens, admin SQL tokens, or ciphertext contents.
- Never make a schema migration that assumes there is only one user or one vault.
- Never rely on a deployment rollback as the only recovery plan.

## Required Before Risky Changes

A change is risky if it touches storage, encryption, auth/session identity, vault read/write code, import/export, migrations, Render disk config, Turso/SQLite settings, or admin SQL.

Before merging or deploying risky changes:

- Create a live database backup or export.
- Record where the backup is stored, when it was created, and which commit/deploy it corresponds to.
- Verify the backup can be read or restored in a non-production environment.
- Run the automated test suite.
- Add or update tests for migration/backward compatibility.
- Confirm old encrypted vaults can still be opened.
- Confirm failed writes do not advance or corrupt vault revisions.

## Backup Strategy

The desired backup strategy is defense in depth:

- Keep Render persistent disk snapshots as a platform-level safety net.
- Maintain database-native backups outside the running service/disk.
- Keep application-level vault history so individual vault revisions can be recovered without rolling back the entire disk.

Recommended next implementation:

- Add a `vault_snapshots` table.
- Before each successful `vaults` update, copy the current vault row into `vault_snapshots`.
- Store at least: `user_id`, `revision`, `crypto_json`, `ciphertext`, `created_at`, `updated_at`, `snapshotted_at`, and `reason`.
- Make snapshot writes part of the same transaction as the vault update.
- Add an admin-only restore flow that can restore a previous encrypted vault revision by `user_id` and `revision` without decrypting it.
- Add a scheduled off-service backup job for the Turso/SQLite database file or SQL dump.

## Migration Rules

- Prefer additive schema changes.
- Use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN`, and backfills that are safe to rerun.
- Avoid destructive migrations. If unavoidable, do it in phases:
  1. Add the new structure.
  2. Dual-read or dual-write if needed.
  3. Backfill with validation.
  4. Deploy compatibility code.
  5. Only remove old data after backups and a waiting period.
- Migrations must be idempotent.
- Migrations must be tested from representative old database/vault states.
- If a migration touches encrypted vault JSON, it must happen client-side after unlock, preserve unknown fields, and write through normal revision-checked vault saving.

## Import/Export Rules

- Legacy JSON import must only run after the vault is unlocked.
- Legacy import must encrypt data before sending it to the server.
- Import must validate shape, normalize missing arrays/objects, and preserve unknown fields where practical.
- Import must not create local durable app state.
- Exported decrypted JSON is user-controlled and should be treated as sensitive.

## Admin SQL Rules

- Prefer read-only inspection queries.
- Do not run admin SQL that modifies production data unless the user explicitly asks for it and a backup exists.
- Use one statement at a time.
- For production, start with `SELECT` counts/schema checks before any mutation.
- Do not reveal admin tokens in logs, commits, docs, screenshots, or final messages.

## Local Storage Rules

- Durable app data must not be stored in browser storage.
- Browser storage may only hold non-source-of-truth device convenience state, such as a locally encrypted device-unlock envelope.
- A swipe pattern may unlock a locally encrypted vault key on that device, but the vault passphrase remains the recovery/new-device secret.
- Users must be clearly warned that forgetting the passphrase can permanently lock them out of encrypted data.

## Testing Expectations

For storage/encryption changes, test at least:

- New user creates an empty vault.
- Existing user unlocks an existing vault.
- Wrong passphrase fails safely.
- Swipe pattern unlock succeeds only after passphrase setup on that device.
- Revision conflict returns an error and does not overwrite newer data.
- Legacy JSON import writes encrypted remote data.
- Old vault versions migrate without data loss.
- Empty/default data contains no sample people.

## Operational Recovery Goals

The app should support:

- Restoring the entire DB from an off-service backup.
- Restoring one user's encrypted vault to a previous revision.
- Verifying backup integrity without decrypting user vault contents.
- Rolling back code while preserving newer vault data.
- Auditing schema and row counts without exposing plaintext ministry notes.

## If Unsure

Stop and ask before touching production data. A cautious pause is better than a clever recovery story after data loss.
