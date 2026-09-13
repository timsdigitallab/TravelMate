// Data access layer. Every view/util goes through the functions exported
// here - that seam is what let this file's internals move from IndexedDB
// to Firestore without touching a single view module.
//
// STAGE 2 NOTE: `documents` is temporarily still backed by the old raw
// IndexedDB store (see the `legacy*` helpers below) - it moves to Firebase
// Storage in the next release. Every other store is backed by Firestore,
// scoped per-user at users/{uid}/{storeName}/{id}, with a single onSnapshot
// listener per store feeding an in-memory cache (this is what gives cache-
// first reads, offline read/write, and cross-device live updates all from
// one mechanism, via Firestore's own persistentLocalCache).
import { DB_NAME, DB_VERSION, MIGRATIONS, STORES } from './schema.js';
import { emit } from './state.js';
import { getFirebaseApp, getCurrentUser } from './auth.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const ID_FIELD_OVERRIDES = { [STORES.settings]: 'key' };
const idFieldFor = (storeName) => ID_FIELD_OVERRIDES[storeName] || 'id';

// --- Legacy IndexedDB path (documents store only, for now) ---------------

let legacyDbPromise = null;

function openLegacyDb() {
  if (legacyDbPromise) return legacyDbPromise;
  legacyDbPromise = new Promise((resolve, reject) => {
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
  return legacyDbPromise;
}

function legacyTx(db, storeName, mode) {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function legacyWrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const legacy = {
  async getAll(storeName) {
    const db = await openLegacyDb();
    return legacyWrap(legacyTx(db, storeName, 'readonly').getAll());
  },
  async getByIndex(storeName, indexName, value) {
    const db = await openLegacyDb();
    return legacyWrap(legacyTx(db, storeName, 'readonly').index(indexName).getAll(value));
  },
  async get(storeName, id) {
    const db = await openLegacyDb();
    return legacyWrap(legacyTx(db, storeName, 'readonly').get(id));
  },
  async put(storeName, record) {
    const db = await openLegacyDb();
    await legacyWrap(legacyTx(db, storeName, 'readwrite').put(record));
    return record;
  },
  async bulkPut(storeName, records) {
    const db = await openLegacyDb();
    const store = legacyTx(db, storeName, 'readwrite');
    await Promise.all(records.map((r) => legacyWrap(store.put(r))));
  },
  async remove(storeName, id) {
    const db = await openLegacyDb();
    await legacyWrap(legacyTx(db, storeName, 'readwrite').delete(id));
  },
  async clearStore(storeName) {
    const db = await openLegacyDb();
    await legacyWrap(legacyTx(db, storeName, 'readwrite').clear());
  },
};

const LEGACY_STORES = new Set([STORES.documents]);

// Used only by js/utils/legacy-migration.js to read the pre-Firebase local
// database for the one-time import - NOT part of the normal store-agnostic
// API above, since every other store no longer lives in IndexedDB at all.
export const readLegacyStore = legacy.getAll;

// --- Firestore path (everything else) -------------------------------------

let firestoreInstance = null;
const storeCache = new Map(); // storeName -> Map(id -> record)
const storeReady = new Map(); // storeName -> Promise (resolves after first snapshot)
const unsubscribers = new Map();

export function openDB() {
  if (!firestoreInstance) {
    firestoreInstance = initializeFirestore(getFirebaseApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
  return Promise.resolve(firestoreInstance);
}

function uid() {
  const user = getCurrentUser();
  if (!user) throw new Error('db.js: called before authentication');
  return user.uid;
}

function colRef(storeName) {
  return collection(firestoreInstance, 'users', uid(), storeName);
}

function docRef(storeName, id) {
  return doc(firestoreInstance, 'users', uid(), storeName, id);
}

// Writes (setDoc/batch.commit/deleteDoc) can hit the same kind of transient
// failure right after a fresh sign-in that the onSnapshot listener below
// already retries for reads - and unlike the listener, a write's success
// doesn't depend on whether that listener happened to be ready yet, so it
// needs its own independent retry rather than assuming ensureSynced()
// resolving means writes will succeed too.
async function withWriteRetry(fn, attempts = 4, delayMs = 400) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}

// Firestore can surface a one-off "permission-denied" for the very first
// listen request right after sign-in / session restore, before the auth
// token is fully attached internally - it does NOT auto-retry that error
// class itself (unlike e.g. "unavailable"). A few quick retries clear it up
// in practice; only give up and resolve `ready` anyway (so callers don't
// hang forever) once retries are exhausted.
const MAX_SNAPSHOT_RETRIES = 5;
const RETRY_DELAY_MS = 400;

function ensureSynced(storeName) {
  if (storeReady.has(storeName)) return storeReady.get(storeName);
  const cache = new Map();
  storeCache.set(storeName, cache);
  const idField = idFieldFor(storeName);
  let resolveReady;
  let first = true;
  let attempt = 0;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  function attach() {
    const unsub = onSnapshot(
      colRef(storeName),
      { includeMetadataChanges: false },
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'removed') cache.delete(change.doc.id);
          else cache.set(change.doc.id, { ...change.doc.data(), [idField]: change.doc.id });
        });
        if (first) {
          first = false;
          resolveReady();
        } else {
          emit('data:changed', { store: storeName });
        }
      },
      (err) => {
        attempt += 1;
        if (attempt <= MAX_SNAPSHOT_RETRIES) {
          setTimeout(attach, RETRY_DELAY_MS * attempt);
        } else {
          console.error(`[db] onSnapshot(${storeName}) gave up after ${attempt} attempts`, err);
          if (first) {
            first = false;
            resolveReady();
          }
        }
      }
    );
    unsubscribers.set(storeName, unsub);
  }
  attach();
  storeReady.set(storeName, ready);
  return ready;
}

export async function getAll(storeName) {
  if (LEGACY_STORES.has(storeName)) return legacy.getAll(storeName);
  await openDB();
  await ensureSynced(storeName);
  return Array.from(storeCache.get(storeName).values());
}

export async function getByIndex(storeName, indexName, value) {
  if (LEGACY_STORES.has(storeName)) return legacy.getByIndex(storeName, indexName, value);
  await openDB();
  await ensureSynced(storeName);
  return Array.from(storeCache.get(storeName).values()).filter((r) => r[indexName] === value);
}

export async function get(storeName, id) {
  if (LEGACY_STORES.has(storeName)) return legacy.get(storeName, id);
  await openDB();
  await ensureSynced(storeName);
  return storeCache.get(storeName).get(id);
}

export async function put(storeName, record) {
  if (LEGACY_STORES.has(storeName)) return legacy.put(storeName, record);
  await openDB();
  await ensureSynced(storeName);
  const idField = idFieldFor(storeName);
  const id = record[idField] || doc(colRef(storeName)).id;
  const toWrite = { ...record, [idField]: id };
  await withWriteRetry(() => setDoc(docRef(storeName, id), toWrite));
  return toWrite;
}

export async function bulkPut(storeName, records) {
  if (LEGACY_STORES.has(storeName)) return legacy.bulkPut(storeName, records);
  await openDB();
  await ensureSynced(storeName);
  const idField = idFieldFor(storeName);
  for (let i = 0; i < records.length; i += 500) {
    const batch = writeBatch(firestoreInstance);
    for (const record of records.slice(i, i + 500)) {
      const id = record[idField] || doc(colRef(storeName)).id;
      batch.set(docRef(storeName, id), { ...record, [idField]: id });
    }
    await withWriteRetry(() => batch.commit());
  }
}

export async function remove(storeName, id) {
  if (LEGACY_STORES.has(storeName)) return legacy.remove(storeName, id);
  await openDB();
  await ensureSynced(storeName);
  await withWriteRetry(() => deleteDoc(docRef(storeName, id)));
}

export async function clearStore(storeName) {
  if (LEGACY_STORES.has(storeName)) return legacy.clearStore(storeName);
  await openDB();
  await ensureSynced(storeName);
  const ids = Array.from(storeCache.get(storeName).keys());
  for (let i = 0; i < ids.length; i += 500) {
    const batch = writeBatch(firestoreInstance);
    ids.slice(i, i + 500).forEach((id) => batch.delete(docRef(storeName, id)));
    await withWriteRetry(() => batch.commit());
  }
}

// Call on sign-out so a second account signing in on the same device never
// sees the previous account's in-memory cache or live listeners.
export function resetDb() {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers.clear();
  storeCache.clear();
  storeReady.clear();
  firestoreInstance = null;
}
