import { h } from './dom.js';

// Bottom-Sheet von unten (Daumenbereich). Gibt eine Funktion zum Schließen zurück.
// Eine Aktion schließt das Sheet, außer ihr onClick gibt false zurück.
export function openSheet({ title, text, content, actions = [], onClose }) {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 300);
    onClose?.();
  };

  const buttons = actions.map(({ label, variant = 'secondary', onClick }) =>
    h('button', {
      type: 'button',
      class: `btn btn-${variant} btn-block`,
      onclick: async () => {
        if ((await onClick?.()) !== false) close();
      },
    }, label)
  );

  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-handle' }),
    h('h2', { class: 'sheet-title' }, title),
    text && h('p', { class: 'sheet-text' }, text),
    content,
    h('div', { class: 'sheet-actions' },
      buttons,
      h('button', { type: 'button', class: 'btn btn-ghost btn-block', onclick: close }, 'Abbrechen'))
  );

  const overlay = h('div', { class: 'sheet-overlay', onclick: (event) => event.target === overlay && close() }, sheet);
  document.body.append(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-open')));
  return close;
}

// Ja/Nein-Abfrage: true bei Bestätigung, false bei Abbrechen
export function confirmSheet({ title, text, confirmLabel, variant = 'danger' }) {
  return new Promise((resolve) => {
    let confirmed = false;
    openSheet({
      title,
      text,
      actions: [{ label: confirmLabel, variant, onClick: () => { confirmed = true; } }],
      onClose: () => resolve(confirmed),
    });
  });
}
