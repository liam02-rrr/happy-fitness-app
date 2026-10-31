// Tab „Training“ (SPEC.md, Abschnitt 6.2): Tage seit je Muskelgruppe, Training starten oder fortsetzen.
// Die Körperkarte „Erholung“ kommt in Phase 3, die Satz-Erfassung in Schritt 1d.
import { h, icon } from './dom.js';
import { icons } from './icons.js';
import { openView } from './view.js';
import { confirmSheet } from './sheet.js';
import { toast } from './toast.js';
import { daysSince, formatDate } from './format.js';
import { openTrainingFlow } from './training-flow.js';
import { MUSCLE_GROUPS, groupLabel } from '../models/muscles.js';
import { listExercises, displayName } from '../models/exercises.js';
import { getActiveSession, getEntries, deleteSession, lastDoneByExercise } from '../models/sessions.js';

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
    cta.onclick = () => (active ? openActive(active, exercises) : openTrainingFlow({ onStarted: refresh }));
  }

  function activeCard(session) {
    return h('section', { class: 'card card-accent' },
      h('p', { class: 'eyebrow' }, 'Training läuft'),
      h('p', { class: 'card-title' }, session.muscleGroups.map(groupLabel).join(', ')),
      h('p', { class: 'card-text' }, `Gestartet am ${formatDate(session.date)}`)
    );
  }

  // Vorläufige Ansicht bis Schritt 1d: Plan anzeigen und Training verwerfen
  async function openActive(session, exercises) {
    const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    const entries = await getEntries(session.id);
    const close = openView({
      title: 'Training',
      content: h('div', { class: 'form' },
        h('div', { class: 'card' },
          h('p', { class: 'card-title' }, 'Dein Plan'),
          h('ol', { class: 'plan-summary' }, entries.map((entry) => {
            const exercise = byId.get(entry.exerciseId);
            const group = entry.groupType ? ` · ${entry.groupType === 'superset' ? 'Superset' : 'Komplex'} ${entry.groupPosition}` : '';
            return h('li', {}, `${exercise ? displayName(exercise) : 'Unbekannte Übung'}${group}`);
          }))
        ),
        h('p', { class: 'hint' }, 'Die Erfassung der Sätze kommt in Schritt 1d.')
      ),
      footer: h('button', {
        type: 'button',
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          const ok = await confirmSheet({ title: 'Training verwerfen?', text: 'Das laufende Training wird gelöscht.', confirmLabel: 'Verwerfen' });
          if (!ok) return;
          await deleteSession(session.id);
          toast('Training verworfen');
          close();
          refresh();
        },
      }, icon(icons.trash), 'Training verwerfen'),
    });
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
