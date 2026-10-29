import { get, put } from '../db.js';

const SETTINGS_ID = 'main';

// Standardwerte aus SPEC.md, Abschnitt 8. Die Bearbeitung kommt in Phase 2.
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
