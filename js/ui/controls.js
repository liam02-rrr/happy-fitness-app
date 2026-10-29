// Wiederverwendbare Bedienelemente: Segmente, Pillen, Schalter, Bewertungspunkte, Textfelder
import { h } from './dom.js';

// Umschalter mit 2–3 Optionen (z. B. Kraft | Mobility)
export function segmented(options, value, onChange) {
  const el = h('div', { class: 'segmented', role: 'radiogroup' });
  const render = (current) => {
    el.replaceChildren(...options.map((option) =>
      h('button', {
        type: 'button',
        class: `segment${option.id === current ? ' is-active' : ''}`,
        role: 'radio',
        'aria-checked': String(option.id === current),
        onclick: () => {
          render(option.id);
          onChange(option.id);
        },
      }, option.label)
    ));
  };
  render(value);
  return el;
}

// Pillen zum Auswählen, einzeln oder mehrfach. scroll = waagerecht scrollbar statt umbrechen.
export function pills(options, value, onChange, { multi = false, scroll = false } = {}) {
  const el = h('div', { class: `pills${scroll ? ' pills-scroll' : ''}` });
  let selected = multi ? new Set(value) : value;

  const render = () => {
    el.replaceChildren(...options.map((option) => {
      const active = multi ? selected.has(option.id) : option.id === selected;
      return h('button', {
        type: 'button',
        class: `pill${active ? ' is-active' : ''}`,
        'aria-pressed': String(active),
        onclick: () => {
          if (multi) {
            selected.has(option.id) ? selected.delete(option.id) : selected.add(option.id);
            onChange([...selected]);
          } else {
            selected = option.id;
            onChange(selected);
          }
          render();
        },
      }, option.label);
    }));
  };
  render();
  return el;
}

// Zeile mit Ein/Aus-Schalter
export function toggleRow(label, checked, onChange, hint) {
  const input = h('input', { type: 'checkbox', class: 'switch-input', checked, onchange: () => onChange(input.checked) });
  return h('label', { class: 'toggle-row' },
    h('span', { class: 'toggle-text' }, label, hint && h('small', {}, hint)),
    input,
    h('span', { class: 'switch', 'aria-hidden': 'true' })
  );
}

// Bewertung 1–5 als Punkte. Erneutes Tippen auf den aktuellen Wert setzt auf 0 zurück.
export function ratingDots(value, onChange, label) {
  const el = h('div', { class: 'rating', role: 'group', 'aria-label': label });
  let current = value;
  const render = () => {
    el.replaceChildren(...[1, 2, 3, 4, 5].map((n) =>
      h('button', {
        type: 'button',
        class: `rating-dot${n <= current ? ' is-on' : ''}`,
        'aria-label': `${label}: ${n} von 5`,
        'aria-pressed': String(n === current),
        onclick: () => {
          current = current === n ? 0 : n;
          onChange(current);
          render();
        },
      })
    ));
  };
  render();
  return el;
}

// Beschriftetes Eingabefeld
export function field(label, input, hint) {
  return h('label', { class: 'form-field' },
    h('span', { class: 'form-label' }, label),
    input,
    hint && h('small', { class: 'form-hint' }, hint)
  );
}

// Abschnitt im Formular mit Überschrift
export function formSection(title, ...children) {
  return h('section', { class: 'form-section' }, title && h('h2', { class: 'form-section-title' }, title), ...children);
}
