import { openDB } from './db.js';
import { initAuth, authReady, onAuthChange } from './auth.js';
import { showLoginScreen } from './views/login.js';
import { registerRoute, initRouter } from './router.js';
import dashboard from './views/dashboard.js';
import trip from './views/trip.js';
import budget from './views/budget.js';
import visa from './views/visa.js';
import jobs from './views/jobs.js';
import packing from './views/packing.js';
import contacts from './views/contacts.js';
import documents from './views/documents.js';
import settings from './views/settings.js';

function showUpdateBanner(onReload) {
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.innerHTML = `<span>An update is available.</span><button type="button">Reload</button>`;
  banner.querySelector('button').addEventListener('click', onReload);
  document.body.appendChild(banner);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./service-worker.js').then((registration) => {
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(() => installing.postMessage('skipWaiting'));
        }
      });
    });
  });
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}

function renderOfflineIndicator() {
  const el = document.getElementById('offline-indicator');
  const update = () => {
    el.hidden = navigator.onLine;
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

async function main() {
  initAuth();
  const user = await authReady;
  if (!user) await showLoginScreen();

  await openDB();

  registerRoute('/dashboard', dashboard, 'Dashboard');
  registerRoute('/trip', trip, 'Trip');
  registerRoute('/budget', budget, 'Budget');
  registerRoute('/visa', visa, 'Visa');
  registerRoute('/jobs', jobs, 'Jobs');
  registerRoute('/packing', packing, 'Packing');
  registerRoute('/contacts', contacts, 'Contacts');
  registerRoute('/documents', documents, 'Documents');
  registerRoute('/settings', settings, 'Settings');

  initRouter({ viewEl: document.getElementById('view'), navEl: document.getElementById('nav') });

  registerServiceWorker();
  renderOfflineIndicator();

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }

  let signedIn = true;
  onAuthChange((u) => {
    if (!u && signedIn) {
      signedIn = false;
      location.reload();
    }
  });
}

main();
