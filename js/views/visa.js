import { createCrudView } from '../components/crud-view.js';
import { STORES } from '../schema.js';
import { formatDisplay, daysUntil } from '../utils/date.js';
import { renderDocumentSection, wireDocumentSection } from '../components/document-picker.js';

const fields = [
  {
    key: 'type',
    label: 'Type',
    type: 'select',
    options: [
      { value: 'visa', label: 'Visa' },
      { value: 'TFN', label: 'Tax File Number (TFN)' },
      { value: 'superannuation', label: 'Superannuation' },
      { value: 'insurance', label: 'Insurance' },
      { value: 'other', label: 'Other' },
    ],
  },
  { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Working Holiday Visa (subclass 417)' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'not_started', label: 'Not started' },
      { value: 'in_progress', label: 'In progress' },
      { value: 'done', label: 'Done' },
    ],
  },
  { key: 'deadlineDate', label: 'Deadline', type: 'date' },
  { key: 'referenceNumber', label: 'Reference number', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

function deadlineMeta(deadlineDate, status) {
  if (!deadlineDate || status === 'done') return formatDisplay(deadlineDate);
  const diff = daysUntil(deadlineDate);
  const label = formatDisplay(deadlineDate);
  if (diff < 0) return `${label} — overdue by ${Math.abs(diff)}d`;
  if (diff === 0) return `${label} — due today`;
  return `${label} — in ${diff}d`;
}

const badgeVariants = { not_started: 'neutral', in_progress: 'warning', done: 'muted' };

export default createCrudView({
  store: STORES.visaItems,
  title: 'Visa & Official Matters',
  addLabel: 'Add item',
  emptyMessage: 'No visa or official items tracked yet.',
  fields,
  defaultValues: () => ({ type: 'visa', title: '', status: 'not_started', deadlineDate: '', referenceNumber: '', notes: '' }),
  extraFormHTML: renderDocumentSection,
  afterMount: (formEl, record) => wireDocumentSection(formEl, 'visaItem', record),
  sort: (a, b) => (a.deadlineDate || '9999').localeCompare(b.deadlineDate || '9999'),
  toListItem: (r) => ({
    title: r.title,
    subtitle: r.type,
    badge: r.status.replace('_', ' '),
    badgeVariant: badgeVariants[r.status] || 'neutral',
    meta: deadlineMeta(r.deadlineDate, r.status),
  }),
});
