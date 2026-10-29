// Übung anlegen und bearbeiten (SPEC.md, Abschnitt 6.4). Ziel: in ca. 30 Sekunden angelegt.
import { h, icon } from './dom.js';
import { icons } from './icons.js';
import { openView } from './view.js';
import { confirmSheet } from './sheet.js';
import { toast } from './toast.js';
import { segmented, pills, toggleRow, ratingDots, field, formSection } from './controls.js';
import { resizePhoto, photoUrl } from './photo.js';
import { formatNumber, parseDecimal } from './format.js';
import { MUSCLE_GROUPS, MUSCLES } from '../models/muscles.js';
import {
  CATEGORIES, EXERCISE_TYPES, SETUP_TIMES, DEFAULT_KG_STEPS,
  newExercise, saveExercise, setArchived, deleteExercise, hasHistory,
} from '../models/exercises.js';

// Standard-Richtung je Typ: Band = schwächeres Band ist schwerer, Assistenz = weniger ist schwerer
const DEFAULT_DIRECTION = { assisted: 'down', band: 'down', level: 'up' };

// "1-5, 7" → [1, 2, 3, 4, 5, 7]; Text bleibt Text ("leicht, mittel")
export function parseLevels(text) {
  return text.split(',').map((part) => part.trim()).filter(Boolean).flatMap((part) => {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])];
      const step = from <= to ? 1 : -1;
      return Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => from + i * step);
    }
    const number = parseDecimal(part);
    return number ?? part;
  });
}

export function openExerciseEditor(existing, { defaults = {}, onSaved } = {}) {
  const isNew = !existing;
  const draft = structuredClone(existing ?? newExercise(defaults));
  // Eingaben für beide Erfassungsarten merken, damit ein Typwechsel nichts verliert
  let kgSteps = draft.steps?.step != null ? { ...draft.steps } : { ...(DEFAULT_KG_STEPS[draft.type] ?? DEFAULT_KG_STEPS.weight) };
  let levelText = draft.steps?.levels?.map((level) => (typeof level === 'number' ? formatNumber(level) : level)).join(', ') ?? '';
  let direction = draft.steps?.harderDirection ?? DEFAULT_DIRECTION[draft.type] ?? 'up';
  let assistedMode = draft.type === 'assisted' && draft.steps?.levels ? 'levels' : 'kg';
  let photo = draft.photo;
  let photoChanged = false;

  // Foto
  const photoPreview = h('div', { class: 'photo-picker-preview' });
  const photoInput = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const removePhotoBtn = h('button', { type: 'button', class: 'photo-remove', 'aria-label': 'Foto entfernen' }, icon(icons.close));
  const renderPhoto = () => {
    photoPreview.style.backgroundImage = photo ? `url("${photoUrl(photo)}")` : '';
    photoPreview.classList.toggle('has-photo', Boolean(photo));
    removePhotoBtn.hidden = !photo;
  };
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    photoInput.value = '';
    if (!file) return;
    try {
      photo = await resizePhoto(file);
      photoChanged = true;
      renderPhoto();
    } catch (error) {
      toast(error.message, { variant: 'danger' });
    }
  });
  removePhotoBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    photo = null;
    photoChanged = true;
    renderPhoto();
  });
  const photoPicker = h('div', { class: 'photo-picker', role: 'button', tabindex: '0', onclick: () => photoInput.click() },
    photoPreview,
    h('span', { class: 'photo-picker-label' }, icon(icons.camera), 'Foto aufnehmen oder wählen'),
    removePhotoBtn,
    photoInput
  );
  renderPhoto();

  // Name und Ort
  const nameInput = h('input', { class: 'field', type: 'text', value: draft.name, placeholder: 'z. B. Latziehen', autocapitalize: 'sentences', enterKeyHint: 'next' });
  const locationInput = h('input', { class: 'field', type: 'text', value: draft.location ?? '', placeholder: 'z. B. Phoenix oder oben', enterKeyHint: 'done' });

  // Gewichtsstufen bzw. Stufenliste, abhängig vom Typ
  const stepsBox = h('div', { class: 'stack-sm' });
  const numberInput = (key) => h('input', {
    class: 'field field-num num',
    type: 'text',
    inputMode: 'decimal',
    value: formatNumber(kgSteps[key]),
    oninput: (event) => { kgSteps[key] = parseDecimal(event.target.value); },
  });
  const renderSteps = () => {
    const type = draft.type;
    const parts = [];
    if (type === 'assisted') {
      parts.push(segmented([{ id: 'kg', label: 'In kg' }, { id: 'levels', label: 'In Stufen' }], assistedMode, (mode) => {
        assistedMode = mode;
        renderSteps();
      }));
    }
    const levelMode = type === 'band' || type === 'level' || (type === 'assisted' && assistedMode === 'levels');
    if (type === 'time') {
      parts.push(h('p', { class: 'hint' }, 'Erfasst werden Sekunden. Fortschritt = länger halten.'));
    } else if (levelMode) {
      const placeholder = type === 'band' ? 'z. B. 4, 8, 12 oder leicht, mittel, schwer' : 'z. B. 1-12';
      parts.push(
        field(type === 'band' ? 'Bänder' : 'Stufen',
          h('input', { class: 'field', type: 'text', value: levelText, placeholder, oninput: (event) => { levelText = event.target.value; } }),
          'Mit Komma trennen. Bereiche wie 1-12 gehen auch.'),
        field('Schwerer ist', segmented([
          { id: 'up', label: 'Höhere Stufe' },
          { id: 'down', label: 'Niedrigere Stufe' },
        ], direction, (value) => { direction = value; }))
      );
    } else {
      const unit = type === 'assisted' ? 'Assistenz in kg' : type === 'bodyweight' ? 'Zusatzgewicht in kg' : 'Gewicht in kg';
      parts.push(
        h('p', { class: 'form-label' }, unit),
        h('div', { class: 'triple' },
          field('Von', numberInput('min')),
          field('Bis', numberInput('max')),
          field('Schritt', numberInput('step'))
        )
      );
    }
    stepsBox.replaceChildren(...parts);
  };

  const typePills = pills(EXERCISE_TYPES, draft.type, (type) => {
    draft.type = type;
    if (DEFAULT_KG_STEPS[type] && !existing) kgSteps = { ...DEFAULT_KG_STEPS[type] };
    if (!draft.steps?.harderDirection) direction = DEFAULT_DIRECTION[type] ?? 'up';
    renderSteps();
  });
  renderSteps();

  // Spürgefühl: Muskeln der gewählten Gruppe zuerst, weitere aufklappbar
  const feel = new Map(draft.feel.map(({ muscleId, rating }) => [muscleId, rating]));
  const feelBox = h('div', {});
  const muscleRow = (muscle) => h('div', { class: 'feel-row' },
    h('span', { class: 'feel-label' }, muscle.label),
    ratingDots(feel.get(muscle.id) ?? 0, (rating) => {
      rating ? feel.set(muscle.id, rating) : feel.delete(muscle.id);
    }, muscle.label)
  );
  const renderFeel = () => {
    const own = MUSCLES.filter((muscle) => muscle.group === draft.muscleGroup);
    const others = MUSCLE_GROUPS.filter((group) => group.id !== draft.muscleGroup);
    const othersRated = MUSCLES.some((muscle) => muscle.group !== draft.muscleGroup && feel.has(muscle.id));
    feelBox.replaceChildren(
      h('div', { class: 'feel-list' }, own.map(muscleRow)),
      h('details', { class: 'feel-more', open: othersRated },
        h('summary', {}, 'Weitere Muskeln'),
        others.map((group) => h('div', { class: 'feel-group' },
          h('p', { class: 'feel-group-title' }, group.label),
          h('div', { class: 'feel-list' }, MUSCLES.filter((muscle) => muscle.group === group.id).map(muscleRow))
        ))
      )
    );
  };
  renderFeel();

  const setupNotesInput = h('textarea', { class: 'field field-area', rows: 2, placeholder: 'z. B. Sitz 4, Griff weit', value: draft.setupNotes ?? '' });

  // Speichern mit Prüfung
  const save = async () => {
    const name = nameInput.value.trim();
    if (!name) {
      toast('Bitte einen Namen eingeben.', { variant: 'danger' });
      nameInput.focus();
      return;
    }

    const type = draft.type;
    const levelMode = type === 'band' || type === 'level' || (type === 'assisted' && assistedMode === 'levels');
    let steps = null;
    if (levelMode) {
      const levels = parseLevels(levelText);
      if (levels.length < 2) {
        toast('Bitte mindestens zwei Stufen eingeben.', { variant: 'danger' });
        return;
      }
      steps = { levels, harderDirection: direction };
    } else if (type !== 'time') {
      const { min, max, step } = kgSteps;
      if ([min, max, step].some((value) => value == null) || min < 0 || max <= min || step <= 0) {
        toast('Bitte Gewichtsstufen prüfen: Von < Bis, Schritt > 0.', { variant: 'danger' });
        return;
      }
      steps = { min, max, step };
    }

    const exercise = {
      ...draft,
      name,
      location: locationInput.value.trim(),
      photo: photoChanged ? photo : draft.photo,
      steps,
      setupNotes: setupNotesInput.value.trim(),
      feel: [...feel].map(([muscleId, rating]) => ({ muscleId, rating })),
    };
    await saveExercise(exercise);
    toast(isNew ? 'Übung angelegt' : 'Übung gespeichert', { variant: 'success' });
    close();
    onSaved?.(exercise);
  };

  // Archivieren oder löschen (nur bestehende Übungen)
  const manageBox = h('div', { class: 'stack-sm' });
  if (!isNew) {
    manageBox.append(h('button', {
      type: 'button',
      class: 'btn btn-secondary btn-block',
      onclick: async () => {
        await setArchived(existing, !existing.archived);
        toast(existing.archived ? 'Übung wiederhergestellt' : 'Übung archiviert', { variant: 'success' });
        close();
        onSaved?.();
      },
    }, icon(icons.archive), existing.archived ? 'Wiederherstellen' : 'Archivieren'));

    hasHistory(existing.id).then((history) => {
      if (history) {
        manageBox.append(h('p', { class: 'hint' }, 'Diese Übung hat eine Historie. Sie kann archiviert, aber nicht gelöscht werden.'));
        return;
      }
      manageBox.append(h('button', {
        type: 'button',
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          const ok = await confirmSheet({ title: 'Übung löschen?', text: `„${existing.name}“ wird endgültig gelöscht.`, confirmLabel: 'Löschen' });
          if (!ok) return;
          await deleteExercise(existing.id);
          toast('Übung gelöscht', { variant: 'success' });
          close();
          onSaved?.();
        },
      }, icon(icons.trash), 'Löschen'));
    });
  }

  const content = h('div', { class: 'form' },
    photoPicker,
    formSection(null,
      field('Name', nameInput),
      field('Ort oder Hersteller', locationInput, 'Optional. Anzeige: „Latziehen · Phoenix“')
    ),
    formSection('Einordnung',
      segmented(CATEGORIES, draft.category, (category) => { draft.category = category; }),
      h('p', { class: 'form-label' }, 'Muskelgruppe'),
      pills(MUSCLE_GROUPS, draft.muscleGroup, (group) => {
        draft.muscleGroup = group;
        renderFeel();
      })
    ),
    formSection('Erfassung',
      typePills,
      stepsBox,
      toggleRow('Einseitig', draft.unilateral, (value) => { draft.unilateral = value; }, 'Wiederholungen pro Seite')
    ),
    formSection('Wo spüre ich es?',
      h('p', { class: 'hint' }, '1 = kaum, 5 = sehr stark. Nochmal tippen setzt zurück.'),
      feelBox
    ),
    formSection('Aufbau',
      h('p', { class: 'form-label' }, 'Aufbauzeit'),
      segmented(SETUP_TIMES, draft.setupTime, (value) => { draft.setupTime = value; }),
      field('Einstellungen am Gerät', setupNotesInput),
      toggleRow('Rücken-Plus', draft.backPlus, (value) => { draft.backPlus = value; }, 'Als Zusatzübung für den Rücken vorschlagen')
    ),
    !isNew && formSection('Verwalten', manageBox)
  );

  const close = openView({
    title: isNew ? 'Neue Übung' : 'Übung bearbeiten',
    content,
    footer: h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: save }, isNew ? 'Übung anlegen' : 'Speichern'),
  });

  if (isNew) setTimeout(() => nameInput.focus(), 300);
}
