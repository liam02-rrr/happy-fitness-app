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
