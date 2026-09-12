import { createCrudView } from '../components/crud-view.js';
import { getAll } from '../db.js';
import { STORES } from '../schema.js';
import { formatDisplay, countDistinctEligibleDays } from '../utils/date.js';
import { renderDocumentSection, wireDocumentSection } from '../components/document-picker.js';
import { on } from '../state.js';

const applicationFields = [
  { key: 'company', label: 'Company', type: 'text', required: true },
  { key: 'roleTitle', label: 'Role', type: 'text' },
  { key: 'contactName', label: 'Contact name', type: 'text' },
  { key: 'contactPhone', label: 'Contact phone', type: 'tel' },
  { key: 'contactEmail', label: 'Contact email', type: 'email' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: ['applied', 'interview', 'offered', 'rejected', 'accepted', 'withdrawn'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
  },
  { key: 'appliedDate', label: 'Applied on', type: 'date' },
  { key: 'followUpDate', label: 'Follow up on', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const applicationBadgeVariants = { applied: 'neutral', interview: 'warning', offered: 'success', accepted: 'success', rejected: 'muted', withdrawn: 'muted' };

const applicationsCrud = createCrudView({
  store: STORES.jobApplications,
  title: 'Job Applications',
  addLabel: 'Add application',
  emptyMessage: 'No job applications tracked yet.',
  fields: applicationFields,
  defaultValues: () => ({ company: '', roleTitle: '', contactName: '', contactPhone: '', contactEmail: '', status: 'applied', appliedDate: '', followUpDate: '', notes: '' }),
  extraFormHTML: renderDocumentSection,
  afterMount: (formEl, record) => wireDocumentSection(formEl, 'job', record),
  sort: (a, b) => (b.appliedDate || '').localeCompare(a.appliedDate || ''),
  toListItem: (r) => ({
    title: r.company,
    subtitle: r.roleTitle || '',
    badge: r.status,
    badgeVariant: applicationBadgeVariants[r.status] || 'neutral',
    meta: r.followUpDate ? `Follow up: ${formatDisplay(r.followUpDate)}` : '',
  }),
});

const workLogFields = [
  { key: 'employer', label: 'Employer', type: 'text', required: true },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'hoursWorked', label: 'Hours worked', type: 'number', step: '0.25' },
  { key: 'isEligibleRegionalWork', label: 'Counts toward 88-day regional work', type: 'checkbox' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const workLogCrud = createCrudView({
  store: STORES.workLogEntries,
  title: 'Work Log',
  addLabel: 'Add work day',
  emptyMessage: 'No work days logged yet.',
  fields: workLogFields,
  defaultValues: () => ({ employer: '', location: '', date: '', hoursWorked: null, isEligibleRegionalWork: false, jobApplicationId: null, notes: '' }),
  extraFormHTML: () => `
    <label class="form-field" for="field-jobApplicationId">
      <span>Linked application (optional)</span>
      <select id="field-jobApplicationId" name="jobApplicationId"></select>
    </label>`,
  afterMount: async (formEl, record) => {
    const select = formEl.elements.namedItem('jobApplicationId');
    const applications = await getAll(STORES.jobApplications);
    select.innerHTML =
      '<option value="">None</option>' +
      applications.map((a) => `<option value="${a.id}" ${a.id === record?.jobApplicationId ? 'selected' : ''}>${a.company}${a.roleTitle ? ' — ' + a.roleTitle : ''}</option>`).join('');
  },
  onBeforeSave: (data) => ({ ...data, jobApplicationId: data.jobApplicationId || null }),
  sort: (a, b) => b.date.localeCompare(a.date),
  toListItem: (r) => ({
    title: `${r.employer}${r.location ? ' — ' + r.location : ''}`,
    subtitle: r.hoursWorked ? `${r.hoursWorked}h` : '',
    badge: r.isEligibleRegionalWork ? '88-day eligible' : null,
    badgeVariant: 'success',
    meta: formatDisplay(r.date),
  }),
});

async function renderProgress(container) {
  const entries = await getAll(STORES.workLogEntries);
  const days = countDistinctEligibleDays(entries);
  const pct = Math.min(100, Math.round((days / 88) * 100));
  container.innerHTML = `
    <div class="progress-card">
      <div class="progress-card__label">88-day regional work: <strong>${days} / 88 days</strong></div>
      <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct}%"></div></div>
    </div>`;
}

async function render(container) {
  container.innerHTML = `
    <div class="tabs">
      <button type="button" class="tab-button is-active" data-tab="applications">Applications</button>
      <button type="button" class="tab-button" data-tab="worklog">Work Log</button>
    </div>
    <div data-progress></div>
    <div data-tab-panel="applications"></div>
    <div data-tab-panel="worklog" hidden></div>`;

  const progressEl = container.querySelector('[data-progress]');
  const applicationsPanel = container.querySelector('[data-tab-panel="applications"]');
  const worklogPanel = container.querySelector('[data-tab-panel="worklog"]');

  await renderProgress(progressEl);
  await applicationsCrud.render(applicationsPanel);
  await workLogCrud.render(worklogPanel);

  const unsubscribe = on('data:changed', ({ store }) => {
    if (store === STORES.workLogEntries) renderProgress(progressEl);
  });
  container.addEventListener('view:unmount', unsubscribe, { once: true });

  container.querySelectorAll('.tab-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const target = btn.dataset.tab;
      applicationsPanel.hidden = target !== 'applications';
      worklogPanel.hidden = target !== 'worklog';
    });
  });
}

export default { render };
