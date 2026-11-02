// Leser für das Notizen-Format (SPEC.md, Abschnitt 9). Reine Funktionen: Text rein, Struktur raus.
// Fehler und Hinweise werden mit Zeilennummer gesammelt statt abzubrechen.
import { MUSCLE_GROUPS } from '../models/muscles.js';

const TYPES = {
  gewicht: 'weight',
  koerpergewicht: 'bodyweight',
  körpergewicht: 'bodyweight',
  assistiert: 'assisted',
  band: 'band',
  stufe: 'level',
  zeit: 'time',
};

const FEELINGS = { stark: 'strong', normal: 'normal', muede: 'tired', müde: 'tired', schwach: 'weak' };
const ILLNESS = {
  keine: 'none', none: 'none',
  angeschlagen: 'recent', letzte: 'recent', recent: 'recent',
  krank: 'current', aktuell: 'current', current: 'current',
};

// Muskelgruppe aus ID („legs“) oder deutschem Namen („Beine“)
export function parseGroup(text) {
  const value = text.trim().toLowerCase();
  return MUSCLE_GROUPS.find((group) => group.id === value || group.label.toLowerCase() === value)?.id ?? null;
}

const number = (text) => Number(text.replace(',', '.'));

// Ein Satz ohne Drop-Kette, z. B. „40x8“, „KGx12“, „S11x6“, „B12x8“, „30s“, „12x12/10/10“, jeweils mit „@2“ und „(Notiz)“
export function parseSetPart(raw) {
  let text = raw.trim();
  const part = { weight: null, level: null, bandUnknown: false, bodyweight: false, seconds: null, reps: null, rir: null, note: null };

  const note = text.match(/\(([^)]*)\)/);
  if (note) {
    part.note = note[1].trim() || null;
    text = text.replace(note[0], '').trim();
  }
  const rir = text.match(/@\s*(\d)\s*$/);
  if (rir) {
    part.rir = Number(rir[1]);
    if (part.rir > 5) return { error: `RIR ${part.rir} ist größer als 5` };
    text = text.slice(0, rir.index).trim();
  }

  const time = text.match(/^(\d+)\s*s$/i);
  if (time) {
    part.seconds = Number(time[1]);
    return part;
  }

  const match = text.match(/^(KG(?:\+(\d+(?:[.,]\d+)?))?|S(\d+)|B(\d+(?:[.,]\d+)?)?|(\d+(?:[.,]\d+)?))\s*x\s*(\d+(?:\/\d+)*)$/i);
  if (!match) return { error: `„${raw.trim()}“ ist kein gültiger Satz` };
  const [, load, extra, level, band, weight, reps] = match;

  if (/^KG/i.test(load)) {
    part.bodyweight = true;
    part.weight = extra ? number(extra) : 0;
  } else if (level) {
    part.level = Number(level);
  } else if (/^B/i.test(load)) {
    if (band) part.level = number(band);
    else part.bandUnknown = true;
  } else {
    part.weight = number(weight);
  }
  part.reps = reps.split('/').map(Number);
  return part;
}

// Ein Satz-Token inklusive „A>“ und Drop-Kette „45x7 -> 35x5 -> 25x8“
export function parseSetToken(raw) {
  let text = raw.trim();
  let warmup = false;
  if (/^A>/i.test(text)) {
    warmup = true;
    text = text.slice(2).trim();
  }
  const parts = text.split('->').map(parseSetPart);
  const failed = parts.find((part) => part.error);
  if (failed) return { error: failed.error };
  return { warmup, chain: parts };
}

// „Name [@ Ort] | typ | gruppe | Sätze | notiz=…“
function parseExerciseLine(text, line, errors, { allowNoSets = false } = {}) {
  const fields = text.split('|').map((field) => field.trim());
  const [nameField, typeField, groupField, setsField = '', ...rest] = fields;
  const result = { line, name: '', location: '', type: null, group: null, sets: [], note: '' };

  const [name, location = ''] = (nameField ?? '').split(/\s+@\s+/);
  result.name = name.trim();
  result.location = location.trim();
  if (!result.name) {
    errors.push({ line, message: 'Übungsname fehlt' });
    return null;
  }

  result.type = TYPES[(typeField ?? '').toLowerCase()];
  if (!result.type) {
    errors.push({ line, message: `Unbekannter Typ „${typeField ?? ''}“ (erlaubt: gewicht, koerpergewicht, assistiert, band, stufe, zeit)` });
    return null;
  }
  result.group = parseGroup(groupField ?? '');
  if (!result.group) {
    errors.push({ line, message: `Unbekannte Muskelgruppe „${groupField ?? ''}“` });
    return null;
  }

  // Notiz kann als viertes oder späteres Feld stehen
  const extraFields = [setsField, ...rest];
  const noteField = extraFields.find((field) => /^notiz\s*=/i.test(field));
  if (noteField) result.note = noteField.replace(/^notiz\s*=\s*/i, '');
  const setsText = /^notiz\s*=/i.test(setsField) ? '' : setsField;

  if (!setsText) {
    if (!allowNoSets) errors.push({ line, message: `„${result.name}“ hat keine Sätze` });
    return result;
  }

  for (const token of setsText.split(';').map((t) => t.trim()).filter(Boolean)) {
    const set = parseSetToken(token);
    if (set.error) {
      errors.push({ line, message: set.error });
      return null;
    }
    // Lasten müssen zum Typ passen
    for (const part of set.chain) {
      const problem = loadProblem(part, result.type);
      if (problem) {
        errors.push({ line, message: `${problem} („${token}“)` });
        return null;
      }
    }
    result.sets.push(set);
  }
  return result;
}

function loadProblem(part, type) {
  if (type === 'time') return part.seconds == null ? 'Zeit-Übungen brauchen Sekunden wie „30s“' : null;
  if (part.seconds != null) return 'Sekunden passen nur zum Typ „zeit“';
  if (type === 'band') return part.level == null && !part.bandUnknown ? 'Band-Übungen brauchen „B“ oder „B12“' : null;
  if (part.bandUnknown || (part.level != null && type !== 'assisted' && type !== 'level')) {
    return 'Stufe/Band passt nicht zu diesem Typ';
  }
  if (type === 'level' && part.level == null) return 'Stufen-Übungen brauchen „S11“';
  return null;
}

// Gesamten Text lesen
export function parseNotes(text) {
  const errors = [];
  const warnings = [];
  const sessions = [];
  let session = null;
  let group = null;

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const line = index + 1;
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    // Trainingskopf „## JJJJ-MM-TT | Gruppe[, Gruppe] | gefuehl=… | krankheit=…“
    if (trimmed.startsWith('##')) {
      if (group) {
        errors.push({ line: group.line, message: 'Gruppe wurde nicht mit [/] geschlossen' });
        group = null;
      }
      const [dateField, groupsField = '', ...options] = trimmed.slice(2).split('|').map((f) => f.trim());
      const dateMatch = dateField.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const valid = dateMatch && !Number.isNaN(new Date(`${dateField}T00:00`).getTime());
      if (!valid) {
        errors.push({ line, message: `Ungültiges Datum „${dateField}“ (Format JJJJ-MM-TT)` });
        session = null;
        return;
      }
      const muscleGroups = [];
      for (const name of groupsField.split(',').map((g) => g.trim()).filter(Boolean)) {
        const id = parseGroup(name);
        if (id) muscleGroups.push(id);
        else errors.push({ line, message: `Unbekannte Muskelgruppe „${name}“` });
      }
      session = { line, date: dateField, muscleGroups, feeling: 'normal', illness: 'none', blocks: [] };
      for (const option of options) {
        const [key, value = ''] = option.split('=').map((part) => part.trim().toLowerCase());
        if (key === 'gefuehl' || key === 'gefühl') {
          if (FEELINGS[value]) session.feeling = FEELINGS[value];
          else errors.push({ line, message: `Unbekanntes Gefühl „${value}“ (stark, normal, muede, schwach)` });
        } else if (key === 'krankheit') {
          const id = ILLNESS[value.split(/\s/)[0]];
          if (id) session.illness = id;
          else errors.push({ line, message: `Unbekannte Krankheit „${value}“ (keine, angeschlagen, krank)` });
        } else {
          warnings.push({ line, message: `Unbekannte Angabe „${option}“ wird ignoriert` });
        }
      }
      sessions.push(session);
      return;
    }

    // Kommentar
    if (trimmed.startsWith('#')) return;

    if (!session) {
      errors.push({ line, message: 'Zeile steht vor dem ersten Trainingskopf „## Datum | …“' });
      return;
    }

    // Gruppen: [SUPERSET] … [/] und [KOMPLEX] Name … [/]
    const groupStart = trimmed.match(/^\[(SUPERSET|KOMPLEX)\]\s*(.*)$/i);
    if (groupStart) {
      if (group) errors.push({ line: group.line, message: 'Gruppe wurde nicht mit [/] geschlossen' });
      const type = groupStart[1].toUpperCase() === 'SUPERSET' ? 'superset' : 'complex';
      group = { type, line, name: groupStart[2].trim(), items: [] };
      return;
    }
    if (trimmed === '[/]') {
      if (!group) {
        errors.push({ line, message: '[/] ohne geöffnete Gruppe' });
        return;
      }
      finishGroup(group, session, errors, warnings);
      group = null;
      return;
    }

    if (trimmed.startsWith('+')) {
      if (!group) {
        errors.push({ line, message: '„+“-Zeile steht außerhalb von [SUPERSET] oder [KOMPLEX]' });
        return;
      }
      const isFollower = group.type === 'complex' && group.items.length > 0;
      const item = parseExerciseLine(trimmed.slice(1).trim(), line, errors, { allowNoSets: isFollower });
      if (item) {
        if (isFollower && item.sets.length) warnings.push({ line, message: 'Im Komplex stehen Sätze nur bei der ersten Bewegung; diese Sätze werden ignoriert' });
        if (isFollower) item.sets = [];
        group.items.push(item);
      }
      return;
    }

    if (group) {
      errors.push({ line, message: 'In einer Gruppe muss jede Übung mit „+“ beginnen' });
      return;
    }
    const item = parseExerciseLine(trimmed, line, errors);
    if (item) session.blocks.push({ type: 'single', line, items: [item] });
  });

  if (group) errors.push({ line: group.line, message: 'Gruppe wurde nicht mit [/] geschlossen' });

  for (const s of sessions) {
    if (s.blocks.length === 0) warnings.push({ line: s.line, message: `Training vom ${s.date} enthält keine Übungen` });
  }
  return { sessions, errors, warnings };
}

function finishGroup(group, session, errors, warnings) {
  if (group.items.length < 2) {
    errors.push({ line: group.line, message: 'Eine Gruppe braucht mindestens zwei Übungen' });
    return;
  }
  if (group.type === 'complex') {
    const movements = group.items.length;
    for (const set of group.items[0].sets) {
      for (const part of set.chain) {
        if (part.reps && part.reps.length > movements) {
          errors.push({ line: group.items[0].line, message: `Mehr Wiederholungs-Angaben als Bewegungen (${part.reps.join('/')})` });
          return;
        }
        if (part.reps && part.reps.length < movements) {
          warnings.push({ line: group.items[0].line, message: `Nicht für jede Bewegung Wiederholungen angegeben (${part.reps.join('/')})` });
        }
      }
    }
  } else {
    const counts = group.items.map((item) => item.sets.length);
    if (new Set(counts).size > 1) {
      warnings.push({ line: group.line, message: `Unterschiedlich viele Sätze im Superset (${counts.join('/')}): Runden werden der Reihe nach zugeordnet` });
    }
  }
  session.blocks.push({ type: group.type, line: group.line, name: group.name, items: group.items });
}

// Vergleichswert einer Last, höher = schwerer. null = nicht vergleichbar.
function loadValue(part, type, direction) {
  if (type === 'time') return null;
  if (part.level != null) return direction === 'down' ? -part.level : part.level;
  if (part.weight != null) return type === 'assisted' ? -part.weight : part.weight;
  return null;
}

// Automatische Satztyp-Zuordnung (SPEC 9): schwerste Sätze = intensiv, der Satz direkt davor mit
// mindestens volumeRepsMin Wdh. = Volumen, alles davor = Aufwärmen. „A>“ ist immer Aufwärmen.
// Leichtere Sätze nach dem ersten Intensivsatz (Back-off) gelten als Volumen.
export function assignSetTypes(sets, type, { volumeRepsMin, direction = 'up' }) {
  const values = sets.map((set) => (set.warmup ? null : loadValue(set.chain[0], type, direction)));
  const comparable = values.filter((value) => value != null);
  const max = comparable.length ? Math.max(...comparable) : null;

  const types = sets.map((set, i) => {
    if (set.warmup) return 'warmup';
    return max == null || values[i] == null || values[i] === max ? 'intense' : null;
  });
  const firstIntense = types.indexOf('intense');
  return types.map((current, i) => {
    if (current) return current;
    if (i > firstIntense) return 'volume';
    const reps = sets[i].chain[0].reps?.[0] ?? 0;
    if (i === firstIntense - 1 && reps >= volumeRepsMin) return 'volume';
    return 'warmup';
  });
}
