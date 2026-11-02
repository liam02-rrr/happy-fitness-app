import { shiftLoad, roundToStep } from '../js/algorithm/loads.js';
import { epley, effectiveLoad, sessionBestE1rm, ordinalScore, performanceIndex } from '../js/algorithm/e1rm.js';
import { jumpStrategy } from '../js/algorithm/jumps.js';
import { readinessEffects } from '../js/algorithm/readiness.js';
import { suggestExercise } from '../js/algorithm/progression.js';
import { DEFAULT_SETTINGS as S } from '../js/models/settings.js';

const machine = (step = 2.5) => ({ type: 'weight', steps: { min: 0, max: 300, step } });
const pull = { type: 'assisted', steps: { levels: [1, 2, 3, 4, 5, 6], harderDirection: 'down' } };
const assistKg = { type: 'assisted', steps: { min: 0, max: 60, step: 5 } };
const hang = { type: 'time', steps: null };

let id = 0;
const set = (setType, weight, reps, extra = {}) => ({ id: `s${++id}`, setType, weight, reps, rir: null, done: true, ...extra });
const session = (...sets) => ({ sets });
const loads = (result, type = 'intense') => result.sets.filter((s) => s.setType === type).map((s) => s.load.weight ?? s.load.level ?? s.load.seconds);
const targets = (result, type = 'intense') => result.sets.filter((s) => s.setType === type).map((s) => s.reps);
const suggest = (exercise, history, extra = {}) => suggestExercise({ exercise, history, settings: S, ...extra });

export default {
  // ---- Stufenleiter ----
  'Stufen: kg schwerer und leichter'(assert) {
    assert.equal(shiftLoad({ weight: 40 }, machine(5), 1, S).weight, 45);
    assert.equal(shiftLoad({ weight: 40 }, machine(5), -2, S).weight, 30);
  },
  'Stufen: Assistenz schwerer = weniger Hilfe'(assert) {
    assert.equal(shiftLoad({ weight: 20 }, assistKg, 1, S).weight, 15);
  },
  'Stufen: Liste „niedriger = schwerer“'(assert) {
    assert.equal(shiftLoad({ level: 3 }, pull, 1, S).level, 2);
    assert.equal(shiftLoad({ level: 1 }, pull, 1, S).level, 1);
  },
  'Stufen: Runden auf verfügbare Gewichte'(assert) {
    assert.equal(roundToStep(37, { min: 0, step: 5 }, 'down'), 35);
    assert.equal(roundToStep(56.4, { min: 0, step: 2.5 }, 'nearest'), 57.5);
    assert.equal(roundToStep(22, { min: 4, step: 4 }, 'down'), 20);
  },

  // ---- 1RM (7.3) ----
  '1RM: Epley'(assert) {
    assert.equal(Math.round(epley(100, 10) * 100) / 100, 133.33);
  },
  '1RM: effektive Last bei Körpergewicht und Assistenz'(assert) {
    assert.equal(effectiveLoad({ weight: 10 }, { type: 'bodyweight' }, 80), 90);
    assert.equal(effectiveLoad({ weight: 20 }, assistKg, 80), 60);
    assert.equal(effectiveLoad({ weight: 10 }, { type: 'bodyweight' }, null), null);
    assert.equal(effectiveLoad({ level: 3 }, pull, 80), null);
  },
  '1RM: nur Intensivsätze bis 12 Wdh.'(assert) {
    const best = sessionBestE1rm([set('volume', 30, 15), set('intense', 40, 8), set('intense', 40, 6)], machine(), S, null);
    assert.equal(Math.round(best * 100) / 100, 50.67);
    assert.equal(sessionBestE1rm([set('intense', 20, 20)], machine(), S, null), null);
  },
  'Ordinaler Score und Leistungsindex'(assert) {
    assert.equal(ordinalScore([set('intense', null, 6, { level: 3 })], pull), 306);
    assert.equal(performanceIndex([100, 110, null]).map((v) => v && Math.round(v)).join(','), '100,110,');
  },

  // ---- Sprung-Strategie (7.5) ----
  'Sprung: klein = normal, mittel = Wdh. sammeln, groß = Teilsprung'(assert) {
    assert.equal(jumpStrategy(2.5, 126.7, S).strategy, 'normal');
    assert.equal(jumpStrategy(5, 50.67, S).strategy, 'extend');
    assert.equal(jumpStrategy(10, 50.67, S).strategy, 'partial');
    assert.equal(jumpStrategy(5, null, S).strategy, 'normal');
  },

  // ---- Tagesform (7.6) ----
  'Tagesform: Wirkungen kombinieren sich'(assert) {
    const tired = readinessEffects({ feeling: 'tired' }, S);
    assert.equal(tired.rirBonus, 1);
    assert.equal(tired.allowDouble, false);
    const both = readinessEffects({ feeling: 'weak', illness: 'recent' }, S);
    assert.equal(both.loadReductionPct, 17.5);
    assert.equal(both.intenseDelta + both.setsPerExerciseDelta, -2);
    assert.equal(readinessEffects({ illness: 'current' }, S).noIntense, true);
    assert.equal(readinessEffects({ feeling: 'strong' }, S).reduced, false);
  },

  // ---- Progression (7.2, 7.4) ----
  'Ohne Historie kein Vorschlag'(assert) {
    assert.equal(suggest(machine(), []), null);
  },
  'Obergrenze in allen Intensivsätzen → eine Stufe schwerer, Ziel Untergrenze'(assert) {
    const r = suggest(machine(), [session(set('volume', 70, 13), set('intense', 100, 8), set('intense', 100, 8), set('intense', 100, 8))]);
    assert.equal(loads(r).join(','), '102.5,102.5,102.5');
    assert.equal(targets(r).join(','), '6,6,6');
    assert.ok(r.reason.includes('102,5 kg'), r.reason);
  },
  'Hoher RIR → Doppelsprung, außer bei Müdigkeit'(assert) {
    const history = [session(set('intense', 100, 8, { rir: 3 }), set('intense', 100, 8, { rir: 3 }), set('intense', 100, 8, { rir: 3 }))];
    assert.equal(loads(suggest(machine(), history))[0], 105);
    assert.equal(loads(suggest(machine(), history, { readiness: { feeling: 'tired' } }))[0], 102.5);
  },
  'Fehlender RIR zählt als Standard-RIR (kein Doppelsprung)'(assert) {
    const r = suggest(machine(), [session(set('intense', 100, 8), set('intense', 100, 8), set('intense', 100, 8))]);
    assert.equal(loads(r)[0], 102.5);
  },
  'Mittlerer Sprung → erst Wdh. sammeln, dann steigern'(assert) {
    const r = suggest(machine(5), [session(set('intense', 40, 8), set('intense', 40, 8), set('intense', 40, 8))]);
    assert.equal(loads(r).join(','), '40,40,40');
    assert.equal(targets(r).join(','), '9,9,9');
    assert.ok(r.reason.includes('sammeln'), r.reason);
    const r2 = suggest(machine(5), [session(set('intense', 40, 10), set('intense', 40, 10), set('intense', 40, 10))]);
    assert.equal(loads(r2).join(','), '45,45,45');
  },
  'Großer Sprung → Teilsprung mit einem Satz'(assert) {
    const r = suggest(machine(10), [session(set('intense', 40, 8), set('intense', 40, 8), set('intense', 40, 8))]);
    assert.equal(loads(r).join(','), '50,40,40');
    assert.equal(targets(r).join(','), '6,8,8');
  },
  'Teilsprung: Untergrenze geschafft → ein Satz mehr mit neuer Last'(assert) {
    const r = suggest(machine(10), [session(set('intense', 50, 6), set('intense', 40, 8), set('intense', 40, 8))]);
    assert.equal(loads(r).join(','), '50,50,40');
    const stuck = suggest(machine(10), [session(set('intense', 50, 5), set('intense', 40, 8), set('intense', 40, 8))]);
    assert.equal(loads(stuck).join(','), '50,40,40');
    const complete = suggest(machine(10), [session(set('intense', 50, 6), set('intense', 50, 6), set('intense', 40, 8))]);
    assert.equal(loads(complete).join(','), '50,50,50');
    assert.ok(complete.reason.includes('alle Sätze'), complete.reason);
  },
  'Unter Untergrenze → halten, nach 2× in Folge eine Stufe leichter'(assert) {
    const fail = session(set('intense', 100, 5), set('intense', 100, 4), set('intense', 100, 4));
    assert.equal(loads(suggest(machine(), [fail]))[0], 100);
    const ok = session(set('intense', 100, 7), set('intense', 100, 6), set('intense', 100, 6));
    assert.equal(loads(suggest(machine(), [fail, ok]))[0], 100);
    const r = suggest(machine(), [fail, fail]);
    assert.equal(loads(r).join(','), '97.5,97.5,97.5');
    assert.ok(r.reason.includes('leichter'), r.reason);
  },
  'Dazwischen → Gewicht halten, +1 Wdh. im schwächsten Satz'(assert) {
    const r = suggest(machine(), [session(set('intense', 100, 7), set('intense', 100, 7), set('intense', 100, 6))]);
    assert.equal(loads(r).join(','), '100,100,100');
    assert.equal(targets(r).join(','), '7,7,7');
  },
  'Volumensatz: Obergrenze → schwerer, sonst +1 Wdh.'(assert) {
    const up = suggest(machine(), [session(set('volume', 60, 15), set('intense', 100, 7))]);
    assert.equal(loads(up, 'volume')[0], 62.5);
    assert.equal(targets(up, 'volume')[0], 12);
    const hold = suggest(machine(), [session(set('volume', 60, 13), set('intense', 100, 7))]);
    assert.equal(loads(hold, 'volume')[0], 60);
    assert.equal(targets(hold, 'volume')[0], 14);
  },
  'Aufwärmsatz: 55 % des Intensivgewichts, nur bei erster Übung der Gruppe'(assert) {
    const history = [session(set('intense', 100, 7), set('intense', 100, 7))];
    assert.equal(loads(suggest(machine(), history), 'warmup')[0], 55);
    assert.equal(suggest(machine(), history, { isFirstInGroup: false }).sets.some((s) => s.setType === 'warmup'), false);
  },
  'Anzahl Intensivsätze und Ziel-RIR aus den Einstellungen'(assert) {
    const r = suggest(machine(), [session(set('intense', 100, 7))]);
    assert.equal(loads(r).length, S.intenseSets);
    assert.ok(r.sets.filter((s) => s.setType === 'intense').every((s) => s.rir === S.intenseRIR));
    const custom = suggestExercise({ exercise: machine(), history: [session(set('intense', 100, 8), set('intense', 100, 8))], settings: { ...S, intenseSets: 4, intenseRange: { min: 8, max: 10 } } });
    assert.equal(loads(custom).join(','), '100,100,100,100');
  },
  'Schwach: −7,5 % auf Stufe abgerundet, 1 Intensivsatz weniger'(assert) {
    const r = suggest(machine(), [session(set('intense', 100, 7), set('intense', 100, 7), set('intense', 100, 7))], { readiness: { feeling: 'weak' } });
    assert.equal(loads(r).join(','), '92.5,92.5');
    assert.ok(r.reason.includes('schwach'), r.reason);
    assert.equal(r.reduced, true);
  },
  'Aktuell krank: nur Aufwärm- und Volumensatz'(assert) {
    const r = suggest(machine(), [session(set('volume', 60, 12), set('intense', 100, 7))], { readiness: { illness: 'current' } });
    assert.equal(r.sets.map((s) => s.setType).join(','), 'warmup,volume');
  },
  'Assistenz in Stufen: niedrigere Stufe ist schwerer'(assert) {
    const r = suggest(pull, [session(set('intense', null, 8, { level: 3 }), set('intense', null, 8, { level: 3 }))]);
    assert.equal(loads(r)[0], 2);
  },
  'Zeit: alle Sätze gehalten → +5 s, sonst Ziel halten'(assert) {
    const up = suggest(hang, [session(set('intense', null, null, { seconds: 30 }), set('intense', null, null, { seconds: 30 }))]);
    assert.equal(loads(up)[0], 35);
    const hold = suggest(hang, [session(set('intense', null, null, { seconds: 30 }), set('intense', null, null, { seconds: 25 }))]);
    assert.equal(loads(hold)[0], 30);
  },
  'Anderer Kontext → Vorschlag „unsicher“'(assert) {
    const history = [session(set('intense', 100, 7))];
    assert.equal(suggest(machine(), history).uncertain, false);
    assert.equal(suggest(machine(), history, { sameContext: false }).uncertain, true);
  },
  'Eigene Wiederholungsbereiche der Übung (repRanges)'(assert) {
    const pushups = { type: 'bodyweight', steps: { min: 0, max: 40, step: 2.5 }, repRanges: { volume: { min: 20, max: 25 }, intense: { min: 12, max: 20 } } };
    const r = suggest(pushups, [session(set('intense', 0, 20), set('intense', 0, 15), set('intense', 0, 18))]);
    assert.equal(loads(r).join(','), '0,0,0');
    assert.equal(targets(r).join(','), '20,16,18');
  },
  'Aufwärmsatz nie schwerer als der Volumensatz'(assert) {
    const r = suggest(machine(), [session(set('volume', 5, 12), set('intense', 10, 10), set('intense', 10, 10))]);
    assert.ok(loads(r, 'warmup')[0] <= loads(r, 'volume')[0], `${loads(r, 'warmup')} > ${loads(r, 'volume')}`);
  },
  'Band ohne Stärke: gleiches Band halten'(assert) {
    const band = { type: 'band', steps: { levels: [], harderDirection: 'down' } };
    const r = suggest(band, [session(set('intense', null, 8), set('intense', null, 8))]);
    assert.ok(r.reason.includes('gleiches Band'), r.reason);
  },
  'Altdaten ohne Satztypen: schwerste Sätze gelten als Intensivsätze'(assert) {
    const r = suggest(machine(), [session(set(undefined, 60, 12), set(undefined, 100, 8), set(undefined, 100, 8))]);
    assert.equal(loads(r)[0], 102.5);
  },
};
