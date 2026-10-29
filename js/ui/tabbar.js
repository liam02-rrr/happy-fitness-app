import { icons } from './icons.js';

// Schwebende Tab-Leiste: aktiver Tab als Pille mit Beschriftung, übrige nur als Icon
export function renderTabbar(tabs, onSelect) {
  const nav = document.createElement('nav');
  nav.className = 'tabbar';
  nav.setAttribute('aria-label', 'Hauptnavigation');

  for (const tab of tabs) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tab';
    button.dataset.tab = tab.id;
    button.setAttribute('aria-label', tab.label);
    button.innerHTML = `${icons[tab.id]}<span class="tab-label">${tab.label}</span>`;
    button.addEventListener('click', () => onSelect(tab.id));
    nav.append(button);
  }

  return nav;
}

export function setActiveTab(nav, tabId) {
  for (const button of nav.querySelectorAll('.tab')) {
    const active = button.dataset.tab === tabId;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  }
}
