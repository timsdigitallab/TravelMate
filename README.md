# WAT Organizer

A personal, offline-first organizer for a Work and Travel trip to Australia: route planning, budget, visa/official matters, job search & 88-day work tracking, packing list, contacts/emergency info, and document storage.

Plain HTML/CSS/JS, no build step. Installable as a Progressive Web App so it works fully offline once loaded. Sign-in (Firebase Authentication) gates the app so your data can sync between your own devices - see "Firebase setup" below.

## Firebase setup

The app uses Firebase for the login gate and (from a later release onward) cross-device data sync. One-time setup:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. Build → Authentication → Sign-in method → enable **Email/Password**.
3. Build → Firestore Database → Create database (production mode).
4. Project settings → General → Your apps → add a Web app → copy the resulting `firebaseConfig` object into [`js/firebase-config.js`](js/firebase-config.js), replacing the `REPLACE_ME` placeholders.
5. Create your one account: Authentication → Users → Add user (email + password). **There is deliberately no public sign-up screen in the app** - anyone finding the public GitHub Pages URL must not be able to create their own account and consume this Firebase project's quota.
6. (Needed once documents move to Firebase Storage in a later release) Project settings → Usage and billing → upgrade to the Blaze plan (requires a card on file; normal personal use stays within the free quota) → Build → Storage → set up.

`js/firebase-config.js` is safe to commit publicly - access is controlled by Firestore/Storage security rules (checked against the signed-in user's uid), not by hiding this config.

## Running it locally

Any static file server works, since the app uses ES modules (`import`), which browsers refuse to load from a plain `file://` URL. From this folder:

```
npx serve .
```

or, with Python:

```
python -m http.server 8080
```

Then open the printed `http://localhost:...` URL.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repository (public, for free Pages hosting).
2. Repo Settings → Pages → Source = "Deploy from a branch", branch `main`, folder `/`.
3. Open `https://<your-username>.github.io/<repo>/` and confirm it loads, installs ("Add to Home Screen"), and still works after switching to airplane mode.

## Releasing an update later

This app is designed so you can keep developing it for months without ever losing data already on your phone:

1. Make your changes.
2. If you added/changed the **data shape** (a new field, a new store): bump `DB_VERSION` in [`js/schema.js`](js/schema.js) and add a new migration step there that **adds to** existing records rather than deleting them.
3. If you added/changed/removed any **file** (`.js`/`.css`/`.html`): update `PRECACHE_URLS` in [`service-worker.js`](service-worker.js) and bump `CACHE_NAME` (e.g. `-v2`) - otherwise offline users may keep serving stale/missing files.
4. Bump `APP_VERSION` in [`js/version.js`](js/version.js) and add an entry to [`CHANGELOG.md`](CHANGELOG.md).
5. Commit, tag the release (`git tag v0.2.0`), push (`git push --tags`) and optionally create a GitHub Release from that tag - this is your visible version history.
6. **Before considering the release done**, test the update-without-data-loss path: open the currently-installed app, add a test entry, deploy the new version, reopen the app (or tap the in-app "Reload" update banner), and confirm the test entry (and everything else) is still there.

The version and changelog are also visible inside the app under Settings → About.
