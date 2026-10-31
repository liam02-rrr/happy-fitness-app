// Tab „Training“ (SPEC.md, Abschnitt 6.2): Tage seit je Muskelgruppe, Training starten oder fortsetzen.
// Die Körperkarte „Erholung“ kommt in Phase 3.
import { h, icon } from './dom.js';
import { icons } from './icons.js';
import { daysSince, formatDate } from './format.js';
import { openTrainingFlow } from './training-flow.js';
import { openActiveTraining } from './active-training.js';
import { MUSCLE_GROUPS, groupLabel } from '../models/muscles.js';
import { listExercises } from '../models/exercises.js';
import { getActiveSession, lastDoneByExercise } from '../models/sessions.js';

// Nur für die Anzeige: ab wie vielen Tagen eine Kachel heller wird (frisch = gedimmt, lange her = hell)
const RECOVERY_LEVELS = [2, 4, 7];

export function renderTraining(section) {
  const content = h('div', { class: 'stack' });
  const cta = h('button', { type: 'button', class: 'cta' });
  section.append(content, cta);

  async function refresh() {
    const [exercises, lastDone, active] = await Promise.all([listExercises(), lastDoneByExercise(), getActiveSession()]);

    // Letztes Training je Muskelgruppe aus den Übungen berechnen
    const lastByGroup = new Map();
    for (const exercise of exercises) {
      const date = lastDone.get(exercise.id);
      if (date && (!lastByGroup.has(exercise.muscleGroup) || date > lastByGroup.get(exercise.muscleGroup))) {
        lastByGroup.set(exercise.muscleGroup, date);
      }
    }

    content.replaceChildren(...[active && activeCard(active), recoveryCard(lastByGroup)].filter(Boolean));

    cta.replaceChildren(icon(icons.play), active ? 'Training fortsetzen' : 'Training starten');
    cta.onclick = () => (active
      ? openActiveTraining(active, { onChanged: refresh })
      : openTrainingFlow({ onStarted: (session) => openActiveTraining(session, { onChanged: refresh }) }));
  }

  function activeCard(session) {
    return h('section', { class: 'card card-accent' },
      h('p', { class: 'eyebrow' }, 'Training läuft'),
      h('p', { class: 'card-title' }, session.muscleGroups.map(groupLabel).join(', ')),
      h('p', { class: 'card-text' }, `Gestartet am ${formatDate(session.date)}`)
    );
  }

  function recoveryCard(lastByGroup) {
    return h('section', { class: 'card' },
      h('div', { class: 'card-header' },
        h('span', { class: 'icon-chip' }, icon(icons.history)),
        h('h2', { class: 'card-title' }, 'Tage seit')
      ),
      h('div', { class: 'recovery-grid' }, MUSCLE_GROUPS.map((group) => {
        const date = lastByGroup.get(group.id);
        const days = date ? daysSince(date) : null;
        const level = days == null ? 'none' : RECOVERY_LEVELS.filter((threshold) => days >= threshold).length;
        return h('div', { class: `recovery-tile recovery-${level}` },
          h('span', { class: 'recovery-days num' }, days == null ? '–' : String(days)),
          h('span', { class: 'recovery-label' }, group.label)
        );
      })),
      h('p', { class: 'hint' }, 'Hell = lange nicht trainiert, gedimmt = frisch trainiert.')
    );
  }

  refresh();
  window.addEventListener('hashchange', () => location.hash === '#training' && refresh());
}
