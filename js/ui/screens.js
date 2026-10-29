import { icons } from './icons.js';
import { h, icon } from './dom.js';
import { renderSettings } from './settings.js';

// Die fünf Tabs (SPEC.md, Abschnitt 6.1). Tabs ohne render zeigen einen Platzhalter.
export const tabs = [
  { id: 'training', label: 'Training', eyebrow: 'Bereit für heute?', hint: 'Hier startest du bald dein Training.', comingIn: 'Kommt in Schritt 1c' },
  { id: 'history', label: 'Verlauf', eyebrow: 'Deine Trainings', hint: 'Hier erscheinen bald alle bisherigen Trainings.', comingIn: 'Kommt in Schritt 1e' },
  { id: 'exercises', label: 'Übungen', eyebrow: 'Kraft & Mobility', hint: 'Hier legst du bald deine Übungen an.', comingIn: 'Kommt in Schritt 1b' },
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
