import { icons } from './icons.js';
import { h, icon } from './dom.js';
import { renderSettings } from './settings.js';
import { renderExercises } from './exercises.js';
import { renderTraining } from './training.js';
import { renderHistory } from './history.js';

// Die fünf Tabs (SPEC.md, Abschnitt 6.1). Tabs ohne render zeigen einen Platzhalter.
export const tabs = [
  { id: 'training', label: 'Training', eyebrow: 'Bereit für heute?', render: renderTraining },
  { id: 'history', label: 'Verlauf', eyebrow: 'Deine Trainings', render: renderHistory },
  { id: 'exercises', label: 'Übungen', eyebrow: 'Kraft & Mobility', render: renderExercises },
  { id: 'stats', label: 'Statistik', eyebrow: 'Fortschritt', hint: 'Hier siehst du bald Diagramme und Körperkarte.', comingIn: 'Kommt in Phase 3' },
  { id: 'settings', label: 'Einstellungen', eyebrow: 'App & Daten', render: renderSettings },
];

export function renderScreen(tab) {
  const section = h('section', { class: 'screen', id: `screen-${tab.id}`, 'aria-labelledby': `title-${tab.id}` },
    h('header', { class: 'screen-header' },
      h('p', { class: 'screen-eyebrow' }, tab.eyebrow),
      h('h1', { class: 'screen-title', id: `title-${tab.id}` }, tab.label)
    )
  );

  if (tab.render) {
    tab.render(section);
  } else {
    section.append(
      h('div', { class: 'card placeholder' },
        h('div', { class: 'placeholder-icon' }, icon(icons[tab.id])),
        h('p', { class: 'card-title' }, 'Noch leer'),
        h('p', { class: 'card-text' }, tab.hint),
        h('span', { class: 'badge' }, tab.comingIn)
      )
    );
  }
  return section;
}
