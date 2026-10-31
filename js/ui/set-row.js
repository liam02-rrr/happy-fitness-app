// Eine Satz-Zeile im aktiven Training: kompakt (abgehakt/später) oder aufgeklappt zum Erfassen.
// Ziel: Werte sind vorausgefüllt, ein Satz ist mit 3–4 Taps geloggt (RIR, Haken, ggf. −/+).
import { h, icon } from './dom.js';
import { icons } from './icons.js';
import { formatNumber, parseDecimal } from './format.js';
import { SET_TYPES } from '../models/sets.js';

const RIR_VALUES = [0, 1, 2, 3, 4, 5];
const TYPE_CYCLE = ['warmup', 'volume', 'intense'];

export const usesLevelSteps = (exercise) => Array.isArray(exercise.steps?.levels);

function loadUnit(exercise) {
  if (exercise.type === 'bodyweight') return '+kg';
  if (exercise.type === 'assisted') return 'kg Hilfe';
  return 'kg';
}

// Zahl mit −/+ und direkter Eingabe
function numberStepper({ value, step, min = 0, unit, label, decimals = true, onChange }) {
  const input = h('input', {
    class: 'set-input num',
    type: 'text',
    inputMode: decimals ? 'decimal' : 'numeric',
    value: value != null ? formatNumber(value) : '',
    placeholder: '–',
    'aria-label': label,
    onchange: () => onChange(parseDecimal(input.value)),
    onfocus: () => input.select(),
  });
  const change = (direction) => {
    const current = parseDecimal(input.value);
    const next = current == null ? min : Math.max(min, Math.round((current + direction * step) * 100) / 100);
    input.value = formatNumber(next);
    onChange(next);
  };
  return h('div', { class: 'set-stepper' },
    h('button', { type: 'button', class: 'set-step', 'aria-label': `${label} weniger`, onclick: () => change(-1) }, icon(icons.minus)),
    h('label', { class: 'set-value' }, input, unit && h('span', { class: 'set-unit' }, unit)),
    h('button', { type: 'button', class: 'set-step', 'aria-label': `${label} mehr`, onclick: () => change(1) }, icon(icons.plus))
  );
}

// Stufe/Band aus der Liste der Übung mit −/+
function levelStepper({ value, exercise, onChange }) {
  const levels = exercise.steps.levels;
  const display = h('span', { class: 'set-level num' });
  let index = levels.findIndex((level) => String(level) === String(value));
  const render = () => {
    display.textContent = index >= 0 ? String(levels[index]) : '–';
  };
  const change = (direction) => {
    index = index < 0 ? (direction > 0 ? 0 : levels.length - 1) : Math.min(levels.length - 1, Math.max(0, index + direction));
    render();
    onChange(levels[index]);
  };
  render();
  return h('div', { class: 'set-stepper' },
    h('button', { type: 'button', class: 'set-step', 'aria-label': 'Stufe zurück', onclick: () => change(-1) }, icon(icons.minus)),
    h('span', { class: 'set-value' }, display, h('span', { class: 'set-unit' }, exercise.type === 'band' ? 'Band' : 'Stufe')),
    h('button', { type: 'button', class: 'set-step', 'aria-label': 'Stufe weiter', onclick: () => change(1) }, icon(icons.plus))
  );
}

// Last-Eingabe passend zum Übungstyp (kg, Stufe/Band oder Sekunden)
export function loadStepper(set, exercise, settings, onChange) {
  if (exercise.type === 'time') {
    return numberStepper({ value: set.seconds, step: settings.timeStep, unit: 's', label: 'Sekunden', decimals: false, onChange: (seconds) => onChange({ seconds }) });
  }
  if (usesLevelSteps(exercise)) {
    return levelStepper({ value: set.level, exercise, onChange: (level) => onChange({ level }) });
  }
  return numberStepper({
    value: set.weight,
    step: exercise.steps?.step ?? 2.5,
    min: exercise.steps?.min ?? 0,
    unit: loadUnit(exercise),
    label: 'Gewicht',
    onChange: (weight) => onChange({ weight }),
  });
}

export function repsStepper(reps, onChange, label = 'Wiederholungen', unilateral = false) {
  return numberStepper({ value: reps, step: 1, unit: unilateral ? 'Wdh./S.' : 'Wdh.', label, decimals: false, onChange });
}

// Kurztext eines Satzes, z. B. „40 kg × 8“ oder „S4 × 6“
export function setSummary(set, exercise, repsText = set.reps) {
  if (exercise.type === 'time') return set.seconds != null ? `${set.seconds} s` : '–';
  let load;
  if (usesLevelSteps(exercise)) load = set.level != null ? `${exercise.type === 'band' ? 'Band' : 'Stufe'} ${set.level}` : '–';
  else if (exercise.type === 'bodyweight') load = set.weight ? `KG + ${formatNumber(set.weight)} kg` : 'KG';
  else load = set.weight != null ? `${formatNumber(set.weight)} ${loadUnit(exercise)}` : '–';
  return `${load} × ${repsText ?? '–'}`;
}

export function typeBadge(set, onCycle) {
  const type = SET_TYPES.find((t) => t.id === set.setType);
  const canCycle = onCycle && set.setType !== 'drop';
  return h(canCycle ? 'button' : 'span', {
    type: canCycle ? 'button' : null,
    class: `set-badge set-badge-${set.setType}`,
    title: type.label,
    'aria-label': canCycle ? `Satztyp ${type.label}, tippen zum Wechseln` : type.label,
    onclick: canCycle ? () => onCycle(TYPE_CYCLE[(TYPE_CYCLE.indexOf(set.setType) + 1) % TYPE_CYCLE.length]) : null,
  }, type.short);
}

export function rirPicker(value, onChange) {
  const el = h('div', { class: 'rir', role: 'radiogroup', 'aria-label': 'RIR (Wiederholungen in Reserve)' });
  let current = value;
  const render = () => {
    el.replaceChildren(h('span', { class: 'rir-label' }, 'RIR'), ...RIR_VALUES.map((n) =>
      h('button', {
        type: 'button',
        class: `rir-chip${current === n ? ' is-active' : ''}`,
        role: 'radio',
        'aria-checked': String(current === n),
        onclick: () => {
          current = current === n ? null : n;
          onChange(current);
          render();
        },
      }, String(n))
    ));
  };
  render();
  return el;
}

export function checkButton(done, onClick) {
  return h('button', {
    type: 'button',
    class: `set-check${done ? ' is-done' : ''}`,
    'aria-label': done ? 'Satz als offen markieren' : 'Satz abhaken',
    'aria-pressed': String(done),
    onclick: onClick,
  }, icon(icons.check));
}
