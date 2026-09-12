// Hash-based router. Chosen over the History API because GitHub Pages is a
// static host with no server-side rewrites - a History-API route would
// 404 on refresh/deep-link, while hash routes never touch the server at
// all (important for an app that must also work fully offline).
const routes = new Map();
let viewContainer = null;
let navContainer = null;

export function registerRoute(path, viewModule, navLabel) {
  routes.set(path, { viewModule, navLabel });
}

function currentPath() {
  const hash = location.hash.replace(/^#/, '');
  return routes.has(hash) ? hash : '/dashboard';
}

async function renderRoute() {
  const path = currentPath();
  const entry = routes.get(path);
  if (!entry) return;

  viewContainer.dispatchEvent(new Event('view:unmount'));
  viewContainer.innerHTML = '';
  await entry.viewModule.render(viewContainer);

  navContainer.querySelectorAll('[data-nav-link]').forEach((link) => {
    link.classList.toggle('is-active', link.getAttribute('href') === `#${path}`);
  });
  viewContainer.scrollTo(0, 0);
}

export function initRouter({ viewEl, navEl }) {
  viewContainer = viewEl;
  navContainer = navEl;
  navContainer.innerHTML = [...routes.entries()]
    .map(([path, { navLabel }]) => `<a href="#${path}" data-nav-link>${navLabel}</a>`)
    .join('');
  window.addEventListener('hashchange', renderRoute);
  if (!location.hash) location.hash = '#/dashboard';
  renderRoute();
}
