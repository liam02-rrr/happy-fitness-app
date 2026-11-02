// Alle Schwellenwerte des Algorithmus (SPEC.md, Abschnitt 8) bearbeiten, gruppiert, mit „Auf Standard zurücksetzen“.
// Jede Änderung wird sofort gespeichert.
import { h, icon } from './dom.js';
import { icons } from './icons.js';
import { openView } from './view.js';
import { confirmSheet } from './sheet.js';
import { toast } from './toast.js';
import { numberStepper } from './set-row.js';
import { formatNumber } from './format.js';
import {
  DEFAULT_SETTINGS, SETTINGS_SCHEMA, RANGE_PAIRS,
  getSettings, updateSettings, resetSettings, readSetting, withSetting,
} from '../models/settings.js';

export const ALL_THRESHOLD_KEYS = SETTINGS_SCHEMA.flatMap((group) => group.items.map((item) => item.key));

export function countChanged(settings) {
  return ALL_THRESHOLD_KEYS.filter((key) => readSetting(settings, key) !== readSetting(DEFAULT_SETTINGS, key)).length;
}

export async function openThresholds({ onChanged } = {}) {
  let settings = await getSettings();
  const body = h('div', { class: 'form' });

  const labelOf = (key) => SETTINGS_SCHEMA.flatMap((group) => group.items).find((item) => item.key === key)?.label ?? key;

  async function change(item, value) {
    if (value == null) {
      toast('Bitte eine Zahl eingeben.', { variant: 'danger' });
      render();
      return;
    }
    const clamped = Math.min(item.max, Math.max(item.min, value));
    const next = withSetting(settings, item.key, clamped);

    const broken = RANGE_PAIRS.find(([low, high]) => readSetting(next, low) > readSetting(next, high));
    if (broken) {
      toast(`„${labelOf(broken[0])}“ darf nicht größer sein als „${labelOf(broken[1])}“.`, { variant: 'danger', duration: 3500 });
      render();
      return;
    }

    const topKey = item.key.split('.')[0];
    settings = await updateSettings({ [topKey]: next[topKey] });
    if (clamped !== value) toast(`Erlaubt: ${formatNumber(item.min)}–${formatNumber(item.max)} ${item.unit}`);
    render();
    onChanged?.();
  }

  function row(item) {
    const value = readSetting(settings, item.key);
    const defaultValue = readSetting(DEFAULT_SETTINGS, item.key);
    const changed = value !== defaultValue;
    return h('div', { class: `threshold-row${changed ? ' is-changed' : ''}` },
      h('div', { class: 'threshold-text' },
        h('span', { class: 'threshold-label' }, item.label),
        h('span', { class: 'threshold-hint' },
          [item.hint, changed ? `Standard: ${formatNumber(defaultValue)}` : null].filter(Boolean).join(' · '))
      ),
      numberStepper({
        value,
        step: item.step,
        min: item.min,
        max: item.max,
        unit: item.unit,
        label: item.label,
        decimals: !Number.isInteger(item.step),
        onChange: (next) => change(item, next),
      })
    );
  }

  function render() {
    body.replaceChildren(
      h('p', { class: 'hint' }, 'Alle Zahlen, mit denen die App Vorschläge rechnet. Änderungen wirken sofort. Blau = von dir geändert.'),
      ...SETTINGS_SCHEMA.map((group) =>
        h('section', { class: 'card threshold-group' },
          h('div', { class: 'threshold-group-head' },
            h('h2', { class: 'card-title' }, group.title),
            group.phase && h('span', { class: 'mini-chip' }, `wirkt ab Phase ${group.phase}`)
          ),
          group.hint && h('p', { class: 'threshold-hint' }, group.hint),
          group.items.map(row)
        )
      ),
      h('button', {
        type: 'button',
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          const ok = await confirmSheet({
            title: 'Auf Standard zurücksetzen?',
            text: 'Alle Schwellenwerte bekommen wieder die Werte aus der Spezifikation.',
            confirmLabel: 'Zurücksetzen',
          });
          if (!ok) return;
          await resetSettings();
          settings = await getSettings();
          toast('Standardwerte wiederhergestellt', { variant: 'success' });
          render();
          onChanged?.();
        },
      }, icon(icons.sliders), 'Auf Standard zurücksetzen')
    );
  }

  render();
  openView({ title: 'Schwellenwerte', content: body });
}
