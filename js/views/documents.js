import { createCrudView } from '../components/crud-view.js';
import { getAll } from '../db.js';
import { STORES } from '../schema.js';
import { prepareFileForStorage } from '../utils/files.js';

const RELATED_MODULES = {
  none: { label: 'Not linked', store: null, labelField: null },
  job: { label: 'Job application', store: STORES.jobApplications, labelField: (r) => `${r.company} — ${r.roleTitle || ''}` },
  visaItem: { label: 'Visa / official item', store: STORES.visaItems, labelField: (r) => r.title },
  contact: { label: 'Contact', store: STORES.contacts, labelField: (r) => r.name },
  tripLeg: { label: 'Trip leg', store: STORES.tripLegs, labelField: (r) => r.locationName },
};

const fields = [
  { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Farm work contract' },
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'visa', label: 'Visa' },
      { value: 'contract', label: 'Contract' },
      { value: 'passport', label: 'Passport' },
      { value: 'insurance', label: 'Insurance' },
      { value: 'tax', label: 'Tax' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    key: 'relatedModule',
    label: 'Linked to',
    type: 'select',
    options: Object.entries(RELATED_MODULES).map(([value, m]) => ({ value, label: m.label })),
  },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

async function populateRelatedIdSelect(selectEl, relatedModuleKey, currentRelatedId) {
  const config = RELATED_MODULES[relatedModuleKey];
  if (!config || !config.store) {
    selectEl.innerHTML = '<option value="">—</option>';
    selectEl.disabled = true;
    return;
  }
  selectEl.disabled = false;
  const records = await getAll(config.store);
  selectEl.innerHTML =
    '<option value="">Select…</option>' +
    records.map((r) => `<option value="${r.id}" ${r.id === currentRelatedId ? 'selected' : ''}>${config.labelField(r)}</option>`).join('');
}

function extraFormHTML(record) {
  const hasFile = record?.fileBlob;
  return `
    <div class="form-section">
      <label class="form-field" for="field-relatedId">
        <span>Which record</span>
        <select id="field-relatedId" name="relatedId"></select>
      </label>
      <label class="form-field" for="field-file">
        <span>${hasFile ? 'Replace file' : 'File (photo or PDF)'}</span>
        <input type="file" id="field-file" name="file" accept="image/*,.pdf" />
      </label>
      ${hasFile ? `<p class="form-hint">Current file: ${record.fileName}</p>` : ''}
    </div>`;
}

async function afterMount(formEl, record) {
  const moduleSelect = formEl.elements.namedItem('relatedModule');
  const relatedIdSelect = formEl.elements.namedItem('relatedId');
  await populateRelatedIdSelect(relatedIdSelect, moduleSelect.value || 'none', record?.relatedId);
  moduleSelect.addEventListener('change', () => populateRelatedIdSelect(relatedIdSelect, moduleSelect.value, null));
}

async function onBeforeSave(data, record, formEl) {
  const relatedIdSelect = formEl.elements.namedItem('relatedId');
  data.relatedId = relatedIdSelect?.value || null;

  const fileInput = formEl.elements.namedItem('file');
  const file = fileInput?.files?.[0];
  if (file) {
    const prepared = await prepareFileForStorage(file);
    data.fileBlob = prepared.blob;
    data.fileName = prepared.fileName;
    data.mimeType = prepared.mimeType;
  } else if (record) {
    data.fileBlob = record.fileBlob;
    data.fileName = record.fileName;
    data.mimeType = record.mimeType;
  }
  data.updatedAt = new Date().toISOString();
  if (!record) data.createdAt = data.updatedAt;
  return data;
}

export default createCrudView({
  store: STORES.documents,
  title: 'Documents',
  addLabel: 'Add document',
  emptyMessage: 'No documents saved yet. Store contracts, visa PDFs, passport scans and more here.',
  fields,
  defaultValues: () => ({ title: '', category: 'other', relatedModule: 'none', relatedId: null, notes: '' }),
  extraFormHTML,
  afterMount,
  onBeforeSave,
  sort: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''),
  toListItem: (r) => {
    const config = RELATED_MODULES[r.relatedModule] || RELATED_MODULES.none;
    const fileLink = r.fileBlob
      ? `<a href="${URL.createObjectURL(r.fileBlob)}" target="_blank" rel="noopener">View file</a>`
      : '<span class="form-hint">No file attached</span>';
    return {
      title: r.title,
      subtitle: config.store ? config.label : '',
      badge: r.category,
      meta: fileLink,
    };
  },
});
