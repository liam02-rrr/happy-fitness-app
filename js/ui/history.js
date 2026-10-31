// Tab „Verlauf“ (SPEC.md, Abschnitt 6.3): Trainings als Karten nach Monat, Detailansicht,
// nachträglich bearbeiten und vergessene Trainings nachtragen.
// Die Dauer-Schätzung auf den Karten kommt mit Abschnitt 7.10 in Phase 4.
import { h, icon } from './dom.js';
import { icons } from './icons.js';
import { openView } from './view.js';
import { formatDate, plural } from './format.js';
import { openTrainingFlow } from './training-flow.js';
import { openActiveTraining } from './active-training.js';
import { setSummary, typeBadge } from './set-row.js';
import { groupLabel } from '../models/muscles.js';
import { listExercises } from '../models/exercises.js';
import { listSessions, getEntries, FEELINGS, ILLNESS, TIME_MODES } from '../models/sessions.js';
import { getSets, dropDepth } from '../models/sets.js';
import { getAll } from '../db.js';

const monthFormat = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const weekdayFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });
const toDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const labelOf = (list, id) => list.find((item) => item.id === id)?.label ?? id;

export function renderHistory(section) {
  const content = h('div', { class: 'history' });
  const addButton = h('button', { type: 'button', class: 'fab', onclick: backfill }, icon(icons.plus), 'Nachtragen');
  section.append(content, addButton);

  function backfill() {
    openTrainingFlow({
      backfill: true,
      onStarted: (session) => openActiveTraining(session, { mode: 'edit', onChanged: refresh }),
    });
  }

  async function refresh() {
    const [sessions, entries, sets] = await Promise.all([listSessions(), getAll('entries'), getAll('sets')]);

    // Zahlen je Training immer aus den Rohdaten berechnen
    const entriesBySession = new Map();
    for (const entry of entries) entriesBySession.set(entry.sessionId, [...(entriesBySession.get(entry.sessionId) ?? []), entry]);
    const doneSetsByEntry = new Map();
    for (const set of sets) if (set.done) doneSetsByEntry.set(set.entryId, (doneSetsByEntry.get(set.entryId) ?? 0) + 1);

    sessions.sort((a, b) => b.date.localeCompare(a.date) || (a.status === 'done') - (b.status === 'done'));

    if (sessions.length === 0) {
      content.replaceChildren(h('div', { class: 'card placeholder' },
        h('div', { class: 'placeholder-icon' }, icon(icons.history)),
        h('p', { class: 'card-title' }, 'Noch keine Trainings'),
        h('p', { class: 'card-text' }, 'Abgeschlossene Trainings erscheinen hier. Vergessene Trainings trägst du über „Nachtragen“ ein.')
      ));
      return;
    }

    const children = [];
    let month = null;
    for (const session of sessions) {
      const label = monthFormat.format(toDate(session.date));
      if (label !== month) {
        month = label;
        children.push(h('h2', { class: 'month-title' }, label));
      }
      const sessionEntries = entriesBySession.get(session.id) ?? [];
      const exerciseCount = new Set(sessionEntries.map((entry) => entry.exerciseId)).size;
      const setCount = sessionEntries.reduce((sum, entry) => sum + (doneSetsByEntry.get(entry.id) ?? 0), 0);
      children.push(sessionCard(session, exerciseCount, setCount));
    }
    content.replaceChildren(...children);
  }

  function sessionCard(session, exerciseCount, setCount) {
    const date = toDate(session.date);
    const status = session.status === 'active' ? 'läuft' : session.status === 'planned' ? 'nicht abgeschlossen' : null;
    return h('button', { type: 'button', class: 'session-card', onclick: () => openDetail(session) },
      h('span', { class: 'session-date' },
        h('span', { class: 'session-weekday' }, weekdayFormat.format(date)),
        h('span', { class: 'session-day num' }, String(date.getDate()))
      ),
      h('span', { class: 'session-body' },
        h('span', { class: 'session-groups' }, (session.muscleGroups ?? []).map(groupLabel).join(', ') || 'Training'),
        h('span', { class: 'session-meta num' }, `${plural(exerciseCount, 'Übung', 'Übungen')} · ${plural(setCount, 'Satz', 'Sätze')}`),
        h('span', { class: 'session-chips' },
          status && h('span', { class: 'mini-chip mini-chip-accent' }, status),
          feelingChip(session.feeling),
          session.illness && session.illness !== 'none' && h('span', { class: 'mini-chip mini-chip-warning' }, session.illness === 'current' ? 'krank' : 'angeschlagen')
        )
      ),
      h('span', { class: 'session-arrow', 'aria-hidden': 'true' }, '›')
    );
  }

  async function openDetail(session) {
    if (session.status === 'active') {
      openActiveTraining(session, { onChanged: refresh });
      return;
    }
    const [exercises, entries] = await Promise.all([listExercises(), getEntries(session.id)]);
    const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    const setsByEntry = new Map(await Promise.all(entries.map(async (entry) => [entry.id, await getSets(entry.id)])));

    // Einheiten wie im Training: einzelne Übung, Superset, Komplex
    const units = [];
    for (const entry of entries) {
      const previous = units.at(-1);
      if (entry.groupId && previous?.groupId === entry.groupId) previous.entries.push(entry);
      else units.push({ kind: entry.groupId ? entry.groupType : 'single', groupId: entry.groupId, entries: [entry] });
    }

    const setLines = (entry, exercise) => {
      const sets = setsByEntry.get(entry.id).filter((set) => set.done);
      if (sets.length === 0) return h('p', { class: 'hint' }, 'Keine Sätze');
      return h('div', { class: 'detail-sets' }, sets.map((set) =>
        h('div', { class: 'detail-set', style: set.dropFrom ? `--depth: ${dropDepth(set, sets)}` : null },
          typeBadge(set),
          h('span', { class: 'num' }, setSummary(set, exercise)),
          set.rir != null && h('span', { class: 'set-rir num' }, `RIR ${set.rir}`),
          set.note && h('span', { class: 'meta' }, set.note)
        )
      ));
    };

    const exerciseBlock = (entry) => {
      const exercise = exerciseById.get(entry.exerciseId) ?? { name: 'Gelöschte Übung', type: 'weight' };
      return h('div', { class: 'detail-exercise' },
        h('p', { class: 'ex-name' }, exercise.name, exercise.location && h('span', { class: 'ex-meta' }, ` · ${exercise.location}`)),
        setLines(entry, exercise),
        entry.note && h('p', { class: 'ex-last-note' }, entry.note)
      );
    };

    const complexBlock = (unit) => {
      const lead = unit.entries[0];
      const exercise = exerciseById.get(lead.exerciseId) ?? { name: '?', type: 'weight' };
      const leadSets = setsByEntry.get(lead.id).filter((set) => set.done);
      const names = unit.entries.map((entry) => exerciseById.get(entry.exerciseId)?.name ?? '?');
      return h('div', { class: 'detail-exercise' },
        h('p', { class: 'ex-name' }, names.join(' + ')),
        h('div', { class: 'detail-sets' }, leadSets.map((set) => {
          const depth = dropDepth(set, leadSets);
          const reps = unit.entries.map((entry) => {
            const own = setsByEntry.get(entry.id);
            return own.find((o) => o.index === set.index && dropDepth(o, own) === depth)?.reps ?? '–';
          }).join('/');
          return h('div', { class: 'detail-set', style: depth ? `--depth: ${depth}` : null },
            typeBadge(set), h('span', { class: 'num' }, setSummary(set, exercise, reps)),
            set.rir != null && h('span', { class: 'set-rir num' }, `RIR ${set.rir}`));
        })),
        lead.note && h('p', { class: 'ex-last-note' }, lead.note)
      );
    };

    const unitBlocks = units.map((unit) => {
      if (unit.kind === 'complex') {
        return h('section', { class: 'card detail-unit detail-complex' }, h('p', { class: 'eyebrow eyebrow-complex' }, 'Komplex'), complexBlock(unit));
      }
      if (unit.kind === 'superset') {
        return h('section', { class: 'card detail-unit detail-superset' }, h('p', { class: 'eyebrow' }, 'Superset'), unit.entries.map(exerciseBlock));
      }
      return h('section', { class: 'card detail-unit' }, exerciseBlock(unit.entries[0]));
    });

    const date = toDate(session.date);
    const close = openView({
      title: 'Training',
      content: h('div', { class: 'active' },
        h('section', { class: 'card' },
          h('p', { class: 'eyebrow' }, new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(date)),
          h('p', { class: 'finish-total' }, formatDate(session.date)),
          h('p', { class: 'card-text' }, (session.muscleGroups ?? []).map(groupLabel).join(', ')),
          h('div', { class: 'session-chips detail-chips' },
            session.status === 'planned' && h('span', { class: 'mini-chip mini-chip-accent' }, 'nicht abgeschlossen'),
            feelingChip(session.feeling),
            session.illness && h('span', { class: `mini-chip${session.illness !== 'none' ? ' mini-chip-warning' : ''}` }, `Krankheit: ${labelOf(ILLNESS, session.illness)}`),
            session.timeMode && h('span', { class: 'mini-chip' }, `Zeit: ${labelOf(TIME_MODES, session.timeMode)}`)
          ),
          session.note && h('p', { class: 'ex-last-note' }, session.note)
        ),
        unitBlocks.length ? unitBlocks : h('p', { class: 'hint' }, 'Dieses Training enthält keine Übungen.')
      ),
      footer: h('button', {
        type: 'button',
        class: 'btn btn-primary btn-block',
        onclick: () => {
          close();
          openActiveTraining(session, { mode: 'edit', onChanged: refresh });
        },
      }, session.status === 'planned' ? 'Weiter eintragen' : 'Bearbeiten'),
    });
  }

  refresh();
  window.addEventListener('hashchange', () => location.hash === '#history' && refresh());
}

function feelingChip(feeling) {
  if (!feeling) return null;
  const variant = { strong: 'success', tired: 'warning', weak: 'danger' }[feeling];
  return h('span', { class: `mini-chip${variant ? ` mini-chip-${variant}` : ''}` }, labelOf(FEELINGS, feeling));
}
