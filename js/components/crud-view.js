// Factory for the common "list of records + add/edit modal" pattern shared
// by most modules (packing, contacts, documents, trip legs, visa items,
// job applications, work log, transactions). Keeps each view.js file small:
// it just describes fields and how a record maps to a list row.
import { getAll, put, remove } from '../db.js';
import { renderForm, collectFormData } from './form-fields.js';
import { openModal, closeModal } from './modal.js';
import { renderListItem, renderEmptyState } from './list-item.js';
import { makeId } from '../utils/id.js';
import { emit } from '../state.js';

// options:
//   store, title, addLabel, emptyMessage, fields[]
//   defaultValues(): object for a brand-new record
//   sort(a,b), filter(record): boolean (optional)
//   toListItem(record): props for renderListItem (without id)
//   onBeforeSave(values, existingRecord): values (optional transform hook)
//   quickToggleField: field key toggled by tapping the row's checkbox, skips the modal
//   extraFormHTML(record): extra markup appended into the modal body (e.g. linked documents)
//   afterMount(formEl, record): wire up extra widgets in extraFormHTML
export function createCrudView(options) {
  async function loadRecords() {
    let records = await getAll(options.store);
    if (options.filter) records = records.filter(options.filter);
    if (options.sort) records = records.sort(options.sort);
    return records;
  }

  async function renderList(listEl) {
    const records = await loadRecords();
    if (!records.length) {
      listEl.innerHTML = renderEmptyState(options.emptyMessage);
      return;
    }
    listEl.innerHTML = records
      .map((r) => renderListItem({ id: r.id, ...options.toListItem(r) }))
      .join('');
  }

  function openForm(record, listEl) {
    const values = record || options.defaultValues();
    openModal({
      title: record ? `Edit ${options.title}` : options.addLabel,
      bodyHTML: renderForm(options.fields, values) + (options.extraFormHTML ? options.extraFormHTML(record) : ''),
      submitLabel: 'Save',
      onMount: (formEl) => options.afterMount?.(formEl, record),
      onSubmit: async (formEl) => {
        let data = collectFormData(formEl, options.fields);
        if (options.onBeforeSave) data = (await options.onBeforeSave(data, record, formEl)) || data;
        const saved = { ...values, ...data, id: values.id || makeId() };
        await put(options.store, saved);
        closeModal();
        emit('data:changed', { store: options.store });
        await renderList(listEl);
      },
    });
  }

  async function render(container) {
    container.innerHTML = `
      <div class="view-header">
        <h1>${options.title}</h1>
        <button type="button" class="button button--primary" data-action="add">${options.addLabel}</button>
      </div>
      <ul class="list" data-list></ul>`;

    const listEl = container.querySelector('[data-list]');
    await renderList(listEl);

    container.querySelector('[data-action="add"]').addEventListener('click', () => openForm(null, listEl));

    listEl.addEventListener('click', async (e) => {
      const li = e.target.closest('.list-item');
      if (!li) return;
      const id = li.dataset.id;
      const records = await loadRecords();
      const record = records.find((r) => r.id === id);
      if (!record) return;

      if (e.target.dataset.action === 'delete') {
        if (!confirm('Delete this entry?')) return;
        await remove(options.store, id);
        emit('data:changed', { store: options.store });
        await renderList(listEl);
      } else if (e.target.dataset.action === 'toggle' && options.quickToggleField) {
        record[options.quickToggleField] = e.target.checked;
        await put(options.store, record);
        emit('data:changed', { store: options.store });
        await renderList(listEl);
      } else if (e.target.closest('[data-action="edit"]')) {
        openForm(record, listEl);
      }
    });
  }

  return { render };
}
