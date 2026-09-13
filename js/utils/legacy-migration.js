// One-time import of whatever was already sitting in the pre-Firebase local
// IndexedDB (from using the app before cross-device sync existed) into the
// signed-in user's Firestore data. Runs automatically, no prompt: the flag
// lives in localStorage (per browser, not per account), so a second device
// - which never had the old local database - naturally has nothing to
// migrate and just marks itself done on first run. Safe to re-run (upserts
// by id), but the flag prevents that from happening in practice.
import { STORES } from '../schema.js';
import { readLegacyStore, bulkPut } from '../db.js';

const MIGRATION_FLAG_KEY = 'watLegacyMigrationDone';

// STORES.documents is intentionally excluded - it stays on the local
// IndexedDB path until documents move to Firebase Storage in a later
// release, so there's nothing to migrate for it yet.
const STORES_TO_MIGRATE = [
  STORES.tripLegs,
  STORES.transactions,
  STORES.visaItems,
  STORES.jobApplications,
  STORES.workLogEntries,
  STORES.packingItems,
  STORES.contacts,
  STORES.emergencyInfo,
  STORES.settings,
];

export async function runLegacyMigrationIfNeeded() {
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') return;

  // db.js's bulkPut already retries transient write failures internally; if
  // it still throws (retries exhausted), leave the flag unset so the whole
  // migration is safely retried in full on the next app launch (bulkPut is
  // an upsert by id, so re-attempting is never destructive).
  let migratedCount = 0;
  try {
    for (const store of STORES_TO_MIGRATE) {
      const rows = await readLegacyStore(store);
      if (rows.length) {
        await bulkPut(store, rows);
        migratedCount += rows.length;
      }
    }
  } catch (err) {
    console.error('[legacy-migration] Failed - will retry on next launch.', err);
    return;
  }

  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  if (migratedCount) {
    console.info(`[legacy-migration] Migrated ${migratedCount} existing local record(s) to your account.`);
  }
}
