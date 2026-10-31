// Trainings, Übungen im Training und Sätze (SPEC.md, Abschnitt 4.2–4.4)
import { getAll, getAllByIndex, get, put, remove, newId, openDB } from '../db.js';
import { todayISO } from '../ui/format.js';

export const TIME_MODES = [
  { id: 'short', label: 'Kurz' },
  { id: 'normal', label: 'Normal' },
  { id: 'long', label: 'Lang' },
];

export const FEELINGS = [
  { id: 'strong', label: 'Stark' },
  { id: 'normal', label: 'Normal' },
  { id: 'tired', label: 'Müde' },
  { id: 'weak', label: 'Schwach' },
];

export const ILLNESS = [
  { id: 'none', label: 'Keine' },
  { id: 'recent', label: 'Letzte 10 Tage angeschlagen' },
  { id: 'current', label: 'Aktuell leicht krank' },
];

export const GROUP_TYPES = [
  { id: 'superset', label: 'Superset' },
  { id: 'complex', label: 'Komplex' },
];

export function listSessions() {
  return getAll('sessions');
}

export async function getActiveSession() {
  const active = await getAllByIndex('sessions', 'status', 'active');
  return active.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

export async function getEntries(sessionId) {
  const entries = await getAllByIndex('entries', 'sessionId', sessionId);
  return entries.sort((a, b) => a.order - b.order);
}

export function getSession(id) {
  return get('sessions', id);
}

export function saveSession(session) {
  return put('sessions', session);
}

// Training mit Plan anlegen. blocks = [{ type: 'single'|'superset'|'complex', exerciseIds: [...] }]
// Nachgetragene Trainings bekommen ein eigenes Datum und den Status 'planned', bis sie gespeichert sind.
export async function startSession({ muscleGroups, timeMode, feeling, illness, date, status = 'active' }, blocks) {
  const session = {
    id: newId(),
    date: date ?? todayISO(),
    muscleGroups,
    timeMode,
    feeling,
    illness,
    note: '',
    status,
    source: 'app',
  };

  const entries = [];
  for (const block of blocks) {
    const grouped = block.type !== 'single' && block.exerciseIds.length > 1;
    const groupId = grouped ? newId() : undefined;
    block.exerciseIds.forEach((exerciseId, index) => {
      entries.push({
        id: newId(),
        sessionId: session.id,
        exerciseId,
        order: entries.length + 1,
        groupId,
        groupType: grouped ? block.type : undefined,
        groupPosition: grouped ? index + 1 : 1,
        note: '',
      });
    });
  }

  const db = await openDB();
  const tx = db.transaction(['sessions', 'entries'], 'readwrite');
  tx.objectStore('sessions').put(session);
  for (const entry of entries) tx.objectStore('entries').put(entry);
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  return session;
}

// Einzelne Übung an ein Training anhängen
export async function addEntry(sessionId, exerciseId, order) {
  const entry = { id: newId(), sessionId, exerciseId, order, groupPosition: 1, note: '' };
  await put('entries', entry);
  return entry;
}

// Training mit allen Übungen und Sätzen löschen
export async function deleteSession(id) {
  const entries = await getAllByIndex('entries', 'sessionId', id);
  for (const entry of entries) {
    const sets = await getAllByIndex('sets', 'entryId', entry.id);
    for (const set of sets) await remove('sets', set.id);
    await remove('entries', entry.id);
  }
  await remove('sessions', id);
}

// Datum der letzten Ausführung je Übung aus abgeschlossenen Trainings (immer berechnet)
export async function lastDoneByExercise() {
  const [sessions, entries] = await Promise.all([getAll('sessions'), getAll('entries')]);
  const sessionDate = new Map(sessions.filter((s) => s.status === 'done').map((s) => [s.id, s.date]));
  const last = new Map();
  for (const entry of entries) {
    const date = sessionDate.get(entry.sessionId);
    if (date && (!last.has(entry.exerciseId) || date > last.get(entry.exerciseId))) last.set(entry.exerciseId, date);
  }
  return last;
}
