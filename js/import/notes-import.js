// Notizen-Import (SPEC.md, Abschnitt 9): gelesene Notizen in Übungen, Trainings und Sätze umwandeln.
// buildImport ist rein (testbar), commitImport schreibt nach einer automatischen internen Sicherung.
import { parseNotes, assignSetTypes } from './notes-parser.js';
import { DEFAULT_KG_STEPS } from '../models/exercises.js';
import { newId, writeAll, saveInternalBackup } from '../db.js';

// Standard-Richtung „schwerer“ für Stufen: Assistenz und Band leichter = schwerer, Stufe höher = schwerer
const LEVEL_DIRECTION = { assisted: 'down', band: 'down', level: 'up' };
const MIN_LEVEL_COUNT = 12;

const exerciseKey = (name, location) => `${name.trim().toLowerCase()}|${(location ?? '').trim().toLowerCase()}`;

// Stufenliste für neue Übungen aus den Werten in der Datei
function levelsFor(type, observed) {
  const values = [...new Set(observed)].sort((a, b) => a - b);
  if (type === 'band') return values.length >= 2 ? values : [];
  const top = Math.max(MIN_LEVEL_COUNT, ...values);
  return Array.from({ length: top }, (_, i) => i + 1);
}

export function buildImport(text, { exercises, sessions, settings, now = new Date().toISOString() }) {
  const parsed = parseNotes(text);
  const warnings = [...parsed.warnings];
  const known = new Map(exercises.map((exercise) => [exerciseKey(exercise.name, exercise.location), exercise]));
  const created = new Map();
  const importedDates = new Set(sessions.filter((s) => s.source === 'import').map((s) => s.date));

  // Alle Stufenwerte je Übung sammeln, um die Stufenliste neuer Übungen zu bestimmen
  const observedLevels = new Map();
  const usesLevels = new Map();
  for (const session of parsed.sessions) {
    for (const block of session.blocks) {
      for (const item of block.items) {
        const key = exerciseKey(item.name, item.location);
        for (const set of item.sets) {
          for (const part of set.chain) {
            if (part.level != null) observedLevels.set(key, [...(observedLevels.get(key) ?? []), part.level]);
            if (part.level != null || part.bandUnknown) usesLevels.set(key, true);
          }
        }
      }
    }
  }

  function resolveExercise(item) {
    const key = exerciseKey(item.name, item.location);
    const existing = known.get(key) ?? created.get(key);
    if (existing) {
      if (existing.type !== item.type && known.has(key)) {
        warnings.push({ line: item.line, message: `„${item.name}“ ist in der App als anderer Typ angelegt; die Sätze werden trotzdem zugeordnet` });
      }
      return existing;
    }
    const levelBased = item.type === 'band' || item.type === 'level' || (item.type === 'assisted' && usesLevels.get(key));
    const steps = item.type === 'time' ? null
      : levelBased ? { levels: levelsFor(item.type, observedLevels.get(key) ?? []), harderDirection: LEVEL_DIRECTION[item.type] }
      : { ...DEFAULT_KG_STEPS[item.type] };
    if (item.type === 'band' && steps.levels.length === 0) {
      warnings.push({ line: item.line, message: `„${item.name}“: Bandstärken unbekannt – bitte in der Übung eintragen` });
    }
    const exercise = {
      id: newId(),
      name: item.name,
      location: item.location,
      photo: null,
      category: 'strength',
      muscleGroup: item.group,
      feel: [],
      type: item.type,
      unilateral: false,
      steps,
      setupTime: 'medium',
      setupNotes: '',
      backPlus: false,
      archived: false,
      createdAt: now,
    };
    created.set(key, exercise);
    return exercise;
  }

  // Sätze einer Übung als Datensätze; repsAt wählt bei Komplexen die Wiederholungen der Bewegung
  function buildSets(entry, item, exercise, repsAt = 0, template = item) {
    const direction = exercise.steps?.harderDirection ?? 'up';
    const types = assignSetTypes(template.sets, exercise.type, { volumeRepsMin: settings.volumeRange.min, direction });
    const records = [];
    template.sets.forEach((set, i) => {
      let previous = null;
      set.chain.forEach((part, depth) => {
        const record = {
          id: newId(),
          entryId: entry.id,
          index: i + 1,
          setType: depth === 0 ? types[i] : 'drop',
          dropFrom: previous?.id,
          weight: part.weight ?? undefined,
          level: part.level ?? undefined,
          reps: part.reps?.[repsAt] ?? null,
          seconds: part.seconds ?? undefined,
          rir: part.rir ?? settings.defaultRIR,
          note: part.note ?? undefined,
          done: true,
        };
        records.push(record);
        previous = record;
      });
    });
    return records;
  }

  const result = { sessions: [], entries: [], sets: [], skipped: [] };

  for (const parsedSession of parsed.sessions) {
    if (importedDates.has(parsedSession.date)) {
      result.skipped.push(parsedSession.date);
      warnings.push({ line: parsedSession.line, message: `Training vom ${parsedSession.date} wurde schon importiert und wird übersprungen` });
      continue;
    }
    const session = {
      id: newId(),
      date: parsedSession.date,
      muscleGroups: parsedSession.muscleGroups,
      timeMode: 'normal',
      feeling: parsedSession.feeling,
      illness: parsedSession.illness,
      note: '',
      status: 'done',
      source: 'import',
    };
    const preview = { date: session.date, feeling: session.feeling, illness: session.illness, muscleGroups: session.muscleGroups, blocks: [] };
    let order = 0;

    for (const block of parsedSession.blocks) {
      const grouped = block.type !== 'single';
      const groupId = grouped ? newId() : undefined;
      const previewBlock = { type: block.type, items: [] };

      block.items.forEach((item, position) => {
        const exercise = resolveExercise(item);
        const entry = {
          id: newId(),
          sessionId: session.id,
          exerciseId: exercise.id,
          order: ++order,
          groupId,
          groupType: grouped ? block.type : undefined,
          groupPosition: grouped ? position + 1 : 1,
          note: item.note,
        };
        // Komplex: Sätze stehen bei der ersten Bewegung, Wiederholungen je Bewegung
        const sets = block.type === 'complex'
          ? buildSets(entry, item, exercise, position, block.items[0])
          : buildSets(entry, item, exercise);
        result.entries.push(entry);
        result.sets.push(...sets);
        previewBlock.items.push({ exercise, isNew: created.has(exerciseKey(item.name, item.location)), sets, note: item.note });
      });
      preview.blocks.push(previewBlock);
    }
    result.sessions.push({ record: session, preview });
  }

  return {
    errors: parsed.errors,
    warnings,
    newExercises: [...created.values()],
    sessions: result.sessions,
    entries: result.entries,
    sets: result.sets,
    skipped: result.skipped,
  };
}

export async function commitImport(plan) {
  await saveInternalBackup('Vor Notizen-Import');
  await writeAll({
    exercises: plan.newExercises,
    sessions: plan.sessions.map((s) => s.record),
    entries: plan.entries,
    sets: plan.sets,
  }, { replace: false });
}
