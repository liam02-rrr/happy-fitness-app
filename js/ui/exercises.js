// Tab „Übungen“ (SPEC.md, Abschnitt 6.4): Kraft | Mobility, Muskelgruppen-Filter, Suche, Foto-Karten
import { h, icon } from './dom.js';
import { icons } from './icons.js';
import { segmented, pills } from './controls.js';
import { photoUrl } from './photo.js';
import { daysAgoLabel } from './format.js';
import { openExerciseEditor } from './exercise-editor.js';
import { CATEGORIES, listExercises } from '../models/exercises.js';
import { MUSCLE_GROUPS, groupLabel } from '../models/muscles.js';
import { getAll } from '../db.js';

const ALL = 'all';

// Datum der letzten Ausführung je Übung (aus abgeschlossenen Trainings, immer berechnet)
async function lastDoneByExercise() {
  const [sessions, entries] = await Promise.all([getAll('sessions'), getAll('entries')]);
  const sessionDate = new Map(sessions.filter((s) => s.status === 'done').map((s) => [s.id, s.date]));
  const last = new Map();
  for (const entry of entries) {
    const date = sessionDate.get(entry.sessionId);
    if (date && (!last.has(entry.exerciseId) || date > last.get(entry.exerciseId))) last.set(entry.exerciseId, date);
  }
  return last;
}

export function renderExercises(section) {
  const state = { category: 'strength', group: ALL, query: '', showArchived: false };
  let exercises = [];
  let lastDone = new Map();

  const list = h('div', { class: 'exercise-list' });
  const archivedToggle = h('button', { type: 'button', class: 'btn btn-ghost btn-block' });

  const searchInput = h('input', {
    class: 'search-input',
    type: 'search',
    placeholder: 'Übung suchen',
    'aria-label': 'Übung suchen',
    oninput: () => {
      state.query = searchInput.value.trim().toLowerCase();
      renderList();
    },
  });

  const filters = h('div', { class: 'stack-sm filters' },
    segmented(CATEGORIES, state.category, (category) => {
      state.category = category;
      renderList();
    }),
    pills([{ id: ALL, label: 'Alle' }, ...MUSCLE_GROUPS], state.group, (group) => {
      state.group = group;
      renderList();
    }, { scroll: true }),
    h('label', { class: 'search' }, icon(icons.search), searchInput)
  );

  const openEditor = (exercise) => openExerciseEditor(exercise, {
    defaults: { category: state.category, muscleGroup: state.group === ALL ? 'chest' : state.group },
    onSaved: refresh,
  });

  const addButton = h('button', { type: 'button', class: 'fab', onclick: () => openEditor(null) }, icon(icons.plus), 'Neue Übung');

  archivedToggle.addEventListener('click', () => {
    state.showArchived = !state.showArchived;
    renderList();
  });

  function card(exercise) {
    const url = photoUrl(exercise.photo);
    const last = lastDone.get(exercise.id);
    return h('button', {
      type: 'button',
      class: `exercise-card${url ? ' has-photo' : ''}${exercise.archived ? ' is-archived' : ''}`,
      style: url ? `background-image: url("${url}")` : null,
      onclick: () => openEditor(exercise),
    },
      h('span', { class: `chip${last ? '' : ' chip-new'}` }, last ? daysAgoLabel(last) : 'Neu'),
      exercise.archived && h('span', { class: 'chip chip-archived' }, 'Archiviert'),
      !url && h('span', { class: 'exercise-card-initial', 'aria-hidden': 'true' }, exercise.name.charAt(0).toUpperCase()),
      h('span', { class: 'exercise-card-text' },
        h('span', { class: 'exercise-card-name' }, exercise.name),
        h('span', { class: 'exercise-card-meta' }, [exercise.location, groupLabel(exercise.muscleGroup)].filter(Boolean).join(' · '))
      )
    );
  }

  function renderList() {
    const matches = (exercise) =>
      exercise.category === state.category &&
      (state.group === ALL || exercise.muscleGroup === state.group) &&
      (!state.query || `${exercise.name} ${exercise.location ?? ''}`.toLowerCase().includes(state.query));

    const visible = exercises.filter((exercise) => matches(exercise) && (state.showArchived || !exercise.archived));
    const archivedCount = exercises.filter((exercise) => matches(exercise) && exercise.archived).length;

    // Zuletzt trainierte zuerst, nie trainierte alphabetisch dahinter
    visible.sort((a, b) => {
      const [la, lb] = [lastDone.get(a.id), lastDone.get(b.id)];
      if (la && lb) return lb.localeCompare(la);
      if (la || lb) return la ? -1 : 1;
      return a.name.localeCompare(b.name, 'de');
    });

    list.replaceChildren(...(visible.length ? visible.map(card) : [emptyState()]));
    archivedToggle.hidden = archivedCount === 0;
    archivedToggle.textContent = state.showArchived ? 'Archivierte ausblenden' : `Archivierte anzeigen (${archivedCount})`;
  }

  function emptyState() {
    const filtered = state.query || state.group !== ALL;
    return h('div', { class: 'card placeholder' },
      h('div', { class: 'placeholder-icon' }, icon(icons.exercises)),
      h('p', { class: 'card-title' }, filtered ? 'Nichts gefunden' : 'Noch keine Übungen'),
      h('p', { class: 'card-text' }, filtered ? 'Ändere den Filter oder die Suche.' : 'Lege deine erste Übung über „Neue Übung“ an.')
    );
  }

  async function refresh() {
    [exercises, lastDone] = await Promise.all([listExercises(), lastDoneByExercise()]);
    renderList();
  }

  section.append(filters, list, archivedToggle, addButton);
  refresh();
}
