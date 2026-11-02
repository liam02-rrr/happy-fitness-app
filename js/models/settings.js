import { get, put } from '../db.js';

const SETTINGS_ID = 'main';

// Standardwerte aus SPEC.md, Abschnitt 8
export const DEFAULT_SETTINGS = {
  warmupPct: 55,
  volumeRange: { min: 12, max: 15 },
  volumeRIR: 2,
  intenseRange: { min: 6, max: 8 },
  intenseRIR: 1,
  intenseSets: 3,
  defaultRIR: 2,
  doubleStepRIR: 2,
  dropAfterFails: 2,
  e1rmMaxReps: 12,
  repPct: 3.33,
  jumpNormal: 2,
  jumpExtend: 4,
  extendReps: 2,
  timeStep: 5,
  weakPct: 7.5,
  recentIllPct: 10,
  plateauSessions: 3,
  plateauMinGain: 1,
  volumeWindowDays: 10,
  volumeTargetMin: 14,
  volumeTargetMax: 28,
  setupShort: 1,
  setupMedium: 3,
  setupLong: 5,
  durWarmup: 1.5,
  durVolume: 2,
  durIntense: 3,
  restWarmup: 60,
  restVolume: 90,
  restIntense: 150,
  timeShort: 45,
  timeNormal: 70,
  timeLong: 100,
  backupReminderDays: 7,
  theme: 'dark',
  lastBackupAt: null,
};

// Gespeicherte Werte über die Standardwerte legen, damit neue Schlüssel automatisch da sind
export async function getSettings() {
  const { id, ...stored } = (await get('settings', SETTINGS_ID)) ?? {};
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(changes) {
  const settings = { ...(await getSettings()), ...changes };
  await put('settings', { id: SETTINGS_ID, ...settings });
  return settings;
}

// Werte, die keine Schwellenwerte sind und beim Zurücksetzen erhalten bleiben
const KEEP_ON_RESET = ['theme', 'lastBackupAt'];

export async function resetSettings() {
  const current = await getSettings();
  const kept = Object.fromEntries(KEEP_ON_RESET.map((key) => [key, current[key]]));
  await put('settings', { id: SETTINGS_ID, ...DEFAULT_SETTINGS, ...kept });
}

// Beschreibung aller Schwellenwerte für den Einstellungen-Tab, gruppiert.
// key 'volumeRange.min' greift auf den Bereich zu. phase = ab wann der Wert wirkt.
export const SETTINGS_SCHEMA = [
  {
    title: 'Satzschema',
    items: [
      { key: 'warmupPct', label: 'Aufwärmgewicht', hint: '% des Intensivgewichts', unit: '%', step: 5, min: 20, max: 90 },
      { key: 'volumeRange.min', label: 'Volumensatz: Wdh. von', unit: 'Wdh.', step: 1, min: 1, max: 50 },
      { key: 'volumeRange.max', label: 'Volumensatz: Wdh. bis', unit: 'Wdh.', step: 1, min: 1, max: 50 },
      { key: 'volumeRIR', label: 'Volumensatz: Ziel-RIR', unit: 'RIR', step: 1, min: 0, max: 5 },
      { key: 'intenseRange.min', label: 'Intensivsätze: Wdh. von', unit: 'Wdh.', step: 1, min: 1, max: 30 },
      { key: 'intenseRange.max', label: 'Intensivsätze: Wdh. bis', unit: 'Wdh.', step: 1, min: 1, max: 30 },
      { key: 'intenseRIR', label: 'Intensivsätze: Ziel-RIR', unit: 'RIR', step: 1, min: 0, max: 5 },
      { key: 'intenseSets', label: 'Anzahl Intensivsätze', unit: 'Sätze', step: 1, min: 1, max: 6 },
      { key: 'defaultRIR', label: 'RIR, wenn nichts eingetragen', unit: 'RIR', step: 1, min: 0, max: 5 },
    ],
  },
  {
    title: 'Progression',
    items: [
      { key: 'doubleStepRIR', label: 'Doppelsprung ab RIR über Ziel', hint: 'Satz war deutlich zu leicht', unit: 'RIR', step: 1, min: 1, max: 5 },
      { key: 'dropAfterFails', label: 'Leichter nach Fehlversuchen', hint: 'Untergrenze so oft in Folge verfehlt', unit: 'mal', step: 1, min: 1, max: 6 },
      { key: 'e1rmMaxReps', label: '1RM nur bis Wdh.', hint: 'Epley-Formel ist darüber ungenau', unit: 'Wdh.', step: 1, min: 3, max: 20 },
      { key: 'timeStep', label: 'Zeit-Übungen: Steigerung', unit: 's', step: 1, min: 1, max: 60 },
    ],
  },
  {
    title: 'Sprung-Strategie',
    hint: 'Wie groß ist der nächste Gewichtsschritt im Verhältnis zur Kraft?',
    items: [
      { key: 'repPct', label: 'Last pro Wiederholung', hint: 'Epley-Näherung', unit: '%', step: 0.01, min: 1, max: 10, decimals: 2 },
      { key: 'jumpNormal', label: 'Normal steigern bis', unit: 'Wdh.-Sprung', step: 0.5, min: 0.5, max: 10 },
      { key: 'jumpExtend', label: 'Erst Wdh. sammeln bis', unit: 'Wdh.-Sprung', step: 0.5, min: 0.5, max: 15 },
      { key: 'extendReps', label: 'Wdh. über Obergrenze sammeln', unit: 'Wdh.', step: 1, min: 1, max: 10 },
    ],
  },
  {
    title: 'Tagesform',
    items: [
      { key: 'weakPct', label: 'Gefühl „schwach“: Last weniger', unit: '%', step: 0.5, min: 0, max: 30 },
      { key: 'recentIllPct', label: 'Kürzlich angeschlagen: Last weniger', unit: '%', step: 0.5, min: 0, max: 40 },
    ],
  },
  {
    title: 'Pausentimer',
    items: [
      { key: 'restWarmup', label: 'Nach Aufwärmsatz', unit: 's', step: 15, min: 0, max: 600 },
      { key: 'restVolume', label: 'Nach Volumensatz', unit: 's', step: 15, min: 0, max: 600 },
      { key: 'restIntense', label: 'Nach Intensivsatz', unit: 's', step: 15, min: 0, max: 600 },
    ],
  },
  {
    title: 'Plateau',
    phase: 4,
    items: [
      { key: 'plateauSessions', label: 'Vergleichbare Einheiten', unit: 'Einheiten', step: 1, min: 2, max: 10 },
      { key: 'plateauMinGain', label: 'Mindest-Steigerung', unit: '%', step: 0.5, min: 0, max: 10 },
    ],
  },
  {
    title: 'Volumen pro Muskel',
    phase: 4,
    items: [
      { key: 'volumeWindowDays', label: 'Zeitfenster', unit: 'Tage', step: 1, min: 5, max: 28 },
      { key: 'volumeTargetMin', label: 'Zielbereich von', unit: 'Sätze', step: 1, min: 0, max: 60 },
      { key: 'volumeTargetMax', label: 'Zielbereich bis', unit: 'Sätze', step: 1, min: 0, max: 80 },
    ],
  },
  {
    title: 'Zeit und Dauer',
    phase: 4,
    items: [
      { key: 'setupShort', label: 'Aufbauzeit kurz', unit: 'Min.', step: 0.5, min: 0, max: 15 },
      { key: 'setupMedium', label: 'Aufbauzeit mittel', unit: 'Min.', step: 0.5, min: 0, max: 15 },
      { key: 'setupLong', label: 'Aufbauzeit lang', unit: 'Min.', step: 0.5, min: 0, max: 15 },
      { key: 'durWarmup', label: 'Dauer Aufwärmsatz inkl. Pause', unit: 'Min.', step: 0.5, min: 0.5, max: 10 },
      { key: 'durVolume', label: 'Dauer Volumensatz inkl. Pause', unit: 'Min.', step: 0.5, min: 0.5, max: 10 },
      { key: 'durIntense', label: 'Dauer Intensivsatz inkl. Pause', unit: 'Min.', step: 0.5, min: 0.5, max: 10 },
      { key: 'timeShort', label: 'Zielzeit kurz', unit: 'Min.', step: 5, min: 10, max: 240 },
      { key: 'timeNormal', label: 'Zielzeit normal', unit: 'Min.', step: 5, min: 10, max: 240 },
      { key: 'timeLong', label: 'Zielzeit lang', unit: 'Min.', step: 5, min: 10, max: 240 },
    ],
  },
  {
    title: 'Datensicherung',
    items: [
      { key: 'backupReminderDays', label: 'Backup-Erinnerung nach', unit: 'Tagen', step: 1, min: 1, max: 60 },
    ],
  },
];

// Wertepaare, bei denen „von“ nicht größer als „bis“ sein darf
export const RANGE_PAIRS = [
  ['volumeRange.min', 'volumeRange.max'],
  ['intenseRange.min', 'intenseRange.max'],
  ['jumpNormal', 'jumpExtend'],
  ['volumeTargetMin', 'volumeTargetMax'],
];

export function readSetting(settings, key) {
  return key.split('.').reduce((value, part) => value?.[part], settings);
}

// Neuen Wert in eine Kopie der Einstellungen schreiben (auch verschachtelt)
export function withSetting(settings, key, value) {
  const [first, second] = key.split('.');
  if (!second) return { ...settings, [first]: value };
  return { ...settings, [first]: { ...settings[first], [second]: value } };
}
