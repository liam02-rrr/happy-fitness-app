// Übungen (SPEC.md, Abschnitt 4.1 und 4.7)
import { getAll, get, put, remove, getAllByIndex, newId } from '../db.js';

export const CATEGORIES = [
  { id: 'strength', label: 'Kraft' },
  { id: 'mobility', label: 'Mobility' },
];

export const EXERCISE_TYPES = [
  { id: 'weight', label: 'Gewicht' },
  { id: 'bodyweight', label: 'Körpergewicht' },
  { id: 'assisted', label: 'Assistiert' },
  { id: 'band', label: 'Band' },
  { id: 'level', label: 'Stufe' },
  { id: 'time', label: 'Zeit' },
];

export const SETUP_TIMES = [
  { id: 'short', label: 'Kurz' },
  { id: 'medium', label: 'Mittel' },
  { id: 'long', label: 'Lang' },
];

// Vorschläge für die Gewichtsstufen beim Anlegen (in kg)
export const DEFAULT_KG_STEPS = {
  weight: { min: 0, max: 200, step: 2.5 },
  bodyweight: { min: 0, max: 60, step: 2.5 },
  assisted: { min: 0, max: 80, step: 5 },
};

// Werden Stufen statt kg erfasst?
export function usesLevels(exercise) {
  return exercise.type === 'band' || exercise.type === 'level' || (exercise.type === 'assisted' && Array.isArray(exercise.steps?.levels));
}

export function newExercise(overrides = {}) {
  return {
    id: newId(),
    name: '',
    location: '',
    photo: null,
    category: 'strength',
    muscleGroup: 'chest',
    feel: [],
    type: 'weight',
    unilateral: false,
    steps: { ...DEFAULT_KG_STEPS.weight },
    setupTime: 'medium',
    setupNotes: '',
    backPlus: false,
    archived: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function listExercises() {
  return getAll('exercises');
}

export function getExercise(id) {
  return get('exercises', id);
}

export function saveExercise(exercise) {
  return put('exercises', exercise);
}

export function setArchived(exercise, archived) {
  return put('exercises', { ...exercise, archived });
}

// Löschen nur, wenn die Übung noch nie trainiert wurde (sonst archivieren)
export async function hasHistory(id) {
  return (await getAllByIndex('entries', 'exerciseId', id)).length > 0;
}

export async function deleteExercise(id) {
  if (await hasHistory(id)) throw new Error('Übung hat eine Historie und kann nur archiviert werden.');
  await remove('exercises', id);
}

// Anzeige „Latziehen · Phoenix“
export function displayName(exercise) {
  return exercise.location ? `${exercise.name} · ${exercise.location}` : exercise.name;
}

// ---- Varianten (z. B. verschiedene Kabeltürme oder Griffe einer Übung) ----
// Die Standard-Variante hat die id null und heißt wie der Ort der Übung. Jede Variante hat
// ihre eigene Historie, weil Gewichte zwischen Geräten nicht vergleichbar sind (SPEC 1).

export const DEFAULT_VARIANT_NAME = 'Standard';

export function variantsOf(exercise) {
  if (!exercise?.useVariants) return [];
  return [{ id: null, name: exercise.location || DEFAULT_VARIANT_NAME }, ...(exercise.variants ?? [])];
}

export function variantLabel(exercise, variantId) {
  if (!exercise?.useVariants) return exercise?.location ?? '';
  return variantsOf(exercise).find((variant) => variant.id === (variantId ?? null))?.name ?? '';
}

// Übung mit den Werten der gewählten Variante. Eine Variante kann eine eigene Erfassung haben
// (Typ und Stufen, z. B. Klimmzugmaschine einmal in kg, einmal in Stufen) oder nur einen eigenen Schritt.
export function withVariant(exercise, variantId) {
  const variant = (exercise.variants ?? []).find((v) => v.id === variantId);
  if (!variant) return exercise;
  if (variant.type) {
    return { ...exercise, location: variant.name, type: variant.type, steps: variant.steps ?? null };
  }
  return {
    ...exercise,
    location: variant.name,
    steps: variant.step && exercise.steps?.step != null ? { ...exercise.steps, step: variant.step } : exercise.steps,
  };
}

// Erfassung (Typ und Stufen) zweier Übungen gleich?
const sameRecording = (a, b) => a.type === b.type && Array.isArray(a.steps?.levels) === Array.isArray(b.steps?.levels);

// Anzeige mit Variante: „Cable Crunch · Life Fitness“
export function displayNameWithVariant(exercise, variantId) {
  const label = variantLabel(exercise, variantId);
  return label ? `${exercise.name} · ${label}` : exercise.name;
}

export async function addVariant(exercise, name) {
  const variant = { id: newId(), name: name.trim() };
  const updated = { ...exercise, useVariants: true, variants: [...(exercise.variants ?? []), variant] };
  await saveExercise(updated);
  return { exercise: updated, variant };
}

// Übung als Variante an eine andere hängen; die ganze Historie wandert mit
export async function mergeIntoVariant(source, target) {
  const variants = [...(target.variants ?? [])];
  const mapping = new Map();

  // Jede neue Variante behält die Erfassung, mit der ihre Historie aufgezeichnet wurde
  const add = (name, recorded) => {
    const variant = { id: newId(), name: name || source.name };
    if (!sameRecording(recorded, target)) {
      variant.type = recorded.type;
      variant.steps = recorded.steps ?? null;
    } else if (recorded.steps?.step != null && recorded.steps.step !== target.steps?.step) {
      variant.step = recorded.steps.step;
    }
    variants.push(variant);
    return variant.id;
  };
  mapping.set(null, add(source.location || source.name, source));
  for (const variant of source.variants ?? []) mapping.set(variant.id, add(variant.name, withVariant(source, variant.id)));

  const entries = await getAllByIndex('entries', 'exerciseId', source.id);
  for (const entry of entries) {
    await put('entries', { ...entry, exerciseId: target.id, variantId: mapping.get(entry.variantId ?? null) });
  }
  const updated = { ...target, useVariants: true, variants, photo: target.photo ?? source.photo };
  await saveExercise(updated);
  await remove('exercises', source.id);
  return updated;
}
