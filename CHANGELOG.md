# Changelog

All notable changes to this app are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/): PATCH = bugfix, MINOR = new feature (data stays intact), MAJOR = would only ever be a non-migratable breaking change (should not normally happen).

## [0.3.0] - 2026-09-13

### Added
- Cross-device real-time sync via Firestore for every module except Documents (Trip & Route, Budget, Visa, Jobs, Packing List, Contacts, Emergency Info, Settings). Changes on one signed-in device now appear automatically on another.
- One-time automatic migration of any data already sitting in the old local-only database into your Firestore account on first login after this update.

### Notes
- Documents still use local IndexedDB storage for now (not yet synced across devices) - they move to Firebase Storage in a following release.
- Reads and writes automatically retry a few times if they hit a transient failure right after signing in (a known Firestore behavior before the auth token is fully attached), rather than failing outright.
- `DB_VERSION`/`MIGRATIONS` in `js/schema.js` are now frozen except for the one-time legacy-data read described above.

## [0.2.0] - 2026-09-12

### Added
- Firebase Authentication (email/password) login gate. There is no public sign-up in the app - the one account is created via the Firebase Console (see README).
- Sign out button in Settings.

### Notes
- Data still lives in the local IndexedDB at this stage - only the login gate was added. Cross-device Firestore sync lands in a follow-up release.

## [0.1.0] - 2026-09-12

### Added
- Initial release: installable offline-first PWA.
- Modules: Dashboard, Trip & Route, Budget & Expenses, Visa & Official Matters, Job Applications & Work Log (with 88-day regional work counter), Packing List, Contacts & Emergency Info, Documents.
- Document storage with photo downscaling, linkable to records in other modules.
- Deadline dashboard with .ics calendar export for reliable reminders.
- Manual JSON export/import for backups.
- Settings: exchange-rate preference, notification permission, persistent storage request, backup.
