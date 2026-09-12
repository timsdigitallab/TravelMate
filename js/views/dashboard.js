import { getAll, get } from '../db.js';
import { STORES } from '../schema.js';
import { formatDisplay, bucketByDeadline, countDistinctEligibleDays, daysUntil } from '../utils/date.js';
import { buildICS } from '../utils/ics.js';
import { triggerDownload } from '../utils/files.js';
import { on } from '../state.js';

const BUCKET_LABELS = { overdue: 'Overdue', dueSoon: 'Due within 7 days', dueLater: 'Due within 30 days', later: 'Later' };

function deadlineRow(item) {
  return `
    <li class="list-item">
      <a class="list-item__main" href="#/${item.route}">
        <div class="list-item__title-row"><span class="list-item__title">${item.title}</span></div>
        <div class="list-item__subtitle">${formatDisplay(item.date)}</div>
      </a>
    </li>`;
}

async function loadDeadlineItems() {
  const [visaItems, jobApplications] = await Promise.all([getAll(STORES.visaItems), getAll(STORES.jobApplications)]);
  const items = [
    ...visaItems
      .filter((v) => v.deadlineDate && v.status !== 'done')
      .map((v) => ({ date: v.deadlineDate, title: `Visa: ${v.title}`, uid: `visa-${v.id}`, route: 'visa' })),
    ...jobApplications
      .filter((j) => j.followUpDate)
      .map((j) => ({ date: j.followUpDate, title: `Follow up: ${j.company}`, uid: `job-${j.id}`, route: 'jobs' })),
  ];
  return items;
}

async function renderDeadlines(container) {
  const items = await loadDeadlineItems();
  const buckets = bucketByDeadline(items, 'date');
  const sections = ['overdue', 'dueSoon', 'dueLater', 'later']
    .filter((key) => buckets[key].length)
    .map((key) => `<h3>${BUCKET_LABELS[key]}</h3><ul class="list">${buckets[key].map(deadlineRow).join('')}</ul>`)
    .join('');
  container.innerHTML = `
    <div class="view-header">
      <h2>Upcoming deadlines</h2>
      <button type="button" class="button button--ghost" data-export-ics ${items.length ? '' : 'disabled'}>Export to calendar</button>
    </div>
    ${sections || '<p class="empty-state">No deadlines tracked yet.</p>'}`;

  container.querySelector('[data-export-ics]')?.addEventListener('click', () => {
    const ics = buildICS(items.map((i) => ({ uid: i.uid, title: i.title, date: i.date, reminderDaysBefore: 1 })));
    triggerDownload(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'wat-organizer-deadlines.ics');
  });
}

async function renderNextStops(container) {
  const legs = (await getAll(STORES.tripLegs))
    .filter((l) => l.status !== 'done' && l.plannedStartDate)
    .sort((a, b) => a.plannedStartDate.localeCompare(b.plannedStartDate))
    .slice(0, 3);
  container.innerHTML = `
    <h2>Next stops</h2>
    ${
      legs.length
        ? `<ul class="list">${legs
            .map(
              (l) => `<li class="list-item"><a class="list-item__main" href="#/trip">
                <div class="list-item__title-row"><span class="list-item__title">${l.locationName}</span></div>
                <div class="list-item__subtitle">${formatDisplay(l.plannedStartDate)}</div></a></li>`
            )
            .join('')}</ul>`
        : '<p class="empty-state">No upcoming stops planned yet.</p>'
    }`;
}

async function renderWorkProgress(container) {
  const entries = await getAll(STORES.workLogEntries);
  const days = countDistinctEligibleDays(entries);
  const pct = Math.min(100, Math.round((days / 88) * 100));
  container.innerHTML = `
    <h2>88-day regional work</h2>
    <div class="progress-card">
      <div class="progress-card__label"><strong>${days} / 88 days</strong></div>
      <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct}%"></div></div>
    </div>`;
}

async function renderBackupNudge(container) {
  const setting = await get(STORES.settings, 'lastBackupDate');
  const lastBackup = setting?.value;
  const daysSince = lastBackup ? -daysUntil(lastBackup.slice(0, 10)) : null;
  if (daysSince === null || daysSince > 14) {
    container.innerHTML = `
      <div class="callout callout--warning">
        <p>${lastBackup ? `Last backup was ${daysSince} days ago.` : "You haven't backed up your data yet."} Your data lives only on this device.</p>
        <a class="button button--ghost" href="#/settings">Back up now</a>
      </div>`;
  } else {
    container.innerHTML = '';
  }
}

async function render(container) {
  container.innerHTML = `
    <h1>Dashboard</h1>
    <div data-backup-nudge></div>
    <div data-work-progress></div>
    <div data-next-stops></div>
    <div data-deadlines></div>`;

  const refs = {
    backup: container.querySelector('[data-backup-nudge]'),
    work: container.querySelector('[data-work-progress]'),
    stops: container.querySelector('[data-next-stops]'),
    deadlines: container.querySelector('[data-deadlines]'),
  };

  await Promise.all([renderBackupNudge(refs.backup), renderWorkProgress(refs.work), renderNextStops(refs.stops), renderDeadlines(refs.deadlines)]);

  const unsubscribe = on('data:changed', () => {
    renderBackupNudge(refs.backup);
    renderWorkProgress(refs.work);
    renderNextStops(refs.stops);
    renderDeadlines(refs.deadlines);
  });
  container.addEventListener('view:unmount', unsubscribe, { once: true });
}

export default { render };
