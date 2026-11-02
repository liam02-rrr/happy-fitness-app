// Lasten auf der Stufenleiter einer Übung: schwerer/leichter, runden (SPEC 4.7 und 7.4).
// Reine Funktionen. Eine Last ist { weight } (kg), { level } (Stufe/Band) oder { seconds } (Zeit).

export const isLevelBased = (exercise) => Array.isArray(exercise.steps?.levels);

const round2 = (value) => Math.round(value * 100) / 100;

function clampKg(weight, steps) {
  const min = steps?.min ?? 0;
  const max = steps?.max ?? Infinity;
  return round2(Math.min(max, Math.max(min, weight)));
}

// Gewicht auf die nächste verfügbare Stufe runden. direction: 'down' | 'up' | 'nearest'
export function roundToStep(weight, steps, direction = 'nearest') {
  const step = steps?.step;
  if (weight == null || !step) return weight;
  const min = steps.min ?? 0;
  const units = (weight - min) / step;
  const rounded = direction === 'down' ? Math.floor(units + 1e-9)
    : direction === 'up' ? Math.ceil(units - 1e-9)
    : Math.round(units);
  return clampKg(min + rounded * step, steps);
}

// n Stufen schwerer (n < 0 = leichter). null = nicht möglich (z. B. Band ohne Stufenliste)
export function shiftLoad(load, exercise, n, settings) {
  if (n === 0) return { ...load };
  const { type, steps } = exercise;

  if (type === 'time') {
    if (load.seconds == null) return null;
    return { seconds: Math.max(settings.timeStep, load.seconds + n * settings.timeStep) };
  }

  if (isLevelBased(exercise)) {
    const levels = steps.levels;
    const index = levels.findIndex((level) => String(level) === String(load.level));
    if (index < 0 || levels.length === 0) return null;
    // „schwerer“ zeigt je nach Richtung zum Anfang oder Ende der Liste
    const delta = steps.harderDirection === 'down' ? -n : n;
    const next = Math.min(levels.length - 1, Math.max(0, index + delta));
    return { level: levels[next] };
  }

  if (load.weight == null || !steps?.step) return null;
  // Assistenz: schwerer = weniger Hilfe
  const delta = (type === 'assisted' ? -n : n) * steps.step;
  return { weight: clampKg(load.weight + delta, steps) };
}

// Gleiche Last? (für Teilsprünge und Vergleiche)
export function sameLoad(a, b) {
  return a?.weight === b?.weight && String(a?.level) === String(b?.level) && a?.seconds === b?.seconds;
}

// Rang einer Last, höher = schwerer. Zum Vergleich zweier Lasten derselben Übung.
export function loadRank(load, exercise) {
  if (exercise.type === 'time') return load.seconds ?? null;
  if (isLevelBased(exercise)) {
    const index = exercise.steps.levels.findIndex((level) => String(level) === String(load.level));
    if (index < 0) return null;
    return exercise.steps.harderDirection === 'down' ? -index : index;
  }
  if (load.weight == null) return null;
  return exercise.type === 'assisted' ? -load.weight : load.weight;
}

export const loadOf = (set) => {
  if (set.seconds != null) return { seconds: set.seconds };
  if (set.level != null) return { level: set.level };
  return { weight: set.weight ?? null };
};
