// Embeddable "linked documents" widget for a record's edit modal (visa
// items, job applications, trip legs). Only usable once the parent record
// already exists (has an id) - a brand-new record must be saved once
// before documents can be linked to it.
import { getByIndex, put, remove } from '../db.js';
import { STORES } from '../schema.js';
import { prepareFileForStorage } from '../utils/files.js';
import { makeId } from '../utils/id.js';

export function renderDocumentSection(record) {
  if (!record) {
    return `<p class="form-hint">Save this entry first, then reopen it to attach documents.</p>`;
  }
  return `
    <div class="form-section">
      <h3>Linked documents</h3>
      <ul class="mini-list" data-linked-documents></ul>
      <label class="form-field">
        <span>Attach a file (photo or PDF)</span>
        <input type="file" data-attach-file accept="image/*,.pdf" />
      </label>
    </div>`;
}

export function wireDocumentSection(formEl, relatedModule, record) {
  if (!record) return;
  const listEl = formEl.querySelector('[data-linked-documents]');
  const fileInput = formEl.querySelector('[data-attach-file]');
  if (!listEl || !fileInput) return;

  async function refresh() {
    const docs = await getByIndex(STORES.documents, 'relatedId', record.id);
    listEl.innerHTML = docs.length
      ? docs
          .map((d) => `<li data-doc-id="${d.id}"><span>${d.title || d.fileName}</span><button type="button" data-remove-doc="${d.id}" aria-label="Remove">&times;</button></li>`)
          .join('')
      : '<li class="empty-state">No documents attached yet.</li>';
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const prepared = await prepareFileForStorage(file);
    const now = new Date().toISOString();
    await put(STORES.documents, {
      id: makeId(),
      title: file.name,
      category: 'other',
      relatedModule,
      relatedId: record.id,
      fileBlob: prepared.blob,
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      notes: '',
      createdAt: now,
      updatedAt: now,
    });
    fileInput.value = '';
    await refresh();
  });

  listEl.addEventListener('click', async (e) => {
    const id = e.target.dataset.removeDoc;
    if (!id) return;
    if (!confirm('Remove this document?')) return;
    await remove(STORES.documents, id);
    await refresh();
  });

  refresh();
}
