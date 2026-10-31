// Vergleich einer Übung mit dem letzten Mal (für ▲●▼ in der Zusammenfassung).
// Reine Funktionen: keine DOM- oder Datenbankzugriffe.
// Phase 1 vergleicht den besten Arbeitssatz; das geschätzte 1RM (SPEC 7.3) folgt in Phase 2.

// Rang einer Stufe in Richtung „schwerer“ (0 = leichteste Stufe)
export function levelRank(level, steps) {
  const levels = steps?.levels ?? [];
  const index = levels.findIndex((entry) => String(entry) === String(level));
  if (index < 0) return null;
  return steps.harderDirection === 'down' ? levels.length - 1 - index : index;
}

// Leistung eines Satzes als vergleichbare Zahl, höher = besser. null, wenn nicht bewertbar.
export function setScore(set, exercise) {
  const { type, steps } = exercise;
  if (type === 'time') return set.seconds ?? null;
  if (set.reps == null) return null;

  if (Array.isArray(steps?.levels)) {
    const rank = levelRank(set.level, steps);
    return rank == null ? null : rank * 1000 + set.reps;
  }
  if (set.weight == null) return null;
  // Assistenz: weniger ist schwerer
  const load = type === 'assisted' ? -set.weight : set.weight;
  return load * 1000 + set.reps;
}

// Bester Arbeitssatz (ohne Aufwärmsätze) einer Ausführung
export function bestScore(sets, exercise) {
  const scores = sets
    .filter((set) => set.done && set.setType !== 'warmup')
    .map((set) => setScore(set, exercise))
    .filter((score) => score != null);
  return scores.length ? Math.max(...scores) : null;
}

// 1 = besser, 0 = gleich, -1 = schlechter, null = kein Vergleich möglich
export function compareToLast(currentSets, lastSets, exercise) {
  const current = bestScore(currentSets, exercise);
  const last = bestScore(lastSets ?? [], exercise);
  if (current == null || last == null) return null;
  return Math.sign(current - last);
}
