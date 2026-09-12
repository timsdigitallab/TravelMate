// Date helpers. Dates are stored throughout the app as 'YYYY-MM-DD' strings
// (from <input type="date">) so string comparison already sorts correctly
// and there is no timezone ambiguity from storing Date objects.

export function todayISO() {
  return toISO(new Date());
}

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplay(iso) {
  if (!iso) return '';
  const d = parseISO(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Whole-day difference, target - today. Negative means overdue.
export function daysUntil(iso, fromISO = todayISO()) {
  const a = parseISO(fromISO);
  const b = parseISO(iso);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / msPerDay);
}

// Buckets a list of { date, ... } items by urgency relative to today.
// Returns { overdue, dueSoon, dueLater, later } each as an array of the
// original items, sorted ascending by date within each bucket.
export function bucketByDeadline(items, dateKey = 'date') {
  const buckets = { overdue: [], dueSoon: [], dueLater: [], later: [] };
  for (const item of items) {
    const iso = item[dateKey];
    if (!iso) continue;
    const diff = daysUntil(iso);
    if (diff < 0) buckets.overdue.push(item);
    else if (diff <= 7) buckets.dueSoon.push(item);
    else if (diff <= 30) buckets.dueLater.push(item);
    else buckets.later.push(item);
  }
  for (const key of Object.keys(buckets)) {
    buckets[key].sort((a, b) => (a[dateKey] < b[dateKey] ? -1 : 1));
  }
  return buckets;
}

// Counts distinct calendar dates (not rows, not hours) marked eligible for
// the second-year Working Holiday visa's regional work requirement.
export function countDistinctEligibleDays(workLogEntries) {
  const days = new Set();
  for (const entry of workLogEntries) {
    if (entry.isEligibleRegionalWork && entry.date) days.add(entry.date);
  }
  return days.size;
}
