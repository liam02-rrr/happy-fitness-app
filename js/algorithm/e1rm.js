// Geschätztes 1RM und Leistungsindex (SPEC.md, Abschnitt 7.3). Reine Funktionen.
// Evidenz: Die Epley-Formel ist nur bis ca. 12 Wdh. brauchbar, deshalb die Grenze e1rmMaxReps.
import { isLevelBased } from './loads.js';

export function epley(load, reps) {
  return load * (1 + reps / 30);
}

// Effektive Last laut Tabelle 4.7. null = keine 1RM-Berechnung (ordinal oder Körpergewicht fehlt)
export function effectiveLoad(set, exercise, bodyweightKg) {
  const { type } = exercise;
  if (type === 'time' || type === 'band' || type === 'level' || isLevelBased(exercise)) return null;
  if (type === 'weight') return set.weight ?? null;
  if (bodyweightKg == null) return null;
  if (type === 'bodyweight') return bodyweightKg + (set.weight ?? 0);
  if (type === 'assisted') return set.weight == null ? null : bodyweightKg - set.weight;
  return null;
}

// Sätze für das 1RM: Intensivsätze; bei Altdaten ohne Satztypen die schwersten Sätze
function e1rmSets(sets, exercise, bodyweightKg) {
  const done = sets.filter((set) => set.done !== false && !set.dropFrom);
  const intense = done.filter((set) => set.setType === 'intense');
  if (intense.length) return intense;
  const loads = done.map((set) => effectiveLoad(set, exercise, bodyweightKg)).filter((load) => load != null);
  const max = Math.max(...loads);
  return done.filter((set) => effectiveLoad(set, exercise, bodyweightKg) === max);
}

// Bestwert einer Einheit = höchstes e1RM
export function sessionBestE1rm(sets, exercise, settings, bodyweightKg) {
  const values = e1rmSets(sets, exercise, bodyweightKg)
    .filter((set) => set.reps != null && set.reps > 0 && set.reps <= settings.e1rmMaxReps)
    .map((set) => {
      const load = effectiveLoad(set, exercise, bodyweightKg);
      return load == null || load <= 0 ? null : epley(load, set.reps);
    })
    .filter((value) => value != null);
  return values.length ? Math.max(...values) : null;
}

// Ordinale Typen: Score = Stufen-Rang × 100 + beste Wdh. bzw. Sekunden (nur Trend und Plateau)
export function ordinalScore(sets, exercise) {
  const done = sets.filter((set) => set.done !== false && set.setType !== 'warmup');
  if (exercise.type === 'time') {
    const seconds = done.map((set) => set.seconds).filter((value) => value != null);
    return seconds.length ? Math.max(...seconds) : null;
  }
  const levels = exercise.steps?.levels ?? [];
  const scores = done.map((set) => {
    const index = levels.findIndex((level) => String(level) === String(set.level));
    if (index < 0 || set.reps == null) return null;
    const rank = exercise.steps.harderDirection === 'down' ? levels.length - 1 - index : index;
    return rank * 100 + set.reps;
  }).filter((value) => value != null);
  return scores.length ? Math.max(...scores) : null;
}

// Leistungsindex = Bestwert / erster Bestwert × 100 (bests in zeitlicher Reihenfolge)
export function performanceIndex(bests) {
  const first = bests.find((value) => value != null && value > 0);
  return bests.map((value) => (value == null || first == null ? null : (value / first) * 100));
}
