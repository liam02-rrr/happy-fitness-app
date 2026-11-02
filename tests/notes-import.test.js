import { parseSetPart, parseSetToken, parseNotes, assignSetTypes } from '../js/import/notes-parser.js';
import { buildImport } from '../js/import/notes-import.js';
import { DEFAULT_SETTINGS } from '../js/models/settings.js';

const opts = { volumeRepsMin: 12 };
const sets = (text) => text.split(';').map((token) => parseSetToken(token));
const types = (text, type = 'weight', direction = 'up') => assignSetTypes(sets(text), type, { ...opts, direction }).join(',');

async function notesFile() {
  const response = await fetch('../import/notizen.txt');
  return response.text();
}

export default {
  'Satz: Gewicht × Wdh.'(assert) {
    const part = parseSetPart('40x8');
    assert.equal(part.weight, 40);
    assert.equal(part.reps[0], 8);
  },
  'Satz: Körpergewicht, Stufe, Band, Zeit'(assert) {
    assert.equal(parseSetPart('KGx12').bodyweight, true);
    assert.equal(parseSetPart('KG+10x8').weight, 10);
    assert.equal(parseSetPart('S11x6').level, 11);
    assert.equal(parseSetPart('Bx8').bandUnknown, true);
    assert.equal(parseSetPart('B12x8').level, 12);
    assert.equal(parseSetPart('30s').seconds, 30);
  },
  'Satz: Dezimalgewicht, RIR und Notiz'(assert) {
    const part = parseSetPart('22,5x10 @2 (langsam)');
    assert.equal(part.weight, 22.5);
    assert.equal(part.rir, 2);
    assert.equal(part.note, 'langsam');
  },
  'Satz: Komplex-Wiederholungen 12/10/10'(assert) {
    assert.equal(parseSetPart('8x12/10/10').reps.join('/'), '12/10/10');
  },
  'Drop-Kette und Aufwärm-Markierung'(assert) {
    const token = parseSetToken('A> 45x7 -> 35x5 -> 25x8');
    assert.equal(token.warmup, true);
    assert.equal(token.chain.length, 3);
    assert.equal(token.chain[2].weight, 25);
  },
  'Ungültiger Satz wird erkannt'(assert) {
    assert.ok(parseSetPart('40kg8').error);
    assert.ok(parseSetPart('40x8 @7').error);
  },
  'Satztypen: Volumensatz vor den schwersten Sätzen'(assert) {
    assert.equal(types('20x25 ; 40x6 ; 40x8 ; 40x6'), 'volume,intense,intense,intense');
    assert.equal(types('5x12 ; 10x10 ; 10x10'), 'volume,intense,intense');
  },
  'Satztypen: unter 12 Wdh. vor den schwersten Sätzen = Aufwärmen'(assert) {
    assert.equal(types('20x12 ; 40x8 ; 45x7'), 'warmup,warmup,intense');
  },
  'Satztypen: A> ist immer Aufwärmen'(assert) {
    assert.equal(types('A> 40x15 ; 40x8 ; 40x8'), 'warmup,intense,intense');
  },
  'Satztypen: Assistenz-Stufen, niedriger = schwerer'(assert) {
    assert.equal(types('S4x8 ; S4x8 ; S3x5 ; S3x4', 'assisted', 'down'), 'warmup,warmup,intense,intense');
  },
  'Satztypen: gleiche Last überall = alles intensiv'(assert) {
    assert.equal(types('KGx20 ; KGx10 ; KGx12', 'bodyweight'), 'intense,intense,intense');
    assert.equal(types('30s ; 25s ; 20s', 'time'), 'intense,intense,intense');
  },
  'Satztypen: leichterer Satz danach = Volumen'(assert) {
    assert.equal(types('40x8 ; 40x8 ; 30x12'), 'intense,intense,volume');
  },
  'Fehler mit Zeilennummern'(assert) {
    const { errors } = parseNotes('Liegestütz | koerpergewicht | chest | KGx10\n## 2026-13-45 | Brust\n## 2026-10-01 | Brust\nButterfly | maschine | chest | 30x12\nButterfly | gewicht | chest | 30y12');
    assert.equal(errors.length, 4);
    assert.equal(errors[0].line, 1);
    assert.equal(errors[1].line, 2);
    assert.equal(errors[2].line, 4);
    assert.equal(errors[3].line, 5);
  },
  'Gruppe ohne [/] wird gemeldet'(assert) {
    const { errors } = parseNotes('## 2026-10-01 | Beine\n[SUPERSET]\n+ A | gewicht | legs | 10x10\n+ B | gewicht | legs | 10x10');
    assert.equal(errors.length, 1);
    assert.equal(errors[0].line, 2);
  },
  'Komplex: Sätze nur bei der ersten Bewegung'(assert) {
    const { sessions, errors } = parseNotes('## 2026-10-01 | Schultern\n[KOMPLEX] KB\n+ Drücken | gewicht | shoulders | 8x12/10 ; 12x8/8\n+ Halo | gewicht | shoulders\n[/]');
    assert.equal(errors.length, 0);
    assert.equal(sessions[0].blocks[0].type, 'complex');
    assert.equal(sessions[0].blocks[0].items.length, 2);
  },
  async 'notizen.txt: 4 Trainings ohne Fehler'(assert) {
    const { sessions, errors } = parseNotes(await notesFile());
    assert.equal(errors.length, 0);
    assert.equal(sessions.length, 4);
    assert.equal(sessions.map((s) => s.date).join(','), '2026-10-18,2026-10-20,2026-10-23,2026-10-27');
    assert.equal(sessions[1].muscleGroups.join(','), 'chest,back');
  },
  async 'notizen.txt: Import legt 21 Übungen an'(assert) {
    const plan = buildImport(await notesFile(), { exercises: [], sessions: [], settings: DEFAULT_SETTINGS });
    assert.equal(plan.errors.length, 0);
    assert.equal(plan.newExercises.length, 21);
    assert.equal(plan.sessions.length, 4);
  },
  async 'notizen.txt: Klimmzug in Stufen, Dips ohne Bandstärke'(assert) {
    const plan = buildImport(await notesFile(), { exercises: [], sessions: [], settings: DEFAULT_SETTINGS });
    const pull = plan.newExercises.find((e) => e.name === 'Klimmzugmaschine');
    assert.equal(pull.location, 'oben');
    assert.equal(pull.steps.harderDirection, 'down');
    assert.equal(pull.steps.levels.length, 12);
    const dips = plan.newExercises.find((e) => e.name === 'Dips mit Band');
    assert.equal(dips.steps.levels.length, 0);
    assert.ok(plan.warnings.some((w) => w.message.includes('Bandstärken')));
  },
  async 'notizen.txt: Drop-Kette und Superset-Runden'(assert) {
    const plan = buildImport(await notesFile(), { exercises: [], sessions: [], settings: DEFAULT_SETTINGS });
    const front = plan.newExercises.find((e) => e.name === 'Front Raise Kabel');
    const frontEntry = plan.entries.find((e) => e.exerciseId === front.id);
    const frontSets = plan.sets.filter((s) => s.entryId === frontEntry.id);
    assert.equal(frontSets.map((s) => `${s.setType}:${s.weight}`).join(','), 'warmup:20,warmup:40,intense:45,drop:35,drop:25');
    assert.equal(frontSets[4].dropFrom, frontSets[3].id);

    const press = plan.newExercises.find((e) => e.name === 'KB Schulterdrücken');
    const pressEntry = plan.entries.find((e) => e.exerciseId === press.id);
    assert.equal(pressEntry.groupType, 'superset');
    assert.equal(pressEntry.groupPosition, 1);
    const halo = plan.entries.find((e) => e.groupId === pressEntry.groupId && e.groupPosition === 2);
    const haloSets = plan.sets.filter((s) => s.entryId === halo.id);
    assert.equal(haloSets[3].weight, 6);
    assert.equal(haloSets[3].reps, 12);
  },
  async 'notizen.txt: fehlender RIR = Standard-RIR, Notizen übernommen'(assert) {
    const plan = buildImport(await notesFile(), { exercises: [], sessions: [], settings: DEFAULT_SETTINGS });
    assert.ok(plan.sets.every((s) => s.rir === DEFAULT_SETTINGS.defaultRIR));
    const walk = plan.newExercises.find((e) => e.name === 'Walking Squat');
    assert.equal(plan.entries.find((e) => e.exerciseId === walk.id).note, 'mit Gewichtsscheibe');
    assert.ok(plan.sets.some((s) => s.note === 'langsam'));
  },
  async 'Erneuter Import überspringt vorhandene Trainings und nutzt bekannte Übungen'(assert) {
    const text = await notesFile();
    const first = buildImport(text, { exercises: [], sessions: [], settings: DEFAULT_SETTINGS });
    const second = buildImport(text, {
      exercises: first.newExercises,
      sessions: first.sessions.slice(0, 2).map((s) => s.record),
      settings: DEFAULT_SETTINGS,
    });
    assert.equal(second.newExercises.length, 0);
    assert.equal(second.sessions.length, 2);
    assert.equal(second.skipped.join(','), '2026-10-18,2026-10-20');
  },
};
