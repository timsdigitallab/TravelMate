// Thin promise wrapper around IndexedDB. This is the only module that
// touches indexedDB directly - every view/util goes through here.
import { DB_NAME, DB_VERSION, MIGRATIONS } from './schema.js';

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;
      for (const step of MIGRATIONS) {
        if (oldVersion < step.version) step.migrate(db, req.transaction);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database upgrade blocked by another open tab.'));
  });
  return dbPromise;
}

function tx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(storeName) {
  const db = await openDB();
  return wrap(tx(db, storeName, 'readonly').getAll());
}

export async function getByIndex(storeName, indexName, value) {
  const db = await openDB();
  const index = tx(db, storeName, 'readonly').index(indexName);
  return wrap(index.getAll(value));
}

export async function get(storeName, id) {
  const db = await openDB();
  return wrap(tx(db, storeName, 'readonly').get(id));
}

export async function put(storeName, record) {
  const db = await openDB();
  await wrap(tx(db, storeName, 'readwrite').put(record));
  return record;
}

export async function bulkPut(storeName, records) {
  const db = await openDB();
  const store = tx(db, storeName, 'readwrite');
  await Promise.all(records.map((r) => wrap(store.put(r))));
}

export async function remove(storeName, id) {
  const db = await openDB();
  await wrap(tx(db, storeName, 'readwrite').delete(id));
}

export async function clearStore(storeName) {
  const db = await openDB();
  await wrap(tx(db, storeName, 'readwrite').clear());
}
