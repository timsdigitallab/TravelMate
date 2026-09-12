// IndexedDB schema for watOrganizerDB.
//
// HOW TO CHANGE THE SCHEMA IN A FUTURE RELEASE:
// 1. Bump DB_VERSION by 1.
// 2. Add a new `if (oldVersion < N)` block inside MIGRATIONS below that
//    creates any new store/index, or migrates existing records (via a
//    cursor) to a new shape. NEVER delete an existing store or drop
//    records that might hold user data - only add/extend.
// 3. Document what changed in CHANGELOG.md.
// See js/db.js for how onupgradeneeded walks through these steps.

export const DB_NAME = 'watOrganizerDB';
export const DB_VERSION = 1;

export const STORES = {
  documents: 'documents',
  tripLegs: 'tripLegs',
  transactions: 'transactions',
  visaItems: 'visaItems',
  jobApplications: 'jobApplications',
  workLogEntries: 'workLogEntries',
  packingItems: 'packingItems',
  contacts: 'contacts',
  emergencyInfo: 'emergencyInfo',
  settings: 'settings',
};

// Each migration step receives the open IDBDatabase and the versionchange
// transaction, and must be idempotent-safe to run once per upgrade path.
export const MIGRATIONS = [
  {
    version: 1,
    migrate(db) {
      const documents = db.createObjectStore(STORES.documents, { keyPath: 'id' });
      documents.createIndex('relatedId', 'relatedId');
      documents.createIndex('category', 'category');

      const tripLegs = db.createObjectStore(STORES.tripLegs, { keyPath: 'id' });
      tripLegs.createIndex('plannedStartDate', 'plannedStartDate');
      tripLegs.createIndex('status', 'status');

      const transactions = db.createObjectStore(STORES.transactions, { keyPath: 'id' });
      transactions.createIndex('date', 'date');
      transactions.createIndex('currency', 'currency');
      transactions.createIndex('category', 'category');

      const visaItems = db.createObjectStore(STORES.visaItems, { keyPath: 'id' });
      visaItems.createIndex('deadlineDate', 'deadlineDate');
      visaItems.createIndex('status', 'status');

      const jobApplications = db.createObjectStore(STORES.jobApplications, { keyPath: 'id' });
      jobApplications.createIndex('followUpDate', 'followUpDate');
      jobApplications.createIndex('status', 'status');

      const workLogEntries = db.createObjectStore(STORES.workLogEntries, { keyPath: 'id' });
      workLogEntries.createIndex('date', 'date');
      workLogEntries.createIndex('isEligibleRegionalWork', 'isEligibleRegionalWork');

      db.createObjectStore(STORES.packingItems, { keyPath: 'id' });

      const contacts = db.createObjectStore(STORES.contacts, { keyPath: 'id' });
      contacts.createIndex('isEmergency', 'isEmergency');

      db.createObjectStore(STORES.emergencyInfo, { keyPath: 'id' });
      db.createObjectStore(STORES.settings, { keyPath: 'key' });
    },
  },
];
