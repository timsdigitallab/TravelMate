// Packing list: grouped by List -> Category, both collapsible, with List and
// Category picked from a dropdown of already-used values (extendable inline
// via "+ Add new..."). Doesn't use createCrudView - the two-level grouping/
// collapsing and the dropdown-with-create fields don't fit that flat-list
// pattern, so this view talks to db.js/modal.js/state.js directly instead
// (same building blocks crud-view itself is built from).
import { getAll, put, remove } from '../db.js';
import { STORES } from '../schema.js';
import { openModal, closeModal } from '../components/modal.js';
import { renderListItem, renderEmptyState } from '../components/list-item.js';
import { makeId } from '../utils/id.js';
import { emit, on } from '../state.js';

const NEW_VALUE = '__new__';
const UNCATEGORIZED = 'Uncategorized';

// Open/closed state survives re-renders (checkbox toggles, add/edit/delete,
// live updates from another device) - only resets when the view is first
// mounted. Without this, ticking a checkbox inside an expanded group would
// immediately collapse it again.
let openLists = new Set();
let openCategories = new Set();
let subscribed = false;

function escapeAttr(value) {
  return String(value ?? '').replace(/"/g, '&quot;');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function distinctValues(items, field) {
  const values = new Set();
  for (const item of items) {
    const value = (item[field] || '').trim();
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

// Renders a <select> of existing values (deduped with the current value)
// plus "+ Add new...", and a hidden text input that appears when that's
// picked. Native <select> rather than <datalist>: datalist support on
// mobile browsers (iOS Safari in particular) is inconsistent, not solid
// enough for a mobile-first app.
function selectWithCreateField(fieldKey, label, options, currentValue, { required = false, allowBlank = false } = {}) {
  const values = new Set(options);
  if (currentValue) values.add(currentValue);
  const sorted = [...values].sort((a, b) => a.localeCompare(b));

  const blankOption = allowBlank ? `<option value="" ${!currentValue ? 'selected' : ''}>— None —</option>` : '';
  const valueOptions = sorted
    .map((v) => `<option value="${escapeAttr(v)}" ${v === currentValue ? 'selected' : ''}>${escapeHtml(v)}</option>`)
    .join('');

  return `
    <label class="form-field" for="field-${fieldKey}">
      <span>${label}</span>
      <select id="field-${fieldKey}" data-select-field="${fieldKey}" ${required ? 'required' : ''}>
        ${blankOption}
        ${valueOptions}
        <option value="${NEW_VALUE}">+ Add new…</option>
      </select>
      <input type="text" data-new-field="${fieldKey}" placeholder="New ${label.toLowerCase()} name" hidden />
    </label>`;
}

// `required` must only ever be true on the input while it's actually the
// active/visible one: a hidden field that's still `required` makes native
// form validation silently refuse to submit (it can't show the "please
// fill this in" bubble on a display:none element) - which is exactly what
// broke adding a second item to an existing list, since the select then
// has a valid value but its hidden "new name" companion was still required.
function wireSelectWithCreate(formEl, fieldKey, { required = false } = {}) {
  const select = formEl.querySelector(`[data-select-field="${fieldKey}"]`);
  const input = formEl.querySelector(`[data-new-field="${fieldKey}"]`);
  const applyState = () => {
    const isNew = select.value === NEW_VALUE;
    input.hidden = !isNew;
    input.required = isNew && required;
  };
  select.addEventListener('change', () => {
    applyState();
    if (select.value === NEW_VALUE) input.focus();
  });
  applyState();
}

function readSelectWithCreate(formEl, fieldKey) {
  const select = formEl.querySelector(`[data-select-field="${fieldKey}"]`);
  const input = formEl.querySelector(`[data-new-field="${fieldKey}"]`);
  if (select.value === NEW_VALUE) return input.value.trim();
  return select.value;
}

async function openForm(record) {
  const items = await getAll(STORES.packingItems);
  const listOptions = distinctValues(items, 'listName');
  const categoryOptions = distinctValues(items, 'category');
  const values = record || { listName: listOptions[0] || 'Pre-departure', itemName: '', category: '', isChecked: false };

  openModal({
    title: record ? 'Edit item' : 'Add item',
    submitLabel: 'Save',
    bodyHTML: `
      ${selectWithCreateField('listName', 'List', listOptions, values.listName, { required: true })}
      <label class="form-field" for="field-itemName">
        <span>Item</span>
        <input type="text" id="field-itemName" name="itemName" value="${escapeAttr(values.itemName)}" placeholder="e.g. First aid kit" required />
      </label>
      ${selectWithCreateField('category', 'Category', categoryOptions, values.category, { allowBlank: true })}
    `,
    onMount: (formEl) => {
      wireSelectWithCreate(formEl, 'listName', { required: true });
      wireSelectWithCreate(formEl, 'category', { required: false });
    },
    onSubmit: async (formEl) => {
      const listName = readSelectWithCreate(formEl, 'listName');
      const category = readSelectWithCreate(formEl, 'category');
      const itemName = formEl.elements.namedItem('itemName').value.trim();
      if (!listName || !itemName) return;

      const saved = { ...values, listName, itemName, category, id: values.id || makeId() };
      await put(STORES.packingItems, saved);
      closeModal();
      // Newly created/edited groups should be visible right away.
      openLists.add(saved.listName);
      openCategories.add(`${saved.listName}::${saved.category || UNCATEGORIZED}`);
      emit('data:changed', { store: STORES.packingItems });
      await renderGroups();
    },
  });
}

let currentGroupsEl = null;

function groupItems(items) {
  const byList = new Map();
  for (const item of items) {
    const listName = item.listName || UNCATEGORIZED;
    const category = item.category || UNCATEGORIZED;
    if (!byList.has(listName)) byList.set(listName, new Map());
    const byCategory = byList.get(listName);
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(item);
  }
  return byList;
}

function progressBadge(items) {
  const checked = items.filter((i) => i.isChecked).length;
  return `<span class="badge badge--neutral">${checked}/${items.length}</span>`;
}

function renderGroupsHTML(items) {
  if (!items.length) return renderEmptyState('Nothing on your packing list yet. Add your first item.');

  const byList = groupItems(items);
  const listNames = [...byList.keys()].sort((a, b) => a.localeCompare(b));

  return listNames
    .map((listName) => {
      const byCategory = byList.get(listName);
      const listItems = [...byCategory.values()].flat();
      const categoryNames = [...byCategory.keys()].sort((a, b) => a.localeCompare(b));
      const listKey = listName;

      const categoriesHTML = categoryNames
        .map((category) => {
          const catItems = byCategory
            .get(category)
            .sort((a, b) => a.itemName.localeCompare(b.itemName));
          const catKey = `${listName}::${category}`;
          const rows = catItems
            .map((item) =>
              renderListItem({
                id: item.id,
                title: item.itemName,
                checkbox: { checked: !!item.isChecked },
              })
            )
            .join('');
          return `
            <details class="packing-subgroup" data-cat-key="${escapeAttr(catKey)}">
              <summary class="packing-subgroup__summary">
                <span>${escapeHtml(category)}</span>
                ${progressBadge(catItems)}
              </summary>
              <ul class="list">${rows}</ul>
            </details>`;
        })
        .join('');

      return `
        <details class="packing-group" data-list-key="${escapeAttr(listKey)}">
          <summary class="packing-group__summary">
            <span class="packing-group__name">${escapeHtml(listName)}</span>
            ${progressBadge(listItems)}
          </summary>
          <div class="packing-group__body">${categoriesHTML}</div>
        </details>`;
    })
    .join('');
}

function restoreOpenState(groupsEl) {
  groupsEl.querySelectorAll('details[data-list-key]').forEach((el) => {
    const key = el.dataset.listKey;
    if (openLists.has(key)) el.open = true;
    el.addEventListener('toggle', () => {
      if (el.open) openLists.add(key);
      else openLists.delete(key);
    });
  });
  groupsEl.querySelectorAll('details[data-cat-key]').forEach((el) => {
    const key = el.dataset.catKey;
    if (openCategories.has(key)) el.open = true;
    el.addEventListener('toggle', () => {
      if (el.open) openCategories.add(key);
      else openCategories.delete(key);
    });
  });
}

async function renderGroups() {
  if (!currentGroupsEl || !currentGroupsEl.isConnected) return;
  const items = await getAll(STORES.packingItems);
  currentGroupsEl.innerHTML = renderGroupsHTML(items);
  restoreOpenState(currentGroupsEl);
}

async function handleDelegatedClick(e) {
  const li = e.target.closest('.list-item');
  if (!li) return;
  const id = li.dataset.id;
  const items = await getAll(STORES.packingItems);
  const record = items.find((r) => r.id === id);
  if (!record) return;

  if (e.target.dataset.action === 'delete') {
    if (!confirm('Delete this entry?')) return;
    await remove(STORES.packingItems, id);
    emit('data:changed', { store: STORES.packingItems });
    await renderGroups();
  } else if (e.target.dataset.action === 'toggle') {
    record.isChecked = e.target.checked;
    await put(STORES.packingItems, record);
    emit('data:changed', { store: STORES.packingItems });
    await renderGroups();
  } else if (e.target.closest('[data-action="edit"]')) {
    openForm(record);
  }
}

async function render(container) {
  container.innerHTML = `
    <div class="view-header">
      <h1>Packing List</h1>
      <button type="button" class="button button--primary" data-action="add">Add item</button>
    </div>
    <div data-groups></div>`;

  currentGroupsEl = container.querySelector('[data-groups]');
  await renderGroups();

  container.querySelector('[data-action="add"]').addEventListener('click', () => openForm(null));
  currentGroupsEl.addEventListener('click', handleDelegatedClick);

  if (!subscribed) {
    subscribed = true;
    on('data:changed', ({ store }) => {
      if (store === STORES.packingItems) renderGroups();
    });
  }
}

export default { render };
