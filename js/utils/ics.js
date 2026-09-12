// Hand-rolled RFC 5545 .ics generator - zero dependencies, works fully
// offline. Used because reliable background push notifications (esp. on
// iOS PWAs) require a server this app deliberately doesn't have; the
// native calendar app is the dependable reminder mechanism instead.

function escapeText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function dateStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function dateOnly(iso) {
  return iso.replace(/-/g, '');
}

// events: [{ uid, title, description, date: 'YYYY-MM-DD', reminderDaysBefore }]
export function buildICS(events) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WAT Organizer//EN', 'CALSCALE:GREGORIAN'];
  const stamp = dateStamp();
  for (const ev of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.uid}@wat-organizer`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(ev.date)}`);
    lines.push(`SUMMARY:${escapeText(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    lines.push('BEGIN:VALARM');
    lines.push(`TRIGGER:-P${ev.reminderDaysBefore ?? 1}D`);
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${escapeText(ev.title)}`);
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
