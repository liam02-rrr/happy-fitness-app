// IndexedDB-Wrapper mit Schema-Versionen, Migrationen und internen Sicherungen.
// Alle Daten bleiben im Gerät.

const DB_NAME = 'overload';
const BACKUP_DB_NAME = 'overload-backups';
const MAX_INTERNAL_BACKUPS = 5;

export const SCHEMA_VERSION = 1;

// Alle Tabellen der App (SPEC.md, Abschnitt 4)
export const STORES = ['exercises', 'sessions', 'entries', 'sets', 'bodyweight', 'settings'];

// Migrationen: Index = Zielversion. Jede Migration bekommt die Datenbank und die
// Upgrade-Transaktion und darf bestehende Daten nie löschen, nur umbauen.
const migrations = [
  null,
  // v1: Grundschema
  (db) => {
    db.createObjectStore('exercises', { keyPath: 'id' });

    const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
    sessions.createIndex('date', 'date');
    sessions.createIndex('status', 'status');

    const entries = db.createObjectStore('entries', { keyPath: 'id' });
    entries.createIndex('sessionId', 'sessionId');
    entries.createIndex('exerciseId', 'exerciseId');

    const sets = db.createObjectStore('sets', { keyPath: 'id' });
    sets.createIndex('entryId', 'entryId');

    const bodyweight = db.createObjectStore('bodyweight', { keyPath: 'id' });
    bodyweight.createIndex('date', 'date');

    db.createObjectStore('settings', { keyPath: 'id' });
  },
];

let dbPromise = null;

// Promise-Hülle um einen IndexedDB-Request
function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaktion abgebrochen'));
  });
}

// Aktuelle Version der Datenbank im Gerät, ohne sie zu verändern (0 = noch nicht vorhanden)
async function storedVersion() {
  if (indexedDB.databases) {
    const list = await indexedDB.databases();
    return list.find((entry) => entry.name === DB_NAME)?.version ?? 0;
  }
  const db = await promisify(indexedDB.open(DB_NAME));
  const { version } = db;
  db.close();
  return version;
}

function openRaw(version, onUpgrade) {
  return new Promise((resolve, reject) => {
    const request = version ? indexedDB.open(DB_NAME, version) : indexedDB.open(DB_NAME);
    request.onupgradeneeded = (event) => onUpgrade?.(request.result, request.transaction, event.oldVersion);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Datenbank ist in einem anderen Fenster geöffnet'));
  });
}

async function readAll(db, storeNames) {
  const names = storeNames.filter((name) => db.objectStoreNames.contains(name));
  const tx = db.transaction(names, 'readonly');
  const data = {};
  await Promise.all(names.map(async (name) => {
    data[name] = await promisify(tx.objectStore(name).getAll());
  }));
  return data;
}

export function openDB() {
  dbPromise ??= (async () => {
    const current = await storedVersion();

    // Vor einer Migration bestehender Daten: automatisch sichern
    if (current > 0 && current < SCHEMA_VERSION) {
      const old = await openRaw(current);
      const data = await readAll(old, [...old.objectStoreNames]);
      old.close();
      await saveInternalBackup(`Vor Migration v${current} → v${SCHEMA_VERSION}`, current, data);
    }

    const db = await openRaw(SCHEMA_VERSION, (database, tx, oldVersion) => {
      for (let version = oldVersion + 1; version <= SCHEMA_VERSION; version++) {
        migrations[version](database, tx);
      }
    });
    db.onversionchange = () => db.close();
    return db;
  })();
  return dbPromise;
}

// Einfache Zugriffe auf eine Tabelle
export async function getAll(store) {
  const db = await openDB();
  return promisify(db.transaction(store).objectStore(store).getAll());
}

export async function getAllByIndex(store, index, value) {
  const db = await openDB();
  return promisify(db.transaction(store).objectStore(store).index(index).getAll(value));
}

export async function get(store, id) {
  const db = await openDB();
  return promisify(db.transaction(store).objectStore(store).get(id));
}

export async function put(store, record) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(record);
  await transactionDone(tx);
  return record;
}

export async function remove(store, id) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  await transactionDone(tx);
}

// Alle Tabellen lesen (für Export und Sicherungen)
export async function dumpAll() {
  const db = await openDB();
  return readAll(db, STORES);
}

// Daten in einem Rutsch schreiben. replace = vorher alle Tabellen leeren.
// Läuft in einer Transaktion: Bei einem Fehler bleibt alles wie vorher.
export async function writeAll(data, { replace }) {
  const db = await openDB();
  const tx = db.transaction(STORES, 'readwrite');
  for (const name of STORES) {
    const store = tx.objectStore(name);
    if (replace) store.clear();
    for (const record of data[name] ?? []) store.put(record);
  }
  await transactionDone(tx);
}

export function newId() {
  return crypto.randomUUID();
}

// Interne Sicherungen in einer eigenen Datenbank, damit sie eine Migration unbeschadet überstehen
function openBackupDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKUP_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('backups', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveInternalBackup(reason, schemaVersion = SCHEMA_VERSION, data = null) {
  data ??= await dumpAll();
  const db = await openBackupDB();
  const all = await promisify(db.transaction('backups').objectStore('backups').getAll());

  const tx = db.transaction('backups', 'readwrite');
  const store = tx.objectStore('backups');
  store.put({ id: newId(), createdAt: new Date().toISOString(), reason, schemaVersion, data });

  // Nur die neuesten Sicherungen behalten
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(MAX_INTERNAL_BACKUPS - 1)
    .forEach((old) => store.delete(old.id));

  await transactionDone(tx);
  db.close();
}

export async function listInternalBackups() {
  const db = await openBackupDB();
  const all = await promisify(db.transaction('backups').objectStore('backups').getAll());
  db.close();
  return all
    .map(({ id, createdAt, reason }) => ({ id, createdAt, reason }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
