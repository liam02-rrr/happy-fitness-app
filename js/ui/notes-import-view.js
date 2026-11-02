// Notizen importieren (SPEC.md, Abschnitt 6.6 und 9): Text oder Datei → Vorschau mit Fehlerliste → Speichern.
import { h, icon } from './dom.js';
import { icons } from './icons.js';
import { openView } from './view.js';
import { toast } from './toast.js';
import { formatDate, plural } from './format.js';
import { setSummary, typeBadge } from './set-row.js';
import { openExerciseEditor } from './exercise-editor.js';
import { groupLabel } from '../models/muscles.js';
import { listExercises, displayName } from '../models/exercises.js';
import { listSessions, FEELINGS } from '../models/sessions.js';
import { getSettings } from '../models/settings.js';
import { buildImport, commitImport } from '../import/notes-import.js';

const SAMPLE_URL = './import/notizen.txt';

export function openNotesImport({ onImported } = {}) {
  let step = 'input';
  let plan = null;
  const body = h('div', { class: 'form' });
  const footer = h('div', {});

  const textarea = h('textarea', {
    class: 'field field-area notes-text',
    rows: 12,
    spellcheck: false,
    autocapitalize: 'off',
    placeholder: '## 2026-10-18 | Beine | gefuehl=normal | krankheit=keine\nLeg Extension @ Phoenix | gewicht | legs | 30x20 ; 40x12 ; 50x10',
  });

  const fileInput = h('input', { type: 'file', accept: '.txt,text/plain', hidden: true });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    textarea.value = await file.text();
    toast(`${file.name} geladen`);
  });

  async function loadSample() {
    try {
      const response = await fetch(SAMPLE_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      textarea.value = await response.text();
      toast('notizen.txt geladen');
    } catch {
      toast('notizen.txt konnte nicht geladen werden. Bist du online?', { variant: 'danger', duration: 3500 });
    }
  }

  async function check() {
    if (!textarea.value.trim()) {
      toast('Bitte zuerst Text einfügen oder eine Datei wählen.', { variant: 'danger' });
      return;
    }
    const [exercises, sessions, settings] = await Promise.all([listExercises(), listSessions(), getSettings()]);
    plan = buildImport(textarea.value, { exercises, sessions, settings });
    step = 'preview';
    render();
  }

  async function save() {
    try {
      await commitImport(plan);
      step = 'done';
      render();
      onImported?.();
    } catch (error) {
      console.error(error);
      toast('Import fehlgeschlagen. Deine Daten sind unverändert.', { variant: 'danger', duration: 4000 });
    }
  }

  function renderInput() {
    footer.replaceChildren(h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: check }, 'Prüfen'));
    return [
      h('p', { class: 'hint' }, 'Füge deine Notizen im Format aus der Anleitung ein oder wähle eine Textdatei. Vor dem Speichern siehst du eine Vorschau.'),
      textarea,
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => fileInput.click() }, icon(icons.upload), 'Datei wählen'),
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: loadSample }, 'notizen.txt laden')
      ),
      fileInput,
    ];
  }

  function messageList(items, variant) {
    return h('ul', { class: `message-list message-${variant}` },
      items.map((item) => h('li', {}, h('strong', { class: 'num' }, `Zeile ${item.line}: `), item.message))
    );
  }

  function renderPreview() {
    const setCount = plan.sets.length;
    const hasErrors = plan.errors.length > 0;
    const nothing = plan.sessions.length === 0;
    footer.replaceChildren(h('button', {
      type: 'button',
      class: 'btn btn-primary btn-block',
      disabled: hasErrors || nothing,
      onclick: save,
    }, hasErrors ? 'Erst Fehler beheben' : nothing ? 'Nichts zu importieren' : `${plural(plan.sessions.length, 'Training', 'Trainings')} importieren`));

    const feelingLabel = (id) => FEELINGS.find((f) => f.id === id)?.label ?? id;

    return [
      h('section', { class: 'card' },
        h('p', { class: 'eyebrow' }, 'Vorschau'),
        h('p', { class: 'finish-total num' }, `${plural(plan.sessions.length, 'Training', 'Trainings')} · ${plural(setCount, 'Satz', 'Sätze')}`),
        h('p', { class: 'card-text' }, `${plural(plan.newExercises.length, 'neue Übung', 'neue Übungen')} werden angelegt.`)
      ),
      hasErrors && h('section', { class: 'card' },
        h('p', { class: 'card-title text-danger' }, plural(plan.errors.length, 'Fehler', 'Fehler')),
        messageList(plan.errors, 'error'),
        h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: () => { step = 'input'; render(); } }, 'Text korrigieren')
      ),
      plan.warnings.length > 0 && h('section', { class: 'card' },
        h('p', { class: 'card-title text-warning' }, plural(plan.warnings.length, 'Hinweis', 'Hinweise')),
        messageList(plan.warnings, 'warning')
      ),
      ...plan.sessions.map(({ preview }) => h('section', { class: 'card import-session' },
        h('p', { class: 'eyebrow' }, formatDate(preview.date)),
        h('p', { class: 'card-title' }, preview.muscleGroups.map(groupLabel).join(', ') || 'Training'),
        h('p', { class: 'meta' }, `Gefühl: ${feelingLabel(preview.feeling)}${preview.illness !== 'none' ? ' · angeschlagen' : ''}`),
        preview.blocks.map((block) => h('div', { class: `import-block import-${block.type}` },
          block.type !== 'single' && h('p', { class: 'eyebrow' }, block.type === 'superset' ? 'Superset' : 'Komplex'),
          block.items.map((item) => h('div', { class: 'import-item' },
            h('p', { class: 'import-name' }, displayName(item.exercise), item.isNew && h('span', { class: 'mini-chip mini-chip-accent' }, 'neu')),
            h('div', { class: 'import-sets' }, item.sets.map((set) =>
              h('span', { class: `import-set${set.dropFrom ? ' is-drop' : ''}` }, typeBadge(set), setSummary(set, item.exercise)))),
            item.note && h('p', { class: 'meta' }, `Notiz: ${item.note}`)
          ))
        ))
      )),
      h('p', { class: 'hint' }, 'A = Aufwärmen, V = Volumen, I = Intensiv, D = Drop. Die Satztypen werden automatisch zugeordnet (schwerste Sätze = intensiv).'),
    ];
  }

  function renderDone() {
    footer.replaceChildren(h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: () => close() }, 'Fertig'));
    return [
      h('section', { class: 'card card-accent' },
        h('p', { class: 'eyebrow' }, 'Import abgeschlossen'),
        h('p', { class: 'finish-total num' }, `${plural(plan.sessions.length, 'Training', 'Trainings')} · ${plural(plan.sets.length, 'Satz', 'Sätze')}`),
        h('p', { class: 'card-text' }, 'Vorher wurde automatisch eine interne Sicherung angelegt.')
      ),
      plan.newExercises.length > 0 && h('section', { class: 'card' },
        h('p', { class: 'card-title' }, 'Neue Übungen prüfen'),
        h('p', { class: 'card-text' }, 'Bitte Gewichtsschritte bzw. Stufen, „einseitig“ und Foto ergänzen. Davon hängen die Vorschläge ab.'),
        h('div', { class: 'add-list' }, plan.newExercises.map((exercise) =>
          h('button', { type: 'button', class: 'add-row', onclick: () => openExerciseEditor(exercise, { onSaved: onImported }) },
            h('span', { class: 'list-label' }, displayName(exercise)),
            h('span', { class: 'meta' }, 'Prüfen ›'))
        ))
      ),
    ];
  }

  function render() {
    body.replaceChildren(...(step === 'input' ? renderInput() : step === 'preview' ? renderPreview() : renderDone()).filter(Boolean));
    body.closest('.view-body')?.scrollTo(0, 0);
  }

  const close = openView({
    title: 'Notizen importieren',
    content: body,
    footer,
    onBack: () => {
      if (step === 'preview') {
        step = 'input';
        render();
      } else {
        close();
      }
    },
  });
  render();
}
