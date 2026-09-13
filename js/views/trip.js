// Trip: a 2-tab area, same tab-shell pattern as js/views/jobs.js. "Places"
// is the timeless library of researched locations (js/views/places.js);
// "Itinerary" is the dated stop-by-stop route (the flat CRUD list this
// module used to be on its own), now optionally linkable to a Place.
import { createCrudView } from '../components/crud-view.js';
import { getAll } from '../db.js';
import { STORES } from '../schema.js';
import { formatDisplay } from '../utils/date.js';
import { renderDocumentSection, wireDocumentSection } from '../components/document-picker.js';
import places from './places.js';

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

function extraFormHTML(record) {
  return `
    <label class="form-field" for="field-placeId">
      <span>Linked place (optional)</span>
      <select id="field-placeId" name="placeId"></select>
    </label>
    ${renderDocumentSection(record)}`;
}

async function afterMount(formEl, record) {
  const select = formEl.elements.namedItem('placeId');
  const allPlaces = await getAll(STORES.places);
  select.innerHTML =
    '<option value="">None</option>' +
    allPlaces.map((p) => `<option value="${p.id}" ${p.id === record?.placeId ? 'selected' : ''}>${p.name}${p.region ? ' — ' + p.region : ''}</option>`).join('');
  wireDocumentSection(formEl, 'tripLeg', record);
}

// Denormalizes the linked place's name onto the record (rather than
// resolving it at list-render time) so toListItem below can stay
// synchronous - crud-view.js's renderList doesn't await it.
async function onBeforeSave(data, record, formEl) {
  const placeId = formEl.elements.namedItem('placeId').value || null;
  const place = placeId ? (await getAll(STORES.places)).find((p) => p.id === placeId) : null;
  return { ...data, placeId, linkedPlaceName: place ? place.name : null };
}

const itineraryCrud = createCrudView({
  store: STORES.tripLegs,
  title: 'Trip & Route',
  addLabel: 'Add stop',
  emptyMessage: 'No stops planned yet. Add the first leg of your route.',
  fields,
  defaultValues: () => ({ locationName: '', region: '', plannedStartDate: '', plannedEndDate: '', status: 'planned', notes: '', placeId: null }),
  extraFormHTML,
  afterMount,
  onBeforeSave,
  sort: (a, b) => (a.plannedStartDate || '9999').localeCompare(b.plannedStartDate || '9999'),
  toListItem: (r) => ({
    title: r.locationName,
    subtitle: r.region || '',
    badge: r.status,
    badgeVariant: badgeVariants[r.status] || 'neutral',
    meta: [
      [formatDisplay(r.plannedStartDate), formatDisplay(r.plannedEndDate)].filter(Boolean).join(' → '),
      r.linkedPlaceName ? `Linked: ${r.linkedPlaceName}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  }),
});

async function render(container) {
  container.innerHTML = `
    <div class="tabs">
      <button type="button" class="tab-button is-active" data-tab="places">Places</button>
      <button type="button" class="tab-button" data-tab="itinerary">Itinerary</button>
    </div>
    <div data-tab-panel="places"></div>
    <div data-tab-panel="itinerary" hidden></div>`;

  const placesPanel = container.querySelector('[data-tab-panel="places"]');
  const itineraryPanel = container.querySelector('[data-tab-panel="itinerary"]');

  await places.render(placesPanel);
  await itineraryCrud.render(itineraryPanel);

  container.querySelectorAll('.tab-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const target = btn.dataset.tab;
      placesPanel.hidden = target !== 'places';
      itineraryPanel.hidden = target !== 'itinerary';
    });
  });
}

export default { render };
