import { get, put } from '../db.js';
import { STORES } from '../schema.js';
import { APP_VERSION } from '../version.js';
import { exportAllData, readBackupFile, importAllData } from '../utils/export-import.js';
import { emit } from '../state.js';
import { getCurrentUser, signOutUser } from '../auth.js';

async function renderAbout(container) {
  container.innerHTML = `
    <div class="settings-section">
      <h2>About</h2>
      <p>WAT Organizer — version ${APP_VERSION}</p>
      <button type="button" class="button button--ghost" data-toggle-changelog>Show changelog</button>
      <pre class="changelog" data-changelog hidden></pre>
    </div>`;

  const pre = container.querySelector('[data-changelog]');
  container.querySelector('[data-toggle-changelog]').addEventListener('click', async () => {
    if (pre.hidden && !pre.textContent) {
      try {
        const res = await fetch('CHANGELOG.md');
        pre.textContent = await res.text();
      } catch {
        pre.textContent = 'Changelog unavailable offline right now.';
      }
    }
    pre.hidden = !pre.hidden;
  });
}

async function renderPreferences(container) {
  const rateSetting = await get(STORES.settings, 'eurToAudRate');
  container.innerHTML = `
    <div class="settings-section">
      <h2>Preferences</h2>
      <form class="settings-form" data-rate-form>
        <label class="form-field" for="field-rate">
          <span>EUR → AUD exchange rate (manual, for an estimate only)</span>
          <input type="number" id="field-rate" step="0.0001" value="${rateSetting?.value ?? ''}" placeholder="e.g. 1.62" />
        </label>
        <button type="submit" class="button button--primary">Save rate</button>
      </form>
    </div>`;
  container.querySelector('[data-rate-form]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = container.querySelector('#field-rate').value;
    await put(STORES.settings, { key: 'eurToAudRate', value: value ? Number(value) : null });
    emit('data:changed', { store: STORES.settings });
  });
}

async function renderNotifications(container) {
  const supported = typeof Notification !== 'undefined';
  const permission = supported ? Notification.permission : 'unsupported';
  container.innerHTML = `
    <div class="settings-section">
      <h2>Reminders</h2>
      <p>In-app deadlines are always visible on the Dashboard. Browser notifications are best-effort only (especially limited on iPhone) — exporting deadlines to your phone's calendar (Dashboard → Export to calendar) is the reliable option.</p>
      <p>Notification permission: <strong>${permission}</strong></p>
      ${supported && permission === 'default' ? `<button type="button" class="button button--ghost" data-request-notify>Enable browser notifications</button>` : ''}
    </div>`;
  container.querySelector('[data-request-notify]')?.addEventListener('click', async () => {
    await Notification.requestPermission();
    renderNotifications(container);
  });
}

async function renderStorage(container) {
  const supported = navigator.storage && navigator.storage.persist;
  const persisted = supported ? await navigator.storage.persisted() : false;
  container.innerHTML = `
    <div class="settings-section">
      <h2>Storage</h2>
      <p>Persistent storage: <strong>${persisted ? 'granted' : 'not granted'}</strong></p>
      ${!persisted && supported ? `<button type="button" class="button button--ghost" data-request-persist>Request persistent storage</button>` : ''}
      <p class="form-hint">This reduces (but does not eliminate) the risk of the browser clearing your data. Regular backups below are the reliable safeguard.</p>
    </div>`;
  container.querySelector('[data-request-persist]')?.addEventListener('click', async () => {
    await navigator.storage.persist();
    renderStorage(container);
  });
}

async function renderBackup(container) {
  const lastBackup = await get(STORES.settings, 'lastBackupDate');
  container.innerHTML = `
    <div class="settings-section">
      <h2>Backup</h2>
      <p>${lastBackup?.value ? `Last backup: ${new Date(lastBackup.value).toLocaleString()}` : 'No backup made yet.'}</p>
      <button type="button" class="button button--primary" data-export>Export all data</button>
      <label class="button button--ghost" style="display:inline-block;cursor:pointer;">
        Import backup
        <input type="file" accept="application/json" data-import hidden />
      </label>
      <p class="form-hint">Importing fully replaces all current data on this device.</p>
    </div>`;

  container.querySelector('[data-export]').addEventListener('click', async () => {
    await exportAllData();
    renderBackup(container);
  });

  container.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('This will replace ALL current data on this device with the contents of the backup file. Continue?')) {
      e.target.value = '';
      return;
    }
    try {
      const payload = await readBackupFile(file);
      await importAllData(payload);
      emit('data:changed', {});
      alert('Backup imported successfully.');
    } catch (err) {
      alert(`Could not import this file: ${err.message}`);
    }
    e.target.value = '';
  });
}

function renderAccount(container) {
  const user = getCurrentUser();
  container.innerHTML = `
    <div class="settings-section">
      <h2>Account</h2>
      <p>Signed in as <strong>${user?.email ?? 'unknown'}</strong></p>
      <button type="button" class="button button--ghost" data-sign-out>Sign out</button>
    </div>`;
  container.querySelector('[data-sign-out]').addEventListener('click', async () => {
    if (!confirm('Sign out of WAT Organizer on this device?')) return;
    await signOutUser();
  });
}

async function render(container) {
  container.innerHTML = `
    <h1>Settings</h1>
    <div data-account></div>
    <div data-about></div>
    <div data-preferences></div>
    <div data-notifications></div>
    <div data-storage></div>
    <div data-backup></div>`;

  renderAccount(container.querySelector('[data-account]'));
  await Promise.all([
    renderAbout(container.querySelector('[data-about]')),
    renderPreferences(container.querySelector('[data-preferences]')),
    renderNotifications(container.querySelector('[data-notifications]')),
    renderStorage(container.querySelector('[data-storage]')),
    renderBackup(container.querySelector('[data-backup]')),
  ]);
}

export default { render };
