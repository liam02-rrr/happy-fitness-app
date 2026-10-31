// Ablauf „Training starten“ (SPEC.md, Abschnitt 6.2, Schritte 1–5) in einer Vollbild-Ansicht:
// 1. Muskelgruppen, Zeit, Tagesform · 2. Übungsauswahl · 3. Planung (Reihenfolge, Supersets, Komplexe)
// backfill: vergessenes Training nachtragen (SPEC 6.3) – mit Datum, ohne laufendes Training zu starten
import { h, icon } from './dom.js';
import { icons } from './icons.js';
import { openView } from './view.js';
import { toast } from './toast.js';
import { segmented, pills, formSection } from './controls.js';
import { photoUrl } from './photo.js';
import { daysAgoLabel, todayISO } from './format.js';
import { MUSCLE_GROUPS, groupLabel } from '../models/muscles.js';
import { listExercises, displayName } from '../models/exercises.js';
import { TIME_MODES, FEELINGS, ILLNESS, GROUP_TYPES, startSession, lastDoneByExercise } from '../models/sessions.js';

export async function openTrainingFlow({ onStarted, backfill = false }) {
  const [exercises, lastDone] = await Promise.all([listExercises(), lastDoneByExercise()]);
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

  const setup = { muscleGroups: [], timeMode: 'normal', feeling: 'normal', illness: 'none', date: todayISO() };
  // Plan als Blöcke: einzelne Übung oder Gruppe (Superset/Komplex)
  let blocks = [];
  let step = 1;

  const body = h('div', { class: 'form' });
  const footer = h('div', {});

  const selectedIds = () => blocks.flatMap((block) => block.exerciseIds);

  function render() {
    body.replaceChildren(stepIndicator(), ...(step === 1 ? renderSetup() : step === 2 ? renderSelect() : renderPlan()));
    body.closest('.view-body')?.scrollTo(0, 0);
  }

  function stepIndicator() {
    const titles = ['Tagesform', 'Übungen wählen', 'Planung'];
    return h('div', { class: 'steps' },
      titles.map((title, index) => h('span', { class: `steps-item${index + 1 === step ? ' is-active' : ''}${index + 1 < step ? ' is-done' : ''}` }, title))
    );
  }

  // Schritt 1: Muskelgruppen, Zeit, Tagesform
  function renderSetup() {
    const nextButton = h('button', { type: 'button', class: 'btn btn-primary btn-block', disabled: setup.muscleGroups.length === 0, onclick: () => go(2) }, 'Weiter zur Übungsauswahl');
    footer.replaceChildren(nextButton);
    const dateInput = backfill && h('input', {
      class: 'field', type: 'date', value: setup.date, max: todayISO(),
      onchange: () => { setup.date = dateInput.value || setup.date; },
    });
    return [
      backfill && formSection('Datum', dateInput),
      formSection('Muskelgruppen',
        pills(MUSCLE_GROUPS, setup.muscleGroups, (groups) => {
          setup.muscleGroups = groups;
          nextButton.disabled = groups.length === 0;
        }, { multi: true })
      ),
      formSection('Zeit', segmented(TIME_MODES, setup.timeMode, (value) => { setup.timeMode = value; })),
      formSection('Gefühl', segmented(FEELINGS, setup.feeling, (value) => { setup.feeling = value; })),
      formSection('Krankheit', pills(ILLNESS, setup.illness, (value) => { setup.illness = value; })),
    ];
  }

  // Schritt 2: Übungen der gewählten Gruppen, längste Pause zuerst, nie trainierte unter „Neu“
  function renderSelect() {
    const countButton = h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: () => go(3) });
    const updateFooter = () => {
      const count = selectedIds().length;
      countButton.disabled = count === 0;
      countButton.textContent = count ? `Weiter zur Planung (${count})` : 'Übungen antippen';
    };
    updateFooter();
    footer.replaceChildren(countButton);

    const active = exercises.filter((exercise) => !exercise.archived);
    const inGroups = active.filter((exercise) => exercise.category === 'strength' && setup.muscleGroups.includes(exercise.muscleGroup));
    const others = active.filter((exercise) => !inGroups.includes(exercise));

    const done = inGroups.filter((exercise) => lastDone.has(exercise.id))
      .sort((a, b) => lastDone.get(a.id).localeCompare(lastDone.get(b.id)));
    const fresh = inGroups.filter((exercise) => !lastDone.has(exercise.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));

    const cards = new Map();
    const refreshBadges = () => {
      const ids = selectedIds();
      for (const [id, card] of cards) {
        const position = ids.indexOf(id);
        card.classList.toggle('is-selected', position >= 0);
        card.querySelector('.pick-badge').textContent = position >= 0 ? String(position + 1) : '';
      }
      updateFooter();
    };

    const toggle = (id) => {
      if (selectedIds().includes(id)) removeExercise(id);
      else blocks.push({ type: 'single', exerciseIds: [id] });
      refreshBadges();
    };

    const pickCard = (exercise) => {
      const url = photoUrl(exercise.photo);
      const last = lastDone.get(exercise.id);
      const card = h('button', {
        type: 'button',
        class: `pick-card${url ? ' has-photo' : ''}`,
        style: url ? `background-image: url("${url}")` : null,
        'aria-label': displayName(exercise),
        onclick: () => toggle(exercise.id),
      },
        h('span', { class: 'pick-badge', 'aria-hidden': 'true' }),
        !url && h('span', { class: 'exercise-card-initial', 'aria-hidden': 'true' }, exercise.name.charAt(0).toUpperCase()),
        h('span', { class: 'exercise-card-text' },
          h('span', { class: 'pick-name' }, exercise.name),
          h('span', { class: 'exercise-card-meta' }, [exercise.location, last ? daysAgoLabel(last) : null].filter(Boolean).join(' · '))
        )
      );
      cards.set(exercise.id, card);
      return card;
    };

    const grid = (list) => h('div', { class: 'pick-grid' }, list.map(pickCard));
    const parts = [];
    if (inGroups.length === 0) {
      parts.push(h('div', { class: 'card placeholder' },
        h('p', { class: 'card-title' }, 'Keine Übungen in diesen Gruppen'),
        h('p', { class: 'card-text' }, 'Lege sie im Tab „Übungen“ an oder wähle unten aus weiteren Übungen.')));
    }
    if (done.length) parts.push(formSection('Längste Pause zuerst', grid(done)));
    if (fresh.length) parts.push(formSection('Neu', grid(fresh)));
    if (others.length) {
      parts.push(h('details', { class: 'more-exercises' },
        h('summary', {}, `Weitere Übungen (${others.length})`),
        h('p', { class: 'hint' }, 'Andere Muskelgruppen und Mobility'),
        grid(others.sort((a, b) => a.name.localeCompare(b.name, 'de')))
      ));
    }
    queueMicrotask(refreshBadges);
    return parts;
  }

  function removeExercise(id) {
    blocks = blocks
      .map((block) => ({ ...block, exerciseIds: block.exerciseIds.filter((exerciseId) => exerciseId !== id) }))
      .filter((block) => block.exerciseIds.length > 0)
      .map((block) => (block.exerciseIds.length === 1 ? { ...block, type: 'single' } : block));
  }

  // Schritt 3: Reihenfolge per Ziehen, Übungen zu Superset oder Komplex verbinden
  function renderPlan() {
    const list = h('div', { class: 'plan-list' });

    const startButton = backfill
      ? h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: start }, 'Weiter zum Eintragen')
      : h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: start }, icon(icons.play), 'Training starten');
    footer.replaceChildren(startButton);

    const exerciseRow = (id, handle) => {
      const exercise = byId.get(id);
      const url = photoUrl(exercise.photo);
      return h('div', { class: 'plan-row' },
        handle ?? h('span', { class: 'plan-handle-space' }),
        h('span', { class: 'plan-thumb', style: url ? `background-image: url("${url}")` : null }, url ? null : exercise.name.charAt(0).toUpperCase()),
        h('span', { class: 'plan-text' },
          h('span', { class: 'plan-name' }, exercise.name),
          h('span', { class: 'plan-meta' }, [exercise.location, groupLabel(exercise.muscleGroup)].filter(Boolean).join(' · '))
        ),
        h('button', {
          type: 'button',
          class: 'icon-btn',
          'aria-label': `${exercise.name} entfernen`,
          onclick: () => {
            removeExercise(id);
            if (blocks.length === 0) go(2);
            else draw();
          },
        }, icon(icons.close))
      );
    };

    const dragHandle = (index) => {
      const handle = h('span', { class: 'plan-handle', 'aria-label': 'Ziehen zum Sortieren', role: 'button' }, icon(icons.grip));
      handle.addEventListener('pointerdown', (event) => startDrag(event, index));
      return handle;
    };

    function draw() {
      const children = [];
      blocks.forEach((block, index) => {
        if (index > 0) {
          children.push(h('button', {
            type: 'button',
            class: 'plan-link',
            onclick: () => {
              const [above, below] = [blocks[index - 1], blocks[index]];
              const type = above.type !== 'single' ? above.type : below.type !== 'single' ? below.type : 'superset';
              blocks.splice(index - 1, 2, { type, exerciseIds: [...above.exerciseIds, ...below.exerciseIds] });
              draw();
            },
          }, icon(icons.link), 'Verbinden'));
        }

        if (block.type === 'single') {
          children.push(h('div', { class: 'plan-block', dataset: { index } }, exerciseRow(block.exerciseIds[0], dragHandle(index))));
        } else {
          children.push(h('div', { class: `plan-block plan-group plan-group-${block.type}`, dataset: { index } },
            h('div', { class: 'plan-group-header' },
              dragHandle(index),
              segmented(GROUP_TYPES, block.type, (type) => {
                block.type = type;
                draw();
              }),
              h('button', {
                type: 'button',
                class: 'icon-btn',
                'aria-label': 'Gruppe lösen',
                onclick: () => {
                  blocks.splice(index, 1, ...block.exerciseIds.map((id) => ({ type: 'single', exerciseIds: [id] })));
                  draw();
                },
              }, icon(icons.unlink))
            ),
            block.type === 'complex' && h('p', { class: 'plan-group-hint' }, 'Ein Gewicht für alle Bewegungen, ohne Pause'),
            block.exerciseIds.map((id) => exerciseRow(id))
          ));
        }
      });
      list.replaceChildren(...children);
    }

    // Ziehen zum Sortieren: der Block folgt dem Finger, beim Loslassen wird neu einsortiert
    function startDrag(event, index) {
      event.preventDefault();
      const blockEls = [...list.querySelectorAll('.plan-block')];
      const dragged = blockEls[index];
      const startY = event.clientY;
      const others = blockEls.filter((el) => el !== dragged).map((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top + rect.height / 2;
      });
      dragged.classList.add('is-dragging');
      list.classList.add('is-sorting');
      event.target.setPointerCapture?.(event.pointerId);

      const move = (moveEvent) => {
        dragged.style.transform = `translateY(${moveEvent.clientY - startY}px)`;
      };
      const end = (endEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        const rect = dragged.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const target = others.filter((mid) => mid < center).length;
        const [moved] = blocks.splice(index, 1);
        blocks.splice(endEvent.type === 'pointercancel' ? index : target, 0, moved);
        list.classList.remove('is-sorting');
        draw();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    }

    draw();
    return [
      h('p', { class: 'hint' }, 'Am Griff ziehen, um die Reihenfolge zu ändern. „Verbinden“ macht aus zwei Übungen ein Superset oder einen Komplex.'),
      list,
      h('button', { type: 'button', class: 'btn btn-ghost btn-block', onclick: () => go(2) }, icon(icons.plus), 'Übungen hinzufügen'),
    ];
  }

  async function start() {
    try {
      const session = await startSession(backfill ? { ...setup, status: 'planned' } : { ...setup, date: undefined }, blocks);
      close();
      if (!backfill) toast('Training gestartet', { variant: 'success' });
      onStarted?.(session);
    } catch (error) {
      console.error(error);
      toast('Training konnte nicht gestartet werden.', { variant: 'danger' });
    }
  }

  function go(next) {
    step = next;
    render();
  }

  const close = openView({
    title: backfill ? 'Training nachtragen' : 'Training starten',
    content: body,
    footer,
    onBack: () => (step > 1 ? go(step - 1) : close()),
  });
  render();
}
