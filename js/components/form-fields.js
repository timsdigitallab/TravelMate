// Shared field rendering/reading for all the CRUD forms across modules.
// A field descriptor looks like:
// { key, label, type: 'text'|'textarea'|'date'|'number'|'select'|'checkbox'|'tel'|'email',
//   required, options: [{value,label}], placeholder, step, rows }

function escapeAttr(value) {
  return String(value ?? '').replace(/"/g, '&quot;');
}

export function renderField(field, value) {
  const id = `field-${field.key}`;
  const req = field.required ? 'required' : '';

  if (field.type === 'textarea') {
    return `
      <label class="form-field" for="${id}">
        <span>${field.label}</span>
        <textarea id="${id}" name="${field.key}" rows="${field.rows || 3}" ${req}>${value ?? ''}</textarea>
      </label>`;
  }

  if (field.type === 'select') {
    const opts = field.options
      .map((o) => `<option value="${escapeAttr(o.value)}" ${o.value === value ? 'selected' : ''}>${o.label}</option>`)
      .join('');
    return `
      <label class="form-field" for="${id}">
        <span>${field.label}</span>
        <select id="${id}" name="${field.key}" ${req}>${opts}</select>
      </label>`;
  }

  if (field.type === 'checkbox') {
    return `
      <label class="form-field form-field--checkbox" for="${id}">
        <input type="checkbox" id="${id}" name="${field.key}" ${value ? 'checked' : ''} />
        <span>${field.label}</span>
      </label>`;
  }

  const step = field.type === 'number' ? `step="${field.step ?? 'any'}"` : '';
  return `
    <label class="form-field" for="${id}">
      <span>${field.label}</span>
      <input type="${field.type}" id="${id}" name="${field.key}" value="${escapeAttr(value)}"
        placeholder="${escapeAttr(field.placeholder || '')}" ${step} ${req} />
    </label>`;
}

export function renderForm(fields, values = {}) {
  return fields.map((f) => renderField(f, values[f.key])).join('');
}

export function collectFormData(formEl, fields) {
  const result = {};
  for (const field of fields) {
    const el = formEl.elements.namedItem(field.key);
    if (!el) continue;
    if (field.type === 'checkbox') result[field.key] = el.checked;
    else if (field.type === 'number') result[field.key] = el.value === '' ? null : Number(el.value);
    else result[field.key] = el.value;
  }
  return result;
}
