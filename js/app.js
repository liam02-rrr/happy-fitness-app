import { tabs, renderScreen } from './ui/screens.js';
import { renderTabbar, setActiveTab } from './ui/tabbar.js';

const app = document.getElementById('app');
const screens = new Map(tabs.map((tab) => [tab.id, renderScreen(tab)]));
app.append(...screens.values());

const tabbar = renderTabbar(tabs, (id) => {
  location.hash = id;
});
document.body.append(tabbar);

// Routing über den Hash (#training, #history, …), damit der Tab beim Neuladen erhalten bleibt
function showTab() {
  const id = location.hash.slice(1);
  const current = screens.has(id) ? id : tabs[0].id;
  for (const [tabId, screen] of screens) {
    screen.classList.toggle('is-active', tabId === current);
  }
  setActiveTab(tabbar, current);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', showTab);
showTab();

// Offline-Fähigkeit
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((error) => {
    console.error('Service Worker konnte nicht registriert werden', error);
  });
}

// Daten dauerhaft speichern lassen, damit iOS sie nicht automatisch löscht
if (navigator.storage?.persist) {
  navigator.storage.persisted().then((persisted) => {
    if (!persisted) navigator.storage.persist();
  });
}
