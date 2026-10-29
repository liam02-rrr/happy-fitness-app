// Tab „Einstellungen“: Körpergewicht, Datensicherung, Speicher-Status.
// Die Schwellenwerte des Algorithmus kommen in Phase 2 dazu.
import { h, icon } from './dom.js';
import { icons } from './icons.js';
import { openSheet, confirmSheet } from './sheet.js';
import { toast } from './toast.js';
import { todayISO, formatDate, formatDateTime, formatNumber, parseDecimal, daysSince, daysAgoLabel, formatBytes } from './format.js';
import { listBodyweight, addBodyweight, deleteBodyweight } from '../models/bodyweight.js';
import { getSettings } from '../models/settings.js';
import { createBackupFile, shareBackupFile, readBackupFile, importBackup } from '../backup.js';
import { listInternalBackups } from '../db.js';

const BODYWEIGHT_STEP = 0.1;
const BODYWEIGHT_LIST_LIMIT = 5;

export function renderSettings(section) {
  const content = h('div', { class: 'stack' });
  section.append(content);

  async function refresh() {
    const [entries, settings, internalBackups, persisted] = await Promise.all([
      listBodyweight(),
      getSettings(),
      listInternalBackups(),
      navigator.storage?.persisted?.() ?? Promise.resolve(false),
    ]);
    content.replaceChildren(
      bodyweightCard(entries, refresh),
      backupCard(settings, refresh),
      safetyCard(persisted, internalBackups),
      thresholdsCard()
    );
  }

  refresh();
}

function cardHeader(iconMarkup, title, aside) {
  return h('div', { class: 'card-header' },
    h('span', { class: 'icon-chip' }, icon(iconMarkup)),
    h('h2', { class: 'card-title' }, title),
    aside && h('div', { class: 'card-aside' }, aside)
  );
}

// Körpergewicht eintragen (SPEC 4.5) mit −/+ und vorausgefülltem letzten Wert
function bodyweightCard(entries, refresh) {
  const latest = entries[0];
  const input = h('input', {
    class: 'stepper-input num',
    type: 'text',
    inputMode: 'decimal',
    value: latest ? formatNumber(latest.kg) : '',
    placeholder: '0,0',
    'aria-label': 'Körpergewicht in kg',
  });
  const dateInput = h('input', { class: 'field', type: 'date', value: todayISO(), max: todayISO(), 'aria-label': 'Datum' });

  const step = (direction) => {
    const current = parseDecimal(input.value) ?? latest?.kg ?? 75;
    input.value = formatNumber(Math.max(0, Math.round((current + direction * BODYWEIGHT_STEP) * 10) / 10));
  };

  const save = async () => {
    const kg = parseDecimal(input.value);
    if (kg == null || kg < 20 || kg > 300) {
      toast('Bitte ein Gewicht zwischen 20 und 300 kg eingeben.', { variant: 'danger' });
      return;
    }
    await addBodyweight({ date: dateInput.value || todayISO(), kg });
    toast(`${formatNumber(kg)} kg eingetragen`, { variant: 'success' });
    refresh();
  };

  const remove = async (entry) => {
    const ok = await confirmSheet({
      title: 'Eintrag löschen?',
      text: `${formatNumber(entry.kg)} kg vom ${formatDate(entry.date)} wird gelöscht.`,
      confirmLabel: 'Löschen',
    });
    if (!ok) return;
    await deleteBodyweight(entry.id);
    refresh();
  };

  const aside = latest
    ? [h('span', { class: 'value-lg num' }, formatNumber(latest.kg), h('small', {}, ' kg')),
       h('span', { class: 'meta' }, formatDate(latest.date))]
    : h('span', { class: 'meta' }, 'Noch kein Eintrag');

  return h('section', { class: 'card' },
    cardHeader(icons.scale, 'Körpergewicht', aside),
    h('div', { class: 'stepper' },
      h('button', { type: 'button', class: 'stepper-btn', 'aria-label': 'Weniger', onclick: () => step(-1) }, icon(icons.minus)),
      h('label', { class: 'stepper-value' }, input, h('span', { class: 'stepper-unit' }, 'kg')),
      h('button', { type: 'button', class: 'stepper-btn', 'aria-label': 'Mehr', onclick: () => step(1) }, icon(icons.plus))
    ),
    h('div', { class: 'row' },
      dateInput,
      h('button', { type: 'button', class: 'btn btn-primary', onclick: save }, 'Eintragen')
    ),
    entries.length > 0 && h('ul', { class: 'list' },
      entries.slice(0, BODYWEIGHT_LIST_LIMIT).map((entry) =>
        h('li', { class: 'list-row' },
          h('span', { class: 'list-label' }, formatDate(entry.date)),
          h('span', { class: 'list-value num' }, `${formatNumber(entry.kg)} kg`),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Eintrag löschen', onclick: () => remove(entry) }, icon(icons.trash))
        )
      )
    )
  );
}

// Backup exportieren und importieren (SPEC 6.6)
function backupCard(settings, refresh) {
  const last = settings.lastBackupAt;
  const overdue = !last || daysSince(last) >= settings.backupReminderDays;
  const status = h('p', { class: `status ${overdue ? 'status-warning' : 'status-ok'}` },
    last ? `Letztes Backup ${daysAgoLabel(last)} · ${formatDate(last.slice(0, 10))}` : 'Noch kein Backup erstellt'
  );

  // Schritt 1: Datei erstellen. Schritt 2: sichern (iOS braucht dafür einen frischen Tipp).
  const exportButton = h('button', { type: 'button', class: 'btn btn-primary btn-block' }, icon(icons.download), 'Backup erstellen');
  const exportHint = h('p', { class: 'hint', hidden: true }, 'Im Teilen-Menü „In Dateien sichern“ wählen.');
  let file = null;

  exportButton.addEventListener('click', async () => {
    if (!file) {
      exportButton.disabled = true;
      exportButton.lastChild.textContent = 'Backup wird erstellt …';
      try {
        file = await createBackupFile();
        exportButton.lastChild.textContent = `Datei sichern · ${formatBytes(file.size)}`;
        exportHint.hidden = false;
      } catch (error) {
        console.error(error);
        exportButton.lastChild.textContent = 'Backup erstellen';
        toast('Backup konnte nicht erstellt werden.', { variant: 'danger' });
      }
      exportButton.disabled = false;
      return;
    }
    try {
      if (await shareBackupFile(file)) {
        toast('Backup gesichert', { variant: 'success' });
        refresh();
      }
    } catch (error) {
      console.error(error);
      toast('Backup konnte nicht gesichert werden.', { variant: 'danger' });
    }
  });

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fileInput.addEventListener('change', async () => {
    const chosen = fileInput.files[0];
    fileInput.value = '';
    if (!chosen) return;
    try {
      const { payload, counts } = await readBackupFile(chosen);
      showImportSheet(payload, counts, refresh);
    } catch (error) {
      toast(error.message, { variant: 'danger', duration: 4000 });
    }
  });

  return h('section', { class: 'card' },
    cardHeader(icons.download, 'Datensicherung'),
    status,
    h('div', { class: 'stack-sm' },
      exportButton,
      exportHint,
      h('button', { type: 'button', class: 'btn btn-secondary btn-block', onclick: () => fileInput.click() }, icon(icons.upload), 'Backup importieren'),
      fileInput
    )
  );
}

function showImportSheet(payload, counts, refresh) {
  const labels = {
    exercises: 'Übungen',
    sessions: 'Trainings',
    sets: 'Sätze',
    bodyweight: 'Körpergewicht-Einträge',
  };
  const summary = h('ul', { class: 'list' },
    Object.entries(labels).map(([key, label]) =>
      h('li', { class: 'list-row' }, h('span', { class: 'list-label' }, label), h('span', { class: 'list-value num' }, String(counts[key])))
    )
  );

  const run = (mode) => async () => {
    try {
      await importBackup(payload, mode);
      toast('Backup importiert', { variant: 'success' });
      refresh();
    } catch (error) {
      console.error(error);
      toast('Import fehlgeschlagen. Deine Daten sind unverändert.', { variant: 'danger', duration: 4000 });
    }
  };

  openSheet({
    title: 'Backup importieren',
    text: `Backup vom ${formatDateTime(payload.exportedAt)}. Vorher wird automatisch eine interne Sicherung angelegt.`,
    content: h('div', { class: 'stack-sm' },
      summary,
      h('p', { class: 'hint' }, 'Zusammenführen: Einträge aus der Datei kommen dazu, gleiche Einträge werden aktualisiert. Ersetzen: Alle aktuellen Daten werden durch das Backup ersetzt.')
    ),
    actions: [
      { label: 'Zusammenführen', variant: 'primary', onClick: run('merge') },
      { label: 'Ersetzen', variant: 'danger', onClick: run('replace') },
    ],
  });
}

// Dauerhafter Speicher und interne Sicherungen (SPEC 10)
function safetyCard(persisted, internalBackups) {
  return h('section', { class: 'card' },
    cardHeader(icons.shield, 'Speicher im Gerät'),
    h('ul', { class: 'list' },
      h('li', { class: 'list-row' },
        h('span', { class: 'list-label' }, 'Dauerhafter Speicher'),
        h('span', { class: `list-value ${persisted ? 'text-success' : 'text-warning'}` }, persisted ? 'aktiv' : 'nicht bestätigt')
      ),
      h('li', { class: 'list-row' },
        h('span', { class: 'list-label' }, 'Interne Sicherungen'),
        h('span', { class: 'list-value num' }, String(internalBackups.length))
      ),
      internalBackups.slice(0, 3).map((backup) =>
        h('li', { class: 'list-row list-row-sub' },
          h('span', { class: 'list-label' }, backup.reason),
          h('span', { class: 'list-value meta' }, formatDateTime(backup.createdAt))
        )
      )
    ),
    h('p', { class: 'hint' }, 'Interne Sicherungen entstehen automatisch vor jedem Import. Sie ersetzen kein Backup als Datei.')
  );
}

function thresholdsCard() {
  return h('section', { class: 'card' },
    cardHeader(icons.sliders, 'Schwellenwerte'),
    h('p', { class: 'card-text' }, 'Alle Werte für die Vorschläge stellst du hier ab Phase 2 ein.')
  );
}
