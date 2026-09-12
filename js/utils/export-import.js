// Full backup export/import. Single JSON file, document blobs inlined as
// base64 - no zip dependency, human-inspectable, works fully offline.
import { STORES, DB_VERSION } from '../schema.js';
import { getAll, clearStore, bulkPut, put } from '../db.js';
import { blobToBase64, base64ToBlob, triggerDownload } from './files.js';
import { APP_VERSION } from '../version.js';

const PLAIN_STORES = [
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

export async function exportAllData() {
  const data = {};
  for (const store of PLAIN_STORES) {
    data[store] = await getAll(store);
  }
  const documents = await getAll(STORES.documents);
  data[STORES.documents] = await Promise.all(
    documents.map(async (doc) => {
      const { fileBlob, ...rest } = doc;
      return { ...rest, fileDataBase64: fileBlob ? await blobToBase64(fileBlob) : null };
    })
  );

  const payload = {
    meta: { exportedAt: new Date().toISOString(), appVersion: APP_VERSION, dbVersion: DB_VERSION },
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const filename = `wat-organizer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  triggerDownload(blob, filename);

  await put(STORES.settings, { key: 'lastBackupDate', value: new Date().toISOString() });
  return filename;
}

export async function readBackupFile(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (!payload || !payload.data || !payload.meta) {
    throw new Error('This does not look like a WAT Organizer backup file.');
  }
  return payload;
}

// Full replace, not merge - appropriate for single-user disaster recovery
// (reinstall, lost phone), not multi-device sync.
export async function importAllData(payload) {
  for (const store of PLAIN_STORES) {
    await clearStore(store);
    const records = payload.data[store] || [];
    if (records.length) await bulkPut(store, records);
  }

  await clearStore(STORES.documents);
  const documents = payload.data[STORES.documents] || [];
  const restored = documents.map((doc) => {
    const { fileDataBase64, ...rest } = doc;
    return {
      ...rest,
      fileBlob: fileDataBase64 ? base64ToBlob(fileDataBase64, doc.mimeType) : null,
    };
  });
  if (restored.length) await bulkPut(STORES.documents, restored);
}
