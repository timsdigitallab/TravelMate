// Generic modal dialog. Only one modal is ever open at a time.
let currentOverlay = null;

export function closeModal() {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
    document.removeEventListener('keydown', onKeydown);
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') closeModal();
}

// opts: { title, bodyHTML, submitLabel, onMount(bodyEl), onSubmit(formEl) }
export function openModal(opts) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${opts.title}">
      <div class="modal__header">
        <h2>${opts.title}</h2>
        <button type="button" class="icon-button" data-close aria-label="Close">&times;</button>
      </div>
      <form class="modal__body">${opts.bodyHTML}</form>
      <div class="modal__footer">
        <button type="button" class="button button--ghost" data-close>Cancel</button>
        <button type="submit" form="" class="button button--primary" data-submit>${opts.submitLabel || 'Save'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  currentOverlay = overlay;

  const form = overlay.querySelector('form.modal__body');
  const formId = `modal-form-${Date.now()}`;
  form.id = formId;
  overlay.querySelector('[data-submit]').setAttribute('form', formId);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', closeModal));
  document.addEventListener('keydown', onKeydown);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    opts.onSubmit?.(form);
  });

  opts.onMount?.(form);
  return { overlay, form };
}
