// Vorschläge für eine Übung im Training: holt Historie, Körpergewicht und Tagesform aus der
// Datenbank und ruft den reinen Algorithmus auf (SPEC 7.1–7.6).
import { suggestExercise } from '../algorithm/progression.js';
import { executionHistory } from './sets.js';
import { withVariant } from './exercises.js';
import { getAll } from '../db.js';
import { SETTINGS_SCHEMA, readSetting } from './settings.js';

const THRESHOLD_KEYS = SETTINGS_SCHEMA.flatMap((group) => group.items.map((item) => item.key));

// Letzter Körpergewicht-Eintrag bis zum Trainingsdatum (SPEC 4.5)
export async function bodyweightOn(date) {
  const entries = (await getAll('bodyweight')).filter((entry) => entry.date <= date);
  return entries.sort((a, b) => b.date.localeCompare(a.date))[0]?.kg ?? null;
}

// Ändert sich etwas davon, wird ein noch nicht begonnener Vorschlag neu berechnet
export function suggestionKey({ settings, exercise, entry, session, isFirstInGroup }) {
  return JSON.stringify({
    thresholds: THRESHOLD_KEYS.map((key) => readSetting(settings, key)),
    steps: withVariant(exercise, entry.variantId ?? null).steps,
    repRanges: exercise.repRanges ?? null,
    type: exercise.type,
    variant: entry.variantId ?? null,
    groupPosition: entry.groupPosition ?? 1,
    feeling: session.feeling,
    illness: session.illness,
    first: isFirstInGroup,
  });
}

// Ist dies die erste Übung ihrer Muskelgruppe im Training? Dann gibt es einen Aufwärmsatz.
export function isFirstOfGroup(entry, entries, exerciseById) {
  const group = exerciseById.get(entry.exerciseId)?.muscleGroup;
  const first = [...entries].sort((a, b) => a.order - b.order).find((e) => exerciseById.get(e.exerciseId)?.muscleGroup === group);
  return first?.id === entry.id;
}

export async function suggestionFor({ exercise, entry, session, settings, isFirstInGroup }) {
  const variantId = entry.variantId ?? null;
  const executions = await executionHistory(exercise.id, entry.groupPosition, session, variantId);
  if (!executions.length) return null;
  const result = suggestExercise({
    exercise: withVariant(exercise, variantId),
    history: executions.map((execution) => ({ sets: execution.sets, suggestion: execution.entry.suggestion })),
    settings,
    sameContext: executions[0].sameContext,
    readiness: { feeling: session.feeling, illness: session.illness },
    isFirstInGroup,
    bodyweightKg: await bodyweightOn(session.date),
  });
  return result;
}
