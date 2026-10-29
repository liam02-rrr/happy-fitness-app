// Backup als JSON-Datei exportieren und wieder einlesen (SPEC.md, Abschnitt 6.6 und 10).
// Fotos (Blobs) werden als Base64 in die Datei geschrieben.
import { SCHEMA_VERSION, STORES, dumpAll, writeAll, saveInternalBackup } from './db.js';
import { getSettings, updateSettings } from './models/settings.js';
import { todayISO } from './ui/format.js';

const BLOB_KEY = '__blob';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const type = header.match(/^data:([^;]*)/)?.[1] || 'application/octet-stream';
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type });
}

// Rekursiv alle Blobs in Base64 umwandeln bzw. zurück
async function encodeBlobs(value) {
  if (value instanceof Blob) return { [BLOB_KEY]: await blobToDataUrl(value) };
  if (Array.isArray(value)) return Promise.all(value.map(encodeBlobs));
  if (value && typeof value === 'object') {
    const entries = await Promise.all(Object.entries(value).map(async ([key, val]) => [key, await encodeBlobs(val)]));
    return Object.fromEntries(entries);
  }
  return value;
}

async function decodeBlobs(value) {
  if (Array.isArray(value)) return Promise.all(value.map(decodeBlobs));
  if (value && typeof value === 'object') {
    if (typeof value[BLOB_KEY] === 'string') return dataUrlToBlob(value[BLOB_KEY]);
    const entries = await Promise.all(Object.entries(value).map(async ([key, val]) => [key, await decodeBlobs(val)]));
    return Object.fromEntries(entries);
  }
  return value;
}

export async function createBackupFile() {
  const data = await encodeBlobs(await dumpAll());
  const payload = { app: 'overload', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data };
  const json = JSON.stringify(payload);
  return new File([json], `overload-backup-${todayISO()}.json`, { type: 'application/json' });
}

// Über das iOS-Teilen-Menü speichern; wo das nicht geht, als Download.
// Muss direkt nach einem Tipp aufgerufen werden (iOS erlaubt das Teilen-Menü sonst nicht),
// deshalb wird die Datei vorher mit createBackupFile() erstellt.
export async function shareBackupFile(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (error) {
      if (error.name === 'AbortError') return false;
      throw error;
    }
  } else {
    const url = URL.createObjectURL(file);
    const link = Object.assign(document.createElement('a'), { href: url, download: file.name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  await updateSettings({ lastBackupAt: new Date().toISOString() });
  return true;
}

// Datei prüfen und eine kurze Übersicht liefern, bevor etwas gespeichert wird
export async function readBackupFile(file) {
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw new Error('Die Datei ist kein gültiges Backup (kein JSON).');
  }
  if (payload?.app !== 'overload' || typeof payload.data !== 'object') {
    throw new Error('Die Datei ist kein Overload-Backup.');
  }
  if (payload.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Das Backup stammt aus einer neueren App-Version. Bitte erst die App aktualisieren.');
  }
  const counts = Object.fromEntries(STORES.map((name) => [name, payload.data[name]?.length ?? 0]));
  return { payload, counts };
}

// Vorher automatisch intern sichern, dann ersetzen oder zusammenführen
export async function importBackup(payload, mode) {
  const { lastBackupAt } = await getSettings();
  await saveInternalBackup(mode === 'replace' ? 'Vor Backup-Import (ersetzen)' : 'Vor Backup-Import (zusammenführen)');
  const data = await decodeBlobs(payload.data);
  // Beim Zusammenführen die eigenen Einstellungen behalten
  if (mode === 'merge') delete data.settings;
  await writeAll(data, { replace: mode === 'replace' });

  // Das Datum des letzten Backups darf durch den Import nicht verloren gehen
  const latest = [lastBackupAt, payload.exportedAt].filter(Boolean).sort().at(-1);
  await updateSettings({ lastBackupAt: latest });
}
