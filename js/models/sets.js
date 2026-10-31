// Sätze (SPEC.md, Abschnitt 4.4) und „Letztes Mal“ (SPEC 7.1)
import { getAll, getAllByIndex, put, remove, newId } from '../db.js';

export const SET_TYPES = [
  { id: 'warmup', label: 'Aufwärmen', short: 'A' },
  { id: 'volume', label: 'Volumen', short: 'V' },
  { id: 'intense', label: 'Intensiv', short: 'I' },
  { id: 'drop', label: 'Drop', short: 'D' },
];

// Hauptsätze nach index (bei Supersets = Runde), Drop-Ketten direkt dahinter
export function orderSets(sets) {
  const drops = new Map(sets.filter((set) => set.dropFrom).map((set) => [set.dropFrom, set]));
  const ordered = [];
  for (const main of sets.filter((set) => !set.dropFrom).sort((a, b) => a.index - b.index)) {
    ordered.push(main);
    for (let next = drops.get(main.id); next; next = drops.get(next.id)) ordered.push(next);
  }
  return ordered;
}

// Wie tief ein Satz in einer Drop-Kette steht (0 = Hauptsatz)
export function dropDepth(set, sets) {
  let depth = 0;
  for (let current = set; current.dropFrom; current = sets.find((s) => s.id === current.dropFrom) ?? {}) depth++;
  return depth;
}

export async function getSets(entryId) {
  return orderSets(await getAllByIndex('sets', 'entryId', entryId));
}

export function saveSet(set) {
  return put('sets', set);
}

// Satz löschen; anhängende Drops werden mitgelöscht
export async function deleteSet(set, allSets) {
  const chain = [set];
  for (let next = allSets.find((s) => s.dropFrom === set.id); next; next = allSets.find((s) => s.dropFrom === next.id)) chain.push(next);
  for (const item of chain) await remove('sets', item.id);
}

const isPreFatigued = (entry) => (entry.groupPosition ?? 1) >= 2;

// Letzte Ausführung derselben Übung, bevorzugt im gleichen Kontext (allein/erste vs. vorermüdet)
export async function lastExecution(exerciseId, groupPosition, currentSessionId) {
  const [sessions, entries] = await Promise.all([getAll('sessions'), getAllByIndex('entries', 'exerciseId', exerciseId)]);
  const done = new Map(sessions.filter((s) => s.status === 'done' && s.id !== currentSessionId).map((s) => [s.id, s]));
  const candidates = entries
    .filter((entry) => done.has(entry.sessionId))
    .sort((a, b) => done.get(b.sessionId).date.localeCompare(done.get(a.sessionId).date));

  const wanted = (groupPosition ?? 1) >= 2;
  const entry = candidates.find((candidate) => isPreFatigued(candidate) === wanted) ?? candidates[0];
  if (!entry) return null;

  const sets = (await getSets(entry.id)).filter((set) => set.done);
  return { entry, sets, session: done.get(entry.sessionId), sameContext: isPreFatigued(entry) === wanted };
}

// Startsätze für eine Übung im Training: Werte vom letzten Mal, sonst leeres Standardschema (SPEC 7.2)
export function initialSets(entry, last, settings) {
  if (last?.sets.length) {
    const idMap = new Map(last.sets.map((set) => [set.id, newId()]));
    return last.sets.map((set) => ({
      id: idMap.get(set.id),
      entryId: entry.id,
      index: set.index,
      setType: set.setType,
      dropFrom: set.dropFrom ? idMap.get(set.dropFrom) : undefined,
      weight: set.weight,
      level: set.level,
      reps: set.reps,
      seconds: set.seconds,
      rir: null,
      done: false,
    }));
  }

  const types = ['warmup', 'volume', ...Array(settings.intenseSets).fill('intense')];
  return types.map((setType, i) => ({
    id: newId(),
    entryId: entry.id,
    index: i + 1,
    setType,
    rir: null,
    done: false,
  }));
}

// Kurzform eines Satzes für „Letztes Mal“, z. B. „40 × 8“, „S4 × 6“, „30 s“
export function formatSet(set, exercise, formatNumber) {
  if (exercise.type === 'time') return set.seconds != null ? `${set.seconds} s` : '–';
  const load = Array.isArray(exercise.steps?.levels)
    ? (set.level != null ? `${exercise.type === 'band' ? 'B' : 'S'}${set.level}` : '–')
    : exercise.type === 'bodyweight'
      ? (set.weight ? `KG+${formatNumber(set.weight)}` : 'KG')
      : (set.weight != null ? formatNumber(set.weight) : '–');
  return `${load} × ${set.reps ?? '–'}`;
}
