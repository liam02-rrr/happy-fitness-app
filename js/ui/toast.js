import { h } from './dom.js';

// Kurze Meldung über der Tab-Leiste
export function toast(message, { variant = 'info', duration = 2600 } = {}) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: `toast toast-${variant}`, role: 'status' }, message);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  setTimeout(() => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 300);
  }, duration);
}
