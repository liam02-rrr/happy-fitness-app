// Aktives Training (SPEC.md, Abschnitt 6.2): Übungskarten, Sätze loggen, Drop-Ketten, RIR, Notizen,
// Supersets mit Runden, Komplexe, Pausentimer und Abschluss. Jede Änderung wird sofort gespeichert.
import { h, icon } from './dom.js';
import { icons } from './icons.js';
import { openView } from './view.js';
import { confirmSheet } from './sheet.js';
import { toast } from './toast.js';
import { photoUrl } from './photo.js';
import { formatDate } from './format.js';
import { createRestTimer, unlockAudio } from './rest-timer.js';
import { loadStepper, repsStepper, setSummary, typeBadge, rirPicker, checkButton, usesLevelSteps } from './set-row.js';
import { groupLabel } from '../models/muscles.js';
import { listExercises } from '../models/exercises.js';
import { getSettings } from '../models/settings.js';
import { getEntries, saveSession, deleteSession } from '../models/sessions.js';
import { getSets, saveSet, deleteSet, lastExecution, initialSets, orderSets, dropDepth } from '../models/sets.js';
import { put, newId } from '../db.js';
import { compareToLast } from '../algorithm/compare.js';

const NOTE_SAVE_DELAY = 400;

export async function openActiveTraining(session, { onChanged } = {}) {
  const [exercises, settings, entries] = await Promise.all([listExercises(), getSettings(), getEntries(session.id)]);
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const setsByEntry = new Map();
  const lastByEntry = new Map();

  // Einheiten: einzelne Übung, Superset oder Komplex (aufeinanderfolgende Einträge mit gleicher groupId)
  const units = [];
  for (const entry of entries) {
    const previous = units.at(-1);
    if (entry.groupId && previous?.groupId === entry.groupId) previous.entries.push(entry);
    else units.push({ kind: entry.groupId ? entry.groupType : 'single', groupId: entry.groupId, entries: [entry] });
  }

  // Sätze laden; beim ersten Öffnen mit den Werten vom letzten Mal vorausfüllen
  for (const unit of units) {
    for (const entry of unit.entries) {
      lastByEntry.set(entry.id, await lastExecution(entry.exerciseId, entry.groupPosition, session.id));
      setsByEntry.set(entry.id, await getSets(entry.id));
    }
    const lead = unit.entries[0];
    if (setsByEntry.get(lead.id).length > 0) continue;

    const template = initialSets(lead, lastByEntry.get(lead.id), settings);
    const created = [[lead, template]];
    // Komplex: alle Bewegungen bekommen die gleiche Satzstruktur, Wiederholungen je Bewegung vom letzten Mal
    for (const member of unit.entries.slice(1)) {
      if (unit.kind === 'complex') {
        const own = lastByEntry.get(member.id)?.sets ?? [];
        created.push([member, mirrorSets(template, member, (set, depth) =>
          own.find((o) => o.index === set.index && dropDepth(o, own) === depth)?.reps ?? null)]);
      } else {
        created.push([member, initialSets(member, lastByEntry.get(member.id), settings)]);
      }
    }
    for (const [entry, sets] of created) {
      for (const set of sets) await saveSet(set);
      setsByEntry.set(entry.id, orderSets(sets));
    }
  }

  // Kopie einer Satzstruktur für eine andere Bewegung im Komplex
  function mirrorSets(template, entry, repsFor) {
    const idMap = new Map(template.map((set) => [set.id, newId()]));
    return template.map((set) => ({
      ...set,
      id: idMap.get(set.id),
      entryId: entry.id,
      dropFrom: set.dropFrom ? idMap.get(set.dropFrom) : undefined,
      reps: repsFor(set, dropDepth(set, template)),
    }));
  }

  const timer = createRestTimer();
  const expanded = new Set();
  let focus = null;

  const list = h('div', { class: 'active-list' });
  const unitEls = new Map();

  // ---- Hilfsfunktionen für Sätze ----

  const setsOf = (entry) => setsByEntry.get(entry.id);
  const mainIndexLabel = (set, sets) => sets.filter((s) => !s.dropFrom).indexOf(set) + 1;

  // Passender Satz einer anderen Bewegung im Komplex (gleiche Runde, gleiche Drop-Tiefe)
  function partnerSet(leadSet, leadSets, entry) {
    const depth = dropDepth(leadSet, leadSets);
    const sets = setsOf(entry);
    return sets.find((set) => set.index === leadSet.index && dropDepth(set, sets) === depth);
  }

  async function updateSet(entry, set, changes) {
    Object.assign(set, changes);
    await saveSet(set);
  }

  // Leere Werte eines offenen Satzes aus dem vorherigen Satz übernehmen
  function prefill(entry, set) {
    if (set.done) return;
    const sets = setsOf(entry);
    const before = sets.slice(0, sets.indexOf(set)).reverse();
    const source = before.find((s) => s.weight != null || s.level != null || s.seconds != null || s.reps != null);
    if (!source) return;
    const changes = {};
    for (const key of ['weight', 'level', 'seconds', 'reps']) {
      if (set[key] == null && source[key] != null) changes[key] = source[key];
    }
    if (Object.keys(changes).length) updateSet(entry, set, changes);
  }

  function nextOpenSet(fromUnitIndex) {
    for (let u = fromUnitIndex; u < units.length; u++) {
      for (const entry of units[u].entries.slice(0, units[u].kind === 'complex' ? 1 : undefined)) {
        const open = setsOf(entry).find((set) => !set.done);
        if (open) return { entryId: entry.id, setId: open.id, unitIndex: u };
      }
    }
    return null;
  }

  function restFor(set) {
    return { warmup: settings.restWarmup, volume: settings.restVolume, intense: settings.restIntense }[set.setType] ?? settings.restIntense;
  }

  // Nach dem Haken: Fokus weiter, Pausentimer starten (Superset: erst nach der letzten Übung der Runde)
  function advance(unitIndex, entry, set) {
    const unit = units[unitIndex];
    if (unit.kind === 'superset' && !set.dropFrom) {
      const position = unit.entries.indexOf(entry);
      for (const member of unit.entries.slice(position + 1)) {
        const open = setsOf(member).find((s) => s.index === set.index && !s.done && !s.dropFrom);
        if (open) {
          focus = { entryId: member.id, setId: open.id, unitIndex };
          return;
        }
      }
      // Runde komplett: Pause, dann erste Übung der nächsten Runde
      const nextRound = unit.entries.map((member) => setsOf(member).find((s) => !s.done && !s.dropFrom)).find(Boolean);
      if (nextRound) {
        focus = { entryId: nextRound.entryId, setId: nextRound.id, unitIndex };
        timer.start(restFor(set));
        return;
      }
    }
    focus = nextOpenSet(unitIndex);
    if (!set.dropFrom && focus) timer.start(restFor(set));
  }

  function rerender(unitIndex) {
    const el = renderUnit(units[unitIndex], unitIndex);
    unitEls.get(unitIndex).replaceWith(el);
    unitEls.set(unitIndex, el);
  }

  function scrollToFocus() {
    if (!focus) return;
    requestAnimationFrame(() => {
      list.querySelector(`[data-set-id="${focus.setId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // ---- Darstellung ----

  function lastLine(entry, exercise, last, complexMembers) {
    if (!last) return h('p', { class: 'last-line' }, 'Erstes Mal – noch keine Werte');
    const sets = last.sets;
    const groups = [];
    for (const set of sets) {
      let text;
      if (complexMembers) {
        const reps = complexMembers.map((member) => {
          const own = lastByEntry.get(member.id)?.sets ?? [];
          return own.find((o) => o.index === set.index && dropDepth(o, own) === dropDepth(set, sets))?.reps ?? '–';
        }).join('/');
        text = setSummary(set, exercise, reps);
      } else {
        text = setSummary(set, exercise);
      }
      if (set.dropFrom && groups.length) groups[groups.length - 1] += ` → ${text}`;
      else groups.push(text);
    }
    return h('p', { class: 'last-line' },
      h('strong', {}, `Letztes Mal · ${formatDate(last.session.date)}`),
      !last.sameContext && h('span', { class: 'last-context' }, ' · anderer Kontext'),
      h('br'),
      groups.join(' · ')
    );
  }

  function exerciseHeader(entry, exercise, extra) {
    const url = photoUrl(exercise.photo);
    const last = lastByEntry.get(entry.id);
    return h('div', { class: 'ex-header' },
      h('span', { class: 'ex-thumb', style: url ? `background-image: url("${url}")` : null }, url ? null : exercise.name.charAt(0).toUpperCase()),
      h('div', { class: 'ex-title' },
        h('p', { class: 'ex-name' }, exercise.name),
        h('p', { class: 'ex-meta' }, [exercise.location, groupLabel(exercise.muscleGroup), exercise.unilateral ? 'einseitig' : null].filter(Boolean).join(' · ')),
        exercise.setupNotes && h('p', { class: 'ex-setup' }, icon(icons.settings), exercise.setupNotes),
        extra,
        last?.entry.note && h('p', { class: 'ex-last-note' }, `Notiz vom letzten Mal: ${last.entry.note}`)
      )
    );
  }

  function noteField(entries) {
    const entry = entries[0];
    let timeout = null;
    const textarea = h('textarea', {
      class: 'field field-area',
      rows: 2,
      placeholder: 'Notiz zu dieser Übung',
      value: entry.note ?? '',
      oninput: () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          entry.note = textarea.value.trim();
          put('entries', entry);
        }, NOTE_SAVE_DELAY);
      },
    });
    const wrapper = h('div', { class: 'ex-note', hidden: !entry.note }, textarea);
    const toggle = h('button', {
      type: 'button',
      class: 'ex-action',
      onclick: () => {
        wrapper.hidden = !wrapper.hidden;
        if (!wrapper.hidden) textarea.focus();
      },
    }, 'Notiz');
    return { wrapper, toggle };
  }

  // Satz-Zeilen einer Übung (bei Komplex: Hauptbewegung, Partner werden mitgeführt)
  function setRows(unit, unitIndex) {
    const lead = unit.entries[0];
    const exercise = exerciseById.get(lead.exerciseId);
    const sets = setsOf(lead);
    const isComplex = unit.kind === 'complex';
    const members = isComplex ? unit.entries : [lead];

    const applyAll = async (set, changes) => {
      for (const member of members) {
        const target = member === lead ? set : partnerSet(set, sets, member);
        if (target) await updateSet(member, target, changes);
      }
    };

    return sets.map((set) => {
      const depth = dropDepth(set, sets);
      const isFocus = focus?.setId === set.id;
      const isOpen = isFocus || expanded.has(set.id);
      const lastInChain = !sets.some((s) => s.dropFrom === set.id);

      const repsText = isComplex
        ? members.map((member) => (member === lead ? set : partnerSet(set, sets, member))?.reps ?? '–').join('/')
        : set.reps;

      if (!isOpen) {
        return h('div', {
          class: `set-row is-compact${set.done ? ' is-done' : ''}`,
          style: depth ? `--depth: ${depth}` : null,
          dataset: { setId: set.id },
        },
          typeBadge(set),
          h('button', {
            type: 'button',
            class: 'set-compact-text',
            onclick: () => {
              expanded.add(set.id);
              rerender(unitIndex);
            },
          },
            h('span', { class: 'num' }, setSummary(set, exercise, repsText)),
            set.rir != null && h('span', { class: 'set-rir num' }, ` · RIR ${set.rir}`)
          ),
          set.done && lastInChain && set.setType !== 'warmup' && h('button', { type: 'button', class: 'drop-btn', onclick: () => addDrop(unit, unitIndex, set) }, '+ Drop'),
          set.done ? h('span', { class: 'set-done-mark', 'aria-label': 'Erledigt' }, icon(icons.check)) : null
        );
      }

      if (!set.done) {
        for (const member of members) {
          const target = member === lead ? set : partnerSet(set, sets, member);
          if (target) prefill(member, target);
        }
      }

      const title = set.dropFrom ? 'Drop' : `Satz ${mainIndexLabel(set, sets)}`;
      const loadInput = loadStepper(set, exercise, settings, (changes) => applyAll(set, changes));

      let repsInputs;
      if (exercise.type === 'time') {
        repsInputs = null;
      } else if (isComplex) {
        repsInputs = h('div', { class: 'complex-reps' }, members.map((member) => {
          const target = member === lead ? set : partnerSet(set, sets, member);
          const memberExercise = exerciseById.get(member.exerciseId);
          return h('div', { class: 'complex-rep-row' },
            h('span', { class: 'complex-rep-name' }, memberExercise?.name ?? 'Bewegung'),
            repsStepper(target?.reps, (reps) => target && updateSet(member, target, { reps }), `Wiederholungen ${memberExercise?.name ?? ''}`)
          );
        }));
      } else {
        repsInputs = repsStepper(set.reps, (reps) => updateSet(lead, set, { reps }), 'Wiederholungen', exercise.unilateral);
      }

      const toggleDone = async () => {
        unlockAudio();
        if (!set.done) {
          const missingLoad = exercise.type === 'time' ? set.seconds == null
            : usesLevelSteps(exercise) ? set.level == null
            : exercise.type === 'weight' || exercise.type === 'assisted' ? set.weight == null : false;
          if (missingLoad || (exercise.type !== 'time' && set.reps == null)) {
            toast(exercise.type === 'time' ? 'Bitte Sekunden eintragen.' : 'Bitte Gewicht/Stufe und Wiederholungen eintragen.', { variant: 'danger' });
            return;
          }
          await applyAll(set, { done: true });
          expanded.delete(set.id);
          advance(unitIndex, lead, set);
          renderAll();
          scrollToFocus();
        } else {
          await applyAll(set, { done: false });
          focus = { entryId: lead.id, setId: set.id, unitIndex };
          rerender(unitIndex);
        }
      };

      return h('div', {
        class: `set-row is-open${set.done ? ' is-done' : ''}${isFocus ? ' is-focus' : ''}`,
        style: depth ? `--depth: ${depth}` : null,
        dataset: { setId: set.id },
      },
        h('div', { class: 'set-head' },
          typeBadge(set, (setType) => applyAll(set, { setType }).then(() => rerender(unitIndex))),
          h('span', { class: 'set-title' }, title),
          !isFocus && h('button', {
            type: 'button',
            class: 'set-collapse',
            onclick: () => {
              expanded.delete(set.id);
              rerender(unitIndex);
            },
          }, 'Zuklappen'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Satz löschen', onclick: () => removeSet(unit, unitIndex, set) }, icon(icons.trash))
        ),
        h('div', { class: `set-inputs${repsInputs && !isComplex ? ' is-pair' : ''}` }, loadInput, repsInputs),
        h('div', { class: 'set-foot' },
          rirPicker(set.rir, (rir) => applyAll(set, { rir })),
          checkButton(set.done, toggleDone)
        )
      );
    });
  }

  async function addSet(unit, unitIndex) {
    const lead = unit.entries[0];
    const sets = setsOf(lead);
    const mains = sets.filter((s) => !s.dropFrom);
    const lastMain = mains.at(-1);
    const index = (lastMain?.index ?? 0) + 1;
    const members = unit.kind === 'complex' ? unit.entries : [lead];
    let leadSet;
    for (const member of members) {
      const memberSets = setsOf(member);
      const source = memberSets.filter((s) => !s.dropFrom).at(-1);
      const set = {
        id: newId(), entryId: member.id, index,
        setType: source?.setType === 'warmup' ? 'volume' : source?.setType ?? 'intense',
        weight: source?.weight, level: source?.level, reps: source?.reps, seconds: source?.seconds,
        rir: null, done: false,
      };
      await saveSet(set);
      setsByEntry.set(member.id, orderSets([...memberSets, set]));
      leadSet ??= set;
    }
    focus = { entryId: lead.id, setId: leadSet.id, unitIndex };
    rerender(unitIndex);
    scrollToFocus();
  }

  // Drop anhängen: leichter (zwei Stufen), gleiche Wiederholungen als Startwert
  async function addDrop(unit, unitIndex, fromSet) {
    timer.stop();
    const lead = unit.entries[0];
    const exercise = exerciseById.get(lead.exerciseId);
    const leadSets = setsOf(lead);
    const members = unit.kind === 'complex' ? unit.entries : [lead];
    let leadDrop;
    for (const member of members) {
      const parent = member === lead ? fromSet : partnerSet(fromSet, leadSets, member);
      if (!parent) continue;
      const drop = {
        id: newId(), entryId: member.id, index: parent.index, setType: 'drop', dropFrom: parent.id,
        weight: lighter(parent.weight, exercise), level: lighterLevel(parent.level, exercise),
        reps: parent.reps, seconds: parent.seconds, rir: null, done: false,
      };
      await saveSet(drop);
      setsByEntry.set(member.id, orderSets([...setsOf(member), drop]));
      leadDrop ??= drop;
    }
    focus = { entryId: lead.id, setId: leadDrop.id, unitIndex };
    rerender(unitIndex);
    scrollToFocus();
  }

  function lighter(weight, exercise) {
    if (weight == null || usesLevelSteps(exercise)) return weight;
    const step = exercise.steps?.step ?? 2.5;
    // Assistenz: mehr Hilfe = leichter
    if (exercise.type === 'assisted') return weight + 2 * step;
    return Math.max(exercise.steps?.min ?? 0, Math.round((weight - 2 * step) * 100) / 100);
  }

  function lighterLevel(level, exercise) {
    if (level == null || !usesLevelSteps(exercise)) return level;
    const { levels, harderDirection } = exercise.steps;
    const index = levels.findIndex((l) => String(l) === String(level));
    const next = harderDirection === 'down' ? index + 1 : index - 1;
    return levels[Math.min(levels.length - 1, Math.max(0, next))];
  }

  async function removeSet(unit, unitIndex, set) {
    if (set.done) {
      const ok = await confirmSheet({ title: 'Satz löschen?', text: 'Der abgehakte Satz und angehängte Drops werden gelöscht.', confirmLabel: 'Löschen' });
      if (!ok) return;
    }
    const lead = unit.entries[0];
    const leadSets = setsOf(lead);
    const members = unit.kind === 'complex' ? unit.entries : [lead];
    for (const member of members) {
      const target = member === lead ? set : partnerSet(set, leadSets, member);
      if (!target) continue;
      await deleteSet(target, setsOf(member));
      setsByEntry.set(member.id, await getSets(member.id));
    }
    if (focus?.setId === set.id) focus = nextOpenSet(unitIndex);
    rerender(unitIndex);
  }

  function exerciseCard(unit, unitIndex, entry) {
    const exercise = exerciseById.get(entry.exerciseId);
    const note = noteField([entry]);
    const subUnit = { kind: 'single', entries: [entry] };
    return h('article', { class: 'ex-card', dataset: { entryId: entry.id } },
      exerciseHeader(entry, exercise, lastLine(entry, exercise, lastByEntry.get(entry.id))),
      h('div', { class: 'set-list' }, setRows(subUnit, unitIndex)),
      h('div', { class: 'ex-actions' },
        h('button', { type: 'button', class: 'ex-action', onclick: () => addSet(subUnit, unitIndex) }, icon(icons.plus), 'Satz'),
        note.toggle
      ),
      note.wrapper
    );
  }

  function renderUnit(unit, unitIndex) {
    if (unit.kind === 'single') return exerciseCard(unit, unitIndex, unit.entries[0]);

    if (unit.kind === 'complex') {
      const lead = unit.entries[0];
      const exercise = exerciseById.get(lead.exerciseId);
      const note = noteField([lead]);
      const names = unit.entries.map((entry) => exerciseById.get(entry.exerciseId)?.name ?? '?');
      return h('article', { class: 'ex-card ex-complex', dataset: { entryId: lead.id } },
        h('p', { class: 'eyebrow eyebrow-complex' }, 'Komplex · ein Gewicht, ohne Pause'),
        exerciseHeader(lead, { ...exercise, name: names.join(' + ') }, lastLine(lead, exercise, lastByEntry.get(lead.id), unit.entries)),
        h('div', { class: 'set-list' }, setRows(unit, unitIndex)),
        h('div', { class: 'ex-actions' },
          h('button', { type: 'button', class: 'ex-action', onclick: () => addSet(unit, unitIndex) }, icon(icons.plus), 'Runde'),
          note.toggle
        ),
        note.wrapper
      );
    }

    // Superset: Klammer links, Runde x/y
    const rounds = Math.max(...unit.entries.map((entry) => setsOf(entry).filter((s) => !s.dropFrom).length));
    const doneRounds = Math.min(...unit.entries.map((entry) => setsOf(entry).filter((s) => !s.dropFrom && s.done).length));
    return h('section', { class: 'superset' },
      h('p', { class: 'eyebrow' }, `Superset · Runde ${Math.min(doneRounds + 1, rounds)}/${rounds}`),
      h('div', { class: 'superset-body' }, unit.entries.map((entry) => exerciseCard(unit, unitIndex, entry)))
    );
  }

  function renderAll() {
    unitEls.clear();
    list.replaceChildren(...units.map((unit, index) => {
      const el = renderUnit(unit, index);
      unitEls.set(index, el);
      return el;
    }));
  }

  // ---- Abschluss ----

  function openFinish() {
    const summary = units.map((unit) => {
      const lead = unit.entries[0];
      const exercise = exerciseById.get(lead.exerciseId);
      const done = setsOf(lead).filter((set) => set.done);
      const trend = compareToLast(setsOf(lead), lastByEntry.get(lead.id)?.sets, exercise);
      const names = unit.kind === 'complex' ? unit.entries.map((e) => exerciseById.get(e.exerciseId)?.name).join(' + ') : null;
      return { unit, exercise, names, done, trend };
    });
    const rows = summary.flatMap(({ unit, exercise, names, done, trend }) => {
      if (unit.kind === 'superset') {
        return unit.entries.map((entry) => {
          const ex = exerciseById.get(entry.exerciseId);
          const sets = setsOf(entry);
          return { name: ex.name, count: sets.filter((s) => s.done).length, trend: compareToLast(sets, lastByEntry.get(entry.id)?.sets, ex) };
        });
      }
      return [{ name: names ?? exercise.name, count: done.length, trend }];
    });

    const totalDone = rows.reduce((sum, row) => sum + row.count, 0);
    const openSets = units.flatMap((unit) => unit.entries).reduce((sum, entry) => sum + setsOf(entry).filter((s) => !s.done).length, 0);
    const trendSymbol = { 1: '▲', 0: '●', '-1': '▼' };
    const trendClass = { 1: 'up', 0: 'same', '-1': 'down' };

    const noteInput = h('textarea', { class: 'field field-area', rows: 3, placeholder: 'Wie lief das Training?', value: session.note ?? '' });

    const save = async () => {
      for (const entry of units.flatMap((unit) => unit.entries)) {
        for (const set of setsOf(entry).filter((s) => !s.done)) await deleteSet(set, []);
      }
      await saveSession({ ...session, note: noteInput.value.trim(), status: 'done' });
      timer.stop();
      closeFinish();
      closeTraining();
      toast('Training gespeichert', { variant: 'success' });
      onChanged?.();
    };

    const discard = async () => {
      const ok = await confirmSheet({ title: 'Training verwerfen?', text: 'Alle Sätze dieses Trainings werden gelöscht.', confirmLabel: 'Verwerfen' });
      if (!ok) return;
      await deleteSession(session.id);
      timer.stop();
      closeFinish();
      closeTraining();
      toast('Training verworfen');
      onChanged?.();
    };

    const closeFinish = openView({
      title: 'Training beenden',
      content: h('div', { class: 'form' },
        h('div', { class: 'card' },
          h('p', { class: 'eyebrow' }, 'Zusammenfassung'),
          h('p', { class: 'finish-total num' }, `${rows.length} Übungen · ${totalDone} Sätze`),
          h('ul', { class: 'list' }, rows.map((row) =>
            h('li', { class: 'list-row' },
              h('span', { class: 'list-label' }, row.name),
              h('span', { class: 'list-value meta num' }, `${row.count} Sätze`),
              h('span', { class: `trend trend-${row.trend == null ? 'none' : trendClass[row.trend]}`, title: 'Im Vergleich zum letzten Mal' },
                row.trend == null ? 'neu' : trendSymbol[row.trend])
            )
          )),
          h('p', { class: 'hint' }, '▲ besser · ● gleich · ▼ schwächer als letztes Mal (bester Arbeitssatz)')
        ),
        openSets > 0 && h('p', { class: 'status status-warning' }, `${openSets} nicht abgehakte Sätze werden beim Speichern verworfen.`),
        h('label', { class: 'form-field' }, h('span', { class: 'form-label' }, 'Notiz zum Training'), noteInput),
        h('button', { type: 'button', class: 'btn btn-danger btn-block', onclick: discard }, icon(icons.trash), 'Training verwerfen')
      ),
      footer: h('button', { type: 'button', class: 'btn btn-primary btn-block', disabled: totalDone === 0, onclick: save },
        totalDone === 0 ? 'Noch kein Satz abgehakt' : 'Training speichern'),
    });
  }

  // ---- Bildschirm an lassen, solange das Training offen ist ----

  let wakeLock = null;
  const requestWakeLock = async () => {
    try {
      wakeLock = await navigator.wakeLock?.request('screen');
    } catch {
      wakeLock = null;
    }
  };
  const onVisible = () => document.visibilityState === 'visible' && requestWakeLock();
  requestWakeLock();
  document.addEventListener('visibilitychange', onVisible);

  focus = nextOpenSet(0);
  renderAll();

  const header = h('div', { class: 'active-header' },
    h('p', { class: 'eyebrow' }, session.muscleGroups.map(groupLabel).join(' · ')),
    h('p', { class: 'meta' }, `Gestartet am ${formatDate(session.date)} · wird automatisch gespeichert`)
  );

  const closeTraining = openView({
    title: 'Training',
    content: h('div', { class: 'active' }, header, list),
    footer: h('div', { class: 'active-footer' },
      timer.el,
      h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: openFinish }, 'Training beenden')
    ),
    onClose: () => {
      document.removeEventListener('visibilitychange', onVisible);
      wakeLock?.release?.();
      timer.destroy();
      onChanged?.();
    },
  });
  scrollToFocus();
}
