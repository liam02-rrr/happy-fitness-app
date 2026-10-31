// Service Worker: speichert alle App-Dateien im Gerät, damit die App offline startet.
// Bei jedem Release CACHE_VERSION erhöhen und neue Dateien in APP_FILES eintragen.
const CACHE_VERSION = 'overload-v6';

// index.html fehlt absichtlich: Cloudflare leitet /index.html auf / um, und eine
// umgeleitete Antwort darf der Service Worker nicht als Seite ausliefern.
const APP_FILES = [
  './',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './js/app.js',
  './js/db.js',
  './js/backup.js',
  './js/algorithm/compare.js',
  './js/models/settings.js',
  './js/models/bodyweight.js',
  './js/models/exercises.js',
  './js/models/muscles.js',
  './js/models/sessions.js',
  './js/models/sets.js',
  './js/ui/active-training.js',
  './js/ui/controls.js',
  './js/ui/dom.js',
  './js/ui/exercise-editor.js',
  './js/ui/exercises.js',
  './js/ui/format.js',
  './js/ui/icons.js',
  './js/ui/photo.js',
  './js/ui/rest-timer.js',
  './js/ui/screens.js',
  './js/ui/set-row.js',
  './js/ui/settings.js',
  './js/ui/sheet.js',
  './js/ui/tabbar.js',
  './js/ui/toast.js',
  './js/ui/training.js',
  './js/ui/training-flow.js',
  './js/ui/view.js',
  './assets/icons/icon-180.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.all(APP_FILES.map(async (url) => {
        const response = await fetch(new Request(url, { cache: 'reload' }));
        if (!response.ok) throw new Error(`${url} konnte nicht geladen werden`);
        await cache.put(url, await withoutRedirect(response));
      })))
      .then(() => self.skipWaiting())
  );
});

// Eine umgeleitete Antwort als neue, saubere Antwort speichern (Safari lehnt sie sonst ab)
async function withoutRedirect(response) {
  if (!response.redirected) return response;
  const body = await response.blob();
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Erst im Cache suchen, sonst aus dem Netz laden. Seitenaufrufe liefern immer die Startseite.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./').then((cached) => cached || fetch(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request))
  );
});
