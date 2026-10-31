import { levelRank, setScore, compareToLast } from '../js/algorithm/compare.js';

const weight = { type: 'weight', steps: { min: 0, max: 100, step: 5 } };
const assisted = { type: 'assisted', steps: { min: 0, max: 80, step: 5 } };
const assistedLevels = { type: 'assisted', steps: { levels: [1, 2, 3, 4, 5], harderDirection: 'down' } };
const time = { type: 'time', steps: null };
const set = (props) => ({ done: true, setType: 'intense', ...props });

export default {
  'Stufen-Rang: niedriger = schwerer'(assert) {
    assert.equal(levelRank(1, assistedLevels.steps), 4);
    assert.equal(levelRank(5, assistedLevels.steps), 0);
    assert.equal(levelRank(9, assistedLevels.steps), null);
  },
  'Mehr Gewicht schlägt mehr Wiederholungen'(assert) {
    assert.ok(setScore(set({ weight: 45, reps: 5 }), weight) > setScore(set({ weight: 40, reps: 12 }), weight));
  },
  'Gleiches Gewicht: mehr Wiederholungen ist besser'(assert) {
    assert.equal(compareToLast([set({ weight: 40, reps: 9 })], [set({ weight: 40, reps: 8 })], weight), 1);
  },
  'Gleiche Leistung ergibt 0'(assert) {
    assert.equal(compareToLast([set({ weight: 40, reps: 8 })], [set({ weight: 40, reps: 8 })], weight), 0);
  },
  'Weniger ist schlechter'(assert) {
    assert.equal(compareToLast([set({ weight: 35, reps: 8 })], [set({ weight: 40, reps: 8 })], weight), -1);
  },
  'Aufwärmsätze und offene Sätze zählen nicht'(assert) {
    const current = [set({ weight: 60, reps: 10, setType: 'warmup' }), set({ weight: 80, reps: 10, done: false }), set({ weight: 40, reps: 8 })];
    assert.equal(compareToLast(current, [set({ weight: 40, reps: 8 })], weight), 0);
  },
  'Assistenz in kg: weniger Assistenz ist besser'(assert) {
    assert.equal(compareToLast([set({ weight: 20, reps: 6 })], [set({ weight: 25, reps: 8 })], assisted), 1);
  },
  'Assistenz in Stufen: niedrigere Stufe ist besser'(assert) {
    assert.equal(compareToLast([set({ level: 3, reps: 4 })], [set({ level: 4, reps: 8 })], assistedLevels), 1);
  },
  'Zeit: länger ist besser'(assert) {
    assert.equal(compareToLast([set({ seconds: 35 })], [set({ seconds: 30 })], time), 1);
  },
  'Ohne letztes Mal kein Vergleich'(assert) {
    assert.equal(compareToLast([set({ weight: 40, reps: 8 })], [], weight), null);
  },
};
