import { icons } from './icons.js';

// Die fünf Tabs (SPEC.md, Abschnitt 6.1). Inhalte folgen ab Phase 1.
export const tabs = [
  { id: 'training', label: 'Training', eyebrow: 'Bereit für heute?', hint: 'Hier startest du bald dein Training.' },
  { id: 'history', label: 'Verlauf', eyebrow: 'Deine Trainings', hint: 'Hier erscheinen bald alle bisherigen Trainings.' },
  { id: 'exercises', label: 'Übungen', eyebrow: 'Kraft & Mobility', hint: 'Hier legst du bald deine Übungen an.' },
  { id: 'stats', label: 'Statistik', eyebrow: 'Fortschritt', hint: 'Hier siehst du bald Diagramme und Körperkarte.' },
  { id: 'settings', label: 'Einstellungen', eyebrow: 'App & Daten', hint: 'Hier stellst du bald alle Werte ein und machst Backups.' },
];

export function renderScreen(tab) {
  const section = document.createElement('section');
  section.className = 'screen';
  section.id = `screen-${tab.id}`;
  section.setAttribute('aria-labelledby', `title-${tab.id}`);
  section.innerHTML = `
    <header class="screen-header">
      <p class="screen-eyebrow">${tab.eyebrow}</p>
      <h1 class="screen-title" id="title-${tab.id}">${tab.label}</h1>
    </header>
    <div class="card placeholder">
      <div class="placeholder-icon">${icons[tab.id]}</div>
      <p class="card-title">Noch leer</p>
      <p class="card-text">${tab.hint}</p>
      <span class="badge">Kommt in Phase 1</span>
    </div>
  `;
  return section;
}
