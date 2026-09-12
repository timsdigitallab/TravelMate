import { createCrudView } from '../components/crud-view.js';
import { STORES } from '../schema.js';
import { formatDisplay } from '../utils/date.js';
import { renderDocumentSection, wireDocumentSection } from '../components/document-picker.js';

const fields = [
  { key: 'locationName', label: 'Location / stop', type: 'text', required: true, placeholder: 'e.g. Sydney' },
  { key: 'region', label: 'Region / state', type: 'text', placeholder: 'e.g. New South Wales' },
  { key: 'plannedStartDate', label: 'Start date', type: 'date' },
  { key: 'plannedEndDate', label: 'End date', type: 'date' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'planned', label: 'Planned' },
      { value: 'current', label: 'Current' },
      { value: 'done', label: 'Done' },
    ],
  },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const badgeVariants = { planned: 'neutral', current: 'success', done: 'muted' };

export default createCrudView({
  store: STORES.tripLegs,
  title: 'Trip & Route',
  addLabel: 'Add stop',
  emptyMessage: 'No stops planned yet. Add the first leg of your route.',
  fields,
  defaultValues: () => ({ locationName: '', region: '', plannedStartDate: '', plannedEndDate: '', status: 'planned', notes: '' }),
  extraFormHTML: renderDocumentSection,
  afterMount: (formEl, record) => wireDocumentSection(formEl, 'tripLeg', record),
  sort: (a, b) => (a.plannedStartDate || '9999').localeCompare(b.plannedStartDate || '9999'),
  toListItem: (r) => ({
    title: r.locationName,
    subtitle: r.region || '',
    badge: r.status,
    badgeVariant: badgeVariants[r.status] || 'neutral',
    meta: [formatDisplay(r.plannedStartDate), formatDisplay(r.plannedEndDate)].filter(Boolean).join(' → '),
  }),
});
