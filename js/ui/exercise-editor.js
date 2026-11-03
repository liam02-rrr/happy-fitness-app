// Übung anlegen und bearbeiten (SPEC.md, Abschnitt 6.4). Ziel: in ca. 30 Sekunden angelegt.
import { h, icon } from './dom.js';
import { icons } from './icons.js';
import { openView } from './view.js';
import { openSheet, confirmSheet } from './sheet.js';
import { toast } from './toast.js';
import { segmented, pills, toggleRow, ratingDots, field, formSection } from './controls.js';
import { resizePhoto, photoUrl } from './photo.js';
import { formatNumber, parseDecimal } from './format.js';
import { MUSCLE_GROUPS, MUSCLES } from '../models/muscles.js';
import {
  CATEGORIES, EXERCISE_TYPES, SETUP_TIMES, DEFAULT_KG_STEPS, DEFAULT_VARIANT_NAME,
  newExercise, saveExercise, setArchived, deleteExercise, hasHistory, listExercises, displayName, mergeIntoVariant,
} from '../models/exercises.js';
import { DEFAULT_SETTINGS } from '../models/settings.js';
import { numberStepper } from './set-row.js';
import { getAllByIndex, newId, saveInternalBackup } from '../db.js';

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

  // Eigene Wiederholungsbereiche (SPEC 4.1 repRanges), z. B. 15–20 für Liegestütz
  let customRanges = Boolean(draft.repRanges);
  const ranges = structuredClone(draft.repRanges ?? { volume: DEFAULT_SETTINGS.volumeRange, intense: DEFAULT_SETTINGS.intenseRange });
  const rangesBox = h('div', { class: 'stack-sm' });
  const rangeRow = (label, part, key) => h('div', { class: 'threshold-row' },
    h('span', { class: 'threshold-label' }, label),
    numberStepper({ value: ranges[part][key], step: 1, min: 1, max: 60, unit: 'Wdh.', label, decimals: false, onChange: (value) => { ranges[part][key] = value; } })
  );
  const renderRanges = () => {
    rangesBox.replaceChildren(...(customRanges ? [
      rangeRow('Volumensatz von', 'volume', 'min'),
      rangeRow('Volumensatz bis', 'volume', 'max'),
      rangeRow('Intensivsätze von', 'intense', 'min'),
      rangeRow('Intensivsätze bis', 'intense', 'max'),
    ] : []));
  };
  renderRanges();

  // Varianten: z. B. verschiedene Kabeltürme; jede mit eigener Historie
  let useVariants = Boolean(draft.useVariants);
  const variants = structuredClone(draft.variants ?? []);
  const variantsBox = h('div', { class: 'stack-sm' });
  const renderVariants = () => {
    if (!useVariants) {
      variantsBox.replaceChildren();
      return;
    }
    variantsBox.replaceChildren(
      h('p', { class: 'hint' }, `Standard: „${locationInput.value.trim() || DEFAULT_VARIANT_NAME}“ (Ort der Übung). Im Training wählst du die Variante über Pillen.`),
      ...variants.map((variant) => h('div', { class: 'variant-item' },
        h('div', { class: 'variant-row' },
          h('input', {
            class: 'field', type: 'text', value: variant.name, placeholder: 'Name der Variante',
            oninput: (event) => { variant.name = event.target.value; },
          }),
          h('button', {
            type: 'button', class: 'icon-btn', 'aria-label': 'Variante entfernen',
            onclick: async () => {
              const used = existing && (await getAllByIndex('entries', 'exerciseId', existing.id)).some((entry) => entry.variantId === variant.id);
              if (used) {
                toast('Diese Variante hat eine Historie und bleibt erhalten.', { variant: 'danger' });
                return;
              }
              variants.splice(variants.indexOf(variant), 1);
              renderVariants();
            },
          }, icon(icons.trash))
        ),
        h('button', { type: 'button', class: 'variant-recording', onclick: () => editVariantRecording(variant) },
          h('span', {}, recordingSummary(variant)),
          h('span', { class: 'variant-recording-action' }, 'Erfassung ›'))
      )),
      h('button', {
        type: 'button', class: 'btn btn-ghost btn-block',
        onclick: () => {
          variants.push({ id: newId(), name: '' });
          renderVariants();
          variantsBox.querySelectorAll('.variant-row input[type="text"]:not(.variant-step)')[variants.length - 1]?.focus();
        },
      }, icon(icons.plus), 'Variante hinzufügen')
    );
  };
  renderVariants();

  // Kurzbeschreibung der Erfassung einer Variante, z. B. „Assistiert · Stufen 1–12“
  function recordingSummary(variant) {
    if (!variant.type) return variant.step ? `Wie Übung, Schritt ${formatNumber(variant.step)} kg` : 'Erfassung wie Übung';
    const typeLabel = EXERCISE_TYPES.find((t) => t.id === variant.type)?.label ?? variant.type;
    const steps = variant.steps;
    if (!steps) return typeLabel;
    if (Array.isArray(steps.levels)) {
      return steps.levels.length ? `${typeLabel} · Stufen ${steps.levels[0]}–${steps.levels.at(-1)}` : `${typeLabel} · Stufen fehlen`;
    }
    return `${typeLabel} · ${formatNumber(steps.min)}–${formatNumber(steps.max)} kg, Schritt ${formatNumber(steps.step)}`;
  }

  // Eigene Erfassung (Typ und Stufen) nur für diese Variante
  function editVariantRecording(variant) {
    const state = {
      type: variant.type ?? draft.type,
      mode: Array.isArray((variant.type ? variant.steps : draft.steps)?.levels) ? 'levels' : 'kg',
      kg: { ...(DEFAULT_KG_STEPS[variant.type ?? draft.type] ?? DEFAULT_KG_STEPS.weight), ...((variant.type ? variant.steps : draft.steps)?.step != null ? (variant.type ? variant.steps : draft.steps) : {}) },
      levelText: ((variant.type ? variant.steps : draft.steps)?.levels ?? []).join(', '),
      direction: (variant.type ? variant.steps : draft.steps)?.harderDirection ?? DEFAULT_DIRECTION[variant.type ?? draft.type] ?? 'up',
    };
    const fields = h('div', { class: 'stack-sm' });
    const levelMode = () => state.type === 'band' || state.type === 'level' || (state.type === 'assisted' && state.mode === 'levels');
    const renderFields = () => {
      const parts = [];
      if (state.type === 'assisted') {
        parts.push(segmented([{ id: 'kg', label: 'In kg' }, { id: 'levels', label: 'In Stufen' }], state.mode, (mode) => { state.mode = mode; renderFields(); }));
      }
      if (state.type === 'time') {
        parts.push(h('p', { class: 'hint' }, 'Erfasst werden Sekunden.'));
      } else if (levelMode()) {
        parts.push(
          field(state.type === 'band' ? 'Bänder' : 'Stufen', h('input', {
            class: 'field', type: 'text', value: state.levelText, placeholder: 'z. B. 1-12',
            oninput: (event) => { state.levelText = event.target.value; },
          })),
          field('Schwerer ist', segmented([{ id: 'up', label: 'Höhere Stufe' }, { id: 'down', label: 'Niedrigere Stufe' }], state.direction, (value) => { state.direction = value; }))
        );
      } else {
        const kgInput = (key) => h('input', {
          class: 'field field-num num', type: 'text', inputMode: 'decimal', value: formatNumber(state.kg[key]),
          oninput: (event) => { state.kg[key] = parseDecimal(event.target.value); },
        });
        parts.push(h('div', { class: 'triple' }, field('Von', kgInput('min')), field('Bis', kgInput('max')), field('Schritt', kgInput('step'))));
      }
      fields.replaceChildren(...parts);
    };
    renderFields();

    openSheet({
      title: `Erfassung: ${variant.name || 'Variante'}`,
      text: 'Gilt nur für diese Variante, z. B. Klimmzugmaschine einmal in Stufen, einmal in kg.',
      content: h('div', { class: 'stack-sm' },
        pills(EXERCISE_TYPES, state.type, (type) => {
          state.type = type;
          if (DEFAULT_DIRECTION[type]) state.direction = DEFAULT_DIRECTION[type];
          renderFields();
        }),
        fields
      ),
      actions: [
        {
          label: 'Übernehmen',
          variant: 'primary',
          onClick: () => {
            let steps = null;
            if (levelMode()) {
              const levels = parseLevels(state.levelText);
              if (levels.length < 2) {
                toast('Bitte mindestens zwei Stufen eingeben.', { variant: 'danger' });
                return false;
              }
              steps = { levels, harderDirection: state.direction };
            } else if (state.type !== 'time') {
              const { min, max, step } = state.kg;
              if ([min, max, step].some((value) => value == null) || max <= min || step <= 0) {
                toast('Bitte Gewichtsstufen prüfen: Von < Bis, Schritt > 0.', { variant: 'danger' });
                return false;
              }
              steps = { min, max, step };
            }
            Object.assign(variant, { type: state.type, steps });
            delete variant.step;
            renderVariants();
            return true;
          },
        },
        {
          label: 'Wie Übung',
          onClick: () => {
            delete variant.type;
            delete variant.steps;
            delete variant.step;
            renderVariants();
          },
        },
      ],
    });
  }

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

    if (customRanges) {
      const broken = ['volume', 'intense'].some((part) => ranges[part].min == null || ranges[part].max == null || ranges[part].min > ranges[part].max);
      if (broken) {
        toast('Wiederholungsbereiche prüfen: „von“ darf nicht größer als „bis“ sein.', { variant: 'danger' });
        return;
      }
    }
    const cleanVariants = variants
      .map((variant) => ({ ...variant, name: variant.name.trim() }))
      .filter((variant) => variant.name);

    const exercise = {
      ...draft,
      repRanges: customRanges ? ranges : undefined,
      useVariants,
      variants: cleanVariants,
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

    manageBox.append(h('button', {
      type: 'button',
      class: 'btn btn-secondary btn-block',
      onclick: () => openMergePicker(),
    }, icon(icons.link), 'Als Variante zu anderer Übung'));

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

  // Diese Übung (mit ihrer Historie) als Variante an eine andere Übung hängen
  async function openMergePicker() {
    const candidates = (await listExercises())
      .filter((exercise) => exercise.id !== existing.id && !exercise.archived)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const listEl = h('div', { class: 'add-list' }, candidates.length
      ? candidates.map((target) => h('button', {
        type: 'button', class: 'add-row',
        onclick: async () => {
          const ok = await confirmSheet({
            title: 'Als Variante zusammenführen?',
            text: `„${displayName(existing)}“ wird eine Variante von „${target.name}“. Die ganze Historie wandert mit, ${existing.type !== target.type || Array.isArray(existing.steps?.levels) !== Array.isArray(target.steps?.levels) ? 'die Variante behält ihren Typ und ihre Stufen, ' : ''}„${existing.name}“ verschwindet aus der Übungsliste.`,
            confirmLabel: 'Zusammenführen',
            variant: 'primary',
          });
          if (!ok) return;
          await saveInternalBackup('Vor Zusammenführen von Übungen');
          await mergeIntoVariant(existing, target);
          toast(`Jetzt Variante von ${target.name}`, { variant: 'success' });
          closePicker();
          close();
          onSaved?.();
        },
      }, h('span', { class: 'list-label' }, displayName(target)), h('span', { class: 'meta' }, 'wählen ›')))
      : [h('p', { class: 'hint' }, 'Keine andere Übung vorhanden.')]);
    const closePicker = openView({
      title: 'Variante von …',
      content: h('div', { class: 'form' }, h('p', { class: 'hint' }, `Wähle die Übung, zu der „${existing.name}“ als Variante gehören soll.`), listEl),
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
    formSection('Varianten',
      toggleRow('Variante im Training wählen', useVariants, (value) => { useVariants = value; renderVariants(); }, 'Für verschiedene Geräte oder Griffe, ohne die Übungsliste zu füllen'),
      variantsBox
    ),
    formSection('Wiederholungen',
      toggleRow('Eigene Wiederholungsbereiche', customRanges, (value) => { customRanges = value; renderRanges(); }, `Statt Standard ${DEFAULT_SETTINGS.volumeRange.min}–${DEFAULT_SETTINGS.volumeRange.max} / ${DEFAULT_SETTINGS.intenseRange.min}–${DEFAULT_SETTINGS.intenseRange.max}, z. B. für Liegestütz`),
      rangesBox
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
