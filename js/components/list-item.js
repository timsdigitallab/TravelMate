// Generic list row markup, used by every module for a consistent look.
// Click handling is done via event delegation on the parent list by the
// caller (data-id / data-action attributes), not wired here.
export function renderListItem({ id, title, subtitle, badge, badgeVariant = 'neutral', meta, checkbox }) {
  return `
    <li class="list-item" data-id="${id}">
      ${
        checkbox
          ? `<input type="checkbox" class="list-item__checkbox" data-action="toggle" ${checkbox.checked ? 'checked' : ''} aria-label="Toggle" />`
          : ''
      }
      <div class="list-item__main" data-action="edit">
        <div class="list-item__title-row">
          <span class="list-item__title">${title}</span>
          ${badge ? `<span class="badge badge--${badgeVariant}">${badge}</span>` : ''}
        </div>
        ${subtitle ? `<div class="list-item__subtitle">${subtitle}</div>` : ''}
        ${meta ? `<div class="list-item__meta">${meta}</div>` : ''}
      </div>
      <button type="button" class="icon-button list-item__delete" data-action="delete" aria-label="Delete">&times;</button>
    </li>`;
}

export function renderEmptyState(message) {
  return `<li class="empty-state">${message}</li>`;
}
