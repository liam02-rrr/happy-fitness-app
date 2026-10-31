// Anzeige-Formate (deutsch) und Eingabe-Umwandlung

// Heutiges Datum als JJJJ-MM-TT in Ortszeit
export function todayISO(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

// "2026-10-29" → "29. Okt. 2026"
export function formatDate(isoDate) {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return dateFormat.format(new Date(y, m - 1, d));
}

export function formatDateTime(isoString) {
  return dateTimeFormat.format(new Date(isoString));
}

export function formatNumber(value) {
  return numberFormat.format(value);
}

// "82,5" oder "82.5" → 82.5; ungültig → null
export function parseDecimal(text) {
  const value = Number(String(text).trim().replace(',', '.'));
  return text !== '' && Number.isFinite(value) ? value : null;
}

// Ganze Kalendertage seit einem Datum oder Zeitpunkt (Ortszeit)
export function daysSince(isoString, now = new Date()) {
  const dayNumber = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  };
  const day = isoString.length === 10 ? isoString : todayISO(new Date(isoString));
  return dayNumber(todayISO(now)) - dayNumber(day);
}

// "heute", "gestern", "vor 3 Tagen"
export function daysAgoLabel(isoString, now = new Date()) {
  const days = daysSince(isoString, now);
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}

export function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${formatNumber(Math.round(bytes / 1024 / 1024 * 10) / 10)} MB`;
}

// "1 Satz", "3 Sätze"
export function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}
