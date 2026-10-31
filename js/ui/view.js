import { h, icon } from './dom.js';
import { icons } from './icons.js';

// Vollbild-Ansicht über den Tabs (z. B. Übung bearbeiten). Die Tab-Leiste wird solange ausgeblendet.
// onBack ersetzt das Schließen beim Tippen auf „Zurück“ (z. B. für Abläufe in mehreren Schritten).
export function openView({ title, content, footer, onClose, onBack }) {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    view.classList.remove('is-open');
    setTimeout(() => {
      view.remove();
      if (!document.querySelector('.view')) document.body.classList.remove('has-view');
    }, 250);
    onClose?.();
  };

  const view = h('div', { class: 'view', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', { class: 'view-header' },
      h('button', { type: 'button', class: 'view-back', onclick: () => (onBack ? onBack() : close()) }, icon(icons.back), 'Zurück'),
      h('h1', { class: 'view-title' }, title)
    ),
    h('div', { class: 'view-body' }, content),
    footer && h('footer', { class: 'view-footer' }, footer)
  );

  document.body.append(view);
  document.body.classList.add('has-view');
  requestAnimationFrame(() => requestAnimationFrame(() => view.classList.add('is-open')));
  return close;
}
