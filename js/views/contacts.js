import { createCrudView } from '../components/crud-view.js';
import { renderForm, collectFormData } from '../components/form-fields.js';
import { get, put } from '../db.js';
import { STORES } from '../schema.js';

const contactFields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'relation', label: 'Relation', type: 'text', placeholder: 'e.g. Friend, Family, Employer' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'isEmergency', label: 'Emergency contact', type: 'checkbox' },
];

const contactsCrud = createCrudView({
  store: STORES.contacts,
  title: 'Contacts',
  addLabel: 'Add contact',
  emptyMessage: 'No contacts saved yet.',
  fields: contactFields,
  defaultValues: () => ({ name: '', relation: '', phone: '', email: '', notes: '', isEmergency: false }),
  sort: (a, b) => a.name.localeCompare(b.name),
  toListItem: (r) => ({
    title: r.name,
    subtitle: [r.relation, r.phone].filter(Boolean).join(' · '),
    badge: r.isEmergency ? 'Emergency' : null,
    badgeVariant: 'warning',
  }),
});

const emergencyFields = [
  { key: 'embassyName', label: 'Embassy / Consulate', type: 'text' },
  { key: 'embassyPhone', label: 'Embassy phone', type: 'tel' },
  { key: 'embassyAddress', label: 'Embassy address', type: 'textarea', rows: 2 },
  { key: 'insuranceProvider', label: 'Travel insurance provider', type: 'text' },
  { key: 'insurancePolicyNumber', label: 'Policy number', type: 'text' },
  { key: 'insuranceHotline', label: 'Insurance emergency hotline', type: 'tel' },
  { key: 'bloodType', label: 'Blood type', type: 'text' },
  { key: 'allergies', label: 'Allergies', type: 'textarea', rows: 2 },
  { key: 'medicalConditions', label: 'Medical conditions', type: 'textarea', rows: 2 },
  { key: 'medications', label: 'Medications', type: 'textarea', rows: 2 },
  { key: 'medicalNotes', label: 'Other medical notes', type: 'textarea', rows: 2 },
];

async function renderEmergencyInfo(container) {
  const record = (await get(STORES.emergencyInfo, 'singleton')) || { id: 'singleton' };
  container.innerHTML = `
    <form class="settings-form" data-emergency-form>
      ${renderForm(emergencyFields, record)}
      <button type="submit" class="button button--primary">Save emergency info</button>
      <p class="form-hint" data-saved-hint hidden>Saved.</p>
    </form>`;

  const form = container.querySelector('[data-emergency-form]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = collectFormData(form, emergencyFields);
    await put(STORES.emergencyInfo, { ...record, ...data, id: 'singleton', updatedAt: new Date().toISOString() });
    const hint = container.querySelector('[data-saved-hint]');
    hint.hidden = false;
    setTimeout(() => (hint.hidden = true), 2000);
  });
}

async function render(container) {
  container.innerHTML = `
    <div class="tabs">
      <button type="button" class="tab-button is-active" data-tab="contacts">Contacts</button>
      <button type="button" class="tab-button" data-tab="emergency">Emergency Info</button>
    </div>
    <div data-tab-panel="contacts"></div>
    <div data-tab-panel="emergency" hidden></div>`;

  const contactsPanel = container.querySelector('[data-tab-panel="contacts"]');
  const emergencyPanel = container.querySelector('[data-tab-panel="emergency"]');
  await contactsCrud.render(contactsPanel);
  await renderEmergencyInfo(emergencyPanel);

  container.querySelectorAll('.tab-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const target = btn.dataset.tab;
      contactsPanel.hidden = target !== 'contacts';
      emergencyPanel.hidden = target !== 'emergency';
    });
  });
}

export default { render };
