# Changelog

All notable changes to this app are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/): PATCH = bugfix, MINOR = new feature (data stays intact), MAJOR = would only ever be a non-migratable breaking change (should not normally happen).

## [0.6.1] - 2026-09-13

### Changed
- New app icon: a vintage travel-patch badge with a backpack, in the app's own Sandstone Coast palette (the same header gradient, ring text reading "TRAVELMATE" / "AUSTRALIA"). Replaces the earlier placeholder sun-over-horizon icon.

## [0.6.0] - 2026-09-13

### Added
- Trip is now split into two tabs: **Places**, a library of researched locations you can build up at any time (not tied to a date), and **Itinerary**, the dated stop-by-stop route the "Trip" screen used to be.
- Each place can hold points of interest (sights, activities, food & drink, other), grouped and collapsible by status (Idea / Planned / Done), same pattern as the Packing List's groups.
- Every place and point of interest has a "Search on Google Maps" button next to its Maps-link field, opening a Google Maps search for the name you've typed in a new tab - copy the share link back in and its coordinates are pulled out automatically (regex-parsed client-side, no Maps API involved).
- An Itinerary stop can optionally be linked to a Place.

### Notes
- New Firestore collections `places` and `pointsOfInterest`, synced and backed up the same way as every other module.

## [0.5.1] - 2026-09-13

### Fixed
- Packing List: could only ever save one item per List. The hidden "new list name" input stayed `required` even while hidden (i.e. whenever an existing list was picked instead of "+ Add new..."), which made the browser silently refuse to submit the form. `required` is now only ever set on the field that's actually visible.

## [0.5.0] - 2026-09-13

### Changed
- Packing List: `List` and `Category` are now dropdowns populated from whatever values you've already used, with a "+ Add new..." option to type a new one on the spot - no separate list of lists to manage, values simply stop appearing once nothing uses them anymore.
- Packing List overview is now grouped by List, then Category, both collapsible (native disclosure widgets) - so you can e.g. expand just "Daytrip → Clothing" and leave everything else collapsed. Expanded/collapsed state survives checking items off, adding/editing/deleting, and live updates from another device.

## [0.4.0] - 2026-09-13

### Changed
- Renamed the app from "WAT Organizer" to **TravelMate**.
- New visual design ("Sandstone Coast"): a green-to-orange-to-brown gradient header and a matching deep-green bottom navigation bar stay fixed in both light and dark mode, while the content area (cards, lists) now uses a calm neutral gray/cream so the colorful header and nav stand out. Self-hosted Spectral (headings) and Mulish (body) fonts, downloaded locally so they're available offline from the first load rather than depending on the Google Fonts CDN.
- Bottom navigation now shows an icon above each label (`js/utils/icons.js`), matching the new design.
- App icons regenerated in the new color scheme.

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
