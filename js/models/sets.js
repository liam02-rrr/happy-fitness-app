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

const sameVariant = (entry, variantId) => (entry.variantId ?? null) === (variantId ?? null);

// Frühere Ausführungen derselben Übung (und Variante) vor diesem Training, neueste zuerst.
// Bevorzugt der gleiche Kontext (allein/erste vs. vorermüdet, SPEC 7.1); gibt es dort nichts,
// der andere Kontext mit sameContext = false. Beim Nachtragen zählen nur Trainings bis zum Datum.
export async function executionHistory(exerciseId, groupPosition, currentSession, variantId = null, limit = 6) {
  const [sessions, entries] = await Promise.all([getAll('sessions'), getAllByIndex('entries', 'exerciseId', exerciseId)]);
  const done = new Map(sessions
    .filter((s) => s.status === 'done' && s.id !== currentSession.id && s.date <= currentSession.date)
    .map((s) => [s.id, s]));
  const candidates = entries
    .filter((entry) => done.has(entry.sessionId) && sameVariant(entry, variantId))
    .sort((a, b) => done.get(b.sessionId).date.localeCompare(done.get(a.sessionId).date));

  const wanted = (groupPosition ?? 1) >= 2;
  const same = candidates.filter((candidate) => isPreFatigued(candidate) === wanted);
  const sameContext = same.length > 0;
  const chosen = (sameContext ? same : candidates).slice(0, limit);

  const executions = [];
  for (const entry of chosen) {
    const sets = (await getSets(entry.id)).filter((set) => set.done);
    if (sets.length) executions.push({ entry, sets, session: done.get(entry.sessionId), sameContext });
  }
  return executions;
}

export async function lastExecution(exerciseId, groupPosition, currentSession, variantId = null) {
  return (await executionHistory(exerciseId, groupPosition, currentSession, variantId, 1))[0] ?? null;
}

// Zuletzt genutzte Variante einer Übung (null = Standard)
export async function lastVariant(exerciseId) {
  const [sessions, entries] = await Promise.all([getAll('sessions'), getAllByIndex('entries', 'exerciseId', exerciseId)]);
  const dates = new Map(sessions.filter((s) => s.status === 'done').map((s) => [s.id, s.date]));
  const latest = entries
    .filter((entry) => dates.has(entry.sessionId))
    .sort((a, b) => dates.get(b.sessionId).localeCompare(dates.get(a.sessionId)))[0];
  return latest?.variantId ?? null;
}

// Passender Satz vom letzten Mal: k-ter Satz desselben Typs, bei Drops gleiche Tiefe der Kette.
export function matchingLastSet(set, sets, lastSets) {
  if (!lastSets?.length) return null;
  const depth = dropDepth(set, sets);
  const head = depth === 0 ? set : sets.find((s) => s.id === chainHead(set, sets));
  const position = sets.filter((s) => !s.dropFrom && s.setType === head.setType).indexOf(head);
  // Sonst der Satz an derselben Stelle (z. B. letztes Mal ohne Aufwärmsatz)
  const lastHead = lastSets.filter((s) => !s.dropFrom && s.setType === head.setType)[position]
    ?? lastSets.filter((s) => !s.dropFrom)[sets.filter((s) => !s.dropFrom).indexOf(head)];
  if (!lastHead) return null;
  let match = lastHead;
  for (let i = 0; i < depth && match; i++) match = lastSets.find((s) => s.dropFrom === match.id);
  return match ?? null;
}

function chainHead(set, sets) {
  let current = set;
  while (current.dropFrom) current = sets.find((s) => s.id === current.dropFrom) ?? { id: current.dropFrom };
  return current.id;
}

// Startsätze aus einem Vorschlag des Algorithmus (Zielwerte vorausgefüllt, RIR offen)
export function setsFromSuggestion(entry, suggestion) {
  return suggestion.sets.map((planned, i) => ({
    id: newId(),
    entryId: entry.id,
    index: i + 1,
    setType: planned.setType,
    weight: planned.load?.weight ?? undefined,
    level: planned.load?.level ?? undefined,
    seconds: planned.load?.seconds ?? undefined,
    reps: planned.reps ?? undefined,
    targetRir: planned.rir ?? undefined,
    rir: null,
    done: false,
  }));
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
