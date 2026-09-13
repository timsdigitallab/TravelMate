// Places: a library of researched locations, each with its own points of
// interest (sights/activities/food) grouped by status. Doesn't use
// createCrudView - the list-vs-detail drill-down and status grouping don't
// fit that flat-list pattern, so this view talks to db.js/modal.js/state.js
// directly instead, following the same approach as js/views/packing.js.
import { getAll, put, remove } from '../db.js';
import { STORES } from '../schema.js';
import { openModal, closeModal } from '../components/modal.js';
import { makeId } from '../utils/id.js';
import { emit, on } from '../state.js';
import { ICONS } from '../utils/icons.js';
import { parseGoogleMapsCoords, googleMapsSearchUrl } from '../utils/maps.js';

const POI_TYPES = [
  { value: 'sight', label: 'Sight' },
  { value: 'activity', label: 'Activity' },
  { value: 'food', label: 'Food & Drink' },
  { value: 'other', label: 'Other' },
];
const POI_STATUSES = ['planned', 'idea', 'done'];
const STATUS_LABELS = { idea: 'Idea', planned: 'Planned', done: 'Done' };
const STATUS_BADGE_VARIANT = { idea: 'muted', planned: 'neutral', done: 'success' };

// Which place is currently drilled into (null = the places list). Persists
// across re-renders like packing.js's open/closed group state, only reset
// to null on an explicit "back" or when the viewed place no longer exists.
let viewingPlaceId = null;
let openPoiGroups = new Set(); // `${placeId}::${status}`
let defaultedPlaces = new Set(); // places that already got their one-time default open group
let currentContainerEl = null;
let subscribed = false;

function escapeAttr(value) {
  return String(value ?? '').replace(/"/g, '&quot;');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mapsFieldHTML(currentValue) {
  return `
    <label class="form-field" for="field-mapsUrl">
      <span>Google Maps link</span>
      <button type="button" class="button button--ghost button--sm maps-search-button" data-maps-search>${ICONS.pinSmall} Search on Google Maps</button>
      <span class="form-hint">Opens Google Maps in a new tab - paste its share link below.</span>
      <input type="text" id="field-mapsUrl" name="mapsUrl" value="${escapeAttr(currentValue)}" placeholder="Paste a Google Maps share link" style="margin-top: 0.3em;" />
      <span class="form-hint">We'll pull out the coordinates automatically.</span>
    </label>`;
}

function wireMapsSearch(formEl, nameFieldSelector) {
  const btn = formEl.querySelector('[data-maps-search]');
  btn?.addEventListener('click', () => {
    const nameEl = formEl.querySelector(nameFieldSelector);
    const query = (nameEl?.value || '').trim();
    if (!query) {
      nameEl?.focus();
      return;
    }
    window.open(googleMapsSearchUrl(query), '_blank', 'noopener');
  });
}

// --- Place form -------------------------------------------------------

function placeFormHTML(values) {
  return `
    <label class="form-field" for="field-name">
      <span>Name</span>
      <input type="text" id="field-name" name="name" value="${escapeAttr(values.name)}" placeholder="e.g. Sydney" required />
    </label>
    <label class="form-field" for="field-region">
      <span>Region / state</span>
      <input type="text" id="field-region" name="region" value="${escapeAttr(values.region)}" placeholder="e.g. New South Wales" />
    </label>
    ${mapsFieldHTML(values.mapsUrl)}
    <label class="form-field" for="field-notes">
      <span>Notes</span>
      <textarea id="field-notes" name="notes" rows="3" placeholder="Anything worth remembering...">${escapeHtml(values.notes)}</textarea>
    </label>`;
}

function openPlaceForm(record) {
  const values = record || { name: '', region: '', notes: '', mapsUrl: '' };
  openModal({
    title: record ? 'Edit place' : 'Add place',
    submitLabel: 'Save',
    bodyHTML: placeFormHTML(values),
    onMount: (formEl) => wireMapsSearch(formEl, '#field-name'),
    onSubmit: async (formEl) => {
      const name = formEl.elements.namedItem('name').value.trim();
      if (!name) return;
      const mapsUrl = formEl.elements.namedItem('mapsUrl').value.trim();
      const coords = parseGoogleMapsCoords(mapsUrl);
      const saved = {
        ...values,
        id: values.id || makeId(),
        name,
        region: formEl.elements.namedItem('region').value.trim(),
        notes: formEl.elements.namedItem('notes').value.trim(),
        mapsUrl,
        mapsLat: coords?.lat ?? null,
        mapsLng: coords?.lng ?? null,
        createdAt: values.createdAt || new Date().toISOString(),
      };
      await put(STORES.places, saved);
      closeModal();
      emit('data:changed', { store: STORES.places });
      await renderView(currentContainerEl);
    },
  });
}

// --- Point of interest form --------------------------------------------

function poiFormHTML(values) {
  const typeOptions = POI_TYPES.map((t) => `<option value="${t.value}" ${t.value === values.type ? 'selected' : ''}>${t.label}</option>`).join('');
  const statusOptions = POI_STATUSES.map((s) => `<option value="${s}" ${s === values.status ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('');
  return `
    <label class="form-field" for="field-poi-name">
      <span>Name</span>
      <input type="text" id="field-poi-name" name="name" value="${escapeAttr(values.name)}" placeholder="e.g. Bondi to Coogee coastal walk" required />
    </label>
    <label class="form-field" for="field-poi-type">
      <span>Type</span>
      <select id="field-poi-type" name="type">${typeOptions}</select>
    </label>
    <label class="form-field" for="field-poi-status">
      <span>Status</span>
      <select id="field-poi-status" name="status">${statusOptions}</select>
    </label>
    ${mapsFieldHTML(values.mapsUrl)}
    <label class="form-field" for="field-poi-notes">
      <span>Notes</span>
      <textarea id="field-poi-notes" name="notes" rows="3" placeholder="Anything worth remembering...">${escapeHtml(values.notes)}</textarea>
    </label>`;
}

function openPoiForm(placeId, record) {
  const values = record || { name: '', type: 'sight', status: 'idea', mapsUrl: '', notes: '' };
  openModal({
    title: record ? 'Edit point of interest' : 'Add point of interest',
    submitLabel: 'Save',
    bodyHTML: poiFormHTML(values),
    onMount: (formEl) => wireMapsSearch(formEl, '#field-poi-name'),
    onSubmit: async (formEl) => {
      const name = formEl.elements.namedItem('name').value.trim();
      if (!name) return;
      const status = formEl.elements.namedItem('status').value;
      const mapsUrl = formEl.elements.namedItem('mapsUrl').value.trim();
      const coords = parseGoogleMapsCoords(mapsUrl);
      const saved = {
        ...values,
        id: values.id || makeId(),
        placeId,
        name,
        type: formEl.elements.namedItem('type').value,
        status,
        notes: formEl.elements.namedItem('notes').value.trim(),
        mapsUrl,
        mapsLat: coords?.lat ?? null,
        mapsLng: coords?.lng ?? null,
      };
      await put(STORES.pointsOfInterest, saved);
      closeModal();
      openPoiGroups.add(`${placeId}::${status}`);
      emit('data:changed', { store: STORES.pointsOfInterest });
      await renderView(currentContainerEl);
    },
  });
}

// --- Places list --------------------------------------------------------

function pillsForCounts(counts) {
  const parts = [];
  if (counts.idea) parts.push(`<span class="badge badge--muted">${counts.idea} idea${counts.idea === 1 ? '' : 's'}</span>`);
  if (counts.planned) parts.push(`<span class="badge badge--neutral">${counts.planned} planned</span>`);
  if (counts.done) parts.push(`<span class="badge badge--success">${counts.done} done</span>`);
  return parts.join('');
}

async function renderPlacesList(container) {
  const places = await getAll(STORES.places);
  const pois = await getAll(STORES.pointsOfInterest);
  const countsByPlace = new Map();
  for (const poi of pois) {
    if (!countsByPlace.has(poi.placeId)) countsByPlace.set(poi.placeId, { idea: 0, planned: 0, done: 0 });
    const counts = countsByPlace.get(poi.placeId);
    if (counts[poi.status] !== undefined) counts[poi.status] += 1;
  }
  const sorted = [...places].sort((a, b) => a.name.localeCompare(b.name));

  container.innerHTML = `
    <div class="view-header">
      <h1>Places</h1>
      <button type="button" class="button button--primary" data-action="add-place">+ Add place</button>
    </div>
    ${
      sorted.length
        ? sorted
            .map((p) => {
              const counts = countsByPlace.get(p.id) || { idea: 0, planned: 0, done: 0 };
              return `
              <button type="button" class="place-card" data-place-id="${escapeAttr(p.id)}">
                <div>
                  <div class="place-card__name">${escapeHtml(p.name)}</div>
                  ${p.region ? `<div class="place-card__region">${escapeHtml(p.region)}</div>` : ''}
                </div>
                <div class="place-card__pills">${pillsForCounts(counts) || '<span class="badge badge--muted">No POIs yet</span>'}</div>
              </button>`;
            })
            .join('')
        : '<p class="empty-state">No places yet. Add a place to start collecting sights and activities.</p>'
    }`;
}

// --- Place detail --------------------------------------------------------

function restorePoiOpenState(container) {
  container.querySelectorAll('details[data-status-key]').forEach((el) => {
    const key = el.dataset.statusKey;
    if (openPoiGroups.has(key)) el.open = true;
    el.addEventListener('toggle', () => {
      if (el.open) openPoiGroups.add(key);
      else openPoiGroups.delete(key);
    });
  });
}

async function renderPlaceDetail(container, place) {
  const allPois = await getAll(STORES.pointsOfInterest);
  const pois = allPois.filter((p) => p.placeId === place.id);
  const byStatus = { idea: [], planned: [], done: [] };
  for (const poi of pois) (byStatus[poi.status] || byStatus.idea).push(poi);

  if (!defaultedPlaces.has(place.id)) {
    defaultedPlaces.add(place.id);
    openPoiGroups.add(`${place.id}::planned`);
  }

  const groupsHTML = POI_STATUSES.map((status) => {
    const items = byStatus[status].slice().sort((a, b) => a.name.localeCompare(b.name));
    const key = `${place.id}::${status}`;
    const rowsHTML = items
      .map(
        (poi) => `
        <div class="poi-row">
          <div class="poi-row__main" data-action="edit-poi" data-poi-id="${escapeAttr(poi.id)}">
            <div class="poi-row__name">${escapeHtml(poi.name)}</div>
            <div class="poi-row__tag"><span class="badge badge--neutral">${escapeHtml(POI_TYPES.find((t) => t.value === poi.type)?.label || poi.type)}</span></div>
          </div>
          ${poi.mapsUrl ? `<a class="icon-button" href="${escapeAttr(poi.mapsUrl)}" target="_blank" rel="noopener" aria-label="Open in Maps">${ICONS.pinSmall}</a>` : ''}
          <button type="button" class="icon-button" data-action="delete-poi" data-poi-id="${escapeAttr(poi.id)}" aria-label="Delete">&times;</button>
        </div>`
      )
      .join('');
    return `
      <details class="poi-group" data-status-key="${escapeAttr(key)}">
        <summary class="poi-group__summary">
          <span class="poi-group__name">${STATUS_LABELS[status]}</span>
          <span class="badge badge--${STATUS_BADGE_VARIANT[status]}">${items.length}</span>
        </summary>
        <div class="poi-group__body">${rowsHTML || '<p class="empty-state">Nothing here yet.</p>'}</div>
      </details>`;
  }).join('');

  const mapsHref = place.mapsUrl || googleMapsSearchUrl([place.name, place.region].filter(Boolean).join(', '));

  container.innerHTML = `
    <button type="button" class="back-link" data-action="back">&larr; Places</button>
    <div class="place-header">
      <div class="place-header__top">
        <h1>${escapeHtml(place.name)}</h1>
        <div class="place-header__actions">
          <button type="button" class="icon-button" data-action="edit-place" aria-label="Edit place">${ICONS.edit}</button>
          <button type="button" class="icon-button" data-action="delete-place" data-place-id="${escapeAttr(place.id)}" aria-label="Delete place">&times;</button>
        </div>
      </div>
      ${place.region ? `<div class="place-header__region">${escapeHtml(place.region)}</div>` : ''}
      <a class="button button--ghost button--sm" href="${escapeAttr(mapsHref)}" target="_blank" rel="noopener">${ICONS.pinSmall} Open in Maps</a>
      ${place.notes ? `<p class="place-header__notes" style="margin-top: 0.7em;">${escapeHtml(place.notes)}</p>` : ''}
    </div>
    ${groupsHTML}
    <button type="button" class="button button--primary button--block" data-action="add-poi">+ Add point of interest</button>`;

  restorePoiOpenState(container);
}

// --- Shared render + delegated actions -----------------------------------

async function renderView(container) {
  if (!container || !container.isConnected) return;
  if (viewingPlaceId) {
    const place = (await getAll(STORES.places)).find((p) => p.id === viewingPlaceId);
    if (!place) {
      viewingPlaceId = null;
      await renderView(container);
      return;
    }
    await renderPlaceDetail(container, place);
  } else {
    await renderPlacesList(container);
  }
}

async function handleDelegatedClick(e) {
  const target = e.target;

  if (target.closest('[data-action="add-place"]')) {
    openPlaceForm(null);
    return;
  }
  if (target.closest('[data-action="back"]')) {
    viewingPlaceId = null;
    await renderView(currentContainerEl);
    return;
  }
  if (target.closest('[data-action="edit-place"]')) {
    const place = (await getAll(STORES.places)).find((p) => p.id === viewingPlaceId);
    if (place) openPlaceForm(place);
    return;
  }
  if (target.closest('[data-action="add-poi"]')) {
    if (viewingPlaceId) openPoiForm(viewingPlaceId, null);
    return;
  }
  const deletePlace = target.closest('[data-action="delete-place"]');
  if (deletePlace) {
    if (!confirm('Delete this place and all its points of interest?')) return;
    const id = deletePlace.dataset.placeId;
    const relatedPois = (await getAll(STORES.pointsOfInterest)).filter((p) => p.placeId === id);
    for (const poi of relatedPois) await remove(STORES.pointsOfInterest, poi.id);
    await remove(STORES.places, id);
    if (viewingPlaceId === id) viewingPlaceId = null;
    emit('data:changed', { store: STORES.pointsOfInterest });
    emit('data:changed', { store: STORES.places });
    await renderView(currentContainerEl);
    return;
  }
  const placeCard = target.closest('[data-place-id]');
  if (placeCard) {
    viewingPlaceId = placeCard.dataset.placeId;
    await renderView(currentContainerEl);
    return;
  }
  const editPoi = target.closest('[data-action="edit-poi"]');
  if (editPoi) {
    const poi = (await getAll(STORES.pointsOfInterest)).find((p) => p.id === editPoi.dataset.poiId);
    if (poi) openPoiForm(viewingPlaceId, poi);
    return;
  }
  const deletePoi = target.closest('[data-action="delete-poi"]');
  if (deletePoi) {
    if (!confirm('Delete this entry?')) return;
    await remove(STORES.pointsOfInterest, deletePoi.dataset.poiId);
    emit('data:changed', { store: STORES.pointsOfInterest });
    await renderView(currentContainerEl);
  }
}

async function render(container) {
  currentContainerEl = container;
  await renderView(container);
  container.addEventListener('click', handleDelegatedClick);

  if (!subscribed) {
    subscribed = true;
    on('data:changed', ({ store }) => {
      if (store === STORES.places || store === STORES.pointsOfInterest) renderView(currentContainerEl);
    });
  }
}

export default { render };
